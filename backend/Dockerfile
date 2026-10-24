# Oasyn Maps backend — production container image (AWS ECS Express Mode / Fargate).
#
# The graph snapshot is NOT baked into the image: at boot the server downloads
# graph.bin + horizon.bin from Cloudflare R2 (credentials come from env vars /
# secrets injected by ECS). REQUIRE_SNAPSHOT=1 makes a failed download fatal so
# a misconfigured deploy fails its health check instead of serving sample data.
#
# Build (from backend/):  docker build --platform linux/amd64 -t oasyn-backend .
# Run locally:            docker run --rm -p 8080:8080 --env-file .env oasyn-backend

FROM node:22-bookworm-slim

WORKDIR /app

# Install deps first for layer caching. tsx (a devDependency) runs the
# TypeScript entrypoint at runtime, so dev deps are included on purpose.
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund && npm cache clean --force

# Only what the server needs at runtime (see .dockerignore for exclusions).
COPY tsconfig.json ./
COPY contract ./contract
COPY scripts/lib ./scripts/lib
COPY src ./src

ENV NODE_ENV=production \
    PORT=8080 \
    REQUIRE_SNAPSHOT=1 \
    SNAPSHOT_SOURCE=r2

# Run as the unprivileged user that ships with the node image.
USER node

EXPOSE 8080

# Container-level health check (the load balancer also checks /healthz).
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form so SIGTERM reaches node directly (graceful shutdown on deploys).
CMD ["node", "--import", "tsx", "src/server.ts"]
