#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(
  export PORT=8080
  export NODE_ENV=development
  pnpm --filter @workspace/api-server run dev
) &
API_PID=$!

(
  export PORT=5000
  export BASE_PATH=/
  export API_PROXY_TARGET=http://127.0.0.1:8080
  pnpm --filter @workspace/altera run dev
) &
WEB_PID=$!

wait -n "$API_PID" "$WEB_PID"
EXIT_CODE=$?
cleanup
exit $EXIT_CODE
