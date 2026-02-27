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
def index_video_node(state: VideoAuditState) -> Dict[str, Any]:
    '''
    Extracts transcript and OCR text from a YouTube video.

    Strategy (avoids yt-dlp download failures on cloud server IPs):
    1. Fetch transcript via youtube-transcript-api (no download needed, works on Render).
    2. Send video URL directly to Azure Video Indexer for OCR extraction.
       Falls back gracefully if Azure VI upload fails.
    '''
    video_url = state.get("video_url")

    logger.info(f"----[Node:Indexer] Processing: {video_url}")

    if not ("youtube.com" in video_url or "youtu.be" in video_url):
        return {
            "error": ["Please provide a valid YouTube URL."],
            "final_status": "FAIL",
            "transcript": "",
            "ocr_text": []
        }

    vi_service = VideoIndexerService()

    # Step 1: youtube-transcript-api (for videos that have captions — no download needed)
    transcript = vi_service.fetch_youtube_transcript(video_url)

    # Step 2: yt-dlp subtitle-only (no video download, just VTT caption file)
    if not transcript:
        logger.info("[Node:Indexer] No captions found, trying yt-dlp subtitle download...")
        transcript = vi_service.fetch_subtitles_via_ytdlp(video_url)

    ocr_lines = []
    video_metadata = {"platform": "youtube"}

    # Step 3: Piped proxy → Azure Video Indexer
    # Piped (open YouTube proxy) returns a direct CDN stream URL that Azure VI can download.
    # This bypasses YouTube IP blocking entirely — no cookies needed.
    if not transcript:
        logger.info("[Node:Indexer] No subtitles, trying Piped proxy → Azure Video Indexer...")
        video_id_name = state.get("video_id", "audit")
        try:
            stream_url = vi_service.get_stream_url_via_piped(video_url)
            logger.info(f"[Node:Indexer] Got stream URL via Piped, uploading to Azure VI...")
            azure_video_id = vi_service.upload_video_by_url(stream_url, video_name=video_id_name)
            logger.info(f"[Node:Indexer] Azure VI upload success. ID: {azure_video_id}")
            raw_insights = vi_service.wait_for_processing(azure_video_id)
            clean_data = vi_service.extract_data(raw_insights)
            transcript = clean_data.get("transcript", "")
            ocr_lines = clean_data.get("ocr_text", [])
            video_metadata = clean_data.get("video_metadata", video_metadata)
            logger.info("---[Node:Indexer] Piped + Azure VI extraction complete ---")
        except Exception as e:
            logger.error(f"[Node:Indexer] Piped + Azure VI failed: {type(e).__name__}: {e}")

    if not transcript and not ocr_lines:
        logger.error("[Node:Indexer] No content extracted from any source.")
        return {
            "error": ["No transcript or on-screen text could be extracted. "
                      "Set the YOUTUBE_COOKIES environment variable on the server to enable audio transcription for videos without captions."],
            "final_status": "FAIL",
            "transcript": "",
            "ocr_text": []
        }

    logger.info("---[NODE: Indexer] Extraction Complete ------")
    return {
        "transcript": transcript,
        "ocr_text": ocr_lines,
        "video_metadata": video_metadata
    }

