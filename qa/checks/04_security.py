"""Check 04: Security issues — hardcoded secrets, exposed keys, unsafe patterns."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parents[2]

SECRET_PATTERNS = [
    (r'sk_live_[A-Za-z0-9]+', "Razorpay live secret key"),
    (r'rzp_live_[A-Za-z0-9]+', "Razorpay live key ID"),
    (r'sk-ant-[A-Za-z0-9\-]+', "Anthropic API key"),
    (r'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+', "Hardcoded JWT"),
    (r'SUPABASE_SERVICE_KEY\s*=\s*["\']ey[A-Za-z0-9]+', "Supabase service key in code"),
    (r'sbp_[A-Za-z0-9]+', "Supabase project API key"),
]

SCAN_EXTENSIONS = {".ts", ".tsx", ".py", ".js", ".jsx", ".json"}
SKIP_DIRS = {"node_modules", ".next", "venv", "__pycache__", ".git", "qa"}

def scan_file(path: Path) -> list[str]:
    issues = []
    try:
        text = path.read_text(errors="ignore")
    except Exception:
        return issues
    for pattern, label in SECRET_PATTERNS:
        if re.search(pattern, text):
            issues.append(f"Possible {label} found in {path.relative_to(ROOT)}")
    return issues

def check_frontend_auth_guards() -> list[str]:
    issues = []
    # Check that /dashboard, /trades, /positions, /upload require auth
    protected_pages = ["dashboard", "trades", "positions", "upload"]
    for page in protected_pages:
        page_file = ROOT / "app" / page / "page.tsx"
        if page_file.exists():
            text = page_file.read_text()
            has_auth = any(kw in text for kw in [
                "supabase", "getSession", "getUser", "AuthModal", "redirect", "useUser", "useSession"
            ])
            if not has_auth:
                issues.append(f"Page /{page}/page.tsx has no visible auth guard — unauthenticated users may access it")
    return issues

def check_backend_auth_dependency() -> list[str]:
    issues = []
    routes_dir = ROOT / "backend" / "routes"
    for f in routes_dir.glob("*.py"):
        text = f.read_text()
        # Find endpoints that don't use get_current_user but probably should
        endpoints = re.findall(r'@router\.(get|post)\("([^"]+)".*?\ndef \w+\(([^)]*)\)', text, re.DOTALL)
        for method, path, args in endpoints:
            is_public = path in ["/", "/webhook", "/waitlist"] or "webhook" in path
            uses_auth = "get_current_user" in args or "Depends(get_current_user)" in text[text.find(path):text.find(path)+500]
            if not is_public and not uses_auth:
                issues.append(f"Backend route {method.upper()} {path} in {f.name} may be missing auth dependency")
    return issues

def run():
    issues = []

    # Scan for hardcoded secrets
    for path in ROOT.rglob("*"):
        if path.is_file() and path.suffix in SCAN_EXTENSIONS:
            if not any(skip in path.parts for skip in SKIP_DIRS):
                issues.extend(scan_file(path))

    # Auth guards
    issues.extend(check_frontend_auth_guards())
    issues.extend(check_backend_auth_dependency())

    # Check .env is in .gitignore
    gitignore = ROOT / ".gitignore"
    if gitignore.exists():
        gi_text = gitignore.read_text()
        env_covered = ".env*" in gi_text or "*.env" in gi_text
        if not env_covered:
            for env_file in [".env", ".env.local", "backend/.env"]:
                if env_file not in gi_text:
                    issues.append(f"{env_file} not in .gitignore — risk of committing secrets")
    else:
        issues.append("No .gitignore found — env files may be committed")

    return issues

if __name__ == "__main__":
    issues = run()
    if issues:
        print("\n".join(f"  ✗ {i}" for i in issues))
        sys.exit(1)
    print("  ✓ No obvious security issues found")
