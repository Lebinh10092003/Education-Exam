from decimal import Decimal

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from ..models import ManualGrade, ManualGradingTask, Result


class ResultUserSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.CharField()
    full_name = serializers.CharField()


class ResultExamSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    subject_name = serializers.CharField()


class ManualGradeSerializer(serializers.ModelSerializer):
    graded_by = ResultUserSummarySerializer(read_only=True)

    class Meta:
        model = ManualGrade
        fields = ("score_awarded", "feedback", "graded_at", "graded_by")


class ManualGradingTaskSerializer(serializers.ModelSerializer):
    candidate = serializers.SerializerMethodField()
    exam = serializers.SerializerMethodField()
    question_text = serializers.CharField(source="session_question.question_revision.question_text", read_only=True)
    answer_text = serializers.SerializerMethodField()
    manual_grade = ManualGradeSerializer(read_only=True)

    class Meta:
        model = ManualGradingTask
        fields = (
            "id",
            "status",
            "max_points",
            "question_text",
            "answer_text",
            "candidate",
            "exam",
            "graded_at",
            "manual_grade",
        )

    @extend_schema_field(ResultUserSummarySerializer)
    def get_candidate(self, obj):
        candidate = obj.session.candidate
        return {
            "id": candidate.id,
            "email": candidate.email,
            "full_name": candidate.full_name,
        }

    @extend_schema_field(ResultExamSummarySerializer)
    def get_exam(self, obj):
        exam = obj.session.exam
        return {
            "id": exam.id,
            "name": exam.name,
            "subject_name": exam.subject.name,
        }

    @extend_schema_field(OpenApiTypes.STR)
    def get_answer_text(self, obj):
        answer = getattr(obj.session_question, "answer", None)
        return getattr(answer, "answer_text", "")


class ManualGradingTaskGradeSerializer(serializers.Serializer):
    score_awarded = serializers.DecimalField(max_digits=8, decimal_places=2)
    feedback = serializers.CharField(required=False, allow_blank=True)


