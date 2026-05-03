# AxeKits - AI 驱动的智能工具工作台

> 基于 Cloudflare 全家桶 + Stripe + GitOps + AI 的全自动开源工具聚合平台（不依赖 Supabase / Vercel）

---

## 一、项目愿景

构建一个**零维护**的工具箱平台。利用 AI 实现工具的发现、分类与本地化，通过纯积分制实现商业变现，并利用边缘技术提供极速体验。

### 核心差异化

| 竞品 | 我们的优势 |
|------|-----------|
| AlternativeTo / Product Hunt | ✅ **一键在线使用**（非跳转链接） |
| TinyWow / WebUtils | ✅ **AI 编排工作流**（工具链自动串联） |
| iLovePDF | ✅ **中文本地化** + **积分制** |

---

## 二、技术架构

### 2.1 全局架构

```
用户浏览器
  │
  ├── Next.js 壳站 (Cloudflare Pages)
  ├── Cmd+K 全局搜索 (Fuse.js)
  └── 自托管工具 (同源 iframe)
        │
        ▼ Cloudflare Edge
  ┌─────────────────────────────────────┐
  │  Cloudflare CDN + WAF + Turnstile   │
  └─────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────────────┐
  │           Cloudflare Workers (API)               │
  │  /api/auth  JWT+KV    /api/tools D1扣费        │
  │  /api/stripe Webhook  /api/ai Workers AI       │
  │  /api/r2 文件中转     /api/proxy               │
  └─────────────────────────────────────────────────┘
        │
        ├── D1 (用户/交易/统计)
        ├── Workers KV (JWT撤销/缓存)
        ├── R2 (文件中转 24h清理)
        └── Queues (异步任务)
        │
        ▼ GitHub (GitOps)
  ┌─────────────────────────────────────────────────┐
  │  GitHub Actions (每日 Cron)                      │
  │  爬虫 → AI分类 → 翻译 → 健康检查 → 部署        │
  └─────────────────────────────────────────────────┘
```

### 2.2 核心技术决策

| 决策 | 方案 | 理由 |
|------|------|------|
| **工具托管** | 自托管纯前端工具 | 第三方网站 X-Frame-Options 阻止 iframe 嵌入 |
| **扣费一致性** | D1 `UPDATE RETURNING` 原子操作 | JWT 无状态导致并发扣分不一致 |
| **前端框架** | Next.js 15 + OpenNext 适配器 | next-on-pages 已废弃 |
| **AI 分类** | Workers AI 优先 + Gemini 备用 | 适配免费额度限制 |
| **异步处理** | Cloudflare Queues | 替代不稳定的 waitUntil |
| **启动成本** | $5/月（仅 Workers Paid） | 其余全部使用免费额度 |

---

## 三、功能清单

### 3.1 自托管工具（30 个）

**开发助手 (20 个)**
- JSON 格式化 / Base64 编解码 / 哈希计算
- URL 编解码 / HTML 格式化 / CSS 压缩 / JS 压缩
- Markdown 预览 / 正则测试 / JWT 解码
- 文本对比 / 文本计数 / 密码生成 / UUID 生成
- Lorem Ipsum / 时间戳转换 / 颜色转换 / Emoji 搜索
- 单位转换 / 时区转换

**图像视觉 (6 个)**
- 图片压缩 / 图片缩放 / 图片格式转换
- 图片水印 / SVG 优化 / QR 码生成

**文档转换 (1 个)**
- 图片转 PDF

**日常计算 (3 个)**
- 科学计算器 / 百分比计算 / 年龄计算

### 3.2 积分系统

```
免费层：每日 5 次工具使用
付费层：
  ├── Basic: $4.99/月 = 500 积分
  ├── Pro: $14.99/月 = 2000 积分
  └── Pack: $1.99 = 100 积分（永不过期）
```

### 3.3 AI 编排工作流

```
用户输入："压缩图片并加水印"
  │
  ▼ Workers AI 意图识别
{ steps: [image-compress, image-watermark], total_points: 3 }
  │
  ▼ 自动串联执行
压缩 → 水印 → 生成分享链接
```

---

## 四、数据模型

### D1 Schema

```sql
-- users: 用户表
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  points_balance INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- transactions: 交易流水
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('purchase','consumption','bonus','refund')),
  points_amount INTEGER NOT NULL,
  tool_id TEXT,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- tools_stats: 工具统计
CREATE TABLE tools_stats (
  tool_id TEXT PRIMARY KEY,
  click_count INTEGER NOT NULL DEFAULT 0,
  health_status TEXT NOT NULL DEFAULT 'unknown'
);

-- workflows: 工作流模板
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  steps TEXT NOT NULL,
  total_points INTEGER NOT NULL
);
```

