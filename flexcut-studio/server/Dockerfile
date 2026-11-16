# Server mesin FlexCut (Motion + Klip) — jalankan di VPS, tanpa instalasi di komputer pengguna.
# Build context: folder flexcut-studio (lihat docker-compose.yml).
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip ca-certificates curl ffmpeg \
      libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libasound2 libxrandr2 libxkbcommon0 \
      libxfixes3 libxcomposite1 libxdamage1 libgbm1 libcups2 libpango-1.0-0 libcairo2 \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir --break-system-packages uv

WORKDIR /app
COPY . /app

ENV FLEXCUT_HOST=0.0.0.0 \
    FLEXCUT_PORT=8791 \
    FLEXCUT_DATA=/data \
    PYTHONUNBUFFERED=1
VOLUME /data
EXPOSE 8791

CMD ["python3", "local-engine/server.py", "--no-browser"]
