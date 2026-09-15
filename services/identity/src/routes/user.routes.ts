import { Router } from "express";
import { userController } from "../controllers/user.controller.js";
import { requireAuthentication } from "../middleware/auth.middleware.js";

export const userRouter = Router();

userRouter.use(requireAuthentication);
userRouter.get("/me", (request, response) =>
  userController.me(request, response),
);
