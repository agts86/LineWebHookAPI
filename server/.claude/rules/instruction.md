# server 設計原則・コーディング規約指示書

## 1. 目的

このドキュメントは `server/` 配下の実装ルールを定義する。
対象は NestJS（TypeScript、Express、ESM）で実装するAPIで、`API/`（.NET）からストラングラーフィグ移行で置き換えたもの（移行完了済み、旧`API/`は削除済み）。
`API/`の5プロジェクト分割（Host/Features/Tables/Shared/Infrastructure）と同じ考え方を、pnpm workspaceの複数パッケージで再現する。

**重要**: レイヤ・Feature間の分離は、書面のルールだけに頼らない。`API/`の5プロジェクト分割が「Controller/ServiceからDbContextを直接使わせない」ために物理的な壁（コンパイラのプロジェクト参照）として機能しているのと同じ理由で、`server/`でも**各パッケージの`package.json`の`dependencies`を物理的な壁として使う**。pnpmはデフォルトで`node_modules`をhoistしないため、パッケージが宣言していない依存はimportしようとした時点で解決できずビルド/実行が失敗する（lintより強い、コンパイルエラー相当の強制力）。

## 1.2 Node組み込み型（`@types/node`）

- `node:crypto`や`process`など Node.js 組み込みAPIを使うパッケージは、`@types/node`を**自分自身の`package.json`のdevDependenciesに**宣言する（ルートにあるだけでは各パッケージから見えない、pnpmの厳格な依存分離のため）
- `tsconfig.base.json`に`"types": ["node"]`を明示している。`composite: true`のプロジェクト参照構成では、`@types`配下の自動検出が働かない場合があるため、自動検出に頼らず明示する

## 1.1 MUSTルール（最優先）

- すべての作業完了後に `pnpm test`（workspace全体）を必ず実行する
- 実装前にテストを書く（TDD）。テストが無い状態で実装コードを追加しない
- 新しいパッケージ間の依存を追加する前に、本ドキュメントの依存方向ルール（4章）に違反しないか確認する
- 実行できなかった場合は、理由を必ず記録する

## 2. ディレクトリ構成

```
server/
  src/
    host/                  # ~ API/Host: 起動・DI配線（Program.cs相当）
      src/
        app-options.ts         # 環境変数の読み込み（全モジュールの設定をここで組み立てる）
        app.module.ts            # ルートモジュール。infrastructureと各featureのモジュールをimportする
        create-app.ts              # Nestアプリ生成（/apiプレフィックス・URIバージョニング・Swagger）。listenしない
        request-listener.ts          # サーバーレス向けの (req, res) ハンドラ（Vercelのapi/index.tsが使う）
        main.ts                        # サーバー起動エントリポイント（listen・静的ファイル配信）
    features/
      auth/                  # ~ API/Features/Auth
        src/
          auth.module.ts          # Featureモジュール（register(options)で設定を受け取る）
          auth.controller.ts        # コントローラー（HTTP入出力のみ）
          auth.service.ts             # ビジネスロジック（@Injectable）
          auth.repository.ts            # インターフェースのみ（実装を持たない）
          auth.constants.ts               # 注入トークン（AUTH_REPOSITORY等）とモジュールオプション型
          auth.dto.ts                       # Zodスキーマ
        test/
      managed/                # ~ API/Features/Managed（実装済み）。auth/と同じ形
      webhook/                  # 実装済み（LINE Webhook受信、parking/spotサブ機能を含む）。auth/と同じ形
    tables/                 # ~ API/Tables: Prismaスキーマ・生成される型
      prisma/schema.prisma
    shared/                  # ~ API/Shared: 共通utility（jwt.ts, cookies.ts, hash.ts, jwt-auth.guard.ts, request-cookies.ts, openapi-schema.ts）
      src/
      test/
    infrastructure/           # ~ API/Infrastructure: featuresのrepositoryインターフェースをPrismaで実装し、InfrastructureModuleで注入トークンへ束ねる
      src/
  pnpm-workspace.yaml
  package.json              # ルート、workspace全体のスクリプト
```

## 3. パッケージ命名

- `@api/host`, `@api/features-auth`, `@api/tables`, `@api/shared`, `@api/infrastructure` のように`@api/`スコープで統一する

## 4. 依存方向ルール（`API/`のプロジェクト参照ルールと1:1対応、`package.json`の`dependencies`で強制する）

