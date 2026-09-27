# ---- 1. build the React frontend ----
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 2. Python runtime: API + built frontend in one process ----
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ app/
COPY target/ target/
COPY schema.sql .
COPY --from=web /web/dist frontend/dist
EXPOSE 8000
# Render injects $PORT; default to 8000 for local `docker run`.
CMD ["sh", "-c", "uvicorn app.server:root --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
