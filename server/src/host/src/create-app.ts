import { VersioningType, type NestApplicationOptions } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { loadAppOptions } from "./app-options.js";
import { AppModule } from "./app.module.js";
import { setupSwagger } from "./swagger.js";

export interface CreateAppOptions {
	/** Nestのロガー設定。テストではfalseを渡して起動ログを抑止する。 */
	logger?: NestApplicationOptions["logger"];
	/** 初期化前に実行する実行環境固有の追加設定（静的ファイル配信など）。 */
	configure?: (app: NestExpressApplication) => void;
}

/**
 * Nestアプリを組み立てて初期化する。listenは呼び出し側（main.tsやサーバーレスのエントリ）に委ねる。
 * 全ルートは /api/v{version}/... で公開し、/health のみプレフィックスの対象外にする。
 * OpenAPI JSON(/doc)とSwagger UI(/ui)は本番でAPI仕様を外部に露出させないため、本番では公開しない。
 */
export async function createApp(options: CreateAppOptions = {}): Promise<NestExpressApplication> {
	const appOptions = loadAppOptions();
	const app = await NestFactory.create<NestExpressApplication>(AppModule.register(appOptions), {
		rawBody: true,
		logger: options.logger,
	});

	app.setGlobalPrefix("api", { exclude: ["health"] });
	app.enableVersioning({ type: VersioningType.URI });
	if (!appOptions.isProduction) {
		setupSwagger(app);
	}
	options.configure?.(app);

	await app.init();
	return app;
}
