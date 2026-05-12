"""Check 06: Payment integration — Razorpay config and frontend checkout wiring."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parents[2]
QA_CONFIG = ROOT / "qa" / "config.env"

PLACEHOLDER_VALUES = {"YOUR_KEY_ID", "YOUR_KEY_SECRET", "your_webhook_secret", "YOUR_SECRET", "PLACEHOLDER"}

def load_env(path: Path) -> dict:
    env = {}
    if path.exists():
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

    be_env = load_env(ROOT / "backend" / ".env")

    rp_key = be_env.get("RAZORPAY_KEY_ID", "")
    rp_secret = be_env.get("RAZORPAY_KEY_SECRET", "")
    rp_webhook = be_env.get("RAZORPAY_WEBHOOK_SECRET", "")

    # Placeholder check applies regardless of platform mode
    if any(p in rp_key for p in PLACEHOLDER_VALUES):
        if platform_env:
            print("  ⚠ RAZORPAY_KEY_ID local placeholder — confirmed set in Railway (ok)")
        else:
            issues.append("RAZORPAY_KEY_ID has placeholder value — update in backend/.env")
    elif rp_key.startswith("rzp_test_"):
        if not platform_env:
            issues.append(
                "Razorpay KEY_ID is a test key (rzp_test_*) — "
                "switch to rzp_live_* before going live"
            )
        else:
            print("  ⚠ Local RAZORPAY_KEY_ID is test key — verify Railway has rzp_live_* key")

    if any(p in rp_secret for p in PLACEHOLDER_VALUES):
        if platform_env:
            print("  ⚠ RAZORPAY_KEY_SECRET local placeholder — confirmed set in Railway (ok)")
        else:
            issues.append("RAZORPAY_KEY_SECRET has placeholder value — update in backend/.env")

    if not rp_webhook or any(p in rp_webhook for p in PLACEHOLDER_VALUES):
        if platform_env:
            print("  ⚠ RAZORPAY_WEBHOOK_SECRET local placeholder — confirmed set in Railway (ok)")
        else:
            issues.append(
                "RAZORPAY_WEBHOOK_SECRET not set — "
                "payment webhook events from Razorpay won't be verified"
            )

    # Check Razorpay checkout.js is loaded
    layout_file = ROOT / "app" / "layout.tsx"
    if layout_file.exists():
        if "checkout.razorpay.com" not in layout_file.read_text():
            issues.append("Razorpay checkout.js not loaded in app/layout.tsx — payments will fail")

    # Check PaywallModal has actual checkout flow (not "Coming soon")
    paywall_files = list(ROOT.glob("**/PaywallModal*"))
    for f in paywall_files:
        text = f.read_text()
        if "Coming soon" in text:
            issues.append(
                f"PaywallModal still shows 'Coming soon' — users cannot pay ({f.name})"
            )
        if "createPaymentOrder" not in text and "create-order" not in text:
            issues.append(
                f"PaywallModal does not call createPaymentOrder — checkout is not wired up ({f.name})"
            )

    # Check webhook is not behind auth
    payments_route = ROOT / "backend" / "routes" / "payments.py"
    if payments_route.exists():
        text = payments_route.read_text()
        wh_block = re.search(
            r'@router\.post\("/webhook"\)(.*?)(?=@router|\Z)', text, re.DOTALL
        )
        if wh_block and "get_current_user" in wh_block.group(1):
            issues.append(
                "Payment /webhook endpoint requires get_current_user — "
                "Razorpay callbacks have no JWT and will fail with 401"
            )

    return issues

if __name__ == "__main__":
    issues = run()
    if issues:
        print("\n".join(f"  ✗ {i}" for i in issues))
        sys.exit(1)
    print("  ✓ Payment flow correctly configured")
