#!/usr/bin/env bash
# Traders Diary — Go-Live QA Suite
# Run from project root: bash qa/run_all.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECKS_DIR="$ROOT/qa/checks"
PYTHON="${PYTHON:-python3}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNED=0
declare -a FAILURES=()
declare -a WARNINGS=()

run_check() {
    local num="$1"
    local label="$2"
    local cmd="$3"
    local fatal="${4:-true}"

    printf "${BLUE}[${num}]${NC} ${BOLD}${label}${NC}\n"
    output=$(eval "$cmd" 2>&1)
    exit_code=$?

    if [ $exit_code -eq 0 ]; then
        echo "$output"
        ((PASSED++))
    else
        echo "$output"
        if [ "$fatal" = "true" ]; then
            ((FAILED++))
            FAILURES+=("[$num] $label")
        else
            ((WARNED++))
            WARNINGS+=("[$num] $label")
        fi
    fi
    echo ""
}

echo ""
echo "${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo "${BOLD}║       Traders Diary — Go-Live QA Report              ║${NC}"
echo "${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$ROOT"

run_check "01" "Environment Variables"   "$PYTHON $CHECKS_DIR/01_env_vars.py"       true
run_check "02" "API Contract (FE → BE)"  "$PYTHON $CHECKS_DIR/02_api_contract.py"   true
run_check "03" "Backend Health & CORS"   "$PYTHON $CHECKS_DIR/03_backend_smoke.py"  false
run_check "04" "Security Scan"           "$PYTHON $CHECKS_DIR/04_security.py"       true
run_check "05" "TypeScript & ESLint"     "bash $CHECKS_DIR/05_typescript.sh"        true
run_check "06" "Payment Flow (Razorpay)" "$PYTHON $CHECKS_DIR/06_payment_flow.py"   true
run_check "07" "SEO & Open Graph"        "$PYTHON $CHECKS_DIR/07_seo_og.py"         false
run_check "08" "Broken Imports"          "$PYTHON $CHECKS_DIR/08_broken_imports.py" true
run_check "09" "Backend Dependencies"    "bash $CHECKS_DIR/09_backend_deps.sh"      false

# ── Final Report ──────────────────────────────────────────────────────────────
echo "${BOLD}══════════════════════════════════════════════════════${NC}"
echo "${BOLD}RESULTS${NC}"
echo "  ${GREEN}✓ Passed:${NC}  $PASSED"
echo "  ${YELLOW}⚠ Warnings:${NC} $WARNED"
echo "  ${RED}✗ Failed:${NC}  $FAILED"
echo ""

if [ ${#FAILURES[@]} -gt 0 ]; then
    echo "${RED}${BOLD}BLOCKING ISSUES (must fix before go-live):${NC}"
    for f in "${FAILURES[@]}"; do
        echo "  ${RED}✗${NC} $f"
    done
    echo ""
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo "${YELLOW}${BOLD}WARNINGS (fix soon, not blocking):${NC}"
    for w in "${WARNINGS[@]}"; do
        echo "  ${YELLOW}⚠${NC} $w"
    done
    echo ""
fi

if [ $FAILED -eq 0 ]; then
    echo "${GREEN}${BOLD}✓ GO-LIVE READY — no blocking issues found${NC}"
    exit 0
else
    echo "${RED}${BOLD}✗ NOT READY — fix $FAILED blocking issue(s) above${NC}"
    exit 1
fi
