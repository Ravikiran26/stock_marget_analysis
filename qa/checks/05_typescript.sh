#!/usr/bin/env bash
# Check 05: TypeScript errors and Next.js lint
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ISSUES=()

echo "  → Running TypeScript check..."
if ! npx tsc --noEmit 2>&1 | grep -E "error TS" > /tmp/ts_errors.txt; then
    true
fi
if [ -s /tmp/ts_errors.txt ]; then
    while IFS= read -r line; do
        ISSUES+=("TypeScript: $line")
    done < /tmp/ts_errors.txt
fi

echo "  → Running ESLint..."
if ! npx next lint --max-warnings 0 2>&1 | grep -E "Error:|Warning:" > /tmp/lint_errors.txt; then
    true
fi
if [ -s /tmp/lint_errors.txt ]; then
    while IFS= read -r line; do
        ISSUES+=("ESLint: $line")
    done < /tmp/lint_errors.txt
fi

if [ ${#ISSUES[@]} -eq 0 ]; then
    echo "  ✓ TypeScript and ESLint clean"
    exit 0
else
    for issue in "${ISSUES[@]}"; do
        echo "  ✗ $issue"
    done
    exit 1
fi
