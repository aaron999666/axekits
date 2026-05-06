import os
import json
import time
import requests

GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
MAX_REPOS_TOTAL = int(os.getenv("MAX_REPOS_TOTAL", "30"))
TOOLS_FILE = "data/tools.json"
CATALOG_CONTROL_FILE = "data/catalog_control.json"

CATEGORIES_QUERIES = {
    "dev-assistant": "topic:developer-tools+topic:utility+stars:>100",
    "image-visual": "topic:image-processing+topic:image+stars:>120",
    "document-convert": "topic:pdf+topic:converter+stars:>150",
    "daily-calc": "topic:calculator+topic:utility+stars:>80",
}

MIN_STARS_BY_CATEGORY = {
    "dev-assistant": int(os.getenv("MIN_STARS_DEV_ASSISTANT", "100")),
    "image-visual": int(os.getenv("MIN_STARS_IMAGE_VISUAL", "120")),
    "document-convert": int(os.getenv("MIN_STARS_DOCUMENT_CONVERT", "150")),
    "daily-calc": int(os.getenv("MIN_STARS_DAILY_CALC", "80")),
}


def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_total_tools_count():
    tools = load_json(TOOLS_FILE, [])
    return len(tools)


def dynamic_scan_cap(total_tools):
    cfg = load_json(CATALOG_CONTROL_FILE, {})
    default_caps = cfg.get("default_caps", {}) or {}
    cap = int(default_caps.get("scan_repos_per_run", MAX_REPOS_TOTAL))
    for tier in cfg.get("catalog_tiers", []) or []:
        lo = int(tier.get("min_total_tools", 0))
        hi = int(tier.get("max_total_tools", 10**9))
        if lo <= total_tools <= hi:
            cap = int(tier.get("scan_repos_per_run", cap))
            break
    return max(1, cap)

def search_repos_graphql(query, category, max_repos=20):
    graphql_query = """
    query($query: String!, $first: Int!) {
      search(query: $query, type: REPOSITORY, first: $first) {
        nodes {
          ... on Repository {
            name
            nameWithOwner
            description
            url
            stargazerCount
            primaryLanguage { name }
            repositoryTopics(first: 10) { nodes { topic { name } } }
            homepageUrl
            updatedAt
            licenseInfo { spdxId }
            isArchived
          }
        }
      }
    }
    """
    headers = {
        "Authorization": f"bearer {GITHUB_TOKEN}",
        "Content-Type": "application/json",
    }
    all_repos = []
    variables = {"query": query, "first": min(max_repos, 20)}
    try:
        resp = requests.post(
            "https://api.github.com/graphql",
            json={"query": graphql_query, "variables": variables},
            headers=headers,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        for node in data.get("data", {}).get("search", {}).get("nodes", []):
            if node.get("isArchived"):
                continue
            stars = node.get("stargazerCount", 0)
            if stars < MIN_STARS_BY_CATEGORY.get(category, 0):
                continue

            all_repos.append({
                "id": node["nameWithOwner"].replace("/", "__"),
                "name": node["name"],
                "repo_url": node["url"],
                "description": node.get("description", ""),
                "stars": stars,
                "language": node.get("primaryLanguage", {}).get("name", ""),
                "topics": [t["topic"]["name"] for t in node.get("repositoryTopics", {}).get("nodes", [])],
                "demo_url": node.get("homepageUrl", ""),
                "category_hint": category,
                "license": node.get("licenseInfo", {}).get("spdxId", ""),
                "updated_at": node.get("updatedAt", ""),
            })
    except Exception as e:
        print(f"Error searching {category}: {e}")
    return all_repos

def main():
    total_tools = get_total_tools_count()
    effective_cap = min(MAX_REPOS_TOTAL, dynamic_scan_cap(total_tools))
    print(f"Catalog tools={total_tools}, scanner cap={effective_cap}")

    all_repos = []
    per_category = max(1, min(20, effective_cap // max(1, len(CATEGORIES_QUERIES))))
    for i, (category, query) in enumerate(CATEGORIES_QUERIES.items()):
        if i > 0:
            time.sleep(3)
        print(f"Scanning category: {category}")
        repos = search_repos_graphql(query, category, max_repos=per_category)
        all_repos.extend(repos)
        print(f"  Found {len(repos)} repos")
    seen = set()
    unique_repos = []
    for repo in all_repos:
        if repo["id"] not in seen:
            seen.add(repo["id"])
            unique_repos.append(repo)
        if len(unique_repos) >= effective_cap:
            break
    os.makedirs("data", exist_ok=True)
    with open("data/raw_repos.json", "w", encoding="utf-8") as f:
        json.dump(unique_repos, f, ensure_ascii=False, indent=2)
    print(f"Total unique repos: {len(unique_repos)} (cap={effective_cap})")

if __name__ == "__main__":
    main()
