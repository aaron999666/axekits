# ToolBox 部署指南

> 小白零遗漏版本请优先阅读：`docs/DEPLOY_BEGINNER_ZERO_ENV_CN.md`（不依赖 `.env` 文件，全部控制台配置）。

## 前置条件

- Node.js 20+
- Cloudflare 账号（免费版即可，Workers 需 $5/月付费计划）
- GitHub 账号
- Stripe 账号（用于支付）
- Google AI Studio API Key（Gemini 免费版）

## 一、Cloudflare 资源初始化

```bash
# 1. 安装 wrangler
npm install -g wrangler
wrangler login

# 2. 创建 D1 数据库
wrangler d1 create toolbox-db
# 记录输出的 database_id，填入 packages/worker/wrangler.toml

# 3. 初始化数据库
cd packages/worker
wrangler d1 execute toolbox-db --file=schema.sql --remote

# 4. 创建 KV 命名空间
wrangler kv namespace create "TOOLBOX_AUTH"
wrangler kv namespace create "TOOLBOX_CACHE"
# 记录输出的 id，填入 packages/worker/wrangler.toml

# 5. 创建 R2 存储桶
wrangler r2 bucket create toolbox-files

# 6. 创建 Queues
wrangler queues create billing-queue
wrangler queues create cleanup-queue
```

## 二、Worker API 部署

```bash
cd packages/worker

# 设置 Secrets（敏感信息，不要写在配置文件中）
wrangler secret put JWT_SECRET
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put TURNSTILE_SECRET
wrangler secret put CF_API_TOKEN
wrangler secret put CF_ACCOUNT_ID

# 部署
wrangler deploy
```

## 三、单域工具部署（axekits.com）

```bash
# 注入 UI 壳到所有工具
cd packages/tool-shell
node inject.js ../../tools

# 工具会在 web build 前自动同步到 packages/web/public/tools-app
# 无需单独部署 tools 子站
```

## 四、Next.js 壳站部署

```bash
cd packages/web

# 安装依赖
npm install

# 设置环境变量
# NEXT_PUBLIC_API_BASE=https://your-worker.workers.dev
# NEXT_PUBLIC_TOOLS_BASE_PATH=/tools-app

# 部署到 Cloudflare Pages
npx @opennextjs/cloudflare deploy
```

## 五、GitHub 配置

### Secrets 配置

| Secret | 用途 |
|--------|------|
| `PAT_TOKEN` | 推送工具数据到仓库 |
| `GEMINI_API_KEY` | AI 分类与翻译 |
| `CF_API_TOKEN` | Workers AI 分类 |
| `CF_ACCOUNT_ID` | Cloudflare 账号 ID |

### Stripe 配置

1. 创建 3 个产品：Basic ($4.99), Pro ($14.99), Pack 100 ($1.99)
2. 设置 Webhook 指向 `https://your-worker.workers.dev/api/stripe/webhook`
3. 监听事件：`checkout.session.completed`, `charge.refunded`

### Cloudflare 安全配置

1. **WAF Rate Limiting Rules**（在 Dashboard 中配置）：
   - API 通用：100 req/60s
   - 登录：10 req/60s
   - R2 上传：20 req/60s

2. **Turnstile**：创建 Site Key + Secret Key

3. **SSL/TLS**：设为 Full (Strict)

## 六、月度成本

| 服务 | 费用 |
|------|------|
| Workers Paid | $5/月 |
| D1 | 免费 |
| KV | 免费 |
| R2 | 免费（<10GB） |
| Pages | 免费 |
| Queues | 免费 |
| Workers AI | 免费 |
| Gemini 免费版 | 免费 |
| **总计** | **$5/月** |
