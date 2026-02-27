'''
FastAPI server that exposes the Compliance QA Pipeline as an HTTP API.

This is a thin wrapper around the existing LangGraph workflow.
Your frontend sends a video URL -> the pipeline runs -> results come back as JSON.
'''

import uuid
import logging
from typing import List, Optional

from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.src.graph.workflow import app as workflow_app

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("api-server")

# --- Pydantic Models ---
# These define the shape of request/response JSON and auto-validate input.

class AuditRequest(BaseModel):
    '''What the frontend sends: just a YouTube URL.'''
    video_url: str

class ComplianceIssueResponse(BaseModel):
    '''A single compliance violation found by the auditor.'''
    category: str
    description: str
    severity: str
    timestamp: Optional[str] = None

class AuditResponse(BaseModel):
    '''What the frontend receives: the full audit result.'''
    video_id: str
    status: str
    compliance_results: List[ComplianceIssueResponse]
    report: str

# --- FastAPI App ---
# This creates the actual web server. CORS middleware allows your frontend
# (running on a different port) to make requests to this API.

app = FastAPI(
    title="VisionAudit AI",
    description="Compliance QA Pipeline API",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # allows any frontend origin (restrict in production)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Endpoint ---

@app.post("/audit", response_model=AuditResponse)
def run_audit(request: AuditRequest):
    '''
    POST /audit

    Accepts a video URL, runs the full compliance audit pipeline
    (download -> Azure Video Indexer -> RAG + LLM analysis),
    and returns the results.

    This is the same workflow that main.py runs, but exposed over HTTP.
    '''
    session_id = str(uuid.uuid4())
    video_id = f"vid_{session_id[:8]}"

    logger.info(f"[API] New audit request: {request.video_url} (session: {session_id})")

    # Build the initial state — same structure as main.py uses
    initial_state = {
        "video_url": request.video_url,
        "video_id": video_id,
        "compliance_results": [],
        "errors": []
    }

    try:
        # This invokes the LangGraph workflow: index_video_node -> audit_content_node
        # It blocks until the full pipeline completes (can take a few minutes)
        final_state = workflow_app.invoke(initial_state)

        logger.info(f"[API] Audit complete for {video_id}: {final_state.get('final_status')}")

        return AuditResponse(
            video_id=final_state.get("video_id", video_id),
            status=final_state.get("final_status", "FAIL"),
            compliance_results=final_state.get("compliance_results", []),
            report=final_state.get("final_report", "No report generated.")
        )

    except Exception as e:
        logger.error(f"[API] Audit failed for {video_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Audit pipeline failed: {str(e)}")

# --- Health Check ---

@app.get("/health")
def health_check():
    '''Simple health check endpoint to verify the server is running.'''
    return {"status": "ok", "service": "VisionAudit AI"}

# --- Debug Endpoint ---

@app.get("/debug/transcript")
def debug_transcript(url: str):
    '''
    GET /debug/transcript?url=<youtube_url>
    Diagnoses transcript extraction and Azure VI credentials on the deployed server.
    '''
    import os
    import tempfile
    import yt_dlp as _yt_dlp
    from backend.src.services.video_indexer import VideoIndexerService

    results = {}

    # Test 1: youtube-transcript-api
    try:
        svc = VideoIndexerService()
        transcript = svc.fetch_youtube_transcript(url)
        results["youtube_transcript_api"] = {
            "status": "ok" if transcript else "empty",
            "chars": len(transcript),
            "preview": transcript[:300] if transcript else None
        }
    except Exception as e:
        results["youtube_transcript_api"] = {
            "status": "error",
            "error": type(e).__name__,
            "detail": str(e)
        }

    # Test 2: yt-dlp subtitle-only
    try:
        svc = VideoIndexerService()
        transcript2 = svc.fetch_subtitles_via_ytdlp(url)
        results["ytdlp_subtitles"] = {
            "status": "ok" if transcript2 else "empty",
            "chars": len(transcript2),
            "preview": transcript2[:300] if transcript2 else None
        }
    except Exception as e:
        results["ytdlp_subtitles"] = {
            "status": "error",
            "error": type(e).__name__,
            "detail": str(e)
        }

    # Test 3: yt-dlp audio download (can Render download from YouTube?)
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            out_path = os.path.join(tmpdir, "test_audio.%(ext)s")
            ydl_opts = {
                'format': 'bestaudio[filesize<10M]/worstaudio',
                'outtmpl': out_path,
                'quiet': True,
                'extractor_args': {'youtube': {'player_client': ['ios', 'mweb', 'web']}},
            }
            with _yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
            files = os.listdir(tmpdir)
            total_size = sum(os.path.getsize(os.path.join(tmpdir, f)) for f in files)
            results["ytdlp_audio_download"] = {
                "status": "ok",
                "files": files,
                "total_bytes": total_size,
                "title": info.get("title") if info else None
            }
    except Exception as e:
        results["ytdlp_audio_download"] = {
            "status": "error",
            "error": type(e).__name__,
            "detail": str(e)
        }

    # Test 4: Azure Video Indexer credentials
    try:
        svc = VideoIndexerService()
        token = svc.get_account_access_token()
        results["azure_vi_credentials"] = {
            "status": "ok",
            "account_id": svc.account_id,
            "location": svc.location,
            "token_type": type(token).__name__
        }
    except Exception as e:
        results["azure_vi_credentials"] = {
            "status": "error",
            "error": type(e).__name__,
            "detail": str(e)
        }

    return results
