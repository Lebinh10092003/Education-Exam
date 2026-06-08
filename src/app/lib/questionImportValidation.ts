export type QuestionImportSourceFormat = "csv" | "json" | "xlsx";

export interface QuestionImportValidationResult {
  ok: boolean;
  error?: string;
  mismatchedSubjectCodes: string[];
  missingSubjectRows: number[];
}

interface ValidateQuestionImportFileParams {
  file: File;
  sourceFormat: QuestionImportSourceFormat;
  expectedSubjectCode: string;
}

interface ImportedRowSubject {
  rowNumber: number;
  subjectCode: string;
}

const normalizeSubjectCode = (value: string) => value.trim().toUpperCase();

const buildMismatchError = (expectedSubjectCode: string, mismatchedSubjectCodes: string[]) =>
  `All imported rows must use subject_code ${expectedSubjectCode}. Found: ${mismatchedSubjectCodes.join(", ")}.`;

const buildMissingSubjectError = (missingSubjectRows: number[]) =>
  `Each imported row must include subject_code. Missing on rows: ${missingSubjectRows.join(", ")}.`;

const parseCsvRows = (content: string) => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      currentRow.push(currentField);
      if (currentRow.some((field) => field.trim() !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
      continue;
    }

    currentField += character;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((field) => field.trim() !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
};

const extractCsvSubjectCodes = (content: string): ImportedRowSubject[] => {
  const rows = parseCsvRows(content);
  if (rows.length === 0) {
    throw new Error("Import file is empty.");
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const subjectCodeIndex = headers.findIndex((header) => header === "subject_code");
  if (subjectCodeIndex === -1) {
    throw new Error("CSV import file must include a subject_code column.");
  }

  return rows.slice(1).map((row, index) => ({
    rowNumber: index + 1,
    subjectCode: String(row[subjectCodeIndex] ?? "").trim(),
  }));
};

const extractJsonSubjectCodes = (content: string): ImportedRowSubject[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Invalid JSON payload.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("JSON import file must contain an array of question rows.");
  }

  return parsed.map((row, index) => {
    if (!row || typeof row !== "object") {
      throw new Error("JSON import file must contain an array of question rows.");
    }

    const subjectCode = "subject_code" in row ? row.subject_code : "";
    return {
      rowNumber: index + 1,
      subjectCode: String(subjectCode ?? "").trim(),
    };
  });
};

export async function validateQuestionImportFile({
  file,
  sourceFormat,
  expectedSubjectCode,
}: ValidateQuestionImportFileParams): Promise<QuestionImportValidationResult> {
  const normalizedExpectedSubjectCode = normalizeSubjectCode(expectedSubjectCode);

  try {
    if (sourceFormat === "xlsx") {
      return {
        ok: true,
        mismatchedSubjectCodes: [],
        missingSubjectRows: [],
      };
    }

    const content = await file.text();
    if (!content.trim()) {
      return {
        ok: false,
        error: "Import file is empty.",
        mismatchedSubjectCodes: [],
        missingSubjectRows: [],
      };
    }

    const rows =
      sourceFormat === "csv"
        ? extractCsvSubjectCodes(content)
        : extractJsonSubjectCodes(content);

    const missingSubjectRows = rows
      .filter((row) => row.subjectCode === "")
      .map((row) => row.rowNumber);
    if (missingSubjectRows.length > 0) {
      return {
        ok: false,
        error: buildMissingSubjectError(missingSubjectRows),
        mismatchedSubjectCodes: [],
        missingSubjectRows,
      };
    }

    const mismatchedSubjectCodes = Array.from(
      new Set(
        rows
          .map((row) => normalizeSubjectCode(row.subjectCode))
          .filter((subjectCode) => subjectCode !== normalizedExpectedSubjectCode),
      ),
    );

    if (mismatchedSubjectCodes.length > 0) {
      return {
        ok: false,
        error: buildMismatchError(normalizedExpectedSubjectCode, mismatchedSubjectCodes),
        mismatchedSubjectCodes,
        missingSubjectRows: [],
      };
    }

    return {
      ok: true,
      mismatchedSubjectCodes: [],
      missingSubjectRows: [],
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to validate the import file.",
      mismatchedSubjectCodes: [],
      missingSubjectRows: [],
    };
  }
}
