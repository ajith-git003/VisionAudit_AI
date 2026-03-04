#!/bin/bash
# VisionAudit AI — Render startup script
# Starts the Node.js YouTube downloader fallback (port 3001) and the FastAPI server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[start.sh] Starting Node.js YouTube downloader on port 3001..."
cd "$SCRIPT_DIR/../youtube-downloader"
PORT=3001 node index.js &

echo "[start.sh] Starting FastAPI backend on port ${PORT:-8000}..."
cd "$SCRIPT_DIR"
exec uvicorn backend.src.api.server:app --host 0.0.0.0 --port "${PORT:-8000}"
