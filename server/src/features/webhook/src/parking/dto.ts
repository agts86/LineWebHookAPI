import { z } from "zod";
import { withOpenApi } from "@api/shared";

const ParkingEventResultSchema = z.object({
	reply: z.object({ replyToken: z.string(), messages: z.array(z.unknown()) }),
	isReplySucceeded: z.boolean(),
});

export const ParkingReplyResponseSchema = withOpenApi(z.array(ParkingEventResultSchema), {
	name: "ParkingReplyResponse",
});
