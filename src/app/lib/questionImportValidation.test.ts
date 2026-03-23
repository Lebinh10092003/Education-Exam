import { describe, expect, it } from "vitest";

import { validateQuestionImportFile } from "./questionImportValidation";

describe("validateQuestionImportFile", () => {
  it("accepts csv rows that all match the exam subject", async () => {
    const file = new File(
      [
        [
          "subject_code,difficulty,question_type,question_text,option_A,option_B,correct_option_keys",
          "MATH101,easy,multiple_choice,What is 2 + 2?,3,4,B",
          "MATH101,medium,multiple_choice,What is 3 + 3?,5,6,B",
        ].join("\n"),
      ],
      "questions.csv",
      { type: "text/csv" },
    );

    const result = await validateQuestionImportFile({
      file,
      sourceFormat: "csv",
      expectedSubjectCode: "MATH101",
    });

    expect(result.ok).toBe(true);
    expect(result.mismatchedSubjectCodes).toEqual([]);
    expect(result.missingSubjectRows).toEqual([]);
  });

  it("rejects csv rows with mismatched subject codes", async () => {
    const file = new File(
      [
        [
          "subject_code,difficulty,question_type,question_text,option_A,option_B,correct_option_keys",
          "MATH101,easy,multiple_choice,What is 2 + 2?,3,4,B",
          "PHYS101,medium,multiple_choice,What is force?,Mass x Acceleration,Velocity,A",
        ].join("\n"),
      ],
      "questions.csv",
      { type: "text/csv" },
    );

    const result = await validateQuestionImportFile({
      file,
      sourceFormat: "csv",
      expectedSubjectCode: "MATH101",
    });

    expect(result.ok).toBe(false);
    expect(result.mismatchedSubjectCodes).toEqual(["PHYS101"]);
    expect(result.error).toContain("MATH101");
  });

  it("rejects malformed json payloads", async () => {
    const file = new File(
      ['{"subject_code":"MATH101"'],
      "questions.json",
      { type: "application/json" },
    );

    const result = await validateQuestionImportFile({
      file,
      sourceFormat: "json",
      expectedSubjectCode: "MATH101",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Invalid JSON");
  });

  it("rejects json rows with missing subject codes", async () => {
    const file = new File(
      [
        JSON.stringify([
          {
            difficulty: "easy",
            question_type: "essay",
            question_text: "Explain algebra.",
          },
        ]),
      ],
      "questions.json",
      { type: "application/json" },
    );

    const result = await validateQuestionImportFile({
      file,
      sourceFormat: "json",
      expectedSubjectCode: "MATH101",
    });

    expect(result.ok).toBe(false);
    expect(result.missingSubjectRows).toEqual([1]);
  });
});
