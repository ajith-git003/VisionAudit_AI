'''
Main execution entry point for the compliance QA Pipeline workflow.
'''

import uuid
import json
import logging
from pprint import pprint
from dotenv import load_dotenv
load_dotenv(override=True)

from backend.src.graph.workflow import app

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("VisionAuditAI")

def run_cli_simulation():
    '''
    Simulates the workflow execution in a CLI environment by directly invoking the graph with a test state.
    This is useful for testing and debugging the workflow logic without needing the full API setup.
    '''
    session_id = str(uuid.uuid4())
    logger.info("Starting Audit Session Simulation with Session ID: %s", {'session_id'})

    #define the intial state
    initial_inputs = {
        "video_url": "https://youtu.be/dT7S75eYhcQ",
        "video_id":f"vid_{session_id[:8]}",
        "compliance_results": [],
        "error": []
    }   
    
    print("\n---Initializing Workflow...........")
    print(f"Input Payload: {json.dumps(initial_inputs, indent=2)}")

    try:
        final_state = app.invoke(initial_inputs)
        print("\n---Workflow Execution Complete---")

        print('\n Compliance Audit Results ==')
        print(f"Video ID: {final_state.get('video_id')}")
        print(f"Status: {final_state.get('final_status')}")
        print("\n [VIOLATIONS DETECTED]")
        results = final_state.get('compliance_results',[])
        if results:
            for issue in results:
                print(f"-[{issue.get('severity')}] [{issue.get('category')}] : [{issue.get('description')}]")

        else:
            print("No violation detected.... ")
        print("\n [FINAL SUMMARY] ")
        print(final_state.get('final_report'))

    except Exception as e:
        logger.error(f"Workflow Execution Failed: {str(e)}")
        raise e
        #uv run uvicorn backend.src.api.server:app --reload --port 8000


if __name__ == "__main__":
    run_cli_simulation()
    

