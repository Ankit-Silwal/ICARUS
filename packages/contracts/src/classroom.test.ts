import { describe, expect, it } from "vitest";
import {
  ClassroomJoinCodeSchema,
  ClassroomResponseSchema,
  CreateClassroomInputSchema,
} from "./classroom.js";

describe("classroom contracts", () => {
  it("normalizes unambiguous eight-character join codes", () => {
    expect(ClassroomJoinCodeSchema.parse("abcd2345")).toBe("ABCD2345");
  });

  it.each(["ABC123", "ABCD10O1", "ABCD-2345", "ABCDEFGHI"])(
    "rejects invalid join code %s",
    (code) => {
      expect(() => ClassroomJoinCodeSchema.parse(code)).toThrow();
    },
  );

  it("accepts the classroom creation contract", () => {
    expect(
      CreateClassroomInputSchema.parse({
        name: "Data Structures - Section A",
        subject: "Data Structures",
        academicYear: "2026-2027",
      }),
    ).toMatchObject({ academicYear: "2026-2027" });
  });

  it("accepts the public classroom response shape", () => {
    expect(
      ClassroomResponseSchema.parse({
        classroom: {
          id: "10000000-0000-4000-8000-000000000001",
          teacherId: "20000000-0000-4000-8000-000000000001",
          name: "Data Structures - Section A",
          subject: "Data Structures",
          description: null,
          section: "A",
          academicYear: "2026-2027",
          code: "ABCD2345",
          termEnd: null,
          createdAt: "2026-09-17T06:00:00.000Z",
          updatedAt: "2026-09-17T06:00:00.000Z",
          studentCount: 0,
        },
      }).classroom.code,
    ).toBe("ABCD2345");
  });
});
