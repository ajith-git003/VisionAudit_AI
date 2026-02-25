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

    #analysis output
    # stores the list of all the violations found by AI
    compliance_results : Annotated[List[ComplianceIssue], operator.add]

    #final deliverables:
    final_status: str #PASS | FAIL
    final_report: str #markdown format

    #sysytem observability 
    #errors: API timeout, system level errors 
    #list of system level crashes
    errors : Annotated[List[str], operator.add]