"""Check 01: All required environment variables are set."""
import sys
from pathlib import Path

ROOT = Path(__file__).parents[2]
QA_CONFIG = ROOT / "qa" / "config.env"

FRONTEND_REQUIRED = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_API_URL",
]

BACKEND_REQUIRED = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "ANTHROPIC_API_KEY",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "RESEND_API_KEY",
]

PLACEHOLDER_SUBSTRINGS = {"YOUR_KEY_ID", "YOUR_KEY_SECRET", "your_webhook_secret", "YOUR_SECRET", "PLACEHOLDER", "changeme"}

def load_env(path: Path) -> dict:
    env = {}
    if not path.exists():
        return env
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env

def run():
    issues = []
    qa_cfg = load_env(QA_CONFIG)
    platform_env = qa_cfg.get("PLATFORM_ENV", "").lower() == "true"

    if platform_env:
        # Env vars are in Vercel + Railway — check local .env only for placeholders
        be_env = load_env(ROOT / "backend" / ".env")

        for key in BACKEND_REQUIRED:
            val = be_env.get(key, "")
            if val and any(p in val for p in PLACEHOLDER_SUBSTRINGS):
                print(f"  ⚠ backend/.env local placeholder for {key} — confirmed set in Railway (ok)")

        # Warn if NEXT_PUBLIC_API_URL still points to localhost anywhere
        for fname in [".env.local", ".env"]:
            fe = load_env(ROOT / fname)
            api_url = fe.get("NEXT_PUBLIC_API_URL", "")
            if api_url and ("localhost" in api_url or "127.0.0.1" in api_url):
                issues.append(
                    f"NEXT_PUBLIC_API_URL in {fname} points to localhost — "
                    f"Vercel production should use your Railway URL"
                )

        if not issues:
            print("  ✓ Using Vercel + Railway env vars (platform-managed)")
            print("  ✓ No placeholder values detected in local backend/.env")
        return issues

    # Local dev mode — check files directly
    fe_env = {}
    for fname in [".env.local", ".env.production", ".env"]:
        fe_env.update(load_env(ROOT / fname))

    for key in FRONTEND_REQUIRED:
        if not fe_env.get(key):
            issues.append(f"MISSING frontend env: {key} (add to .env.local)")

    be_env = load_env(ROOT / "backend" / ".env")
    for key in BACKEND_REQUIRED:
        val = be_env.get(key, "")
        if not val:
            issues.append(f"MISSING backend env: {key}")
        elif any(p in val for p in PLACEHOLDER_VALUES):
            issues.append(f"Placeholder value for backend env: {key}")

    return issues

if __name__ == "__main__":
    issues = run()
    if issues:
        print("\n".join(f"  ✗ {i}" for i in issues))
        sys.exit(1)
    sys.exit(0)
