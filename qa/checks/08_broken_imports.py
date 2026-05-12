"""Check 08: Broken component imports and missing files referenced in code."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parents[2]
SKIP_DIRS = {"node_modules", ".next", "venv", "__pycache__", ".git", "qa"}

ALIAS_MAP = {
    "@/": str(ROOT) + "/",
}

def resolve_alias(imp: str) -> Path | None:
    for alias, real in ALIAS_MAP.items():
        if imp.startswith(alias):
            rel = imp[len(alias):]
            base = Path(real + rel)
            for ext in ["", ".ts", ".tsx", ".js", ".jsx"]:
                candidate = Path(str(base) + ext)
                if candidate.exists():
                    return candidate
                index = base / ("index" + ext)
                if index.exists():
                    return index
    return None

def run():
    issues = []
    scanned = 0

    for path in ROOT.rglob("*.ts"):
        if any(skip in path.parts for skip in SKIP_DIRS):
            continue
        scanned += 1
        text = path.read_text(errors="ignore")
        for m in re.finditer(r'from\s+["\'](@/[^"\']+)["\']', text):
            imp = m.group(1)
            resolved = resolve_alias(imp)
            if resolved is None:
                issues.append(f"Broken import {imp!r} in {path.relative_to(ROOT)}")

    for path in ROOT.rglob("*.tsx"):
        if any(skip in path.parts for skip in SKIP_DIRS):
            continue
        scanned += 1
        text = path.read_text(errors="ignore")
        for m in re.finditer(r'from\s+["\'](@/[^"\']+)["\']', text):
            imp = m.group(1)
            resolved = resolve_alias(imp)
            if resolved is None:
                issues.append(f"Broken import {imp!r} in {path.relative_to(ROOT)}")

    return issues

if __name__ == "__main__":
    issues = run()
    if issues:
        # Deduplicate
        seen = set()
        unique = []
        for i in issues:
            if i not in seen:
                seen.add(i)
                unique.append(i)
        print("\n".join(f"  ✗ {i}" for i in unique))
        sys.exit(1)
    print("  ✓ All @/ imports resolve correctly")
