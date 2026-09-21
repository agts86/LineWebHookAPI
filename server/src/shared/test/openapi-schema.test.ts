import { describe, expect, it } from "vitest";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { listOpenApiSchemas, withOpenApi } from "../src/openapi-schema.js";

function fakeSchema<T>(): StandardSchemaV1<T> {
	return {
		"~standard": {
			version: 1,
			vendor: "test",
			validate: (value): StandardSchemaV1.Result<T> => ({ value: value as T }),
		},
	};
}

describe("withOpenApi", () => {
	it("渡したスキーマと同じインスタンスをそのまま返す（バリデーションに使うスキーマを変えない）", () => {
		const schema = fakeSchema<{ userName: string }>();

		const result = withOpenApi(schema, { name: "SameInstance" });

		expect(result).toBe(schema);
	});

	it("登録したスキーマ名と例示値をlistOpenApiSchemasから取り出せる", () => {
		const schema = fakeSchema<{ userName: string }>();

		withOpenApi(schema, { name: "Listed", example: { userName: "admin" } });

		const entry = listOpenApiSchemas().find(([registered]) => registered === schema);
		expect(entry?.[1]).toEqual({ name: "Listed", example: { userName: "admin" } });
	});

	it("スキーマ名を付けず例示値だけを登録できる（フィールド単位の例示値用）", () => {
		const schema = fakeSchema<string>();

		withOpenApi(schema, { example: "admin" });

		const entry = listOpenApiSchemas().find(([registered]) => registered === schema);
		expect(entry?.[1]).toEqual({ example: "admin" });
	});

	it("別のスキーマに同じスキーマ名を付けると例外を投げる（components.schemasでの上書き事故を防ぐ）", () => {
		withOpenApi(fakeSchema<string>(), { name: "Duplicated" });

		expect(() => withOpenApi(fakeSchema<number>(), { name: "Duplicated" })).toThrow(
			"OpenAPI schema name is already registered: Duplicated",
		);
	});
});
