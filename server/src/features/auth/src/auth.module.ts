import { Module, type DynamicModule } from "@nestjs/common";
import { JWT_CONFIG, JwtAuthGuard } from "@api/shared";
import {
	AUTH_COOKIE_SECURE,
	AUTH_SERVICE_CONFIG,
	type AuthModuleOptions,
} from "./auth.constants.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";

/**
 * 認証Featureのモジュール。AUTH_REPOSITORYの実装はグローバルなinfrastructureモジュールから解決する。
 */
@Module({})
export class AuthModule {
	/** 管理者資格情報・JWT設定・Cookie属性を受け取ってモジュールを構成する。 */
	static register(options: AuthModuleOptions): DynamicModule {
		return {
			module: AuthModule,
			controllers: [AuthController],
			providers: [
				{ provide: AUTH_SERVICE_CONFIG, useValue: options.config },
				{ provide: AUTH_COOKIE_SECURE, useValue: options.cookieSecure },
				{ provide: JWT_CONFIG, useValue: options.config.jwt },
				AuthService,
				JwtAuthGuard,
			],
		};
	}
}
