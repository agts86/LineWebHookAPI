import { Inject, Injectable } from "@nestjs/common";
import type { webhook, messagingApi } from "@line/bot-sdk";
import type { ParkingClient, ParkingLocation, ParkingSpot } from "./client.js";
import type { LineReplyClient, CarouselColumn } from "../line-reply-client.js";
import type { ParkingEventResult } from "./types.js";
import {
	PARKING_CLIENT,
	PARKING_LINE_REPLY_CLIENT,
	SKIP_LINE_API_CALL,
} from "../webhook.constants.js";

export const NOT_FOUND_TEXT = "ごめんなさい。。見つかりませんでした。。";
const NOT_FOUND_ALT_TEXT = "検索結果";
const DETAIL_LABEL = "詳細を見る";
const MAX_CAROUSEL_COLUMNS = 10;
const JMPSA_ORIGIN = "https://www.jmpsa.or.jp";
// LINE Messaging API Carousel Column の上限（超過するとreplyMessage自体が400で拒否される）。
const CAROUSEL_TITLE_MAX_LENGTH = 40;
const CAROUSEL_TEXT_MAX_LENGTH = 60;
// 全角スペース(U+3000)を検出する。リテラル文字だとESLintのno-irregular-whitespaceに
// 引っかかるためコードポイント(0x3000)から動的に生成する。
const FULL_WIDTH_SPACE = new RegExp(String.fromCharCode(0x3000), "g");

function isMessageEvent(event: webhook.Event): event is webhook.MessageEvent {
	return event.type === "message";
}

function toSearchLocation(message: webhook.MessageContent): ParkingLocation | null {
	if (message.type === "text") {
		return { query: message.text.replace(FULL_WIDTH_SPACE, " ") };
	}
	if (message.type === "location") {
		return { lat: message.latitude, lng: message.longitude };
	}
	return null;
}

function toDetailUrl(detailUrl: string): string {
	return `${JMPSA_ORIGIN}${detailUrl}`;
}

function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}
	return `${text.slice(0, maxLength - 1)}…`;
}

function toCarouselText(spot: ParkingSpot): string {
	return truncate(spot.fee ?? "", CAROUSEL_TEXT_MAX_LENGTH);
}

function dedupeAndCap(spots: ParkingSpot[]): ParkingSpot[] {
	const seen = new Set<string>();
	const result: ParkingSpot[] = [];
	for (const spot of spots) {
		// detailUrlが無いとLINEのuri actionが不正になりカラム全体が拒否されるため、
		// 詳細URLを提示できない結果はカルーセルに含めない。
		if (!spot.detailUrl) continue;
		if (seen.has(spot.detailUrl)) continue;
		seen.add(spot.detailUrl);
		result.push(spot);
		if (result.length >= MAX_CAROUSEL_COLUMNS) break;
	}
	return result;
}

function toCarouselColumns(spots: ParkingSpot[]): CarouselColumn[] {
	return dedupeAndCap(spots).map((s) => ({
		title: truncate(s.name, CAROUSEL_TITLE_MAX_LENGTH),
		text: toCarouselText(s),
		detailUrl: toDetailUrl(s.detailUrl),
	}));
}

function buildMessages(spots: ParkingSpot[]): unknown[] {
	const columns = toCarouselColumns(spots);
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

/** jmpsa.or.jp（全国バイク駐車場・駐輪場案内）を使ったバイク駐車場検索版のReplyService相当 */
@Injectable()
export class ParkingReplyService {
	constructor(
		@Inject(PARKING_CLIENT) private readonly parkingClient: ParkingClient,
		@Inject(PARKING_LINE_REPLY_CLIENT) private readonly lineReplyClient: LineReplyClient,
		@Inject(SKIP_LINE_API_CALL) private readonly skipLineApiCall: boolean,
	) {}

	processEvent = async (event: webhook.Event): Promise<ParkingEventResult | null> => {
		if (!isMessageEvent(event) || !event.replyToken) {
			return null;
		}

		const location = toSearchLocation(event.message);
		if (!location) {
			return null;
		}

		const spots = await this.parkingClient.search(location);
		const messages = buildMessages(spots);
		const isReplySucceeded = await this.reply(event.replyToken, messages);

		return {
			reply: { replyToken: event.replyToken, messages },
			isReplySucceeded,
		};
	};

	async processEvents(webhookBody: webhook.CallbackRequest): Promise<ParkingEventResult[]> {
		const results: ParkingEventResult[] = [];
		for (const event of webhookBody.events) {
			const result = await this.processEvent(event);
			if (result) {
				results.push(result);
			}
		}
		return results;
	}

	private async reply(replyToken: string, messages: unknown[]): Promise<boolean> {
		if (this.skipLineApiCall) {
			return true;
		}

		return this.lineReplyClient.send(replyToken, messages);
	}
}
