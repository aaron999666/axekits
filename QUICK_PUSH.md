# ⚡ 快速推送到 GitHub

## 📋 前提条件
- 已安装 [Git for Windows](https://git-scm.com/download/win)
- GitHub账号 `aaron999666` 有仓库权限

## 🚀 步骤 (5分钟完成)

### 第一步：打开 Git Bash
按 `Win` 键，搜索 "Git Bash" 并打开

### 第二步：进入项目目录
```bash
cd e:/TOOLS
```

### 第三步：执行以下命令 (一次性复制粘贴)
```bash
git init
git add -A
git commit -m "feat: initial commit - AxeKits AI toolbox platform"
git branch -M main
git remote add origin https://github.com/aaron999666/axekits.git
git push -u origin main
```

---

## ⚠️ 如果需要身份验证

如果提示输入用户名和密码：
- **用户名**: `aaron999666`
- **密码**: 使用 [Personal Access Token](https://github.com/settings/tokens) (需要勾选 `repo` 权限)

---

## 📦 项目包含内容

```
✅ Cloudflare Worker API
✅ Next.js 前端
✅ 30+ 自托管工具
✅ GitHub Actions
✅ 完整白皮书 (README.md)
```
