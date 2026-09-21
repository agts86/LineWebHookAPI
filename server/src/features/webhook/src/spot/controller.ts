import {
	Body,
	Controller,
	HttpCode,
	Post,
	Query,
	StandardSchemaValidationPipe,
	UseGuards,
	UsePipes,
} from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import type { webhook } from "@line/bot-sdk";
import { SpotLineSignatureGuard } from "../line-signature.guard.js";
import { WebhookRequestBodySchema, type WebhookRequestBody } from "../common.dto.js";
import { SpotService } from "./service.js";
import { GenreCodeQuerySchema, SpotReplyResponseSchema, type GenreCodeQuery } from "./dto.js";
import type { SpotEventResult } from "./types.js";

/**
 * このリクエストで受け取ったbodyはLINE署名検証済みだが、Zodスキーマではevents内部までは
 * 厳密に検証していない（LINEの複雑なイベントUnion型を再実装しない方針）ため、
 * webhook.CallbackRequestへの変換はここで明示的に行う。
 */
function toCallbackRequest(body: WebhookRequestBody): webhook.CallbackRequest {
	return body as unknown as webhook.CallbackRequest;
}

/**
 * /spot を実装するコントローラー。ホスト側の設定で /api/v1/webhook/spot に公開される。
 * スポット検索・LINE返信・DB保存までリクエスト内で同期的に完了する。
 */
@ApiTags("Webhook")
@Controller({ path: "webhook", version: "1" })
@UsePipes(StandardSchemaValidationPipe)
export class SpotController {
	constructor(private readonly spotService: SpotService) {}

	@Post("spot")
	@HttpCode(200)
	@UseGuards(SpotLineSignatureGuard)
	@ApiResponse({
		status: 200,
		description:
			"スポット検索・LINE返信・DB保存まで同期的に完了し、送信した返信内容・保存したログ・返信成否の一覧を返す",
		standardSchema: SpotReplyResponseSchema,
	})
	async spot(
		@Body({ schema: WebhookRequestBodySchema }) body: WebhookRequestBody,
		@Query({ schema: GenreCodeQuerySchema }) query: GenreCodeQuery,
	): Promise<SpotEventResult[]> {
		return this.spotService.processSync(toCallbackRequest(body), query.genreCode);
	}
}
