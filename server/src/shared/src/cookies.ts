export const AUTH_COOKIE_NAME = "linewebhook_auth";
export const AUTH_REFRESH_COOKIE_NAME = "linewebhook_refresh";

export interface AuthCookieOptions {
	httpOnly: true;
	secure: boolean;
	sameSite: "strict";
	path: "/";
	expires: Date;
}

/**
 * 既存.NET側 AuthCookieOptionsFactory.Create と同じCookie属性を生成する。
 * secureはデフォルトtrue（本番相当）。ローカル開発でHTTP経由のSwagger UIから
 * Try it out するには、Secure Cookieがブラウザに保存されないため false を渡す必要がある。
 */
export function buildAuthCookieOptions(expiresAt: Date, secure = true): AuthCookieOptions {
	return {
		httpOnly: true,
		secure,
		sameSite: "strict",
		path: "/",
		expires: expiresAt,
	};
}
