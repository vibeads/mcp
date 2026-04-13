/**
 * Minimal Zod → JSON Schema converter for MCP tool inputSchema.
 *
 * We only support the Zod features our tools actually use (string, number,
 * boolean, enum, object, optional, default, describe). A full conversion
 * library like `zod-to-json-schema` would pull in more weight than we need
 * for 5 tools with simple shapes.
 */

import { z, type ZodTypeAny } from "zod";

type JsonSchema = Record<string, any>;

export function zodToJsonSchema(schema: ZodTypeAny): JsonSchema {
  return convert(schema);
}

function convert(schema: ZodTypeAny): JsonSchema {
  // Unwrap ZodDefault — we keep the description but record the default
  if (schema instanceof z.ZodDefault) {
    const inner = convert(schema._def.innerType);
    inner.default = schema._def.defaultValue();
    return inner;
  }

  // Unwrap ZodOptional
  if (schema instanceof z.ZodOptional) {
    return convert(schema._def.innerType);
  }

  if (schema instanceof z.ZodString) {
    const base: JsonSchema = { type: "string" };
    if (schema.description) base.description = schema.description;
    return base;
  }

  if (schema instanceof z.ZodNumber) {
    const base: JsonSchema = { type: "number" };
    if (schema.description) base.description = schema.description;
    return base;
  }

  if (schema instanceof z.ZodBoolean) {
    const base: JsonSchema = { type: "boolean" };
    if (schema.description) base.description = schema.description;
    return base;
  }

  if (schema instanceof z.ZodEnum) {
    const base: JsonSchema = {
      type: "string",
      enum: schema._def.values,
    };
    if (schema.description) base.description = schema.description;
    return base;
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, ZodTypeAny>;
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];

    for (const [key, field] of Object.entries(shape)) {
      properties[key] = convert(field);
      // ZodOptional and ZodDefault are BOTH optional for the consumer
      if (!(field instanceof z.ZodOptional) && !(field instanceof z.ZodDefault)) {
        required.push(key);
      }
    }

    const base: JsonSchema = {
      type: "object",
      properties,
    };
    if (required.length > 0) base.required = required;
    if (schema.description) base.description = schema.description;
    return base;
  }

  // Fallback — let MCP clients still see something usable
  return { type: "string" };
}
