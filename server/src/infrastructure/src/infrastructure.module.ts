import { Global, Module, type DynamicModule, type Provider } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { AUTH_REPOSITORY } from "@api/features-auth";
import { MANAGED_REPOSITORY } from "@api/features-managed";
import {
	PARKING_CLIENT,
	PARKING_LINE_REPLY_CLIENT,
	SPOT_LINE_REPLY_CLIENT,
	SPOT_SEARCH_CLIENT,
	WEBHOOK_REPOSITORY,
} from "@api/features-webhook";
import { PrismaAuthRepository } from "./auth.repository.impl.js";
import { HttpAdapter } from "./http-adapter.js";
import { LineReplyClientImpl } from "./line-reply-client.impl.js";
import { PrismaManagedRepository } from "./managed.repository.impl.js";
import { ParkingClientImpl } from "./parking-client.impl.js";
import { getPrismaClient } from "./prisma-client.js";
import { PrismaWebhookRepository } from "./webhook.repository.impl.js";
import { YolpClientImpl } from "./yolp-client.impl.js";

/** PrismaClientシングルトンの注入トークン。 */
export const PRISMA_CLIENT = Symbol("PRISMA_CLIENT");

export interface InfrastructureModuleOptions {
	/** Yahoo!ローカルサーチAPI(YOLP)のアプリケーションID。 */
	yahooAppId: string;
	/** スポット検索用LINEチャンネルのChannel Access Token。 */
	spotLineChannelAccessToken: string;
	/** バイク駐車場検索用LINEチャンネルのChannel Access Token。 */
	parkingLineChannelAccessToken: string;
}

/** PrismaClientと、それを使う各featureのRepository実装のprovider一覧を返す。 */
function repositoryProviders(): Provider[] {
	return [
		{ provide: PRISMA_CLIENT, useFactory: getPrismaClient },
		{
			provide: AUTH_REPOSITORY,
			useFactory: (prisma: PrismaClient): PrismaAuthRepository => new PrismaAuthRepository(prisma),
			inject: [PRISMA_CLIENT],
		},
		{
			provide: MANAGED_REPOSITORY,
			useFactory: (prisma: PrismaClient): PrismaManagedRepository =>
				new PrismaManagedRepository(prisma),
			inject: [PRISMA_CLIENT],
		},
		{
			provide: WEBHOOK_REPOSITORY,
			useFactory: (prisma: PrismaClient): PrismaWebhookRepository =>
				new PrismaWebhookRepository(prisma),
			inject: [PRISMA_CLIENT],
		},
	];
}

/** HttpAdapterと、外部API（YOLP・jmpsa・LINE）クライアント実装のprovider一覧を返す。 */
function externalClientProviders(options: InfrastructureModuleOptions): Provider[] {
	return [
		{ provide: HttpAdapter, useFactory: (): HttpAdapter => new HttpAdapter() },
		{
			provide: SPOT_SEARCH_CLIENT,
			useFactory: (httpAdapter: HttpAdapter): YolpClientImpl =>
				new YolpClientImpl(httpAdapter, options.yahooAppId),
			inject: [HttpAdapter],
		},
		{
			provide: PARKING_CLIENT,
			useFactory: (httpAdapter: HttpAdapter): ParkingClientImpl =>
				new ParkingClientImpl(httpAdapter),
			inject: [HttpAdapter],
		},
		{
			provide: SPOT_LINE_REPLY_CLIENT,
			useFactory: (): LineReplyClientImpl =>
				new LineReplyClientImpl(options.spotLineChannelAccessToken),
		},
		{
			provide: PARKING_LINE_REPLY_CLIENT,
			useFactory: (): LineReplyClientImpl =>
				new LineReplyClientImpl(options.parkingLineChannelAccessToken),
		},
	];
}

/**
 * 各featureが宣言したRepository・外部APIクライアントの注入トークンに実装を束ねるグローバルモジュール。
 * featureはinfrastructureを参照できないため、依存の解決はこのモジュールをhostがimportすることで成立する。
 */
@Global()
@Module({})
export class InfrastructureModule {
	/** 外部APIの資格情報を受け取り、全トークンの実装を提供するモジュールを構成する。 */
	static forRoot(options: InfrastructureModuleOptions): DynamicModule {
		return {
			module: InfrastructureModule,
			providers: [...repositoryProviders(), ...externalClientProviders(options)],
			exports: [
				AUTH_REPOSITORY,
				MANAGED_REPOSITORY,
				WEBHOOK_REPOSITORY,
				SPOT_SEARCH_CLIENT,
				PARKING_CLIENT,
				SPOT_LINE_REPLY_CLIENT,
				PARKING_LINE_REPLY_CLIENT,
			],
		};
	}
}
