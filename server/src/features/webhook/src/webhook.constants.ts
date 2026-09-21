/** WebhookRepository実装の注入トークン。実装はinfrastructure側が提供する。 */
export const WEBHOOK_REPOSITORY = Symbol("WEBHOOK_REPOSITORY");

/** SpotSearchClient実装の注入トークン。実装はinfrastructure側が提供する。 */
export const SPOT_SEARCH_CLIENT = Symbol("SPOT_SEARCH_CLIENT");

/** ParkingClient実装の注入トークン。実装はinfrastructure側が提供する。 */
export const PARKING_CLIENT = Symbol("PARKING_CLIENT");

/** スポット検索用LINEチャンネルのLineReplyClient実装の注入トークン。 */
export const SPOT_LINE_REPLY_CLIENT = Symbol("SPOT_LINE_REPLY_CLIENT");

/** バイク駐車場検索用LINEチャンネルのLineReplyClient実装の注入トークン。 */
export const PARKING_LINE_REPLY_CLIENT = Symbol("PARKING_LINE_REPLY_CLIENT");

/** WebhookModuleOptionsの注入トークン。 */
export const WEBHOOK_MODULE_OPTIONS = Symbol("WEBHOOK_MODULE_OPTIONS");

/** LINEへの実際の返信APIコールをスキップするかどうかの注入トークン。 */
export const SKIP_LINE_API_CALL = Symbol("SKIP_LINE_API_CALL");

export interface WebhookModuleOptions {
	/** スポット検索用LINEチャンネルのChannel Secret。 */
	spotChannelSecret: string;
	/** バイク駐車場検索用LINEチャンネルのChannel Secret。 */
	parkingChannelSecret: string;
	/** LINE署名を検証するかどうか。LINE実機なしのローカル疎通確認でのみfalseにする。 */
	verifyLineSignature: boolean;
	/** LINEへの実際の返信APIコールをスキップするかどうか。本番以外ではtrueにする。 */
	skipLineApiCall: boolean;
}
