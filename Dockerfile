FROM node:20-bullseye

RUN apt-get update && apt-get install -y     chromium     fonts-noto-color-emoji     ffmpeg   && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src
COPY .env.example ./

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV DATA_DIR=/data

RUN mkdir -p ${DATA_DIR}/wwebjs_auth ${DATA_DIR}/config
VOLUME ["/data"]

EXPOSE 8080
CMD ["npm","start"]
