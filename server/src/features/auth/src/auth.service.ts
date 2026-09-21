import { timingSafeEqual, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { createAccessToken, hashToken, type JwtConfig } from "@api/shared";
import { AUTH_REPOSITORY, AUTH_SERVICE_CONFIG } from "./auth.constants.js";
import type { AuthRepository } from "./auth.repository.js";

export class UnauthorizedError extends Error {}

export interface AuthServiceConfig {
	adminUserName: string;
	adminPassword: string;
	jwt: JwtConfig;
	accessTokenExpiresInSeconds: number;
	refreshTokenExpiresInSeconds: number;
}

export interface LoginResult {
	userName: string;
	accessToken: string;
	accessTokenExpiresAt: Date;
	refreshToken: string;
	refreshTokenExpiresAt: Date;
}

/** .NET側 AuthService.IsMatch (FixedTimeEquals) と同じ定数時間比較 */
function timingSafeEqualString(expected: string, actual: string): boolean {
	const expectedBuf = Buffer.from(expected, "utf8");
	const actualBuf = Buffer.from(actual, "utf8");
	if (expectedBuf.length !== actualBuf.length) return false;
	return timingSafeEqual(expectedBuf, actualBuf);
}

/** 既存.NET側 AuthService と同じ振る舞いを持つ認証サービス */
@Injectable()
export class AuthService {
	constructor(
		@Inject(AUTH_REPOSITORY) private readonly repo: AuthRepository,
		@Inject(AUTH_SERVICE_CONFIG) private readonly config: AuthServiceConfig,
	) {}

	async login(userName: string, password: string): Promise<LoginResult> {
		const isValid =
			timingSafeEqualString(this.config.adminUserName, userName) &&
			timingSafeEqualString(this.config.adminPassword, password);
		if (!isValid) {
			throw new UnauthorizedError("Invalid user name or password.");
		}

		const tokens = await this.buildTokens(userName);
		// 全削除+新規作成をアトミックに行う（.NET側の RevokeAll + Add + SaveChanges 相当）
		await this.repo.replaceUserTokens(userName, {
			userName,
			tokenHash: hashToken(tokens.refreshToken),
			expiresAt: tokens.refreshTokenExpiresAt,
		});
		return tokens;
	}

	async refresh(refreshToken: string | undefined): Promise<LoginResult> {
		if (!refreshToken) {
			throw new UnauthorizedError("Unauthorized.");
		}

		const stored = await this.repo.findByTokenHash(hashToken(refreshToken));
		if (!stored) {
			throw new UnauthorizedError("Unauthorized.");
		}

		if (stored.expiresAt.getTime() <= Date.now()) {
			await this.repo.revoke(stored.id);
			throw new UnauthorizedError("Unauthorized.");
		}

		const tokens = await this.buildTokens(stored.userName);
		// 旧トークン削除+新規作成をアトミックに行う（ローテーション）
		await this.repo.rotateToken(stored.id, {
			userName: stored.userName,
			tokenHash: hashToken(tokens.refreshToken),
			expiresAt: tokens.refreshTokenExpiresAt,
		});
		return tokens;
	}

	async logout(refreshToken: string | undefined): Promise<void> {
		if (!refreshToken) return;

		const stored = await this.repo.findByTokenHash(hashToken(refreshToken));
		if (!stored) return;

		await this.repo.revoke(stored.id);
	}

	private async buildTokens(userName: string): Promise<LoginResult> {
		const access = await createAccessToken(
			userName,
			this.config.jwt,
			this.config.accessTokenExpiresInSeconds,
		);
		const refreshToken = randomBytes(64).toString("base64url");
		const refreshTokenExpiresAt = new Date(
			Date.now() + this.config.refreshTokenExpiresInSeconds * 1000,
		);

		return {
			userName,
			accessToken: access.token,
			accessTokenExpiresAt: access.expiresAt,
			refreshToken,
			refreshTokenExpiresAt,
		};
	}
}
