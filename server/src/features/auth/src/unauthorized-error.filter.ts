import { Catch, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";
import { UnauthorizedError } from "./auth.service.js";

/** AuthServiceが投げるUnauthorizedErrorを 401 { message } に変換する例外フィルタ。 */
@Catch(UnauthorizedError)
export class UnauthorizedErrorFilter implements ExceptionFilter<UnauthorizedError> {
	catch(exception: UnauthorizedError, host: ArgumentsHost): void {
		const response = host.switchToHttp().getResponse<Response>();
		response.status(401).json({ message: exception.message });
	}
}
