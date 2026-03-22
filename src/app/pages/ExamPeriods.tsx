import { useMemo, useState } from "react";
import { CalendarRange, Edit, Plus, Search, Trash2 } from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { notify } from "../lib/notify";

interface ExamPeriodRecord {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: "upcoming" | "open" | "closed";
  exams_count: number;
}

interface ExamPeriodFormState {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
}

const EMPTY_FORM: ExamPeriodFormState = {
  name: "",
  description: "",
  start_date: "",
  end_date: "",
};

const toFormState = (period: ExamPeriodRecord): ExamPeriodFormState => ({
  name: period.name,
  description: period.description,
  start_date: period.start_date,
  end_date: period.end_date,
});

export function ExamPeriods() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<ExamPeriodRecord | null>(null);
  const [formState, setFormState] = useState<ExamPeriodFormState>(EMPTY_FORM);

  const debouncedSearch = useDebouncedValue(searchQuery, 250);
  const mutation = useMutationState();

  const periodsList = useAsyncList(
    () =>
      apiRequest<PaginatedResponse<ExamPeriodRecord>>("/api/v1/exam-periods/", {
        query: {
          page_size: 100,
          search: debouncedSearch || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
        },
      }),
    [debouncedSearch, statusFilter],
  );

  const periods = periodsList.data?.results ?? [];
  const stats = useMemo(
    () => ({
      total: periods.length,
      upcoming: periods.filter((period) => period.status === "upcoming").length,
      active: periods.filter((period) => period.status === "open").length,
      closed: periods.filter((period) => period.status === "closed").length,
    }),
    [periods],
  );

  const openCreateDialog = () => {
    setEditingPeriod(null);
    setFormState(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const openEditDialog = (period: ExamPeriodRecord) => {
    setEditingPeriod(period);
    setFormState(toFormState(period));
    setIsDialogOpen(true);
  };

  const closeDialog = (nextOpen: boolean) => {
    setIsDialogOpen(nextOpen);
    if (!nextOpen) {
      setEditingPeriod(null);
      setFormState(EMPTY_FORM);
      mutation.setError(null);
    }
  };

  const savePeriod = async () => {
    if (!formState.name.trim()) {
      notify.error("Period name is required.");
      return;
    }

    if (!formState.start_date || !formState.end_date) {
      notify.error("Start date and end date are required.");
      return;
    }

    if (formState.end_date < formState.start_date) {
      notify.error("End date must be after start date.");
      return;
    }

    await mutation.run(async () => {
      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim(),
        start_date: formState.start_date,
        end_date: formState.end_date,
      };

      if (editingPeriod) {
        await apiRequest(`/api/v1/exam-periods/${editingPeriod.id}/`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        await apiRequest("/api/v1/exam-periods/", {
          method: "POST",
          body: payload,
        });
      }

      await periodsList.reload();
      closeDialog(false);
      notify.success(editingPeriod ? "Exam period updated." : "Exam period created.");
    });
  };

  const deletePeriod = async (period: ExamPeriodRecord) => {
    const confirmed = await notify.confirm({
      title: "Delete this exam period?",
      text: `Period "${period.name}" will be permanently removed.`,
      confirmText: "Delete Period",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) {
      return;
    }

    await mutation.run(async () => {
      await apiRequest(`/api/v1/exam-periods/${period.id}/`, { method: "DELETE" });
      await periodsList.reload();
      notify.success("Exam period deleted.");
    });
  };

  return (
    <div>
      <PageHeader
        title="Exam Periods"
        description="Manage reusable exam windows and group scheduling periods."
        action={
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Create Period
          </Button>
        }
      />

      {(periodsList.error || mutation.error) ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {periodsList.error ?? mutation.error}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarRange className="h-4 w-4 text-blue-600" />
              Total Periods
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            <p className="mt-1 text-sm text-gray-600">Configured scheduling buckets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.upcoming}</p>
            <p className="mt-1 text-sm text-gray-600">Periods that have not started</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.active}</p>
            <p className="mt-1 text-sm text-gray-600">Periods currently in range</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.closed}</p>
            <p className="mt-1 text-sm text-gray-600">Completed scheduling periods</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search exam periods..."
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="open">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {periodsList.isLoading ? (
              <Card className="md:col-span-2">
                <CardContent className="py-16 text-center text-sm text-gray-500">Loading exam periods...</CardContent>
              </Card>
            ) : periods.length ? (
              periods.map((period) => (
                <Card key={period.id} className="border border-gray-200 shadow-none">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900">{period.name}</h3>
                        <p className="mt-1 text-sm text-gray-600">
                          {period.description || "No description provided."}
                        </p>
                      </div>
                      <StatusBadge status={period.status} />
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-medium text-gray-900">
                        {period.start_date} to {period.end_date}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">Used by {period.exams_count} exam(s)</p>
                    </div>

                    <div className="flex gap-2 border-t border-gray-200 pt-4">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(period)}>
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void deletePeriod(period)} disabled={mutation.isSubmitting}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="md:col-span-2">
                <CardContent className="py-16 text-center text-sm text-gray-500">No exam periods matched the current filters.</CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPeriod ? "Edit Exam Period" : "Create Exam Period"}</DialogTitle>
            <DialogDescription>Define a reusable exam window that can be attached to exams.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="period-name">Period Name</Label>
              <Input
                id="period-name"
                className="mt-2"
                value={formState.name}
                onChange={(event) => setFormState((previous) => ({ ...previous, name: event.target.value }))}
                placeholder="e.g. Spring Finals 2026"
              />
            </div>
            <div>
              <Label htmlFor="period-description">Description</Label>
              <Textarea
                id="period-description"
                className="mt-2"
                rows={3}
                value={formState.description}
                onChange={(event) => setFormState((previous) => ({ ...previous, description: event.target.value }))}
                placeholder="What this period is used for"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="period-start">Start Date</Label>
                <Input
                  id="period-start"
                  type="date"
                  className="mt-2"
                  value={formState.start_date}
                  onChange={(event) => setFormState((previous) => ({ ...previous, start_date: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="period-end">End Date</Label>
                <Input
                  id="period-end"
                  type="date"
                  className="mt-2"
                  value={formState.end_date}
                  onChange={(event) => setFormState((previous) => ({ ...previous, end_date: event.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => void savePeriod()} disabled={mutation.isSubmitting}>
              {mutation.isSubmitting
                ? editingPeriod
                  ? "Saving..."
                  : "Creating..."
                : editingPeriod
                  ? "Save Changes"
                  : "Create Period"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
