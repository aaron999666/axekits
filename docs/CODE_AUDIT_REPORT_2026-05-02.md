# 代码检查报告（按最新技术标准）

检查时间：2026-05-02
范围：`packages/web`、`packages/worker`、`.github/workflows`

## 一、已修复问题

1. Stripe Webhook 幂等缺失（高风险）
- 现象：同一 webhook 重放可能重复加积分。
- 处理：新增 `stripe_webhook_events` 去重表，`INSERT OR IGNORE` 防重。
- 文件：
  - `packages/worker/schema.sql`
  - `packages/worker/src/stripe.ts`

2. Stripe 价格 ID 硬编码（高风险）
- 现象：代码写死 `price_basic/price_pro`，生产环境不可移植。
- 处理：改为变量 `STRIPE_PRICE_*`。
- 文件：
  - `packages/worker/src/types.ts`
  - `packages/worker/src/stripe.ts`
  - `packages/worker/wrangler.toml`

3. 支付跳转 URL 错误依赖 `JWT_ISSUER`（高风险）
- 现象：success/cancel URL 可能不是真实前端域名。
- 处理：统一用 `APP_ORIGIN`。
- 文件：`packages/worker/src/stripe.ts`

4. `tools_stats` 字段不一致（中风险）
- 现象：代码写 `last_clicked_at`，schema 不存在该列。
- 处理：schema 增加 `last_clicked_at`。
- 文件：`packages/worker/schema.sql`

5. GitHub Actions 触发器结构问题（中风险）
- 现象：workflow 内 job 写了无效 `on` 结构。
- 处理：重构为单 workflow 双定时 cron + 条件 job。
- 文件：`.github/workflows/scanner.yml`

## 二、当前状态
- SEO：metadata、schema、robots、sitemap、llms.txt 已具备。
- GEO：Cloudflare geo headers + cookie + vary 已具备。
- 安全：JWT 标准化、CORS origin 白名单、基础安全头已具备。

## 三、仍建议后续增强（未阻塞上线）
1. API 速率限制（登录、支付、上传）
2. Turnstile 全链路接入注册/登录页面（目前 API 已支持验证接口）
3. 统一错误码字典和可观测性日志（trace id）
4. 对 `tools.json` 增加 schema 校验（CI gate）

## 四、上线结论
- 从架构与安全底线看，可进入“可控上线”阶段。
- 前提：按部署手册补全 Cloudflare/GitHub/Stripe 配置。