class ResultSerializer(serializers.ModelSerializer):
    candidate = serializers.SerializerMethodField()
    exam = serializers.SerializerMethodField()
    locked_by = ResultUserSummarySerializer(read_only=True)
    score = serializers.DecimalField(source="total_score", max_digits=8, decimal_places=2, read_only=True)
    original_score = serializers.DecimalField(source="original_total_score", max_digits=8, decimal_places=2, read_only=True)
    total_marks = serializers.DecimalField(source="max_score", max_digits=8, decimal_places=2, read_only=True)
    original_percentage = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)
    penalty_percent_applied = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    certificate_level = serializers.SerializerMethodField()
    result_status = serializers.SerializerMethodField()
    completed_date = serializers.DateTimeField(source="session.submitted_at", read_only=True)
    time_taken_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Result
        fields = (
            "id",
            "candidate",
            "exam",
            "workflow_status",
            "publish_state",
            "score",
            "original_score",
            "total_marks",
            "percentage",
            "original_percentage",
            "penalty_percent_applied",
            "certificate_level",
            "result_status",
            "passed",
            "completed_date",
            "time_taken_minutes",
            "published_at",
            "locked_at",
            "locked_by",
            "scheduled_publish_at",
            "publication_note",
        )

    @extend_schema_field(ResultUserSummarySerializer)
    def get_candidate(self, obj):
        candidate = obj.session.candidate
        return {
            "id": candidate.id,
            "email": candidate.email,
            "full_name": candidate.full_name,
        }

    @extend_schema_field(ResultExamSummarySerializer)
    def get_exam(self, obj):
        exam = obj.session.exam
        return {
            "id": exam.id,
            "name": exam.name,
            "subject_name": exam.subject.name,
        }

    @extend_schema_field(OpenApiTypes.STR)
    def get_result_status(self, obj):
        if obj.workflow_status != Result.WorkflowStatus.FINALIZED:
            return "Pending"
        return "Pass" if obj.passed else "Fail"

    @extend_schema_field(OpenApiTypes.STR)
    def get_certificate_level(self, obj):
        certificate_award = (
            obj.session.exam.certificate_awards.filter(
                candidate=obj.session.candidate,
                selected_session=obj.session,
            )
            .only("award_level")
            .first()
        )
        return certificate_award.award_level if certificate_award is not None else ""

    @extend_schema_field(OpenApiTypes.INT)
    def get_time_taken_minutes(self, obj):
        if not obj.session.submitted_at:
            return 0
        delta = obj.session.submitted_at - obj.session.started_at
        return max(0, int(delta.total_seconds() // 60))


class ScoreDistributionBucketSerializer(serializers.Serializer):
    range = serializers.CharField()
    count = serializers.IntegerField()


class ResultSummarySerializer(serializers.Serializer):
    pass_count = serializers.IntegerField()
    fail_count = serializers.IntegerField()
    pending_count = serializers.IntegerField()
    pending_grading_count = serializers.IntegerField()
    reviewing_count = serializers.IntegerField()
    locked_count = serializers.IntegerField()
    scheduled_count = serializers.IntegerField()
    published_count = serializers.IntegerField()
    average_percentage = serializers.DecimalField(max_digits=8, decimal_places=2)
    score_distribution = ScoreDistributionBucketSerializer(many=True)


class ResultPublicationNoteSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True)


class ResultSchedulePublicationSerializer(serializers.Serializer):
    scheduled_publish_at = serializers.DateTimeField()
    note = serializers.CharField(required=False, allow_blank=True)


class ResultExamPublishSerializer(serializers.Serializer):
    exam = serializers.IntegerField()


class ResultReviewSerializer(serializers.Serializer):
    def to_representation(self, obj):
        session = obj.session
        candidate = session.candidate
        exam = session.exam
        result = ResultSerializer(obj).data
        questions = []

        for session_question in session.questions.all():
            revision = session_question.question_revision
            answer_key = getattr(revision, "answer_key", None)
            answer = getattr(session_question, "answer", None)
            manual_task = getattr(session_question, "manual_grading_task", None)
            manual_grade = getattr(manual_task, "manual_grade", None) if manual_task else None
            correct_option_keys = getattr(answer_key, "correct_option_keys", []) if answer_key else []
            selected_option_keys = getattr(answer, "selected_option_keys", []) if answer else []

            questions.append(
                {
                    "id": session_question.id,
                    "sort_order": session_question.sort_order,
                    "points": session_question.points,
                    "awarded_points": getattr(answer, "awarded_points", None),
                    "question_text": revision.question_text,
                    "question_type": revision.question.question_type,
                    "difficulty": revision.question.difficulty,
                    "options": [
                        {
                            "key": option.key,
                            "text": option.text,
                            "is_correct": option.key in correct_option_keys,
                            "is_selected": option.key in selected_option_keys,
                        }
                        for option in revision.options.all()
                    ],
                    "selected_option_keys": selected_option_keys,
                    "correct_option_keys": correct_option_keys,
                    "answer_text": getattr(answer, "answer_text", "") if answer else "",
                    "is_answered": getattr(answer, "is_answered", False) if answer else False,
                    "is_correct": getattr(answer, "is_correct", None) if answer else None,
                    "essay_rubric": getattr(answer_key, "essay_rubric", "") if answer_key else "",
                    "sample_answer": getattr(answer_key, "sample_answer", "") if answer_key else "",
                    "manual_feedback": getattr(manual_grade, "feedback", "") if manual_grade else "",
                    "manual_score_awarded": getattr(manual_grade, "score_awarded", None) if manual_grade else None,
                }
            )

        return {
            "id": obj.id,
            "candidate": {
                "id": candidate.id,
                "email": candidate.email,
                "full_name": candidate.full_name,
                "username": candidate.username,
            },
            "exam": {
                "id": exam.id,
                "name": exam.name,
                "subject_name": exam.subject.name,
            },
            "session": {
                "id": session.id,
                "status": session.status,
                "attempt_number": session.attempt_number,
                "started_at": session.started_at,
                "submitted_at": session.submitted_at,
                "objective_score": session.objective_score,
                "max_score": session.max_score,
            },
            "result": result,
            "questions": questions,
        }

