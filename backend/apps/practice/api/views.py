from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import Subject
from apps.exam_delivery.access import get_accessible_subject_queryset
from apps.platform_core.i18n import t

from ..models import PracticeSession, PracticeSessionQuestion
from ..services import (
    UNSET,
    assert_user_can_access_practice_session,
    create_practice_autosave_snapshot,
    create_practice_session,
    get_active_practice_session,
    save_practice_answer,
    submit_practice_session,
    user_has_practice_subject_access,
)
from .serializers import (
    PracticeAutosaveSnapshotSerializer,
    PracticeAutosaveSnapshotWriteSerializer,
    PracticeCatalogItemSerializer,
    PracticeReviewSerializer,
    PracticeSessionAnswerResponseSerializer,
    PracticeSessionAnswerWriteSerializer,
    PracticeSessionCreateSerializer,
    PracticeSessionHistorySerializer,
    PracticeSessionSerializer,
    PracticeSessionSubmissionSerializer,
)


def get_practice_session_queryset():
    return PracticeSession.objects.select_related("subject").prefetch_related(
        Prefetch("questions", queryset=PracticeSessionQuestion.objects.order_by("sort_order"))
    )


class PracticeCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=PracticeCatalogItemSerializer(many=True))
    def get(self, request):
        subjects = (
            Subject.objects.filter(pk__in=get_accessible_subject_queryset(user=request.user).values("pk"))
            .annotate(
                easy_count=Count(
                    "questions",
                    filter=Q(
                        questions__question_type__in=["multiple_choice", "true_false"],
                        questions__difficulty="easy",
                        questions__current_revision__isnull=False,
                    ),
                ),
                medium_count=Count(
                    "questions",
                    filter=Q(
                        questions__question_type__in=["multiple_choice", "true_false"],
                        questions__difficulty="medium",
                        questions__current_revision__isnull=False,
                    ),
                ),
                hard_count=Count(
                    "questions",
                    filter=Q(
                        questions__question_type__in=["multiple_choice", "true_false"],
                        questions__difficulty="hard",
                        questions__current_revision__isnull=False,
                    ),
                ),
            )
            .order_by("name")
        )
        results = [
            {
                "subject": subject,
                "counts": {
                    "easy": subject.easy_count,
                    "medium": subject.medium_count,
                    "hard": subject.hard_count,
                    "total": subject.easy_count + subject.medium_count + subject.hard_count,
                },
            }
            for subject in subjects
            if subject.easy_count or subject.medium_count or subject.hard_count
        ]
        serializer = PracticeCatalogItemSerializer(results, many=True, context={"request": request})
        return Response({"results": serializer.data})


class PracticeHistoryView(ListAPIView):
    serializer_class = PracticeSessionHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return get_practice_session_queryset().filter(candidate=self.request.user).order_by("-created_at")


class PracticeSessionCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=PracticeSessionCreateSerializer, responses=PracticeSessionSerializer)
    def post(self, request):
        serializer = PracticeSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subject = get_object_or_404(Subject, pk=serializer.validated_data["subject_id"], is_active=True)
        if not user_has_practice_subject_access(user=request.user, subject=subject):
            return Response(
                {"detail": t(vi="Bạn không có quyền luyện tập môn học này.", en="You do not have access to this subject.")},
                status=status.HTTP_403_FORBIDDEN,
            )
        session = get_active_practice_session(candidate=request.user, subject=subject)
        response_status = status.HTTP_200_OK
        if session is None:
            session = create_practice_session(candidate=request.user, subject=subject)
            response_status = status.HTTP_201_CREATED
        session = get_practice_session_queryset().get(pk=session.pk)
        output = PracticeSessionSerializer(session, context={"request": request})
        return Response(output.data, status=response_status)


class PracticeSessionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, *, request, pk):
        session = get_object_or_404(get_practice_session_queryset(), pk=pk)
        assert_user_can_access_practice_session(user=request.user, session=session)
        return session

    @extend_schema(responses=PracticeSessionSerializer)
    def get(self, request, pk):
        session = self.get_object(request=request, pk=pk)
        output = PracticeSessionSerializer(session, context={"request": request})
        return Response(output.data)


class PracticeSessionAnswerView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=PracticeSessionAnswerWriteSerializer,
        responses=PracticeSessionAnswerResponseSerializer,
    )
    def put(self, request, session_id, question_id):
        session = get_object_or_404(get_practice_session_queryset(), pk=session_id)
        assert_user_can_access_practice_session(user=request.user, session=session)
        question = get_object_or_404(PracticeSessionQuestion, pk=question_id, session=session)
        serializer = PracticeSessionAnswerWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated_question = save_practice_answer(
            session=session,
            session_question=question,
            selected_option_keys=serializer.validated_data.get("selected_option_keys"),
            is_marked_for_review=serializer.validated_data.get("is_marked_for_review", UNSET),
        )
        output = PracticeSessionAnswerResponseSerializer(updated_question)
        return Response(output.data)


class PracticeSessionAutosaveView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=PracticeAutosaveSnapshotWriteSerializer,
        responses=PracticeAutosaveSnapshotSerializer,
    )
    def post(self, request, pk):
        session = get_object_or_404(get_practice_session_queryset(), pk=pk)
        assert_user_can_access_practice_session(user=request.user, session=session)
        serializer = PracticeAutosaveSnapshotWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        snapshot = create_practice_autosave_snapshot(session=session, payload=serializer.validated_data.get("payload"))
        output = PracticeAutosaveSnapshotSerializer(snapshot)
        return Response(output.data, status=status.HTTP_201_CREATED)


class PracticeSessionSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=PracticeSessionSubmissionSerializer)
    def post(self, request, pk):
        session = get_object_or_404(get_practice_session_queryset(), pk=pk)
        assert_user_can_access_practice_session(user=request.user, session=session)
        submit_practice_session(session=session)
        session.refresh_from_db()
        output = PracticeSessionSubmissionSerializer(session)
        return Response(output.data)


class PracticeSessionReviewView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=PracticeReviewSerializer)
    def get(self, request, pk):
        session = get_object_or_404(get_practice_session_queryset(), pk=pk)
        assert_user_can_access_practice_session(user=request.user, session=session)
        if session.status != PracticeSession.Status.SUBMITTED:
            return Response(
                {
                    "detail": t(
                        vi="Chỉ có thể xem review sau khi đã nộp bài luyện tập.",
                        en="Practice review is only available after submission.",
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload = {
            "id": session.id,
            "subject": session.subject,
            "status": session.status,
            "started_at": session.started_at,
            "submitted_at": session.submitted_at,
            "duration_minutes": session.duration_minutes,
            "details_available": session.questions.exists(),
            "details_retention_until": session.details_retention_until,
            "details_purged_at": session.details_purged_at,
            "summary": {
                "correct_count": session.correct_count,
                "incorrect_count": max(session.total_count - session.correct_count, 0),
                "total_count": session.total_count,
                "score_percentage": session.score_percentage,
            },
        }
        output = PracticeReviewSerializer(payload, context={"request": request})
        return Response(output.data)
