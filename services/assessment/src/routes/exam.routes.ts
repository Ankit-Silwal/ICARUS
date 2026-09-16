import { Router } from "express";
import { examController } from "../controllers/exam.controller.js";

export const examRouter = Router();

examRouter.get("/", (request, response) =>
  examController.list(request, response),
);
examRouter.post("/", (request, response) =>
  examController.create(request, response),
);
examRouter.post("/:examId/start", (request, response) =>
  examController.start(request, response),
);
examRouter.post("/:examId/schedule", (request, response) =>
  examController.schedule(request, response),
);
examRouter.post("/:examId/close", (request, response) =>
  examController.close(request, response),
);
examRouter.post("/:examId/publish", (request, response) =>
  examController.publish(request, response),
);
examRouter.get("/:examId", (request, response) =>
  examController.get(request, response),
);
