import { createService } from "@icarus/service-kit";
import {
  integrityErrorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";

export const app = createService("integrity");

app.use(notFoundHandler);
app.use(integrityErrorHandler);
