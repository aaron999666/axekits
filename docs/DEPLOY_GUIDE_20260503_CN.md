# ToolBox 部署指导书（2026-05-03，超小白版，Cloudflare + Stripe + GitHub）

> 版本日期：**2026-05-03**  
> 目标：你不需要懂代码，按步骤点页面 + 复制粘贴，就能把项目上线并稳定运行。  
> 本文严格对应当前仓库代码（`E:\TOOLS`）。

---

## 0. 你将得到什么（先看结论）

部署完成后你会有：
1. 主站（Web）：Cloudflare Pages 部署。
2. API（后端）：Cloudflare Workers 部署。
3. 工具静态站：Cloudflare Pages（tools 子站）部署。
4. 数据层：Cloudflare D1 + KV + R2 + Queues + Analytics Engine。
5. 支付：Stripe Checkout + Webhook（积分到账）。
6. 自动运营：GitHub Actions 定时扫描、自动上新、自动定价、自动SEO/GEO、质量门禁。

---

## 1. 官方入口链接（精准）

## 1.1 Cloudflare
1. Cloudflare 总入门：https://developers.cloudflare.com/fundamentals/get-started/
2. 创建 API Token：https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
3. 查 Account ID / Zone ID：https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/
4. Workers Wrangler 配置：https://developers.cloudflare.com/workers/wrangler/configuration/
5. Workers Secrets：https://developers.cloudflare.com/workers/configuration/secrets/
6. D1 入门：https://developers.cloudflare.com/d1/get-started/
7. KV 入门：https://developers.cloudflare.com/kv/get-started/
8. R2 Worker 绑定：https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
9. Queues 入门：https://developers.cloudflare.com/queues/get-started/
10. Cron Triggers：https://developers.cloudflare.com/workers/configuration/cron-triggers/
11. Workers AI 绑定：https://developers.cloudflare.com/workers-ai/configuration/bindings/
12. Analytics Engine 入门：https://developers.cloudflare.com/analytics/analytics-engine/get-started/
13. Pages Git 集成：https://developers.cloudflare.com/pages/configuration/git-integration/
14. Pages 自定义域名：https://developers.cloudflare.com/pages/configuration/custom-domains/

## 1.2 Stripe
1. API Keys：https://docs.stripe.com/keys?locale=en-GB
2. Checkout Sessions 概览：https://docs.stripe.com/payments/checkout-sessions
3. Checkout Sessions API：https://docs.stripe.com/api/checkout/sessions
4. 创建 Checkout Session：https://docs.stripe.com/api/checkout/sessions/create
5. Webhooks：https://docs.stripe.com/webhooks
6. Webhook 签名验证：https://docs.stripe.com/webhooks/signatures

## 1.3 GitHub Actions Secrets
1. Secrets 概念：https://docs.github.com/en/actions/concepts/security/secrets
2. 如何创建并在 Actions 使用：https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-guides/using-secrets-in-github-actions

## 1.4 备用 AI 提供方
1. DeepSeek 文档首页：https://api-docs.deepseek.com/
2. DeepSeek API 说明：https://api-docs.deepseek.com/api/deepseek-api
3. Mimo 控制台（你给的）：https://platform.xiaomimimo.com/console/api-keys
4. Gemini Key（官方）：https://ai.google.dev/

---

## 2. 你必须先准备的账号

1. Cloudflare 账号（必需）
2. Stripe 账号（必需）
3. GitHub 账号 + 你的代码仓库（必需）
4. （可选）Gemini、DeepSeek、Mimo API Key（用于 AI 路由）

---

## 3. 本项目当前真实配置位置（你要知道的）

1. Worker 配置文件：[`packages/worker/wrangler.toml`](/E:/TOOLS/packages/worker/wrangler.toml)
2. Worker 需要的环境变量类型：[`packages/worker/src/types.ts`](/E:/TOOLS/packages/worker/src/types.ts)
3. Stripe 逻辑：[`packages/worker/src/stripe.ts`](/E:/TOOLS/packages/worker/src/stripe.ts)
4. Web 环境变量读取：[`packages/web/lib/config.ts`](/E:/TOOLS/packages/web/lib/config.ts)
5. 发布工作流：[` .github/workflows/release-gated.yml`](/E:/TOOLS/.github/workflows/release-gated.yml)
6. 定时自动化：[` .github/workflows/scanner.yml`](/E:/TOOLS/.github/workflows/scanner.yml)
7. PR 质量门禁：[` .github/workflows/pr-quality-gate.yml`](/E:/TOOLS/.github/workflows/pr-quality-gate.yml)

