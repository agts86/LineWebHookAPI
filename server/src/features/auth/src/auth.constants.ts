import type { AuthServiceConfig } from "./auth.service.js";

/** AuthRepository実装の注入トークン。実装はinfrastructure側が提供する。 */
export const AUTH_REPOSITORY = Symbol("AUTH_REPOSITORY");

/** AuthServiceConfigの注入トークン。 */
export const AUTH_SERVICE_CONFIG = Symbol("AUTH_SERVICE_CONFIG");

/** 認証CookieにSecure属性を付けるかどうかの注入トークン。 */
export const AUTH_COOKIE_SECURE = Symbol("AUTH_COOKIE_SECURE");

export interface AuthModuleOptions {
	/** 管理者資格情報・JWT設定・トークン有効期限。 */
	config: AuthServiceConfig;
	/** 認証CookieにSecure属性を付けるかどうか。HTTPのローカル開発ではfalseにする。 */
	cookieSecure: boolean;
}
