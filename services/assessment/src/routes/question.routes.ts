import { Router } from "express";
import { questionController } from "../controllers/question.controller.js";

export const questionRouter = Router();

questionRouter.get("/", (request, response) =>
  questionController.list(request, response),
);
questionRouter.post("/", (request, response) =>
  questionController.create(request, response),
);
questionRouter.get(
  "/import/leetcode/:problemNumber/preview",
  (request, response) => questionController.previewLeetCode(request, response),
);
questionRouter.post("/import/leetcode", (request, response) =>
  questionController.importLeetCode(request, response),
);
questionRouter.get("/:questionId", (request, response) =>
  questionController.get(request, response),
);
questionRouter.delete("/:questionId", (request, response) =>
  questionController.remove(request, response),
);
