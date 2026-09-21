import { Controller, Get, Header } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";

/** 死活監視用のヘルスチェック。/api プレフィックスとバージョンの対象外で /health に公開される。 */
@ApiExcludeController()
@Controller("health")
export class HealthController {
	@Get()
	@Header("Content-Type", "text/plain")
	check(): string {
		return "ok";
	}
}
