export interface ImportTemplateFormatDefinition {
  key: string;
  label: string;
  fileName: string;
  mimeType: string;
  requiredFields: string[];
  mappingNotes: string[];
  sample: string;
  downloadContent: string;
}

export interface ImportTemplateDefinition {
  title: string;
  description: string;
  footerNote?: string;
  formats: ImportTemplateFormatDefinition[];
}

const questionCsvTemplate = [
  "subject_code,difficulty,question_type,question_text,tags,option_A,option_B,option_C,option_D,correct_option_keys,acceptable_answers,essay_rubric,sample_answer",
  'SMOKE101,easy,multiple_choice,"2 + 2 = ?","math|arithmetic",3,4,5,6,B,,,',
  'SMOKE101,medium,essay,"Explain why practice exams are useful.","essay|reflection",,,,,,"practice|timing","Score clarity, structure, and examples.","Practice exams reveal gaps and improve timing before the real test."',
].join("\n");

const questionJsonTemplate = JSON.stringify(
  [
    {
      subject_code: "SMOKE101",
      difficulty: "easy",
      question_type: "multiple_choice",
      question_text: "2 + 2 = ?",
      tags: ["math", "arithmetic"],
      options: [
        { key: "A", text: "3" },
        { key: "B", text: "4" },
        { key: "C", text: "5" },
      ],
      correct_option_keys: ["B"],
      acceptable_answers: [],
      essay_rubric: "",
      sample_answer: "",
    },
    {
      subject_code: "SMOKE101",
      difficulty: "medium",
      question_type: "essay",
      question_text: "Explain why practice exams are useful.",
      tags: ["essay", "reflection"],
      options: [],
      correct_option_keys: [],
      acceptable_answers: ["practice", "timing"],
      essay_rubric: "Score clarity, structure, and examples.",
      sample_answer: "Practice exams reveal gaps and improve timing before the real test.",
    },
  ],
  null,
  2,
);

const userCsvTemplate = [
  "full_name,email,password,phone_number,status,is_active,is_staff,school_code,school,role_slugs",
  'Candidate Demo,candidate@example.com,candidate123,+84900000001,active,true,false,,Tiểu học Nguyễn Tri Phương,candidate',
  'Exam Proctor,proctor@example.com,proctor123,+84900000002,pending,true,true,,TH Nguyễn Tri Phương,proctor|examiner',
].join("\n");

const examStudentCsvTemplate = [
  "full_name,date_of_birth,student_class,cccd,email,phone_number,school_code,school",
  "Le Van Binh,24/08/2003,12,012345678901,,0901234567,,Tiểu học Nguyễn Tri Phương",
  "Tran Thi Hoa,15/01/2004,12A1,012345678902,hoa@student.local,0901234568,,TH Nguyễn Tri Phương",
].join("\n");

const groupMembershipCsvTemplate = [
  "full_name,username,password,date_of_birth,school_code,school,ward,national_exam_subject,exam_block,candidate_number,email,phone_number,cccd",
  "Le Van Binh,imo001,imo-pass-001,24/08/2003,,Tiểu học Nguyễn Tri Phương,Phuong 1,Toan,A00,IMO001,binh@example.com,0901234567,012345678901",
  "Tran Thi Hoa,imo002,imo-pass-002,15/01/2004,,TH Nguyễn Tri Phương,Phuong 2,Toan,A01,IMO002,hoa@example.com,0901234568,012345678902",
].join("\n");

