# Cloudflare 全家桶数据库与配置清单（2026-05-03）

本清单只讲 Cloudflare 侧：数据库与全部云资源配置。

## 必配资源
1. Worker：`toolbox-api`
2. D1：`toolbox-db`
3. KV：`AUTH_KV`、`CACHE_KV`
4. R2：`toolbox-files`
5. Queues：`billing-queue`、`cleanup-queue`
6. Analytics Engine：`toolbox_events`
7. Turnstile：1 个 widget（拿 secret）
8. Pages：`toolbox-web`（主站）、`toolbox-tools`（工具站）
9. Cron Trigger：`0 * * * *`

## 代码绑定位置
1. Worker 主配置：`packages/worker/wrangler.toml`
2. 类型定义：`packages/worker/src/types.ts`
3. D1 初始化 SQL：`packages/worker/schema.sql`

## 必填 wrangler.toml（关键）
1. `[[d1_databases]].database_id`
2. `[[kv_namespaces]].id`（2 个）
3. `[[r2_buckets]].bucket_name`
4. `[[queues.producers]].queue`（2 个）
5. `[[analytics_engine_datasets]].dataset`
6. `[triggers].crons`

## Worker Secrets（Cloudflare Dashboard -> Worker -> Variables and Secrets）
1. `JWT_SECRET`
2. `STRIPE_SECRET_KEY`
3. `STRIPE_WEBHOOK_SECRET`
4. `TURNSTILE_SECRET`
5. `CF_ACCOUNT_ID`
6. `CF_API_TOKEN`
7. `GEMINI_API_KEY`（可选）
8. `MIMO_API_KEY`（可选）
9. `DEEPSEEK_API_KEY`（可选）

## 非敏感 vars（wrangler.toml）
1. `APP_ORIGIN`
2. `TOOLS_DOMAIN`
3. `TOOLS_DATA_URL`
4. `WORKFLOWS_DATA_URL`
5. `STRIPE_PRICE_BASIC/PRO/PACK_100`
6. `AI_PROVIDER_ORDER`
7. `CF_AI_MODEL/GEMINI_MODEL/MIMO_MODEL/DEEPSEEK_MODEL`
8. `ADMIN_BOOTSTRAP_KEY`
9. `TURNSTILE_ENFORCE`

## 官方文档链接
1. D1：https://developers.cloudflare.com/d1/get-started/
2. KV：https://developers.cloudflare.com/kv/get-started/
3. R2：https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
4. Queues：https://developers.cloudflare.com/queues/get-started/
5. Analytics Engine：https://developers.cloudflare.com/analytics/analytics-engine/get-started/
6. Cron Triggers：https://developers.cloudflare.com/workers/configuration/cron-triggers/
7. Workers Secrets：https://developers.cloudflare.com/workers/configuration/secrets/
8. Pages Git 集成：https://developers.cloudflare.com/pages/configuration/git-integration/
9. Turnstile：https://developers.cloudflare.com/turnstile/