---

## 4. 绝对关键原则（避免踩坑）

1. **不要**把密钥写进 `wrangler.toml`、代码、或 `*.env` 提交到 Git。
2. 所有敏感值都放在：
   - Cloudflare Worker Secrets（运行时）
   - GitHub Repository Secrets（CI/CD）
3. 你当前项目支持“尽量不用本地 env 文件”，走云端 Secrets 即可。
4. 本地 Windows `next build` 曾遇到 Node24 readlink 异常，代码已做兼容；正式发布以 GitHub Linux 构建门禁为准。

---

## 5. Cloudflare 资源创建（逐步照抄）

## 5.0 Cloudflare 全家桶总表（本项目实际使用）

| 组件 | 是否使用 | 在哪里创建 | 本项目绑定名/名称 | 你需要填到哪里 |
|---|---|---|---|---|
| Workers | 是 | Workers & Pages | `toolbox-api` | `packages/worker/wrangler.toml` `name` |
| Pages（主站） | 是 | Workers & Pages -> Pages | 项目名自定义（建议 `toolbox-web`） | GitHub Action `deploy-web` |
| Pages（工具站） | 是 | Workers & Pages -> Pages | `toolbox-tools` | `npm run deploy:tools` |
| D1 | 是 | Storage & Databases -> D1 | `toolbox-db` | `wrangler.toml` `database_id` |
| KV（认证） | 是 | Storage -> KV | `AUTH_KV` | `wrangler.toml` 第1个 `kv_namespaces.id` |
| KV（缓存） | 是 | Storage -> KV | `CACHE_KV` | `wrangler.toml` 第2个 `kv_namespaces.id` |
| R2 | 是 | Storage -> R2 | `toolbox-files` | `wrangler.toml` `bucket_name` |
| Queues | 是 | Messaging -> Queues | `billing-queue`, `cleanup-queue` | `wrangler.toml` `queues.producers` |
| Analytics Engine | 是（可选） | Analytics -> Analytics Engine | `toolbox_events` | `wrangler.toml` `analytics_engine_datasets` |
| Cron Triggers | 是 | Worker 设置里或 wrangler | `0 * * * *` | `wrangler.toml [triggers]` |
| Workers AI | 是（在 AI 回退链中） | Workers AI | `CF_AI_MODEL` | `wrangler.toml [vars]` + `CF_ACCOUNT_ID/CF_API_TOKEN` |
| Turnstile | 是 | Turnstile | widget 自定义 | `TURNSTILE_SECRET`（Worker Secret） |
| 自定义域名 | 建议 | DNS + Workers/Pages Domains | `api.xxx.com`, `xxx.com`, `t.xxx.com` | Cloudflare Dashboard Domains |

---

## 5.1 创建 Worker
1. 打开 Cloudflare Dashboard -> Workers & Pages。
2. 创建一个 Worker，名称建议：`toolbox-api`（需与 `wrangler.toml` 中 `name` 一致）。

## 5.2 创建 D1
1. 进入 D1 页面，创建数据库，名称：`toolbox-db`。
2. 记下 `database_id`。
3. 填到 [`packages/worker/wrangler.toml`](/E:/TOOLS/packages/worker/wrangler.toml)：
   - `[[d1_databases]].database_id = "YOUR_D1_DATABASE_ID"`

## 5.3 创建 KV（两个）
1. 创建命名空间 `AUTH_KV`
2. 创建命名空间 `CACHE_KV`
3. 记录两个 namespace id，填到 `wrangler.toml` 的两个 `[[kv_namespaces]]`.

## 5.4 创建 R2
1. 创建 bucket：`toolbox-files`
2. 保证 `wrangler.toml` 中 `[[r2_buckets]].bucket_name = "toolbox-files"` 对应一致。

## 5.5 创建 Queues（两个）
1. 创建 `billing-queue`
2. 创建 `cleanup-queue`
3. 对应 `wrangler.toml` 中 `[[queues.producers]]` 保持同名。

## 5.6 创建 Analytics Engine 数据集
1. 创建 dataset：`toolbox_events`
2. 对应 `wrangler.toml`：
   - `[[analytics_engine_datasets]].binding = "ANALYTICS"`
   - `dataset = "toolbox_events"`

