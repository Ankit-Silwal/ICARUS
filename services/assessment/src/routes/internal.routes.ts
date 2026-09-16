import { Router } from "express";
import { internalController } from "../controllers/internal.controller.js";

export const internalRouter = Router();

internalRouter.get("/questions/:questionId", (request, response) =>
  internalController.getQuestion(request, response),
);
internalRouter.get(
  "/attempts/:attemptId/questions/:questionId",
  (request, response) =>
    internalController.getAttemptQuestion(request, response),
);
internalRouter.patch("/attempts/:attemptId/code-score", (request, response) =>
  internalController.recordCodeResult(request, response),
);
internalRouter.put(
  "/attempts/:attemptId/integrity-flags",
  (request, response) =>
    internalController.recordIntegrityFlags(request, response),
);
