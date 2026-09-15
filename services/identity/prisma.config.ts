import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Runtime configuration is validated in src/config/env.ts. The fallback only
    // allows schema generation in environments where the database is not running.
    url:
      process.env.DATABASE_URL ??
      "postgresql://icarus:icarus@localhost:5432/icarus",
  },
});
