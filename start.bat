@echo off
chcp 65001 >nul
REM 编码：UTF-8

REM 安装依赖
echo install dependencies...
call npm install --no-fund --quiet --no-audit

REM 检查上一个命令的退出状态
if %ERRORLEVEL% neq 0 (
    echo dependencies installation failed,maybe start application failed
)

REM 启动应用
echo start application...
call npm start
pause