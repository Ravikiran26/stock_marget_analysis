"""Check 07: SEO and Open Graph — metadata, OG image, sitemap, robots."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parents[2]

REQUIRED_META = ["title", "description"]
OG_REQUIRED = ["og:title", "og:description", "og:image", "og:url"]
TWITTER_REQUIRED = ["twitter:card", "twitter:title"]

def run():
    issues = []

    layout = ROOT / "app" / "layout.tsx"
    if not layout.exists():
        issues.append("app/layout.tsx not found — can't verify metadata")
        return issues

    text = layout.read_text()

    # Check metadata — either Next.js export or manual <head> tags
    has_metadata = (
        "export const metadata" in text
        or "generateMetadata" in text
        or ("<title>" in text and 'name="description"' in text)
    )
    if not has_metadata:
        issues.append("No metadata in app/layout.tsx — search engines won't get title/description")

    # Check OG image route exists
    og_route = ROOT / "app" / "og-image.png" / "route.tsx"
    if not og_route.exists():
        issues.append("No OG image route at app/og-image.png/route.tsx — social previews will be blank")

    # Check for sitemap
    sitemap = ROOT / "app" / "sitemap.ts"
    sitemap_xml = ROOT / "public" / "sitemap.xml"
    if not sitemap.exists() and not sitemap_xml.exists():
        issues.append("No sitemap.ts or public/sitemap.xml — Google won't index pages efficiently")

    # Check robots.txt
    robots = ROOT / "public" / "robots.txt"
    robots_ts = ROOT / "app" / "robots.ts"
    if not robots.exists() and not robots_ts.exists():
        issues.append("No robots.txt — search engines have no crawl instructions")

    # Check favicon
    favicon = ROOT / "app" / "favicon.ico"
    if not favicon.exists():
        issues.append("No favicon at app/favicon.ico — browser tab will show generic icon")

    # Check landing page has proper headings
    home_page = ROOT / "app" / "page.tsx"
    if home_page.exists():
        hp_text = home_page.read_text()
        if "<h1" not in hp_text and "h1" not in hp_text:
            issues.append("Landing page (app/page.tsx) has no <h1> — bad for SEO")

    return issues

if __name__ == "__main__":
    issues = run()
    if issues:
        print("\n".join(f"  ✗ {i}" for i in issues))
        sys.exit(1)
    print("  ✓ SEO and OG metadata look good")
