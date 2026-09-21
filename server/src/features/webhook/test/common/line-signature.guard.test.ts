import { describe, expect, it } from "vitest";
import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { LineSignatureGuard, type LineSignedRequest } from "../../src/line-signature.guard.js";
import { signBody } from "../support/webhook-test-app.js";

const CHANNEL_SECRET = "test-channel-secret";

function buildContext(request: LineSignedRequest): ExecutionContext {
	return {
		switchToHttp: (): { getRequest: () => LineSignedRequest } => ({
			getRequest: (): LineSignedRequest => request,
		}),
	} as unknown as ExecutionContext;
}

describe("LineSignatureGuard", () => {
	it("生ボディに対する署名が正しければ通過する", () => {
		const guard = new LineSignatureGuard(CHANNEL_SECRET, true);
		const body = JSON.stringify({ destination: "U123", events: [] });
		const context = buildContext({
			headers: { "x-line-signature": signBody(body, CHANNEL_SECRET) },
			rawBody: Buffer.from(body),
		});

		expect(guard.canActivate(context)).toBe(true);
	});

	it("x-line-signatureヘッダーが無ければUnauthorizedExceptionを投げる", () => {
		const guard = new LineSignatureGuard(CHANNEL_SECRET, true);
		const context = buildContext({ headers: {}, rawBody: Buffer.from("{}") });

		expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
	});

	it("署名が不正ならUnauthorizedExceptionを投げる", () => {
		const guard = new LineSignatureGuard(CHANNEL_SECRET, true);
		const context = buildContext({
			headers: { "x-line-signature": "invalid-signature" },
			rawBody: Buffer.from("{}"),
		});

		expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
	});

	it("生ボディが取得できない構成ならUnauthorizedExceptionを投げる（検証をすり抜けさせない）", () => {
		const guard = new LineSignatureGuard(CHANNEL_SECRET, true);
		const context = buildContext({
			headers: { "x-line-signature": signBody("{}", CHANNEL_SECRET) },
		});

		expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
	});

	it("verifySignature=falseなら署名を検証せず通過させる（ローカル開発用）", () => {
		const guard = new LineSignatureGuard(CHANNEL_SECRET, false);
		const context = buildContext({ headers: {} });

		expect(guard.canActivate(context)).toBe(true);
	});

	it("401のレスポンスボディは既存契約どおり { message: 'Unauthorized.' } になる", () => {
		const guard = new LineSignatureGuard(CHANNEL_SECRET, true);
		const context = buildContext({ headers: {} });

		let error: unknown;
		try {
			guard.canActivate(context);
		} catch (e) {
			error = e;
		}

		expect((error as UnauthorizedException).getResponse()).toEqual({ message: "Unauthorized." });
	});
});
