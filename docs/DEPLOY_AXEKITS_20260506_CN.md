# Axekits.com 一键部署手册（2026-05-06，Cloudflare 全家桶 + Stripe）

> 域名已固定：`axekits.com`  
> 目标：小白照着点就能上线。  
> 包含：Cloudflare 全家桶配置、D1 建库建表、GitHub Secrets、Stripe、触发器、验收清单。

---

## 1. 你的线上域名规划（已按此写入代码）

1. 主站：`https://axekits.com`
2. API：`https://api.axekits.com`
3. 工具站：`https://t.axekits.com`

你当前代码默认值已经改好：
1. [`packages/worker/wrangler.toml`](/E:/TOOLS/packages/worker/wrangler.toml)
2. [`packages/web/lib/site.ts`](/E:/TOOLS/packages/web/lib/site.ts)
3. [`packages/web/lib/config.ts`](/E:/TOOLS/packages/web/lib/config.ts)
4. [`scripts/generate_web_seo_assets.py`](/E:/TOOLS/scripts/generate_web_seo_assets.py)

---

## 2. Cloudflare 全家桶：必须创建的资源

在 Cloudflare Dashboard 创建：
1. Worker：`toolbox-api`
2. Pages（主站）：建议项目名 `axekits-web`
3. Pages（工具站）：`toolbox-tools`（当前脚本名）
4. D1：`toolbox-db`
5. KV：`AUTH_KV`
6. KV：`CACHE_KV`
7. R2：`toolbox-files`
8. Queues：`billing-queue`
9. Queues：`cleanup-queue`
10. Analytics Engine dataset：`toolbox_events`
11. Turnstile：创建 widget，拿 `secret`

---

## 3. wrangler.toml 必填项（复制对照）

文件：[`packages/worker/wrangler.toml`](/E:/TOOLS/packages/worker/wrangler.toml)

你要改的值：
1. `database_id = "YOUR_D1_DATABASE_ID"` -> 你的 D1 ID
2. `id = "YOUR_AUTH_KV_ID"` -> AUTH_KV 的 namespace id
3. `id = "YOUR_CACHE_KV_ID"` -> CACHE_KV 的 namespace id
4. `APP_ORIGIN = "https://axekits.com"`（已改）
5. `TOOLS_DOMAIN = "t.axekits.com"`（已改）
6. `TOOLS_DATA_URL = "https://raw.githubusercontent.com/aaron999666/axekits/main/data/tools.json"`（已改）
7. `WORKFLOWS_DATA_URL = "https://raw.githubusercontent.com/aaron999666/axekits/main/data/workflows/index.json"`（已改）
8. `STRIPE_PRICE_BASIC/PRO/PACK_100` -> 你的 Stripe price id

---

## 4. D1 建库建表（你特别要的）

## 4.1 创建数据库
1. Cloudflare -> D1 -> Create database
2. 名称填：`toolbox-db`
3. 复制 database id 到 `wrangler.toml`

## 4.2 执行建表 SQL（最简单，直接用现成文件）

在项目根目录 `E:\TOOLS` 执行：
```powershell
cd E:\TOOLS
npm run db:init
```

这个命令会执行文件：
- [`packages/worker/schema.sql`](/E:/TOOLS/packages/worker/schema.sql)

会创建这些核心表：
1. `users`
2. `transactions`
3. `tools_stats`
4. `workflows`
5. `free_usage`
6. `r2_files`
7. `referrals`
8. `stripe_webhook_events`
9. `admin_users`
10. `admin_audit_logs`

以及对应索引（性能优化）：
1. `idx_transactions_user_time`
2. `idx_free_usage_user_date`
3. `idx_r2_files_user`
4. `idx_r2_files_expires`
5. `idx_tools_stats_clicks`
6. `idx_workflows_use`
7. `idx_admin_audit_time`

