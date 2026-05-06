import json
import math
from collections import defaultdict
from datetime import datetime, timezone

TOOLS_FILE = "data/tools.json"
RULES_FILE = "data/pricing_rules.json"
REPORT_FILE = "data/pricing_report.json"

def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def tool_text(tool):
    parts = [
        tool.get("id", ""),
        tool.get("name", ""),
        tool.get("name_zh", ""),
        tool.get("description", ""),
        tool.get("description_zh", ""),
    ] + list(tool.get("tags", []) or [])
    return " ".join(str(x).lower() for x in parts if x)

def score_tool(tool, rules):
    text = tool_text(tool)
    category = tool.get("category", "dev-assistant")
    base = rules["category_base_points"].get(category, 1)

    premium_hits = sum(1 for kw in rules["premium_keywords"] if kw in text)
    free_hits = sum(1 for kw in rules["always_free_keywords"] if kw in text)

    stars = int(tool.get("stars", 0) or 0)
    demand_score = 0
    if stars >= 20000:
        demand_score = 4
    elif stars >= 8000:
        demand_score = 3
    elif stars >= 3000:
        demand_score = 2
    elif stars >= 1000:
        demand_score = 1

    self_hosted = bool(tool.get("self_hosted", False))
    host_bonus = 1 if self_hosted else 0

    # complexity score drives paid points
    complexity = base + premium_hits + host_bonus + demand_score - free_hits
    complexity = max(0, complexity)
    return complexity, premium_hits, free_hits, demand_score, host_bonus

def compute_target_free_count(total, ratio):
    return max(1, int(round(total * ratio)))

def safe_float(v, default):
    try:
        return float(v)
    except Exception:
        return float(default)

def safe_int(v, default):
    try:
        return int(v)
    except Exception:
        return int(default)

def backsolve_points_targets(rules):
    rt = rules.get("revenue_target", {}) or {}
    if not rt.get("enabled", False):
        return None

    monthly_target_cny = safe_float(rt.get("monthly_target_cny", 0), 0)
    monthly_active_users = max(1, safe_int(rt.get("monthly_active_users", 1), 1))
    target_conversion_rate = max(0.001, safe_float(rt.get("target_conversion_rate", 0.05), 0.05))
    avg_paid_tool_calls_per_buyer = max(1, safe_float(rt.get("avg_paid_tool_calls_per_buyer", 12), 12))
    price_per_100_points_cny = max(0.01, safe_float(rt.get("price_per_100_points_cny", 9.9), 9.9))
    guardrail_min_points = max(1, safe_int(rt.get("guardrail_min_points", 1), 1))
    guardrail_max_points = max(guardrail_min_points, safe_int(rt.get("guardrail_max_points", 12), 12))

    buyers = monthly_active_users * target_conversion_rate
    target_arppu = monthly_target_cny / buyers if buyers > 0 else 0
    cny_per_point = price_per_100_points_cny / 100.0

    # Reverse solve average points per paid call:
    # buyer monthly spend / paid calls / point price
    avg_points_per_paid_call = target_arppu / max(avg_paid_tool_calls_per_buyer, 1) / cny_per_point
    avg_points_per_paid_call = clamp(
        int(round(avg_points_per_paid_call)),
        guardrail_min_points,
        guardrail_max_points,
    )

    # Build a practical paid range around the reversed average.
    min_paid_points = max(guardrail_min_points, avg_points_per_paid_call - 2)
    max_paid_points = min(guardrail_max_points, avg_points_per_paid_call + 2)
    if min_paid_points > max_paid_points:
        min_paid_points = max_paid_points

    return {
        "enabled": True,
        "monthly_target_cny": monthly_target_cny,
        "monthly_active_users": monthly_active_users,
        "target_conversion_rate": target_conversion_rate,
        "avg_paid_tool_calls_per_buyer": avg_paid_tool_calls_per_buyer,
        "price_per_100_points_cny": price_per_100_points_cny,
        "buyers_estimate": round(buyers, 2),
        "target_arppu_cny": round(target_arppu, 2),
        "avg_points_per_paid_call_target": int(avg_points_per_paid_call),
        "min_paid_points": int(min_paid_points),
        "max_paid_points": int(max_paid_points),
    }

