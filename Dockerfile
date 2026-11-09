# One container: PocketBase serves the API *and* the built frontend.
# Multi-arch: linux/amd64, linux/arm64 (Raspberry Pi 4/5, 64-bit OS), linux/arm/v7 (32-bit Pi OS).

# ---- 1. Build the frontend (runs natively on the build machine, not emulated)
FROM --platform=$BUILDPLATFORM node:22-alpine AS web
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ---- 2. Runtime
FROM alpine:3.22
ARG PB_VERSION=0.40.6
ARG TARGETARCH
ARG TARGETVARIANT

RUN apk add --no-cache ca-certificates tzdata \
    && apk add --no-cache --virtual .fetch unzip wget \
    && case "${TARGETARCH}${TARGETVARIANT}" in \
         amd64) PB_ARCH=amd64 ;; \
         arm64*) PB_ARCH=arm64 ;; \
         armv7) PB_ARCH=armv7 ;; \
         *) echo "unsupported arch ${TARGETARCH}${TARGETVARIANT}" && exit 1 ;; \
       esac \
    && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip" -O /tmp/pb.zip \
    && unzip -q /tmp/pb.zip pocketbase -d /pb \
    && rm /tmp/pb.zip \
    && apk del .fetch

WORKDIR /pb
COPY --from=web /app/dist ./pb_public
COPY pb_migrations ./pb_migrations
COPY pb_hooks ./pb_hooks
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV TZ=Europe/Berlin
VOLUME /pb/pb_data
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD wget -qO- http://127.0.0.1:8090/api/health >/dev/null || exit 1

ENTRYPOINT ["/pb/docker-entrypoint.sh"]
