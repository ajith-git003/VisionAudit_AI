'''
FastAPI server — Compliance QA Pipeline HTTP API.
Uses async job pattern: POST returns job_id immediately, GET /status/{job_id} polls for result.
This prevents Render's proxy from dropping long-running connections.
'''

import os
import uuid
import logging
import tempfile
import shutil
import threading
from typing import List, Optional, Dict, Any

from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.src.graph.workflow import app as workflow_app
from backend.src.services.video_indexer import VideoIndexerService
from backend.src.api.telemetry import setup_telemetry

# --- Telemetry ---
setup_telemetry()

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("api-server")

# --- In-memory job store ---
# Stores background job results: job_id -> job dict
# Fine for a single-instance Render deployment.
_jobs: Dict[str, Any] = {}

# --- Pydantic Models ---

class AuditRequest(BaseModel):
    video_url: str

class JobAccepted(BaseModel):
    job_id: str
    status: str  # "processing"

class ComplianceIssueResponse(BaseModel):
    category: str
    description: str
    severity: str
    timestamp: Optional[str] = None

class AuditResultBlock(BaseModel):
    status: str
    compliance_results: List[ComplianceIssueResponse]
    report: str

class AuditResponse(BaseModel):
    video_id: str
    youtube_audit: AuditResultBlock
    influencer_audit: AuditResultBlock

class JobStatusResponse(BaseModel):
    job_id: str
    status: str                                    # "processing" | "complete" | "failed"
    result: Optional[AuditResponse] = None
    error: Optional[str] = None

# --- FastAPI App ---

app = FastAPI(title="VisionAudit AI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Background worker ---

def _run_pipeline(job_id: str, video_id: str, initial_state: dict, tmp_path: Optional[str] = None):
    '''Runs the LangGraph pipeline in a background thread and stores the result in _jobs.'''
    try:
        logger.info(f"[Job {job_id}] Pipeline starting...")
        final_state = workflow_app.invoke(initial_state)
        yt_status = final_state.get("youtube_final_status", "FAIL")
        inf_status = final_state.get("influencer_final_status", "FAIL")
        logger.info(f"[Job {job_id}] Pipeline complete — YouTube: {yt_status}, Influencer: {inf_status}")
        _jobs[job_id] = {
            "status": "complete",
            "result": {
                "video_id": final_state.get("video_id", video_id),
                "youtube_audit": {
                    "status": yt_status,
                    "compliance_results": final_state.get("youtube_compliance_results", []),
                    "report": final_state.get("youtube_final_report", "No report generated."),
                },
                "influencer_audit": {
                    "status": inf_status,
                    "compliance_results": final_state.get("influencer_compliance_results", []),
                    "report": final_state.get("influencer_final_report", "No report generated."),
                },
            }
        }
    except Exception as e:
        logger.error(f"[Job {job_id}] Pipeline failed: {e}")
        _jobs[job_id] = {"status": "failed", "error": str(e)}
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
            logger.info(f"[Job {job_id}] Cleaned up {tmp_path}")

# --- Endpoints ---

@app.post("/audit-file", response_model=JobAccepted)
async def run_audit_file(file: UploadFile = File(...)):
    '''
    POST /audit-file
    Accepts a video file, starts the audit pipeline in the background,
    and returns a job_id immediately. Poll GET /status/{job_id} for the result.
    '''
    session_id = str(uuid.uuid4())
    job_id = f"job_{session_id[:8]}"
    video_id = f"vid_{session_id[:8]}"

    logger.info(f"[API] File upload: {file.filename} → job {job_id}")

    suffix = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
    tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    shutil.copyfileobj(file.file, tmp_file)
    tmp_file.close()

    initial_state = {
        "video_url": "",
        "video_id": video_id,
        "local_file_path": tmp_file.name,
        "compliance_results": [],
        "errors": []
    }

    _jobs[job_id] = {"status": "processing"}

    thread = threading.Thread(
        target=_run_pipeline,
        args=(job_id, video_id, initial_state, tmp_file.name),
        daemon=True
    )
    thread.start()

    return JobAccepted(job_id=job_id, status="processing")


@app.get("/status/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str):
    '''
    GET /status/{job_id}
    Returns the current status of an audit job.
    Frontend polls this every 10 seconds after submitting a file.
    '''
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] == "complete":
        return JobStatusResponse(
            job_id=job_id,
            status="complete",
            result=AuditResponse(**job["result"])
        )
    if job["status"] == "failed":
        return JobStatusResponse(job_id=job_id, status="failed", error=job.get("error"))

    return JobStatusResponse(job_id=job_id, status="processing")


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "VisionAudit AI"}
