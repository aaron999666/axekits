# ToolBox 项目实现全景文档（功能、思路、逻辑、落地保障）

## 0. 文档目标
本文档用于回答四个问题：
1. 这个项目到底实现了什么。
2. 每个模块是怎么实现的，背后的逻辑是什么。
3. SEO + GEO（搜索引擎与生成式引擎优化）如何在当前代码中落地。
4. 如何保障项目持续落地（交付、监控、回滚、增长闭环）。

---

## 1. 已实现功能清单（按用户路径）

### 1.1 访问与浏览
- 首页：展示平台定位、AI 编排入口、工具分类入口。
- 工具列表页：按分类浏览所有工具。
- 工具详情页：以 iframe 方式加载自托管工具页面。
- 定价页：免费层、Basic、Pro、积分包展示。

### 1.2 工具能力（30 个）
- 开发助手：JSON、Base64、Hash、URL、Regex、JWT、Diff、UUID 等。
- 图像视觉：压缩、缩放、格式转换、水印、SVG、QR。
- 文档转换：图片转 PDF。
- 日常计算：科学计算器、百分比、年龄计算。

### 1.3 账户与计费
- 注册、登录（JWT + Cookie）。
- 积分扣费（D1 原子扣减）。
- 免费额度（按天统计 free_usage）。
- Stripe 结算与回调入账。

### 1.4 AI 编排
- 意图解析 API（Workers AI），将自然语言请求映射为工具步骤链。

### 1.5 存储与文件
- R2 上传 URL 获取、文件上传、分享下载（带过期逻辑）。

### 1.6 自动化与运维
- GitHub Actions + 脚本：扫描、分类、翻译、健康检查（基础框架已具备）。

---

## 2. 当前技术架构（只用 Git + Stripe + Cloudflare 全家桶）

### 2.1 架构分层
- 展示层：`packages/web`（Next.js App Router）
- 工具运行层：`tools/*/*/index.html` + `packages/tool-shell` 注入统一壳
- API/业务层：`packages/worker`（Cloudflare Workers）
- 数据层：D1/KV/R2/Queues
- 商业化层：Stripe Checkout + Webhook
- DevOps 层：GitHub 仓库 + CI 工作流

### 2.2 关键设计原则
- 边缘优先：请求在 Cloudflare 边缘处理，降低时延。
- 配置外置：域名、数据源 URL 走环境变量。
- 成本优先：通过 Cloudflare 免费额度+Workers Paid 控制总成本。
- 可维护优先：统一导航与样式 token，减少重复代码。

---

## 3. 代码层实现逻辑（核心模块）

### 3.1 认证与会话
- 文件：`packages/worker/src/auth.ts`
- 逻辑：
  - JWT 使用 HMAC-SHA256。
  - 采用标准 Base64URL 编码，保证跨端兼容。
  - Token 带 `exp/iss/jti`，并通过 KV 维护撤销列表。

### 3.2 工具调用与扣费
- 文件：`packages/worker/src/index.ts` + `packages/worker/src/billing.ts`
- 逻辑：
  - 先鉴权，再查工具健康状态，再扣费。
  - 使用 D1 `UPDATE ... RETURNING` 保证余额扣减原子性。
  - 余额不足时走免费额度逻辑（`free_usage`）。

### 3.3 Stripe 支付
- 文件：`packages/worker/src/stripe.ts`
- 逻辑：
  - `/api/stripe/checkout` 创建支付会话。
  - `/api/stripe/webhook` 校验签名后处理到账或退款。
  - 交易写入 `transactions`，用户余额在 `users` 更新。

### 3.4 工具目录与缓存
- 文件：`packages/worker/src/index.ts`
- 逻辑：
  - 通过 `TOOLS_DATA_URL` 拉取 `data/tools.json`。
  - KV 做 300 秒缓存，避免频繁回源。

### 3.5 Web 组件复用
- 文件：`packages/web/components/SiteHeader.tsx`
- 逻辑：
  - 首页、工具页、定价页复用统一头部，降低维护复杂度。

### 3.6 工具壳注入
- 文件：`packages/tool-shell/inject.js`
- 逻辑：
  - 批量向每个工具 HTML 注入固定顶栏、积分信息区、桥接脚本。
  - 同步统一视觉 token，保证跨工具一致体验。

---

## 4. SEO 实现（已落地）

### 4.1 全站 Metadata
- 文件：`packages/web/app/layout.tsx`
- 实现：
  - `metadataBase`、title 模板、description、Open Graph、Twitter Card、keywords。
  - 全站 canonical 基线。

### 4.2 分页 Metadata
- 首页：`packages/web/app/page.tsx`
- 工具页：`packages/web/app/tools/page.tsx`
- 定价页：`packages/web/app/pricing/page.tsx`
- 工具详情：`packages/web/app/tools/[id]/page.tsx`（`generateMetadata` 动态生成）

### 4.3 结构化数据（Schema.org）
- `WebSite`（layout）
- `FAQPage`（首页）
- `ItemList`（工具列表页）
- `SoftwareApplication`（工具详情页）
- `OfferCatalog`（定价页）

