import {
	Body,
	Controller,
	Get,
	HttpCode,
	Inject,
	Post,
	Res,
	StandardSchemaValidationPipe,
	UseFilters,
	UseGuards,
	UsePipes,
} from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import {
	AUTH_COOKIE_NAME,
	AUTH_REFRESH_COOKIE_NAME,
	Cookies,
	CurrentUser,
	JwtAuthGuard,
	buildAuthCookieOptions,
	type AuthenticatedUser,
} from "@api/shared";
import { AUTH_COOKIE_SECURE } from "./auth.constants.js";
import { AuthService, type LoginResult } from "./auth.service.js";
import {
	ErrorResponseSchema,
	LoginRequestSchema,
	LoginResponseSchema,
	MeResponseSchema,
	type LoginRequest,
	type LoginResponse,
	type MeResponse,
} from "./auth.dto.js";
import { UnauthorizedErrorFilter } from "./unauthorized-error.filter.js";

function toLoginResponse(result: LoginResult): LoginResponse {
	return {
		userName: result.userName,
		expiresAt: result.accessTokenExpiresAt.toISOString(),
	};
}

/** login/refresh/logout/me を実装するコントローラー。ホスト側の設定で /api/v1/auth に公開される。 */
@ApiTags("Auth")
@Controller({ path: "auth", version: "1" })
@UseFilters(UnauthorizedErrorFilter)
@UsePipes(StandardSchemaValidationPipe)
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		@Inject(AUTH_COOKIE_SECURE) private readonly cookieSecure: boolean,
	) {}

	@Post("login")
	@HttpCode(200)
	@ApiResponse({
		status: 200,
		description: "ログイン成功。linewebhook_auth / linewebhook_refresh Cookieを発行する",
		standardSchema: LoginResponseSchema,
	})
	@ApiResponse({
		status: 401,
		description: "ユーザー名またはパスワードが不正",
		standardSchema: ErrorResponseSchema,
	})
	async login(
		@Body({ schema: LoginRequestSchema }) body: LoginRequest,
		@Res({ passthrough: true }) response: Response,
	): Promise<LoginResponse> {
		const result = await this.authService.login(body.userName, body.password);
		this.setAuthCookies(response, result);
		return toLoginResponse(result);
	}

	@Post("refresh")
	@HttpCode(200)
	@ApiResponse({
		status: 200,
		description: "リフレッシュ成功。トークンをローテーションする",
		standardSchema: LoginResponseSchema,
	})
	@ApiResponse({
		status: 401,
		description: "リフレッシュトークンが無効・期限切れ・未指定",
		standardSchema: ErrorResponseSchema,
	})
	async refresh(
		@Cookies(AUTH_REFRESH_COOKIE_NAME) refreshToken: string | undefined,
		@Res({ passthrough: true }) response: Response,
	): Promise<LoginResponse> {
		const result = await this.authService.refresh(refreshToken);
		this.setAuthCookies(response, result);
		return toLoginResponse(result);
	}

	@Post("logout")
	@HttpCode(204)
	@ApiResponse({ status: 204, description: "ログアウト成功（常に成功する、冪等）" })
	async logout(
		@Cookies(AUTH_REFRESH_COOKIE_NAME) refreshToken: string | undefined,
		@Res({ passthrough: true }) response: Response,
	): Promise<void> {
		await this.authService.logout(refreshToken);
		response.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
		response.clearCookie(AUTH_REFRESH_COOKIE_NAME, { path: "/" });
	}

	@Get("me")
	@UseGuards(JwtAuthGuard)
	@ApiResponse({
		status: 200,
		description: "ログイン中のユーザー情報",
		standardSchema: MeResponseSchema,
	})
	@ApiResponse({
		status: 401,
		description: "アクセストークンが無効・未指定",
		standardSchema: ErrorResponseSchema,
	})
	me(@CurrentUser() user: AuthenticatedUser): MeResponse {
		return { userName: user.userName };
	}

	private setAuthCookies(response: Response, result: LoginResult): void {
		response.cookie(
			AUTH_COOKIE_NAME,
			result.accessToken,
			buildAuthCookieOptions(result.accessTokenExpiresAt, this.cookieSecure),
		);
		response.cookie(
			AUTH_REFRESH_COOKIE_NAME,
			result.refreshToken,
			buildAuthCookieOptions(result.refreshTokenExpiresAt, this.cookieSecure),
		);
	}
}
