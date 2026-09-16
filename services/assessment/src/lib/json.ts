import type { Prisma } from "../generated/prisma/client.js";
import { badRequest } from "./errors.js";

export function toJson(value: unknown): Prisma.InputJsonValue {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined)
      throw new Error("Value is not JSON serializable.");
    return JSON.parse(serialized) as Prisma.InputJsonValue;
  } catch {
    throw badRequest(
      "INVALID_JSON_VALUE",
      "Question inputs, answers, and expected outputs must be valid JSON values.",
    );
  }
}
