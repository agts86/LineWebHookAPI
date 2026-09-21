import { describe, expect, it } from "vitest";
import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../src/jwt-auth.guard.js";
import { createAccessToken } from "../src/jwt.js";
import { AUTH_COOKIE_NAME } from "../src/cookies.js";

const jwtConfig = {
	secret: "test-jwt-secret-at-least-32-characters-long",
	issuer: "LineWebHookAPI",
	audience: "LineWebHookAdmin",
};

function buildContext(cookieHeader?: string): {
	context: ExecutionContext;
	request: AuthenticatedRequest;
} {
	const request: AuthenticatedRequest = { headers: { cookie: cookieHeader } };
	const context = {
		switchToHttp: (): { getRequest: () => AuthenticatedRequest } => ({
			getRequest: (): AuthenticatedRequest => request,
		}),
	} as unknown as ExecutionContext;
	return { context, request };
}

describe("JwtAuthGuard", () => {
	it("有効なアクセストークンがあれば通過し、userをリクエストにセットする", async () => {
		const guard = new JwtAuthGuard(jwtConfig);
		const { token } = await createAccessToken("admin", jwtConfig, 900);
		const { context, request } = buildContext(`${AUTH_COOKIE_NAME}=${token}`);

		await expect(guard.canActivate(context)).resolves.toBe(true);
		expect(request.user).toEqual({ userName: "admin" });
	});

	it("アクセストークンCookieが無ければUnauthorizedExceptionを投げる", async () => {
		const guard = new JwtAuthGuard(jwtConfig);
		const { context, request } = buildContext();

		await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
		expect(request.user).toBeUndefined();
	});

	it("不正なアクセストークンならUnauthorizedExceptionを投げる", async () => {
		const guard = new JwtAuthGuard(jwtConfig);
		const { context } = buildContext(`${AUTH_COOKIE_NAME}=invalid-token`);

		await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
	});

	it("期限切れのアクセストークンならUnauthorizedExceptionを投げる", async () => {
		const guard = new JwtAuthGuard(jwtConfig);
		const { token } = await createAccessToken("admin", jwtConfig, -60);
		const { context } = buildContext(`${AUTH_COOKIE_NAME}=${token}`);

		await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
	});

	it("401のレスポンスボディは既存契約どおり { message: 'Unauthorized.' } になる", async () => {
		const guard = new JwtAuthGuard(jwtConfig);
		const { context } = buildContext();

		const error = await guard.canActivate(context).catch((e: unknown) => e);

		expect((error as UnauthorizedException).getResponse()).toEqual({ message: "Unauthorized." });
	});
});
