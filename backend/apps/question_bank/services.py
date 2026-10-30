import csv
import json
from io import BytesIO, StringIO

from django.db import transaction
from django.utils.text import slugify
from openpyxl import load_workbook
from rest_framework.exceptions import ValidationError

from apps.academics.models import Subject

from .models import (
    Question,
    QuestionAnswerKey,
    QuestionImportBatch,
    QuestionImportError,
    QuestionOption,
    QuestionRevision,
    QuestionTag,
)


def _normalize_tags(tag_values):
    tags = []
    for value in tag_values or []:
        cleaned = str(value).strip()
        if not cleaned:
            continue
        tag, _ = QuestionTag.objects.get_or_create(
            slug=slugify(cleaned),
            defaults={"name": cleaned},
        )
        if tag.name != cleaned:
            tag.name = cleaned
            tag.save(update_fields=["name"])
        tags.append(tag)
    return tags


def _validate_question_payload(question_type, options, correct_option_keys):
    if question_type in {Question.Type.MULTIPLE_CHOICE, Question.Type.TRUE_FALSE}:
        if not options:
            raise ValidationError("Objective questions require options.")
        if not correct_option_keys:
            raise ValidationError("Objective questions require correct option keys.")
        option_keys = {option["key"] for option in options}
        invalid_keys = [key for key in correct_option_keys if key not in option_keys]
        if invalid_keys:
            raise ValidationError(f"Correct option keys not found in options: {', '.join(invalid_keys)}")


def _create_revision(
    *,
    question,
    revision_number,
    question_text,
    created_by,
    options,
    correct_option_keys,
    essay_rubric,
    sample_answer,
    acceptable_answers,
):
    revision = QuestionRevision.objects.create(
        question=question,
        revision_number=revision_number,
        question_text=question_text,
        created_by=created_by,
    )
    QuestionOption.objects.bulk_create(
        [
            QuestionOption(
                revision=revision,
                key=option["key"],
                text=option["text"],
                sort_order=index,
            )
            for index, option in enumerate(options or [], start=1)
        ]
    )
    QuestionAnswerKey.objects.create(
        revision=revision,
        correct_option_keys=correct_option_keys or [],
        acceptable_answers=acceptable_answers or [],
        essay_rubric=essay_rubric or "",
        sample_answer=sample_answer or "",
    )
    question.current_revision = revision
    question.save(update_fields=["current_revision"])
    return revision


@transaction.atomic
def create_question(
    *,
    subject,
    created_by,
    difficulty,
    question_type,
    question_text,
    tags=None,
    options=None,
    correct_option_keys=None,
    essay_rubric="",
    sample_answer="",
    acceptable_answers=None,
):
    _validate_question_payload(question_type, options or [], correct_option_keys or [])
    question = Question.objects.create(
        subject=subject,
        difficulty=difficulty,
        question_type=question_type,
        created_by=created_by,
        updated_by=created_by,
    )
    question.tags.set(_normalize_tags(tags))
    _create_revision(
        question=question,
        revision_number=1,
        question_text=question_text,
        created_by=created_by,
        options=options or [],
        correct_option_keys=correct_option_keys or [],
        essay_rubric=essay_rubric,
        sample_answer=sample_answer,
        acceptable_answers=acceptable_answers or [],
    )
    return question


@transaction.atomic
def revise_question(
    *,
    question,
    updated_by,
    subject=None,
    difficulty=None,
    question_type=None,
    question_text=None,
    tags=None,
    options=None,
    correct_option_keys=None,
    essay_rubric=None,
    sample_answer=None,
    acceptable_answers=None,
):
    current_revision = question.current_revision
    next_type = question_type or question.question_type
    next_options = options if options is not None else [
        {"key": option.key, "text": option.text}
        for option in current_revision.options.all()
    ]
    answer_key = getattr(current_revision, "answer_key", None)
    next_correct_keys = correct_option_keys if correct_option_keys is not None else getattr(answer_key, "correct_option_keys", [])
    _validate_question_payload(next_type, next_options or [], next_correct_keys or [])

    question.subject = subject or question.subject
    question.difficulty = difficulty or question.difficulty
    question.question_type = next_type
    question.updated_by = updated_by
    question.save(update_fields=["subject", "difficulty", "question_type", "updated_by"])

    if tags is not None:
        question.tags.set(_normalize_tags(tags))

    _create_revision(
        question=question,
        revision_number=current_revision.revision_number + 1 if current_revision else 1,
        question_text=question_text or (current_revision.question_text if current_revision else ""),
        created_by=updated_by,
        options=next_options or [],
        correct_option_keys=next_correct_keys or [],
        essay_rubric=essay_rubric if essay_rubric is not None else getattr(answer_key, "essay_rubric", ""),
        sample_answer=sample_answer if sample_answer is not None else getattr(answer_key, "sample_answer", ""),
        acceptable_answers=acceptable_answers if acceptable_answers is not None else getattr(answer_key, "acceptable_answers", []),
    )
    return question


