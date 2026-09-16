import { createService } from "@icarus/service-kit";
import {
  assessmentErrorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";
import { requireIdentity } from "./middleware/identity.middleware.js";
import { requireInternalService } from "./middleware/internal.middleware.js";
import { internalRouter } from "./routes/internal.routes.js";
import { questionRouter } from "./routes/question.routes.js";

export const app = createService("assessment");

app.use("/internal", requireInternalService, internalRouter);
app.use(requireIdentity);
app.use("/questions", questionRouter);
app.use(notFoundHandler);
app.use(assessmentErrorHandler);
