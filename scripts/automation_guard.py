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
        daily = {day_key: {"scan_runs": 0, "ai_calls": 0, "new_launches": 0}}
    if month_key not in monthly:
        monthly = {month_key: {"estimated_cost_cny": 0.0}}

    d = daily[day_key]
    m = monthly[month_key]

    limits = cfg.get("daily_limits", {})
    budget = cfg.get("monthly_budget_cny", 0.0)
    stop_ratio = float(cfg.get("stop_ratio", 0.5) or 0.5)
    est = cfg.get("estimated_cost_per_scan_run_cny", 0.0)

    reasons = []
    if int(d.get("scan_runs", 0)) >= int(limits.get("scan_runs", 1)):
        reasons.append("daily scan_runs reached")
    if int(d.get("ai_calls", 0)) >= int(limits.get("ai_calls", 200)):
        reasons.append("daily ai_calls reached")
    if int(d.get("new_launches", 0)) >= int(limits.get("new_launches", 10)):
        reasons.append("daily new_launches reached")

    projected_cost = float(m.get("estimated_cost_cny", 0.0)) + float(est)
    if budget > 0 and projected_cost >= budget * stop_ratio:
        reasons.append("monthly budget 50% threshold reached")

    if reasons:
        print("AUTOMATION_GUARD_BLOCKED")
        for r in reasons:
            print(f"- {r}")
        sys.exit(2)

    d["scan_runs"] = int(d.get("scan_runs", 0)) + 1
    m["estimated_cost_cny"] = round(projected_cost, 4)
    usage["daily"] = daily
    usage["monthly"] = monthly
    save_json(USAGE_FILE, usage)
    print("AUTOMATION_GUARD_OK")


if __name__ == "__main__":
    main()
