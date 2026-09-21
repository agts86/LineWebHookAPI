# LineWebHookAPI

## 概要

LineChatBotのフック先に使うAPI<br/>

[近くのラーメン屋](https://lin.ee/sOGflWx)
[近くのバイク駐車場](https://lin.ee/xzQjD6s)

## 使用技術

■ 言語・FW<br>

-   TypeScript：NestJS（API, `server/`）
-   TypeScript：Next.js（UI）

■ DB

-   postgres（Prisma ORM）

■ コンテナ

-   docker | docker compose

■ その他<br>

-   YOLP API
-   Line Messaging API

## API構成（`server/`、pnpm workspace）

- `server/src/host` : NestJS の AppModule 組み立て / DI配線 / 起動設定
- `server/src/features/*` : Feature単位（auth / managed / webhook）の Router / Service / Dto
- `server/src/tables` : Prisma スキーマ
- `server/src/shared` : 共通 Validation / Utility / Interface
- `server/src/infrastructure` : Repository 実装 / Prisma Client / 外部APIクライアント

## 前提

1. YOLP APIのキーを取得済み
2. Line公式アカウント、Line Developerアカウント開設済み（デバッグ時は不要）

## 実行方法

1. 環境変数ファイルの作成

`server/src/host/.env.example`をコピーして`server/src/host/.env`を作成し、値を埋める。

  ```
  PORT=3001
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres?schema=public&sslmode=disable
  JWT_SECRET={32文字以上の任意の秘密鍵}
  JWT_ISSUER=LineWebHookAPI
  JWT_AUDIENCE=LineWebHookAdmin
  ADMIN_USERNAME={管理画面の管理者ユーザー名}
  ADMIN_PASSWORD={管理画面の管理者パスワード}
  ACCESS_TOKEN_EXPIRES_MINUTES=15
  REFRESH_TOKEN_EXPIRES_DAYS=7
  SPOT_LINE_CHANNEL_SECRET={取得したLine公式アカウントのチャンネルシークレット（グルメ検索bot用）}
  SPOT_LINE_CHANNEL_ACCESS_TOKEN={取得したLine Developersのチャネルアクセストークン（グルメ検索bot用）}
  YAHOO_APP_ID={取得したYOLPのAPIキー}
  DISABLE_LINE_SIGNATURE_VERIFICATION={署名検証を無効化する場合は`true`（デバッグ用途、未指定なら検証する）}
  BIKE_PARKING_LINE_CHANNEL_SECRET={バイク駐輪場検索bot用チャンネルシークレット}
  BIKE_PARKING_LINE_CHANNEL_ACCESS_TOKEN={バイク駐輪場検索bot用チャネルアクセストークン}
  ```

2. ビルド

  ```
      docker compose build
  ```
3. コンテナ起動（実行）
  ```
      docker compose up -d
  ```
4. コンテナ停止
  ```
      docker compose down
  ```

5. API確認

  http://localhost:3001/ui （Swagger UI、開発環境のみ）

6. UI確認

  http://localhost:3000/login/

7. DBスキーマ反映(初回だけ)
  ```
      docker compose exec server sh
      cd /app
      pnpm --filter @api/tables exec prisma db push
  ```

## UI 開発

Next.js 開発サーバーは `web/next.config.ts` の `rewrites` で `/api/:path*` を `API_BASE_URL`（未指定時は `http://localhost:3001`、api）へ中継する。  
api は Cookie の `Secure` 属性を `NODE_ENV === 'production'` で切り替えるため、開発時は HTTP で問題なく、証明書の設定は不要。

```bash
cd web
pnpm dev
```

認証は `Access Token 15分 + Refresh Token 7日`。  
UI は有効期限の5分前に `/api/v1/auth/refresh` を呼び、失敗時は `401` で再ログインへ遷移する。

## デプロイ

メイン経路は Vercel（Node.js Functions）。ルート直下の `api/index.ts`（`@api/vercel`パッケージ）が `server/src/host` の `createNodeRequestListener()`（NestJS アプリを初回リクエストで初期化し、Node標準の `(req, res)` 形式で処理する関数）をdefault exportし、`vercel.json` の `functions`/`rewrites` で `/api/*` と `/health` を単一 Function へルーティングする。NestJS（Express）が生のリクエストボディを読めるよう、`vercel.json` の `build.env` で `NODEJS_HELPERS=0`（Vercel の Node.js ヘルパー無効化）を指定している。`web/out`（静的出力）は `outputDirectory` としてそのまま配信する。

GHCR → Azure Web App 経路も別途稼働している。`Dockerfile` は multi-stage build で `web` をビルドし、生成物（`web/out`）を server コンテナの `wwwroot` に同梱する。  
そのため、コンテナビルド時の context はリポジトリルート（`.`）を使用する。
