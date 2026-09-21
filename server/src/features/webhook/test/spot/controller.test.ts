import { afterEach, describe, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { SpotReplyService } from "../../src/spot/reply.service.js";
import { WEBHOOK_REPOSITORY } from "../../src/webhook.constants.js";
import type { WebhookRepository } from "../../src/spot/repository.js";
import {
	PARKING_CHANNEL_SECRET,
	SPOT_CHANNEL_SECRET,
	createWebhookTestApp,
	signBody,
} from "../support/webhook-test-app.js";

let app: INestApplication | undefined;

async function setup(): Promise<Awaited<ReturnType<typeof createWebhookTestApp>>["agent"]> {
	const repo: WebhookRepository = {
		createGourmetLocationLog: vi.fn().mockResolvedValue(undefined),
		createGourmetWordLog: vi.fn().mockResolvedValue(undefined),
		createJobLog: vi.fn().mockResolvedValue(undefined),
	};
	const created = await createWebhookTestApp((builder) =>
		builder
			.overrideProvider(SpotReplyService)
			.useValue({ processEvent: vi.fn().mockResolvedValue(null) })
			.overrideProvider(WEBHOOK_REPOSITORY)
			.useValue(repo),
	);
	app = created.app;
	return created.agent;
}

afterEach(async () => {
	await app?.close();
	app = undefined;
});

describe("POST /webhook/spot", () => {
	it("署名が正しければ同期処理し200とmeta配列を返す", async () => {
		const agent = await setup();
		const json = JSON.stringify({ destination: "U1", events: [] });

		const res = await agent
			.post("/webhook/spot?genreCode=0101")
			.set("Content-Type", "application/json")
			.set("x-line-signature", signBody(json, SPOT_CHANNEL_SECRET))
			.send(json);

		expect(res.status).toBe(200);
		expect(res.body).toEqual([]);
	});

	it("署名が無ければ401を返す", async () => {
		const agent = await setup();

		const res = await agent.post("/webhook/spot").send({ destination: "U1", events: [] });

		expect(res.status).toBe(401);
		expect(res.body).toEqual({ message: "Unauthorized." });
	});

	it("parking用のchannelSecretで署名したリクエストは401を返す（チャンネルの取り違え防止）", async () => {
		const agent = await setup();
		const json = JSON.stringify({ destination: "U1", events: [] });

		const res = await agent
			.post("/webhook/spot")
			.set("Content-Type", "application/json")
			.set("x-line-signature", signBody(json, PARKING_CHANNEL_SECRET))
			.send(json);

		expect(res.status).toBe(401);
	});

	it("genreCodeが7文字を超えるなら400を返す", async () => {
		const agent = await setup();
		const json = JSON.stringify({ destination: "U1", events: [] });

		const res = await agent
			.post("/webhook/spot?genreCode=12345678")
			.set("Content-Type", "application/json")
			.set("x-line-signature", signBody(json, SPOT_CHANNEL_SECRET))
			.send(json);

		expect(res.status).toBe(400);
	});
});
