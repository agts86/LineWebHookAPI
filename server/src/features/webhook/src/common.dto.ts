import { z } from "zod";
import { withOpenApi } from "@api/shared";

// LINEプラットフォームからの署名済みリクエストのため、events内部の詳細な形は
// @line/bot-sdkのTypeScript型（webhook.WebhookEvent等）をサービス層で使い、
// ここでは大枠のみをZodで検証する。
export const WebhookRequestBodySchema = withOpenApi(
	z.object({
		destination: z.string(),
		events: z.array(z.unknown()),
	}),
	{ name: "WebhookRequestBody" },
);
export type WebhookRequestBody = z.infer<typeof WebhookRequestBodySchema>;
