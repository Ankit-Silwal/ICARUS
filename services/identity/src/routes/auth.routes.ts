import { Router } from "express";
import { env } from "../config/env.js";
import { authController } from "../controllers/auth.controller.js";

export const authRouter = Router();

if (env.NODE_ENV !== "production") {
  authRouter.post("/demo-login", (request, response) =>
    authController.demoLogin(request, response),
  );
}

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
