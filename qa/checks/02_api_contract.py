"""Check 02: Every API endpoint the frontend calls exists in the backend."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parents[2]
FRONTEND_API = ROOT / "lib" / "api.ts"
BACKEND_ROUTES_DIR = ROOT / "backend" / "routes"

# Extract all endpoint paths the frontend calls via api.get/post/put/delete
def frontend_calls(api_ts: Path) -> list[tuple[str, str]]:
    calls = []
    text = api_ts.read_text()
    pattern = re.compile(r'api\.(get|post|put|delete|patch)<[^>]*>\(`?([^`"\']+)`?["\']', re.IGNORECASE)
    for m in re.finditer(r'api\.(get|post|put|delete|patch)[(<]', text):
        start = m.start()
        chunk = text[start:start+200]
        url_m = re.search(r'[(`"\']([/][^`"\'<\s]+)', chunk)
        if url_m:
            calls.append((m.group(1).upper(), url_m.group(1)))
    return calls

# Extract all routes defined in backend route files (including router prefix)
def backend_routes(routes_dir: Path) -> list[tuple[str, str]]:
    routes = []
    for f in routes_dir.glob("*.py"):
        text = f.read_text()
        prefix_m = re.search(r'APIRouter\(prefix="([^"]+)"', text)
        prefix = prefix_m.group(1) if prefix_m else ""
        for m in re.finditer(r'@router\.(get|post|put|delete|patch)\("([^"]+)"', text):
            method = m.group(1).upper()
            path = prefix + m.group(2)
            routes.append((method, path))
    return routes

def normalize(path: str) -> str:
    # Replace {param} with {param} for matching, strip trailing slash
    return re.sub(r"\{[^}]+\}", "{param}", path).rstrip("/")

def run():
    issues = []
    fe_calls = frontend_calls(FRONTEND_API)
    be_routes = backend_routes(BACKEND_ROUTES_DIR)

    be_normalized = {(m, normalize(p)) for m, p in be_routes}

    for method, path in fe_calls:
        # Strip template literal expressions like ${tradeId}
        clean = re.sub(r"\$\{[^}]+\}", "{param}", path).rstrip("/")
        # Strip query strings
        clean = clean.split("?")[0]
        if (method, clean) not in be_normalized:
            # Try without /trades prefix (router might add it)
            stripped = re.sub(r"^/trades", "", clean)
            found = any(normalize(p) == normalize(stripped) or normalize(p) == normalize(clean) for _, p in be_routes)
            if not found:
                issues.append(f"Frontend calls {method} {path} — no matching backend route found")

    return issues

if __name__ == "__main__":
    issues = run()
    if issues:
        print("\n".join(f"  ✗ {i}" for i in issues))
        sys.exit(1)
    print("  ✓ All frontend API calls have matching backend routes")
