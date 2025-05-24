#!/bin/bash
# 编码：UTF-8

# 安装依赖
echo "install dependencies..."
npm install --no-fund --quiet --no-audit

# 检查上一个命令的退出状态
if [ $? -ne 0 ]; then
    echo "dependencies installation failed,maybe start application failed"
fi

# 启动应用
echo "start application..."
npm start