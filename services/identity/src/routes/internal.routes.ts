import { Router } from "express";
import { internalController } from "../controllers/internal.controller.js";
import { requireInternalService } from "../middleware/internal.middleware.js";

export const internalRouter = Router();

internalRouter.use(requireInternalService);
internalRouter.post("/users/resolve", (request, response) =>
  internalController.resolveUsers(request, response),
);