| パッケージ | 依存してよいもの | 依存してはいけないもの |
|---|---|---|
| `features/*` | `tables`（型のみ）, `shared` | `infrastructure`, `@prisma/client`, 他の`features/*` |
| `infrastructure` | `tables`, `shared`, `features/*`（interfaceの型を知るため） | — |
| `host` | `features/*`, `infrastructure`, `shared` | — |
| `tables` | （なし、最内層） | — |
| `shared` | （なし、最内層） | — |

- `features/auth`が`infrastructure`や`@prisma/client`をimportしたくなった場合、それは設計違反のサイン。`auth.repository.ts`にインターフェースを追加し、`infrastructure`側で実装する
- Serviceはインターフェース（`AuthRepository`等）に依存する。TypeScriptのインターフェースは実行時に消えるため型ベースDIでは解決できず、**featureが注入トークン（`AUTH_REPOSITORY`等のSymbol）を宣言し、`@Inject(トークン)`で受け取る**。実装の束ね先は`infrastructure`の`InfrastructureModule`（`@Global()`、`forRoot(options)`）で、`host`の`AppModule`がそれをimportすることで解決が成立する（featureはinfrastructureを参照しないまま）
- クラス同士の依存（Controller→Service、Service→Service）は型ベースDIを使う。このとき依存先クラスは`import type`ではなく通常の`import`にする（`import type`だと`emitDecoratorMetadata`が型情報を出力できず実行時に解決失敗する）
- 環境変数を読むのは`host/src/app-options.ts`だけ。各モジュールへは`register(options)` / `forRoot(options)`で値を渡す
- Feature間（例: `features/auth`が`features/managed`を参照する）は禁止。共有したいロジックがあれば`shared`に上げる

## 5. バージョニング

- NestのURIバージョニングを使う。`host/src/create-app.ts`で`setGlobalPrefix("api", { exclude: ["health"] })`と`enableVersioning({ type: VersioningType.URI })`を設定し、各コントローラーは`@Controller({ path: "<resource>", version: "1" })`で宣言する（公開URLは`/api/v1/<resource>`）
- 新バージョンが必要になったら、既存コントローラーをコピーせず新規ファイルを作り並行稼働させる
- featureのテスト（`Test.createTestingModule`）ではプレフィックスもバージョニングも有効化しないため、URLは`/<resource>/...`になる。`/api/v1/...`での検証は`host/test/app.test.ts`で行う

## 6. OpenAPI / Swagger

- リクエスト/レスポンスは各featureの`*.dto.ts`のZodスキーマで定義し、バリデーションとOpenAPI仕様生成の両方に使い回す
- リクエストは`@Body({ schema })` / `@Query({ schema })` / `@Param({ schema })`にZodスキーマを渡す。**これだけではスキーマがメタデータに載るだけで検証されない**ため、コントローラーに必ず`@UsePipes(StandardSchemaValidationPipe)`を付ける（付け忘れると不正な入力が素通りする）。スキーマ違反で400になるテストを各コントローラーに1本は置く
- レスポンスは`@ApiResponse({ status, description, standardSchema: <Zodスキーマ> })`で宣言する
- OpenAPI上のスキーマ名と例示値は、`shared`の`withOpenApi(schema, { name, example })`でDTOに紐づける（`@hono/zod-openapi`時代の`.openapi("Name")` / `.openapi({ example })`相当）。`name`を付けたスキーマは`components.schemas`に登録され`$ref`で参照される。`example`はフィールド単位で付けられ、型は対象スキーマの入力型に拘束される。`withOpenApi`は同じスキーマをそのまま返すだけでバリデーションには影響しない。スキーマ名の重複は起動時に例外になる
- パス/クエリのパラメータ用スキーマ（`MessageTypeParamSchema`等）には`name`を付けない（`$ref`になるとパラメータへ個別展開されなくなるため）
- `/doc`でOpenAPI JSON、`/ui`でSwagger UIを公開する（`@nestjs/swagger`、本番では公開しない）。Zod→OpenAPIの変換は`host/src/swagger.ts`の`standardSchemaConverter`で行う。この変換関数は素のJSON Schemaではなく`{ schema }`の形で返すこと（形を間違えると黙ってフォールバックし、全DTOが空の`Object`スキーマになる）

## 7. 認可（JWT検証）

