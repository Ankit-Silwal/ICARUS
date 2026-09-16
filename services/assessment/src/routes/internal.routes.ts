import { Router } from "express";
import { internalController } from "../controllers/internal.controller.js";

export const internalRouter = Router();

internalRouter.get("/questions/:questionId", (request, response) =>
  internalController.getQuestion(request, response),
);
