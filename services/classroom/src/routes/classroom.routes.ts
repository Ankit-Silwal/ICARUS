import { Router } from "express";
import { classroomController } from "../controllers/classroom.controller.js";

export const classroomRouter = Router();

classroomRouter.get("/", (request, response) =>
  classroomController.list(request, response),
);
classroomRouter.post("/", (request, response) =>
  classroomController.create(request, response),
);
classroomRouter.post("/join", (request, response) =>
  classroomController.join(request, response),
);
classroomRouter.get("/:id", (request, response) =>
  classroomController.get(request, response),
);
classroomRouter.delete("/:id", (request, response) =>
  classroomController.remove(request, response),
);
classroomRouter.delete("/:id/leave", (request, response) =>
  classroomController.leave(request, response),
);
classroomRouter.get("/:id/students", (request, response) =>
  classroomController.listStudents(request, response),
);
classroomRouter.delete("/:id/students/:studentId", (request, response) =>
  classroomController.removeStudent(request, response),
);
