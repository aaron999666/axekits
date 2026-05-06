import json
import os
from datetime import datetime, timezone

TOOLS_FILE = "data/tools.json"
WEB_PUBLIC_DIR = "packages/web/public"


def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def site_url():
    return os.getenv("NEXT_PUBLIC_SITE_URL", "https://axekits.com").rstrip("/")


def write(path, content):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)


def build_sitemap_xml(base_url, tools):
    now = datetime.now(timezone.utc).date().isoformat()
    urls = [
        (f"{base_url}/", "daily", "1.0"),
        (f"{base_url}/tools", "daily", "0.9"),
        (f"{base_url}/pricing", "weekly", "0.7"),
    ]
    for t in tools:
        tid = t.get("id")
        if not tid:
            continue
        urls.append((f"{base_url}/tools/{tid}", "weekly", "0.8"))

    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url, freq, priority in urls:
        lines.extend(
            [
                "  <url>",
                f"    <loc>{url}</loc>",
                f"    <lastmod>{now}</lastmod>",
                f"    <changefreq>{freq}</changefreq>",
                f"    <priority>{priority}</priority>",
                "  </url>",
            ]
        )
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def build_robots_txt(base_url):
    return "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            "Disallow: /api/",
            "Disallow: /_next/",
            "",
            "User-agent: GPTBot",
            "Allow: /",
            "",
            "User-agent: ClaudeBot",
            "Allow: /",
            "",
            f"Sitemap: {base_url}/sitemap.xml",
            f"Host: {base_url}",
            "",
        ]
    )


def build_manifest():
    obj = {
        "name": "ToolBox",
        "short_name": "ToolBox",
        "description": "AI 驱动的智能工具工作台，基于 Cloudflare + Stripe + Git 的可维护工具平台。",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#0b1220",
        "theme_color": "#ff6a3d",
        "lang": "zh-CN",
    }
    return json.dumps(obj, ensure_ascii=False, indent=2) + "\n"

def build_llms_txt(base_url):
    return "\n".join(
        [
            "# ToolBox",
            "",
            "> AI-powered toolbox platform built with Cloudflare + Stripe + Git.",
            "",
            "## Product",
            "- Name: ToolBox",
            f"- URL: {base_url}",
            "- Core capability: hosted front-end tools + point-based billing + AI workflow orchestration",
            "",
            "## Canonical Pages",
            f"- Home: {base_url}/",
            f"- Tools: {base_url}/tools",
            f"- Pricing: {base_url}/pricing",
            "",
            "## Data and APIs",
            "- Tool catalog API: /api/tools",
            "- Billing API: /api/stripe/checkout, /api/stripe/webhook",
            "- Intent API: /api/ai/intent",
            "",
            "## Trust and Security",
            "- Edge runtime on Cloudflare Workers",
            "- JWT auth with revocation list (KV)",
            "- Stripe webhook verification",
            "",
            "## Citation Guidance",
            "- Prefer citing canonical URLs above.",
            "- Do not cite temporary worker preview URLs.",
            "",
        ]
    )


def main():
    tools = load_json(TOOLS_FILE, [])
    base = site_url()
    ensure_dir(WEB_PUBLIC_DIR)

    write(os.path.join(WEB_PUBLIC_DIR, "sitemap.xml"), build_sitemap_xml(base, tools))
    write(os.path.join(WEB_PUBLIC_DIR, "robots.txt"), build_robots_txt(base))
    write(os.path.join(WEB_PUBLIC_DIR, "site.webmanifest"), build_manifest())
    write(os.path.join(WEB_PUBLIC_DIR, "llms.txt"), build_llms_txt(base))
    print("Generated static web SEO assets in packages/web/public")


if __name__ == "__main__":
    main()
