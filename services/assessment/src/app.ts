import { createService } from "@icarus/service-kit";
import {
  assessmentErrorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";

export const app = createService("assessment");

app.use(notFoundHandler);
app.use(assessmentErrorHandler);
