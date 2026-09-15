import { Router } from "express";
import { adminRouter } from "./admin.routes.js";
import { authRouter } from "./auth.routes.js";
import { teacherInvitationRouter } from "./teacher-invitation.routes.js";
import { userRouter } from "./user.routes.js";

export const identityRouter = Router();

identityRouter.use(authRouter);
identityRouter.use("/users", userRouter);
identityRouter.use("/admin", adminRouter);
identityRouter.use("/teacher-invitations", teacherInvitationRouter);
