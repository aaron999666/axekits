# ToolBox 30分钟上线速查清单（Cloudflare + Stripe）

使用方式：从上到下打勾执行。

## A. 账号与仓库（3分钟）
- [ ] Cloudflare 账号可登录
- [ ] GitHub 仓库已准备
- [ ] Stripe 账号可登录
- [ ] Google AI Studio / Mimo / DeepSeek API 可申请

## B. Cloudflare 资源（8分钟）
- [ ] 创建 D1：`toolbox-db`
- [ ] 创建 KV：`TOOLBOX_AUTH`、`TOOLBOX_CACHE`
- [ ] 创建 R2：`toolbox-files`
- [ ] 创建 Queues：`billing-queue`、`cleanup-queue`
- [ ] 创建 Analytics Engine dataset：`toolbox_events`
- [ ] 创建 Turnstile（拿到 Site Key / Secret）

## C. Worker 配置（8分钟）
- [ ] 绑定 D1/KV/R2/Queues/ANALYTICS
- [ ] 配置 Variables（APP_ORIGIN、TOOLS_DATA_URL、AI_PROVIDER_ORDER、TURNSTILE_ENFORCE=true 等）
- [ ] 配置 Secrets（JWT_SECRET、STRIPE_SECRET_KEY、STRIPE_WEBHOOK_SECRET、GEMINI/MIMO/DEEPSEEK keys）
- [ ] 确认 Cron Trigger：`0 * * * *`

## D. 页面部署（5分钟）
- [ ] Pages 项目1（主站）：Root=`packages/web`
- [ ] Pages 环境变量：`NEXT_PUBLIC_API_BASE`、`API_BASE`、`NEXT_PUBLIC_TOOLS_DOMAIN`、`NEXT_PUBLIC_SITE_URL`
- [ ] Pages 项目2（工具站）：Root=`tools`
- [ ] 绑定自定义域：主站 + 工具站

## E. Stripe（3分钟）
- [ ] 创建 3 个 Price（Basic/Pro/Pack100）
- [ ] 回填 Worker Variables：`STRIPE_PRICE_*`
- [ ] 配置 webhook：`/api/stripe/webhook`
- [ ] 订阅事件：`checkout.session.completed`、`charge.refunded`

## F. GitHub 自动化（2分钟）
- [ ] 配置 Secrets：`PAT_TOKEN`、`CF_ACCOUNT_ID`、`CF_API_TOKEN`、`CLOUDFLARE_API_TOKEN`、`NEXT_PUBLIC_*`
- [ ] 启用分支保护：`PR Quality Gate / gate` 必须通过

## G. 首次初始化（1分钟）
- [ ] 运行 D1 初始化：`wrangler d1 execute toolbox-db --file=schema.sql --remote`
- [ ] 注册管理员账号
- [ ] 调用 `POST /api/admin/bootstrap` 完成 super_admin 初始化
- [ ] 初始化后更换/清空 `ADMIN_BOOTSTRAP_KEY`

## H. 最终验收（必做）
- [ ] `/api/health` 返回 ok
- [ ] `/tools` 正常展示工具
- [ ] `/account` 可登录并显示积分
- [ ] Stripe 测试支付后积分到账
- [ ] 运行 `Release (Gated)` 通过

---

详细版文档：
- `docs/DEPLOY_CLOUDFLARE_STRIPE_BEGINNER_2026_CN.md`
