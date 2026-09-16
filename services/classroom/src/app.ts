import { createService } from "@icarus/service-kit";
import {
  classroomErrorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";
import { requireIdentity } from "./middleware/identity.middleware.js";
import { classroomRouter } from "./routes/classroom.routes.js";

export const app = createService("classroom");

app.use(requireIdentity);
app.use("/classes", classroomRouter);
app.use(notFoundHandler);
app.use(classroomErrorHandler);
