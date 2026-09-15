import { listen, logger } from "@icarus/service-kit";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { sessionService } from "./services/session.service.js";
import { userService } from "./services/user.service.js";

async function bootstrap() {
  await prisma.$connect();
  const administrator = await userService.bootstrapAdministrator();
  await sessionService.removeExpired();
  logger.info(
    {
      administratorId: administrator.id,
      administratorEmail: administrator.email,
    },
    "identity database ready",
  );
  listen(app, env.PORT);
}

async function shutdown(signal: string) {
  logger.info({ signal }, "identity service shutting down");
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

bootstrap().catch((error: unknown) => {
  logger.fatal({ error }, "identity service failed to start");
  process.exit(1);
});
