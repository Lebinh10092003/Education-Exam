from io import BytesIO

from openpyxl import Workbook


def build_violation_cases_workbook(cases):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Violation History"
    sheet.append(
        [
            "Case ID",
            "Exam",
            "Subject",
            "Candidate",
            "Candidate Email",
            "Session ID",
            "Severity",
            "Status",
            "Title",
            "Summary",
            "Event Count",
            "Evidence Count",
            "Resolved At",
            "Resolution Notes",
        ]
    )

    for case in cases:
        sheet.append(
            [
                case.id,
                case.session.exam.name,
                case.session.exam.subject.name,
                case.session.candidate.full_name,
                case.session.candidate.email,
                case.session_id,
                case.severity,
                case.status,
                case.title,
                case.summary,
                case.events.count(),
                case.evidences.count(),
                case.resolved_at.isoformat() if case.resolved_at else "",
                case.resolution_notes,
            ]
        )

    return workbook


def serialize_workbook(workbook):
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()
