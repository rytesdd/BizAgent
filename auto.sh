#!/bin/bash
echo "=== 自动同步服务启动 ==="
echo "每 5 秒检查一次代码变动..."

while true; do
    # 检查是否有文件变化
    if [[ -n $(git status --porcelain) ]]; then
        echo "---------------------------------"
        echo "检测到变动，正在自动保存..."
        
        # 这里的命令就是平时你手敲的那三步
        git add .
        git commit -m "自动保存: $(date "+%H:%M:%S")"
        
        # 尝试拉取别人的修改（防止冲突），然后推送你的修改
        git pull origin main --rebase
        git push origin main
        
        echo "✅ 同步完成！"
    fi
    # 休息 5 秒
    sleep 5
done