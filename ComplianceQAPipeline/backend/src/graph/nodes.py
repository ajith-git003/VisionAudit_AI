import json
import os
import logging
import re
from typing import Dict, Any, List

from langchain_openai import AzureChatOpenAI, AzureOpenAIEmbeddings
from langchain_community.vectorstores import AzureSearch
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage

#import state schema
from backend.src.graph.state import VideoAuditState, ComplianceIssue

#import service
from backend.src.services.video_indexer import VideoIndexerService

#configure the logger
logger = logging.getLogger("brand-guardian")
logging.basicConfig(level=logging.INFO)

#NODE 1: Indexer
#function responsible for converting video to text
def index_video_node(state: VideoAuditState)  -> Dict[str,Any]:
    '''Downloads the youtube video from the URL
    Uploads to the Azure video indexer
    extracts the insights'''

    video_url = state.get("video_url")
    video_id_input = state.get("video_id", "vid_demo")

    logger.info(f"----[Node:Indexer] Processing: {video_url}")

    local_file_path = state.get("local_file_path")

    try:
        vi_service = VideoIndexerService()
        is_youtube = "youtube.com" in (video_url or "") or "youtu.be" in (video_url or "")

        if local_file_path and os.path.exists(local_file_path):
            # File upload path — upload the local file directly
            logger.info(f"Using pre-uploaded local file: {local_file_path}")
            azure_video_id = vi_service.upload_video(local_file_path, video_name=video_id_input)
        elif is_youtube:
            # YouTube URL path — download first (yt-dlp, falls back to Node.js downloader
            # if yt-dlp is IP-blocked), then upload the file to Azure VI.
            local_path = vi_service.download_youtube_video(video_url, output_path="temp_audit_video.mp4")
            azure_video_id = vi_service.upload_video(local_path, video_name=video_id_input)
            if os.path.exists(local_path):
                os.remove(local_path)
        else:
            raise Exception("Provide a valid YouTube URL or upload a video file.")
        logger.info(f"Upload Success. Azure ID: {azure_video_id}")

        raw_insights = vi_service.wait_for_processing(azure_video_id)
        #extract
        clean_data = vi_service.extract_data(raw_insights)
        logger.info("---[NODE: Indexer] Extraction Complete ------")
        return clean_data
    except Exception as e:
        logger.error(f"Video Indexer Failed : {e}")
        return{
            "errors" : [str(e)],
            "final_status": "FAIL",
            "transcript": "",
            "ocr_text": []

        }

# ── Helper: run a single LLM compliance audit ──────────────────────────────
def _run_single_audit(
    llm, retrieved_rules: str, transcript: str, ocr_text: List,
    video_metadata: dict, guideline_label: str, focus_instructions: str
) -> dict:
    '''Calls GPT-4o with a focused system prompt for one guideline set.'''
    if not retrieved_rules.strip():
        return {
            "compliance_results": [],
            "final_status": "FAIL",
            "final_report": f"No {guideline_label} rules found in knowledge base.",
        }

    system_prompt = f"""
You are an expert brand compliance auditor reviewing PAID BRAND ADVERTISEMENTS.
Audit the video content ONLY against the {guideline_label} rules provided below.

OFFICIAL GUIDELINES ({guideline_label}):
{retrieved_rules}

AUDIT INSTRUCTIONS:
1. Analyze the transcript and OCR text against EVERY rule in the OFFICIAL GUIDELINES above.
2. Identifying Violations:
   - Only flag a violation if a SPECIFIC rule from the OFFICIAL GUIDELINES is clearly breached.
   - CONTEXT: This is a paid advertisement already running on YouTube. Apply a reasonable, industry-standard lens.
   - COSMETIC VS CLINICAL: Standard beauty marketing puffery ("radiance", "hydration", "2x glow", "7x more shine") is allowed.
     Only flag explicit clinical/medical claims (e.g., "cures eczema", "treats acne clinically").
   - "Studies show" in a general cosmetic context is standard marketing — do NOT flag unless a rule explicitly forbids it.
   - MARKETING PUFFERY: Superlatives ("best", "amazing", "powerful") are compliant for professional ads.
   - When in doubt, do NOT flag. Only flag violations you are highly confident about.
   - Provide a "timestamp" (MM:SS) where the violation occurs.
{focus_instructions}
3. Classification:
   - Categorize each violation (e.g., "Disclosure", "Performance Claims", "Prohibited Content").
   - Assign SEVERITY: CRITICAL (dangerous/illegal), MAJOR (core rule breach), MINOR (technicality).
4. Summary Report: 3-5 bullet points. If zero violations, congratulate on compliance.

STRICT OUTPUT FORMAT (JSON ONLY):
{{
    "compliance_results": [
        {{
            "category": "Category Name",
            "severity": "CRITICAL/MAJOR/MINOR",
            "description": "Specific explanation citing the broken rule.",
            "timestamp": "MM:SS"
        }}
    ],
    "status": "PASS or FAIL",
    "final_report": "• Point 1\\n• Point 2"
}}

NOTE: If "compliance_results" is empty, status MUST be "PASS". Otherwise "FAIL".
"""
    transcript_section = transcript if transcript else "[No spoken audio — evaluate on OCR text only.]"
    user_message = f"""
VIDEO_METADATA: {video_metadata}
TRANSCRIPT: {transcript_section}
ON-SCREEN TEXT (OCR): {ocr_text}
"""
    response = None
    try:
        response = llm.invoke([SystemMessage(content=system_prompt), HumanMessage(content=user_message)])
        content = response.content
        if "```" in content:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
            if match:
                content = match.group(1)
        elif "'''" in content:
            match = re.search(r"'''(?:json)?\s*([\s\S]*?)\s*'''", content)
            if match:
                content = match.group(1)
        audit_data = json.loads(content.strip())
        results = audit_data.get("compliance_results", [])
        return {
            "compliance_results": results,
            "final_status": "FAIL" if results else "PASS",
            "final_report": audit_data.get("final_report", "No report generated."),
        }
    except Exception as e:
        logger.error(f"[{guideline_label}] Audit error: {e}")
        logger.error(f"[{guideline_label}] Raw LLM response: {response.content if response else 'None'}")
        return {
            "compliance_results": [],
            "final_status": "FAIL",
            "final_report": f"Audit failed due to a system error: {e}",
        }


