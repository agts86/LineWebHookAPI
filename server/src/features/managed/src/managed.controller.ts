import {
	Controller,
	Get,
	Param,
	StandardSchemaValidationPipe,
	UseGuards,
	UsePipes,
} from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard, formatAsJstIsoString } from "@api/shared";
import { ManagedService } from "./managed.service.js";
import {
	ErrorLogsResponseSchema,
	GourmetLogsResponseSchema,
	JobLogsResponseSchema,
	MessageTypeParamSchema,
	type ErrorLogsResponse,
	type GourmetLogsResponse,
	type JobLogsResponse,
	type MessageTypeParam,
} from "./managed.dto.js";

function withJstTimestamps<T extends { createdAt: Date; updatedAt: Date }>(
	row: T,
): Omit<T, "createdAt" | "updatedAt"> & {
	createdAt: string;
	updatedAt: string;
} {
	return {
		...row,
		createdAt: formatAsJstIsoString(row.createdAt),
		updatedAt: formatAsJstIsoString(row.updatedAt),
	};
}

/** gourmet/error-log/job-log を実装するコントローラー。ホスト側の設定で /api/v1/managed に公開される。 */
@ApiTags("Managed")
@Controller({ path: "managed", version: "1" })
@UseGuards(JwtAuthGuard)
@UsePipes(StandardSchemaValidationPipe)
export class ManagedController {
	constructor(private readonly managedService: ManagedService) {}

	@Get("gourmet/:messageType")
	@ApiResponse({
		status: 200,
		description: "ロケーション/ワードのログ一覧（createdAt降順）",
		standardSchema: GourmetLogsResponseSchema,
	})
	async getGourmetLogs(
		@Param({ schema: MessageTypeParamSchema }) params: MessageTypeParam,
	): Promise<GourmetLogsResponse> {
		if (params.messageType === "location") {
			const logs = await this.managedService.getGourmetLogs("location");
			return logs.map(withJstTimestamps);
		}
		const logs = await this.managedService.getGourmetLogs("text");
		return logs.map(withJstTimestamps);
	}

	@Get("error-log")
	@ApiResponse({
		status: 200,
		description: "エラーログ一覧（createdAt降順）",
		standardSchema: ErrorLogsResponseSchema,
	})
	async getErrorLogs(): Promise<ErrorLogsResponse> {
		const logs = await this.managedService.getErrorLogs();
		return logs.map(withJstTimestamps);
	}

	@Get("job-log")
	@ApiResponse({
		status: 200,
		description: "ジョブログ一覧（createdAt降順）",
		standardSchema: JobLogsResponseSchema,
	})
	async getJobLogs(): Promise<JobLogsResponse> {
		const logs = await this.managedService.getJobLogs();
		return logs.map(withJstTimestamps);
	}
}
