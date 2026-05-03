# 付费扣积分与免费工具完整方案（含自动 SEO/GEO）

更新时间：2026-05-03

## 1. 计费模型（已落地）

### 1.1 工具计费字段
- 字段：`points_cost`
- 规则：
  - `0` = 免费工具
  - `>0` = 付费工具（按次扣积分）

### 1.2 请求行为
接口：`POST /api/tools/:id`
- 免费工具（`points_cost=0`）：
  - 无需登录即可使用
  - 返回 `billing.mode=free`
- 付费工具（`points_cost>0`）：
  - 需要登录
  - 自动扣积分（优先余额，余额不足走免费额度）
  - 返回 `billing.mode=points`

### 1.3 扣分顺序
1. 用户余额足够 -> 直接扣积分（D1 原子更新）
2. 余额不足 -> 检查每日免费额度（`FREE_DAILY_LIMIT`）
3. 免费额度也不足 -> 返回余额不足

### 1.4 支付入账
- Stripe webhook 事件：`checkout.session.completed`
- 用户积分自动增加
- 已有幂等防重（避免重复入账）

## 2. 不同工具如何定价（运营建议）

### 2.1 定价分层
- 免费层：品牌引流工具（如 JSON、URL、文本计数）
- 低价层（1pt）：高频轻量工具
- 中价层（2-3pt）：图像处理、PDF合并、较高资源消耗工具
- 高价层（>=4pt）：重 AI / 批量任务 / 高耗时任务

### 2.2 当前状态
- 本仓库当前 30 个工具均为付费（`points_cost>0`）。
- 若要设置免费工具，只需把对应工具 `points_cost` 改为 `0`。

## 3. 运营后台闭环

### 3.1 用户与会员
- 注册/登录
- 查看余额与免费次数
- 支付后余额可见

### 3.2 管理员
- `admin/overview` 看板
- `admin/audit` 审计
- 工具隔离/恢复（风控）

## 4. 新增工具是否自动 SEO/GEO（答案：是）

### 4.1 自动 SEO
新增工具写入 `data/tools.json` 后：
- `sitemap.ts` 自动拉取工具列表并生成详情页 sitemap
- `tools/[id]/page.tsx` 动态 metadata 自动生效
- `SoftwareApplication` 结构化数据自动生成

### 4.2 自动 GEO
- middleware 读取 Cloudflare 地理头（国家/地区/城市）
- 响应头与 cookie 自动注入
- 新增工具页天然继承该链路

## 5. 自动化门禁（已接入）

1. `billing_policy_check.py`：校验工具计费规则
2. `payment_points_flow_check.py`：校验支付与扣积分关键代码路径
3. `seo_geo_autocheck.py`：校验新增工具自动 SEO/GEO 链路
4. 以上已接入 PR/Release 门禁

## 6. 上线前关键测试项

1. 免费工具（points_cost=0）访问不登录可用
2. 付费工具未登录返回 401
3. 付费工具余额充足时扣分成功
4. 余额不足时走免费额度
5. 免费额度耗尽后返回余额不足
6. Stripe 支付后余额增加
7. 新增工具后自动出现在 sitemap 与工具详情 metadata

---

结论：
- 计费、支付、扣分、会员显示、后台审计、SEO/GEO 自动化已形成完整闭环。
