import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { listOpenApiSchemas } from "@api/shared";
import { createApp } from "../src/create-app.js";

interface OpenApiSchema {
	$ref?: string;
	type?: string;
	enum?: string[];
	example?: unknown;
	required?: string[];
	maxLength?: number;
	items?: OpenApiSchema;
	properties?: Record<string, OpenApiSchema>;
}

interface OpenApiContent {
	content: { "application/json": { schema: OpenApiSchema } };
}

interface OpenApiOperation {
	requestBody?: OpenApiContent;
	responses: Record<string, OpenApiContent>;
	parameters?: { name: string; in: string; required: boolean; schema: OpenApiSchema }[];
}

interface OpenApiDocument {
	paths: Record<string, Record<string, OpenApiOperation>>;
	components?: { schemas?: Record<string, OpenApiSchema> };
}

function sign(secret: string, body: string): string {
	return createHmac("sha256", secret).update(body).digest("base64");
}

let app: NestExpressApplication | undefined;

async function setup(): Promise<ReturnType<typeof request>> {
	app = await createApp({ logger: false });
	return request(app.getHttpServer());
}

beforeAll(() => {
	process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
	process.env.ADMIN_USERNAME = "admin";
	process.env.ADMIN_PASSWORD = "admin";
	process.env.DATABASE_URL =
		"postgresql://postgres:postgres@localhost:5432/postgres?schema=public&sslmode=disable";
	process.env.SPOT_LINE_CHANNEL_SECRET = "test-spot-line-channel-secret";
	process.env.SPOT_LINE_CHANNEL_ACCESS_TOKEN = "test-spot-line-channel-access-token";
	process.env.BIKE_PARKING_LINE_CHANNEL_SECRET = "test-bike-parking-line-channel-secret";
	process.env.BIKE_PARKING_LINE_CHANNEL_ACCESS_TOKEN =
		"test-bike-parking-line-channel-access-token";
	process.env.YAHOO_APP_ID = "test-yahoo-app-id";
});

afterEach(async () => {
	await app?.close();
	app = undefined;
});

describe("createApp() が公開するヘルスチェック", () => {
	it("GET /health は /api プレフィックス無しで 200 と text/plain の ok を返す", async () => {
		const agent = await setup();

		const res = await agent.get("/health");

		expect(res.status).toBe(200);
		expect(res.text).toBe("ok");
		expect(res.headers["content-type"]).toContain("text/plain");
	});
});

describe("createApp() 経由で公開したManagedルート", () => {
	it("未認証で GET /api/v1/managed/error-log を叩くと401を返す", async () => {
		const agent = await setup();

		const res = await agent.get("/api/v1/managed/error-log");

		expect(res.status).toBe(401);
	});

	it("未認証で GET /api/v1/managed/job-log を叩くと401を返す", async () => {
		const agent = await setup();

		const res = await agent.get("/api/v1/managed/job-log");

		expect(res.status).toBe(401);
	});

	it("未認証で GET /api/v1/managed/gourmet/location を叩くと401を返す", async () => {
		const agent = await setup();

		const res = await agent.get("/api/v1/managed/gourmet/location");

		expect(res.status).toBe(401);
	});
});

describe("createApp() 経由で公開したAuthルート", () => {
	it("POST /api/v1/auth/login は資格情報が不正なら401とエラーメッセージを返す", async () => {
		const agent = await setup();

		const res = await agent
			.post("/api/v1/auth/login")
			.send({ userName: "admin", password: "wrong" });

		expect(res.status).toBe(401);
		expect(res.body).toEqual({ message: "Invalid user name or password." });
	});

	it("バージョン無しの /api/auth/login は公開されない", async () => {
		const agent = await setup();

		const res = await agent.post("/api/auth/login").send({ userName: "admin", password: "admin" });

		expect(res.status).toBe(404);
	});
});

describe("createApp() 経由で公開したWebhookルート", () => {
	it("x-line-signatureヘッダーが無いまま POST /api/v1/webhook/spot を叩くと401を返す", async () => {
		const agent = await setup();

		const res = await agent
			.post("/api/v1/webhook/spot?genreCode=0301")
			.send({ destination: "U123", events: [] });

		expect(res.status).toBe(401);
	});

	it("x-line-signatureヘッダーが無いまま POST /api/v1/webhook/parking を叩くと401を返す", async () => {
		const agent = await setup();

		const res = await agent
			.post("/api/v1/webhook/parking")
			.send({ destination: "U123", events: [] });

		expect(res.status).toBe(401);
	});

	it("BIKE_PARKING_LINE_CHANNEL_SECRETで正しく署名したPOST /api/v1/webhook/parkingは401にならない", async () => {
		const agent = await setup();
		const body = JSON.stringify({ destination: "U123", events: [] });

		const res = await agent
			.post("/api/v1/webhook/parking")
			.set("Content-Type", "application/json")
			.set("x-line-signature", sign("test-bike-parking-line-channel-secret", body))
			.send(body);

		expect(res.status).toBe(200);
	});

	it("SPOT_LINE_CHANNEL_SECRETで正しく署名したPOST /api/v1/webhook/spotは401にならない", async () => {
		const agent = await setup();
		const body = JSON.stringify({ destination: "U123", events: [] });

		const res = await agent
			.post("/api/v1/webhook/spot")
			.set("Content-Type", "application/json")
			.set("x-line-signature", sign("test-spot-line-channel-secret", body))
			.send(body);

		expect(res.status).toBe(200);
	});

	it("SPOT用のsecretで署名したリクエストを /api/v1/webhook/parking に送ると401を返す", async () => {
		const agent = await setup();
		const body = JSON.stringify({ destination: "U123", events: [] });

		const res = await agent
			.post("/api/v1/webhook/parking")
			.set("Content-Type", "application/json")
			.set("x-line-signature", sign("test-spot-line-channel-secret", body))
			.send(body);

		expect(res.status).toBe(401);
	});
});

