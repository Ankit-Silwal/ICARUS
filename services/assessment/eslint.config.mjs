import { config } from "@repo/eslint-config/typescript";

export default [{ ignores: ["src/generated/prisma/**"] }, ...config];
