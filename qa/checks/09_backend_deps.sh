#!/usr/bin/env bash
# Check 09: Backend Python dependencies match requirements.txt
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$ROOT/backend"
VENV="$BACKEND/venv"

ISSUES=()

# Check venv exists
if [ ! -d "$VENV" ]; then
    ISSUES+=("No venv found at backend/venv — run: cd backend && python -m venv venv && pip install -r requirements.txt")
fi

# Check requirements are installed
if [ -d "$VENV" ]; then
    PYTHON="$VENV/bin/python"
    MISSING=$("$PYTHON" -c "
import pkg_resources, sys
reqs = open('$BACKEND/requirements.txt').readlines()
missing = []
for r in reqs:
    r = r.strip()
    if not r or r.startswith('#'):
        continue
    try:
        pkg_resources.require(r)
    except Exception as e:
        missing.append(str(e))
print('\n'.join(missing))
" 2>&1 || true)
    if [ -n "$MISSING" ]; then
        while IFS= read -r line; do
            ISSUES+=("Missing/wrong dep: $line")
        done <<< "$MISSING"
    fi
fi

# Check .env exists for backend
if [ ! -f "$BACKEND/.env" ]; then
    ISSUES+=("backend/.env not found — copy .env.example and fill in values")
fi

if [ ${#ISSUES[@]} -eq 0 ]; then
    echo "  ✓ Backend dependencies and environment look good"
    exit 0
else
    for issue in "${ISSUES[@]}"; do
        echo "  ✗ $issue"
    done
    exit 1
fi
