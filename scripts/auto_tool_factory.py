import json
import os
import re
from datetime import datetime, timezone

TOOLS_FILE = "data/tools.json"
QUEUE_FILE = "data/auto_launch_queue.json"
OUT_REPORT = "data/auto_launch_report.json"
TOOLS_ROOT = "tools"
CATALOG_CONTROL_FILE = "data/catalog_control.json"

MAX_AUTO_PER_RUN = int(os.getenv("AUTO_TOOL_MAX_PER_RUN", "6"))
DAILY_AUTO_LAUNCH_LIMIT = int(os.getenv("AUTO_TOOL_DAILY_LIMIT", "10"))
STATE_FILE = "data/auto_launch_state.json"


def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def title_from_keyword(keyword):
    parts = [p for p in re.split(r"[^a-zA-Z0-9]+", keyword) if p]
    return " ".join(p.capitalize() for p in parts) or "Auto Tool"


def zh_name_from_keyword(keyword):
    # Keep deterministic and explicit for ops; translator workflow can refine later.
    return f"{keyword} 助手"


def build_html(tool_id, name, keyword):
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{name} - ToolBox</title>
  <style>
    *{{margin:0;padding:0;box-sizing:border-box;}}
    body{{font-family:'IBM Plex Sans','Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding-top:56px;}}
    .container{{max-width:1120px;margin:0 auto;padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:20px;}}
    .panel{{background:#111c34;border:1px solid #2b3f69;border-radius:14px;padding:16px;}}
    h3{{margin-bottom:10px;color:#ff9a6b;font-size:13px;letter-spacing:.5px;text-transform:uppercase;}}
    textarea{{width:100%;min-height:300px;background:#0f1b31;color:#ebf2ff;border:1px solid #2b3f69;border-radius:12px;padding:12px;resize:vertical;}}
    .actions{{display:flex;gap:10px;justify-content:center;margin:14px 0 0;}}
    button{{border:none;border-radius:12px;padding:10px 16px;cursor:pointer;font-weight:700;background:linear-gradient(120deg,#ff7a45,#ffb066);color:#1b120a;}}
    button.secondary{{background:linear-gradient(120deg,#1a2846,#21355a);color:#ebf2ff;border:1px solid #2b3f69;}}
    .tips{{font-size:12px;color:#99abd1;margin-top:8px;}}
  </style>
</head>
<body>
  <div class="container">
    <div class="panel">
      <h3>Input</h3>
      <textarea id="input" placeholder="输入内容，执行 {keyword} 相关处理..."></textarea>
      <div class="tips">此工具由自动上新流水线生成，后续可按真实需求迭代为专用版本。</div>
    </div>
    <div class="panel">
      <h3>Output</h3>
      <textarea id="output" readonly placeholder="结果会显示在这里"></textarea>
    </div>
  </div>
  <div class="actions">
    <button onclick="runTool()">Run</button>
    <button class="secondary" onclick="copyOutput()">Copy</button>
    <button class="secondary" onclick="clearAll()">Clear</button>
  </div>
  <script>
    function runTool(){{
      var input = document.getElementById('input').value || '';
      var lines = input.split(/\\r?\\n/).filter(Boolean);
      var result = [];
      result.push('Keyword: {keyword}');
      result.push('Chars: ' + input.length);
      result.push('Lines: ' + lines.length);
      result.push('Words: ' + (input.trim() ? input.trim().split(/\\s+/).length : 0));
      result.push('');
      result.push('Normalized Output:');
      result.push(input.trim());
      document.getElementById('output').value = result.join('\\n');
      window.toolbox && window.toolbox.complete({{ action:'run', keyword:'{keyword}', chars: input.length }});
    }}
    function copyOutput(){{
      navigator.clipboard.writeText(document.getElementById('output').value || '');
    }}
    function clearAll(){{
      document.getElementById('input').value='';
      document.getElementById('output').value='';
    }}
  </script>
  <script src="/bridge.js" data-tool-id="{tool_id}"><\\/script>
</body>
</html>
"""


def is_active_tool(tool):
    if bool(tool.get("retired")):
        return False
    return str(tool.get("health_status", "healthy")) != "down"


def resolve_catalog_caps(total_tools):
    cfg = load_json(CATALOG_CONTROL_FILE, {})
    default_caps = cfg.get("default_caps", {}) or {}
    max_auto = int(default_caps.get("auto_launch_per_run", MAX_AUTO_PER_RUN))
    daily_limit = int(default_caps.get("daily_new_launch_limit", DAILY_AUTO_LAUNCH_LIMIT))
    max_active_tools = int(cfg.get("max_active_tools", 200))

    for tier in cfg.get("catalog_tiers", []) or []:
        lo = int(tier.get("min_total_tools", 0))
        hi = int(tier.get("max_total_tools", 10**9))
        if lo <= total_tools <= hi:
            max_auto = int(tier.get("auto_launch_per_run", max_auto))
            daily_limit = int(tier.get("daily_new_launch_limit", daily_limit))
            break

    return {
        "max_auto_per_run": max(1, max_auto),
        "daily_auto_launch_limit": max(1, daily_limit),
        "max_active_tools": max(1, max_active_tools),
        "replacement": cfg.get("replacement", {}) or {},
    }


def pick_retire_candidates(tools, slots, replacement_cfg):
    if slots <= 0:
        return []
    active = [t for t in tools if is_active_tool(t)]
    candidates = []
    min_stars_to_keep = int(replacement_cfg.get("min_stars_to_keep", 50))
    prefer_auto = bool(replacement_cfg.get("prefer_auto_generated", True))
    for t in active:
        stars = int(t.get("stars", 0) or 0)
        tags = [str(x).lower() for x in (t.get("tags") or [])]
        is_auto = ("auto-generated" in tags) or str(t.get("id", "")).startswith("auto-")
        if stars >= min_stars_to_keep and not is_auto:
            continue
        score = (
            0 if (prefer_auto and is_auto) else 1,
            stars,
            int(t.get("points_cost", 0) or 0),
            str(t.get("last_checked", "")),
            str(t.get("id", "")),
        )
        candidates.append((score, t))
    candidates.sort(key=lambda x: x[0])
    return [t for _, t in candidates[:slots]]


def retire_tools(tools, retire_list):
    retired = []
    now_iso = datetime.now(timezone.utc).isoformat()
    for t in retire_list:
        t["retired"] = True
        t["retired_at"] = now_iso
        t["retire_reason"] = "catalog_replacement"
        t["health_status"] = "down"
        retired.append(str(t.get("id", "")))
    return retired


def main():
    tools = load_json(TOOLS_FILE, [])
    queue_obj = load_json(QUEUE_FILE, {"queue": []})
    queue = queue_obj.get("queue", [])

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    state = load_json(STATE_FILE, {"date": today, "launched_today": 0})
    if state.get("date") != today:
        state = {"date": today, "launched_today": 0}
    launched_today = int(state.get("launched_today", 0) or 0)

    total_tools = len(tools)
    caps = resolve_catalog_caps(total_tools)
    effective_max_auto_per_run = min(MAX_AUTO_PER_RUN, caps["max_auto_per_run"])
    effective_daily_limit = min(DAILY_AUTO_LAUNCH_LIMIT, caps["daily_auto_launch_limit"])
    max_active_tools = caps["max_active_tools"]

    existing_ids = {str(t.get("id", "")).strip().lower() for t in tools}
    created = []
    skipped = []
    processed = 0

    for item in queue:
        if processed >= effective_max_auto_per_run:
            break
        if launched_today + len(created) >= effective_daily_limit:
            break
        tool_id = str(item.get("tool_id", "")).strip().lower()
        keyword = str(item.get("keyword", "")).strip().lower()
        category = str(item.get("category", "dev-assistant")).strip()
        launch_mode = str(item.get("launch_mode", "manual_review")).strip()

        if not tool_id or not keyword:
            skipped.append({"tool_id": tool_id, "reason": "invalid_item"})
            continue
        if launch_mode != "auto_candidate":
            skipped.append({"tool_id": tool_id, "reason": "manual_review"})
            continue
        if tool_id in existing_ids:
            skipped.append({"tool_id": tool_id, "reason": "already_exists"})
            continue

        name = title_from_keyword(keyword)
        name_zh = zh_name_from_keyword(keyword)
        points_cost = 1 if item.get("suggested_points_mode") == "paid_candidate" else 0

        tool_dir = os.path.join(TOOLS_ROOT, category, tool_id)
        os.makedirs(tool_dir, exist_ok=True)
        html_path = os.path.join(tool_dir, "index.html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(build_html(tool_id, name, keyword))

        tools.append({
            "id": tool_id,
            "name": name,
            "name_zh": name_zh,
            "description": f"Auto-generated utility for '{keyword}' demand signal.",
            "description_zh": f"基于“{keyword}”需求信号自动生成的工具。",
            "category": category,
            "tags": [keyword, "auto-generated", "demand-driven", "utility"],
            "demo_url": "",
            "repo_url": "",
            "stars": 0,
            "points_cost": points_cost,
            "self_hosted": True,
            "tool_type": "html",
            "health_status": "healthy",
            "last_checked": "",
        })
        existing_ids.add(tool_id)
        created.append({
            "tool_id": tool_id,
            "category": category,
            "keyword": keyword,
            "points_cost": points_cost,
            "path": html_path.replace("\\", "/"),
        })
        processed += 1

    active_count = sum(1 for t in tools if is_active_tool(t))
    overflow = max(0, active_count - max_active_tools)
    retired_ids = []
    if overflow > 0 and bool(caps["replacement"].get("enabled", True)):
        max_replacements = int(caps["replacement"].get("max_replacements_per_run", 10))
        slots = min(overflow, max_replacements)
        retire_list = pick_retire_candidates(tools, slots, caps["replacement"])
        retired_ids = retire_tools(tools, retire_list)

    save_json(TOOLS_FILE, tools)
    state["launched_today"] = launched_today + len(created)
    save_json(STATE_FILE, state)
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "max_auto_per_run": effective_max_auto_per_run,
        "daily_auto_launch_limit": effective_daily_limit,
        "max_active_tools": max_active_tools,
        "active_tools_after_run": sum(1 for t in tools if is_active_tool(t)),
        "launched_today_after_run": state["launched_today"],
        "created_count": len(created),
        "retired_count": len(retired_ids),
        "retired_tool_ids": retired_ids,
        "skipped_count": len(skipped),
        "created": created,
        "skipped": skipped[:200],
    }
    save_json(OUT_REPORT, report)
    print(f"Auto tool factory finished. Created={len(created)}, Skipped={len(skipped)}")


if __name__ == "__main__":
    main()
