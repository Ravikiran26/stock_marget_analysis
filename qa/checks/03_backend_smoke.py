"""Check 03: Backend is reachable, healthy, and CORS is configured correctly."""
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("  ✗ requests not installed — run: pip install requests")
    sys.exit(1)

ROOT = Path(__file__).parents[2]
QA_CONFIG = ROOT / "qa" / "config.env"

def load_env(path: Path) -> dict:
    env = {}
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env

def get_backend_url() -> str:
    cfg = load_env(QA_CONFIG)
    url = cfg.get("PRODUCTION_BACKEND_URL", "").strip()
    if url:
        return url.rstrip("/")

    # Fallback: check local env files
    for fname in [".env.local", ".env.production", ".env"]:
        fe = load_env(ROOT / fname)
        api = fe.get("NEXT_PUBLIC_API_URL", "").strip()
        if api and "localhost" not in api:
            return api.rstrip("/")

    return "http://localhost:8000"

def get_frontend_url() -> str:
    cfg = load_env(QA_CONFIG)
    return cfg.get("PRODUCTION_FRONTEND_URL", "https://tradersdiary.in").rstrip("/")

def run():
    issues = []
    base = get_backend_url()
    frontend = get_frontend_url()

    if "localhost" in base:
        issues.append(
            f"Backend URL is localhost ({base}) — set PRODUCTION_BACKEND_URL in qa/config.env "
            f"to test against your Railway deployment"
        )
        return issues

    # Health check
    try:
        resp = requests.get(f"{base}/", timeout=10)
        if resp.status_code >= 500:
            issues.append(f"Backend health check returned HTTP {resp.status_code} at {base}/")
        elif resp.status_code == 404:
            issues.append(f"Backend / not found (404) — is the service running at {base}?")
        else:
            data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            status = data.get("status", "?")
            print(f"  ✓ Backend healthy at {base} (status: {status})")
    except requests.exceptions.ConnectionError:
        issues.append(f"Cannot reach backend at {base} — check Railway deployment is live")
        return issues
    except requests.exceptions.Timeout:
        issues.append(f"Backend timed out at {base} — Railway may be cold starting")
        return issues

    # CORS check — backend must allow the frontend origin
    try:
        resp = requests.options(
            f"{base}/",
            headers={
                "Origin": frontend,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization, Content-Type",
            },
            timeout=10,
        )
        acao = resp.headers.get("access-control-allow-origin", "")
        acah = resp.headers.get("access-control-allow-headers", "")

        if not acao:
            issues.append(
                f"CORS: backend returns no Access-Control-Allow-Origin — "
                f"frontend at {frontend} will be blocked"
            )
        elif acao not in ("*", frontend):
            issues.append(
                f"CORS: Access-Control-Allow-Origin is {acao!r}, expected {frontend!r}"
            )

        if acah and "authorization" not in acah.lower():
            issues.append(
                "CORS: Authorization header not in Access-Control-Allow-Headers — "
                "authenticated requests will fail"
            )
    except Exception as e:
        issues.append(f"CORS check failed: {e}")

    return issues

if __name__ == "__main__":
    issues = run()
    if issues:
        print("\n".join(f"  ✗ {i}" for i in issues))
        sys.exit(1)
    print("  ✓ Backend reachable and CORS correctly configured")
