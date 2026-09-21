import type { JwtConfig } from "@api/shared";

/** ManagedRepository実装の注入トークン。実装はinfrastructure側が提供する。 */
export const MANAGED_REPOSITORY = Symbol("MANAGED_REPOSITORY");

export interface ManagedModuleOptions {
	/** アクセストークン検証に使うJWT設定。 */
	jwt: JwtConfig;
}
