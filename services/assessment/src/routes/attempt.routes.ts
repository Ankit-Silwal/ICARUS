import { Router } from "express";
import { attemptController } from "../controllers/attempt.controller.js";

export const attemptRouter = Router();

attemptRouter.put("/:attemptId/autosave", (request, response) =>
  attemptController.autosave(request, response),
);
attemptRouter.post("/:attemptId/submit", (request, response) =>
  attemptController.submit(request, response),
);
attemptRouter.patch("/:attemptId/deduction", (request, response) =>
  attemptController.applyReduction(request, response),
);
