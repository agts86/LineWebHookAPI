import { afterEach, describe, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { ParkingReplyService } from "../../src/parking/reply.service.js";
import {
	PARKING_CHANNEL_SECRET,
	SPOT_CHANNEL_SECRET,
	createWebhookTestApp,
	signBody,
} from "../support/webhook-test-app.js";

let app: INestApplication | undefined;

async function setup(
	processEventsResult: unknown[] = [],
): Promise<Awaited<ReturnType<typeof createWebhookTestApp>>["agent"]> {
	const created = await createWebhookTestApp((builder) =>
		builder
			.overrideProvider(ParkingReplyService)
			.useValue({ processEvents: vi.fn().mockResolvedValue(processEventsResult) }),
	);
	app = created.app;
	return created.agent;
}

afterEach(async () => {
	await app?.close();
	app = undefined;
});

describe("POST /webhook/parking", () => {
	it("署名が正しければ同期処理し200と結果配列を返す", async () => {
		const agent = await setup([
			{ reply: { replyToken: "r1", messages: [] }, isReplySucceeded: true },
		]);
		const json = JSON.stringify({ destination: "U1", events: [] });

		const res = await agent
			.post("/webhook/parking")
			.set("Content-Type", "application/json")
			.set("x-line-signature", signBody(json, PARKING_CHANNEL_SECRET))
			.send(json);

		expect(res.status).toBe(200);
		expect(res.body).toEqual([
			{ reply: { replyToken: "r1", messages: [] }, isReplySucceeded: true },
		]);
	});

	it("署名が無ければ401を返す", async () => {
		const agent = await setup();

		const res = await agent.post("/webhook/parking").send({ destination: "U1", events: [] });

		expect(res.status).toBe(401);
		expect(res.body).toEqual({ message: "Unauthorized." });
	});

	it("spot用のchannelSecretで署名したリクエストは401を返す（チャンネルの取り違え防止）", async () => {
		const agent = await setup();
		const json = JSON.stringify({ destination: "U1", events: [] });

		const res = await agent
			.post("/webhook/parking")
			.set("Content-Type", "application/json")
			.set("x-line-signature", signBody(json, SPOT_CHANNEL_SECRET))
			.send(json);

		expect(res.status).toBe(401);
	});

	it("リクエストボディがスキーマ違反なら400を返す", async () => {
		const agent = await setup();
		const json = JSON.stringify({ destination: "U1" });

		const res = await agent
			.post("/webhook/parking")
			.set("Content-Type", "application/json")
			.set("x-line-signature", signBody(json, PARKING_CHANNEL_SECRET))
			.send(json);

		expect(res.status).toBe(400);
	});
});
