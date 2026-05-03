# ToolBox 小白部署手册（不使用 .env 文件）

最后更新：2026-05-03
适用：Cloudflare 全家桶 + Stripe + GitHub 全托管部署（不使用 Supabase / Vercel）

---

## 0. 你将得到什么
你会完成：
1. 前端站点（Cloudflare Pages）上线
2. API（Cloudflare Workers）上线
3. 数据库 D1、KV、R2、Queues 创建并绑定
4. Stripe 支付全链路可用
5. GitHub 自动扫描/分类/翻译/健康检查定时任务可用
6. SEO + GEO（搜索引擎 + AI 引擎）生效

本手册默认你不写任何 `.env` 文件，全部在控制台配置。

---

## 1. 你需要先准备的账号
1. Cloudflare 账号（必须）
2. GitHub 账号（必须）
3. Stripe 账号（必须）
4. 你的代码仓库（GitHub）

---

## 2. 项目中哪些文件“需要你手动改”

### 2.1 不需要手动改的文件
- `packages/web/app/llms.txt/route.ts`：不需要改。
- `packages/web/app/sitemap.ts`：通常不改。
- `packages/web/app/robots.ts`：通常不改。
- `packages/web/app/manifest.ts`：通常不改。

### 2.2 可能需要改（可选）的文件
- `packages/web/lib/site.ts`
  - 推荐不改代码。
  - 通过 Cloudflare Pages 环境变量 `NEXT_PUBLIC_SITE_URL` 覆盖即可。

### 2.3 必须配置（在控制台，不是改代码）
- Worker 变量（`wrangler.toml` 中列出）
- Worker secrets
- Pages 环境变量
- GitHub Secrets
- Stripe Webhook endpoint 与密钥

---

## 3. Cloudflare 资源创建（第一次必须做）

你可以用 Cloudflare Dashboard 点点点，或者本地 wrangler 命令。小白建议 Dashboard + 少量命令。

### 3.1 创建 D1 数据库
- Cloudflare Dashboard -> Workers & Pages -> D1 -> Create database
- 名称：`toolbox-db`
- 记下：`database_id`

### 3.2 创建 KV
- Dashboard -> Workers & Pages -> KV -> Create namespace
- 创建 2 个：
  - `TOOLBOX_AUTH`
  - `TOOLBOX_CACHE`
- 记下两个 namespace ID

### 3.3 创建 R2
- Dashboard -> R2 -> Create bucket
- 名称：`toolbox-files`

### 3.4 创建 Queues
- Dashboard -> Workers & Pages -> Queues -> Create
- 创建：
  - `billing-queue`
  - `cleanup-queue`

---

## 4. Worker 部署配置（最关键）

Worker 名：`toolbox-api`（见 `packages/worker/wrangler.toml`）

### 4.1 绑定资源
在 Worker 设置里绑定：
1. D1: `DB -> toolbox-db`
2. KV: `AUTH_KV -> TOOLBOX_AUTH`
3. KV: `CACHE_KV -> TOOLBOX_CACHE`
4. R2: `R2 -> toolbox-files`
5. Queue Producer: `BILLING_QUEUE -> billing-queue`
6. Queue Producer: `CLEANUP_QUEUE -> cleanup-queue`

### 4.2 配置 Variables（明文变量）
在 Worker -> Settings -> Variables 添加：
1. `JWT_ISSUER` = `toolbox-edge`（可保留）
2. `APP_ORIGIN` = 你的前端域名，例如 `https://toolbox.example.com`
3. `JWT_EXPIRY_SECONDS` = `900`
4. `FREE_DAILY_LIMIT` = `5`
5. `R2_FILE_TTL_SECONDS` = `86400`
6. `MAX_FILE_SIZE_BYTES` = `52428800`
7. `TOOLS_DOMAIN` = 工具站域名，例如 `t.example.com`
8. `TOOLS_DATA_URL` = 你的工具数据 raw 地址
   - 示例：`https://raw.githubusercontent.com/<你的GitHub用户名或组织>/<仓库名>/main/data/tools.json`