def apply_pricing(tools, rules):
    backsolve = backsolve_points_targets(rules)
    if backsolve:
        rules["min_paid_points"] = backsolve["min_paid_points"]
        rules["max_paid_points"] = backsolve["max_paid_points"]

    priced_cfg = rules.get("pricing_tiers", {}) or {}
    free_ratio_floor = safe_float(rules.get("free_ratio_floor", rules.get("free_ratio_target", 0.25)), 0.25)
    free_ratio_target = safe_float(rules.get("free_ratio_target", 0.25), 0.25)
    free_ratio_target = max(free_ratio_floor, free_ratio_target)
    if free_ratio_target > 0.95:
        free_ratio_target = 0.95

    guardrail_cfg = rules.get("guardrails", {}) or {}
    max_daily_increase_ratio = safe_float(guardrail_cfg.get("max_daily_increase_ratio", 0.30), 0.30)
    max_first_paid_points = safe_int(guardrail_cfg.get("max_first_paid_points", 2), 2)
    min_first_paid_points = safe_int(guardrail_cfg.get("min_first_paid_points", 1), 1)

    scored = []
    for t in tools:
        complexity, premium_hits, free_hits, demand_score, host_bonus = score_tool(t, rules)
        scored.append((t, complexity, premium_hits, free_hits, demand_score, host_bonus))

    # Candidate free tools: lowest complexity first
    scored_sorted = sorted(scored, key=lambda x: (x[1], -(x[3]), x[0].get("id", "")))
    target_free = compute_target_free_count(len(tools), free_ratio_target)

    free_set = set()
    # always-free keyword tools are prioritized
    for t, _, _, free_hits, _, _ in scored_sorted:
        if free_hits > 0 and len(free_set) < target_free:
            free_set.add(t.get("id"))

    for t, _, _, _, _, _ in scored_sorted:
        if len(free_set) >= target_free:
            break
        free_set.add(t.get("id"))

    min_pts = int(rules["min_paid_points"])
    max_pts = int(rules["max_paid_points"])
    report_items = []

    for t, complexity, premium_hits, free_hits, demand_score, host_bonus in scored:
        tid = t.get("id")
        old = safe_int(t.get("points_cost", 1), 1)
        revenue_tier = "free"
        auto_free_reason = "ratio_floor"

        if tid in free_set:
            new_cost = 0
            mode = "free"
            revenue_tier = "free"
        else:
            # Map complexity to paid points scale
            raw = 1 + math.floor(complexity / 2)
            new_cost = clamp(raw, min_pts, max_pts)
            mode = "paid"
            if new_cost <= 2:
                revenue_tier = "standard"
            elif new_cost <= 6:
                revenue_tier = "pro"
            else:
                revenue_tier = "enterprise"
            auto_free_reason = ""

            # Guardrail 1: if previously free, first step-up must stay small.
            if old <= 0:
                new_cost = clamp(new_cost, min_first_paid_points, max_first_paid_points)

            # Guardrail 2: daily increase capped (default +30%).
            if old > 0 and new_cost > old:
                capped = int(math.ceil(old * (1 + max_daily_increase_ratio)))
                new_cost = min(new_cost, max(capped, old + 1))

        t["points_cost"] = int(new_cost)
        t["pricing_tier"] = revenue_tier
        t["billing_mode"] = "free" if new_cost == 0 else "points"
        report_items.append({
            "id": tid,
            "category": t.get("category"),
            "old_points": old,
            "new_points": new_cost,
            "mode": mode,
            "pricing_tier": revenue_tier,
            "complexity": complexity,
            "premium_hits": premium_hits,
            "free_hits": free_hits,
            "demand_score": demand_score,
            "host_bonus": host_bonus,
            "stars": int(t.get("stars", 0) or 0),
            "auto_free_reason": auto_free_reason,
        })

    return tools, report_items, backsolve, {
        "free_ratio_target": free_ratio_target,
        "free_ratio_floor": free_ratio_floor,
        "max_daily_increase_ratio": max_daily_increase_ratio,
        "max_first_paid_points": max_first_paid_points,
        "min_first_paid_points": min_first_paid_points,
        "tiers": priced_cfg,
    }

def summarize(report_items):
    by_category = defaultdict(lambda: {"free": 0, "paid": 0, "avg_paid_points": 0, "paid_count": 0})
    free_count = 0
    paid_count = 0

    for item in report_items:
        cat = item["category"] or "unknown"
        if item["mode"] == "free":
            free_count += 1
            by_category[cat]["free"] += 1
        else:
            paid_count += 1
            by_category[cat]["paid"] += 1
            by_category[cat]["paid_count"] += 1
            by_category[cat]["avg_paid_points"] += item["new_points"]

    for cat, v in by_category.items():
        if v["paid_count"] > 0:
            v["avg_paid_points"] = round(v["avg_paid_points"] / v["paid_count"], 2)
        del v["paid_count"]

    return {
        "free_count": free_count,
        "paid_count": paid_count,
        "by_category": by_category,
    }

def main():
    tools = load_json(TOOLS_FILE)
    rules = load_json(RULES_FILE)
    tools, report_items, backsolve, pricing_runtime = apply_pricing(tools, rules)
    summary = summarize(report_items)

    with open(TOOLS_FILE, "w", encoding="utf-8") as f:
        json.dump(tools, f, ensure_ascii=False, indent=2)

    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "rules_version": rules.get("version"),
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "revenue_target_backsolve": backsolve,
            "pricing_runtime": pricing_runtime,
            "summary": {
                "free_count": summary["free_count"],
                "paid_count": summary["paid_count"],
                "by_category": dict(summary["by_category"]),
            },
            "items": report_items,
        }, f, ensure_ascii=False, indent=2)

    print("Pricing engine applied.")
    print(f"Free tools: {summary['free_count']}, Paid tools: {summary['paid_count']}")

if __name__ == "__main__":
    main()
