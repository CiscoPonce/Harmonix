# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    libgomp1 \
    python3 \
    python3-pip \
    python3-venv \
    espeak-ng \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r harmonix && useradd -r -g harmonix harmonix

RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir kokoro-onnx soundfile onnxruntime

RUN mkdir -p /app/models/kokoro && \
    curl -L -o /app/models/kokoro/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx && \
    curl -L -o /app/models/kokoro/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /data /app/models/kokoro && chown -R harmonix:harmonix /app /data
USER harmonix
ENV PORT=3001
ENV SQLITE_PATH=/data/harmonix.db
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "index.js"]
