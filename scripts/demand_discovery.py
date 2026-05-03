import json
import os
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone

TOOLS_FILE = "data/tools.json"
RAW_REPOS_FILE = "data/raw_repos.json"
COMPETITOR_BENCHMARK_FILE = "data/competitor_benchmark.json"
SOURCES_FILE = "data/demand_sources.json"
OUT_CANDIDATES_FILE = "data/demand_candidates.json"
OUT_LAUNCH_QUEUE_FILE = "data/auto_launch_queue.json"

OPTIONAL_INTERNAL_FILES = {
    "search_terms": "data/internal_search_terms.json",
    "failed_requests": "data/internal_failed_requests.json",
    "tool_search_log": "data/tool_search_log.json",
}

STOPWORDS = {
    "tool", "tools", "with", "for", "and", "the", "from", "into", "your", "that",
    "this", "make", "using", "more", "best", "fast", "simple", "online", "free",
    "image", "file", "data", "text", "utility", "utils",
}

CATEGORY_HINTS = {
    "document-convert": {"pdf", "doc", "ppt", "excel", "word", "convert", "merge", "split"},
    "image-visual": {"image", "photo", "resize", "compress", "watermark", "background", "upscale"},
    "dev-assistant": {"json", "api", "regex", "sql", "code", "hash", "url", "base64", "jwt"},
    "daily-calc": {"calculator", "loan", "tax", "date", "time", "currency", "rate"},
}

COMMERCIAL_INTENT_WORDS = {
    "pdf", "invoice", "batch", "convert", "compress", "watermark", "upscale",
    "ocr", "remove", "ai", "resume", "contract", "report", "export",
}

RISK_WORDS = {"crack", "bypass", "pirated", "hack", "exploit", "ddos", "token-leak"}


def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def tokenize(text):
    parts = re.findall(r"[a-z0-9][a-z0-9+._-]{1,30}", (text or "").lower())
    out = []
    for p in parts:
        if p in STOPWORDS:
            continue
        if p.isdigit():
            continue
        out.append(p)
    return out


def pick_category(keyword):
    best = ("dev-assistant", 0)
    kw = keyword.lower()
    for cat, words in CATEGORY_HINTS.items():
        hits = sum(1 for w in words if w in kw)
        if hits > best[1]:
            best = (cat, hits)
    return best[0]


def score_capability_fit(keyword, existing_tags):
    kw = keyword.lower()
    hits = sum(1 for t in existing_tags if t in kw or kw in t)
    if hits >= 3:
        return 1.0
    if hits == 2:
        return 0.8
    if hits == 1:
        return 0.55
    return 0.35


def score_commercial_intent(keyword):
    kw = keyword.lower()
    hits = sum(1 for w in COMMERCIAL_INTENT_WORDS if w in kw)
    if hits >= 2:
        return 1.0
    if hits == 1:
        return 0.7
    return 0.35


def score_risk(keyword):
    kw = keyword.lower()
    return 1.0 if any(w in kw for w in RISK_WORDS) else 0.0


def normalize_signals(rows, key):
    values = [max(0.0, float(r.get(key, 0.0))) for r in rows]
    if not values:
        return
    lo = min(values)
    hi = max(values)
    for r in rows:
        v = max(0.0, float(r.get(key, 0.0)))
        if hi == lo:
            r[key + "_norm"] = 0.5 if hi > 0 else 0.0
        else:
            r[key + "_norm"] = (v - lo) / (hi - lo)


