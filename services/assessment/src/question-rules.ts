import type { Question } from "@icarus/contracts";
import { badRequest } from "./lib/errors.js";

const EPSILON = 0.000_001;

export function assertQuestionIsGradable(question: Question) {
  if (question.kind === "MCQ") {
    const optionIds = question.options.map((option) => option.id);
    if (new Set(optionIds).size !== optionIds.length) {
      throw badRequest("DUPLICATE_OPTION_ID", "MCQ option IDs must be unique.");
    }
    if (!optionIds.includes(question.correctOptionId)) {
      throw badRequest(
        "INVALID_CORRECT_OPTION",
        "The correct option must match one of the MCQ options.",
      );
    }
    return;
  }

  const testIds = question.tests.map((test) => test.id);
  if (new Set(testIds).size !== testIds.length) {
    throw badRequest("DUPLICATE_TEST_ID", "Test case IDs must be unique.");
  }
  if (!question.tests.some((test) => test.visibility === "HIDDEN")) {
    throw badRequest(
      "HIDDEN_TEST_REQUIRED",
      "A coding question must include at least one hidden grading test.",
    );
  }
  if (
    question.tests.some(
      (test) => test.visibility === "SAMPLE" && test.weight !== 0,
    )
  ) {
    throw badRequest(
      "SAMPLE_TEST_HAS_MARKS",
      "Sample tests cannot award marks.",
    );
  }
  const hiddenMarks = question.tests
    .filter((test) => test.visibility === "HIDDEN")
    .reduce((sum, test) => sum + test.weight, 0);
  if (Math.abs(hiddenMarks - question.points) > EPSILON) {
    throw badRequest(
      "INVALID_TEST_WEIGHT",
      "Hidden test-case marks must add up to the question marks.",
      {
        questionPoints: question.points,
        hiddenTestMarks: hiddenMarks,
      },
    );
  }
  const missingStarter = question.languages.find(
    (language) => !question.starterCode[language]?.trim(),
  );
  if (missingStarter) {
    throw badRequest(
      "MISSING_STARTER_CODE",
      `Starter code is required for ${missingStarter}.`,
    );
  }
}
