#!/usr/bin/env bash
# Starts the ML service (port 8000) and the website (port 3000). Press Ctrl+C to stop both.
cd "$(dirname "$0")"
VPY="ml-service/venv/bin/python"
[ -d node_modules ] && [ -x "$VPY" ] || { echo "Packages are not installed yet. Run ./setup.sh first."; exit 1; }
[ -f .env.local ] && [ -f ml-service/.env ] || { echo "Settings files are missing. Run ./setup.sh first."; exit 1; }

(cd ml-service && exec venv/bin/python -m uvicorn main:app --port 8000) &
ML_PID=$!
trap 'kill $ML_PID 2>/dev/null' EXIT INT TERM

echo "ML service: http://localhost:8000/health"
echo "Website:    http://localhost:3000   (Ctrl+C to stop both)"
npm run dev
