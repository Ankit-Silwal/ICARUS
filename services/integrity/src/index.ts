import { listen, logger } from "@icarus/service-kit";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

async function bootstrap() {
  await prisma.$connect();
  logger.info("integrity database ready");
  listen(app, env.PORT);
}

async function shutdown(signal: string) {
  logger.info({ signal }, "integrity service shutting down");
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

bootstrap().catch((error: unknown) => {
  logger.fatal({ error }, "integrity service failed to start");
  process.exit(1);
});
