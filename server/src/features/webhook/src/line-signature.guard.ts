import {
	Inject,
	Injectable,
	UnauthorizedException,
	type CanActivate,
	type ExecutionContext,
} from "@nestjs/common";
import { validateSignature } from "@line/bot-sdk";
import { WEBHOOK_MODULE_OPTIONS, type WebhookModuleOptions } from "./webhook.constants.js";

const SIGNATURE_HEADER = "x-line-signature";

export interface LineSignedRequest {
	headers: Record<string, string | string[] | undefined>;
	/** パース前の生ボディ。アプリ生成時に rawBody: true を指定した場合のみセットされる。 */
	rawBody?: Buffer;
}

/**
 * 既存.NET側 LineSignatureFilter 相当のガード。
 * x-line-signatureヘッダーをchannelSecretと生ボディで検証し、失敗時は401 { message: "Unauthorized." } を返す。
 * verifySignature=false はローカル開発でLINEからの実リクエストを模擬しない場合のみ使う。
 */
export class LineSignatureGuard implements CanActivate {
	constructor(
		private readonly channelSecret: string,
		private readonly verifySignature: boolean,
	) {}

	canActivate(context: ExecutionContext): boolean {
		if (!this.verifySignature) {
			return true;
		}

		const request = context.switchToHttp().getRequest<LineSignedRequest>();
		const signature = request.headers[SIGNATURE_HEADER];
		if (typeof signature !== "string" || !request.rawBody) {
			throw new UnauthorizedException({ message: "Unauthorized." });
		}

		if (!validateSignature(request.rawBody, this.channelSecret, signature)) {
			throw new UnauthorizedException({ message: "Unauthorized." });
		}

		return true;
	}
}

/** スポット検索用LINEチャンネルのChannel Secretで検証するガード。 */
@Injectable()
export class SpotLineSignatureGuard extends LineSignatureGuard {
	constructor(@Inject(WEBHOOK_MODULE_OPTIONS) options: WebhookModuleOptions) {
		super(options.spotChannelSecret, options.verifyLineSignature);
	}
}

/** バイク駐車場検索用LINEチャンネルのChannel Secretで検証するガード。 */
@Injectable()
export class ParkingLineSignatureGuard extends LineSignatureGuard {
	constructor(@Inject(WEBHOOK_MODULE_OPTIONS) options: WebhookModuleOptions) {
		super(options.parkingChannelSecret, options.verifyLineSignature);
	}
}
