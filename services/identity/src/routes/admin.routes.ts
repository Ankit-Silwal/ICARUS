import { Router } from "express";
import multer from "multer";
import { adminController } from "../controllers/admin.controller.js";
import { env } from "../config/env.js";
import {
  requireAuthentication,
  requireRole,
} from "../middleware/auth.middleware.js";

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_TEACHER_IMPORT_BYTES, files: 1 },
});

export const adminRouter = Router();

adminRouter.use(requireAuthentication, requireRole("ADMIN"));
adminRouter.get("/users", (request, response) =>
  adminController.listUsers(request, response),
);
adminRouter.get("/users/:id", (request, response) =>
  adminController.getUser(request, response),
);
adminRouter.patch("/users/:id/status", (request, response) =>
  adminController.updateStatus(request, response),
);
adminRouter.patch("/users/:id/role", (request, response) =>
  adminController.updateRole(request, response),
);
adminRouter.get("/teachers/invitations", (request, response) =>
  adminController.listInvitations(request, response),
);
adminRouter.post("/teachers/invitations", (request, response) =>
  adminController.inviteTeacher(request, response),
);
adminRouter.post(
  "/teachers/import",
  csvUpload.single("file"),
  (request, response) => adminController.importTeachers(request, response),
);
adminRouter.get("/teacher-imports/:id", (request, response) =>
  adminController.getTeacherImport(request, response),
);
adminRouter.get("/audit-logs", (request, response) =>
  adminController.listAuditLogs(request, response),
);