# NODE 2: Compliance Auditor
def audit_content_node(state: VideoAuditState) -> Dict[str, Any]:
    '''Runs two separate RAG+LLM compliance audits:
       1. YouTube Ad Guidelines (youtube-ad-specs + Youtube_ad_guidelines PDFs)
       2. Influencer Guidelines (influencer-guide PDF)
    '''
    logger.info("----[Node: Auditor] querying Knowledge base & LLM")

    indexer_errors = state.get("errors", [])
    transcript = state.get("transcript") or ""
    ocr_text = state.get("ocr_text", [])

    _fail_both = lambda msg: {
        "youtube_compliance_results": [],
        "youtube_final_status": "FAIL",
        "youtube_final_report": msg,
        "influencer_compliance_results": [],
        "influencer_final_status": "FAIL",
        "influencer_final_report": msg,
    }

    if not transcript and not ocr_text:
        if indexer_errors:
            error_detail = "; ".join(indexer_errors)
            logger.warning(f"No transcript/OCR — indexer errors: {error_detail}")
            return _fail_both(f"Video processing failed: {error_detail}")
        logger.warning("No transcript or OCR available. Skipping audit.")
        return _fail_both("Audit skipped: no transcript or on-screen text could be extracted.")

    # ── Init LLM + vector store ────────────────────────────────────────────
    llm = AzureChatOpenAI(
        azure_deployment=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
        openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
        temperature=0.0,
    )
    embeddings = AzureOpenAIEmbeddings(
        azure_deployment="text-embedding-3-small",
        openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    )
    vector_store = AzureSearch(
        azure_search_endpoint=os.getenv("AZURE_AI_SEARCH_ENDPOINT"),
        azure_search_key=os.getenv("AZURE_SEARCH_API_KEY"),
        index_name=os.getenv("AZURE_SEARCH_INDEX_NAME"),
        embedding_function=embeddings.embed_query,
    )

    # ── RAG: two separate searches — one per guideline source ─────────────
    # Using source-prefixed queries so hybrid search retrieves contextually
    # relevant rules from the right PDF (k=5 keeps token count tight).
    video_context = f"{transcript[:400]} {''.join(ocr_text[:5])}"

    YOUTUBE_SOURCES   = {"youtube-ad-specs.pdf", "Youtube_ad_guidelines.pdf"}
    INFLUENCER_SOURCES = {"1001a-influencer-guide-508_1.pdf"}

    raw_yt  = vector_store.hybrid_search(f"youtube ad policy brand safety {video_context}", k=6)
    raw_inf = vector_store.hybrid_search(f"influencer marketing disclosure sponsorship {video_context}", k=6)

    youtube_docs   = [d for d in raw_yt  if d.metadata.get("source", "") in YOUTUBE_SOURCES][:5]
    influencer_docs = [d for d in raw_inf if d.metadata.get("source", "") in INFLUENCER_SOURCES][:5]

    youtube_rules   = "\n\n".join([d.page_content for d in youtube_docs])
    influencer_rules = "\n\n".join([d.page_content for d in influencer_docs])
    video_metadata  = state.get("video_metadata", {})

    logger.info(f"RAG: {len(youtube_docs)} YouTube docs, {len(influencer_docs)} Influencer docs retrieved.")

    # ── Run both audits ────────────────────────────────────────────────────
    yt_focus = """
   YOUTUBE AD GUIDELINES FOCUS:
   - Prohibited / restricted content categories (adult, dangerous, hate speech, etc.)
   - Ad format and technical specification violations
   - Brand safety and content policy issues
   - Deceptive claims or misleading product representations
"""
    inf_focus = """
   INFLUENCER GUIDELINES FOCUS:
   - Mandatory sponsorship / paid partnership disclosure (#ad, #sponsored, clear labelling)
   - Claim substantiation — any before/after, clinical efficacy, or survey-backed claims
   - Transparency about the promotional relationship
   - Authenticity requirements for endorsements
"""

    yt_result = _run_single_audit(llm, youtube_rules, transcript, ocr_text, video_metadata,
                                  "YouTube Ad Guidelines", yt_focus)
    inf_result = _run_single_audit(llm, influencer_rules, transcript, ocr_text, video_metadata,
                                   "Influencer Guidelines", inf_focus)

    logger.info(f"YouTube audit: {yt_result['final_status']} | Influencer audit: {inf_result['final_status']}")

    return {
        "youtube_compliance_results": yt_result["compliance_results"],
        "youtube_final_status": yt_result["final_status"],
        "youtube_final_report": yt_result["final_report"],
        "influencer_compliance_results": inf_result["compliance_results"],
        "influencer_final_status": inf_result["final_status"],
        "influencer_final_report": inf_result["final_report"],
    }
