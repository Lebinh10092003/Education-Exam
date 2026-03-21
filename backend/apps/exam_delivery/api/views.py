from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.exam_authoring.models import Exam

from ..models import ExamSession, SessionQuestion
from ..services import (
    UNSET,
    create_autosave_snapshot,
    save_session_answer,
    start_or_resume_session,
    submit_session,
    user_can_access_session,
)
from .serializers import (
    AutosaveSnapshotSerializer,
    AutosaveSnapshotWriteSerializer,
    CandidateAssignedExamSerializer,
    CandidateExamSessionSerializer,
    SessionAnswerResponseSerializer,
    SessionAnswerWriteSerializer,
    SessionSubmissionSummarySerializer,
)


class CandidateAssignedExamListView(ListAPIView):
    serializer_class = CandidateAssignedExamSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Exam.objects.select_related("subject", "schedule_window", "current_version")
            .filter(
                Q(assignments__user=self.request.user)
                | Q(
                    assignments__group__memberships__user=self.request.user,
                    assignments__group__memberships__is_active=True,
                )
            )
            .exclude(status__in=[Exam.Status.DRAFT, Exam.Status.ARCHIVED])
            .distinct()
            .order_by("-created_at")
        )


class CandidateExamStartView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=CandidateExamSessionSerializer)
    def post(self, request, pk):
        exam = get_object_or_404(
            Exam.objects.select_related("subject", "schedule_window", "current_version"),
            pk=pk,
        )
        session = start_or_resume_session(exam=exam, candidate=request.user)
        serializer = CandidateExamSessionSerializer(session, context={"request": request})
        return Response(serializer.data)


class ExamSessionViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = CandidateExamSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            ExamSession.objects.select_related("exam", "exam__subject")
            .prefetch_related(
                "questions__question_revision__question",
                "questions__question_revision__options",
                "questions__answer",
            )
            .order_by("-created_at")
        )

    def get_object(self):
        session = super().get_object()
        if not user_can_access_session(user=self.request.user, session=session):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You do not have access to this session.")
        return session

    @action(detail=True, methods=["post"])
    def autosave(self, request, pk=None):
        session = self.get_object()
        serializer = AutosaveSnapshotWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        snapshot = create_autosave_snapshot(session=session, payload=serializer.validated_data.get("payload"))
        output = AutosaveSnapshotSerializer(snapshot)
        return Response(output.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        session = self.get_object()
        submit_session(session=session, submitted_by=request.user)
        session.refresh_from_db()
        output = SessionSubmissionSummarySerializer(session)
        return Response(output.data)


class SessionAnswerWriteAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=SessionAnswerWriteSerializer,
        responses=SessionAnswerResponseSerializer,
    )
    def put(self, request, session_id, question_id):
        session = get_object_or_404(ExamSession, pk=session_id)
        if not user_can_access_session(user=request.user, session=session):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You do not have access to this session.")

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
