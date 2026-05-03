import json
from collections import Counter

TOOLS_FILE = "data/tools.json"
MAX_POINTS_COST = 20

def main():
    with open(TOOLS_FILE, "r", encoding="utf-8") as f:
        tools = json.load(f)

    errors = []
    by_category = Counter()
    paid = 0
    free = 0

    for tool in tools:
        tid = tool.get("id", "<unknown>")
        cost = tool.get("points_cost", 0)
        cat = tool.get("category", "unknown")

        if not isinstance(cost, int):
            errors.append(f"{tid}: points_cost must be integer")
            continue
        if cost < 0:
            errors.append(f"{tid}: points_cost cannot be negative")
        if cost > MAX_POINTS_COST:
            errors.append(f"{tid}: points_cost too high ({cost})")

        if cost == 0:
            free += 1
            by_category[(cat, "free")] += 1
        else:
            paid += 1
            by_category[(cat, "paid")] += 1

    if errors:
        print("Billing policy check FAILED:")
        for e in errors:
            print("-", e)
        raise SystemExit(1)

    print("Billing policy check PASSED")
    print(f"Total tools: {len(tools)}")
    print(f"Paid tools: {paid}")
    print(f"Free tools: {free}")
    print("Breakdown by category:")
    cats = sorted({k[0] for k in by_category.keys()})
    for cat in cats:
        print(f"- {cat}: paid={by_category[(cat,'paid')]}, free={by_category[(cat,'free')]}")

if __name__ == "__main__":
    main()
