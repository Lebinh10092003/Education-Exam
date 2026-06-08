import csv
import json
from io import StringIO

from django.db import transaction
from django.utils.text import slugify

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
            raise ValueError("Objective questions require options.")
        if not correct_option_keys:
            raise ValueError("Objective questions require correct option keys.")
        option_keys = {option["key"] for option in options}
        invalid_keys = [key for key in correct_option_keys if key not in option_keys]
        if invalid_keys:
            raise ValueError(f"Correct option keys not found in options: {', '.join(invalid_keys)}")


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
    subject_code = str(row.get("subject_code", "")).strip()
    if not subject_code:
        raise ValueError("subject_code is required.")

    try:
        if subjects_cache is not None and subject_code in subjects_cache:
            subject = subjects_cache[subject_code]
        else:
            subject = Subject.objects.get(code=subject_code)
            if subjects_cache is not None:
                subjects_cache[subject_code] = subject
    except Subject.DoesNotExist as exc:
        raise ValueError(f"Unknown subject code: {subject_code}") from exc

    tags = row.get("tags", [])
    if isinstance(tags, str):
        tags = [item.strip() for item in tags.split("|") if item.strip()]

    options = row.get("options")
    if options is None:
        options = []
        for key, value in row.items():
            if key.startswith("option_") and value:
                option_key = key.replace("option_", "").upper()
                options.append({"key": option_key, "text": str(value).strip()})

    correct_option_keys = row.get("correct_option_keys", [])
    if isinstance(correct_option_keys, str):
        correct_option_keys = [item.strip() for item in correct_option_keys.split("|") if item.strip()]

    acceptable_answers = row.get("acceptable_answers", [])
    if isinstance(acceptable_answers, str):
        acceptable_answers = [item.strip() for item in acceptable_answers.split("|") if item.strip()]

    return {
        "subject": subject,
        "difficulty": row.get("difficulty"),
        "question_type": row.get("question_type"),
        "question_text": row.get("question_text"),
        "tags": tags,
        "options": options,
        "correct_option_keys": correct_option_keys,
        "essay_rubric": row.get("essay_rubric", ""),
        "sample_answer": row.get("sample_answer", ""),
        "acceptable_answers": acceptable_answers,
    }


@transaction.atomic
def import_questions_from_upload(*, uploaded_by, source_format, uploaded_file):
    batch = QuestionImportBatch.objects.create(
        imported_by=uploaded_by,
        source_format=source_format,
        file_name=uploaded_file.name,
        status=QuestionImportBatch.Status.PENDING,
    )
    created_question_ids = []
    subjects_cache = {}

    content = uploaded_file.read().decode("utf-8")
    if source_format == QuestionImportBatch.SourceFormat.JSON:
        rows = json.loads(content)
    else:
        rows = list(csv.DictReader(StringIO(content)))

    batch.total_records = len(rows)
    batch.save(update_fields=["total_records"])

    for index, row in enumerate(rows, start=1):
        try:
            payload = _build_question_payload_from_import(row, subjects_cache=subjects_cache)
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
