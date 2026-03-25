from io import BytesIO

from openpyxl import Workbook

from apps.platform_core.i18n import t

from .presentation import (
    localize_discipline_case_status,
    localize_discipline_case_summary,
    localize_discipline_case_title,
    localize_discipline_certificate_level,
    localize_discipline_proposal_status,
    localize_discipline_severity,
)


def build_disciplinary_summary_workbook(records):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = t(vi="Tổng hợp kỷ luật", en="Disciplinary Summary")
    sheet.append(
        [
            t(vi="Kỳ thi", en="Exam"),
            t(vi="Môn học", en="Subject"),
            t(vi="Thí sinh", en="Candidate"),
            t(vi="Email thí sinh", en="Candidate Email"),
            t(vi="Phiên được chọn", en="Selected Session"),
            t(vi="Số case", en="Case Count"),
            t(vi="Số case đã duyệt", en="Approved Case Count"),
            t(vi="Điểm gốc", en="Original Score"),
            t(vi="Tỷ lệ gốc", en="Original Percentage"),
            t(vi="Mức phạt đã áp dụng", en="Applied Penalty Percent"),
            t(vi="Điểm sau phạt", en="Final Score"),
            t(vi="Tỷ lệ sau phạt", en="Final Percentage"),
            t(vi="Chứng chỉ", en="Certificate"),
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
                localize_discipline_certificate_level(record.certificate_level_snapshot),
            ]
        )
    return workbook


def build_disciplinary_case_workbook(cases):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = t(vi="Danh sách case kỷ luật", en="Disciplinary Cases")
    sheet.append(
        [
            t(vi="Mã case", en="Case ID"),
            t(vi="Kỳ thi", en="Exam"),
            t(vi="Môn học", en="Subject"),
            t(vi="Thí sinh", en="Candidate"),
            t(vi="Email thí sinh", en="Candidate Email"),
            t(vi="Mã phiên", en="Session ID"),
            t(vi="Mức độ", en="Severity"),
            t(vi="Trạng thái", en="Status"),
            t(vi="Tiêu đề", en="Title"),
            t(vi="Tóm tắt", en="Summary"),
            t(vi="Số bằng chứng", en="Evidence Count"),
            t(vi="Mức phạt đề xuất", en="Proposed Penalty Percent"),
            t(vi="Trạng thái đề xuất", en="Proposal Status"),
            t(vi="Người duyệt", en="Approved By"),
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
                localize_discipline_severity(case.severity),
                localize_discipline_case_status(case.status),
                localize_discipline_case_title(case.title),
                localize_discipline_case_summary(case.summary),
                case.evidences.count(),
                str(getattr(proposal, "proposed_penalty_percent", "")),
                localize_discipline_proposal_status(getattr(proposal, "status", "")),
                getattr(getattr(proposal, "approved_by", None), "email", ""),
            ]
        )
    return workbook


def serialize_workbook(workbook):
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()

