'''
Connector: Python and Azure Video Indexer
'''

import os
import logging
import time
import requests
import yt_dlp

logger = logging.getLogger("video_indexer")

class VideoIndexerService:
    def __init__(self):
        self.account_id = os.getenv("AZURE_VIDEO_INDEXER_ACCOUNT_ID")
        self.location = os.getenv("AZURE_VIDEO_INDEXER_LOCATION", "trial")
        self.api_key = os.getenv("AZURE_VI_API_KEY")
        self.api_base = "https://api.videoindexer.ai"

    def get_account_access_token(self):
        '''
        Gets a Video Indexer access token using the API key (Trial account).
        '''
        url = f"{self.api_base}/Auth/{self.location}/Accounts/{self.account_id}/AccessToken"
        headers = {
            "Ocp-Apim-Subscription-Key": self.api_key
        }
        params = {
            "allowEdit": "true"
        }
        response = requests.get(url, headers=headers, params=params)
        if response.status_code != 200:
            raise Exception(f"Failed to get VI access token: {response.text}")
        return response.json()

    def fetch_youtube_transcript(self, url: str) -> str:
        '''
        Fetches the YouTube video transcript using youtube-transcript-api.
        This works reliably on cloud servers (no video download required).
        Returns a timestamped transcript string, or empty string if unavailable.
        '''
        from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
        import re as _re

        # Extract video ID from URL
        match = _re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", url)
        if not match:
            logger.warning("Could not extract video ID from URL: %s", url)
            return ""

        video_id = match.group(1)
        logger.info(f"Fetching transcript for YouTube video ID: {video_id}")

        try:
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=["en", "en-US", "en-GB"])
            lines = []
            for entry in transcript_list:
                seconds = int(entry["start"])
                mm = seconds // 60
                ss = seconds % 60
                lines.append(f"[{mm:02d}:{ss:02d}] {entry['text']}")
            return "\n".join(lines)
        except (NoTranscriptFound, TranscriptsDisabled):
            # Try any available language as fallback
            try:
                transcript_data = YouTubeTranscriptApi.list_transcripts(video_id)
                transcript = transcript_data.find_generated_transcript(
                    [t.language_code for t in transcript_data]
                )
                fetched = transcript.fetch()
                lines = []
                for entry in fetched:
                    seconds = int(entry["start"])
                    mm = seconds // 60
                    ss = seconds % 60
                    lines.append(f"[{mm:02d}:{ss:02d}] {entry['text']}")
                return "\n".join(lines)
            except Exception as inner_e:
                logger.warning(f"No transcript available for {video_id}: {inner_e}")
                return ""
        except Exception as e:
            logger.warning(f"youtube-transcript-api failed for {video_id}: {e}")
            return ""

    def upload_video_by_url(self, video_url: str, video_name: str) -> str:
        '''
        Uploads a video to Azure Video Indexer by URL (no download required).
        Azure VI fetches the video directly from the URL.
        Returns the Azure video ID.
        '''
        vi_token = self.get_account_access_token()
        api_url = f"{self.api_base}/{self.location}/Accounts/{self.account_id}/Videos"
        params = {
            "accessToken": vi_token,
            "name": video_name,
            "privacy": "Private",
            "indexingPreset": "Default",
            "videoUrl": video_url,
        }
        headers = {"Ocp-Apim-Subscription-Key": self.api_key}
        logger.info(f"Uploading video by URL to Azure Video Indexer: {video_url}")
        response = requests.post(api_url, params=params, headers=headers)
        if response.status_code != 200:
            raise Exception(f"Failed to upload video by URL: {response.text}")
        return response.json().get("id")

    #function to download youtube video using yt-dlp
    def download_youtube_video(self, url, output_path="temp_video.mp4"):
        '''downloads the youtube video to a local file'''
        logger.info(f"Downloading video from {url}...")

        ydl_opts = {
            'format': 'best',
            'outtmpl': output_path,
            'quiet': False,
            'no_warnings': False,
            'extractor_args': {'youtube': {'player_client': ['android', 'web']}},
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            logger.info("Video downloaded successfully")
            return output_path
        except Exception as e:
            raise Exception(f"Failed to download video: {str(e)}")

    #Upload the video to Azure Video Indexer
    def upload_video(self, video_path, video_name):
        '''Uploads the video to Azure Video Indexer and returns the video ID'''
        vi_token = self.get_account_access_token()

        api_url = f"{self.api_base}/{self.location}/Accounts/{self.account_id}/Videos"

        params = {
            "accessToken": vi_token,
            "name": video_name,
            "privacy": "Private",
            "indexingPreset": "Default",
        }
        headers = {
            "Ocp-Apim-Subscription-Key": self.api_key
        }

        logger.info(f"Uploading file {video_path} to Azure Video Indexer...")

        #open the file in binary and stream in on azure
        with open(video_path, "rb") as video_file:
            files = {"file": video_file}
            response = requests.post(api_url, params=params, headers=headers, files=files)

        if response.status_code != 200:
            raise Exception(f"Failed to upload video: {response.text}")
        return response.json().get("id")

    def wait_for_processing(self, video_id):
        logger.info(f"Waiting for video {video_id} to process...")
        while True:
            vi_token = self.get_account_access_token()

            url = f"{self.api_base}/{self.location}/Accounts/{self.account_id}/Videos/{video_id}/Index"
            params = {"accessToken": vi_token}
            headers = {
                "Ocp-Apim-Subscription-Key": self.api_key
            }
            response = requests.get(url, params=params, headers=headers)
            data = response.json()

            state = data.get("state")
            if state == "Processed":
                return data
            elif state == "Failed":
                raise Exception("Video processing failed in Azure.")
            elif state == "Quarantined":
                raise Exception("Video has been quarantined (copyright/ content policy violation)")
            logger.info(f"Current state: {state}. Checking again in 30 seconds...")
            time.sleep(30)

    def extract_data(self, vi_json):
        '''parses the JSON into our state format, including timestamps for better AI accuracy'''
        transcript_lines = []
        for v in vi_json.get("videos", []):
            for insights in v.get("insights", {}).get("transcript", []):
                # Format: [MM:SS] Text
                start_time = insights.get("instances", [{}])[0].get("start", "00:00:00")
                # Clean start_time to MM:SS
                time_parts = start_time.split(":")
                mm_ss = f"{time_parts[1]}:{time_parts[2].split('.')[0]}" if len(time_parts) > 2 else "00:00"
                transcript_lines.append(f"[{mm_ss}] {insights.get('text')}")

        ocr_lines = []
        for v in vi_json.get("videos", []):
            for insights in v.get("insights", {}).get("ocr", []):
                # Format: [MM:SS] Text
                start_time = insights.get("instances", [{}])[0].get("start", "00:00:00")
                time_parts = start_time.split(":")
                mm_ss = f"{time_parts[1]}:{time_parts[2].split('.')[0]}" if len(time_parts) > 2 else "00:00"
                ocr_lines.append(f"[{mm_ss}] {insights.get('text')}")

        return {
            "transcript": "\n".join(transcript_lines),
            "ocr_text": ocr_lines,
            "video_metadata": {
                "duration": vi_json.get("summarizedInsights", {}).get("durationInSeconds"),
                "platform": "youtube"
            }
        }
