# 商用自动运营审视与实施方案（开发设计大师 + 运营专家 + 技术专家）

更新时间：2026-05-03

## 1. 业务逻辑审视（开发设计大师视角）

### 1.1 核心业务闭环
- 流量入口：SEO + GEO + 工具页长尾。
- 用户激活：免费每日额度（5 次）+ 低门槛试用。
- 付费转化：积分包、Basic、Pro。
- 复购触发：高频工具链（图像压缩/水印、格式转换、开发调试）。

### 1.2 产品体验关键路径
1. 搜索到工具页
2. 1 次点击可进入工具
3. 工具成功完成任务并可下载结果
4. 免费额度耗尽后展示计费动机
5. Stripe 支付完成后即刻到账

### 1.3 设计一致性（已改造）
- 统一站点头部组件
- 统一色板 token（web + tool shell）
- 工具卡、详情页、定价页语义统一

## 2. 商业化与运营审视（运营专家视角）

### 2.1 运营核心指标
- UV / DAU
- 工具使用成功率
- 免费 -> 注册转化率
- 注册 -> 支付转化率
- 支付成功率
- 退款率
- 每付费用户月均消耗积分

### 2.2 自动运营机制（已具备 + 建议执行）
- GitHub Actions 每日自动扫描分类翻译
- 每 6 小时健康检查
- Worker 每小时清理过期文件
- AI 编排使用 4 路提供商自动降级（免费优先）

### 2.3 告警阈值建议
- `/api/health` 连续 3 次失败：P1
- `api/tools` 响应 > 1s 超过 5 分钟：P2
- Stripe webhook 失败率 > 1%：P1
- 工具健康 down 比例 > 20%：P1

## 3. 技术审视（技术专家视角）

### 3.1 已完成关键修复
- JWT Base64URL 标准化
- Stripe webhook 幂等去重
- CORS 显式来源控制
- 安全响应头强化
- Workflow 触发器修复
- AI 多提供商自动降级链路

### 3.2 AI 路由新架构（本次核心）
顺序：Gemini -> Cloudflare AI -> Mimo -> DeepSeek -> 规则兜底
- 免费优先：Gemini free + Cloudflare AI
- 限流/失败自动切换到 Mimo/DeepSeek
- 全部失败走关键词规则兜底，保证请求可响应
- 返回字段包含 `provider`，便于运营分析和成本归因

### 3.3 新增运营可观测接口
- `GET /api/ai/providers`（需登录）
- 返回：
  - provider 顺序
  - 各 provider 是否配置
  - 当前模型配置

## 4. 测试方案（商用前必须执行）

### 4.1 接口冒烟测试
- 脚本：`scripts/smoke_test.ps1`
- 用法：
```powershell
pwsh scripts/smoke_test.ps1 -ApiBase "https://<your-worker>.workers.dev"
```

### 4.2 AI 路由测试
1. 配置 4 个 API Key
2. 调用 `/api/ai/intent` 观察 `provider`
3. 人为移除 Gemini key，验证自动切到 Cloudflare
4. 继续移除 Cloudflare key，验证切到 Mimo/DeepSeek
5. 全部移除后验证规则兜底

### 4.3 支付链路测试
1. Stripe test 模式下创建订单
2. 检查 webhook 收到 `checkout.session.completed`
3. 检查 `transactions` 与 `users.points_balance`
4. 重放同一个 webhook event，确认余额不重复增加

### 4.4 运维自动化测试
- 手动触发 GitHub workflow：scanner
- 验证生成 data 变化并自动提交
- 查看 Worker Cron 日志有定时执行记录

## 5. AI API 配置清单（四路）

### 5.1 Worker Secrets
- `GEMINI_API_KEY`
- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`
- `MIMO_API_KEY`
- `DEEPSEEK_API_KEY`

### 5.2 Worker Variables
- `MIMO_API_BASE`（例如供应商文档给的 base URL）
- `DEEPSEEK_API_BASE`（默认可用 `https://api.deepseek.com/v1`）
- `AI_PROVIDER_ORDER`（建议：`gemini,cloudflare,mimo,deepseek`）
- `GEMINI_MODEL`（默认 `gemini-1.5-flash`）
- `CF_AI_MODEL`（默认 `@cf/meta/llama-3.1-8b-instruct`）
- `MIMO_MODEL`（按你账号可用模型）
- `DEEPSEEK_MODEL`（默认 `deepseek-chat`）

## 6. 商用上线门槛（达标即上线）
- 冒烟测试全绿
- AI 路由降级测试通过
- Stripe 幂等测试通过
- Workflow 自动更新可运行
- 7 天内工具可用率 >= 99%

## 7. 结论
目前代码已具备“商用 + 自动运营”的基础骨架。
下一阶段重点是：指标看板、告警联动、增长实验（而不是继续堆功能）。