### 4.4 爬虫入口与收录文件
- `packages/web/app/sitemap.ts`：动态生成 sitemap（含工具详情页）
- `packages/web/app/robots.ts`：robots 规则 + sitemap 地址
- `packages/web/app/manifest.ts`：基础 Web App Manifest

### 4.5 技术 SEO 安全头
- 文件：`packages/web/middleware.ts`, `packages/web/next.config.ts`
- 实现：CSP、XFO、nosniff、Referrer-Policy、Permissions-Policy

---

## 5. GEO 实现（Generative Engine Optimization + Geo）

### 5.1 面向生成式引擎（GEO）
- 新增 `llms.txt`：`packages/web/app/llms.txt/route.ts`
- 提供：
  - 产品定义
  - 规范引用 URL
  - API 能力摘要
  - 安全与可信说明
  - 引用规则（优先 canonical URL）

### 5.2 面向地域识别（Geo）
- 文件：`packages/web/middleware.ts`
- 利用 Cloudflare 请求头读取：
  - `cf-ipcountry`
  - `cf-region-code`
  - `cf-ipcity`
- 输出：
  - 响应头 `x-geo-country/x-geo-region/x-geo-city`
  - Cookie `tb_geo_country`
  - `Vary` 头用于边缘缓存分流

### 5.3 后续可直接扩展能力
- 按国家自动切换币种/套餐说明
- 地域化 SEO 落地页（`/geo/us`, `/geo/sg`）
- 地域化文案与优惠实验

---

## 6. 安全体系（已完成 + 下一步）

### 6.1 已完成
- JWT 标准化与撤销机制
- CORS 显式来源控制（`APP_ORIGIN`）
- API/页面安全响应头
- 输入基础校验（邮箱格式）

### 6.2 下一步增强（建议）
- Stripe webhook 幂等表（event_id 去重）
- 登录/注册/扣费接口的速率限制
- 异常行为评分（同 IP 高频失败）

---

## 7. 运营与商业化逻辑

### 7.1 北极星指标
- DAU
- 每用户日均工具调用次数
- 免费到付费转化率
- 支付成功率
- ARPU

### 7.2 数据闭环
- `tools_stats` 跟踪工具热度和可用性
- `transactions` 跟踪收入、消耗、退款
- 通过 D1 聚合报表实现运营驾驶舱

### 7.3 增长飞轮
- SEO 收录 → 工具访问
- 工具体验 → 留存
- 免费额度触达上限 → Stripe 付费
- 付费用户行为反哺高价值工具开发

---

## 8. 如何保障落地（工程管理视角）

### 8.1 交付保障
- 所有能力分层在 monorepo 中，代码与配置边界清晰。
- 配置参数化（域名、数据源）降低部署环境耦合。

### 8.2 发布保障
- GitHub Actions 触发构建与部署。
- Cloudflare Pages/Workers 原生回滚与版本管理。

### 8.3 质量保障
- 发布前检查清单：
  - 构建通过
  - API 健康检查
  - Stripe 沙箱回调验证
  - 核心页面 SEO 文件可访问（robots/sitemap/llms.txt）

### 8.4 稳定性保障
- KV 缓存减少上游故障影响。
- R2/Queues 将耗时流程异步化，避免请求超时。
- Worker 层统一错误处理，返回标准 JSON。

---

## 9. 本轮改造清单（对应代码文件）

### 9.1 Web
- `packages/web/app/layout.tsx`
- `packages/web/app/page.tsx`
- `packages/web/app/tools/page.tsx`
- `packages/web/app/tools/[id]/page.tsx`
- `packages/web/app/pricing/page.tsx`
- `packages/web/app/robots.ts`
- `packages/web/app/sitemap.ts`
- `packages/web/app/manifest.ts`
- `packages/web/app/llms.txt/route.ts`
- `packages/web/middleware.ts`
- `packages/web/next.config.ts`
- `packages/web/lib/site.ts`

### 9.2 Worker
- `packages/worker/src/auth.ts`
- `packages/worker/src/index.ts`
- `packages/worker/src/types.ts`
- `packages/worker/wrangler.toml`

### 9.3 Tool Shell
- `packages/tool-shell/inject.js`

---

## 10. 上线前待办（必须项）
1. 安装依赖并完成 `next build` + `wrangler deploy` 验证。
2. 将 `NEXT_PUBLIC_SITE_URL`、`APP_ORIGIN`、`TOOLS_DATA_URL`、`WORKFLOWS_DATA_URL` 配成真实生产值。
3. Stripe 改为真实 `price_id`，并完成 webhook 端到端演练。
4. 跑一次站点收录自检：
   - `/robots.txt`
   - `/sitemap.xml`
   - `/llms.txt`
   - 核心页面 canonical 与结构化数据。

---

## 11. 结论
当前项目已经具备：
- 可运营的工具平台基础能力
- 可增长的 SEO/GEO 基础设施
- 可维护的 Cloudflare + Stripe + Git 技术底座

下一阶段重点不是“再堆功能”，而是“把转化、稳定性、自动化运营跑起来”，这会直接决定营收效率与长期护城河。
