import math
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.grading.models import Result
from apps.platform_core.audit import record_audit_event
from apps.platform_core.i18n import t
from apps.proctoring.models import ViolationCase

from .models import (
    ExamCertificateAward,
    ExamCertificatePolicy,
    ExamDisciplinaryActionLog,
    ExamDisciplinaryRecord,
    ViolationPenaltyProposal,
)


ZERO = Decimal("0.00")
HUNDRED = Decimal("100.00")


def _as_decimal(value):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError(t(vi="Gia tri so thap phan khong hop le.", en="Invalid decimal value.")) from exc


def _quantize_score(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _calculate_percentage(*, total_score: Decimal, max_score: Decimal) -> Decimal:
    if not max_score:
        return ZERO
    return _quantize_score((total_score / max_score) * HUNDRED)


def _calculate_passed(*, session, percentage: Decimal):
    return percentage >= Decimal(str(session.exam.passing_score))


def _get_config_value(config: dict, key: str, default: Decimal | str = ZERO) -> Decimal:
    raw_value = config.get(key, default) if isinstance(config, dict) else default
    return _as_decimal(raw_value or default)


def _validate_penalty_percent(penalty_percent: Decimal):
    if penalty_percent < ZERO or penalty_percent > HUNDRED:
        raise ValidationError(
            t(
                vi="Muc phat phai nam trong khoang tu 0 den 100.",
                en="Penalty percent must be between 0 and 100.",
            )
        )


def _select_best_result_rows(*, exam):
    queryset = (
        Result.objects.select_related("session", "session__candidate", "session__exam")
        .filter(session__exam=exam)
        .exclude(workflow_status=Result.WorkflowStatus.PENDING_GRADING)
        .order_by(
            "session__candidate_id",
            "-original_total_score",
            "-final_total_score",
            "-session__submitted_at",
            "-session_id",
        )
    )
    selected_results = []
    seen_candidate_ids = set()
    for result in queryset:
        candidate_id = result.session.candidate_id
        if candidate_id in seen_candidate_ids:
            continue
        seen_candidate_ids.add(candidate_id)
        selected_results.append(result)
    return selected_results


def get_selected_session_for_exam_candidate(*, exam, candidate):
    result = (
        Result.objects.select_related("session", "session__candidate", "session__exam")
        .filter(session__exam=exam, session__candidate=candidate)
        .exclude(workflow_status=Result.WorkflowStatus.PENDING_GRADING)
        .order_by(
            "-original_total_score",
            "-final_total_score",
            "-session__submitted_at",
            "-session_id",
        )
        .first()
    )
    if result is not None:
        return result.session
    return exam.sessions.filter(candidate=candidate).order_by("-submitted_at", "-started_at", "-id").first()


def get_highest_approved_penalty_percent(*, session) -> Decimal:
    value = (
        ViolationPenaltyProposal.objects.filter(
            violation_case__session=session,
            status=ViolationPenaltyProposal.Status.APPROVED,
        ).aggregate(max_value=Max("proposed_penalty_percent"))["max_value"]
        or ZERO
    )
    return _quantize_score(_as_decimal(value))


def record_disciplinary_action(
    *,
    action,
    exam,
    candidate=None,
    selected_session=None,
    violation_case=None,
    proposal=None,
    actor=None,
    metadata=None,
    request=None,
):
    payload = dict(metadata or {})
    log = ExamDisciplinaryActionLog.objects.create(
        exam=exam,
        candidate=candidate,
        selected_session=selected_session,
        violation_case=violation_case,
        proposal=proposal,
        actor=actor,
        action=action,
        metadata=payload,
    )
    if actor is not None:
        record_audit_event(
            actor=actor,
            action=f"discipline.{action}",
            category="discipline",
            description=f'Discipline action "{action}" for exam "{exam.name}".',
            metadata={
                "exam_id": exam.id,
                "candidate_id": getattr(candidate, "id", None),
                "session_id": getattr(selected_session, "id", None),
                "case_id": getattr(violation_case, "id", None),
                "proposal_id": getattr(proposal, "id", None),
                **payload,
            },
            request=request,
        )
    return log


def create_or_update_penalty_proposal(*, violation_case, actor, proposed_penalty_percent, notes="", request=None):
    penalty_percent = _quantize_score(_as_decimal(proposed_penalty_percent))
    _validate_penalty_percent(penalty_percent)
    proposal, created = ViolationPenaltyProposal.objects.get_or_create(
        violation_case=violation_case,
        defaults={
            "proposed_penalty_percent": penalty_percent,
            "status": ViolationPenaltyProposal.Status.DRAFT,
            "notes": notes,
            "proposed_by": actor,
            "proposed_at": timezone.now(),
        },
    )
    if not created:
        proposal.proposed_penalty_percent = penalty_percent
        proposal.notes = notes
        proposal.status = ViolationPenaltyProposal.Status.DRAFT
        proposal.proposed_by = actor
        proposal.proposed_at = timezone.now()
        proposal.save(
            update_fields=[
                "proposed_penalty_percent",
                "notes",
                "status",
                "proposed_by",
                "proposed_at",
                "updated_at",
            ]
        )

    record_disciplinary_action(
        action="proposal_saved",
        exam=violation_case.session.exam,
        candidate=violation_case.session.candidate,
        selected_session=violation_case.session,
        violation_case=violation_case,
        proposal=proposal,
        actor=actor,
        metadata={"penalty_percent": str(penalty_percent)},
        request=request,
    )
    return proposal


def _apply_penalty_to_result(*, result, penalty_percent: Decimal):
    penalty_percent = _quantize_score(penalty_percent)
    original_total_score = _quantize_score(_as_decimal(result.original_total_score))
    original_percentage = _quantize_score(_as_decimal(result.original_percentage))
    final_total_score = _quantize_score(original_total_score * (HUNDRED - penalty_percent) / HUNDRED)
    final_percentage = _calculate_percentage(total_score=final_total_score, max_score=_as_decimal(result.max_score))
    passed = result.passed
    if result.workflow_status != Result.WorkflowStatus.PENDING_GRADING:
        passed = _calculate_passed(session=result.session, percentage=final_percentage)

    result.penalty_percent_applied = penalty_percent
    result.final_total_score = final_total_score
    result.final_percentage = final_percentage
    result.total_score = final_total_score
    result.percentage = final_percentage
    result.passed = passed
    result.save(
        update_fields=[
            "penalty_percent_applied",
            "final_total_score",
            "final_percentage",
            "total_score",
            "percentage",
            "passed",
            "updated_at",
        ]
    )
    return {
        "original_total_score": original_total_score,
        "original_percentage": original_percentage,
        "final_total_score": final_total_score,
        "final_percentage": final_percentage,
    }


@transaction.atomic
def recompute_disciplinary_record(*, exam, candidate, actor=None, request=None):
    selected_session = get_selected_session_for_exam_candidate(exam=exam, candidate=candidate)
    record, _ = ExamDisciplinaryRecord.objects.get_or_create(exam=exam, candidate=candidate)

    if selected_session is None:
        record.selected_session = None
        record.unique_case_count = 0
        record.open_case_count = 0
        record.approved_case_count = 0
        record.highest_approved_penalty_percent = ZERO
        record.original_total_score = ZERO
        record.original_percentage = ZERO
        record.final_total_score = ZERO
        record.final_percentage = ZERO
        record.result_publish_state_snapshot = ""
        record.published_score_synced_at = None
        record.certificate_level_snapshot = ""
        record.save()
        return record

    cases_qs = ViolationCase.objects.filter(session=selected_session)
    highest_penalty = get_highest_approved_penalty_percent(session=selected_session)
    approved_case_count = ViolationPenaltyProposal.objects.filter(
        violation_case__session=selected_session,
        status=ViolationPenaltyProposal.Status.APPROVED,
    ).count()

    selected_result = getattr(selected_session, "result", None)
    if selected_result is None:
        original_total_score = ZERO
        original_percentage = ZERO
        final_total_score = ZERO
        final_percentage = ZERO
        publish_state = ""
        synced_at = None
    else:
        payload = _apply_penalty_to_result(result=selected_result, penalty_percent=highest_penalty)
        original_total_score = payload["original_total_score"]
        original_percentage = payload["original_percentage"]
        final_total_score = payload["final_total_score"]
        final_percentage = payload["final_percentage"]
        publish_state = selected_result.publish_state
        synced_at = timezone.now()

    record.selected_session = selected_session
    record.unique_case_count = cases_qs.count()
    record.open_case_count = cases_qs.filter(status=ViolationCase.Status.OPEN).count()
    record.approved_case_count = approved_case_count
    record.highest_approved_penalty_percent = highest_penalty
    record.original_total_score = original_total_score
    record.original_percentage = original_percentage
    record.final_total_score = final_total_score
    record.final_percentage = final_percentage
    record.result_publish_state_snapshot = publish_state
    record.published_score_synced_at = synced_at
    record.save()

    record_disciplinary_action(
        action="record_recomputed",
        exam=exam,
        candidate=candidate,
        selected_session=selected_session,
        actor=actor,
        metadata={
            "highest_penalty_percent": str(highest_penalty),
            "approved_case_count": approved_case_count,
        },
        request=request,
    )
    return record


def _build_policy_snapshot(policy):
    return {
        "mode": policy.mode,
        "gold_config": policy.gold_config,
        "silver_config": policy.silver_config,
        "bronze_config": policy.bronze_config,
        "encouragement_config": policy.encouragement_config,
    }


def _validate_policy(policy):
    ratio_total = ZERO
    if policy.mode in {
        ExamCertificatePolicy.Mode.RANK_RATIO,
        ExamCertificatePolicy.Mode.RANK_RATIO_WITH_MINIMUM,
    }:
        for config in (
            policy.gold_config,
            policy.silver_config,
            policy.bronze_config,
            policy.encouragement_config,
        ):
            ratio_total += _get_config_value(config, "ratio")
        if ratio_total > HUNDRED:
            raise ValidationError(
                t(
                    vi="Tong ti le xet giai khong duoc vuot qua 100%.",
                    en="Certificate ratio total cannot exceed 100%.",
                )
            )


def _award_level_for_threshold(percentage: Decimal, policy) -> str:
    ordered_levels = (
        (ExamCertificateAward.Level.GOLD, policy.gold_config),
        (ExamCertificateAward.Level.SILVER, policy.silver_config),
        (ExamCertificateAward.Level.BRONZE, policy.bronze_config),
        (ExamCertificateAward.Level.ENCOURAGEMENT, policy.encouragement_config),
    )
    for level, config in ordered_levels:
        if percentage >= _get_config_value(config, "threshold"):
            return level
    return ExamCertificateAward.Level.ENCOURAGEMENT


def _award_levels_for_ranked_entries(entries, policy):
    passed_entries = [entry for entry in entries if entry["result"].passed]
    total_passed = len(passed_entries)
    if total_passed == 0:
        return {}

    cumulative = ZERO
    cumulative_counts: list[tuple[str, int, dict]] = []
    for level, config in (
        (ExamCertificateAward.Level.GOLD, policy.gold_config),
        (ExamCertificateAward.Level.SILVER, policy.silver_config),
        (ExamCertificateAward.Level.BRONZE, policy.bronze_config),
        (ExamCertificateAward.Level.ENCOURAGEMENT, policy.encouragement_config),
    ):
        cumulative += _get_config_value(config, "ratio")
        cumulative_counts.append((level, min(total_passed, math.ceil(total_passed * float(cumulative) / 100.0)), config))

    awards = {}
    for index, entry in enumerate(passed_entries):
        target_level = ExamCertificateAward.Level.ENCOURAGEMENT
        for level, cutoff, config in cumulative_counts:
            if index < cutoff:
                target_level = level
                if policy.mode == ExamCertificatePolicy.Mode.RANK_RATIO_WITH_MINIMUM:
                    minimum = _get_config_value(config, "minimum_percentage")
                    if entry["percentage"] < minimum:
                        continue
                break
        awards[entry["candidate_id"]] = target_level
    return awards


def assign_award_levels(*, exam, policy):
    _validate_policy(policy)
    selected_results = _select_best_result_rows(exam=exam)
    entries = [
        {
            "candidate_id": result.session.candidate_id,
            "session": result.session,
            "result": result,
            "score": _as_decimal(result.final_total_score),
            "percentage": _as_decimal(result.final_percentage),
        }
        for result in selected_results
    ]
    entries.sort(
        key=lambda item: (
            item["percentage"],
            item["score"],
            item["session"].submitted_at or item["session"].started_at,
            item["session"].id,
        ),
        reverse=True,
    )

    ranked_awards = {}
    if policy.mode == ExamCertificatePolicy.Mode.SCORE_THRESHOLD:
        for entry in entries:
            if entry["result"].passed is False:
                ranked_awards[entry["candidate_id"]] = ExamCertificateAward.Level.PARTICIPATION
            elif entry["result"].passed is True:
                ranked_awards[entry["candidate_id"]] = _award_level_for_threshold(entry["percentage"], policy)
    else:
        ranked_awards = _award_levels_for_ranked_entries(entries, policy)
        for entry in entries:
            if entry["result"].passed is False:
                ranked_awards[entry["candidate_id"]] = ExamCertificateAward.Level.PARTICIPATION
            else:
                ranked_awards.setdefault(entry["candidate_id"], ExamCertificateAward.Level.ENCOURAGEMENT)
    return entries, ranked_awards


@transaction.atomic
def recompute_exam_certificates(*, exam, triggered_by=None, request=None):
    policy = getattr(exam, "certificate_policy", None)
    if policy is None:
        return []

    entries, award_map = assign_award_levels(exam=exam, policy=policy)
    snapshot = _build_policy_snapshot(policy)
    recomputed_at = timezone.now()
    awards = []
    candidate_ids = []
    for entry in entries:
        award_level = award_map.get(entry["candidate_id"])
        if award_level is None:
            continue
        candidate_ids.append(entry["candidate_id"])
        award, _ = ExamCertificateAward.objects.update_or_create(
            exam=exam,
            candidate_id=entry["candidate_id"],
            defaults={
                "selected_session": entry["session"],
                "award_level": award_level,
                "basis_total_score": entry["score"],
                "basis_percentage": entry["percentage"],
                "policy_snapshot": snapshot,
                "awarded_at": recomputed_at,
                "recomputed_at": recomputed_at,
            },
        )
        awards.append(award)
        ExamDisciplinaryRecord.objects.filter(
            exam=exam,
            candidate_id=entry["candidate_id"],
        ).update(certificate_level_snapshot=award_level)

    if candidate_ids:
        ExamCertificateAward.objects.filter(exam=exam).exclude(candidate_id__in=candidate_ids).delete()
    else:
        ExamCertificateAward.objects.filter(exam=exam).delete()

    record_disciplinary_action(
        action="certificate_recomputed",
        exam=exam,
        actor=triggered_by,
        metadata={"award_count": len(awards), "mode": policy.mode},
        request=request,
    )
    return awards


@transaction.atomic
def approve_penalty_proposal(*, proposal, approved_by, request=None):
    selected_session = get_selected_session_for_exam_candidate(
        exam=proposal.violation_case.session.exam,
        candidate=proposal.violation_case.session.candidate,
    )
    if selected_session is None or getattr(selected_session, "result", None) is None:
        raise ValidationError(
            t(
                vi="Khong the duyet muc phat khi chua co ket qua bai thi.",
                en="Cannot approve a penalty before the exam result exists.",
            )
        )

    proposal.status = ViolationPenaltyProposal.Status.APPROVED
    proposal.approved_by = approved_by
    proposal.approved_at = timezone.now()
    proposal.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

    record = recompute_disciplinary_record(
        exam=proposal.violation_case.session.exam,
        candidate=proposal.violation_case.session.candidate,
        actor=approved_by,
        request=request,
    )
    recompute_exam_certificates(
        exam=proposal.violation_case.session.exam,
        triggered_by=approved_by,
        request=request,
    )
    record_disciplinary_action(
        action="proposal_approved",
        exam=proposal.violation_case.session.exam,
        candidate=proposal.violation_case.session.candidate,
        selected_session=record.selected_session,
        violation_case=proposal.violation_case,
        proposal=proposal,
        actor=approved_by,
        metadata={"penalty_percent": str(proposal.proposed_penalty_percent)},
        request=request,
    )
    return proposal


@transaction.atomic
def reject_penalty_proposal(*, proposal, rejected_by, request=None):
    proposal.status = ViolationPenaltyProposal.Status.REJECTED
    proposal.save(update_fields=["status", "updated_at"])
    record = recompute_disciplinary_record(
        exam=proposal.violation_case.session.exam,
        candidate=proposal.violation_case.session.candidate,
        actor=rejected_by,
        request=request,
    )
    recompute_exam_certificates(
        exam=proposal.violation_case.session.exam,
        triggered_by=rejected_by,
        request=request,
    )
    record_disciplinary_action(
        action="proposal_rejected",
        exam=proposal.violation_case.session.exam,
        candidate=proposal.violation_case.session.candidate,
        selected_session=record.selected_session,
        violation_case=proposal.violation_case,
        proposal=proposal,
        actor=rejected_by,
        request=request,
    )
    return proposal


@transaction.atomic
def mark_case_no_penalty(*, proposal, actor, request=None):
    proposal.status = ViolationPenaltyProposal.Status.NO_PENALTY
    proposal.proposed_penalty_percent = ZERO
    proposal.approved_by = actor
    proposal.approved_at = timezone.now()
    proposal.save(
        update_fields=[
            "status",
            "proposed_penalty_percent",
            "approved_by",
            "approved_at",
            "updated_at",
        ]
    )
    record = recompute_disciplinary_record(
        exam=proposal.violation_case.session.exam,
        candidate=proposal.violation_case.session.candidate,
        actor=actor,
        request=request,
    )
    recompute_exam_certificates(
        exam=proposal.violation_case.session.exam,
        triggered_by=actor,
        request=request,
    )
    record_disciplinary_action(
        action="proposal_no_penalty",
        exam=proposal.violation_case.session.exam,
        candidate=proposal.violation_case.session.candidate,
        selected_session=record.selected_session,
        violation_case=proposal.violation_case,
        proposal=proposal,
        actor=actor,
        request=request,
    )
    return proposal


def sync_discipline_after_result_change(*, session, actor=None, request=None):
    has_relevant_cases = ViolationCase.objects.filter(
        session__exam=session.exam,
        session__candidate=session.candidate,
    ).exists() or ExamDisciplinaryRecord.objects.filter(exam=session.exam, candidate=session.candidate).exists()
    if has_relevant_cases:
        recompute_disciplinary_record(exam=session.exam, candidate=session.candidate, actor=actor, request=request)

    if ExamCertificatePolicy.objects.filter(exam=session.exam).exists():
        recompute_exam_certificates(exam=session.exam, triggered_by=actor, request=request)
