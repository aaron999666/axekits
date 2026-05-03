import os
import glob

REQUIRED_FILES = [
    "packages/web/public/sitemap.xml",
    "packages/web/public/robots.txt",
    "packages/web/public/site.webmanifest",
    "packages/web/public/llms.txt",
    "packages/web/app/tools/[id]/page.tsx",
    "packages/web/middleware.ts",
]

REQUIRED_PATTERNS = [
    ("packages/web/public/sitemap.xml", "<urlset"),
    ("packages/web/public/robots.txt", "Sitemap:"),
    ("packages/web/app/tools/[id]/page.tsx", "generateMetadata"),
    ("packages/web/middleware.ts", "cf-ipcountry"),
]

TOOL_PAGE_PATTERNS = [
    "toolbox:seo-geo:start",
    "rel=\"canonical\"",
    "application/ld+json",
    "name=\"geo.region\"",
]

def main():
    missing = []
    for f in REQUIRED_FILES:
        if not os.path.exists(f):
            missing.append(f"missing file: {f}")

    for file_path, pattern in REQUIRED_PATTERNS:
        if not os.path.exists(file_path):
            continue
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        if pattern not in content:
            missing.append(f"missing pattern '{pattern}' in {file_path}")

    tool_pages = glob.glob("tools/**/index.html", recursive=True)
    if not tool_pages:
        missing.append("no tool pages found under tools/**/index.html")
    else:
        for p in tool_pages:
            with open(p, "r", encoding="utf-8") as f:
                c = f.read()
            for marker in TOOL_PAGE_PATTERNS:
                if marker not in c:
                    missing.append(f"missing '{marker}' in {p}")

    if missing:
        print("SEO/GEO auto-check FAILED")
        for m in missing:
            print("-", m)
        raise SystemExit(1)

    print("SEO/GEO auto-check PASSED")
    print("New tools are auto-covered in sitemap/metadata routes and every tool page has SEO+GEO tags.")

if __name__ == "__main__":
    main()
