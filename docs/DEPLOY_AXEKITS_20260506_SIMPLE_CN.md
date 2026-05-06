# Axekits 最简单部署文档（2026-05-06）

只做必要操作，不讲原理。你按顺序点就行。

---

## 0. 你要先知道（非常重要）

1. **`wrangler.toml` 是本机代码文件**（你要在本机改）。
2. Cloudflare Dashboard 是云端控制台（你在网页里创建资源）。
3. 正确顺序：  
   Cloudflare 创建资源 -> 把资源ID填回本机 `wrangler.toml` -> 推送代码 -> GitHub Actions 部署。

---

## 1. 必备账号与网址

1. Cloudflare 控制台：https://dash.cloudflare.com/
2. GitHub 仓库：https://github.com/aaron999666/axekits
3. Stripe 控制台：https://dashboard.stripe.com/
4. Google Analytics（可选流量监测）：https://analytics.google.com/

---

## 2. Cloudflare 创建资源（一步步点击）

## 2.1 创建 Worker（API）
1. 打开 Cloudflare Dashboard  
2. 左侧点 **Workers & Pages**
3. 点 **Create**
4. 选 **Workers**
5. Worker 名称填：`toolbox-api`
6. 点 **Deploy**

> 这是云端创建，不改代码。

---

## 2.2 创建 D1 数据库
1. 左侧点 **Storage & Databases**
2. 点 **D1 SQL Database**
3. 点 **Create**
4. 名称填：`toolbox-db`
5. 创建后进入数据库详情页，复制 **Database ID**

> 这个 ID 稍后填到本机 `wrangler.toml`。

---

## 2.3 创建 KV（两个）
1. 左侧点 **Storage & Databases**
2. 点 **KV**
3. 创建第1个：`AUTH_KV`
4. 创建第2个：`CACHE_KV`
5. 分别进入详情页，复制两个 **Namespace ID**

> 两个 ID 稍后填到本机 `wrangler.toml`。

---

## 2.4 创建 R2
1. 左侧点 **R2**
2. 点 **Create bucket**
3. 名称填：`toolbox-files`

---

## 2.5 创建 Queues（两个）
1. 左侧点 **Queues**
2. 创建 `billing-queue`
3. 创建 `cleanup-queue`

---

## 2.6 创建 Analytics Engine 数据集
1. 左侧点 **Analytics**
2. 点 **Analytics Engine**
3. 创建 dataset：`toolbox_events`

---

## 2.7 创建 Turnstile
1. 左侧点 **Turnstile**
2. 点 **Add Widget**
3. 域名填：`axekits.com`
4. 创建后复制 **Secret key**

---

## 2.8 创建 Pages（2个）
1. 左侧点 **Workers & Pages**
2. 创建第1个 Pages 项目（主站，名字可填 `axekits-web`）
3. 创建第2个 Pages 项目（工具站，名字填 `toolbox-tools`）

---

## 3. 改本机代码文件（只改这一个）

本机文件：[`packages/worker/wrangler.toml`](/E:/TOOLS/packages/worker/wrangler.toml)

你要改这三类值：

1. D1：
```toml
[[d1_databases]]
database_id = "这里填你刚复制的 D1 Database ID"
```

2. KV：
```toml
[[kv_namespaces]]
binding = "AUTH_KV"
id = "这里填 AUTH_KV Namespace ID"

[[kv_namespaces]]
binding = "CACHE_KV"
id = "这里填 CACHE_KV Namespace ID"
```

3. 你已固定域名（这几行应是下面值）：
```toml
APP_ORIGIN = "https://axekits.com"
TOOLS_DOMAIN = "t.axekits.com"
TOOLS_DATA_URL = "https://raw.githubusercontent.com/aaron999666/axekits/main/data/tools.json"
WORKFLOWS_DATA_URL = "https://raw.githubusercontent.com/aaron999666/axekits/main/data/workflows/index.json"
```

---

## 4. Worker Secrets（在 Cloudflare 网页里配）

路径：Cloudflare -> Workers & Pages -> `toolbox-api` -> **Settings** -> **Variables and Secrets** -> **Add secret**

必须加：
1. `JWT_SECRET`
2. `STRIPE_SECRET_KEY`
3. `STRIPE_WEBHOOK_SECRET`
4. `TURNSTILE_SECRET`
5. `CF_ACCOUNT_ID`
6. `CF_API_TOKEN`

可选：
1. `GEMINI_API_KEY`
2. `MIMO_API_KEY`
3. `DEEPSEEK_API_KEY`

---

## 5. D1 建表（你最关心）

这是**本机执行命令**，不是在网页里写 SQL。

在 `E:\TOOLS` 打开 PowerShell，执行：
```powershell
cd E:\TOOLS
npm run db:init
```

这个命令会把 [`packages/worker/schema.sql`](/E:/TOOLS/packages/worker/schema.sql) 里的全部表创建好。

验证表：
```powershell
cd E:\TOOLS\packages\worker
npx wrangler d1 execute toolbox-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

---

## 6. GitHub Secrets（在 GitHub 网页里配）

路径：GitHub 仓库 -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**

必须加：
1. `PAT_TOKEN`
2. `CLOUDFLARE_API_TOKEN`
3. `CF_ACCOUNT_ID`
4. `NEXT_PUBLIC_API_BASE` = `https://api.axekits.com`
5. `NEXT_PUBLIC_TOOLS_DOMAIN` = `t.axekits.com`
6. `NEXT_PUBLIC_SITE_URL` = `https://axekits.com`
7. `CF_API_TOKEN`
8. `NEXT_PUBLIC_GA_MEASUREMENT_ID`（你要开 Google 监测就填 `G-xxxx`）
9. `CF_PAGES_TOOLS_PROJECT`（填你在 Cloudflare Pages 里工具站项目名；如果你就叫 `toolbox-tools`，就填 `toolbox-tools`）

---

## 7. Stripe（网页操作）

1. 在 Stripe 创建3个价格（Price）：
   - Basic
   - Pro
   - Pack100
2. 把三个 `price_xxx` 填到本机 `wrangler.toml`：
   - `STRIPE_PRICE_BASIC`
   - `STRIPE_PRICE_PRO`
   - `STRIPE_PRICE_PACK_100`
3. 创建 Webhook：
   - URL：`https://api.axekits.com/api/stripe/webhook`
   - 事件：`checkout.session.completed`、`charge.refunded`
4. 把 webhook 签名密钥填到 Worker Secret：`STRIPE_WEBHOOK_SECRET`

---

## 8. 域名绑定（Cloudflare）

1. `axekits.com` 绑定到主站 Pages
2. `t.axekits.com` 绑定到 tools Pages
3. `api.axekits.com` 绑定到 Worker `toolbox-api`

---

## 9. 发布（最简单）

1. 把本机改动推到 GitHub `main`
2. GitHub -> Actions -> **Release (Gated)** -> Run workflow
3. 三个开关都选 `true`：
   - deploy_worker
   - deploy_web
   - deploy_tools

---

## 10. 验收（上线后只看这6个）

1. `https://axekits.com`
2. `https://t.axekits.com`
3. `https://api.axekits.com/api/tools`
4. `https://axekits.com/robots.txt`
5. `https://axekits.com/sitemap.xml`
6. `https://axekits.com/llms.txt`

如果都能打开，部署完成。
