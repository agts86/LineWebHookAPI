import { describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { AUTH_REPOSITORY } from "@api/features-auth";
import { MANAGED_REPOSITORY } from "@api/features-managed";
import {
	PARKING_CLIENT,
	PARKING_LINE_REPLY_CLIENT,
	SPOT_LINE_REPLY_CLIENT,
	SPOT_SEARCH_CLIENT,
	WEBHOOK_REPOSITORY,
} from "@api/features-webhook";
import { InfrastructureModule } from "../src/infrastructure.module.js";
import { PrismaAuthRepository } from "../src/auth.repository.impl.js";
import { PrismaManagedRepository } from "../src/managed.repository.impl.js";
import { PrismaWebhookRepository } from "../src/webhook.repository.impl.js";
import { YolpClientImpl } from "../src/yolp-client.impl.js";
import { ParkingClientImpl } from "../src/parking-client.impl.js";
import { LineReplyClientImpl } from "../src/line-reply-client.impl.js";

async function compile(): Promise<
	Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>["compile"]>>
> {
	return Test.createTestingModule({
		imports: [
			InfrastructureModule.forRoot({
				yahooAppId: "test-yahoo-app-id",
				spotLineChannelAccessToken: "test-spot-access-token",
				parkingLineChannelAccessToken: "test-parking-access-token",
			}),
		],
	}).compile();
}

describe("InfrastructureModule.forRoot", () => {
	it("各featureのRepositoryトークンをPrisma実装に束ねる", async () => {
		const moduleRef = await compile();

		expect(moduleRef.get(AUTH_REPOSITORY)).toBeInstanceOf(PrismaAuthRepository);
		expect(moduleRef.get(MANAGED_REPOSITORY)).toBeInstanceOf(PrismaManagedRepository);
		expect(moduleRef.get(WEBHOOK_REPOSITORY)).toBeInstanceOf(PrismaWebhookRepository);
	});

	it("外部APIクライアントのトークンを実装に束ねる", async () => {
		const moduleRef = await compile();

		expect(moduleRef.get(SPOT_SEARCH_CLIENT)).toBeInstanceOf(YolpClientImpl);
		expect(moduleRef.get(PARKING_CLIENT)).toBeInstanceOf(ParkingClientImpl);
	});

	it("LINE返信クライアントはチャンネルごとに別インスタンスを束ねる", async () => {
		const moduleRef = await compile();

		const spot = moduleRef.get<LineReplyClientImpl>(SPOT_LINE_REPLY_CLIENT);
		const parking = moduleRef.get<LineReplyClientImpl>(PARKING_LINE_REPLY_CLIENT);

		expect(spot).toBeInstanceOf(LineReplyClientImpl);
		expect(parking).toBeInstanceOf(LineReplyClientImpl);
		expect(spot).not.toBe(parking);
	});
});
