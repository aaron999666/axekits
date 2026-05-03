import json
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

def check_tool_health(tool):
    if tool.get("self_hosted"):
        tool["health_status"] = "healthy"
        tool["last_checked"] = datetime.utcnow().isoformat()
        return tool

    url = tool.get("demo_url", "")
    if not url:
        tool["health_status"] = "unknown"
        return tool
    try:
        resp = requests.head(url, timeout=10, allow_redirects=True)
        if resp.status_code < 400:
            tool["health_status"] = "healthy"
        elif resp.status_code < 500:
            tool["health_status"] = "degraded"
        else:
            tool["health_status"] = "down"
    except requests.exceptions.Timeout:
        tool["health_status"] = "degraded"
    except Exception:
        tool["health_status"] = "down"
    tool["last_checked"] = datetime.utcnow().isoformat()
    return tool

def main():
    with open("data/tools.json", "r", encoding="utf-8") as f:
        tools = json.load(f)

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(check_tool_health, tool): tool for tool in tools}
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as e:
                print(f"Health check error: {e}")

    health_status = {
        tool["id"]: {
            "status": tool.get("health_status", "unknown"),
            "last_checked": tool.get("last_checked", ""),
        }
        for tool in tools
    }

    with open("data/health_status.json", "w", encoding="utf-8") as f:
        json.dump(health_status, f, ensure_ascii=False, indent=2)

    healthy = sum(1 for t in tools if t.get("health_status") == "healthy")
    print(f"Health check complete: {healthy}/{len(tools)} healthy")

if __name__ == "__main__":
    main()
