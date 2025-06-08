FROM node:lts-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . /app

RUN chmod -R 777 /app

EXPOSE 3010

CMD ["npm", "run", "start"]
