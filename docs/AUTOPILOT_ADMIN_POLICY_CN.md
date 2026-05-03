# 自动上线与后台运营总方案（含 Star 门槛与供应链风控）

更新时间：2026-05-03

## 1. 你关心的问题直接结论

### 1.1 GitHub star 要不要限制？
要限制，但要按工具类别分层，不建议一刀切。

当前已落地默认门槛：
- dev-assistant >= 100
- image-visual >= 120
- document-convert >= 150
- daily-calc >= 80

可在 CI 环境变量中调整：
- `MIN_STARS_DEV_ASSISTANT`
- `MIN_STARS_IMAGE_VISUAL`
- `MIN_STARS_DOCUMENT_CONVERT`
- `MIN_STARS_DAILY_CALC`

### 1.2 上游仓库更新能否及时同步到你产品？
可以。当前流水线每天自动扫描并更新；你也可手动触发 GitHub Action 立即刷新。

### 1.3 怎么防注入病毒/恶意代码？
已加入“安全门禁脚本 + 高风险拦截”。
- 新增：`scripts/security_gate.py`
- 扫描关键词、许可证、更新活跃度、低星风险
- 风险过高直接阻断自动发布

---

## 2. 已落地能力清单

### 2.1 后台管理员权限（RBAC）
数据库新增：
- `admin_users`
- `admin_audit_logs`

角色：
- super_admin
- ops_admin
- finance_admin
- viewer

### 2.2 管理员 API（Worker）
- `POST /api/admin/bootstrap`：首次创建 super_admin（一次性）
- `GET /api/admin/overview`：运营总览
- `GET /api/admin/audit`：审计日志
- `POST /api/admin/tools/:id`：隔离/恢复工具（quarantine/restore）

### 2.3 审计与追责
所有后台关键操作写入 `admin_audit_logs`。

### 2.4 AI 四路兜底（免费优先）
顺序：Gemini -> Cloudflare -> Mimo -> DeepSeek -> 规则兜底
返回字段 `provider` 可用于看板统计。

### 2.5 自动运营
- GitHub Actions 每天全量扫描
- 每 6 小时健康检查
- Worker 每小时清理过期文件

---

## 3. 风险控制策略（上线工具）

### 3.1 供应链准入规则
1. 必须开源许可（推荐 MIT/Apache/BSD/ISC/MPL）
2. 必须有持续更新（默认 540 天内有更新）
3. 满足类别 star 门槛
4. 命中恶意关键词直接阻断

### 3.2 自动阻断机制
`security_gate.py` 风险分 >= 70 直接 fail CI，不发布。
输出 `data/security_gate_report.json` 供运营复核。

### 3.3 发布分级
- 低风险：自动入库
- 中风险：运营复核后入库
- 高风险：自动拦截

---

## 4. 首次管理员初始化（必须做）

1. 先注册一个普通用户（你的管理员邮箱）
2. 调用：`POST /api/admin/bootstrap`
3. 请求头带：`x-admin-bootstrap-key: <ADMIN_BOOTSTRAP_KEY>`
4. body：`{"email":"你的管理员邮箱"}`

注意：
- 仅在 `admin_users` 为空时可成功
- 完成后建议立刻更换/移除 `ADMIN_BOOTSTRAP_KEY`

---

## 5. 推荐运营节奏

### 每日
- 看 `admin/overview`
- 看 `security_gate_report.json`
- 看 webhook 成功率

### 每周
- 调整各类别 star 门槛
- 复盘被拦截仓库误报
- 更新恶意关键词列表

### 每月
- 清理低质量工具
- 调整积分策略与价格包

---

## 6. 文件变更索引

- `packages/worker/schema.sql`
- `packages/worker/src/index.ts`
- `packages/worker/src/types.ts`
- `packages/worker/src/ai.ts`
- `packages/worker/wrangler.toml`
- `.github/workflows/scanner.yml`
- `scripts/scanner.py`
- `scripts/security_gate.py`

---

## 7. 你问的最终建议（star 与风险平衡）

最佳实践是“三层门”而不是单一 star：
1. Star 门槛（过滤明显低可信）
2. 活跃度门槛（过滤僵尸仓库）
3. 风险门槛（恶意关键词、许可证、异常特征）

这样既能及时吸收高质量更新，又能把供应链风险控制在可运营范围内。
