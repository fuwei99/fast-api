#!/bin/bash

echo "start update process..."

# 还原特定的代理服务器文件
git checkout HEAD -- src/proxy/cursor_proxy_server_android_arm64 \
                   src/proxy/cursor_proxy_server_linux_amd64 \
                   src/proxy/cursor_proxy_server_windows_amd64.exe

if [ $? -ne 0 ]; then
    echo "error:restore proxy server file failed"
    exit 1
fi

# 拉取远程更新，保留服务器端更改
git pull -X theirs

if [ $? -ne 0 ]; then
    echo "error:pull update failed,maybe network problem or conflict"
    exit 1
fi

echo "update success" 
