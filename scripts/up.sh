#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../services/brain"
python -m uvicorn app.main:app --port 8000 &
BRAIN=$!
cd ../../apps/web
bun dev &
WEB=$!
trap "kill $BRAIN $WEB" EXIT
wait
