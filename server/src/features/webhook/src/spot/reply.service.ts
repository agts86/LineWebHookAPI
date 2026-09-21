import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { webhook, messagingApi } from "@line/bot-sdk";
import { formatAsJstIsoString } from "@api/shared";
import type { SpotSearchClient, SpotFeature, SpotLocation } from "./search-client.js";
import type { LineReplyClient, CarouselColumn } from "../line-reply-client.js";
import type { GourmetLogEntry, SpotEventResult, PersistedMeta } from "./types.js";
import {
	SKIP_LINE_API_CALL,
	SPOT_LINE_REPLY_CLIENT,
	SPOT_SEARCH_CLIENT,
} from "../webhook.constants.js";

export const NOT_FOUND_TEXT = "ごめんなさい。。見つかりませんでした。。";
const NOT_FOUND_ALT_TEXT = "検索結果";
const DETAIL_LABEL = "詳細を見る";
const MAX_CAROUSEL_COLUMNS = 10;
// 全角スペース(U+3000)を検出する。リテラル文字だとESLintのno-irregular-whitespaceに
// 引っかかるためコードポイント(0x3000)から動的に生成する。
const FULL_WIDTH_SPACE = new RegExp(String.fromCharCode(0x3000), "g");

function isMessageEvent(event: webhook.Event): event is webhook.MessageEvent {
	return event.type === "message";
}

function toGourmetLogEntry(message: webhook.MessageContent): GourmetLogEntry | null {
	if (message.type === "text") {
		return { type: "word", text: message.text };
	}
	if (message.type === "location") {
		return { type: "location", lat: message.latitude, lng: message.longitude };
	}
	return null;
}

/**
 * 既存.NET側 IMessageExtensions.ConvertGourmetLog() で先にIdを発番し、
 * SaveChangesAsync時にCreatedAt/UpdatedAtを付与してからレスポンスに含める、という流れと
 * 同じ値をレスポンスとDB永続化の両方で共有するため、ここでid/timestampを確定させる。
 */
function toPersistedMeta(entry: GourmetLogEntry): PersistedMeta {
	const id = randomUUID();
	const now = formatAsJstIsoString(new Date());
	if (entry.type === "location") {
		return {
			id,
			lat: entry.lat,
			lng: entry.lng,
			createdAt: now,
			updatedAt: now,
		};
	}
	return { id, text: entry.text, createdAt: now, updatedAt: now };
}

function toQueryLocation(entry: GourmetLogEntry): SpotLocation {
	if (entry.type === "location") {
		return { lat: entry.lat, lon: entry.lng };
	}
	return { query: (entry.text ?? "").replace(FULL_WIDTH_SPACE, " ") };
}

function dedupeAndCap(features: SpotFeature[]): SpotFeature[] {
	const seen = new Set<string>();
	const result: SpotFeature[] = [];
	for (const feature of features) {
		// detailUrlが無いとLINEのuri actionが不正になりカラム全体が拒否されるため、
		// 詳細URLを提示できない結果はカルーセルに含めない。
		if (!feature.detailUrl) continue;
		if (seen.has(feature.gid)) continue;
		seen.add(feature.gid);
		result.push(feature);
		if (result.length >= MAX_CAROUSEL_COLUMNS) break;
	}
	return result;
}

function toCarouselColumns(features: SpotFeature[]): CarouselColumn[] {
	return dedupeAndCap(features).map((f) => ({
		title: f.name,
		text: f.address ?? "",
		detailUrl: f.detailUrl ?? "",
	}));
}

/**
 * 既存.NET側 LineReplyService.PostLocalAsync がReplyを組み立てる部分と同じ振る舞い。
 * メッセージ本文の組み立てをここに集約し、実際に送った内容をレスポンスにも含められるようにする。
 */
function buildMessages(features: SpotFeature[]): unknown[] {
	const columns = toCarouselColumns(features);
	if (columns.length === 0) {
		const textMessage: messagingApi.TextMessage = {
			type: "text",
			text: NOT_FOUND_TEXT,
		};
		return [textMessage];
	}

	const templateMessage: messagingApi.TemplateMessage = {
		type: "template",
		altText: NOT_FOUND_ALT_TEXT,
		template: {
			type: "carousel",
			columns: columns.map((column) => ({
				title: column.title,
				text: column.text,
				actions: [{ type: "uri", label: DETAIL_LABEL, uri: column.detailUrl }],
			})),
		},
	};
	return [templateMessage];
}

/** 既存.NET側 LineReplyService と同じ振る舞い（メッセージ解析→スポット検索→カルーセル/NotFound返信） */
@Injectable()
export class SpotReplyService {
	constructor(
		@Inject(SPOT_SEARCH_CLIENT) private readonly spotSearchClient: SpotSearchClient,
		@Inject(SPOT_LINE_REPLY_CLIENT) private readonly lineReplyClient: LineReplyClient,
		@Inject(SKIP_LINE_API_CALL) private readonly skipLineApiCall: boolean,
	) {}

	processEvent = async (
		event: webhook.Event,
		genreCode: string | undefined,
	): Promise<SpotEventResult | null> => {
		if (!isMessageEvent(event) || !event.replyToken) {
			return null;
		}

		const entry = toGourmetLogEntry(event.message);
		if (!entry) {
			return null;
		}
		const meta = toPersistedMeta(entry);

		const features = await this.spotSearchClient.search({
			genreCode: genreCode ?? "",
			location: toQueryLocation(entry),
		});
		const messages = buildMessages(features);
		const isReplySucceeded = await this.reply(event.replyToken, messages);

		return {
			reply: { replyToken: event.replyToken, messages },
			meta,
			isReplySucceeded,
		};
	};

	private async reply(replyToken: string, messages: unknown[]): Promise<boolean> {
		// 既存.NET側 Env.IsDevelopment() 時にLINE API呼び出し自体をスキップする挙動と同じ
		if (this.skipLineApiCall) {
			return true;
		}

		return this.lineReplyClient.send(replyToken, messages);
	}
}
