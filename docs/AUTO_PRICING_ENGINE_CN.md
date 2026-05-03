# 自动定价引擎说明（面向 200+ 工具）

更新时间：2026-05-03

## 1. 目标
在工具规模扩大到 200+ 时，自动完成：
1. 免费/付费判定
2. 积分数量设置
3. 结果回写 `data/tools.json`
4. 门禁校验并自动阻断异常定价

## 2. 入口文件
- 规则配置：`data/pricing_rules.json`
- 引擎脚本：`scripts/pricing_engine.py`
- 报告输出：`data/pricing_report.json`

## 3. 核心逻辑

### 3.1 复杂度评分
每个工具会计算 complexity：
- 分类基准分（category_base_points）
- 命中 premium 关键词加分
- 星标高的工具加分（代表价值/稳定性）
- 命中 always_free 关键词减分

### 3.2 免费工具目标比例
- 使用 `free_ratio_target`（默认 25%）
- 优先把命中 always_free 关键词的工具纳入免费
- 不足部分按最低复杂度补齐

### 3.3 付费积分
- complexity 映射为积分，自动限制在 `min_paid_points`~`max_paid_points`
- 避免出现极端高价/低价

## 4. 门禁接入
已接入：
- `scanner.yml`（自动扫描链）
- `pr-quality-gate.yml`（PR 门禁）
- `release-gated.yml`（发布门禁）

执行顺序：
1. `pricing_engine.py`
2. `billing_policy_check.py`
3. `validate.py`
4. 其余安全/健康/SEO门禁

## 5. 你如何调控策略（不改代码）
只改 `data/pricing_rules.json`：
1. `free_ratio_target`：免费比例
2. `category_base_points`：分类基准价
3. `premium_keywords`：高价值关键词
4. `always_free_keywords`：永久免费关键词
5. `min_paid_points` / `max_paid_points`：价格范围

## 6. 业务建议
1. 免费比例建议 20%~35%，用于拉新。
2. 高频基础工具优先免费（JSON/Base64/URL/计数类）。
3. 图片/PDF/批处理类保持付费，以支撑 ARPU。
4. 每周根据支付转化率微调规则。

## 7. 当前实测结果（30 工具）
- 免费：8
- 付费：22
- 免费主要集中在 dev-assistant 轻量工具

结论：逻辑已自动化，可扩展到 200+ 工具并保持可解释、可运营。
