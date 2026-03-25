import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Award, Eye, FileText, Search, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import {
  type CandidateResultRecord,
  formatResultDate,
  formatResultNumber,
  toResultNumber,
} from "./candidateResultsShared";
import { formatCertificateLevel } from "./disciplineShared";

export function CandidateResults() {
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const debouncedSearch = useDebouncedValue(searchQuery, 250);

  const resultsList = useAsyncList(
    () =>
      apiRequest<PaginatedResponse<CandidateResultRecord>>("/api/v1/my-results/", {
        query: {
          page_size: 100,
          search: debouncedSearch,
        },
      }),
    [debouncedSearch],
  );

  const results = resultsList.data?.results ?? [];
  const subjects = useMemo(
    () => Array.from(new Set(results.map((result) => result.exam.subject_name))).sort(),
    [results],
  );

  const filteredResults = useMemo(() => {
    if (subjectFilter === "all") {
      return results;
    }
    return results.filter((result) => result.exam.subject_name === subjectFilter);
  }, [results, subjectFilter]);

  const stats = useMemo(() => {
    if (!filteredResults.length) {
      return {
        totalExams: 0,
        averageScore: 0,
        highestScore: 0,
        passRate: 0,
      };
    }

    const percentages = filteredResults.map((result) => toResultNumber(result.percentage));
    const passCount = filteredResults.filter((result) => result.passed).length;
    return {
      totalExams: filteredResults.length,
      averageScore: percentages.reduce((sum, value) => sum + value, 0) / percentages.length,
      highestScore: Math.max(...percentages),
      passRate: (passCount / filteredResults.length) * 100,
    };
  }, [filteredResults]);

  const performanceTrend = useMemo(
    () =>
      [...filteredResults]
        .sort((left, right) => (left.published_at ?? "").localeCompare(right.published_at ?? ""))
        .map((result, index) => ({
          label: `#${index + 1}`,
          score: toResultNumber(result.percentage),
        })),
    [filteredResults],
  );

  const subjectPerformance = useMemo(() => {
    const totals = filteredResults.reduce<Record<string, { total: number; count: number }>>((accumulator, result) => {
      const subject = result.exam.subject_name;
      accumulator[subject] ??= { total: 0, count: 0 };
      accumulator[subject].total += toResultNumber(result.percentage);
      accumulator[subject].count += 1;
      return accumulator;
    }, {});

    return Object.entries(totals).map(([subject, values]) => ({
      subject,
      score: Number((values.total / values.count).toFixed(2)),
    }));
  }, [filteredResults]);

  return (
    <div>
      <PageHeader
        title="My Results"
        description="Published scores and performance trends from your completed exams."
        action={
          <Button variant="outline" asChild>
            <Link to="/candidate/dashboard">Back to Dashboard</Link>
          </Button>
        }
      />

      {resultsList.error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {resultsList.error}
        </div>
      ) : null}

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-gray-600">
              <FileText className="h-4 w-4 text-blue-600" />
              Total Exams
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.totalExams}</p>
            <p className="mt-1 text-xs text-gray-500">Published results only</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-gray-600">
              <Award className="h-4 w-4 text-purple-600" />
              Average Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.averageScore.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-gray-500">Across current filters</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-gray-600">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Highest Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.highestScore.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-gray-500">Best published result</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-gray-600">
              <Award className="h-4 w-4 text-orange-600" />
              Pass Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.passRate.toFixed(0)}%</p>
            <p className="mt-1 text-xs text-gray-500">Results marked as passed</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Performance Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {performanceTrend.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={performanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-12 text-center text-sm text-gray-500">No result data available yet.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-600" />
              Subject Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subjectPerformance.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={subjectPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="subject" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Bar dataKey="score" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-12 text-center text-sm text-gray-500">No subject data available yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Exam Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by exam or subject..."
                className="pl-10"
              />
            </div>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-full md:w-[220px]">
                <SelectValue placeholder="Filter subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {resultsList.isLoading ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading results...</div>
          ) : filteredResults.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px]">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                    <th className="px-4 py-3 font-semibold">Exam</th>
                    <th className="px-4 py-3 font-semibold">Score</th>
                    <th className="px-4 py-3 font-semibold">Penalty</th>
                    <th className="px-4 py-3 font-semibold">Performance</th>
                    <th className="px-4 py-3 font-semibold">Certificate</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Published</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((result) => (
                    <tr key={result.id} className="border-b border-gray-100 align-top">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{result.exam.name}</p>
                          <p className="text-xs text-gray-500">{result.exam.subject_name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        <div>{formatResultNumber(result.score)} / {formatResultNumber(result.total_marks)}</div>
                        <div className="text-xs text-gray-500">Original: {formatResultNumber(result.original_score)}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{formatResultNumber(result.penalty_percent_applied)}%</td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <Progress value={toResultNumber(result.percentage)} className="h-2 w-28" />
                          <p className="text-xs text-gray-500">{formatResultNumber(result.percentage)}%</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{formatCertificateLevel(result.certificate_level)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2">
                          <StatusBadge status={result.publish_state} />
                          <Badge variant="outline">{result.result_status}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{formatResultDate(result.published_at)}</td>
                      <td className="px-4 py-4">
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/candidate/results/${result.id}`} state={{ result }}>
                            <Eye className="h-4 w-4" />
                            View
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-gray-500">No results matched the current filters.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
