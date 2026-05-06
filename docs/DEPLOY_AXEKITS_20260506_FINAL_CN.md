# Axekits 一次成功部署手册（2026-05-06，Cloudflare + Stripe + GitHub）

> 目标：按这份文档从 0 到上线，避免之前所有踩坑（冲突、重复触发、费用失控、部署失败）。
>  
> 适用仓库：`https://github.com/aaron999666/axekits`  
> 生产域名：`axekits.com`（单域模式，不需要 `t.axekits.com`）

---

## 0. 先确认当前代码状态（你不用改代码）

已在主分支包含以下关键修复：
1. 单域模式：工具走 `/tools-app/*`，不依赖 tools 子站。
2. CI 不再自动 `git pull --rebase && git push` 回写 main（已去掉冲突源）。
3. 发布流程会先构建 web，再部署。
4. Worker 部署前自动补建 Queue/R2（避免首次部署报错）。
5. 自动化有预算/阈值守卫、总量控制、替代机制。

---

## 1. 你需要准备的账号

1. GitHub 账号（仓库所有者权限）
2. Cloudflare 账号（同一个 Account 下管理域名、Workers、D1、KV、R2、Queues）
3. Stripe 账号（收款）
4. Google 账号（Gemini API 免费额度）

---

## 2. Cloudflare 资源创建（一步一步）