- 認証必須エンドポイントは、`shared`の`JwtAuthGuard`（`@UseGuards(JwtAuthGuard)`）で保護する。エンドポイントごとに検証コードを書き直さない。ログイン中ユーザーは`@CurrentUser()`で受け取る
- `JwtAuthGuard`を使うモジュールは`JWT_CONFIG`トークンと`JwtAuthGuard`自体をprovidersに登録する
- CookieはアプリレベルのミドルウェアUse（cookie-parser）に依存させず、`shared`の`@Cookies(name)` / `readCookie()`がCookieヘッダーを直接読む（ミドルウェア登録漏れで全リクエストが401になる事故を防ぐため）
- ガードは`.NET`側`[Authorize]`と同じ検証項目（署名・issuer・audience・有効期限・clockSkew）を満たすこと
- LINE署名検証は`features/webhook`の`SpotLineSignatureGuard` / `ParkingLineSignatureGuard`で行う。生ボディが必要なため、アプリ生成時に`rawBody: true`を必ず指定する（`host/src/create-app.ts`、テストでは`createNestApplication({ rawBody: true })`）。生ボディが取れない構成では検証をすり抜けさせず401にする
- JWT発行・検証ロジックは`shared/src/jwt.ts`に集約する

## 8. エラーハンドリング

- 認可エラーはNest組み込みの`UnauthorizedException`等を投げる。既存のレスポンス契約（`{ "message": "Unauthorized." }`）を保つため、メッセージ文字列ではなくオブジェクト（`new UnauthorizedException({ message: "Unauthorized." })`）を渡す
- Serviceが投げる業務例外（`UnauthorizedError`等）は、feature内の例外フィルタ（`@Catch` + `@UseFilters`）でHTTPレスポンスへ変換する。ServiceからNestのHTTP例外を直接投げない
- エラーメッセージは原因が追える内容にする（既存.NET側`Shared/Exceptions`の方針を踏襲）

## 9. コーディングスタイル

- Publicな関数は戻り値の型を明示する
- `any`は使わない。型が絞れない場合はZodスキーマから`z.infer`で導出する
- 1関数1責務を維持する。50行を超えたら分割を検討する

## 10. テスト

- フレームワーク: Vitest（workspace root から `pnpm -r test` で全パッケージ横断実行）
- デコレータを含むパッケージの`vitest.config.ts`には`unplugin-swc`を必ず入れる（`plugins: [swc.vite({ module: { type: "es6" } })]`）。Vitest標準のesbuildは`emitDecoratorMetadata`を出力しないため、無いと型ベースDIがテスト時だけ解決できなくなる。同じ理由で開発時の実行も`tsx`ではなく`node --import @swc-node/register/esm-register`を使う（本番は`tsc`の出力`dist/main.js`を実行する）
- ユニットテスト: `shared/`配下の純粋関数（JWT生成/検証、Cookie属性生成、ハッシュ化）はDBなしでテストする
- 統合テスト: `features/*/test/*.controller.test.ts`は`@nestjs/testing`の`Test.createTestingModule` + `supertest`で、`infrastructure/test/*.impl.test.ts`は実際のPrisma Clientを通してテストする（モックしない）。featureのテストでは、注入トークンの実装を`@Global()`なテスト用モジュール（インメモリ実装）で与える。DBは`tables/test-support/`のvitest `globalSetup`が`localhost:5433`（開発用DBの5432とは別ポート）にPGlite（WASM版Postgres、`@electric-sql/pglite` + `@electric-sql/pglite-socket`）を自動起動するため、`docker-compose.yml`のPostgresを手動起動する必要はない（`.NET`版がEF CoreのSQLite in-memoryでDBレスにテストしていたのと同じ発想。ただしスキーマがPostgreSQL固有型（`@db.Uuid`等）に依存しているためSQLiteではなくPostgres互換のPGliteを使う）。ポートをあえて開発用DBと分けているのは、テストの`deleteMany()`等で開発用DBのデータを壊さないため（「空いていればPGlite、埋まっていれば既存DBを使う」というフォールバックはしない）。CI（`.github/workflows/ServerUniTest.yml`）は本番相当の実PostgreSQLを使い続ける。`tables`/`infrastructure`の`.env`のDATABASE_URLに`connection_limit=1&pgbouncer=true`が必須（PGliteは複数コネクションでのprepared statement名前空間分離に対応しないため）。`host/.env`は開発時のアプリ起動用のため5432のまま・上記パラメータなしでよい
- 既存`API/Test/`にある期待仕様と振る舞いが一致することを、移行対象ごとに確認する

## 11. 環境変数

- 秘密情報（`JWT_SECRET`, `ADMIN_PASSWORD`, `DATABASE_URL`等）はコードにハードコードしない。`.env.example`に必要なキー名だけを記載し、値は空にする
- 既存.NET側の設定キー（`Auth:JwtKey`等）と対応する環境変数名は、実装コードのコメントで対応関係を明示する

## 12. コミュニケーション規約

- 説明・提案・レビューは日本語で行う
- 未実施の作業は「未実施理由」と「次の実行手順」を必ず記載する
