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
            # YouTube URL path — submit the URL directly to Azure VI (no local download).
            # Azure VI fetches it from their own servers, bypassing any IP blocks on this host.
            logger.info(f"Submitting YouTube URL directly to Azure VI: {video_url}")
            azure_video_id = vi_service.upload_video_from_url(video_url, video_name=video_id_input)
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
            "error" : [str(e)],
            "final_status": "FAIL",
            "transcript": "",
            "ocr_text": []

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
               - CONTEXT: This video is already approved and actively running as a paid YouTube advertisement. It has passed YouTube's ad review process. Apply a reasonable, industry-standard lens — not an overly strict academic one.
               - COSMETIC VS CLINICAL: Differentiate between standard beauty marketing (puffery) and actual clinical claims.
                 - PERMISSIBLE LANGUAGE: Words like "radiance", "hydration", "glow", "illuminates complexion", "powerful benefits", "nourishing", "strengthening", and multiplier claims like "2x", "3x", "7x" used for cosmetic effect (e.g., "7x more hydration feel") are standard beauty marketing and must NOT be flagged.
                 - CLINICAL CLAIMS: Only flag if the ad explicitly claims to treat, cure, or prevent a medical condition (e.g., "cures eczema", "treats acne clinically") OR cites a specific unsubstantiated consumer survey as proof of a medical outcome (e.g., "87% of dermatologists agree it treats psoriasis").
                 - "Market research" or "studies show" used in a general cosmetic context (e.g., "studies show it boosts shine") is standard beauty marketing — do NOT flag unless a specific rule explicitly forbids it.
               - MARKETING PUFFERY: Assume standard brand superlatives ("best", "amazing", "powerful", "transformative") are compliant for professional ads.
               - DISCLOSURE EXCEPTION: Paid advertisements are labeled "Sponsored" by YouTube. Do not flag lack of on-screen disclosure as a violation unless a specific rule explicitly requires extra on-screen text for this exact format.
               - When in doubt, do NOT flag. Only flag violations you are highly confident about.
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
        # Strip markdown code fences: ```json ... ``` or '''json ... '''
        if "```" in content:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
            if match:
                content = match.group(1)
        elif "'''" in content:
            match = re.search(r"'''(?:json)?\s*([\s\S]*?)\s*'''", content)
            if match:
                content = match.group(1)
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
