import cookieParser from "cookie-parser";
import { createService } from "@icarus/service-kit";
import {
  identityErrorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";
import { identityRouter } from "./routes/index.js";

export const app = createService("identity");

app.set("trust proxy", 1);
app.use(cookieParser());
app.use(identityRouter);
app.use(notFoundHandler);
app.use(identityErrorHandler);
