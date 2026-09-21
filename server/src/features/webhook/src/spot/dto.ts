import { z } from "zod";
import { withOpenApi } from "@api/shared";

export const GenreCodeQuerySchema = z.object({
	genreCode: z.string().max(7).optional(),
});
export type GenreCodeQuery = z.infer<typeof GenreCodeQuerySchema>;

const PersistedMetaSchema = z.union([
	z.object({
		id: z.string(),
		lat: z.number(),
		lng: z.number(),
		createdAt: z.string(),
		updatedAt: z.string(),
	}),
	z.object({
		id: z.string(),
		text: z.string().nullable(),
		createdAt: z.string(),
		updatedAt: z.string(),
	}),
]);

const SpotEventResultSchema = z.object({
	reply: z.object({ replyToken: z.string(), messages: z.array(z.unknown()) }),
	meta: PersistedMetaSchema,
	isReplySucceeded: z.boolean(),
});

export const SpotReplyResponseSchema = withOpenApi(z.array(SpotEventResultSchema), {
	name: "SpotReplyResponse",
});
