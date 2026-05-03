import os
import sys

REQUIRED_SNIPPETS = [
    'id="toolbox-shell-styles"',
    'id="toolbox-shell"',
    'src="/bridge.js"',
]

def main():
    root = "tools"
    missing = []
    total = 0
    for dirpath, _, filenames in os.walk(root):
        if "index.html" not in filenames:
            continue
        total += 1
        path = os.path.join(dirpath, "index.html")
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        for snippet in REQUIRED_SNIPPETS:
            if snippet not in content:
                missing.append((path, snippet))

    if missing:
        print(f"UI consistency check failed: {len(missing)} missing snippets across {total} tool pages")
        for path, snippet in missing[:50]:
            print(f"- {path}: missing {snippet}")
        sys.exit(1)

    print(f"UI consistency check passed: {total} tool pages are unified")

if __name__ == "__main__":
    main()