## 5.7 创建 Turnstile
1. 创建 widget，拿到：
   - `sitekey`（前端用，可选）
   - `secret key`（后端验证必需）
2. 后端 secret 放 Worker Secret：`TURNSTILE_SECRET`

## 5.8 Workers AI（Cloudflare AI）配置
1. 你不需要单独部署模型，只需要账号有 Workers AI 权限。
2. `wrangler.toml` 里保留：
   - `CF_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct"`（可换）
3. Worker Secrets 里必须有：
   - `CF_ACCOUNT_ID`
   - `CF_API_TOKEN`
4. 如果你把 `AI_PROVIDER_ORDER` 配成 `gemini,cloudflare,mimo,deepseek`，则 cloudflare 会自动作为第二优先级回退。

## 5.9 域名与 DNS（建议标准）
1. 主站：`toolbox.yourdomain.com` -> 绑定到 Pages（web）
2. API：`api.yourdomain.com` -> 绑定到 Worker（toolbox-api）
3. 工具站：`t.yourdomain.com` -> 绑定到 Pages（tools）
4. 证书：Cloudflare 自动管理（保持 Proxy 开启）。

---

---

## 6. Stripe 配置（积分充值闭环）

## 6.1 拿 API Key
1. Stripe Dashboard -> Developers / Workbench -> API Keys。
2. 拿到：
   - `Secret key`（`sk_live...` 或测试 `sk_test...`）

## 6.2 创建商品价格（Price）
1. Stripe 里创建三个 Price（和代码对应）：
   - Basic
   - Pro
   - Pack 100
2. 复制三个 `price_xxx`：
   - `STRIPE_PRICE_BASIC`
   - `STRIPE_PRICE_PRO`
   - `STRIPE_PRICE_PACK_100`

## 6.3 创建 Webhook Endpoint
1. Endpoint URL 填：
   - `https://<你的API域名>/api/stripe/webhook`
2. 订阅事件至少包括：
   - `checkout.session.completed`
   - `charge.refunded`
3. 复制 `Signing secret`（`whsec_...`）给：
   - `STRIPE_WEBHOOK_SECRET`

---

## 7. GitHub Secrets：每个名字、来源、放置位置（最重要）

放置位置：  
GitHub 仓库 -> `Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

## 7.1 CI/CD 必需 Secret（按当前 workflow）
1. `PAT_TOKEN`
   - 来源：GitHub Personal Access Token（有 repo 写权限）
   - 用途：自动提交扫描结果
2. `CLOUDFLARE_API_TOKEN`
   - 来源：Cloudflare API Token（建议权限：Workers、Pages、D1、KV、R2、Queues、Analytics 对应编辑权限）
3. `CF_ACCOUNT_ID`
   - 来源：Cloudflare Account ID 页面
4. `NEXT_PUBLIC_API_BASE`
   - 来源：你正式 API 地址（例如 `https://api.yourdomain.com`）
5. `NEXT_PUBLIC_TOOLS_DOMAIN`
   - 来源：你的 tools 子域名（例如 `t.yourdomain.com`）
6. `NEXT_PUBLIC_SITE_URL`
   - 来源：主站域名（例如 `https://toolbox.yourdomain.com`）
7. `GEMINI_API_KEY`（可选但建议）
8. `CF_API_TOKEN`（scanner/classifier 使用）
9. `GITHUB_TOKEN`
   - GitHub 自动提供；若 workflow 显式需要外部 token，可使用 PAT 或默认 token（看仓库权限策略）

## 7.2 Worker 运行时 Secret（Cloudflare Worker 里配置）
放置位置：  
Cloudflare Dashboard -> Workers & Pages -> `toolbox-api` -> Settings -> Variables and Secrets -> Add -> Secret

必须配置：
1. `JWT_SECRET`（自己生成 32+ 位随机串）
2. `STRIPE_SECRET_KEY`（Stripe secret key）
3. `STRIPE_WEBHOOK_SECRET`（Stripe webhook signing secret）
4. `TURNSTILE_SECRET`（Turnstile secret）
5. `CF_ACCOUNT_ID`（同上）
6. `CF_API_TOKEN`（同上）

