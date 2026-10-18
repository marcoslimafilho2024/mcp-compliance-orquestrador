FROM node:22-bookworm-slim AS webbuild
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --ignore-scripts
COPY web/consent.js ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PLAYWRIGHT_BROWSERS_PATH=/opt/browsers
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && python -m playwright install --with-deps chromium && useradd --create-home monitor && chmod -R a+rX /opt/browsers
COPY adapter.py auth.py oauth_provider.py server.py entrypoint.py ./
COPY web/consent.html web/consent.html
COPY --from=webbuild /web/dist/consent.js web/dist/consent.js
RUN mkdir -p /data && chown monitor:monitor /data
EXPOSE 8000
CMD ["python", "entrypoint.py"]