9. `WORKFLOWS_DATA_URL` = 工作流数据 raw 地址
   - 示例：`https://raw.githubusercontent.com/<你的GitHub用户名或组织>/<仓库名>/main/data/workflows/index.json`
10. `STRIPE_PRICE_BASIC` = Stripe Basic 套餐 price_id
11. `STRIPE_PRICE_PRO` = Stripe Pro 套餐 price_id
12. `STRIPE_PRICE_PACK_100` = Stripe 积分包 price_id
13. `TURNSTILE_ENFORCE` = `true`（建议生产开启）

### 4.3 配置 Secrets（密钥）
在 Worker -> Settings -> Variables -> Secrets 添加：
1. `JWT_SECRET`
   - 获取方式：自己生成一个高强度随机字符串
2. `STRIPE_WEBHOOK_SECRET`
   - 获取方式：Stripe Webhook endpoint 页面显示 `whsec_...`
3. `STRIPE_SECRET_KEY`
   - 获取方式：Stripe Developers -> API keys -> Secret key（`sk_...`）
4. `TURNSTILE_SECRET`
   - 获取方式：Cloudflare Turnstile 控制台
5. `CF_ACCOUNT_ID`
   - 获取方式：Cloudflare Dashboard 右侧账户信息
6. `CF_API_TOKEN`
   - 获取方式：Cloudflare My Profile -> API Tokens 创建（有 Workers AI 调用权限）
7. `ADMIN_BOOTSTRAP_KEY`
   - 获取方式：自己生成一次性高强度随机字符串（用于首次 super_admin 初始化）


### 4.5 AI 四路兜底配置（新增）
在 Worker 配置中增加：

Variables：
- `AI_PROVIDER_ORDER` = `gemini,cloudflare,mimo,deepseek`
- `GEMINI_MODEL` = `gemini-1.5-flash`
- `CF_AI_MODEL` = `@cf/meta/llama-3.1-8b-instruct`
- `MIMO_API_BASE` = 你在 Mimo 控制台文档中给出的 API Base URL
- `MIMO_MODEL` = 你账号可用模型名
- `DEEPSEEK_API_BASE` = `https://api.deepseek.com/v1`
- `DEEPSEEK_MODEL` = `deepseek-chat`

Secrets：
- `GEMINI_API_KEY`
- `MIMO_API_KEY`
- `DEEPSEEK_API_KEY`

验证接口（登录后可调用）：
- `GET /api/ai/providers`
  - 可看到 provider 顺序、是否配置成功、使用模型。

### 4.6 Cloudflare Analytics Engine（可观测，建议开启）
- Worker 中已支持 `ANALYTICS` 绑定写事件。
- 在 Cloudflare Dashboard 创建 Analytics Engine dataset：`toolbox_events`
- 在 Worker 绑定 `ANALYTICS -> toolbox_events`
- 作用：记录关键业务事件（登录、注册、健康检查等）用于运营看板。

### 4.4 Worker 定时触发器（Cron Trigger）
代码里已经声明：每小时触发一次（`0 * * * *`）用于清理过期数据。
你仍需确认：
- Worker -> Settings -> Triggers -> Cron Triggers 中存在该条。

---

## 5. D1 初始化（数据库建表）

在本地项目目录执行：
1. `cd packages/worker`
2. `wrangler d1 execute toolbox-db --file=schema.sql --remote`

这一步会创建：
- users
- transactions
- tools_stats
- workflows
- free_usage
- r2_files
- referrals
- stripe_webhook_events

如果你跳过这步，API 会报 SQL 表不存在。

---

## 6. 前端（Cloudflare Pages）部署配置

### 6.1 新建 Pages 项目
- Dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git
- 选择仓库
- Root directory：`packages/web`
- Build command：`npm run build`
- Build output directory：`.next`

> 如果你用 OpenNext 部署流程，也可以按项目脚本走，但小白先用标准 Pages 流程。

