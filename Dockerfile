# web ビルド
FROM node:24-bookworm-slim AS web-build
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
RUN corepack enable && corepack prepare pnpm@10.26.0 --activate
COPY . ./
RUN pnpm install --frozen-lockfile --filter line-webhook-ui
RUN pnpm --filter line-webhook-ui build

# server ビルド
FROM node:24-bookworm-slim AS server-build
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.26.0 --activate
COPY . ./
RUN pnpm install --frozen-lockfile --filter "@api/host..."
# host と依存パッケージのdistを生成する（NestのDIが使うデコレータメタデータはtscの出力に含まれるため、実行時はdistを使う）。
# tables の build スクリプト内で prisma generate も実行されるが、明示のため個別にも実行しておく。
RUN pnpm --filter "@api/host..." build
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
COPY --from=server-build /app /app
COPY --from=web-build /app/web/out ./wwwroot

ENTRYPOINT ["node", "dist/main.js"]