### Workers KV 用途

```
AUTH_KV:
  revoke:<jti> → "1" (JWT 撤销列表)

CACHE_KV:
  tools:all → JSON (工具列表缓存 300s)
  tools:cat:<slug> → JSON (分类工具缓存)
```

---

## 五、API 设计

### 认证

```
POST /api/auth/register  - 用户注册
POST /api/auth/login     - 用户登录
POST /api/auth/turnstile - Turnstile 验证
```

### 工具

```
GET  /api/tools          - 获取工具列表
POST /api/tools/:id      - 使用工具（扣费）
```

### 用户

```
GET /api/user/balance    - 获取余额
```

### AI

```
POST /api/ai/intent     - 解析用户意图
```

### 支付

```
POST /api/stripe/checkout - 创建支付会话
POST /api/stripe/webhook  - Stripe Webhook
```

### 文件

```
POST /api/r2/upload-url   - 获取上传 URL
PUT  /api/r2/upload/:key - 上传文件
GET  /api/r2/share/:token - 下载分享文件
```

---

## 六、部署指南

### 6.1 Cloudflare 资源初始化

```bash
# D1 数据库
wrangler d1 create toolbox-db
wrangler d1 execute toolbox-db --file=schema.sql --remote

# KV 命名空间
wrangler kv namespace create "TOOLBOX_AUTH"
wrangler kv namespace create "TOOLBOX_CACHE"

# R2 存储桶
wrangler r2 bucket create toolbox-files

# Queues
wrangler queues create billing-queue
wrangler queues create cleanup-queue
```

### 6.2 Worker 部署

```bash
cd packages/worker

# 设置 Secrets
wrangler secret put JWT_SECRET
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put TURNSTILE_SECRET
wrangler secret put CF_API_TOKEN
wrangler secret put CF_ACCOUNT_ID

# 部署
wrangler deploy
```

### 6.3 工具站部署

```bash
# 注入 UI 壳
cd packages/tool-shell
node inject.js ../../tools

# 部署到 Cloudflare Pages
cd ../../tools
wrangler pages deploy . --project-name=toolbox-tools
```

### 6.4 壳站部署

```bash
cd packages/web
npm install
npx @opennextjs/cloudflare deploy
```

---

## 七、成本核算

| 服务 | 免费额度 | 月费 |
|------|---------|------|
| Workers | 100K req/day | $5 (Paid Plan) |
| D1 | 500MB, 5M读/天 | 免费 |
| KV | 100K读/天, 1K写/天 | 免费 |
| R2 | 10GB, 1M Class A | 免费 |
| Pages | 500 builds | 免费 |
| Queues | 10K ops/天 | 免费 |
| Workers AI | 10K Neurons/天 | 免费 |
| Gemini | 1000 RPD | 免费 |
| **总计** | | **$5/月** |

---

## 八、项目结构

```
toolbox/
├── .github/workflows/     # GitHub Actions
├── data/                 # 工具元数据
│   ├── tools.json        # 30 个工具定义
│   ├── categories.json   # 分类定义
│   └── workflows/       # 工作流模板
├── packages/
│   ├── worker/          # Cloudflare Worker API
│   │   └── src/          # TypeScript 源码
│   ├── web/              # Next.js 壳站
│   │   └── app/          # App Router 页面
│   └── tool-shell/       # 工具 UI 壳
├── scripts/              # Python 自动化脚本
│   ├── scanner.py        # GraphQL 爬虫
│   ├── classifier.py     # AI 分类
│   └── translator.py      # AI 翻译
└── tools/                # 30 个自托管工具 HTML
```

---

## 九、路线图

### Phase 1 (MVP) - 完成
- [x] 30 个自托管纯前端工具
- [x] 积分系统 + Stripe 支付
- [x] AI 意图识别（Workers AI）
- [x] Cmd+K 全局搜索
- [x] 每日自动化工具更新

### Phase 2 (扩展)
- [ ] 更多工具分类
- [ ] 视觉化工作流编辑器
- [ ] 裂变分享系统
- [ ] API 接口开放

### Phase 3 (生态)
- [ ] 社区工具提交
- [ ] 企业白标嵌入
- [ ] 插件系统

---

## 十、License

MIT License - 开源项目，欢迎贡献。

---

**Powered by Cloudflare Edge + GitOps + AI**
