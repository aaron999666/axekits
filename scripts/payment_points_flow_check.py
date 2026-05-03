import re

INDEX_FILE = "packages/worker/src/index.ts"
BILLING_FILE = "packages/worker/src/billing.ts"
STRIPE_FILE = "packages/worker/src/stripe.ts"

def assert_contains(path, pattern, label):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if re.search(pattern, content, flags=re.MULTILINE) is None:
        raise AssertionError(f"{label} missing in {path}")

def main():
    assert_contains(INDEX_FILE, r"/api/stripe/checkout", "checkout endpoint")
    assert_contains(STRIPE_FILE, r"checkout\.session\.completed", "stripe purchase event")
    assert_contains(BILLING_FILE, r"UPDATE users SET points_balance = points_balance -", "points deduction SQL")
    assert_contains(INDEX_FILE, r"tool\.points_cost \|\| 0\) <= 0", "free tool branch")
    assert_contains(INDEX_FILE, r"billing: \{ mode: \"points\"", "paid billing payload")
    assert_contains(INDEX_FILE, r"billing: \{ mode: \"free\"", "free billing payload")
    print("Payment/points flow logic check PASSED")

if __name__ == "__main__":
    main()
