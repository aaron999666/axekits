import json

VALID_CATEGORIES = [
    "dev-assistant", "image-visual", "brand-design",
    "document-convert", "seo-marketing", "hardware-eng",
    "finance-data", "web3-security", "ai-productivity",
    "daily-calc", "design-assets",
]

def main():
    with open("data/tools.json", "r", encoding="utf-8") as f:
        tools = json.load(f)

    errors = []
    for tool in tools:
        if not tool.get("id"):
            errors.append(f"Missing id: {tool}")
        if not tool.get("name"):
            errors.append(f"Missing name: {tool.get('id')}")
        if tool.get("category") not in VALID_CATEGORIES:
            errors.append(f"Invalid category '{tool.get('category')}' for {tool.get('id')}")
        if not isinstance(tool.get("points_cost", 0), int) or tool.get("points_cost", 0) < 0:
            errors.append(f"Invalid points_cost for {tool.get('id')}")
        if not tool.get("tags") or not isinstance(tool.get("tags"), list):
            errors.append(f"Missing tags for {tool.get('id')}")
        if not tool.get("name_zh"):
            errors.append(f"Missing name_zh for {tool.get('id')}")

    if errors:
        print(f"Validation failed with {len(errors)} errors:")
        for e in errors[:20]:
            print(f"  - {e}")
        exit(1)
    else:
        print(f"Validation passed: {len(tools)} tools OK")

if __name__ == "__main__":
    main()
