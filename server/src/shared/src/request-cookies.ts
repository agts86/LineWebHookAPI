import { parseCookie } from "cookie";
import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export interface RequestWithCookieHeader {
	headers: { cookie?: string };
}

/** リクエストのCookieヘッダーから指定名のCookie値を取り出す。無ければundefinedを返す。 */
export function readCookie(request: RequestWithCookieHeader, name: string): string | undefined {
	const header = request.headers.cookie;
	if (!header) {
		return undefined;
	}
	return parseCookie(header)[name];
}

/** コントローラーの引数に指定名のCookie値を注入するパラメータデコレータ。 */
export const Cookies = createParamDecorator(
	(name: string, context: ExecutionContext): string | undefined =>
		readCookie(context.switchToHttp().getRequest<RequestWithCookieHeader>(), name),
);
