# GitHub 分支保护与强制门禁（小白版）

目标：任何人都不能把不合规代码直接合并到 `main`。

## 1. 你已经有的工作流
- `PR Quality Gate`（PR 自动门禁）
- `Release (Gated)`（发布门禁 + 自动部署）
- `Tool UI Auto-Fix`（工具页自动改造）

## 2. 现在去 GitHub 开启分支保护（必须）

路径：
- GitHub 仓库 -> Settings -> Branches -> Add branch protection rule

配置：
1. Branch name pattern: `main`
2. 勾选 `Require a pull request before merging`
3. 勾选 `Require approvals`（建议至少 1）
4. 勾选 `Require status checks to pass before merging`
5. 在状态检查列表里选择：
   - `PR Quality Gate / gate`
6. 勾选 `Require branches to be up to date before merging`
7. 勾选 `Do not allow bypassing the above settings`
8. Save changes

## 3. 发布流程（必须这样走）
1. 先走 PR 合并（通过 PR Quality Gate）
2. 合并后手动运行 `Release (Gated)`
3. `Release (Gated)` 通过后才算正式上线

## 4. 你要的效果
- 新增工具 UI 不规范：
  - PR 阶段会被自动改造并校验
  - 不通过就不能合并
- 即使合并了，也必须过发布门禁才能上线

## 5. 常见问题

### Q1: 为什么我明明改了代码却不能合并？
因为门禁检查（UI/安全/数据）没通过，这是设计目标。

### Q2: 可以临时跳过吗？
不建议。若必须紧急修复，临时关闭保护规则，修复后立即恢复。

### Q3: 自动改造后谁来提交？
`Tool UI Auto-Fix` 会自动提交标准化结果（bot 提交）。
