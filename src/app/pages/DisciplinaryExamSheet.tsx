import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Download, RefreshCcw, Save, Shield } from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useAsyncList } from "../hooks/useAsyncList";
import { useMutationState } from "../hooks/useMutationState";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { notify } from "../lib/notify";
import {
  type CertificatePolicyRecord,
  type DisciplinaryCandidateRecord,
  type DisciplinaryCaseRecord,
  downloadDisciplineWorkbook,
  formatCertificateLevel,
  formatDisciplineCaseText,
  formatSeverity,
  formatDisciplineDate,
  formatProposalStatus,
  formatReviewStatus,
} from "./disciplineShared";

const defaultPolicy: CertificatePolicyRecord = {
  mode: "score_threshold",
  gold_config: { threshold: 90, ratio: 10, minimum_percentage: 90 },
  silver_config: { threshold: 80, ratio: 20, minimum_percentage: 80 },
  bronze_config: { threshold: 70, ratio: 30, minimum_percentage: 70 },
  encouragement_config: { threshold: 60, ratio: 40, minimum_percentage: 60 },
};

type CaseEditState = {
  penalty: string;
  notes: string;
};

const getPolicyValue = (config: Record<string, string | number>, key: string, fallback: number) =>
  String(config[key] ?? fallback);

export function DisciplinaryExamSheet() {
  const { t } = useTranslation("common");
  const params = useParams();
  const examId = Number(params.id);
  const mutation = useMutationState();
  const [expandedSessions, setExpandedSessions] = useState<Record<number, boolean>>({});
  const [selectedCaseIds, setSelectedCaseIds] = useState<number[]>([]);
  const [bulkPenalty, setBulkPenalty] = useState("10");
  const [caseEdits, setCaseEdits] = useState<Record<number, CaseEditState>>({});
  const [policyDraft, setPolicyDraft] = useState<CertificatePolicyRecord>(defaultPolicy);

  const recordsList = useAsyncList(
    () =>
      apiRequest<PaginatedResponse<DisciplinaryCandidateRecord>>(`/api/v1/discipline/exams/${examId}/records/`),
    [examId],
  );
  const casesList = useAsyncList(
    () => apiRequest<PaginatedResponse<DisciplinaryCaseRecord>>(`/api/v1/discipline/exams/${examId}/cases/`),
    [examId],
  );
  const policyList = useAsyncList(
    () =>
      apiRequest<CertificatePolicyRecord>(`/api/v1/discipline/exams/${examId}/certificate-policy/`).catch(
        () => defaultPolicy,
      ),
    [examId],
  );

  useEffect(() => {
    if (policyList.data) {
      setPolicyDraft(policyList.data);
    }
  }, [policyList.data]);

  const records = recordsList.data?.results ?? [];
  const cases = casesList.data?.results ?? [];
  const examSummary = records[0]?.exam ?? cases[0]?.exam ?? null;

  const casesBySession = useMemo(() => {
    const map = new Map<number, DisciplinaryCaseRecord[]>();
    for (const caseRecord of cases) {
      const bucket = map.get(caseRecord.session_id) ?? [];
      bucket.push(caseRecord);
      map.set(caseRecord.session_id, bucket);
    }
    return map;
  }, [cases]);

  const selectedCases = useMemo(
    () => cases.filter((caseRecord) => selectedCaseIds.includes(caseRecord.id)),
    [cases, selectedCaseIds],
  );

  const caseEditFor = (caseRecord: DisciplinaryCaseRecord) =>
    caseEdits[caseRecord.id] ?? {
      penalty: caseRecord.proposal?.proposed_penalty_percent ?? "0",
      notes: caseRecord.proposal?.notes ?? "",
    };

  const syncLists = async () => {
    await Promise.all([recordsList.reload(), casesList.reload(), policyList.reload()]);
  };

  const exportSummary = async () => {
    try {
      await mutation.run(() =>
        downloadDisciplineWorkbook(
          `/api/v1/discipline/exams/${examId}/export/`,
          `eduexam-discipline-summary-exam-${examId}.xlsx`,
        ),
      );
      notify.success(t("discipline.sheet.exportSummarySuccess"));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t("discipline.sheet.exportSummaryError"));
    }
  };

  const exportCases = async () => {
    try {
      await mutation.run(() =>
        downloadDisciplineWorkbook(
          `/api/v1/discipline/exams/${examId}/cases/export/`,
          `eduexam-discipline-cases-exam-${examId}.xlsx`,
        ),
      );
      notify.success(t("discipline.sheet.exportCasesSuccess"));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t("discipline.sheet.exportCasesError"));
    }
  };

  const saveProposal = async (caseRecord: DisciplinaryCaseRecord) => {
    const edit = caseEditFor(caseRecord);
    try {
      await mutation.run(() =>
        apiRequest(`/api/v1/discipline/cases/${caseRecord.id}/proposal/`, {
          method: "POST",
          body: {
            proposed_penalty_percent: edit.penalty,
            notes: edit.notes,
          },
        }),
      );
      notify.success(t("discipline.sheet.saveProposalSuccess"));
      await syncLists();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t("discipline.sheet.saveProposalError"));
    }
  };

  const runCaseAction = async (caseRecord: DisciplinaryCaseRecord, action: "approve" | "reject" | "no-penalty") => {
    try {
      const edit = caseEditFor(caseRecord);
      await mutation.run(() =>
        apiRequest(`/api/v1/discipline/cases/${caseRecord.id}/${action}/`, {
          method: "POST",
          body:
            action === "approve"
              ? {
                  proposed_penalty_percent: edit.penalty,
                  notes: edit.notes,
                }
              : undefined,
        }),
      );
      notify.success(t("discipline.sheet.caseUpdatedSuccess"));
      await syncLists();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t("discipline.sheet.caseUpdatedError"));
    }
  };

  const bulkApply = async (action: "draft" | "approve" | "reject" | "no_penalty") => {
    if (!selectedCaseIds.length) {
      notify.info(t("discipline.sheet.selectCasesFirst"));
      return;
    }

    try {
      await mutation.run(() =>
        apiRequest(`/api/v1/discipline/exams/${examId}/bulk-apply/`, {
          method: "POST",
          body: {
            action,
            case_ids: selectedCaseIds,
            proposed_penalty_percent: bulkPenalty,
          },
        }),
      );
      notify.success(t("discipline.sheet.bulkAppliedSuccess"));
      setSelectedCaseIds([]);
      await syncLists();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t("discipline.sheet.bulkAppliedError"));
    }
  };

  const savePolicy = async () => {
    try {
      await mutation.run(() =>
        apiRequest(`/api/v1/discipline/exams/${examId}/certificate-policy/`, {
          method: "PUT",
          body: policyDraft,
        }),
      );
      notify.success(t("discipline.sheet.savePolicySuccess"));
      await syncLists();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t("discipline.sheet.savePolicyError"));
    }
  };

  const recomputeCertificates = async () => {
    try {
      await mutation.run(() =>
        apiRequest(`/api/v1/discipline/exams/${examId}/certificate-recompute/`, {
          method: "POST",
        }),
      );
      notify.success(t("discipline.sheet.recomputeSuccess"));
      await syncLists();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t("discipline.sheet.recomputeError"));
    }
  };

  const toggleSessionExpansion = (sessionId: number | null) => {
    if (!sessionId) {
      return;
    }
    setExpandedSessions((current) => ({
      ...current,
      [sessionId]: !current[sessionId],
    }));
  };

  const toggleSessionSelection = (sessionId: number | null, checked: boolean) => {
    if (!sessionId) {
      return;
    }
    const sessionCaseIds = (casesBySession.get(sessionId) ?? []).map((item) => item.id);
    setSelectedCaseIds((current) =>
      checked
        ? Array.from(new Set([...current, ...sessionCaseIds]))
        : current.filter((id) => !sessionCaseIds.includes(id)),
    );
  };

  const renderPolicyConfigRow = (
    label: string,
    key: Exclude<keyof CertificatePolicyRecord, "mode">,
    primaryLabel: string,
    primaryKey: "threshold" | "ratio",
    secondaryLabel?: string,
    secondaryKey?: "minimum_percentage",
  ) => {
    const config = policyDraft[key];
    return (
      <div className="grid gap-3 rounded-xl border border-gray-200 p-4 md:grid-cols-3">
        <div>
          <p className="font-medium text-gray-900">{label}</p>
          <p className="text-xs text-gray-500">{t("discipline.sheet.bandDescription")}</p>
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-gray-500">{primaryLabel}</label>
          <Input
            value={getPolicyValue(config, primaryKey, 0)}
            onChange={(event) =>
              setPolicyDraft((current) => ({
                ...current,
                [key]: {
                  ...current[key],
                  [primaryKey]: Number(event.target.value || 0),
                },
              }))
            }
          />
        </div>
        <div>
          {secondaryLabel && secondaryKey ? (
            <>
              <label className="mb-1 block text-xs uppercase tracking-wide text-gray-500">{secondaryLabel}</label>
              <Input
                value={getPolicyValue(config, secondaryKey, 0)}
                onChange={(event) =>
                  setPolicyDraft((current) => ({
                    ...current,
                    [key]: {
                      ...current[key],
                      [secondaryKey]: Number(event.target.value || 0),
                    },
                  }))
                }
              />
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
              {t("discipline.sheet.noSecondaryValue")}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <Button variant="ghost" className="mb-4 px-0 text-slate-600 hover:bg-transparent" asChild>
        <Link to="/discipline">
          <ArrowLeft className="h-4 w-4" />
          {t("discipline.sheet.backToOverview")}
        </Link>
      </Button>

      <PageHeader
        title={
          examSummary
            ? t("discipline.sheet.pageTitleWithExam", { exam: examSummary.name })
            : t("discipline.sheet.pageTitle")
        }
        description={t("discipline.sheet.pageDescription")}
        action={
          <>
            <Button variant="outline" onClick={() => void exportCases()}>
              <Download className="mr-2 h-4 w-4" />
              {t("discipline.sheet.exportCases")}
            </Button>
            <Button variant="outline" onClick={() => void exportSummary()}>
              <Download className="mr-2 h-4 w-4" />
              {t("discipline.sheet.exportSummary")}
            </Button>
          </>
        }
      />

      {(recordsList.error || casesList.error || mutation.error) ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {recordsList.error ?? casesList.error ?? mutation.error}
        </div>
      ) : null}

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>{t("discipline.sheet.bulkTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-end">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-gray-500">
                  {t("discipline.sheet.bulkPenaltyLabel")}
                </label>
                <Input
                  aria-label={t("discipline.sheet.aria.bulkPenalty")}
                  value={bulkPenalty}
                  onChange={(event) => setBulkPenalty(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void bulkApply("draft")} disabled={!selectedCaseIds.length}>
                  <Save className="mr-2 h-4 w-4" />
                  {t("discipline.sheet.actions.saveDraft")}
                </Button>
                <Button onClick={() => void bulkApply("approve")} disabled={!selectedCaseIds.length}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t("discipline.sheet.actions.approveSelected")}
                </Button>
                <Button variant="outline" onClick={() => void bulkApply("reject")} disabled={!selectedCaseIds.length}>
                  {t("discipline.sheet.actions.rejectSelected")}
                </Button>
                <Button variant="outline" onClick={() => void bulkApply("no_penalty")} disabled={!selectedCaseIds.length}>
                  <Shield className="mr-2 h-4 w-4" />
                  {t("discipline.sheet.actions.noPenalty")}
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {t("discipline.sheet.selectedCases", { count: selectedCases.length })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("discipline.sheet.policyTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-gray-500">
                {t("discipline.sheet.policyModeLabel")}
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={policyDraft.mode}
                onChange={(event) =>
                  setPolicyDraft((current) => ({
                    ...current,
                    mode: event.target.value,
                  }))
                }
              >
                <option value="score_threshold">{t("discipline.sheet.mode.score_threshold")}</option>
                <option value="rank_ratio">{t("discipline.sheet.mode.rank_ratio")}</option>
                <option value="rank_ratio_with_minimum">{t("discipline.sheet.mode.rank_ratio_with_minimum")}</option>
              </select>
            </div>

            {policyDraft.mode === "score_threshold" ? (
              <>
                {renderPolicyConfigRow(formatCertificateLevel("gold"), "gold_config", t("discipline.sheet.primaryLabel.threshold"), "threshold")}
                {renderPolicyConfigRow(formatCertificateLevel("silver"), "silver_config", t("discipline.sheet.primaryLabel.threshold"), "threshold")}
                {renderPolicyConfigRow(formatCertificateLevel("bronze"), "bronze_config", t("discipline.sheet.primaryLabel.threshold"), "threshold")}
                {renderPolicyConfigRow(
                  formatCertificateLevel("encouragement"),
                  "encouragement_config",
                  t("discipline.sheet.primaryLabel.threshold"),
                  "threshold",
                )}
              </>
            ) : policyDraft.mode === "rank_ratio" ? (
              <>
                {renderPolicyConfigRow(formatCertificateLevel("gold"), "gold_config", t("discipline.sheet.primaryLabel.ratio"), "ratio")}
                {renderPolicyConfigRow(formatCertificateLevel("silver"), "silver_config", t("discipline.sheet.primaryLabel.ratio"), "ratio")}
                {renderPolicyConfigRow(formatCertificateLevel("bronze"), "bronze_config", t("discipline.sheet.primaryLabel.ratio"), "ratio")}
                {renderPolicyConfigRow(
                  formatCertificateLevel("encouragement"),
                  "encouragement_config",
                  t("discipline.sheet.primaryLabel.ratio"),
                  "ratio",
                )}
              </>
            ) : (
              <>
                {renderPolicyConfigRow(
                  formatCertificateLevel("gold"),
                  "gold_config",
                  t("discipline.sheet.primaryLabel.ratio"),
                  "ratio",
                  t("discipline.sheet.secondaryLabel.minimum_percentage"),
                  "minimum_percentage",
                )}
                {renderPolicyConfigRow(
                  formatCertificateLevel("silver"),
                  "silver_config",
                  t("discipline.sheet.primaryLabel.ratio"),
                  "ratio",
                  t("discipline.sheet.secondaryLabel.minimum_percentage"),
                  "minimum_percentage",
                )}
                {renderPolicyConfigRow(
                  formatCertificateLevel("bronze"),
                  "bronze_config",
                  t("discipline.sheet.primaryLabel.ratio"),
                  "ratio",
                  t("discipline.sheet.secondaryLabel.minimum_percentage"),
                  "minimum_percentage",
                )}
                {renderPolicyConfigRow(
                  formatCertificateLevel("encouragement"),
                  "encouragement_config",
                  t("discipline.sheet.primaryLabel.ratio"),
                  "ratio",
                  t("discipline.sheet.secondaryLabel.minimum_percentage"),
                  "minimum_percentage",
                )}
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void savePolicy()}>{t("discipline.sheet.savePolicy")}</Button>
              <Button variant="outline" onClick={() => void recomputeCertificates()}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                {t("discipline.sheet.recomputeCertificates")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("discipline.sheet.candidateTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recordsList.isLoading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">{t("discipline.sheet.loading")}</div>
          ) : records.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1280px]">
                <thead>
                  <tr className="sticky top-0 border-b border-gray-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 font-semibold">{t("discipline.sheet.columns.select")}</th>
                    <th className="px-4 py-3 font-semibold">{t("discipline.sheet.columns.candidate")}</th>
                    <th className="px-4 py-3 font-semibold">{t("discipline.sheet.columns.cases")}</th>
                    <th className="px-4 py-3 font-semibold">{t("discipline.sheet.columns.originalScore")}</th>
                    <th className="px-4 py-3 font-semibold">{t("discipline.sheet.columns.penaltyPercent")}</th>
                    <th className="px-4 py-3 font-semibold">{t("discipline.sheet.columns.penalizedScore")}</th>
                    <th className="px-4 py-3 font-semibold">{t("discipline.sheet.columns.certificate")}</th>
                    <th className="px-4 py-3 font-semibold">{t("discipline.sheet.columns.review")}</th>
                    <th className="px-4 py-3 font-semibold">{t("discipline.sheet.columns.updated")}</th>
                    <th className="px-4 py-3 font-semibold">{t("discipline.sheet.columns.details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => {
                    const sessionCases = record.selected_session ? casesBySession.get(record.selected_session) ?? [] : [];
                    const allSelected = sessionCases.length > 0 && sessionCases.every((item) => selectedCaseIds.includes(item.id));
                    const expanded = record.selected_session ? expandedSessions[record.selected_session] ?? false : false;
                    return (
                      <Fragment key={record.id}>
                        <tr className="border-b border-gray-100 align-top">
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              aria-label={t("discipline.sheet.aria.selectCandidateCases", { candidate: record.candidate.full_name })}
                              checked={allSelected}
                              onChange={(event) => toggleSessionSelection(record.selected_session, event.target.checked)}
                            />
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-medium text-gray-900">{record.candidate.full_name}</p>
                            <p className="text-xs text-gray-500">{record.candidate.email}</p>
                            <p className="mt-1 text-xs text-gray-400">
                              {t("discipline.sheet.sessionLabel", { id: record.selected_session ?? "-" })}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700">
                            <div>{t("discipline.sheet.caseCount", { count: record.unique_case_count })}</div>
                            <div className="text-xs text-gray-500">{t("discipline.sheet.openCases", { count: record.open_case_count })}</div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700">
                            {record.original_total_score} ({record.original_percentage}%)
                          </td>
                          <td className="px-4 py-4 text-sm font-semibold text-amber-700">{record.applied_penalty_percent}%</td>
                          <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                            {record.final_total_score} ({record.final_percentage}%)
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant="outline">{formatCertificateLevel(record.certificate_level_snapshot)}</Badge>
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant={record.review_status === "penalty_applied" ? "default" : "outline"}>
                              {formatReviewStatus(record.review_status)}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600">{formatDisciplineDate(record.updated_at)}</td>
                          <td className="px-4 py-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={t("discipline.sheet.aria.toggleCases", { candidate: record.candidate.full_name })}
                              onClick={() => toggleSessionExpansion(record.selected_session)}
                            >
                              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </td>
                        </tr>
                        {expanded && sessionCases.length ? (
                          <tr className="border-b border-gray-100 bg-slate-50/70">
                            <td colSpan={10} className="px-4 py-4">
                              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                <table className="w-full min-w-[980px]">
                                  <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-gray-500">
                                      <th className="px-3 py-2 font-semibold">{t("discipline.sheet.caseColumns.pick")}</th>
                                      <th className="px-3 py-2 font-semibold">{t("discipline.sheet.caseColumns.case")}</th>
                                      <th className="px-3 py-2 font-semibold">{t("discipline.sheet.caseColumns.severity")}</th>
                                      <th className="px-3 py-2 font-semibold">{t("discipline.sheet.caseColumns.evidence")}</th>
                                      <th className="px-3 py-2 font-semibold">{t("discipline.sheet.caseColumns.penaltyPercent")}</th>
                                      <th className="px-3 py-2 font-semibold">{t("discipline.sheet.caseColumns.status")}</th>
                                      <th className="px-3 py-2 font-semibold">{t("discipline.sheet.caseColumns.actions")}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sessionCases.map((caseRecord) => {
                                      const edit = caseEditFor(caseRecord);
                                      const isSelected = selectedCaseIds.includes(caseRecord.id);
                                      return (
                                        <tr key={caseRecord.id} className="border-b border-slate-100 align-top">
                                          <td className="px-3 py-3">
                                            <input
                                              type="checkbox"
                                              aria-label={t("discipline.sheet.aria.selectCase", { id: caseRecord.id })}
                                              checked={isSelected}
                                              onChange={(event) =>
                                                setSelectedCaseIds((current) =>
                                                  event.target.checked
                                                    ? Array.from(new Set([...current, caseRecord.id]))
                                                    : current.filter((value) => value !== caseRecord.id),
                                                )
                                              }
                                            />
                                          </td>
                                          <td className="px-3 py-3">
                                            <p className="font-medium text-gray-900">
                                              {formatDisciplineCaseText(caseRecord.title)}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                              {caseRecord.summary
                                                ? formatDisciplineCaseText(caseRecord.summary)
                                                : t("discipline.sheet.noSummary")}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-400">{formatDisciplineDate(caseRecord.created_at)}</p>
                                          </td>
                                          <td className="px-3 py-3 text-sm text-gray-700">{formatSeverity(caseRecord.severity)}</td>
                                          <td className="px-3 py-3 text-sm text-gray-700">{caseRecord.evidence_count}</td>
                                          <td className="px-3 py-3">
                                            <Input
                                              aria-label={t("discipline.sheet.aria.casePenalty", { id: caseRecord.id })}
                                              value={edit.penalty}
                                              onChange={(event) =>
                                                setCaseEdits((current) => ({
                                                  ...current,
                                                  [caseRecord.id]: {
                                                    ...edit,
                                                    penalty: event.target.value,
                                                  },
                                                }))
                                              }
                                              className="w-24"
                                            />
                                          </td>
                                          <td className="px-3 py-3">
                                            <Badge variant="outline">{formatProposalStatus(caseRecord.proposal?.status)}</Badge>
                                          </td>
                                          <td className="px-3 py-3">
                                            <div className="flex flex-wrap gap-2">
                                              <Button size="sm" variant="outline" onClick={() => void saveProposal(caseRecord)}>
                                                {t("discipline.sheet.actions.saveDraft")}
                                              </Button>
                                              <Button size="sm" onClick={() => void runCaseAction(caseRecord, "approve")}>
                                                {t("discipline.sheet.actions.approve")}
                                              </Button>
                                              <Button size="sm" variant="outline" onClick={() => void runCaseAction(caseRecord, "reject")}>
                                                {t("discipline.sheet.actions.reject")}
                                              </Button>
                                              <Button size="sm" variant="outline" onClick={() => void runCaseAction(caseRecord, "no-penalty")}>
                                                {t("discipline.sheet.actions.noPenalty")}
                                              </Button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center text-sm text-gray-500">{t("discipline.sheet.empty")}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
