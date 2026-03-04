/**
 * VisionAudit AI — YouTube Download Service
 *
 * A lightweight Express API used by the Python backend (VideoIndexerService)
 * as a fallback downloader when yt-dlp is blocked by YouTube's IP/bot detection.
 *
 * Endpoints:
 *   GET /api/info?url=     — returns available MP4 formats for a YouTube video
 *   GET /api/download?url=&itag=&title=  — streams the video file
 */

const express = require('express');
const ytdl = require('@distube/ytdl-core');

const app = express();
const PORT = process.env.PORT || 3000;

// GET /api/info?url=<youtube-url>
// Called by VideoIndexerService._download_via_fallback_server() to pick the best itag
app.get('/api/info', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!ytdl.validateURL(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const info = await ytdl.getInfo(url);
    const details = info.videoDetails;

    // Combined video+audio MP4 formats only (no ffmpeg merge needed)
    const formats = info.formats
      .filter(f => f.hasVideo && f.hasAudio && f.container === 'mp4')
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
      .map(f => ({
        itag: f.itag,
        quality: f.qualityLabel,
        container: f.container,
        size: f.contentLength ? parseInt(f.contentLength) : null,
      }));

    // Deduplicate by quality label (keep best bitrate per quality)
    const seen = new Set();
    const uniqueFormats = formats.filter(f => {
      if (seen.has(f.quality)) return false;
      seen.add(f.quality);
      return true;
    });

    res.json({
      title: details.title,
      author: details.author.name,
      duration: parseInt(details.lengthSeconds),
      formats: uniqueFormats,
    });
  } catch (err) {
    console.error('[info] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/download?url=<youtube-url>&itag=<itag>&title=<title>
// Streams the video bytes — Python backend writes them to a temp file
app.get('/api/download', async (req, res) => {
  const { url, itag, title } = req.query;

  if (!url || !itag) {
    return res.status(400).json({ error: 'url and itag are required' });
  }

  if (!ytdl.validateURL(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const info = await ytdl.getInfo(url);
    const format = info.formats.find(f => f.itag === parseInt(itag));

    if (!format) {
      return res.status(404).json({ error: 'Format not found' });
    }

    const safeTitle = (title || 'video').replace(/[^\w\s\-().]/g, '').trim().slice(0, 100);
    res.header('Content-Disposition', `attachment; filename="${safeTitle}.${format.container}"`);
    res.header('Content-Type', `video/${format.container}`);

    if (format.contentLength) {
      res.header('Content-Length', format.contentLength);
    }

    ytdl(url, { format }).pipe(res);
  } catch (err) {
    console.error('[download] Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.listen(PORT, () => {
  console.log(`[VisionAudit] YouTube download service ready at http://localhost:${PORT} (fallback for yt-dlp IP blocks)`);
});
