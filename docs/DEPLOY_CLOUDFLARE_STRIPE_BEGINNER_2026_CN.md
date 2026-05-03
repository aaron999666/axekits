# ToolBox 一键小白部署手册（全新）

版本：2026-05-03
适用范围：仅使用 Cloudflare 全家桶 + Stripe + GitHub
不使用：Supabase、Vercel、本地 `.env` 文件

---

## 0. 部署结果目标
你完成后将获得：
1. 主站（Cloudflare Pages）
2. 工具站（Cloudflare Pages）
3. API（Cloudflare Workers）
4. 数据层（D1 + KV + R2 + Queues）
5. 安全层（Turnstile + WAF）
6. AI 层（Gemini + Cloudflare + Mimo + DeepSeek 自动降级）
7. 自动运营（扫描、竞品对标、风控、UI 自动改造、门禁发布）

---

## 1. 你要准备的账号
1. Cloudflare（必需）
2. GitHub（必需）
3. Stripe（必需）
4. Google AI Studio（Gemini API）
5. Mimo API 控制台
6. DeepSeek API

---

## 2. 第一步：Cloudflare 资源创建（控制台）

### 2.1 D1
- 路径：Cloudflare Dashboard -> Workers & Pages -> D1 -> Create
- 名称：`toolbox-db`
- 记下：`database_id`

### 2.2 KV
- 路径：Workers & Pages -> KV -> Create namespace
- 创建：
  - `TOOLBOX_AUTH`
  - `TOOLBOX_CACHE`
- 记下两个 namespace id

### 2.3 R2
- 路径：R2 -> Create bucket
- 名称：`toolbox-files`

### 2.4 Queues
- 路径：Workers & Pages -> Queues -> Create
- 创建：
  - `billing-queue`
  - `cleanup-queue`

### 2.5 Analytics Engine（建议开启）
- 路径：Analytics -> Analytics Engine -> Create dataset
- 名称：`toolbox_events`

### 2.6 Turnstile
- 路径：Security -> Turnstile -> Add widget
- 记下：Site Key / Secret Key

---

## 3. 第二步：Worker 配置（最关键）

Worker 项目路径：`packages/worker`
Worker 名：`toolbox-api`

### 3.1 绑定（Bindings）
在 Worker Settings -> Bindings 配：
1. D1: `DB -> toolbox-db`
2. KV: `AUTH_KV -> TOOLBOX_AUTH`
3. KV: `CACHE_KV -> TOOLBOX_CACHE`
4. R2: `R2 -> toolbox-files`
5. Queue Producer: `BILLING_QUEUE -> billing-queue`
6. Queue Producer: `CLEANUP_QUEUE -> cleanup-queue`
7. Analytics Engine: `ANALYTICS -> toolbox_events`

### 3.2 Variables（明文）
Worker Settings -> Variables 添加：
1. `JWT_ISSUER` = `toolbox-edge`
2. `APP_ORIGIN` = `https://你的主站域名`
3. `JWT_EXPIRY_SECONDS` = `900`
4. `FREE_DAILY_LIMIT` = `5`
5. `R2_FILE_TTL_SECONDS` = `86400`
6. `MAX_FILE_SIZE_BYTES` = `52428800`
7. `TOOLS_DOMAIN` = `你的工具站域名`（例如 `t.example.com`）
8. `TOOLS_DATA_URL` = `https://raw.githubusercontent.com/<owner>/<repo>/main/data/tools.json`
9. `WORKFLOWS_DATA_URL` = `https://raw.githubusercontent.com/<owner>/<repo>/main/data/workflows/index.json`
10. `STRIPE_PRICE_BASIC` = Stripe price id
11. `STRIPE_PRICE_PRO` = Stripe price id
12. `STRIPE_PRICE_PACK_100` = Stripe price id
13. `AI_PROVIDER_ORDER` = `gemini,cloudflare,mimo,deepseek`
14. `CF_AI_MODEL` = `@cf/meta/llama-3.1-8b-instruct`
15. `GEMINI_MODEL` = `gemini-1.5-flash`
16. `MIMO_API_BASE` = Mimo 文档提供的 base URL
17. `MIMO_MODEL` = 你账号可用模型
18. `DEEPSEEK_API_BASE` = `https://api.deepseek.com/v1`
19. `DEEPSEEK_MODEL` = `deepseek-chat`
20. `ADMIN_BOOTSTRAP_KEY` = 一次性超长随机字符串
21. `TURNSTILE_ENFORCE` = `true`

