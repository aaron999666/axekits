# 2026 统一设计系统与自动一致性规范

## 1. 设计目标
- 主站与工具页视觉完全同源。
- 用户从首页进入任意工具，不产生“跳产品”的割裂感。
- 新增工具自动继承统一 UI，不依赖人工逐个改样式。

## 2. 已落地机制
1. 统一视觉 token
- 主站 `globals.css` 使用统一色板、圆角、阴影、按钮与输入风格。
- 工具壳 `inject.js` 注入同一 token 与控件覆盖规则。

2. 强制重注入
- `packages/tool-shell/inject.js` 每次执行都会移除旧壳并重建新壳。
- 保证历史工具随设计系统升级自动更新。

3. 自动一致性门禁
- 新增 `scripts/ui_consistency_check.py`。
- CI 中加入 UI 一致性检查，不满足规则直接阻断自动发布。

## 3. 新增工具标准流程（必须）
1. 添加/更新工具 HTML
2. 运行 `node packages/tool-shell/inject.js tools`
3. 运行 `python scripts/ui_consistency_check.py`
4. 运行 `python scripts/validate.py`
5. 通过后才允许提交与发布

## 4. 视觉原则（2026）
- Edge-native glass + deep gradient 背景
- 高可读橙色动作色（强调操作）
- 一致圆角/阴影/交互动效
- 所有工具交互控件统一按钮和输入质感

## 5. 禁止事项
- 禁止工具页面独立定义品牌主色体系（允许局部内容样式）
- 禁止跳过壳注入直接发布
- 禁止绕过 UI consistency check

## 6. 自动改造上线机制（新增）
- 工作流：.github/workflows/ui-autofix.yml`r
- 触发：	ools/**/index.html 变更
- 动作：自动执行壳注入、UI一致性校验、自动提交修复结果
- 结果：即使新增工具 UI 不合规，也会在上线前被自动规范化。

