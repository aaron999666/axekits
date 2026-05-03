import json
import os
from collections import Counter
from datetime import datetime, timezone

COMPETITOR_FILE = "data/competitors.json"
TOOLS_FILE = "data/tools.json"
OUT_FILE = "data/competitor_benchmark.json"

def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def main():
    competitors = load_json(COMPETITOR_FILE, [])
    tools = load_json(TOOLS_FILE, [])

    our_tags = Counter()
    for tool in tools:
        for tag in tool.get("tags", []):
            if isinstance(tag, str):
                our_tags[tag.lower()] += 1

    gaps = []
    for comp in competitors:
        focus = [x.lower() for x in comp.get("focus", [])]
        missing = [topic for topic in focus if our_tags[topic] == 0]
        partial = [topic for topic in focus if 0 < our_tags[topic] <= 1]
        gaps.append({
            "name": comp.get("name"),
            "url": comp.get("url"),
            "focus": focus,
            "missing_topics": missing,
            "thin_topics": partial,
        })

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "competitor_count": len(competitors),
        "our_tool_count": len(tools),
        "top_our_tags": our_tags.most_common(20),
        "gaps": gaps,
        "recommendations": build_recommendations(gaps),
    }

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"Competitor benchmark generated: {OUT_FILE}")

def build_recommendations(gaps):
    rec = []
    topic_missing_count = Counter()
    for g in gaps:
        for t in g["missing_topics"]:
            topic_missing_count[t] += 1
    for topic, c in topic_missing_count.most_common(10):
        rec.append({
            "topic": topic,
            "missing_against_competitors": c,
            "priority": "high" if c >= 2 else "medium",
        })
    return rec

if __name__ == "__main__":
    main()