### 6.2 Pages 环境变量（Production）
必须添加：
1. `NEXT_PUBLIC_API_BASE` = Worker API 域名
   - 例：`https://toolbox-api.<subdomain>.workers.dev`
2. `NEXT_PUBLIC_TOOLS_DOMAIN` = 工具站域名
   - 例：`t.example.com`
3. `NEXT_PUBLIC_SITE_URL` = 前端主站完整 URL
   - 例：`https://toolbox.example.com`
4. `API_BASE` = 同 `NEXT_PUBLIC_API_BASE`（给服务端渲染使用）

### 6.3 自定义域
- Pages -> Custom domains -> Add
- 建议主站：`toolbox.example.com`

---

## 7. 工具静态站（tools 目录）部署

### 7.1 注入统一工具壳
本地执行：
1. `cd packages/tool-shell`
2. `node inject.js ../../tools`

### 7.2 部署 tools 到 Pages
- 可以新建第二个 Pages 项目，根目录设为 `tools`
- 自定义域建议：`t.example.com`

---

## 8. Stripe 完整配置

### 8.1 创建商品与价格
在 Stripe Dashboard：
1. Product: Basic -> Price: 4.99 USD（月或一次性按你业务）
2. Product: Pro -> Price: 14.99 USD
3. Product: Pack 100 -> Price: 1.99 USD

每个 Price 都有 `price_xxx`，填入 Worker Variables：
- `STRIPE_PRICE_BASIC`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_PACK_100`

### 8.2 创建 Webhook Endpoint
- Stripe -> Developers -> Webhooks -> Add endpoint
- URL：`https://<你的worker域名>/api/stripe/webhook`
- Events：
  - `checkout.session.completed`
  - `charge.refunded`
- 保存后拿到 `Signing secret (whsec_...)`
- 填入 Worker Secret `STRIPE_WEBHOOK_SECRET`

### 8.3 API Key
- Stripe -> Developers -> API keys
- 复制 Secret key (`sk_...`)
- 填入 Worker Secret `STRIPE_SECRET_KEY`

---

## 9. GitHub Actions 自动化配置

### 9.1 本项目的定时任务
文件：`.github/workflows/scanner.yml`
- 每天 02:00 UTC：全量扫描+分类+翻译+健康检查
- 每 6 小时：健康检查
- 手动触发：支持

### 9.2 GitHub Secrets 必配
仓库 -> Settings -> Secrets and variables -> Actions -> New repository secret
1. `PAT_TOKEN`
   - 获取：GitHub -> Settings -> Developer settings -> Personal access tokens
   - 权限：repo 内容读写
2. `GEMINI_API_KEY`
   - 获取：Google AI Studio
3. `CF_API_TOKEN`
   - 获取：Cloudflare API Tokens
4. `CF_ACCOUNT_ID`
   - 获取：Cloudflare Dashboard

---

## 10. SEO + GEO 是否还要配置

### 10.1 `site.ts` 要不要改？
- 推荐：不改代码。
- 只需要 Pages 配 `NEXT_PUBLIC_SITE_URL` 即可。
- 不配时会回退到默认 URL（不利于正式收录）。

### 10.2 `llms.txt/route.ts` 要不要改？
- 一般不改。
- 只要 `SITE_URL` 正确，就会输出正确 canonical 链接。

### 10.3 `sitemap.ts` 要不要改？
- 一般不改。
- 只要 `API_BASE` 指向正确 Worker API 即可。

### 10.4 `robots.ts` 要不要改？
- 一般不改。
- 生产时会自动指向 `SITE_URL/sitemap.xml`。

---

## 11. 上线后验收（按顺序点开检查）

### 11.1 页面可访问
1. `/`
2. `/tools`
3. `/pricing`
4. `/tools/<任意工具id>`（例如 `/tools/json-format`）

### 11.2 SEO 文件
1. `/robots.txt`
2. `/sitemap.xml`
3. `/llms.txt`
4. 页面源码里有 JSON-LD（FAQ、ItemList、SoftwareApplication、OfferCatalog）

