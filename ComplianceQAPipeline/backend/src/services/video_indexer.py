'''
Connector: Python and Azure Video Indexer
'''

import os
import base64
import logging
import tempfile
import time
import requests
import yt_dlp
from pytubefix import YouTube

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
        # Decode YouTube cookies from base64 env var → temp file (for yt-dlp auth)
        self._cookies_path = self._init_cookies()

    @staticmethod
    def _init_cookies():
        '''Decodes YOUTUBE_COOKIES_B64 env var into a temp file for yt-dlp.'''
        b64 = os.getenv("YOUTUBE_COOKIES_B64")
        if not b64:
            logger.info("No YOUTUBE_COOKIES_B64 set — yt-dlp will run without cookies.")
            return None
        try:
            raw = base64.b64decode(b64)
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".txt", prefix="yt_cookies_")
            tmp.write(raw)
            tmp.close()
            logger.info(f"YouTube cookies written to {tmp.name}")
            return tmp.name
        except Exception as e:
            logger.warning(f"Failed to decode YOUTUBE_COOKIES_B64: {e}")
            return None

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

    def _download_via_pytubefix(self, url: str, output_path: str) -> str:
        '''
        Fallback downloader using pytubefix (Python-native).
        Uses a completely different YouTube extraction engine than yt-dlp,
        so it can succeed even when yt-dlp is blocked.
        '''
        logger.info(f"[pytubefix] Attempting download: {url}")

        yt = YouTube(url)
        stream = yt.streams.filter(
            progressive=True, file_extension='mp4'
        ).order_by('resolution').desc().first()

        if not stream:
            # Fall back to any available mp4 stream
            stream = yt.streams.filter(file_extension='mp4').first()

        if not stream:
            raise Exception("pytubefix found no downloadable MP4 streams for this video.")

        logger.info(
            f"[pytubefix] Downloading stream — resolution: {stream.resolution}, "
            f"size: {stream.filesize_mb:.1f} MB"
        )

        # Download to the directory containing output_path with the target filename
        out_dir = os.path.dirname(os.path.abspath(output_path)) or "."
        filename = os.path.basename(output_path)
        stream.download(output_path=out_dir, filename=filename)

        logger.info(f"[pytubefix] Download complete → {output_path}")
        return output_path

    #function to download youtube video using yt-dlp
    def download_youtube_video(self, url, output_path="temp_video.mp4"):
        '''
        Downloads the YouTube video to a local file.

        Primary:  yt-dlp (fast, supports all qualities)
        Fallback: pytubefix (Python-native) — uses a different extraction
                  engine, triggered automatically when yt-dlp fails.
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
        # Attach cookies if available — authenticates the request so YouTube
        # won't block the download with "Sign in to confirm you're not a bot"
        if self._cookies_path:
            ydl_opts['cookiefile'] = self._cookies_path
            logger.info("[yt-dlp] Using YouTube cookies for authentication.")
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

            logger.info("[Fallback] Switching to pytubefix ...")
            try:
                return self._download_via_pytubefix(url, output_path)
            except Exception as fallback_error:
                raise Exception(
                    f"Both download methods failed. "
                    f"yt-dlp: {yt_dlp_error} | "
                    f"pytubefix: {str(fallback_error)}"
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
