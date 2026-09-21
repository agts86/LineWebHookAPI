import { Module, type DynamicModule } from "@nestjs/common";
import { ParkingLineSignatureGuard, SpotLineSignatureGuard } from "./line-signature.guard.js";
import { ParkingController } from "./parking/controller.js";
import { ParkingReplyService } from "./parking/reply.service.js";
import { SpotController } from "./spot/controller.js";
import { SpotReplyService } from "./spot/reply.service.js";
import { SpotService } from "./spot/service.js";
import {
	SKIP_LINE_API_CALL,
	WEBHOOK_MODULE_OPTIONS,
	type WebhookModuleOptions,
} from "./webhook.constants.js";

/**
 * LINE Webhook Featureのモジュール。Repository・外部APIクライアントの実装は
 * グローバルなinfrastructureモジュールから解決する。
 */
@Module({})
export class WebhookModule {
	/** LINEチャンネルごとのChannel Secretと署名検証・返信スキップの設定を受け取ってモジュールを構成する。 */
	static register(options: WebhookModuleOptions): DynamicModule {
		return {
			module: WebhookModule,
			controllers: [SpotController, ParkingController],
			providers: [
				{ provide: WEBHOOK_MODULE_OPTIONS, useValue: options },
				{ provide: SKIP_LINE_API_CALL, useValue: options.skipLineApiCall },
				SpotReplyService,
				SpotService,
				ParkingReplyService,
				SpotLineSignatureGuard,
				ParkingLineSignatureGuard,
			],
		};
	}
}
