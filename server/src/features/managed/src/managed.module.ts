import { Module, type DynamicModule } from "@nestjs/common";
import { JWT_CONFIG, JwtAuthGuard } from "@api/shared";
import type { ManagedModuleOptions } from "./managed.constants.js";
import { ManagedController } from "./managed.controller.js";
import { ManagedService } from "./managed.service.js";

/**
 * 管理画面向けFeatureのモジュール。MANAGED_REPOSITORYの実装はグローバルなinfrastructureモジュールから解決する。
 */
@Module({})
export class ManagedModule {
	/** アクセストークン検証用のJWT設定を受け取ってモジュールを構成する。 */
	static register(options: ManagedModuleOptions): DynamicModule {
		return {
			module: ManagedModule,
			controllers: [ManagedController],
			providers: [{ provide: JWT_CONFIG, useValue: options.jwt }, ManagedService, JwtAuthGuard],
		};
	}
}