### 3.3 Secrets（密钥）
Worker Settings -> Secrets 添加：
1. `JWT_SECRET`（自己生成）
2. `STRIPE_WEBHOOK_SECRET`（Stripe Webhook 页面）
3. `STRIPE_SECRET_KEY`（Stripe API keys）
4. `TURNSTILE_SECRET`（Cloudflare Turnstile）
5. `CF_ACCOUNT_ID`（Cloudflare 账户页）
6. `CF_API_TOKEN`（Cloudflare API Token，含 Workers AI 权限）
7. `GEMINI_API_KEY`（Google AI Studio）
8. `MIMO_API_KEY`（Mimo 控制台）
9. `DEEPSEEK_API_KEY`（DeepSeek 控制台）

### 3.4 Cron Trigger
- 在 Worker -> Triggers 确认存在：`0 * * * *`
- 作用：每小时清理任务

---

## 4. 第三步：数据库初始化（必须）

本地执行（一次）：
```powershell
cd packages/worker
wrangler d1 execute toolbox-db --file=schema.sql --remote
```

---

## 5. 第四步：Pages 配置

### 5.1 主站（packages/web）
- 新建 Pages 项目，连接 GitHub 仓库
- Root directory: `packages/web`
- Build command: `npm run build`
- Output: `.next`

Pages 环境变量（Production）：
1. `NEXT_PUBLIC_API_BASE` = `https://<worker域名>`
2. `API_BASE` = 同上
3. `NEXT_PUBLIC_TOOLS_DOMAIN` = `t.example.com`
4. `NEXT_PUBLIC_SITE_URL` = `https://主站域名`

### 5.2 工具站（tools）
- 新建第二个 Pages 项目
- Root directory: `tools`
- 发布域名：`t.example.com`

---

## 6. 第五步：Stripe 配置

1. 创建 3 个价格：Basic/Pro/Pack100
2. 把对应 `price_xxx` 填回 Worker Variables
3. 创建 Webhook endpoint：
   - URL: `https://<worker域名>/api/stripe/webhook`
   - 事件：`checkout.session.completed`, `charge.refunded`
4. 把 `whsec_...` 填 `STRIPE_WEBHOOK_SECRET`

---

## 7. 第六步：GitHub 自动化配置

### 7.1 Secrets
仓库 -> Settings -> Secrets and variables -> Actions：
1. `PAT_TOKEN`
2. `CF_ACCOUNT_ID`
3. `CF_API_TOKEN`
4. `CLOUDFLARE_API_TOKEN`
5. `NEXT_PUBLIC_API_BASE`
6. `NEXT_PUBLIC_TOOLS_DOMAIN`
7. `NEXT_PUBLIC_SITE_URL`
8. `GEMINI_API_KEY`

### 7.2 已内置工作流
1. `scanner.yml`：自动扫描/竞品对标/风控/更新
2. `ui-autofix.yml`：自动改造不一致工具 UI
3. `pr-quality-gate.yml`：PR 门禁
4. `release-gated.yml`：发布门禁与部署

---

## 8. 第七步：管理员初始化

1. 先在前台注册一个管理员邮箱账号
2. 调用：`POST /api/admin/bootstrap`
3. Header：`x-admin-bootstrap-key: <ADMIN_BOOTSTRAP_KEY>`
4. Body：`{"email":"你的管理员邮箱"}`
5. 成功后立即更换或删除 `ADMIN_BOOTSTRAP_KEY`

---

## 9. 第八步：分支保护（必须）

GitHub -> Settings -> Branches -> Add rule：
- 分支：`main`
- Require pull request before merge
- Require status checks
- 必选检查：`PR Quality Gate / gate`
- Require up to date before merge
- Do not allow bypass

---

## 10. 上线验收清单（按顺序）

### 10.1 页面
- `/`
- `/tools`
- `/pricing`
- `/account`

### 10.2 SEO/GEO
- `/robots.txt`
- `/sitemap.xml`
- `/llms.txt`

### 10.3 API
- `/api/health`
- `/api/tools`
- `/api/auth/me`（登录后）
- `/api/ai/providers`（登录后）
- `/api/admin/overview`（管理员）

### 10.4 支付
- Stripe 测试支付 -> 积分到账 -> 会员中心可见

### 10.5 自动化
- 手动触发 `PR Quality Gate`
- 手动触发 `Release (Gated)`

---

## 11. 常见问题

1. 403 Turnstile
- 检查 `TURNSTILE_ENFORCE=true` 时前端是否传 `turnstileToken`

2. 无工具数据
- 检查 `TOOLS_DATA_URL` 是否可访问

3. webhook 失败
- 检查 `STRIPE_WEBHOOK_SECRET`

4. 发布失败
- 看 `release-gated.yml` 哪个门禁失败（UI/安全/健康）

---

## 12. 一句话总结
你不需要任何本地 `.env`，只要按本手册在 Cloudflare/GitHub/Stripe 控制台逐项配置，就能把项目稳定跑起来，并且具备自动运营与风险门禁能力。
