import { Inject, Injectable } from "@nestjs/common";
import { MANAGED_REPOSITORY } from "./managed.constants.js";
import type {
	ManagedRepository,
	GourmetLocationLogRow,
	GourmetWordLogRow,
	ErrorLogRow,
	JobLogRow,
} from "./managed.repository.js";

export type MessageType = "location" | "text";

/** 既存.NET側 ManagedService と同じ振る舞い（フィルタ・集計なし、リポジトリへの単純委譲） */
@Injectable()
export class ManagedService {
	constructor(@Inject(MANAGED_REPOSITORY) private readonly repo: ManagedRepository) {}

	// オーバーロード: 呼び出し側がリテラルでmessageTypeを渡した場合に戻り値の型を絞り込めるようにする
	// （.map()等をUnion型のまま呼ぶとTypeScriptの型推論が意図せず広がるため）
	async getGourmetLogs(messageType: "location"): Promise<GourmetLocationLogRow[]>;
	async getGourmetLogs(messageType: "text"): Promise<GourmetWordLogRow[]>;
	async getGourmetLogs(
		messageType: MessageType,
	): Promise<GourmetLocationLogRow[] | GourmetWordLogRow[]> {
		if (messageType === "location") {
			return this.repo.findGourmetLocationLogs();
		}
		return this.repo.findGourmetWordLogs();
	}

	async getErrorLogs(): Promise<ErrorLogRow[]> {
		return this.repo.findErrorLogs();
	}

	async getJobLogs(): Promise<JobLogRow[]> {
		return this.repo.findJobLogs();
	}
}
