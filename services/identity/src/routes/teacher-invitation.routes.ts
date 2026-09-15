import { Router } from "express";
import { adminController } from "../controllers/admin.controller.js";
import {
  requireAuthentication,
  requireRole,
} from "../middleware/auth.middleware.js";

// Compatibility routes for the existing admin portal. New clients should use
// /admin/teachers/invitations.
export const teacherInvitationRouter = Router();

teacherInvitationRouter.use(requireAuthentication, requireRole("ADMIN"));
teacherInvitationRouter.get("/", (request, response) =>
  adminController.listInvitations(request, response),
);
teacherInvitationRouter.post("/", (request, response) =>
  adminController.inviteTeacher(request, response),
);
