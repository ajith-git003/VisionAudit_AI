'''
Connector: Python and Azure Video Indexer
'''

import os
import logging
import time
import requests
import yt_dlp

logger = logging.getLogger("video_indexer")

# Error patterns that indicate YouTube is blocking the server's IP.
# When any of these appear in a yt-dlp error, we switch to the
# Node.js fallback downloader automatically.
_IP_BLOCK_SIGNALS = (
    "sign in to confirm",
    "confirm you're not a bot",
    "http error 429",
    "too many requests",
    "rate limit",
    "http error 403",
    "blocked",
    "bot detection",
    "nsig extraction failed",
    "unable to extract",
    "video unavailable",
)

class VideoIndexerService:
    def __init__(self):
        self.account_id = os.getenv("AZURE_VIDEO_INDEXER_ACCOUNT_ID")
        self.location = os.getenv("AZURE_VIDEO_INDEXER_LOCATION", "trial")
        self.api_key = os.getenv("AZURE_VI_API_KEY")
        self.api_base = "https://api.videoindexer.ai"
        # Base URL of the Node.js YouTube downloader fallback server.
        # Override with YT_DOWNLOADER_URL env var if running on a different port.
        self.fallback_url = os.getenv("YT_DOWNLOADER_URL", "http://localhost:3000")

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

    def _is_ip_block_error(self, error_msg: str) -> bool:
        '''Returns True if the error looks like an IP block or bot-detection rejection.'''
        msg = error_msg.lower()
        return any(signal in msg for signal in _IP_BLOCK_SIGNALS)

    def _download_via_fallback_server(self, url: str, output_path: str) -> str:
        '''
        Fallback downloader: calls the local Node.js YouTube downloader server
        (default http://localhost:3000) which uses @distube/ytdl-core — a different
        download engine that bypasses the IP block that stopped yt-dlp.

        Flow:
          1. GET /api/info?url=...   → fetch available formats + best itag
          2. GET /api/download?...   → stream the video bytes to output_path
        '''
        logger.info(f"[Fallback] Connecting to Node.js downloader at {self.fallback_url} ...")

        # Step 1 — fetch video info and pick the best available format
        try:
            info_resp = requests.get(
                f"{self.fallback_url}/api/info",
                params={"url": url},
                timeout=30
            )
        except requests.exceptions.ConnectionError:
            raise Exception(
                f"Fallback downloader is not reachable at {self.fallback_url}. "
                "Make sure the Node.js YouTube downloader service is running: "
                "cd 'VisionAudit AI/youtube-downloader' && npm install && npm start"
            )

        if info_resp.status_code != 200:
            raise Exception(
                f"Fallback /api/info returned {info_resp.status_code}: {info_resp.text}"
            )

        info = info_resp.json()
        formats = info.get("formats", [])

        if not formats:
            raise Exception("Fallback server returned no downloadable formats for this video.")

        # Formats are already sorted best-first by the Node.js server
        best = formats[0]
        itag = best["itag"]
        title = info.get("title", "video")
        logger.info(
            f"[Fallback] Chosen format — itag: {itag}, "
            f"quality: {best.get('quality')}, size: {best.get('size')}"
        )

        # Step 2 — stream the video to disk
        logger.info(f"[Fallback] Streaming download to {output_path} ...")
        try:
            download_resp = requests.get(
                f"{self.fallback_url}/api/download",
                params={"url": url, "itag": itag, "title": title},
                stream=True,
                timeout=600  # 10-minute timeout for large videos
            )
        except requests.exceptions.ConnectionError:
            raise Exception(
                f"Lost connection to fallback downloader at {self.fallback_url} during download."
            )

        if download_resp.status_code != 200:
            raise Exception(
                f"Fallback /api/download returned {download_resp.status_code}: "
                f"{download_resp.text[:200]}"
            )

        with open(output_path, "wb") as f:
            for chunk in download_resp.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        logger.info(f"[Fallback] Download complete → {output_path}")
        return output_path

    #function to download youtube video using yt-dlp
    def download_youtube_video(self, url, output_path="temp_video.mp4"):
        '''
        Downloads the YouTube video to a local file.

        Primary:  yt-dlp (fast, supports all qualities)
        Fallback: Node.js downloader server (@distube/ytdl-core) — used
                  automatically when yt-dlp fails (IP blocks, extraction errors,
                  rate limits, etc.).
        '''
        logger.info(f"[yt-dlp] Downloading video from {url} ...")

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
            logger.info("[yt-dlp] Download successful.")
            return output_path
        except Exception as e:
            yt_dlp_error = str(e)
            if self._is_ip_block_error(yt_dlp_error):
                logger.warning(f"[yt-dlp] IP/bot block detected: {yt_dlp_error}")
            else:
                logger.warning(f"[yt-dlp] Download failed: {yt_dlp_error}")

            logger.info("[Fallback] Switching to Node.js downloader ...")
            try:
                return self._download_via_fallback_server(url, output_path)
            except Exception as fallback_error:
                raise Exception(
                    f"Both download methods failed. "
                    f"yt-dlp: {yt_dlp_error} | "
                    f"Node.js fallback: {str(fallback_error)}"
                )

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

    def upload_video_from_url(self, video_url, video_name):
        '''
        Submits a public video URL directly to Azure Video Indexer for ingestion.
        Azure VI fetches the video from the URL on its own servers — no local download needed.
        This bypasses IP blocks on hosted environments (Render, etc.).
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
        headers = {
            "Ocp-Apim-Subscription-Key": self.api_key
        }

        logger.info(f"Submitting URL to Azure Video Indexer: {video_url}")
        response = requests.post(api_url, params=params, headers=headers)

        if response.status_code != 200:
            raise Exception(f"Failed to submit video URL to Azure VI: {response.text}")
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
