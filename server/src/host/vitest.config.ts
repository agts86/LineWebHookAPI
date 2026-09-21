import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// 実PostgreSQLの代わりにPGlite(WASM版Postgres)をlocalhost:5432で起動し、
// DATABASE_URLはdocker-composeの実DBと同じ接続先のまま実行する（モックしない方針を維持）。
export default defineConfig({
	plugins: [swc.vite({ module: { type: "es6" } })],
	test: {
		globalSetup: ["../tables/test-support/vitest-global-setup.ts"],
	},
});
