# 自动发现需求与自动上新（小白版）

本项目已经支持自动流程：`发现需求 -> 评分排序 -> 生成上新队列`。

## 1. 脚本在哪里
- 需求发现脚本：`scripts/demand_discovery.py`
- 参数配置：`data/demand_sources.json`
- 输出候选池：`data/demand_candidates.json`
- 输出上新队列：`data/auto_launch_queue.json`

## 2. 需求从哪里来
- 外部信号：
  - `data/raw_repos.json`（GitHub 扫描生态热度）
  - `data/competitor_benchmark.json`（竞品缺口）
- 内部信号（可选，有文件就自动用）：
  - `data/internal_search_terms.json`
  - `data/internal_failed_requests.json`
  - `data/tool_search_log.json`

## 3. 如何评分
总分公式（脚本已内置）：
- `需求分 = 热度 + 增长代理 + 商业意图 + 供给缺口 + 能力匹配 - 风险惩罚`

权重在 `data/demand_sources.json` 里可调。

## 4. 怎么自动上新
- 候选需求会生成 `tool_id` 和 `category`，进入 `data/auto_launch_queue.json`
- 命中高风险词（如攻击类关键词）会自动标记 `manual_review`，不自动上线
- 非风险候选标记 `auto_candidate`，可进入自动生成工具流程

## 5. 工作流触发点
已经接入：
- `.github/workflows/scanner.yml`
- `.github/workflows/pr-quality-gate.yml`
- `.github/workflows/release-gated.yml`

## 6. 你只需要做什么
1. 每周看一次 `data/auto_launch_queue.json`
2. 调整 `data/demand_sources.json` 的权重（运营调参）
3. 高风险候选人工确认
