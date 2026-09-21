import { z } from "zod";
import { withOpenApi } from "@api/shared";

export const LoginRequestSchema = withOpenApi(
	z.object({
		userName: withOpenApi(z.string().min(1), { example: "admin" }),
		password: withOpenApi(z.string().min(1), { example: "admin" }),
	}),
	{ name: "LoginRequest" },
);
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = withOpenApi(
	z.object({
		userName: withOpenApi(z.string(), { example: "admin" }),
		expiresAt: withOpenApi(z.string(), { example: "2026-07-07T19:29:45.890Z" }),
	}),
	{ name: "LoginResponse" },
);
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const MeResponseSchema = withOpenApi(
	z.object({
		userName: withOpenApi(z.string(), { example: "admin" }),
	}),
	{ name: "MeResponse" },
);
export type MeResponse = z.infer<typeof MeResponseSchema>;

export const ErrorResponseSchema = withOpenApi(
	z.object({
		message: withOpenApi(z.string(), { example: "Unauthorized." }),
	}),
	{ name: "ErrorResponse" },
);