可选（AI 回退链）：
1. `GEMINI_API_KEY`
2. `MIMO_API_KEY`
3. `MIMO_API_BASE`（如果 Mimo 文档要求自定义 base url）
4. `DEEPSEEK_API_KEY`
5. `DEEPSEEK_API_BASE`（默认常见是 `https://api.deepseek.com`）

## 7.3 Cloudflare API Token 权限建议（最小可用）
创建位置：Cloudflare -> My Profile -> API Tokens -> Create Token

建议至少包含：
1. Account - Workers Scripts:Edit
2. Account - Workers Routes:Edit（若用路由）
3. Account - D1:Edit
4. Account - Workers KV Storage:Edit
5. Account - R2 Storage:Edit
6. Account - Queues:Edit
7. Account - Analytics Engine:Edit
8. Account - Pages:Edit

如果你不熟悉最小权限，第一次可用官方“Edit Cloudflare Workers”模板后再逐步收敛权限。

---

## 8. `wrangler.toml` 中 vars（非 secret）如何填

文件：[`packages/worker/wrangler.toml`](/E:/TOOLS/packages/worker/wrangler.toml)

你需要改的关键值：
1. `APP_ORIGIN`
   - 填主站 URL（例如 `https://toolbox.yourdomain.com`）
2. `TOOLS_DOMAIN`
   - 填工具域名（例如 `t.yourdomain.com`）
3. `TOOLS_DATA_URL`
   - 填你仓库 `data/tools.json` 的 raw URL
4. `WORKFLOWS_DATA_URL`
   - 填你仓库 `data/workflows/index.json` 的 raw URL
5. `STRIPE_PRICE_BASIC / PRO / PACK_100`
   - 填 Stripe Price ID
6. `ADMIN_BOOTSTRAP_KEY`
   - 填一次性高强度随机串（用于初始化管理员）
7. `TURNSTILE_ENFORCE`
   - 生产建议 `true`
8. `AI_PROVIDER_ORDER`
   - 你当前是：`gemini,cloudflare,mimo,deepseek`
9. `CF_AI_MODEL / GEMINI_MODEL / MIMO_MODEL / DEEPSEEK_MODEL`
   - 根据你的可用模型改

---

## 9. 你问的“这些文件要不要配？”

## 9.1 `site.ts` 要不要配？
文件：[`packages/web/lib/site.ts`](/E:/TOOLS/packages/web/lib/site.ts)  
结论：**一般不用手改**。  
原因：它优先读取 `NEXT_PUBLIC_SITE_URL`（我们在 GitHub Secrets 里配）。  

## 9.2 `llms.txt/route.ts` 要不要配？
结论：当前项目已经改成静态文件自动生成，不再用 route。  
现在是：`packages/web/public/llms.txt`（由脚本生成）。  
脚本：[`scripts/generate_web_seo_assets.py`](/E:/TOOLS/scripts/generate_web_seo_assets.py)

## 9.3 `sitemap.ts` 要不要配？
结论：当前也是静态生成。  
现在是：`packages/web/public/sitemap.xml`（自动生成）。

## 9.4 `robots.ts` 要不要配？
结论：当前也是静态生成。  
现在是：`packages/web/public/robots.txt`（自动生成）。

---

## 10. 自动触发器（你特别关心）

## 10.1 Cloudflare Worker Cron
文件中已配置：[`packages/worker/wrangler.toml`](/E:/TOOLS/packages/worker/wrangler.toml)
- `[triggers]`
- `crons = ["0 * * * *"]`  
含义：每小时触发一次 Worker `scheduled()`。

## 10.2 GitHub Actions 定时任务
文件：[` .github/workflows/scanner.yml`](/E:/TOOLS/.github/workflows/scanner.yml)
1. `0 2 * * *`（每天一次主扫描）
2. `0 */6 * * *`（每6小时健康检查）

## 10.3 Cloudflare 侧触发器总览
1. Worker Cron：每小时触发后端定时任务。
2. Pages Deploy Trigger：来自 GitHub Action `deploy-web` / `deploy-tools`。
3. Stripe Webhook：外部事件触发 `/api/stripe/webhook`。
4. Turnstile 验证：登录/注册流程请求时触发。

---

## 11. 一次性初始化管理员

接口：`POST /api/admin/bootstrap`  
请求头：`x-admin-bootstrap-key: <ADMIN_BOOTSTRAP_KEY>`

操作建议：
1. 部署完成后仅执行一次初始化。
2. 初始化成功后，立刻更换 `ADMIN_BOOTSTRAP_KEY` 或停用该流程（安全）。

