import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule, type StandardSchemaConverter } from "@nestjs/swagger";
import { ZodType, type ZodTypeDef } from "zod";
import { ignoreOverride, zodToJsonSchema } from "zod-to-json-schema";
import { listOpenApiSchemas, type OpenApiSchemaMetadata } from "@api/shared";

const COMPONENT_REF_PREFIX = "#/components/schemas/";

type OpenApiSchemaObject = Record<string, unknown>;

interface RegisteredSchema {
	schema: ZodType<unknown>;
	metadata: OpenApiSchemaMetadata;
}

function isZodSchema(schema: unknown): schema is ZodType<unknown> {
	return schema instanceof ZodType;
}

/** withOpenApiで登録済みのZodスキーマを、変換フックから引けるよう定義オブジェクトをキーにして索引化する。 */
function indexRegisteredSchemas(): Map<ZodTypeDef, RegisteredSchema> {
	const index = new Map<ZodTypeDef, RegisteredSchema>();
	for (const [schema, metadata] of listOpenApiSchemas()) {
		if (isZodSchema(schema)) {
			index.set(schema._def, { schema, metadata });
		}
	}
	return index;
}

/**
 * ZodスキーマをOpenAPI 3のスキーマへ変換する。
 * 内部に現れた名前付きスキーマは$ref参照に置き換えてreferencedへ集め、登録済みの例示値はexampleとして付与する。
 */
function toOpenApiSchema(
	root: ZodType<unknown>,
	index: Map<ZodTypeDef, RegisteredSchema>,
	referenced: Set<RegisteredSchema>,
): OpenApiSchemaObject {
	return zodToJsonSchema(root, {
		target: "openApi3",
		$refStrategy: "none",
		override: (def) => {
			const registered = index.get(def);
			if (registered?.metadata.name === undefined || def === root._def) {
				return ignoreOverride;
			}
			referenced.add(registered);
			return { $ref: `${COMPONENT_REF_PREFIX}${registered.metadata.name}` };
		},
		postProcess: (jsonSchema, def) => {
			const example = index.get(def)?.metadata.example;
			return jsonSchema && example !== undefined ? { ...jsonSchema, example } : jsonSchema;
		},
	});
}

/** 起点の名前付きスキーマから$refで辿れる名前付きスキーマをすべて変換し、components.schemas用の定義を返す。 */
function collectComponents(
	entryPoints: Set<RegisteredSchema>,
	index: Map<ZodTypeDef, RegisteredSchema>,
): Record<string, OpenApiSchemaObject> {
	const components: Record<string, OpenApiSchemaObject> = {};
	const pending = [...entryPoints];
	for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
		const name = current.metadata.name;
		if (name === undefined || name in components) {
			continue;
		}
		const referenced = new Set<RegisteredSchema>();
		components[name] = toOpenApiSchema(current.schema, index, referenced);
		pending.push(...referenced);
	}
	return components;
}

/**
 * 各featureのZodスキーマをOpenAPI 3のスキーマへ変換するコンバーターを作る。Zod以外のスキーマは扱わない。
 * 名前付きスキーマはcomponents.schemasへ登録して$refで参照し、名前の無いスキーマはインライン展開する。
 */
function createZodSchemaConverter(): StandardSchemaConverter {
	const index = indexRegisteredSchemas();

	return (schema) => {
		if (!isZodSchema(schema)) {
			return undefined;
		}

		const referenced = new Set<RegisteredSchema>();
		const registered = index.get(schema._def);
		if (registered?.metadata.name !== undefined) {
			referenced.add(registered);
			return {
				schema: { $ref: `${COMPONENT_REF_PREFIX}${registered.metadata.name}` },
				components: collectComponents(referenced, index),
			};
		}

		const converted = toOpenApiSchema(schema, index, referenced);
		return { schema: converted, components: collectComponents(referenced, index) };
	};
}

/** /doc でOpenAPI JSON、/ui でSwagger UIを公開する。 */
export function setupSwagger(app: INestApplication): void {
	const config = new DocumentBuilder().setTitle("api (Auth / Managed)").setVersion("0.1.0").build();
	const document = SwaggerModule.createDocument(app, config, {
		standardSchemaConverter: createZodSchemaConverter(),
	});
	SwaggerModule.setup("ui", app, document, { jsonDocumentUrl: "doc" });
}
