import type { StandardSchemaV1 } from "@standard-schema/spec";

export interface OpenApiSchemaMetadata<TExample = unknown> {
	/** components.schemas に登録するスキーマ名。指定するとOpenAPI上は$ref参照になる。 */
	name?: string;
	/** Swagger UIに表示する例示値。 */
	example?: TExample;
}

const registry = new Map<StandardSchemaV1, OpenApiSchemaMetadata>();

function isNameTaken(name: string): boolean {
	return [...registry.values()].some((metadata) => metadata.name === name);
}

/**
 * スキーマにOpenAPI用のメタデータ（スキーマ名・例示値）を紐づけ、同じスキーマをそのまま返す。
 * スキーマ自体は変更しないため、バリデーションの振る舞いには影響しない。
 */
export function withOpenApi<T extends StandardSchemaV1>(
	schema: T,
	metadata: OpenApiSchemaMetadata<StandardSchemaV1.InferInput<T>>,
): T {
	if (metadata.name !== undefined && isNameTaken(metadata.name)) {
		throw new Error(`OpenAPI schema name is already registered: ${metadata.name}`);
	}
	registry.set(schema, metadata);
	return schema;
}

/** withOpenApiで登録済みの全スキーマとメタデータの組を返す。 */
export function listOpenApiSchemas(): [
	schema: StandardSchemaV1,
	metadata: OpenApiSchemaMetadata,
][] {
	return [...registry.entries()];
}
