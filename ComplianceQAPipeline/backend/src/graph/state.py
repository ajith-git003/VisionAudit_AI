import operator
from typing import Annotated, List, Dict, Optional, Any, TypedDict

#define the schema for a single compliance result
# Error Report
class ComplianceIssue(TypedDict):
    category: str
    description: str #specifies the issue in detail
    severity: str  #CRITICAL  | WARNING
    timestamp: Optional[str]  

class VideoAuditState(TypedDict):
    '''Defines the data schema for langgraph execution content'''
    video_url: str
    video_id: str

    #ingestion and extraction data
    local_file_path: Optional[str]
    video_metadata: Dict[str, Any]  # {"duration": 15, "resolution": "1080p"}
    transcript: Optional[str]  # Fully extracted speech-to-text
    ocr_text: List[str]  

    # YouTube Ad Guidelines audit output
    youtube_compliance_results: List[ComplianceIssue]
    youtube_final_status: str   # PASS | FAIL
    youtube_final_report: str

    # Influencer Guidelines audit output
    influencer_compliance_results: List[ComplianceIssue]
    influencer_final_status: str  # PASS | FAIL
    influencer_final_report: str

    #sysytem observability
    #errors: API timeout, system level errors
    #list of system level crashes
    errors : Annotated[List[str], operator.add]