from decimal import Decimal

from django.db.models import Avg
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied

from apps.grading.models import Result
from apps.exam_authoring.lifecycle import resolve_exam_phase
from apps.exam_authoring.models import Exam
from apps.materials.models import Material
from apps.platform_core.i18n import t

from ..access import get_accessible_subject_queryset, get_candidate_exam_queryset
from ..models import ExamSession, SessionQuestion
from ..services import (
    UNSET,
    build_autosave_receipt,
    save_session_answer,
    start_or_resume_session,
    submit_session,
    user_can_access_session,
)
from .serializers import (
    AutosaveSnapshotSerializer,
    AutosaveSnapshotWriteSerializer,
    CandidateAssignedExamSerializer,
    CandidateDashboardOverviewSerializer,
    CandidateExamSessionSerializer,
    SessionAnswerResponseSerializer,
    SessionAnswerWriteSerializer,
    SessionSubmissionSummarySerializer,
)


def _candidate_session_queryset():
    return ExamSession.objects.select_related(
        "exam",
        "exam__schedule_window",
        "exam__subject",
    ).prefetch_related(
        "questions__question_revision__question",
        "questions__question_revision__options",
        "questions__answer",
    )


class CandidateAssignedExamListView(ListAPIView):
    serializer_class = CandidateAssignedExamSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return get_candidate_exam_queryset(user=self.request.user).order_by("-created_at")


class CandidateDashboardOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=CandidateDashboardOverviewSerializer)
    def get(self, request):
        exams = list(get_candidate_exam_queryset(user=request.user))
        phase_priority = {
            "open": 0,
            "paused": 1,
            "scheduled": 2,
            "closed": 3,
            "results": 4,
            "draft": 5,
        }
        upcoming_exams = sorted(
            (
                exam
                for exam in exams
                if resolve_exam_phase(exam) in {"scheduled", "open", "paused"}
            ),
            key=lambda exam: (
                phase_priority.get(resolve_exam_phase(exam), 99),
                getattr(getattr(exam, "schedule_window", None), "opens_at", None) or timezone.now(),
                exam.name,
            ),
        )
        accessible_subjects = get_accessible_subject_queryset(user=request.user)
        published_results = (
            Result.objects.select_related(
                "session",
                "session__candidate",
                "session__exam",
                "session__exam__subject",
                "published_by",
            )
            .filter(
                session__candidate=request.user,
                publish_state=Result.PublishState.PUBLISHED,
            )
            .order_by("-published_at", "-created_at")
        )
        active_materials = (
            Material.objects.select_related("subject", "uploaded_by")
            .filter(is_active=True, subject__in=accessible_subjects)
        )
        payload = {
            "stats": {
                "assigned_exam_count": len(exams),
                "upcoming_exam_count": len(upcoming_exams),
                "published_result_count": published_results.count(),
                "average_percentage": published_results.aggregate(avg=Avg("percentage"))["avg"] or Decimal("0.00"),
                "active_material_count": active_materials.count(),
            },
            "upcoming_exams": upcoming_exams[:5],
            "recent_results": list(published_results[:5]),
            "recent_materials": list(active_materials.order_by("-created_at", "title")[:6]),
        }
        serializer = CandidateDashboardOverviewSerializer(payload, context={"request": request})
        return Response(serializer.data)


class CandidateExamStartView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=CandidateExamSessionSerializer)
    def post(self, request, pk):
        exam = get_object_or_404(
            Exam.objects.select_related("subject", "schedule_window", "current_version"),
            pk=pk,
        )
        session = start_or_resume_session(exam=exam, candidate=request.user)
        session = _candidate_session_queryset().get(pk=session.pk)
        serializer = CandidateExamSessionSerializer(session, context={"request": request})
        return Response(serializer.data)


class ExamSessionViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = CandidateExamSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _candidate_session_queryset().order_by("-created_at")

    def get_object(self):
        session = super().get_object()
        if not user_can_access_session(user=self.request.user, session=session):
            raise PermissionDenied(
                t(vi="Bạn không có quyền truy cập phiên thi này.", en="You do not have access to this session.")
            )
        return session

    @action(detail=True, methods=["post"])
    def autosave(self, request, pk=None):
        from django.core.cache import cache
        from rest_framework.exceptions import ValidationError
        
        cache_key = f"exam_session_cache:{pk}"
        cached_data = cache.get(cache_key)
        now = timezone.now()
        
        if cached_data is not None:
            # Check candidate ownership
            if cached_data["candidate_id"] != request.user.id:
                raise PermissionDenied(
                    t(vi="Bạn không có quyền truy cập phiên thi này.", en="You do not have access to this session.")
                )
            
            # Check session expiration
            # If expired, delete cache and fallback to DB to execute _expire_if_needed write
            if cached_data["status"] == "in_progress" and cached_data["expires_at"] <= now.timestamp():
                cache.delete(cache_key)
                cached_data = None
            elif cached_data["status"] != "in_progress":
                raise ValidationError(t(vi="Phiên thi này hiện không nhận câu trả lời.", en="This session is not accepting answers."))

        if cached_data is not None:
            # Check exam phase / interaction allowance using cached exam info
            exam_status = cached_data["exam_status"]
            opens_at = cached_data["exam_opens_at"]
            closes_at = cached_data["exam_closes_at"]
            has_published_results = cached_data["has_published_results"]
            
            # Replicate resolve_exam_phase logic
            phase = "open"
            if exam_status == "draft":
                phase = "draft"
            elif exam_status == "archived":
                phase = "closed"
            elif exam_status == "closed":
                phase = "results" if has_published_results else "closed"
            elif closes_at and closes_at <= now.timestamp():
                phase = "results" if has_published_results else "closed"
            elif exam_status == "paused":
                phase = "paused"
            elif exam_status == "open":
                phase = "open"
            elif exam_status == "scheduled":
                if opens_at and opens_at <= now.timestamp():
                    phase = "open"
                else:
                    phase = "scheduled"
                    
            if phase == "paused":
                raise ValidationError(t(vi="Bài thi này đang tạm dừng.", en="This exam is currently paused."))
            elif phase in {"closed", "results"}:
                raise ValidationError(t(vi="Bài thi này đã kết thúc.", en="This exam has already ended."))
            elif phase == "scheduled":
                raise ValidationError(t(vi="Bài thi này chưa mở.", en="This exam is not open yet."))
            elif phase != "open":
                raise ValidationError(t(vi="Bài thi này đã kết thúc.", en="This exam has already ended."))
                
            # Valid cache read! Return simulated receipt
            serializer = AutosaveSnapshotWriteSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            snapshot = {
                "id": None,
                "answered_count": cached_data["answered_count"],
                "marked_count": cached_data["marked_count"],
                "payload": serializer.validated_data.get("payload") or {},
                "created_at": now,
            }
            output = AutosaveSnapshotSerializer(snapshot)
            return Response(output.data)

        # Fallback to DB if cache miss
        session = self.get_object()
        serializer = AutosaveSnapshotWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Build the receipt (this runs the DB checks)
        snapshot = build_autosave_receipt(session=session, payload=serializer.validated_data.get("payload"))
        
        # Seed the cache for subsequent autosave calls
        from apps.exam_delivery.services import set_session_cache
        set_session_cache(session)
        
        output = AutosaveSnapshotSerializer(snapshot)
        return Response(output.data)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        from ..models import Submission

        session = self.get_object()
        # Trinh duyet tu nop khi het thoi gian an han -> ghi nguon "auto_timeout".
        auto_submit = str(request.data.get("auto_submit", "")).lower() in {"1", "true", "yes"}
        submit_session(
            session=session,
            submitted_by=request.user,
            source=Submission.Source.AUTO_TIMEOUT if auto_submit else Submission.Source.MANUAL,
        )
        session = ExamSession.objects.select_related("submission").get(pk=session.pk)
        output = SessionSubmissionSummarySerializer(session)
        return Response(output.data)


class SessionAnswerWriteAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=SessionAnswerWriteSerializer,
        responses=SessionAnswerResponseSerializer,
    )
    def put(self, request, session_id, question_id):
        session = get_object_or_404(
            ExamSession.objects.select_related("exam", "exam__schedule_window"),
            pk=session_id,
        )
        if not user_can_access_session(user=request.user, session=session):
            raise PermissionDenied(
                t(vi="Bạn không có quyền truy cập phiên thi này.", en="You do not have access to this session.")
            )

        session_question = get_object_or_404(
            SessionQuestion.objects.select_related("session"),
            pk=question_id,
            session=session,
        )
        serializer = SessionAnswerWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        answer = save_session_answer(
            session=session,
            session_question=session_question,
            selected_option_keys=serializer.validated_data.get("selected_option_keys"),
            answer_text=serializer.validated_data.get("answer_text"),
            is_marked_for_review=serializer.validated_data.get("is_marked_for_review", UNSET),
        )
        output = SessionAnswerResponseSerializer(answer)
        return Response(output.data)
