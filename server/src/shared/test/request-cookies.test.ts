import { describe, expect, it } from "vitest";
import { readCookie } from "../src/request-cookies.js";

describe("readCookie", () => {
	it("Cookieヘッダーから指定名の値を取り出す", () => {
		const request = { headers: { cookie: "a=1; linewebhook_auth=token-value; b=2" } };

		expect(readCookie(request, "linewebhook_auth")).toBe("token-value");
	});

	it("URLエンコードされた値はデコードして返す", () => {
		const request = { headers: { cookie: "linewebhook_refresh=abc%2Bdef%3D" } };

		expect(readCookie(request, "linewebhook_refresh")).toBe("abc+def=");
	});

	it("Cookieヘッダーが無ければundefinedを返す", () => {
		expect(readCookie({ headers: {} }, "linewebhook_auth")).toBeUndefined();
	});

	it("指定名のCookieが無ければundefinedを返す", () => {
		const request = { headers: { cookie: "other=1" } };

		expect(readCookie(request, "linewebhook_auth")).toBeUndefined();
	});
});