describe("createApp() が公開するOpenAPI / Swagger UI", () => {
	it("本番以外では /doc がZodスキーマ由来のリクエストボディ定義を含むOpenAPI JSONを返す", async () => {
		const agent = await setup();

		const res = await agent.get("/doc");

		expect(res.status).toBe(200);
		const document = res.body as OpenApiDocument;
		expect(Object.keys(document.paths)).toEqual(
			expect.arrayContaining([
				"/api/v1/auth/login",
				"/api/v1/auth/refresh",
				"/api/v1/auth/logout",
				"/api/v1/auth/me",
				"/api/v1/managed/gourmet/{messageType}",
				"/api/v1/managed/error-log",
				"/api/v1/managed/job-log",
				"/api/v1/webhook/spot",
				"/api/v1/webhook/parking",
			]),
		);
		expect(document.paths["/health"]).toBeUndefined();
		expect(document.components?.schemas?.LoginRequest.required).toEqual(["userName", "password"]);
	});

	it("移行前(@hono/zod-openapi)と同じスキーマ名がcomponents.schemasに登録される", async () => {
		const agent = await setup();

		const document = (await agent.get("/doc")).body as OpenApiDocument;

		expect(Object.keys(document.components?.schemas ?? {}).sort()).toEqual(
			[
				"ErrorLog",
				"ErrorResponse",
				"GourmetLocationLog",
				"GourmetWordLog",
				"JobLog",
				"LoginRequest",
				"LoginResponse",
				"MeResponse",
				"ParkingReplyResponse",
				"SpotReplyResponse",
				"WebhookRequestBody",
			].sort(),
		);
	});

	it("名前付きスキーマはインライン展開せず$refで参照する", async () => {
		const agent = await setup();

		const document = (await agent.get("/doc")).body as OpenApiDocument;
		const login = document.paths["/api/v1/auth/login"].post;

		expect(login.requestBody?.content["application/json"].schema).toEqual({
			$ref: "#/components/schemas/LoginRequest",
		});
		expect(login.responses["200"].content["application/json"].schema).toEqual({
			$ref: "#/components/schemas/LoginResponse",
		});
		expect(login.responses["401"].content["application/json"].schema).toEqual({
			$ref: "#/components/schemas/ErrorResponse",
		});
	});

	it("名前付きスキーマを要素に持つ配列レスポンスは、要素を$refで参照する", async () => {
		const agent = await setup();

		const document = (await agent.get("/doc")).body as OpenApiDocument;
		const errorLog = document.paths["/api/v1/managed/error-log"].get;

		expect(errorLog.responses["200"].content["application/json"].schema).toEqual({
			type: "array",
			items: { $ref: "#/components/schemas/ErrorLog" },
		});
	});

	it("移行前と同じフィールド単位の例示値を持つ（Swagger UIのTry it outにadmin/adminが入る）", async () => {
		const agent = await setup();

		const document = (await agent.get("/doc")).body as OpenApiDocument;
		const schemas = document.components?.schemas ?? {};

		expect(schemas.LoginRequest.properties?.userName.example).toBe("admin");
		expect(schemas.LoginRequest.properties?.password.example).toBe("admin");
		expect(schemas.LoginResponse.properties?.userName.example).toBe("admin");
		expect(schemas.LoginResponse.properties?.expiresAt.example).toBe("2026-07-07T19:29:45.890Z");
		expect(schemas.MeResponse.properties?.userName.example).toBe("admin");
		expect(schemas.ErrorResponse.properties?.message.example).toBe("Unauthorized.");
	});

	it("パス・クエリのパラメータは$ref化せず、従来どおり個別のパラメータとして展開する", async () => {
		const agent = await setup();

		const document = (await agent.get("/doc")).body as OpenApiDocument;

		expect(document.paths["/api/v1/managed/gourmet/{messageType}"].get.parameters).toEqual([
			{
				name: "messageType",
				required: true,
				in: "path",
				schema: { type: "string", enum: ["location", "text"] },
			},
		]);
		expect(document.paths["/api/v1/webhook/spot"].post.parameters).toEqual([
			{ name: "genreCode", required: false, in: "query", schema: { type: "string", maxLength: 7 } },
		]);
	});

	it("登録済みの例示値はすべて自身のスキーマのバリデーションを通る", async () => {
		await setup();
		const withExample = listOpenApiSchemas().filter(
			([, metadata]) => metadata.example !== undefined,
		);

		expect(withExample.length).toBeGreaterThan(0);
		for (const [schema, metadata] of withExample) {
			const result = await schema["~standard"].validate(metadata.example);
			expect(result.issues, `example of ${metadata.name ?? "(unnamed field)"}`).toBeUndefined();
		}
	});

	it("本番以外では /ui でSwagger UIを返す", async () => {
		const agent = await setup();

		const res = await agent.get("/ui");

		expect(res.status).toBe(200);
		expect(res.headers["content-type"]).toContain("text/html");
	});

	it("本番では /doc と /ui を公開しない", async () => {
		const previous = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";
		try {
			const agent = await setup();

			expect((await agent.get("/doc")).status).toBe(404);
			expect((await agent.get("/ui")).status).toBe(404);
		} finally {
			process.env.NODE_ENV = previous;
		}
	});
});
