import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/**
 * このパッケージのテストは実際のPostgreSQLに対して各テーブルをdeleteMany()で
 * クリーンアップしながら実行する（Prisma系リポジトリの結合テスト）。
 * テストファイル間で同一テーブルを共有しているため、並列実行するとtruncateの
 * タイミング競合でflakyになる。ファイル単位を直列実行にして競合を防ぐ。
 */
export default defineConfig({
	plugins: [swc.vite({ module: { type: "es6" } })],
	test: {
		fileParallelism: false,
		globalSetup: ["../tables/test-support/vitest-global-setup.ts"],
	},
});
