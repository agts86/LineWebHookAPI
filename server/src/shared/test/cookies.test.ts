import { describe, expect, it } from "vitest";
import {
	AUTH_COOKIE_NAME,
	AUTH_REFRESH_COOKIE_NAME,
	buildAuthCookieOptions,
} from "../src/cookies.js";

describe("AUTH_COOKIE_NAME / AUTH_REFRESH_COOKIE_NAME", () => {
	it("既存.NET側のCookie名と一致する", () => {
		expect(AUTH_COOKIE_NAME).toBe("linewebhook_auth");
		expect(AUTH_REFRESH_COOKIE_NAME).toBe("linewebhook_refresh");
	});
});

describe("buildAuthCookieOptions", () => {
	it("既存.NET側(AuthCookieOptionsFactory)と同じCookie属性を返す（デフォルトはsecure: true）", () => {
		const expiresAt = new Date("2026-08-01T00:00:00.000Z");

		const options = buildAuthCookieOptions(expiresAt);

		expect(options).toMatchObject({
			httpOnly: true,
			secure: true,
			sameSite: "strict",
			path: "/",
		});
		expect(options.expires).toEqual(expiresAt);
	});

	it("secure=falseを明示すればHTTP経由のローカル開発でもCookieを送信できるようにする", () => {
		const expiresAt = new Date("2026-08-01T00:00:00.000Z");

		const options = buildAuthCookieOptions(expiresAt, false);

		expect(options.secure).toBe(false);
		expect(options.httpOnly).toBe(true);
		expect(options.sameSite).toBe("strict");
	});
});
