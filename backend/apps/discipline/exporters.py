from io import BytesIO

from openpyxl import Workbook


def build_disciplinary_summary_workbook(records):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Disciplinary Summary"
    sheet.append(
        [
            "Exam",
            "Subject",
            "Candidate",
            "Candidate Email",
            "Selected Session",
            "Case Count",
            "Approved Case Count",
            "Original Score",
            "Original Percentage",
            "Applied Penalty Percent",
            "Final Score",
            "Final Percentage",
            "Certificate",
        ]
    )

    for record in records:
        sheet.append(
            [
                record.exam.name,
                record.exam.subject.name,
                record.candidate.full_name,
                record.candidate.email,
                record.selected_session_id or "",
                record.unique_case_count,
                record.approved_case_count,
                str(record.original_total_score),
                str(record.original_percentage),
                str(record.highest_approved_penalty_percent),
                str(record.final_total_score),
                str(record.final_percentage),
                record.certificate_level_snapshot,
            ]
        )
    return workbook


def build_disciplinary_case_workbook(cases):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Disciplinary Cases"
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
            "Evidence Count",
            "Proposed Penalty Percent",
            "Proposal Status",
            "Approved By",
        ]
    )

    for case in cases:
        proposal = getattr(case, "penalty_proposal", None)
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
                case.evidences.count(),
                str(getattr(proposal, "proposed_penalty_percent", "")),
                getattr(proposal, "status", ""),
                getattr(getattr(proposal, "approved_by", None), "email", ""),
            ]
        )
    return workbook


def serialize_workbook(workbook):
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()

