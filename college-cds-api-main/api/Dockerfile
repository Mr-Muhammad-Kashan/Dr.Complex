FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache wget
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
# Bundled fixture CDS JSONs (staged into api/seed/ by scripts/start.sh from data/input/).
COPY seed ./seed

# Bake a fresh SQLite DB into the image at build time using the same admin code path
# (admin.js bulk --reset) that runs against the live container. Stamp the image with
# a BUILD_ID so the server can detect when a rebuild has happened.
ARG BUILD_ID=unknown
ENV BUILD_ID=${BUILD_ID}
RUN echo "$BUILD_ID" > /app/build_id \
 && SEED_DB=/app/seed.db DB_PATH=/app/seed.db \
    node --no-warnings=ExperimentalWarning src/admin.js bulk /app/seed --reset \
 && echo "[build] baked DB at /app/seed.db (BUILD_ID=$BUILD_ID)"

ENV NODE_ENV=production \
    PORT=8080 \
    DB_PATH=/data/cds.db \
    INGEST_DIR=/app/seed \
    DOCS_ENABLED=true \
    NODE_OPTIONS="--no-warnings=ExperimentalWarning"
RUN mkdir -p /data
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD wget -qO- http://localhost:8080/v1/health || exit 1
CMD ["node", "src/server.js"]