## 4.3 验证表是否创建成功
```powershell
cd E:\TOOLS\packages\worker
npx wrangler d1 execute toolbox-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

---

## 5. Worker Secrets（必须配）

位置：Cloudflare -> Workers & Pages -> `toolbox-api` -> Settings -> Variables and Secrets -> Add Secret

必填：
1. `JWT_SECRET`
2. `STRIPE_SECRET_KEY`
3. `STRIPE_WEBHOOK_SECRET`
4. `TURNSTILE_SECRET`
5. `CF_ACCOUNT_ID`
6. `CF_API_TOKEN`

可选（AI 回退链）：
1. `GEMINI_API_KEY`
2. `MIMO_API_KEY`
3. `MIMO_API_BASE`
4. `DEEPSEEK_API_KEY`
5. `DEEPSEEK_API_BASE`

---

## 6. GitHub Secrets（部署用）

位置：GitHub 仓库 -> Settings -> Secrets and variables -> Actions

必填：
1. `PAT_TOKEN`
2. `CLOUDFLARE_API_TOKEN`
3. `CF_ACCOUNT_ID`
4. `NEXT_PUBLIC_API_BASE` = `https://api.axekits.com`
5. `NEXT_PUBLIC_TOOLS_DOMAIN` = `t.axekits.com`
6. `NEXT_PUBLIC_SITE_URL` = `https://axekits.com`
7. `CF_API_TOKEN`
8. `GEMINI_API_KEY`（可选）

---

## 7. Stripe 必配（充值积分）

1. 创建 3 个价格（Price），拿到：
   - `STRIPE_PRICE_BASIC`
   - `STRIPE_PRICE_PRO`
   - `STRIPE_PRICE_PACK_100`
2. 创建 webhook endpoint：
   - URL：`https://api.axekits.com/api/stripe/webhook`
   - 事件：`checkout.session.completed`、`charge.refunded`
3. 把 webhook signing secret 配到 Worker Secret：`STRIPE_WEBHOOK_SECRET`

---

## 8. 域名绑定（Cloudflare）

1. `axekits.com` -> 绑定 Web Pages 项目
2. `t.axekits.com` -> 绑定 tools Pages 项目
3. `api.axekits.com` -> 绑定 Worker `toolbox-api`

---

## 9. 自动触发器（别漏）

1. Worker Cron（每小时）：
   - `wrangler.toml` 里已是 `0 * * * *`
2. GitHub 定时：
   - `.github/workflows/scanner.yml` 已配置

---

## 10. 一次上线命令（本地）

```powershell
cd E:\TOOLS
python scripts/generate_web_seo_assets.py
node packages/tool-shell/inject.js tools
python scripts/validate.py
python scripts/ui_consistency_check.py
python scripts/seo_geo_autocheck.py
npm run db:init
```

---

## 11. 发布（GitHub Actions）

1. 进入 Actions -> `Release (Gated)`
2. 点 Run workflow
3. 三个选项都选 true：
   - deploy_worker
   - deploy_web
   - deploy_tools

---

## 12. 上线后验收（必须做）

1. 打开 `https://axekits.com`
2. 打开 `https://t.axekits.com`
3. 打开 `https://api.axekits.com/api/tools`
4. Stripe 测试支付一笔，检查积分是否到账
5. 调用一个付费工具，检查是否扣积分
6. 检查 `robots/sitemap/llms`：
   - `https://axekits.com/robots.txt`
   - `https://axekits.com/sitemap.xml`
   - `https://axekits.com/llms.txt`

---

## 13. 常见报错速查

1. `D1 execute failed`
   - `database_id` 没填对
2. `webhook signature invalid`
   - `STRIPE_WEBHOOK_SECRET` 错
3. `401/403 on auth`
   - `JWT_SECRET` 或 Turnstile 配置错误
4. `tools not loading`
   - `TOOLS_DATA_URL` / `WORKFLOWS_DATA_URL` 地址不对