### 11.3 API 健康
1. `GET /api/health` 返回 `status: ok`
2. `GET /api/tools` 返回工具列表 JSON

### 11.4 支付链路
1. 登录后调用 checkout API
2. Stripe 支付成功
3. Worker webhook 日志正常
4. D1 用户积分增加

### 11.5 定时任务
1. GitHub Actions 的 scanner workflow 正常跑完
2. Worker Cron 每小时运行（看 Worker Logs）

---

## 12. 常见报错与排查

### 12.1 `Tool not found`
- 通常是 `TOOLS_DATA_URL` 填错或 `data/tools.json` 不可访问。

### 12.2 `Invalid or expired token`
- 检查 Cookie 是否带上。
- 检查 `JWT_SECRET` 是否改动导致旧 token 失效。

### 12.3 Stripe webhook 400
- `STRIPE_WEBHOOK_SECRET` 填错。
- endpoint URL 写错（少了 `/api/stripe/webhook`）。

### 12.4 页面有数据但 sitemap 没工具详情
- 检查 Pages 的 `API_BASE` 环境变量是否配置。

### 12.5 GitHub Action 推送失败
- `PAT_TOKEN` 权限不足或过期。

---

## 13. 你最终只需要记住的“配置入口地图”

1. Cloudflare Worker Variables/Secrets：
- 作用：API 运行配置
- 入口：Workers & Pages -> 你的 Worker -> Settings -> Variables

2. Cloudflare Worker Triggers：
- 作用：定时任务
- 入口：Worker -> Settings -> Triggers

3. Cloudflare Pages Variables：
- 作用：前端请求 API、站点 URL
- 入口：Pages -> 你的项目 -> Settings -> Environment variables

4. GitHub Secrets：
- 作用：自动化脚本所需密钥
- 入口：Repo -> Settings -> Secrets and variables -> Actions

5. Stripe Webhook + API Keys：
- 作用：支付回调与下单
- 入口：Stripe Dashboard -> Developers

---

## 14. 关键结论（给小白）
- 你不需要 `.env` 文件。
- 你只需要在 Cloudflare、GitHub、Stripe 的控制台按本手册配置变量和密钥。
- `site.ts`、`llms.txt/route.ts`、`sitemap.ts` 基本都不用改代码，靠控制台变量即可生效。




### 管理员初始化（新增）
- Worker Variable: ADMIN_BOOTSTRAP_KEY 设置一个超长随机字符串。
- 先注册普通账号后，调用 POST /api/admin/bootstrap，请求头 x-admin-bootstrap-key 填该值，body 填管理员邮箱。
- 成功后立即更换或清空 ADMIN_BOOTSTRAP_KEY。


## 15. 强制发布门禁（已配置）

新增工作流：`.github/workflows/release-gated.yml`

发布顺序被强制为：
1. 自动统一工具 UI（inject）
2. UI 一致性检查（ui_consistency_check）
3. 数据校验（validate）
4. 安全门禁（security_gate）
5. 健康检查（health_check）
6. 通过后才允许部署 worker/web/tools

这意味着：
- 新增工具 UI 不合规，仍可提交代码；
- 但发布时会先自动改造并校验，不通过就不会上线。

### 15.1 运行方式
- GitHub -> Actions -> `Release (Gated)` -> Run workflow
- 可选择是否部署 worker/web/tools

### 15.2 需要新增的 GitHub Secrets
- `CLOUDFLARE_API_TOKEN`（用于 deploy）
- `CF_ACCOUNT_ID`
- `NEXT_PUBLIC_API_BASE`
- `NEXT_PUBLIC_TOOLS_DOMAIN`
- `NEXT_PUBLIC_SITE_URL`


### 分支保护（强烈建议，实际应视为必须）
- 配置指南见：`docs/GITHUB_BRANCH_PROTECTION_CN.md`
- 目标：`main` 分支必须通过 `PR Quality Gate / gate` 才能合并。

