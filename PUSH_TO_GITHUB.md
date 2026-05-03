# 推送到 GitHub 指南

## 准备工作

确保您已安装 [Git for Windows](https://git-scm.com/download/win)。

## 推送步骤

### 方法一：使用 Git Bash（推荐）

1. 打开 Git Bash，进入项目目录：
```bash
cd e:/TOOLS
```

2. 初始化 Git 仓库（如果还没有）：
```bash
git init
```

3. 添加远程仓库：
```bash
git remote add origin https://github.com/aaron999666/axekits.git
```

4. 添加所有文件：
```bash
git add -A
```

5. 提交代码：
```bash
git commit -m "feat: initial commit - AxeKits AI toolbox platform"
```

6. 切换到 main 分支：
```bash
git branch -M main
```

7. 推送到 GitHub：
```bash
git push -u origin main
```

### 方法二：使用 GitHub Desktop（图形界面）

1. 下载安装 [GitHub Desktop](https://desktop.github.com/)
2. 打开 GitHub Desktop
3. 选择 "File" → "Add Local Repository"
4. 选择 `e:\TOOLS` 目录
5. 点击 "Publish repository"
6. 选择目标仓库 `aaron999666/axekits`
7. 点击 "Publish"

## 如果需要身份验证

如果 GitHub 要求身份验证，请使用 Personal Access Token：
1. 访问 https://github.com/settings/tokens
2. 生成新 token，勾选 repo 权限
3. 推送时，用户名使用您的 GitHub 用户名，密码使用生成的 token

## 项目结构说明

```
axekits/
├── packages/
│   ├── worker/          # Cloudflare Worker API
│   ├── web/             # Next.js 前端
│   └── tool-shell/      # 工具 UI 壳
├── tools/               # 30+ 自托管工具
├── scripts/             # Python 工具扫描脚本
├── data/                # 数据文件
├── .github/             # GitHub Actions
├── README.md            # 白皮书文档
└── DEPLOY.md            # 部署指南
```