def _build_question_payload_from_import(row, subjects_cache=None):
    from .quality import build_question_payload_from_row

    return build_question_payload_from_row(row, subjects_cache=subjects_cache)


def _parse_xlsx_rows(content):
    workbook = load_workbook(BytesIO(content), read_only=True, data_only=False)
    worksheet = workbook.active
    values = list(worksheet.iter_rows(values_only=True))
    if not values:
        return []

    headers = [str(value or "").strip() for value in values[0]]
    rows = []
    for row_values in values[1:]:
        row = {
            header: "" if value is None else str(value).strip()
            for header, value in zip(headers, row_values)
            if header
        }
        if any(value for value in row.values()):
            rows.append(row)
    return rows


def read_import_rows(*, source_format, raw_content):
    """Doc file import thanh danh sach dong. File hong -> ValidationError (thay vi loi 500)."""
    try:
        if source_format == QuestionImportBatch.SourceFormat.JSON:
            rows = json.loads(raw_content.decode("utf-8-sig"))
            if isinstance(rows, dict):
                rows = rows.get("questions", rows.get("rows", []))
            if not isinstance(rows, list):
                raise ValueError("JSON phải là danh sách câu hỏi.")
            return rows
        if source_format == QuestionImportBatch.SourceFormat.XLSX:
            return _parse_xlsx_rows(raw_content)
        return list(csv.DictReader(StringIO(raw_content.decode("utf-8-sig"))))
    except (ValueError, UnicodeDecodeError, KeyError) as exc:
        raise ValidationError(f"Không đọc được file {source_format}: {exc}") from exc
    except Exception as exc:  # noqa: BLE001 - openpyxl/zipfile nem nhieu loai loi khac nhau
        raise ValidationError(f"Không đọc được file {source_format}: {exc}") from exc


def preview_import(*, source_format, raw_content):
    """Chay thu: kiem tra toan bo file, khong ghi gi vao CSDL."""
    from .quality import analyze_import_rows, public_report

    rows = read_import_rows(source_format=source_format, raw_content=raw_content)
    return public_report(analyze_import_rows(rows))


@transaction.atomic
def import_questions_from_upload(*, uploaded_by, source_format, uploaded_file, skip_duplicates=False):
    from .quality import analyze_import_rows

    raw_content = uploaded_file.read()
    rows = read_import_rows(source_format=source_format, raw_content=raw_content)
    batch = QuestionImportBatch.objects.create(
        imported_by=uploaded_by,
        source_format=source_format,
        file_name=uploaded_file.name,
        status=QuestionImportBatch.Status.PENDING,
        total_records=len(rows),
    )
    created_question_ids = []
    report = analyze_import_rows(rows)

    for index, row, payload, issues in report["_parsed"]:
        errors = [issue for issue in issues if issue["level"] == "error"]
        duplicates = [issue for issue in issues if issue["code"] in {"duplicate_in_file", "duplicate_in_bank"}]
        if not errors and skip_duplicates and duplicates:
            errors = [{**duplicates[0], "message": "Bỏ qua: " + duplicates[0]["message"]}]
        if errors:
            QuestionImportError.objects.create(
                batch=batch,
                row_number=index,
                field_name=errors[0]["field"],
                message="; ".join(issue["message"] for issue in errors),
                raw_payload=row if isinstance(row, dict) else {"value": row},
            )
            batch.error_count += 1
            continue
        try:
            question = create_question(
                subject=payload["subject"],
                created_by=uploaded_by,
                difficulty=payload["difficulty"],
                question_type=payload["question_type"],
                question_text=payload["question_text"],
                tags=payload["tags"],
                options=payload["options"],
                correct_option_keys=payload["correct_option_keys"],
                essay_rubric=payload["essay_rubric"],
                sample_answer=payload["sample_answer"],
                acceptable_answers=payload["acceptable_answers"],
            )
            batch.success_count += 1
            created_question_ids.append(question.id)
        except Exception as exc:  # noqa: BLE001
            QuestionImportError.objects.create(
                batch=batch,
                row_number=index,
                message=str(exc),
                raw_payload=row if isinstance(row, dict) else {"value": row},
            )
            batch.error_count += 1

    batch.status = QuestionImportBatch.Status.COMPLETED
    batch.created_question_ids = created_question_ids
    batch.save(update_fields=["success_count", "error_count", "status", "created_question_ids"])
    return batch