# NODE 2: Compliance Auditor
def audit_content_node(state:VideoAuditState)  -> Dict[str,Any]:
    '''Performs Retrieval Augmented Generation to audit the content - brand video'''

    logger.info("----[Node: Auditor] querying Knowledge base & LLM")
    transcript = state.get("transcript") or ""
    ocr_text_early = state.get("ocr_text", [])

    if not transcript and not ocr_text_early:
        logger.warning("No transcript or OCR text available. Skipping audit...")
        return {
            "final_status": "FAIL",
            "final_report": "Audit skipped: no transcript or on-screen text could be extracted from this video."
        }

    if not transcript:
        logger.info("No transcript found — running audit on OCR text only.")

    #initialise clients
    llm = AzureChatOpenAI(
        azure_deployment= os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
        openai_api_version = os.getenv("AZURE_OPENAI_API_VERSION"),
        temperature = 0.0
    )

    embeddings = AzureOpenAIEmbeddings(
        azure_deployment = "text-embedding-3-small",
        openai_api_version = os.getenv("AZURE_OPENAI_API_VERSION")
    )

    vector_store = AzureSearch(
        azure_search_endpoint = os.getenv("AZURE_AI_SEARCH_ENDPOINT"),
        azure_search_key = os.getenv("AZURE_SEARCH_API_KEY"),
        index_name = os.getenv("AZURE_SEARCH_INDEX_NAME"),
        embedding_function = embeddings.embed_query

    )
    #RAG Retrieval
    ocr_text = state.get("ocr_text",[])
    query_text =f"{transcript} {''.join(ocr_text)}"
    docs = vector_store.hybrid_search(query_text, k=3)
    retrieved_rules = "\n\n".join([doc.page_content for doc in docs])
    #
    system_prompt = f"""
            You are a expert brand compliance auditor reviewing PAID BRAND ADVERTISEMENTS.
            Your goal is to ensure the video content strictly adheres to the official regulatory and brand guidelines.

            OFFICIAL GUIDELINES & RULES (CITE THESE):
            {retrieved_rules}

            AUDIT INSTRUCTIONS:
            1. Analyze the transcript and OCR text below carefully against EVERY rule provided in the "OFFICIAL GUIDELINES" section.
            2. Identifying Violations:
               - Only flag a violation if a SPECIFIC rule from the "OFFICIAL GUIDELINES" is clearly breached.
               - COSMETIC VS CLINICAL: Differentiate between standard beauty marketing (puffery) and actual clinical claims. 
                 - PERMISSIBLE LANGUAGE: Words like "radiance", "hydration", "glow", and "illuminates complexion" are standard cosmetic promises and should NOT be flagged as violations unless they specifically make a medical claim (e.g., "cures eczema").
                 - CLINICAL CLAIMS: Only flag "Performance" or "Clinical" claims if they are specifically medical (e.g., treats a disease) or use measurable, unsubstantiated data (e.g., "75% of women agreed").
               - MARKETING PUFFERY: Assume standard brand superlatives ("best", "amazing") are compliant for professional ads.
               - DISCLOSURE EXCEPTION: Paid advertisements are often labeled "Sponsored" by the platform. Do not flag lack of on-screen disclosure as a violation unless a specific rule explicitly requires extra on-screen text for the format.
               - Provide a "timestamp" (MM:SS) where the violation occurs.
            3. Classification:
               - Categorize each violation based on the rule it breaks (e.g., "Disclosure", "Performance Claims", "Product Prominence").
               - Assign SEVERITY:
                 - CRITICAL: Dangerous, illegal, or grossly misleading.
                 - MAJOR: Direct violation of a core regulatory rule.
                 - MINOR: Technicality or small oversight (e.g., font size).
            4. Summary Report:
               - The "final_report" MUST be a summary of the findings (3-5 bullets).
               - If zero violations found, congratulate the brand on compliance.

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
    transcript_section = transcript if transcript else "[No spoken audio — transcript unavailable. Evaluate based on on-screen text only.]"
    user_message = f"""
                VIDEO_METADATA: {state.get('video_metadata', {})}
                TRANSCRIPT: {transcript_section}
                ON-SCREEN TEXT (OCR): {ocr_text}
                """
    try:
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message)
        ])
        content = response.content
        if "'''" in content:
            content = re.search(r"'''(?:json)?(.?)'''", content, re.DOTALL).group(1)
        audit_data = json.loads(content.strip())
        results = audit_data.get("compliance_results",[])
        
        # Determine status based on presence of violations
        final_status = "FAIL" if results else "PASS"

        return {
            "compliance_results": results,
            "final_status": final_status,
            "final_report": audit_data.get("final_report", "No report generated.")
        }

    except Exception as e:
        logger.error(f"System Error in Auditor Node: {str(e)}")
        #logging the raw response 
        logger.error(f"Raw LLM response: {response.content if 'response' in locals() else 'None'}")
        return {
            "errors": [str(e)],
            "final_status": "FAIL"
        }
