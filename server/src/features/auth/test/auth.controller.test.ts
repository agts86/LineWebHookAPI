import { afterEach, describe, expect, it } from "vitest";
import { Global, Module, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AUTH_REPOSITORY } from "../src/auth.constants.js";
import { AuthModule } from "../src/auth.module.js";
import type { LoginResponse } from "../src/auth.dto.js";
import { InMemoryAuthRepository } from "./support/in-memory-auth-repository.js";

const config = {
	adminUserName: "admin",
	adminPassword: "admin",
	jwt: {
		secret: "test-jwt-secret-at-least-32-characters-long",
		issuer: "LineWebHookAPI",
		audience: "LineWebHookAdmin",
	},
	accessTokenExpiresInSeconds: 900,
	refreshTokenExpiresInSeconds: 604800,
};

@Global()
@Module({
	providers: [{ provide: AUTH_REPOSITORY, useClass: InMemoryAuthRepository }],
	exports: [AUTH_REPOSITORY],
})
class TestInfrastructureModule {}

type SupertestApp = Parameters<typeof request>[0];

let app: INestApplication | undefined;

async function setup(cookieSecure = true): Promise<ReturnType<typeof request>> {
	const moduleRef = await Test.createTestingModule({
		imports: [TestInfrastructureModule, AuthModule.register({ config, cookieSecure })],
	}).compile();
	app = moduleRef.createNestApplication();
	await app.init();
	return request(app.getHttpServer() as SupertestApp);
}

function getSetCookies(res: request.Response): string[] {
	const header = res.headers["set-cookie"] as string[] | string | undefined;
	if (!header) {
		return [];
	}
	return Array.isArray(header) ? header : [header];
}

function findCookiePair(res: request.Response, name: string): string {
	const cookie = getSetCookies(res).find((c) => c.startsWith(name));
	return cookie?.split(";")[0] ?? "";
}

afterEach(async () => {
	await app?.close();
	app = undefined;
});

describe("POST /auth/login", () => {
	it("成功時にuserNameとexpiresAtを返し、両Cookieを設定する", async () => {
		const agent = await setup();

		const res = await agent.post("/auth/login").send({ userName: "admin", password: "admin" });

		expect(res.status).toBe(200);
		const body = res.body as LoginResponse;
		expect(body.userName).toBe("admin");
		expect(body.expiresAt).toBeTruthy();

		const cookies = getSetCookies(res).join(";");
		expect(cookies).toContain("linewebhook_auth");
		expect(cookies).toContain("linewebhook_refresh");
	});

	it("既存.NET側と同じCookie属性（HttpOnly / Secure / SameSite=Strict / Path=/）で発行する", async () => {
		const agent = await setup();

		const res = await agent.post("/auth/login").send({ userName: "admin", password: "admin" });

		for (const cookie of getSetCookies(res)) {
			expect(cookie).toContain("HttpOnly");
			expect(cookie).toContain("Secure");
			expect(cookie).toContain("SameSite=Strict");
			expect(cookie).toContain("Path=/");
			expect(cookie).toContain("Expires=");
		}
	});

	it("cookieSecure=falseならSecure属性の無いCookieを発行する（HTTPのSwagger UIから試せるように）", async () => {
		const agent = await setup(false);

		const res = await agent.post("/auth/login").send({ userName: "admin", password: "admin" });

		const cookies = getSetCookies(res).join(";");
		expect(cookies).not.toContain("Secure");
		expect(cookies).toContain("HttpOnly");
	});

	it("失敗時は401とエラーメッセージを返しCookieを設定しない", async () => {
		const agent = await setup();

		const res = await agent.post("/auth/login").send({ userName: "admin", password: "wrong" });

		expect(res.status).toBe(401);
		expect(res.body).toEqual({ message: "Invalid user name or password." });
		expect(getSetCookies(res)).toEqual([]);
	});

	it("リクエストボディがスキーマ違反なら400を返す", async () => {
		const agent = await setup();

		const res = await agent.post("/auth/login").send({ userName: "admin", password: "" });

		expect(res.status).toBe(400);
		expect(getSetCookies(res)).toEqual([]);
	});
});

describe("POST /auth/refresh", () => {
	it("有効なリフレッシュCookieでトークンをローテーションする", async () => {
		const agent = await setup();
		const loginRes = await agent.post("/auth/login").send({ userName: "admin", password: "admin" });

		const res = await agent
			.post("/auth/refresh")
			.set("Cookie", findCookiePair(loginRes, "linewebhook_refresh"));

		expect(res.status).toBe(200);
		expect((res.body as LoginResponse).userName).toBe("admin");
		expect(findCookiePair(res, "linewebhook_refresh")).not.toBe(
			findCookiePair(loginRes, "linewebhook_refresh"),
		);
	});

	it("リフレッシュCookieが無ければ401を返す", async () => {
		const agent = await setup();

		const res = await agent.post("/auth/refresh");

		expect(res.status).toBe(401);
		expect(res.body).toEqual({ message: "Unauthorized." });
	});
});

describe("POST /auth/logout", () => {
	it("常に204を返し、両Cookieを削除する", async () => {
		const agent = await setup();

		const res = await agent.post("/auth/logout");

		expect(res.status).toBe(204);
		const cookies = getSetCookies(res).join(";");
		expect(cookies).toContain("linewebhook_auth=;");
		expect(cookies).toContain("linewebhook_refresh=;");
	});
});

describe("GET /auth/me", () => {
	it("有効なアクセストークンがあれば200とuserNameを返す", async () => {
		const agent = await setup();
		const loginRes = await agent.post("/auth/login").send({ userName: "admin", password: "admin" });

		const res = await agent
			.get("/auth/me")
			.set("Cookie", findCookiePair(loginRes, "linewebhook_auth"));

		expect(res.status).toBe(200);
		expect(res.body).toEqual({ userName: "admin" });
	});

	it("アクセストークンが無ければ401を返す", async () => {
		const agent = await setup();

		const res = await agent.get("/auth/me");

		expect(res.status).toBe(401);
		expect(res.body).toEqual({ message: "Unauthorized." });
	});
});
