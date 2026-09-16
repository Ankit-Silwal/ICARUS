import { createService } from "@icarus/service-kit";
import {
  integrityErrorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";
import { requireIdentity } from "./middleware/identity.middleware.js";
import { integrityRouter } from "./routes/integrity.routes.js";

export const app = createService("integrity");

app.use(requireIdentity);
app.use(integrityRouter);
app.use(notFoundHandler);
app.use(integrityErrorHandler);
