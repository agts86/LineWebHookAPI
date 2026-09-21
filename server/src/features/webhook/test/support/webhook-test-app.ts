import { createHmac } from "node:crypto";
import { Global, Module, type INestApplication } from "@nestjs/common";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import request from "supertest";
import {
	PARKING_CLIENT,
	PARKING_LINE_REPLY_CLIENT,
	SPOT_LINE_REPLY_CLIENT,
	SPOT_SEARCH_CLIENT,
	WEBHOOK_REPOSITORY,
} from "../../src/webhook.constants.js";
import { WebhookModule } from "../../src/webhook.module.js";

export const SPOT_CHANNEL_SECRET = "test-spot-channel-secret";
export const PARKING_CHANNEL_SECRET = "test-parking-channel-secret";

type SupertestApp = Parameters<typeof request>[0];

@Global()
@Module({
	providers: [
		{ provide: WEBHOOK_REPOSITORY, useValue: {} },
		{ provide: SPOT_SEARCH_CLIENT, useValue: {} },
		{ provide: PARKING_CLIENT, useValue: {} },
		{ provide: SPOT_LINE_REPLY_CLIENT, useValue: {} },
		{ provide: PARKING_LINE_REPLY_CLIENT, useValue: {} },
	],
	exports: [
		WEBHOOK_REPOSITORY,
		SPOT_SEARCH_CLIENT,
		PARKING_CLIENT,
		SPOT_LINE_REPLY_CLIENT,
		PARKING_LINE_REPLY_CLIENT,
	],
})
class TestInfrastructureModule {}

/** 指定したchannelSecretでLINEと同じHMAC-SHA256署名(base64)を計算する。 */
export function signBody(body: string, channelSecret: string): string {
	return createHmac("sha256", channelSecret).update(body).digest("base64");
}

/** WebhookModuleを実サーバーと同じrawBody有効の構成で起動する。overrideでproviderを差し替えられる。 */
export async function createWebhookTestApp(
	override: (builder: TestingModuleBuilder) => TestingModuleBuilder,
	verifyLineSignature = true,
): Promise<{ app: INestApplication; agent: ReturnType<typeof request> }> {
	const builder = Test.createTestingModule({
		imports: [
			TestInfrastructureModule,
			WebhookModule.register({
				spotChannelSecret: SPOT_CHANNEL_SECRET,
				parkingChannelSecret: PARKING_CHANNEL_SECRET,
				verifyLineSignature,
				skipLineApiCall: true,
			}),
		],
	});
	const moduleRef = await override(builder).compile();
	const app = moduleRef.createNestApplication({ rawBody: true });
	await app.init();
	return { app, agent: request(app.getHttpServer() as SupertestApp) };
}
