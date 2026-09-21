import {
	Body,
	Controller,
	HttpCode,
	Post,
	StandardSchemaValidationPipe,
	UseGuards,
	UsePipes,
} from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import type { webhook } from "@line/bot-sdk";
import { ParkingLineSignatureGuard } from "../line-signature.guard.js";
import { WebhookRequestBodySchema, type WebhookRequestBody } from "../common.dto.js";
import { ParkingReplyService } from "./reply.service.js";
import { ParkingReplyResponseSchema } from "./dto.js";
import type { ParkingEventResult } from "./types.js";

function toCallbackRequest(body: WebhookRequestBody): webhook.CallbackRequest {
	return body as unknown as webhook.CallbackRequest;
}

/**
 * /parking を実装するコントローラー。ホスト側の設定で /api/v1/webhook/parking に公開される。
 * DB永続化・非同期ジョブキューは持たず、/spot と同じLINE署名検証のみを適用する。
 */
@ApiTags("Webhook")
@Controller({ path: "webhook", version: "1" })
@UsePipes(StandardSchemaValidationPipe)
export class ParkingController {
	constructor(private readonly parkingReplyService: ParkingReplyService) {}

	@Post("parking")
	@HttpCode(200)
	@UseGuards(ParkingLineSignatureGuard)
	@ApiResponse({
		status: 200,
		description:
			"jmpsa.or.jp（全国バイク駐車場案内）検索・LINE返信まで同期的に完了し、送信した返信内容・返信成否の一覧を返す",
		standardSchema: ParkingReplyResponseSchema,
	})
	async parking(
		@Body({ schema: WebhookRequestBodySchema }) body: WebhookRequestBody,
	): Promise<ParkingEventResult[]> {
		return this.parkingReplyService.processEvents(toCallbackRequest(body));
	}
}
