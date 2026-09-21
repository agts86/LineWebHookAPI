# web ビルド
FROM node:24-bookworm-slim AS web-build
WORKDIR /src/web
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
RUN corepack enable && corepack prepare pnpm@10.26.0 --activate
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm build

# server ビルド
FROM node:24-bookworm-slim AS server-build
WORKDIR /app/server
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.26.0 --activate
COPY server/ ./
RUN pnpm install --frozen-lockfile
# pnpm -r build で各パッケージのdistを生成する（NestのDIが使うデコレータメタデータはtscの出力に含まれるため、実行時はdistを使う）。
# tables の build スクリプト内で prisma generate も実行されるが、明示のため個別にも実行しておく。
RUN pnpm -r build
RUN pnpm --filter @api/tables exec prisma generate

# 実行環境
FROM node:24-bookworm-slim AS final
WORKDIR /app/server/src/host
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=80
EXPOSE 80
COPY --from=server-build /app/server /app/server
COPY --from=web-build /src/web/out ./wwwroot

ENTRYPOINT ["node", "dist/main.js"]
