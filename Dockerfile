# 使用官方的Node.js 20-alpine作为基础镜像
FROM node:20-alpine

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=7860

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package.json package-lock.json* ./

# 安装生产环境依赖
# 使用npm ci可以确保安装与package-lock.json完全一致的依赖，更适合CI/CD环境
RUN npm ci --only=production

# 复制项目源代码
COPY src/ ./src/

# 复制并设置entrypoint脚本
COPY entrypoint.sh .
RUN chmod +x ./entrypoint.sh

# 暴露应用程序的端口
EXPOSE 7860

# 设置entrypoint
ENTRYPOINT ["./entrypoint.sh"]

# 启动应用程序的命令
CMD [ "node", "src/lightweight-client-express.js" ] 