export const questionImportTemplate: ImportTemplateDefinition = {
  title: "Question Import Template",
  description: "Use backend-compatible CSV, JSON, or XLSX rows so the question import endpoint can create revisioned questions directly.",
  footerNote: "List-style fields such as tags, correct_option_keys, and acceptable_answers use the pipe character `|` in CSV/XLSX files. XLSX imports use the first worksheet and the same column names as CSV.",
  formats: [
    {
      key: "csv",
      label: "CSV",
      fileName: "question-import-template.csv",
      mimeType: "text/csv;charset=utf-8",
      requiredFields: ["subject_code", "difficulty", "question_type", "question_text"],
      mappingNotes: [
        "Objective questions can provide either option_A, option_B, option_C, option_D columns or additional option_* columns.",
        "correct_option_keys must reference option keys such as A|B or TRUE.",
        "Essay rows can leave option_* columns empty and use acceptable_answers, essay_rubric, and sample_answer.",
      ],
      sample: questionCsvTemplate,
      downloadContent: questionCsvTemplate,
    },
    {
      key: "json",
      label: "JSON",
      fileName: "question-import-template.json",
      mimeType: "application/json;charset=utf-8",
      requiredFields: ["subject_code", "difficulty", "question_type", "question_text"],
      mappingNotes: [
        "JSON rows may send an options array with key/text pairs instead of option_* columns.",
        "tags, correct_option_keys, and acceptable_answers should be arrays in JSON files.",
        "Keep question_type aligned with backend values: multiple_choice, essay, or true_false.",
      ],
      sample: questionJsonTemplate,
      downloadContent: `${questionJsonTemplate}\n`,
    },
  ],
};

export const userImportTemplate: ImportTemplateDefinition = {
  title: "User Import Template",
  description: "Prepare CSV files for the backend user import pipeline.",
  footerNote: "The backend resolves school_code when it exists, or creates/reuses a school from the school name when the code is blank.",
  formats: [
    {
      key: "csv",
      label: "CSV",
      fileName: "user-import-template.csv",
      mimeType: "text/csv;charset=utf-8",
      requiredFields: ["full_name", "email", "password", "status", "is_active", "is_staff"],
      mappingNotes: [
        "school_code may reference an existing code; school may contain a school name and the backend will create or reuse it automatically.",
        "role_slugs accepts one or more role slugs separated by `|`, for example candidate|student.",
        "status should use active, pending, or locked, while boolean columns should use true or false.",
      ],
      sample: userCsvTemplate,
      downloadContent: userCsvTemplate,
    },
  ],
};

export const examStudentImportTemplate: ImportTemplateDefinition = {
  title: "Exam Student Import Template",
  description: "Import students directly into a specific exam. The backend will create or update student accounts by CCCD and assign them straight to the exam.",
  footerNote:
    "If email is left blank, the backend will generate one from the student username. New student passwords default to the generated username.",
  formats: [
    {
      key: "csv",
      label: "CSV",
      fileName: "exam-student-import-template.csv",
      mimeType: "text/csv;charset=utf-8",
      requiredFields: ["full_name", "date_of_birth", "student_class", "cccd"],
      mappingNotes: [
        "date_of_birth must use DD/MM/YYYY, for example 24/08/2003.",
        "Generated usernames follow the pattern name.ddmmyyyy.class and remove Vietnamese accents automatically.",
        "If CCCD already belongs to an existing student, the backend updates that profile and reuses the same account.",
        "school_code may reference an existing code; school may contain a school name and the backend will create or reuse it automatically.",
      ],
      sample: examStudentCsvTemplate,
      downloadContent: examStudentCsvTemplate,
    },
  ],
};

export const groupMembershipImportTemplate: ImportTemplateDefinition = {
  title: "Group Members Import Template",
  description: "Import candidates or students into a specific group with roster details and admin-visible login credentials.",
  footerNote:
    "Use DD/MM/YYYY for date_of_birth. school_code may match an existing school, or school may name a school to create/reuse. password is stored for admin roster display for newly created or reset candidate accounts.",
  formats: [
    {
      key: "csv",
      label: "CSV",
      fileName: "group-members-import-template.csv",
      mimeType: "text/csv;charset=utf-8",
      requiredFields: ["full_name"],
      mappingNotes: [
        "username becomes the candidate login account. If username is blank, the backend generates one.",
        "password becomes both the login password and the admin-visible roster password. If blank for a new account, the backend uses the generated username.",
        "date_of_birth must use DD/MM/YYYY, for example 24/08/2003.",
        "school_code may reference an existing code; school may contain a school name and the backend will create or reuse it automatically.",
        "national_exam_subject stores one or more registered subjects; separate multiple subjects with semicolons. candidate_number maps to SBD. exam_block maps to Khối thi.",
      ],
      sample: groupMembershipCsvTemplate,
      downloadContent: groupMembershipCsvTemplate,
    },
  ],
};

