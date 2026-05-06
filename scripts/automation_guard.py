import json
import os
import sys
from datetime import datetime, timezone

CONFIG_FILE = "data/automation_budget.json"
USAGE_FILE = "data/automation_usage.json"


def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def main():
    cfg = load_json(CONFIG_FILE, {})
    usage = load_json(USAGE_FILE, {})
    now = datetime.now(timezone.utc)
    day_key = now.strftime("%Y-%m-%d")
    month_key = now.strftime("%Y-%m")

    daily = usage.get("daily", {})
    monthly = usage.get("monthly", {})
    if day_key not in daily:
        daily = {day_key: {
            "scan_runs": 0,
            "ai_calls": 0,
            "new_launches": 0,
            "github_api_requests_est": 0,
            "cloudflare_worker_ops_est": 0
        }}
    if month_key not in monthly:
        monthly = {month_key: {
            "estimated_cost_cny": 0.0,
            "github_actions_minutes_est": 0
        }}

    d = daily[day_key]
    m = monthly[month_key]

    limits = cfg.get("daily_limits", {})
    free_quota = cfg.get("free_quota_guard", {}) or {}
    budget = cfg.get("monthly_budget_cny", 0.0)
    stop_ratio = float(cfg.get("stop_ratio", 0.5) or 0.5)
    est = cfg.get("estimated_cost_per_scan_run_cny", 0.0)

    reasons = []
    if int(d.get("scan_runs", 0)) >= int(limits.get("scan_runs", 1)):
        reasons.append("daily scan_runs reached")
    ai_limit = int(limits.get("ai_calls", 200))
    if ai_limit > 0 and int(d.get("ai_calls", 0)) >= ai_limit:
        reasons.append("daily ai_calls reached")
    if int(d.get("new_launches", 0)) >= int(limits.get("new_launches", 10)):
        reasons.append("daily new_launches reached")

    gh_actions = free_quota.get("github_actions", {}) or {}
    gh_api = free_quota.get("github_api", {}) or {}
    cf = free_quota.get("cloudflare", {}) or {}

    est_minutes_next = int(gh_actions.get("est_minutes_per_scan_run", 8))
    monthly_minutes_cap = int(gh_actions.get("monthly_minutes_cap", 400))
    projected_minutes = int(m.get("github_actions_minutes_est", 0)) + est_minutes_next
    if projected_minutes >= monthly_minutes_cap:
        reasons.append("monthly github actions minutes estimated cap reached")

    est_gh_api_next = int(gh_api.get("est_search_requests_per_scan_run", 20))
    daily_gh_api_cap = int(gh_api.get("daily_search_requests_cap", 120))
    projected_gh_api = int(d.get("github_api_requests_est", 0)) + est_gh_api_next
    if projected_gh_api >= daily_gh_api_cap:
        reasons.append("daily github api estimated cap reached")

    est_cf_ops_next = int(cf.get("est_worker_ops_per_scan_run", 150))
    daily_cf_ops_cap = int(cf.get("daily_worker_ops_cap", 2000))
    projected_cf_ops = int(d.get("cloudflare_worker_ops_est", 0)) + est_cf_ops_next
    if projected_cf_ops >= daily_cf_ops_cap:
        reasons.append("daily cloudflare worker ops estimated cap reached")

    projected_cost = float(m.get("estimated_cost_cny", 0.0)) + float(est)
    if budget > 0 and projected_cost >= budget * stop_ratio:
        reasons.append("monthly budget 50% threshold reached")

    if reasons:
        print("AUTOMATION_GUARD_BLOCKED")
        for r in reasons:
            print(f"- {r}")
        sys.exit(2)

    d["scan_runs"] = int(d.get("scan_runs", 0)) + 1
    d["github_api_requests_est"] = projected_gh_api
    d["cloudflare_worker_ops_est"] = projected_cf_ops
    m["estimated_cost_cny"] = round(projected_cost, 4)
    m["github_actions_minutes_est"] = projected_minutes
    usage["daily"] = daily
    usage["monthly"] = monthly
    save_json(USAGE_FILE, usage)
    print("AUTOMATION_GUARD_OK")


if __name__ == "__main__":
    main()
