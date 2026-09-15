import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";

export const authRouter = Router();

authRouter.get("/oauth/google", (request, response) =>
  authController.googleAuthorization(request, response),
);
authRouter.get("/oauth/google/callback", (request, response) =>
  authController.googleCallback(request, response),
);
authRouter.get("/session", (request, response) =>
  authController.session(request, response),
);
authRouter.post("/logout", (request, response) =>
  authController.logout(request, response),
);
