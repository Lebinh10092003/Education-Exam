from django.db.models import Q
from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.identity.permissions import HasAPIPermissionCode
from apps.question_bank.models import Question, QuestionImportBatch, QuestionTag
from apps.question_bank.services import import_questions_from_upload

from .serializers import (
    QuestionImportBatchCreateSerializer,
    QuestionImportBatchSerializer,
    QuestionReadSerializer,
    QuestionTagSerializer,
    QuestionWriteSerializer,
)


class QuestionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_codes = {
        "GET": "questions.view",
        "POST": "questions.manage",
        "PUT": "questions.manage",
        "PATCH": "questions.manage",
        "DELETE": "questions.manage",
    }

    def get_queryset(self):
        queryset = (
            Question.objects.select_related("subject", "current_revision", "current_revision__answer_key")
            .prefetch_related("tags", "current_revision__options")
            .order_by("-created_at")
        )
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(current_revision__question_text__icontains=search)
                | Q(tags__name__icontains=search)
                | Q(subject__name__icontains=search)
            )
        subject_id = self.request.query_params.get("subject")
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        difficulty = self.request.query_params.get("difficulty")
        if difficulty:
            queryset = queryset.filter(difficulty=difficulty)
        question_type = self.request.query_params.get("question_type")
        if question_type:
            queryset = queryset.filter(question_type=question_type)
        return queryset.distinct()

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return QuestionWriteSerializer
        return QuestionReadSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        question = serializer.save()
        output = QuestionReadSerializer(question, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        question = self.get_object()
        serializer = self.get_serializer(
            question,
            data=request.data,
            partial=kwargs.get("partial", False),
            context={**self.get_serializer_context(), "question": question},
        )
        serializer.is_valid(raise_exception=True)
        question = serializer.save()
        output = QuestionReadSerializer(question, context=self.get_serializer_context())
        return Response(output.data)


class QuestionTagViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = QuestionTagSerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_codes = {"GET": "questions.view"}
    queryset = QuestionTag.objects.order_by("name")


class QuestionImportBatchViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_codes = {"GET": "questions.view", "POST": "questions.manage"}

    def get_queryset(self):
        return QuestionImportBatch.objects.prefetch_related("errors").order_by("-created_at")

    def get_serializer_class(self):
        if self.action == "create":
            return QuestionImportBatchCreateSerializer
        return QuestionImportBatchSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        batch = import_questions_from_upload(
            uploaded_by=request.user,
            source_format=serializer.validated_data["source_format"],
            uploaded_file=serializer.validated_data["file"],
        )
        output = QuestionImportBatchSerializer(batch, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)
