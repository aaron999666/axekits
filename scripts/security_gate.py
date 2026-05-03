import json
from datetime import datetime, timezone, timedelta

RISKY_KEYWORDS = [
    "crypto miner", "wallet drainer", "keylogger", "token stealer",
    "remote shell", "command and control", "malware", "ransomware"
]

ALLOWED_LICENSES = {
    "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "MPL-2.0"
}

MAX_REPO_AGE_DAYS_WITHOUT_UPDATE = 540
ACTIVE_REPO_DAYS = 360

def has_alternative(repo, all_repos):
    category = repo.get("category_hint", "")
    repo_id = repo.get("id")
    repo_stars = int(repo.get("stars", 0) or 0)
    repo_topics = set(repo.get("topics", []) or [])
    cutoff = datetime.now(timezone.utc) - timedelta(days=ACTIVE_REPO_DAYS)

    for other in all_repos:
      if other.get("id") == repo_id:
        continue
      if other.get("category_hint", "") != category:
        continue
      updated = parse_dt(other.get("updated_at", ""))
      if not updated or updated < cutoff:
        continue
      other_stars = int(other.get("stars", 0) or 0)
      if other_stars < max(30, int(repo_stars * 0.5)):
        continue
      other_topics = set(other.get("topics", []) or [])
      topic_overlap = len(repo_topics.intersection(other_topics))
      if topic_overlap >= 1 or (not repo_topics and not other_topics):
        return True
    return False

def parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None

def score_repo(repo, all_repos):
    risk = 0
    reasons = []

    text = f"{repo.get('name','')} {repo.get('description','')}".lower()
    for kw in RISKY_KEYWORDS:
        if kw in text:
            risk += 70
            reasons.append(f"keyword:{kw}")
            break

    license_id = repo.get("license", "")
    if license_id and license_id not in ALLOWED_LICENSES:
        risk += 20
        reasons.append(f"license:{license_id}")

    updated = parse_dt(repo.get("updated_at", ""))
    if updated:
        if datetime.now(timezone.utc) - updated > timedelta(days=MAX_REPO_AGE_DAYS_WITHOUT_UPDATE):
            if has_alternative(repo, all_repos):
                risk += 25
                reasons.append("stale_repo_with_alternative")
            else:
                reasons.append("stale_repo_no_alternative")
    else:
        risk += 10
        reasons.append("missing_updated_at")

    stars = int(repo.get("stars", 0) or 0)
    if stars < 50:
        risk += 25
        reasons.append("low_stars")
    elif stars < 100:
        risk += 15
        reasons.append("mid_stars")

    return risk, reasons

def main():
    with open("data/raw_repos.json", "r", encoding="utf-8") as f:
        repos = json.load(f)

    blocked = []
    reviewed = []
    for repo in repos:
        risk, reasons = score_repo(repo, repos)
        repo["risk_score"] = risk
        repo["risk_reasons"] = reasons
        if risk >= 70:
            blocked.append(repo)
        reviewed.append(repo)

    with open("data/raw_repos.json", "w", encoding="utf-8") as f:
        json.dump(reviewed, f, ensure_ascii=False, indent=2)

    with open("data/security_gate_report.json", "w", encoding="utf-8") as f:
        json.dump({
            "total": len(reviewed),
            "blocked": len(blocked),
            "blocked_repos": [
                {"id": r.get("id"), "name": r.get("name"), "risk_score": r.get("risk_score"), "risk_reasons": r.get("risk_reasons")}
                for r in blocked
            ],
        }, f, ensure_ascii=False, indent=2)

    if blocked:
        print(f"Security gate failed: {len(blocked)} repos blocked")
        for repo in blocked[:20]:
            print(f"- {repo.get('id')} risk={repo.get('risk_score')} reasons={repo.get('risk_reasons')}")
        raise SystemExit(1)

    print(f"Security gate passed: {len(reviewed)} repos reviewed")

if __name__ == "__main__":
    main()
