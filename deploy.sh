#!/bin/bash
cd /opt/qa-guardian
git pull origin main
docker compose down
docker compose up -d --build
echo "Deployed at $(date)"
