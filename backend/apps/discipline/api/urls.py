from django.urls import path

from .views import (
    CasePenaltyApproveView,
    CasePenaltyNoPenaltyView,
    CasePenaltyProposalView,
    CasePenaltyRejectView,
    DisciplineExamBulkApplyView,
    DisciplineExamCaseExportView,
    DisciplineExamCaseListView,
    DisciplineExamExportView,
    DisciplineExamRecordListView,
    DisciplineExamSummaryListView,
    ExamCertificatePolicyView,
    ExamCertificateRecomputeView,
)


urlpatterns = [
    path("discipline/exams/", DisciplineExamSummaryListView.as_view(), name="discipline-exam-list"),
    path("discipline/exams/<int:exam_id>/records/", DisciplineExamRecordListView.as_view(), name="discipline-exam-records"),
    path("discipline/exams/<int:exam_id>/cases/", DisciplineExamCaseListView.as_view(), name="discipline-exam-cases"),
    path("discipline/exams/<int:exam_id>/bulk-apply/", DisciplineExamBulkApplyView.as_view(), name="discipline-exam-bulk-apply"),
    path("discipline/exams/<int:exam_id>/certificate-policy/", ExamCertificatePolicyView.as_view(), name="discipline-exam-certificate-policy"),
    path("discipline/exams/<int:exam_id>/certificate-recompute/", ExamCertificateRecomputeView.as_view(), name="discipline-exam-certificate-recompute"),
    path("discipline/exams/<int:exam_id>/export/", DisciplineExamExportView.as_view(), name="discipline-exam-export"),
    path("discipline/exams/<int:exam_id>/cases/export/", DisciplineExamCaseExportView.as_view(), name="discipline-exam-cases-export"),
    path("discipline/cases/<int:case_id>/proposal/", CasePenaltyProposalView.as_view(), name="discipline-case-proposal"),
    path("discipline/cases/<int:case_id>/approve/", CasePenaltyApproveView.as_view(), name="discipline-case-approve"),
    path("discipline/cases/<int:case_id>/reject/", CasePenaltyRejectView.as_view(), name="discipline-case-reject"),
    path("discipline/cases/<int:case_id>/no-penalty/", CasePenaltyNoPenaltyView.as_view(), name="discipline-case-no-penalty"),
]