def main():
    tools = load_json(TOOLS_FILE, [])
    repos = load_json(RAW_REPOS_FILE, [])
    comp = load_json(COMPETITOR_BENCHMARK_FILE, {})
    sources_cfg = load_json(SOURCES_FILE, {})

    weights = sources_cfg.get("weights", {
        "heat": 0.35,
        "growth_proxy": 0.2,
        "commercial_intent": 0.2,
        "supply_gap": 0.2,
        "capability_fit": 0.15,
        "risk_penalty": 0.3,
    })
    limits = sources_cfg.get("limits", {"max_candidates": 80, "launch_queue_top_n": 20})

    existing_tags = set()
    existing_tool_ids = set()
    for t in tools:
        existing_tool_ids.add((t.get("id") or "").lower())
        for tag in t.get("tags", []) or []:
            if isinstance(tag, str):
                existing_tags.add(tag.lower())

    signal_map = defaultdict(lambda: {
        "keyword": "",
        "heat": 0.0,
        "growth_proxy": 0.0,
        "commercial_intent": 0.0,
        "supply_gap": 0.0,
        "capability_fit": 0.0,
        "risk_penalty": 0.0,
        "evidence": [],
    })

    # Source A: competitor gaps (high value demand holes)
    for rec in comp.get("recommendations", []):
        topic = (rec.get("topic") or "").strip().lower()
        if not topic:
            continue
        row = signal_map[topic]
        row["keyword"] = topic
        gap_count = float(rec.get("missing_against_competitors", 0) or 0)
        row["heat"] += 2 + gap_count
        row["supply_gap"] += min(5.0, gap_count)
        row["evidence"].append("competitor_gap")

    # Source B: GitHub repo ecosystem from scanner
    for r in repos:
        stars = float(r.get("stars", 0) or 0)
        score = max(1.0, min(6.0, stars / 5000.0 + 1.0))
        txt = " ".join([
            r.get("name", ""),
            r.get("description", ""),
            " ".join(r.get("topics", []) or []),
        ])
        tokens = tokenize(txt)
        for kw in tokens[:30]:
            if len(kw) < 3:
                continue
            row = signal_map[kw]
            row["keyword"] = kw
            row["heat"] += score
            row["growth_proxy"] += score * 0.5
            row["evidence"].append("github_ecosystem")

    # Source C: optional internal logs (if present)
    search_terms = load_json(OPTIONAL_INTERNAL_FILES["search_terms"], [])
    for x in search_terms:
        kw = (x.get("keyword") or "").strip().lower()
        if not kw:
            continue
        count = float(x.get("count", 1) or 1)
        no_result_rate = float(x.get("no_result_rate", 0.0) or 0.0)
        row = signal_map[kw]
        row["keyword"] = kw
        row["heat"] += min(12.0, count / 10.0)
        row["supply_gap"] += min(4.0, no_result_rate * 4.0)
        row["evidence"].append("internal_search")

    failed = load_json(OPTIONAL_INTERNAL_FILES["failed_requests"], [])
    for x in failed:
        kw = (x.get("intent") or x.get("keyword") or "").strip().lower()
        if not kw:
            continue
        count = float(x.get("count", 1) or 1)
        row = signal_map[kw]
        row["keyword"] = kw
        row["heat"] += min(10.0, count / 8.0)
        row["supply_gap"] += min(4.0, count / 25.0)
        row["evidence"].append("internal_failed_requests")

    tool_search = load_json(OPTIONAL_INTERNAL_FILES["tool_search_log"], [])
    for x in tool_search:
        kw = (x.get("query") or "").strip().lower()
        if not kw:
            continue
        count = float(x.get("count", 1) or 1)
        row = signal_map[kw]
        row["keyword"] = kw
        row["heat"] += min(10.0, count / 12.0)
        row["evidence"].append("internal_tool_search")

    rows = list(signal_map.values())
    rows = [r for r in rows if r["keyword"] and len(r["keyword"]) >= 3]

    for r in rows:
        kw = r["keyword"]
        r["commercial_intent"] = max(r["commercial_intent"], score_commercial_intent(kw))
        r["capability_fit"] = max(r["capability_fit"], score_capability_fit(kw, existing_tags))
        r["risk_penalty"] = max(r["risk_penalty"], score_risk(kw))

    normalize_signals(rows, "heat")
    normalize_signals(rows, "growth_proxy")
    normalize_signals(rows, "commercial_intent")
    normalize_signals(rows, "supply_gap")
    normalize_signals(rows, "capability_fit")
    normalize_signals(rows, "risk_penalty")

    for r in rows:
        r["demand_score"] = round(
            weights["heat"] * r.get("heat_norm", 0.0)
            + weights["growth_proxy"] * r.get("growth_proxy_norm", 0.0)
            + weights["commercial_intent"] * r.get("commercial_intent_norm", 0.0)
            + weights["supply_gap"] * r.get("supply_gap_norm", 0.0)
            + weights["capability_fit"] * r.get("capability_fit_norm", 0.0)
            - weights["risk_penalty"] * r.get("risk_penalty_norm", 0.0),
            4,
        )
        r["category_suggestion"] = pick_category(r["keyword"])
        r["launch_mode"] = "manual_review" if r["risk_penalty"] > 0 else "auto_candidate"

    rows.sort(key=lambda x: (x["demand_score"], x["heat"]), reverse=True)
    max_candidates = int(limits.get("max_candidates", 80))
    rows = rows[:max_candidates]

    # Build launch queue with deterministic IDs
    launch_top_n = int(limits.get("launch_queue_top_n", 20))
    queue = []
    for r in rows[:launch_top_n]:
        slug = re.sub(r"[^a-z0-9]+", "-", r["keyword"]).strip("-")
        tool_id = f"auto-{slug}"[:48]
        if tool_id in existing_tool_ids:
            continue
        queue.append({
            "tool_id": tool_id,
            "keyword": r["keyword"],
            "category": r["category_suggestion"],
            "demand_score": r["demand_score"],
            "launch_mode": r["launch_mode"],
            "suggested_points_mode": "paid_candidate" if r["commercial_intent"] >= 0.7 else "free_candidate",
            "evidence": sorted(set(r["evidence"]))[:8],
            "status": "queued",
        })

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_summary": {
            "tools_count": len(tools),
            "raw_repo_count": len(repos),
            "competitor_recommendations": len(comp.get("recommendations", [])),
            "internal_sources_detected": {
                k: os.path.exists(v) for k, v in OPTIONAL_INTERNAL_FILES.items()
            },
        },
        "weights": weights,
        "limits": limits,
        "candidates": rows,
    }

    save_json(OUT_CANDIDATES_FILE, output)
    save_json(OUT_LAUNCH_QUEUE_FILE, {
        "generated_at": output["generated_at"],
        "queue_size": len(queue),
        "queue": queue,
    })

    print(f"Demand candidates generated: {OUT_CANDIDATES_FILE} ({len(rows)} items)")
    print(f"Auto launch queue generated: {OUT_LAUNCH_QUEUE_FILE} ({len(queue)} items)")


if __name__ == "__main__":
    main()
