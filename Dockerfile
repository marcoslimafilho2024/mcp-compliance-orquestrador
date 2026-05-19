FROM node:20-slim

WORKDIR /app

# Runtime libs para o Chromium do Playwright (nomes equivalentes ao ecossistema Debian).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        fonts-liberation \
        libnss3 \
        libfreetype6 \
        libharfbuzz0b \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcups2 \
        libdrm2 \
        libgbm1 \
        libgtk-3-0 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxkbcommon0 \
        libxrandr2 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install

RUN npx playwright install chromium

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ARG PORT=3000
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD ["node", "dist/index.js"]
