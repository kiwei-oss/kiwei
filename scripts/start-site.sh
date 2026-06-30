#!/bin/zsh
set -e

export PATH="/Users/kiwei/.nvm/versions/node/v24.16.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

PROJECT_DIR="/Users/kiwei/Downloads/个人网站"
SITE_URL="http://localhost:5173/#home"

cd "$PROJECT_DIR"

if ! lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
  nohup npm run dev:local >/tmp/neon-frame.log 2>/tmp/neon-frame.err &
fi

for _ in {1..30}; do
  if curl -fsS "http://localhost:5173/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

open "$SITE_URL"
