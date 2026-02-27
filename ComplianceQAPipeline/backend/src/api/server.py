'''
FastAPI server that exposes the Compliance QA Pipeline as an HTTP API.

This is a thin wrapper around the existing LangGraph workflow.
Your frontend sends a video URL -> the pipeline runs -> results come back as JSON.
'''

import os
import uuid
import logging
import tempfile
import shutil
from typing import List, Optional

from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI, HTTPException, UploadFile, File
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

# --- File Upload Endpoint ---

@app.post("/audit-file", response_model=AuditResponse)
async def run_audit_file(file: UploadFile = File(...)):
    '''
    POST /audit-file

    Accepts a video file upload (mp4, mov, avi, etc.), uploads it directly to
    Azure Video Indexer, and returns the compliance audit results.

    Use this when YouTube download is not available — download the video yourself
    (e.g. using a tool like vidssave.com/yt) and upload it here.
    '''
    session_id = str(uuid.uuid4())
    video_id = f"vid_{session_id[:8]}"

    logger.info(f"[API] New file upload audit: {file.filename} (session: {session_id})")

    # Save the uploaded file to a temp location on disk
    suffix = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
    tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        shutil.copyfileobj(file.file, tmp_file)
        tmp_file.close()
        tmp_path = tmp_file.name

        initial_state = {
            "video_url": "",
            "video_id": video_id,
            "local_file_path": tmp_path,
            "compliance_results": [],
            "errors": []
        }

        final_state = workflow_app.invoke(initial_state)

        logger.info(f"[API] File audit complete for {video_id}: {final_state.get('final_status')}")

        return AuditResponse(
            video_id=final_state.get("video_id", video_id),
            status=final_state.get("final_status", "FAIL"),
            compliance_results=final_state.get("compliance_results", []),
            report=final_state.get("final_report", "No report generated.")
        )

    except Exception as e:
        logger.error(f"[API] File audit failed for {video_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Audit pipeline failed: {str(e)}")

    finally:
        # Always clean up the temp file
        if os.path.exists(tmp_file.name):
            os.remove(tmp_file.name)

# --- Health Check ---

@app.get("/health")
def health_check():
    '''Simple health check endpoint to verify the server is running.'''
    return {"status": "ok", "service": "VisionAudit AI"}
