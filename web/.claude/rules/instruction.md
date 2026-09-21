# LineWebHook web (Next.js) 設計原則・コーディング規約指示書

## 1. 目的と前提

このドキュメントは `web/` 配下のフロントエンド実装ルールを定義する。
対象は Next.js（TypeScript）であり、最終成果物は Azure App Service 上の **単一コンテナ** で配信する。

### 前提アーキテクチャ

- バックエンド API: `server/src/host`（NestJS / TypeScript）
- フロントエンド: `web/`（Next.js）
- デプロイ構成: 1コンテナで API と静的フロントを同居
- Next.js は `output: 'export'` による静的出力を利用し、実行時は CSR（SPA）として動作

## 2. レンダリング方針（必須）

### ✅ やるべきこと

- CSR（Client Side Rendering）を前提に画面を作る
- ページは静的出力可能な実装にする
- データ取得はブラウザから API を呼び出して行う（初期表示後の fetch）
- 画面保護（ログイン必須判定）はクライアント側で実施する

### ❌ やってはいけないこと

- SSR 前提機能に依存する（`getServerSideProps` 相当の設計）
- Next.js Route Handler (`app/api/...`) を認証の本体として使う
- Server Actions を必須にする構成を採用する
- サーバー専用 API（Node 実行前提）を UI 側の必須要件にする

## 3. ディレクトリ設計

### 推奨構成

```text
web/
  src/
    app/
      (auth)/login/page.tsx
      (dashboard)/dashboard/page.tsx
      layout.tsx
      page.tsx
    components/
      ui/
      logs/
      map/
    features/
      auth/
      gourmet-location/
      gourmet-word/
      error-log/
      job-log/
    hooks/
    lib/
      api/
      auth/
      constants/
      utils/
    types/
  public/
```

### ルール

- 画面固有処理は `features/` に集約する
- API 通信は `lib/api/` に集約し、UI コンポーネントから直接 `fetch` を乱立させない
- 共通型は `types/` または各 feature 内に置き、重複定義を避ける
- 共通 UI は `components/ui/`、業務 UI は `components/logs/` など用途別に分ける

## 4. 機能要件の実装方針

### 対象画面

- ログイン（Admin 用）
- 実行ログ / ロケーション（地図へ pin 表示）
- 実行ログ / ワード
- エラーログ
- ジョブログ

### API 対応

- `GET /api/v1/managed/gourmet/location`
- `GET /api/v1/managed/gourmet/text`
- `GET /api/v1/managed/error-log`
- `GET /api/v1/managed/job-log`

### データ取得ルール

- API クライアントは `lib/api/managed-client.ts` などに集約する
- React Query / TanStack Query を使う場合は Query Key を feature 単位で定義する
- エラー表示は「再試行導線」とセットで実装する

## 5. 認証・認可（管理者専用）

### ✅ やるべきこと

- 管理者単一アカウントを前提に認証設計する
- 認証の主処理は API 側に寄せる（推奨: Cookie または JWT）
- UI 側はログイン状態を判定して未認証時は `/login` へ遷移する
- 認証情報をブラウザ保存する場合は安全性を優先し、可能なら HttpOnly Cookie を選ぶ

### ❌ やってはいけないこと

- 管理者パスワードを UI ソースへハードコードする
- 平文トークンをログ出力する
- 認証判定を画面ごとにバラバラ実装する

## 6. 地図表示（ロケーションログ）

### ✅ やるべきこと

- `react-leaflet` など CSR 向けライブラリを採用する
- `window` 依存のある地図コンポーネントは dynamic import で SSR 無効化する
- 緯度経度 (`lat`, `lng`) のバリデーションを行ってから pin を描画する
- ログ件数が多い場合はクラスタリング導入を検討する

### ❌ やってはいけないこと

- 座標不正データを無条件で描画してクラッシュさせる
- 毎レンダーで全 pin を再生成する実装にする

## 7. コーディング規約（TypeScript / React）

### ✅ やるべきこと

- TypeScript は `strict` 前提で実装する
- `any` は原則禁止。必要時は理由をコメントで明記する
- すべての公開関数で戻り値型を明示する
- 早期 return でネストを浅く保つ
- 1関数1責務を維持する
- 型のみ import は `import type` を使う

### ❌ やってはいけないこと

- 画面コンポーネント内に API 呼び出しと整形ロジックを過密に詰め込む
- `@ts-ignore` に依存して型エラーを回避する
- 長大な条件分岐を放置する

## 8. UI/UX 原則

### ✅ やるべきこと

- ログ一覧は時刻・検索条件の視認性を優先する
- ローディング、空データ、エラーの 3 状態を必ず実装する
- モバイル幅でも操作できる最低限のレスポンシブを担保する
- フィルタ条件と表示件数を明示する

### ❌ やってはいけないこと

- 正常時 UI のみ実装して異常系表示を省略する
- テーブルの横スクロールだけに依存して可読性を落とす

## 9. ビルド・配信ルール（単一コンテナ）

### ✅ やるべきこと

- `next build` で静的出力を生成する（`out/`）
- コンテナビルド時に `web/out` を API 側の静的配信ディレクトリ（例: `wwwroot/`）へコピーする
- API 側で SPA fallback（未知パスは `index.html`）を設定する
- API へのアクセスは同一オリジンを基本とし、不要な CORS 設定を増やさない

### ❌ やってはいけないこと

- 実行時に Next.js Node サーバーを別プロセスで常駐させる前提にする
- UI と API を別ホスト前提で固定してしまう

## 9.1 開発時のAPI連携（Next.js dev）

### ✅ やるべきこと

- 開発時は `web/next.config.ts` の `rewrites` で `/api/:path*` を `API_BASE_URL`（未指定時は `http://localhost:3001`、api）へ中継する
- api はCookieの `Secure` 属性を `NODE_ENV === 'production'` で切り替える設計のため、開発時（api宛て）はHTTPで問題ない。自己署名証明書やCA設定は不要

### ❌ やってはいけないこと

- `NODE_TLS_REJECT_UNAUTHORIZED=0` を常用する

## 10. 品質保証・必須コマンド

コード修正後は必ず以下を実行する。

```bash
pnpm lint
pnpm build
pnpm test
```

### 追加確認

- 主要画面の手動確認（`/login`, `/dashboard`）
- API 失敗時の表示確認（ネットワークエラー・401・500）
- 地図画面で pin 表示と件数の整合確認

## 11. コミュニケーション規約

- 説明・提案・レビューは日本語で行う
- 断定時は前提と根拠を併記する
- 未実施の作業は「未実施理由」と「次の実行手順」を必ず記載する

---

この規約は、`web/` を Next.js CSR SPA として安定運用し、単一コンテナで API と一体配信するための基準である。
設計判断に迷う場合は「静的配信できるか」「管理者専用として過不足ないか」「保守しやすいか」を優先して決定する。
