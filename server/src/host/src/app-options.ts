import type { AuthModuleOptions } from "@api/features-auth";
import type { ManagedModuleOptions } from "@api/features-managed";
import type { WebhookModuleOptions } from "@api/features-webhook";
import type { InfrastructureModuleOptions } from "@api/infrastructure";

export interface AppOptions {
	/** 本番環境かどうか。falseのときのみOpenAPI JSONとSwagger UIを公開する。 */
	isProduction: boolean;
	infrastructure: InfrastructureModuleOptions;
	auth: AuthModuleOptions;
	managed: ManagedModuleOptions;
	webhook: WebhookModuleOptions;
}

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

function loadAuthOptions(isProduction: boolean): AuthModuleOptions {
	const jwtSecret = requireEnv("JWT_SECRET");
	if (jwtSecret.length < 32) {
		throw new Error("JWT_SECRET must be at least 32 characters.");
	}

	return {
		config: {
			adminUserName: requireEnv("ADMIN_USERNAME"),
			adminPassword: requireEnv("ADMIN_PASSWORD"),
			jwt: {
				secret: jwtSecret,
				issuer: process.env.JWT_ISSUER ?? "LineWebHookAPI",
				audience: process.env.JWT_AUDIENCE ?? "LineWebHookAdmin",
			},
			accessTokenExpiresInSeconds: Number(process.env.ACCESS_TOKEN_EXPIRES_MINUTES ?? "15") * 60,
			refreshTokenExpiresInSeconds: Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? "7") * 86400,
		},
		cookieSecure: isProduction,
	};
}

/**
 * 環境変数から全モジュールの設定を読み込む。必須の環境変数が無ければ起動時に例外を投げる。
 * 本番以外ではSecure Cookieを外し（HTTPのSwagger UIからログイン状態を維持するため）、
 * LINEへの実際の返信APIコールをスキップする（既存.NET側の IsDevelopment() 分岐と同じ考え方）。
 * LINE署名検証はNODE_ENVに連動させず、DISABLE_LINE_SIGNATURE_VERIFICATION=true のときのみ無効化する。
 */
export function loadAppOptions(): AppOptions {
	const isProduction = process.env.NODE_ENV === "production";
	const auth = loadAuthOptions(isProduction);

	return {
		isProduction,
		infrastructure: {
			yahooAppId: requireEnv("YAHOO_APP_ID"),
			spotLineChannelAccessToken: requireEnv("SPOT_LINE_CHANNEL_ACCESS_TOKEN"),
			parkingLineChannelAccessToken: requireEnv("BIKE_PARKING_LINE_CHANNEL_ACCESS_TOKEN"),
		},
		auth,
		managed: { jwt: auth.config.jwt },
		webhook: {
			spotChannelSecret: requireEnv("SPOT_LINE_CHANNEL_SECRET"),
			parkingChannelSecret: requireEnv("BIKE_PARKING_LINE_CHANNEL_SECRET"),
			verifyLineSignature: process.env.DISABLE_LINE_SIGNATURE_VERIFICATION !== "true",
			skipLineApiCall: !isProduction,
		},
	};
}
