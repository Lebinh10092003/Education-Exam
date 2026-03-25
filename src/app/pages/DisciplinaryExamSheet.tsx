import { Fragment, useEffect, useMemo, useState } from "react";
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
  formatDisciplineDate,
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
      notify.success("Summary exported.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Unable to export summary.");
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
      notify.success("Case detail exported.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Unable to export case detail.");
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
      notify.success("Penalty proposal saved.");
      await syncLists();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Unable to save penalty proposal.");
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
      notify.success("Case updated.");
      await syncLists();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Unable to update case.");
    }
  };

  const bulkApply = async (action: "draft" | "approve" | "reject" | "no_penalty") => {
    if (!selectedCaseIds.length) {
      notify.info("Select one or more cases first.");
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
      notify.success("Bulk action applied.");
      setSelectedCaseIds([]);
      await syncLists();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Unable to apply bulk action.");
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
      notify.success("Certificate policy saved.");
      await syncLists();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Unable to save certificate policy.");
    }
  };

  const recomputeCertificates = async () => {
    try {
      await mutation.run(() =>
        apiRequest(`/api/v1/discipline/exams/${examId}/certificate-recompute/`, {
          method: "POST",
        }),
      );
      notify.success("Certificates recomputed.");
      await syncLists();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Unable to recompute certificates.");
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
    key: keyof CertificatePolicyRecord,
    primaryLabel: string,
    primaryKey: "threshold" | "ratio",
    secondaryLabel?: string,
    secondaryKey?: "minimum_percentage",
  ) => {
    const config = policyDraft[key] as Record<string, string | number>;
    return (
      <div className="grid gap-3 rounded-xl border border-gray-200 p-4 md:grid-cols-3">
        <div>
          <p className="font-medium text-gray-900">{label}</p>
          <p className="text-xs text-gray-500">Configure this certificate band.</p>
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
              No secondary value for the current mode.
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
          Back to Discipline Overview
        </Link>
      </Button>

      <PageHeader
        title={examSummary ? `${examSummary.name} Discipline Sheet` : "Discipline Sheet"}
        description="Review per-candidate penalties, approve or dismiss case proposals, and keep certificate policy in sync."
        action={
          <>
            <Button variant="outline" onClick={() => void exportCases()}>
              <Download className="mr-2 h-4 w-4" />
              Export Cases
            </Button>
            <Button variant="outline" onClick={() => void exportSummary()}>
              <Download className="mr-2 h-4 w-4" />
              Export Summary
            </Button>
          </>
        }
      />

      {(recordsList.error || casesList.error || mutation.error) ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {recordsList.error ?? casesList.error ?? mutation.error}
        </div>
      ) : null}

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr),420px]">
        <Card>
          <CardHeader>
            <CardTitle>Bulk Case Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[220px,1fr] md:items-end">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-gray-500">Bulk Penalty %</label>
                <Input
                  aria-label="Bulk penalty percent"
                  value={bulkPenalty}
                  onChange={(event) => setBulkPenalty(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void bulkApply("draft")} disabled={!selectedCaseIds.length}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Draft
                </Button>
                <Button onClick={() => void bulkApply("approve")} disabled={!selectedCaseIds.length}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve Selected
                </Button>
                <Button variant="outline" onClick={() => void bulkApply("reject")} disabled={!selectedCaseIds.length}>
                  Reject Selected
                </Button>
                <Button variant="outline" onClick={() => void bulkApply("no_penalty")} disabled={!selectedCaseIds.length}>
                  <Shield className="mr-2 h-4 w-4" />
                  No Penalty
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Selected cases: <strong>{selectedCases.length}</strong>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Certificate Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-gray-500">Mode</label>
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
                <option value="score_threshold">Score threshold</option>
                <option value="rank_ratio">Rank ratio</option>
                <option value="rank_ratio_with_minimum">Rank ratio with minimum</option>
              </select>
            </div>

            {policyDraft.mode === "score_threshold" ? (
              <>
                {renderPolicyConfigRow("Gold", "gold_config", "Threshold %", "threshold")}
                {renderPolicyConfigRow("Silver", "silver_config", "Threshold %", "threshold")}
                {renderPolicyConfigRow("Bronze", "bronze_config", "Threshold %", "threshold")}
                {renderPolicyConfigRow("Encouragement", "encouragement_config", "Threshold %", "threshold")}
              </>
            ) : policyDraft.mode === "rank_ratio" ? (
              <>
                {renderPolicyConfigRow("Gold", "gold_config", "Ratio %", "ratio")}
                {renderPolicyConfigRow("Silver", "silver_config", "Ratio %", "ratio")}
                {renderPolicyConfigRow("Bronze", "bronze_config", "Ratio %", "ratio")}
                {renderPolicyConfigRow("Encouragement", "encouragement_config", "Ratio %", "ratio")}
              </>
            ) : (
              <>
                {renderPolicyConfigRow("Gold", "gold_config", "Ratio %", "ratio", "Minimum %", "minimum_percentage")}
                {renderPolicyConfigRow("Silver", "silver_config", "Ratio %", "ratio", "Minimum %", "minimum_percentage")}
                {renderPolicyConfigRow("Bronze", "bronze_config", "Ratio %", "ratio", "Minimum %", "minimum_percentage")}
                {renderPolicyConfigRow(
                  "Encouragement",
                  "encouragement_config",
                  "Ratio %",
                  "ratio",
                  "Minimum %",
                  "minimum_percentage",
                )}
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void savePolicy()}>Save Policy</Button>
              <Button variant="outline" onClick={() => void recomputeCertificates()}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Recompute Certificates
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Candidate Discipline Sheet</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recordsList.isLoading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">Loading disciplinary sheet...</div>
          ) : records.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1280px]">
                <thead>
                  <tr className="sticky top-0 border-b border-gray-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 font-semibold">Select</th>
                    <th className="px-4 py-3 font-semibold">Candidate</th>
                    <th className="px-4 py-3 font-semibold">Cases</th>
                    <th className="px-4 py-3 font-semibold">Original Score</th>
                    <th className="px-4 py-3 font-semibold">Penalty %</th>
                    <th className="px-4 py-3 font-semibold">Penalized Score</th>
                    <th className="px-4 py-3 font-semibold">Certificate</th>
                    <th className="px-4 py-3 font-semibold">Review</th>
                    <th className="px-4 py-3 font-semibold">Updated</th>
                    <th className="px-4 py-3 font-semibold">Details</th>
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
                              aria-label={`Select cases for ${record.candidate.full_name}`}
                              checked={allSelected}
                              onChange={(event) => toggleSessionSelection(record.selected_session, event.target.checked)}
                            />
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-medium text-gray-900">{record.candidate.full_name}</p>
                            <p className="text-xs text-gray-500">{record.candidate.email}</p>
                            <p className="mt-1 text-xs text-gray-400">Session #{record.selected_session ?? "-"}</p>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700">
                            <div>{record.unique_case_count} case(s)</div>
                            <div className="text-xs text-gray-500">{record.open_case_count} open</div>
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
                              aria-label={`Toggle cases for ${record.candidate.full_name}`}
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
                                      <th className="px-3 py-2 font-semibold">Pick</th>
                                      <th className="px-3 py-2 font-semibold">Case</th>
                                      <th className="px-3 py-2 font-semibold">Severity</th>
                                      <th className="px-3 py-2 font-semibold">Evidence</th>
                                      <th className="px-3 py-2 font-semibold">Penalty %</th>
                                      <th className="px-3 py-2 font-semibold">Status</th>
                                      <th className="px-3 py-2 font-semibold">Actions</th>
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
                                              aria-label={`Select case ${caseRecord.id}`}
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
                                            <p className="font-medium text-gray-900">{caseRecord.title}</p>
                                            <p className="text-xs text-gray-500">{caseRecord.summary || "No summary"}</p>
                                            <p className="mt-1 text-xs text-gray-400">{formatDisciplineDate(caseRecord.created_at)}</p>
                                          </td>
                                          <td className="px-3 py-3 text-sm text-gray-700">{caseRecord.severity}</td>
                                          <td className="px-3 py-3 text-sm text-gray-700">{caseRecord.evidence_count}</td>
                                          <td className="px-3 py-3">
                                            <Input
                                              aria-label={`Penalty percent for case ${caseRecord.id}`}
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
                                            <Badge variant="outline">{caseRecord.proposal?.status ?? "no proposal"}</Badge>
                                          </td>
                                          <td className="px-3 py-3">
                                            <div className="flex flex-wrap gap-2">
                                              <Button size="sm" variant="outline" onClick={() => void saveProposal(caseRecord)}>
                                                Save Draft
                                              </Button>
                                              <Button size="sm" onClick={() => void runCaseAction(caseRecord, "approve")}>
                                                Approve
                                              </Button>
                                              <Button size="sm" variant="outline" onClick={() => void runCaseAction(caseRecord, "reject")}>
                                                Reject
                                              </Button>
                                              <Button size="sm" variant="outline" onClick={() => void runCaseAction(caseRecord, "no-penalty")}>
                                                No Penalty
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
            <div className="px-6 py-12 text-center text-sm text-gray-500">No disciplinary records are available for this exam yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
