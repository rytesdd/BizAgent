========================================
  推送到 https://github.com/rytesdd/BizAgent
========================================

1. 安装 Git（若尚未安装）
   下载：https://git-scm.com/download/win
   安装时勾选 "Add Git to PATH"

2. 推送方式（任选一种）

   方式 A - 一键推送到 rytesdd/BizAgent（推荐）
   --------------------------------------------
   双击：push-to-github.bat
   会自动 init、提交、设置远程为上述仓库并推送。

   方式 B - 通用脚本
   ------------------------
   双击：git-push.bat
   - 第一次会初始化仓库并提交；若没有远程会提示你添加。
   - 添加远程：在项目文件夹里打开“命令提示符”或 PowerShell，执行：
     git remote add origin https://github.com/你的用户名/仓库名.git
   - 再双击一次 git-push.bat 即可推送。

   方式 B - 带仓库地址运行
   ------------------------
   把仓库地址拖到 git-push.bat 上松开（或命令行运行）：
   git-push.bat "https://github.com/你的用户名/仓库名.git"
   会自动设置远程并推送。

   方式 C - PowerShell 脚本
   ------------------------
   在 PowerShell 里进入项目目录，执行：
   .\git-push.ps1
   或带地址：
   .\git-push.ps1 "https://github.com/你的用户名/仓库名.git"

3. 若提示 "Git not found"
   说明当前环境找不到 Git，请安装 Git 并确保安装时勾选加入 PATH，
   然后重新打开命令提示符/PowerShell 再运行。

========================================
