import { afterEach, describe, expect, it } from "vitest";
import { Global, Module, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { createAccessToken, AUTH_COOKIE_NAME } from "@api/shared";
import { MANAGED_REPOSITORY } from "../src/managed.constants.js";
import { ManagedModule } from "../src/managed.module.js";
import { InMemoryManagedRepository } from "./support/in-memory-managed-repository.js";

const jwtConfig = {
	secret: "test-jwt-secret-at-least-32-characters-long",
	issuer: "LineWebHookAPI",
	audience: "LineWebHookAdmin",
};

type SupertestApp = Parameters<typeof request>[0];

let app: INestApplication | undefined;

async function authCookieHeader(): Promise<string> {
	const { token } = await createAccessToken("admin", jwtConfig, 900);
	return `${AUTH_COOKIE_NAME}=${token}`;
}

async function setup(): Promise<{
	agent: ReturnType<typeof request>;
	repo: InMemoryManagedRepository;
}> {
	const repo = new InMemoryManagedRepository();

	@Global()
	@Module({
		providers: [{ provide: MANAGED_REPOSITORY, useValue: repo }],
		exports: [MANAGED_REPOSITORY],
	})
	class TestInfrastructureModule {}

	const moduleRef = await Test.createTestingModule({
		imports: [TestInfrastructureModule, ManagedModule.register({ jwt: jwtConfig })],
	}).compile();
	app = moduleRef.createNestApplication();
	await app.init();
	return { agent: request(app.getHttpServer() as SupertestApp), repo };
}

afterEach(async () => {
	await app?.close();
	app = undefined;
});

describe("GET /managed/gourmet/:messageType", () => {
	it("認証済みならlocationログをJST文字列で返す", async () => {
		const { agent, repo } = await setup();
		repo.gourmetLocationLogs = [
			{
				id: "1",
				lat: 35.5,
				lng: 139.5,
				createdAt: new Date("2026-07-08T14:14:45.890Z"),
				updatedAt: new Date("2026-07-08T14:14:45.890Z"),
			},
		];

		const res = await agent
			.get("/managed/gourmet/location")
			.set("Cookie", await authCookieHeader());

		expect(res.status).toBe(200);
		expect(res.body).toEqual([
			{
				id: "1",
				lat: 35.5,
				lng: 139.5,
				createdAt: "2026-07-08T23:14:45.890+09:00",
				updatedAt: "2026-07-08T23:14:45.890+09:00",
			},
		]);
	});

	it("認証済みならtextログを返す", async () => {
		const { agent, repo } = await setup();
		repo.gourmetWordLogs = [
			{
				id: "1",
				text: "ラーメン",
				createdAt: new Date("2026-07-08T00:00:00.000Z"),
				updatedAt: new Date("2026-07-08T00:00:00.000Z"),
			},
		];

		const res = await agent.get("/managed/gourmet/text").set("Cookie", await authCookieHeader());

		expect(res.status).toBe(200);
		const body = res.body as { text: string }[];
		expect(body[0].text).toBe("ラーメン");
	});

	it("未認証なら401を返す", async () => {
		const { agent } = await setup();

		const res = await agent.get("/managed/gourmet/location");

		expect(res.status).toBe(401);
		expect(res.body).toEqual({ message: "Unauthorized." });
	});

	it("messageTypeが不正なら400を返す", async () => {
		const { agent } = await setup();

		const res = await agent.get("/managed/gourmet/invalid").set("Cookie", await authCookieHeader());

		expect(res.status).toBe(400);
	});
});

describe("GET /managed/error-log", () => {
	it("認証済みならErrorLogを返す", async () => {
		const { agent, repo } = await setup();
		repo.errorLogs = [
			{
				id: "1",
				contents: "boom",
				createdAt: new Date("2026-07-08T00:00:00.000Z"),
				updatedAt: new Date("2026-07-08T00:00:00.000Z"),
			},
		];

		const res = await agent.get("/managed/error-log").set("Cookie", await authCookieHeader());

		expect(res.status).toBe(200);
		const body = res.body as { contents: string }[];
		expect(body[0].contents).toBe("boom");
	});

	it("未認証なら401を返す", async () => {
		const { agent } = await setup();

		const res = await agent.get("/managed/error-log");

		expect(res.status).toBe(401);
	});
});

describe("GET /managed/job-log", () => {
	it("認証済みならJobLogを返す", async () => {
		const { agent, repo } = await setup();
		repo.jobLogs = [
			{
				id: "1",
				isSuccess: true,
				contents: "done",
				info: null,
				createdAt: new Date("2026-07-08T00:00:00.000Z"),
				updatedAt: new Date("2026-07-08T00:00:00.000Z"),
			},
		];

		const res = await agent.get("/managed/job-log").set("Cookie", await authCookieHeader());

		expect(res.status).toBe(200);
		const body = res.body as { isSuccess: boolean }[];
		expect(body[0].isSuccess).toBe(true);
	});

	it("未認証なら401を返す", async () => {
		const { agent } = await setup();

		const res = await agent.get("/managed/job-log");

		expect(res.status).toBe(401);
	});
});
