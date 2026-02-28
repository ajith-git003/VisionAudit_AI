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

    def download_via_cobalt(self, youtube_url: str, output_path: str = "temp_video.mp4") -> str:
        '''
        Downloads a YouTube video via cobalt.tools API.
        cobalt.tools fetches the video on its own servers (not blocked by YouTube),
        returns a direct download URL, and we stream-download it to a local file.
        No API key required.
        '''
        logger.info(f"Trying cobalt.tools download for: {youtube_url}")
        cobalt_api = "https://api.cobalt.tools/"
        payload = {
            "url": youtube_url,
            "videoQuality": "360",
            "filenameStyle": "basic",
            "downloadMode": "auto"
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        resp = requests.post(cobalt_api, json=payload, headers=headers, timeout=30)
        if resp.status_code != 200:
            raise Exception(f"cobalt.tools API error {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
        status = data.get("status")
        download_url = data.get("url")
        if status not in ("stream", "redirect", "tunnel") or not download_url:
            raise Exception(f"cobalt.tools unexpected response: {data}")
        # Stream-download the video file from cobalt's CDN URL
        video_resp = requests.get(download_url, stream=True, timeout=300)
        video_resp.raise_for_status()
        with open(output_path, "wb") as f:
            for chunk in video_resp.iter_content(chunk_size=8192):
                f.write(chunk)
        logger.info(f"cobalt.tools download complete: {output_path}")
        return output_path

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
