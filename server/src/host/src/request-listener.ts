import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "./create-app.js";

export type NodeRequestListener = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * listenせずにNode標準の (req, res) 形式でリクエストを処理する関数を返す（サーバーレス環境のエントリ向け）。
 * アプリの初期化は最初のリクエストで一度だけ行い、以降は同じインスタンスを使い回す。
 */
export function createNodeRequestListener(): (
	req: IncomingMessage,
	res: ServerResponse,
) => Promise<void> {
	let listener: Promise<NodeRequestListener> | undefined;

	return async (req, res) => {
		listener ??= createApp().then(
			(app) => app.getHttpAdapter().getInstance() as NodeRequestListener,
		);
		(await listener)(req, res);
	};
}
