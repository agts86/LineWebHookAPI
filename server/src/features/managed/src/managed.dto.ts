import { z } from "zod";
import { withOpenApi } from "@api/shared";

export const MessageTypeParamSchema = z.object({
	messageType: z.enum(["location", "text"]),
});
export type MessageTypeParam = z.infer<typeof MessageTypeParamSchema>;

export const GourmetLocationLogSchema = withOpenApi(
	z.object({
		id: z.string(),
		lat: z.number(),
		lng: z.number(),
		createdAt: z.string(),
		updatedAt: z.string(),
	}),
	{ name: "GourmetLocationLog" },
);
export const GourmetLocationLogsResponseSchema = z.array(GourmetLocationLogSchema);

export const GourmetWordLogSchema = withOpenApi(
	z.object({
		id: z.string(),
		text: z.string().nullable(),
		createdAt: z.string(),
		updatedAt: z.string(),
	}),
	{ name: "GourmetWordLog" },
);
export const GourmetWordLogsResponseSchema = z.array(GourmetWordLogSchema);

export const GourmetLogsResponseSchema = z.union([
	GourmetLocationLogsResponseSchema,
	GourmetWordLogsResponseSchema,
]);
export type GourmetLogsResponse = z.infer<typeof GourmetLogsResponseSchema>;

export const ErrorLogSchema = withOpenApi(
	z.object({
		id: z.string(),
		contents: z.string(),
		createdAt: z.string(),
		updatedAt: z.string(),
	}),
	{ name: "ErrorLog" },
);
export const ErrorLogsResponseSchema = z.array(ErrorLogSchema);
export type ErrorLogsResponse = z.infer<typeof ErrorLogsResponseSchema>;

export const JobLogSchema = withOpenApi(
	z.object({
		id: z.string(),
		isSuccess: z.boolean(),
		contents: z.string().nullable(),
		info: z.string().nullable(),
		createdAt: z.string(),
		updatedAt: z.string(),
	}),
	{ name: "JobLog" },
);
export const JobLogsResponseSchema = z.array(JobLogSchema);
export type JobLogsResponse = z.infer<typeof JobLogsResponseSchema>;