### 2.1 进入控制台
- 打开：[Cloudflare Dashboard](https://dash.cloudflare.com/)
- 确认左上角是正确账号（你现在是 `1301509936@qq.com` 这个账号）

### 2.2 D1 数据库
1. 左侧：`Workers & Pages`
2. 点 `D1`（或 Storage 里的 D1）
3. `Create database`
4. 名称填：`toolbox-db`
5. 记下 `Database ID`

### 2.3 KV 命名空间
1. `Workers & Pages` -> `KV`
2. 创建两个 namespace：
 - `TOOLBOX_AUTH`
 - `TOOLBOX_CACHE`
3. 各自记下 `Namespace ID`

### 2.4 R2
1. `R2` -> `Create bucket`
2. 名称：`toolbox-files`

### 2.5 Queues
1. `Workers & Pages` -> `Queues`
2. 创建：
 - `billing-queue`
 - `cleanup-queue`

### 2.6 （可选）Analytics Engine
1. `Workers & Pages` -> Analytics Engine
2. Dataset 名称：`toolbox_events`

---

## 3. 域名与路由（axekits.com）

1. 在 Cloudflare DNS 确认 `axekits.com` 已接入（橙云开启）。
2. Web 项目绑定主域：`axekits.com`
3. API 推荐绑定二级域：`api.axekits.com`
4. 后续 `NEXT_PUBLIC_API_BASE` 必须填 API 实际访问地址。

---

## 4. GitHub Secrets（最关键，缺一个都可能失败）

打开：
- 仓库 -> `Settings` -> `Secrets and variables` -> `Actions` -> `Repository secrets`

### 4.1 必填 Secrets
1. `PAT_TOKEN`
2. `CLOUDFLARE_API_TOKEN`
3. `CF_ACCOUNT_ID`
4. `NEXT_PUBLIC_API_BASE`（例：`https://api.axekits.com`）
5. `NEXT_PUBLIC_SITE_URL`（固定：`https://axekits.com`）
6. `NEXT_PUBLIC_GA_MEASUREMENT_ID`（你的是 `G-8YP4P171C8`）

### 4.2 自动化开关
1. `ENABLE_AUTOMATION`
 - `true`：每天自动跑 scanner
 - 不设/非 true：不自动跑

### 4.3 AI（仅免费通道）
1. `GEMINI_API_KEY`
2. `CF_API_TOKEN`
3. `CF_ACCOUNT_ID`（已在必填里）

> 说明：当前自动流程只用 Gemini + Cloudflare AI，不会自动调用其他 AI 提供商。

---

## 5. Worker 配置（Cloudflare 侧）

配置文件位置：
- [wrangler.toml](E:/TOOLS/packages/worker/wrangler.toml)

你需要把 `YOUR_*` 改成真实值（D1/KV IDs）：
1. `database_id = "YOUR_D1_DATABASE_ID"`
2. `id = "YOUR_AUTH_KV_ID"`
3. `id = "YOUR_CACHE_KV_ID"`

### 5.1 Worker Secrets（敏感信息）
在 Worker 项目里配置：
1. `JWT_SECRET`
2. `STRIPE_SECRET_KEY`
3. `STRIPE_WEBHOOK_SECRET`
4. `TURNSTILE_SECRET`
5. `ADMIN_BOOTSTRAP_KEY`

### 5.2 Worker vars（非敏感）
确保这些值正确：
1. `APP_ORIGIN = "https://axekits.com"`
2. `STRIPE_PRICE_BASIC`
3. `STRIPE_PRICE_PRO`
4. `STRIPE_PRICE_PACK_100`

---

## 6. 初始化数据库表（D1）

表结构文件：
- [schema.sql](E:/TOOLS/packages/worker/schema.sql)

首次部署前确保执行过一次初始化（远程）：
1. 在本地仓库根目录打开 PowerShell
2. 执行：
```powershell
cd E:\TOOLS\packages\worker
npx wrangler d1 execute toolbox-db --file=schema.sql --remote
```

---

## 7. Stripe 配置（收款与积分）

1. 在 Stripe 创建 3 个 Price：
 - Basic
 - Pro
 - Pack 100
2. 把 3 个 `price_xxx` 填到 Worker vars：
 - `STRIPE_PRICE_BASIC`
 - `STRIPE_PRICE_PRO`
 - `STRIPE_PRICE_PACK_100`
3. 配置 Webhook：
 - URL：`https://api.axekits.com/api/stripe/webhook`（或你的 worker 实际域名）
 - 至少启用事件：`checkout.session.completed`

---

## 8. 正式发布（唯一推荐入口）

不要手工分散部署，统一用 GitHub Actions：

1. 打开：`Actions` -> `Release (Gated)`
2. 点 `Run workflow`（不要点旧 run 的 Re-run）
3. 参数：
 - `deploy_worker = true`
 - `deploy_web = true`
 - `deploy_tools = false`（单域模式）
4. 选择分支：`main`

---

## 9. 自动化策略（防超额）

自动化工作流：
- [scanner.yml](E:/TOOLS/.github/workflows/scanner.yml)

当前策略：
1. 每天只跑一次（UTC `02:30`）
2. 必须 `ENABLE_AUTOMATION=true` 才会运行
3. 免费额度守卫：
 - GitHub Actions 分钟估算上限
 - GitHub API 请求估算上限
 - Cloudflare Worker 操作估算上限
4. 工具总量控制 + 动态配额 + 退役替代机制
 - 配置文件：[catalog_control.json](E:/TOOLS/data/catalog_control.json)

预算守卫配置：
- [automation_budget.json](E:/TOOLS/data/automation_budget.json)

---

## 10. 你之前遇到的错误，对应处理

### 10.1 `Queue "billing-queue" does not exist`
原因：Cloudflare Queue 未建。  
现状：发布流程已自动尝试创建（`|| true`）。

### 10.2 `Could not find compiled Open Next config`
原因：deploy 前没 build。  
现状：`deploy:web` 已强制先 build 再 deploy。

### 10.3 `Project not found`（tools deploy）
原因：单域模式不需要 tools pages 项目。  
现状：`deploy_tools=false` 默认即可，且流程已防呆。

### 10.4 大量 `auto-normalize tool ui shell` 触发
原因：旧 workflow 自动 push 形成回路。  
现状：已改为不自动回写 main，触发源已清理。

---

## 11. 上线后 10 分钟验收清单（必须做）

1. 打开 `https://axekits.com` 首页正常
2. 打开任一工具详情页，iframe 来源为同域 `/tools-app/...`
3. `https://api.axekits.com/api/health` 返回 `status=ok`
4. 注册/登录成功
5. Stripe 下单成功
6. 积分到账
7. 使用付费工具后积分扣减
8. 再次刷新余额接口正常

---

## 12. 历史自动任务需要管吗？

1. 历史 runs 不影响现在运行，不用处理也不会再次执行。
2. 若想清爽可以删历史记录（可选，不影响功能）。
3. 重点是看“当前 workflow 文件”和“当前 Run workflow 是否选 main 最新提交”。

---

## 13. 失败时只看这三个地方

1. `Release (Gated)` 的失败步骤红字第一行  
2. Cloudflare 资源是否存在（D1/KV/R2/Queues）  
3. Secrets 是否填全（尤其 `CF_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`、`NEXT_PUBLIC_API_BASE`）

---

## 14. 一句话运行原则（避免再踩坑）

只走 `Release (Gated)`，只从 `main` 的 `Run workflow` 触发；  
不再手工 rebase/push 自动产物到 main，不再开 tools 子站部署。

