#!/usr/bin/env bash
# Build the site from src/ and publish it to https://flirtlessons.com
#
# The server address lives in .deploy.env (git-ignored), e.g.:
#   DEPLOY_HOST=user@your-server
# Files go to /var/www/flirtlessons, which the flirtlessons-web container serves
# read-only. No restart is needed; changes are live immediately.
set -euo pipefail
cd "$(dirname "$0")"

[ -f .deploy.env ] && . ./.deploy.env
HOST="${DEPLOY_HOST:?Set DEPLOY_HOST in .deploy.env (e.g. user@your-server)}"
DEST=/var/www/flirtlessons

python3 -I build.py
rsync -rlz --delete --exclude '.DS_Store' --exclude '.generated' site/ "$HOST:$DEST/"
ssh "$HOST" "find $DEST -type d -exec chmod 755 {} + && find $DEST -type f -exec chmod 644 {} +"

code=$(curl -s -o /dev/null -w '%{http_code}' https://flirtlessons.com/)
echo "Deployed. https://flirtlessons.com/ -> HTTP $code"
