import { Module, type DynamicModule } from "@nestjs/common";
import { AuthModule } from "@api/features-auth";
import { ManagedModule } from "@api/features-managed";
import { WebhookModule } from "@api/features-webhook";
import { InfrastructureModule } from "@api/infrastructure";
import type { AppOptions } from "./app-options.js";
import { HealthController } from "./health.controller.js";

/** アプリ全体のルートモジュール（DI配線: 既存.NET側 Program.cs 相当）。 */
@Module({})
export class AppModule {
	/** 読み込み済みの設定を各Feature・infrastructureモジュールへ配って構成する。 */
	static register(options: AppOptions): DynamicModule {
		return {
			module: AppModule,
			imports: [
				InfrastructureModule.forRoot(options.infrastructure),
				AuthModule.register(options.auth),
				ManagedModule.register(options.managed),
				WebhookModule.register(options.webhook),
			],
			controllers: [HealthController],
		};
	}
}
