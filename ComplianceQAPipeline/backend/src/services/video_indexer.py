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
        Works reliably on cloud servers (no video download required).
        Returns a timestamped transcript string, or empty string if unavailable.

        Handles both dict-style (v0.5.x) and object-style (v0.6.x) snippet responses.
        '''
        from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
        import re as _re

        def _snippet_to_line(entry) -> str:
            # v0.6.x returns FetchedTranscriptSnippet objects; v0.5.x returns dicts
            if isinstance(entry, dict):
                seconds = int(entry.get("start", 0))
                text = entry.get("text", "")
            else:
                seconds = int(getattr(entry, "start", 0))
                text = getattr(entry, "text", "")
            mm, ss = seconds // 60, seconds % 60
            return f"[{mm:02d}:{ss:02d}] {text}"

        # Extract video ID from URL
        match = _re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", url)
        if not match:
            logger.error("Could not extract video ID from URL: %s", url)
            return ""

        video_id = match.group(1)
        logger.info(f"Fetching transcript for YouTube video ID: {video_id}")

        try:
            entries = YouTubeTranscriptApi.get_transcript(video_id, languages=["en", "en-US", "en-GB"])
            result = "\n".join(_snippet_to_line(e) for e in entries)
            logger.info(f"youtube-transcript-api success: {len(result)} chars")
            return result
        except (NoTranscriptFound, TranscriptsDisabled) as e:
            logger.warning(f"No English transcript for {video_id}: {e}. Trying any language...")
            try:
                transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
                available = [t.language_code for t in transcript_list]
                logger.info(f"Available transcript languages: {available}")
                transcript = transcript_list.find_transcript(available)
                entries = transcript.fetch()
                result = "\n".join(_snippet_to_line(e) for e in entries)
                logger.info(f"Fallback transcript success ({transcript.language}): {len(result)} chars")
                return result
            except Exception as inner_e:
                logger.error(f"All transcript attempts failed for {video_id}: {inner_e}")
                return ""
        except Exception as e:
            logger.error(f"youtube-transcript-api error for {video_id}: {type(e).__name__}: {e}")
            return ""

    def _get_ytdlp_cookie_opts(self, tmpdir: str) -> dict:
        '''
        If YOUTUBE_COOKIES env var is set (Netscape cookie file contents),
        writes it to a temp file and returns the yt-dlp cookiefile option.
        This bypasses YouTube's bot detection on cloud server IPs.
        '''
        cookies_content = os.getenv("YOUTUBE_COOKIES", "")
        if not cookies_content:
            return {}
        cookie_path = os.path.join(tmpdir, "yt_cookies.txt")
        with open(cookie_path, "w", encoding="utf-8") as f:
            f.write(cookies_content)
        logger.info("Using YOUTUBE_COOKIES for yt-dlp authentication")
        return {"cookiefile": cookie_path}

    def fetch_subtitles_via_ytdlp(self, url: str) -> str:
        '''
        Downloads subtitle/caption files only via yt-dlp (skip_download=True).
        No video data is transferred. Falls back to auto-generated captions.
        Returns a timestamped transcript string, or empty string if unavailable.
        '''
        import tempfile
        import glob as _glob
        import re as _re

        def _parse_vtt(vtt_path: str) -> str:
            lines = []
            with open(vtt_path, 'r', encoding='utf-8') as f:
                content = f.read()
            for block in _re.split(r'\n\n+', content):
                block = block.strip()
                if not block or block.startswith('WEBVTT') or block.startswith('Kind:') or block.startswith('Language:'):
                    continue
                block_lines = block.split('\n')
                ts_line = next((l for l in block_lines if '-->' in l), None)
                if not ts_line:
                    continue
                start = ts_line.split('-->')[0].strip()
                parts = start.replace('.', ':').split(':')
                mm_ss = f"{parts[1]}:{parts[2]}" if len(parts) >= 3 else "00:00"
                text_parts = [
                    _re.sub(r'<[^>]+>', '', l).strip()
                    for l in block_lines if '-->' not in l and not l.strip().isdigit() and l.strip()
                ]
                text = ' '.join(text_parts).strip()
                if text:
                    lines.append(f"[{mm_ss}] {text}")
            return "\n".join(lines)

        with tempfile.TemporaryDirectory() as tmpdir:
            ydl_opts = {
                'skip_download': True,
                'writesubtitles': True,
                'writeautomaticsub': True,
                'subtitleslangs': ['en', 'en-US', 'en-GB'],
                'subtitlesformat': 'vtt',
                'outtmpl': os.path.join(tmpdir, '%(id)s.%(ext)s'),
                'quiet': True,
                'extractor_args': {'youtube': {'player_client': ['ios', 'mweb']}},
                **self._get_ytdlp_cookie_opts(tmpdir),
            }
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([url])
                vtt_files = _glob.glob(os.path.join(tmpdir, '*.vtt'))
                if not vtt_files:
                    logger.warning("yt-dlp subtitle download: no VTT files found")
                    return ""
                result = _parse_vtt(vtt_files[0])
                logger.info(f"yt-dlp subtitle download success: {len(result)} chars")
                return result
            except Exception as e:
                logger.error(f"yt-dlp subtitle download failed: {type(e).__name__}: {e}")
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
        import tempfile as _tempfile

        logger.info(f"Downloading video from {url}...")

        # Keep tmpdir alive for the duration of the download so cookie file persists
        with _tempfile.TemporaryDirectory() as _tmpdir:
            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': output_path,
                'quiet': False,
                'no_warnings': False,
                'extractor_args': {'youtube': {'player_client': ['ios', 'web']}},
                **self._get_ytdlp_cookie_opts(_tmpdir),
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
