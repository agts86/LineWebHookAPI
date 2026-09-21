import {
	Inject,
	Injectable,
	UnauthorizedException,
	createParamDecorator,
	type CanActivate,
	type ExecutionContext,
} from "@nestjs/common";
import { AUTH_COOKIE_NAME } from "./cookies.js";
import { verifyAccessToken, type JwtConfig } from "./jwt.js";
import { readCookie, type RequestWithCookieHeader } from "./request-cookies.js";

/** JwtAuthGuardが検証に使うJwtConfigの注入トークン。 */
export const JWT_CONFIG = Symbol("JWT_CONFIG");

export interface AuthenticatedUser {
	userName: string;
}

export interface AuthenticatedRequest extends RequestWithCookieHeader {
	/** JwtAuthGuardが検証に成功したときにセットするログイン中ユーザー。 */
	user?: AuthenticatedUser;
}

/**
 * 既存.NET側 [Authorize] 相当のガード。
 * linewebhook_auth Cookieのアクセストークンを検証し、成功時はrequest.userをセットする。
 * 失敗時は401 { message: "Unauthorized." } を返す。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
	constructor(@Inject(JWT_CONFIG) private readonly jwtConfig: JwtConfig) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
		const accessToken = readCookie(request, AUTH_COOKIE_NAME);
		if (!accessToken) {
			throw new UnauthorizedException({ message: "Unauthorized." });
		}

		try {
			const { userName } = await verifyAccessToken(accessToken, this.jwtConfig);
			request.user = { userName };
		} catch {
			throw new UnauthorizedException({ message: "Unauthorized." });
		}

		return true;
	}
}

/** JwtAuthGuard通過後のログイン中ユーザーをコントローラーの引数に注入するパラメータデコレータ。 */
export const CurrentUser = createParamDecorator(
	(_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined =>
		context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
