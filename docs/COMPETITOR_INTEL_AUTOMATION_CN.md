# 自动扫描前竞品参考机制

## 你问的核心
“提交代码是不是系统自动从 Git 获取？”

是的，系统会自动扫描并生成数据变更，然后 bot 自动提交。
所以我们做了两层：
1. 自动扫描前先竞品对标，避免闭门造车。
2. 自动提交后仍受 PR/Release 门禁约束。

## 新增机制
- 配置文件：`data/competitors.json`
- 脚本：`scripts/competitor_benchmark.py`
- 输出：`data/competitor_benchmark.json`
- 触发：`scanner.yml` 中“Scan GitHub repos”之前先执行。

## 作用
- 每次扫描前先看同行能力覆盖差距。
- 自动生成缺口建议（missing_topics / thin_topics）。
- 给后续工具引入和优先级提供依据。

## 与门禁关系
- 自动扫描并不会直接绕过质量控制。
- 仍需通过 UI/安全/数据检查和发布门禁。
