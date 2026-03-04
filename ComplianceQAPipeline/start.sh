#!/bin/bash
# VisionAudit AI — Render startup script
# Starts the Node.js YouTube downloader fallback (port 3001) and the FastAPI server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Capture Render's assigned port before starting the Node fallback server
FASTAPI_PORT="${PORT:-8000}"

echo "[start.sh] Starting Node.js YouTube downloader on port 3001..."
cd "$SCRIPT_DIR/../youtube-downloader"
PORT=3001 node index.js &
echo "[start.sh] Starting FastAPI backend on port ${FASTAPI_PORT}..."
cd "$SCRIPT_DIR"
exec uvicorn backend.src.api.server:app --host 0.0.0.0 --port "${FASTAPI_PORT}"
