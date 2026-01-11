#!/bin/bash
EVENT_TYPE="${1:-completed}"
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
CHAT_ID="${TELEGRAM_CHAT_ID:-}"

[ -z "$BOT_TOKEN" ] && exit 0

PROJECT=$(basename "$CLAUDE_PROJECT_DIR" 2>/dev/null || echo "ogon-loyalty")
BRANCH=$(git -C "$CLAUDE_PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "-")

case "$EVENT_TYPE" in
    "completed") EMOJI="DONE"; TEXT="Задача завершена" ;;
    "awaiting") EMOJI="WAIT"; TEXT="Ожидает ввода" ;;
    *) EMOJI="INFO"; TEXT="$EVENT_TYPE" ;;
esac

MESSAGE="[${EMOJI}] Project: ${PROJECT} | Branch: ${BRANCH} | ${TEXT}"

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d chat_id="$CHAT_ID" -d text="$MESSAGE" > /dev/null 2>&1 &

exit 0
