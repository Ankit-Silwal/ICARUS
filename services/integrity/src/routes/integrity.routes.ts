import { Router } from "express";
import { integrityController } from "../controllers/integrity.controller.js";

export const integrityRouter = Router();

integrityRouter.post("/events", (request, response) =>
  integrityController.ingest(request, response),
);
integrityRouter.get(
  "/reports/:attemptId/:questionId/events",
  (request, response) => integrityController.listEvents(request, response),
);
integrityRouter.post(
  "/reports/:attemptId/:questionId/reanalyze",
  (request, response) => integrityController.reanalyze(request, response),
);
integrityRouter.get("/reports/:attemptId/:questionId", (request, response) =>
  integrityController.getReport(request, response),
);
integrityRouter.get("/reports/:attemptId", (request, response) =>
  integrityController.listReports(request, response),
);
integrityRouter.delete("/retention/expired", (request, response) =>
  integrityController.removeExpired(request, response),
);