---

## 12. 本地命令（可选，懂一点命令再用）

项目根目录 `E:\TOOLS`：
```powershell
# 1) 生成静态 SEO 资产（sitemap/robots/llms/manifest）
python scripts/generate_web_seo_assets.py

# 2) 统一注入所有工具 UI + SEO/GEO
node packages/tool-shell/inject.js tools

# 3) 全量质量检查
python scripts/validate.py
python scripts/ui_consistency_check.py
python scripts/seo_geo_autocheck.py
python scripts/pricing_engine.py
python scripts/billing_policy_check.py
python scripts/payment_points_flow_check.py
python scripts/health_check.py
python scripts/security_gate.py
```

---

## 13. 发布顺序（最稳）

1. 先配置 Cloudflare 全部资源（D1/KV/R2/Queues/Analytics/Turnstile）
2. 配置 Worker secrets + `wrangler.toml` vars
3. 配置 Stripe products/prices/webhook
4. 配置 GitHub Actions secrets
5. 触发 `PR Quality Gate`（必须全绿）
6. 触发 `Release (Gated)`，勾选：
   - deploy_worker = true
   - deploy_web = true
   - deploy_tools = true
7. 部署后手工做一次支付链路测试：
   - 下单充值 -> webhook -> 积分到账 -> 调用付费工具扣积分
8. 观察 24h：
   - health_status
   - security_gate_report
   - pricing_report

---

## 14. 最常见失败与处理（小白救命区）

1. `scanner.py` 报 `GITHUB_TOKEN` 缺失  
   - 说明：GitHub Actions secrets 没配好。
2. Stripe 支付成功但积分没加  
   - 检查 `STRIPE_WEBHOOK_SECRET` 和 webhook endpoint URL 是否一致。
3. 登录失败/注册失败  
   - 检查 `JWT_SECRET`、`TURNSTILE_SECRET`、`TURNSTILE_ENFORCE`。
4. 工具页 UI 不统一  
   - 跑 `node packages/tool-shell/inject.js tools` 再跑 `ui_consistency_check.py`。
5. SEO/GEO 检查失败  
   - 先跑 `generate_web_seo_assets.py`，再跑 `seo_geo_autocheck.py`。

---

## 15. 你现在最小必填清单（复制后打勾）

## 15.1 Cloudflare Dashboard
- [ ] Worker: `toolbox-api`
- [ ] D1: `toolbox-db`
- [ ] KV: `AUTH_KV`, `CACHE_KV`
- [ ] R2: `toolbox-files`
- [ ] Queues: `billing-queue`, `cleanup-queue`
- [ ] Analytics Engine dataset: `toolbox_events`
- [ ] Turnstile widget（拿 secret）
- [ ] Workers AI 可调用（账号权限正常）
- [ ] 主站/API/工具站域名都已绑定
- [ ] DNS 记录已生效（可 `nslookup` 验证）

## 15.2 Stripe
- [ ] API Secret Key
- [ ] 三个 Price ID（Basic/Pro/Pack100）
- [ ] Webhook endpoint + signing secret

## 15.3 GitHub Secrets
- [ ] `PAT_TOKEN`
- [ ] `CLOUDFLARE_API_TOKEN`
- [ ] `CF_ACCOUNT_ID`
- [ ] `NEXT_PUBLIC_API_BASE`
- [ ] `NEXT_PUBLIC_TOOLS_DOMAIN`
- [ ] `NEXT_PUBLIC_SITE_URL`
- [ ] `GEMINI_API_KEY`（可选）
- [ ] `CF_API_TOKEN`（自动化脚本）

## 15.4 Worker Secrets
- [ ] `JWT_SECRET`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `TURNSTILE_SECRET`
- [ ] `CF_ACCOUNT_ID`
- [ ] `CF_API_TOKEN`

---

## 16. 你要求的“不要 env 文件”说明

可以做到：
1. 本地不放 `.env`。
2. 敏感信息全在 Cloudflare Worker Secrets + GitHub Actions Secrets。
3. 非敏感配置放 `wrangler.toml` 的 `[vars]`。

---

## 17. 最后一句话（执行建议）

如果你严格按本文件做，你可以不懂代码也完成上线。  
建议你第一次上线时开一个“测试域名 + Stripe 测试模式”先跑通，再切正式密钥。
