# ToolBox 全面改造蓝图（Cloudflare + Stripe + Git）

## 1. 诊断结论（现状）
- 架构方向正确，但存在工程化硬伤：占位 URL 未替换、Web 中间件与路由模型冲突、前端页面有语法错误、认证编码实现不标准。
- UI 已有雏形，但 Web 与工具 iframe 壳样式 token 未统一，维护成本会随工具数量上升。
- Stripe 与计费链路已接入，但需要补强幂等、防重放、配置分层与审计能力。

## 2. 五个专家视角改造目标

### 技术专家
- 单仓统一规范：`packages/web`、`packages/worker`、`packages/tool-shell` 共享设计 token 与 API 契约。
- 配置外置化：所有环境差异走 Wrangler `vars/secrets`，代码中禁止硬编码业务域名和数据源。
- 可维护性优先：复用头部/导航组件，减少重复 UI 模板。

### 安全专家
- JWT 标准化：Base64URL 编码、严格 issuer 校验、短时效 + 撤销列表。
- 网关默认安全：CSP、XFO、nosniff、Referrer-Policy、Permissions-Policy。
- 输入校验：登录/注册基本格式校验，后续补充限速与行为风控。

### 网络专家
- 统一边缘入口：Cloudflare Worker 为唯一 API 出口，Cloudflare Pages 托管前端。
- CORS 精确白名单：使用 `APP_ORIGIN`，杜绝由 issuer 字段推导源站。
- 数据分发稳定化：`TOOLS_DATA_URL`、`WORKFLOWS_DATA_URL` 可配置并支持缓存。

### 股票投资大师（经营质量视角）
- 关键经营指标产品化：ARPU、付费转化率、免费额度转化率、退款率、工具毛利。
- 先做“现金流友好”功能：定价页转化漏斗、失败支付恢复、低成本获客（SEO 工具页）。
- 强化可持续护城河：统一 UX + AI workflow 能力 + 极低 infra 成本。

### 运营专家
- GitOps 周期化：工具扫描、健康检查、翻译、发布全自动。
- SLA 面板：工具可用率、接口延迟、支付成功率、队列积压量。
- 变更治理：分阶段灰度发布 + 回滚策略。

## 3. 仅用 Git + Stripe + Cloudflare 的目标架构
- GitHub：代码、CI、数据源（tools/workflows JSON）
- Cloudflare Pages：Web 站点
- Cloudflare Workers：API、Auth、Billing、AI 编排、Webhook
- Cloudflare D1/KV/R2/Queues：状态、缓存、文件、异步任务
- Stripe：支付、订阅、Webhook 对账

## 4. 分阶段落地（建议）
1. Phase A（已开始）
- 修复运行阻断与安全基线：JWT、CORS、中间件、安全响应头、配置去硬编码。
- 统一 Web 头部与工具壳基础视觉变量。
2. Phase B
- 建立统一 design tokens（web + tool-shell + tool iframe 三端一致）。
- Stripe webhook 幂等表与失败补偿任务。
3. Phase C
- 经营分析看板：D1 聚合报表 + 管理 API。
- 自动化压测与安全扫描接入 GitHub Actions。
4. Phase D
- 运营自动化：异常告警、定价实验、转化率 A/B。

## 5. 本次已落地改造（代码层）
- Worker：JWT Base64URL 标准化，注册/登录邮箱格式校验。
- Worker：CORS 改为 `APP_ORIGIN`，并增加默认安全响应头。
- Worker：工具/工作流数据源改为环境变量（去掉 `YOUR_ORG` 硬编码）。
- Web：移除错误的 locale rewrite 中间件，改为安全头中间件。
- Web：抽取统一 `SiteHeader`，消除首页/工具页/价格页重复 UI 代码。
- Web：修复 `tools/page.tsx` 语法错误。
- Tool Shell：统一到与 Web 对齐的设计 token（色板、字体、边框风格）。

## 6. 下一步优先级
1. 修复 `next build` 的 `EISDIR` 构建异常并补齐 CI build 步骤。
2. Stripe webhook 幂等（event_id 去重）与审计追踪。
3. 统一工具 iframe 的 CSS token 注入机制（自动化脚本 + 校验）。
4. 加入运营指标 API 与仪表盘页面。
