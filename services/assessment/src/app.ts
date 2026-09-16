import { createService } from "@icarus/service-kit";
import { attemptController } from "./controllers/attempt.controller.js";
import {
  assessmentErrorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";
import { requireIdentity } from "./middleware/identity.middleware.js";
import { requireInternalService } from "./middleware/internal.middleware.js";
import { internalRouter } from "./routes/internal.routes.js";
import { attemptRouter } from "./routes/attempt.routes.js";
import { examRouter } from "./routes/exam.routes.js";
import { questionRouter } from "./routes/question.routes.js";

export const app = createService("assessment");

app.use("/internal", requireInternalService, internalRouter);
app.use(requireIdentity);
app.use("/questions", questionRouter);
app.use("/exams", examRouter);
app.use("/attempts", attemptRouter);
app.get("/reviews", (request, response) =>
  attemptController.listReviews(request, response),
);
app.get("/results", (request, response) =>
  attemptController.results(request, response),
);
app.use(notFoundHandler);
app.use(assessmentErrorHandler);
