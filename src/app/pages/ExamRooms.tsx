import { useMemo, useState } from "react";
import { Edit, MapPin, Plus, Search, Trash2, Users } from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
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
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { notify } from "../lib/notify";

interface ExamRoomRecord {
  id: number;
  name: string;
  location: string;
  capacity: number;
  features: string[];
  exams_count: number;
}

interface ExamRoomFormState {
  name: string;
  location: string;
  capacity: string;
  features_text: string;
}

const EMPTY_FORM: ExamRoomFormState = {
  name: "",
  location: "",
  capacity: "0",
  features_text: "",
};

const toFormState = (room: ExamRoomRecord): ExamRoomFormState => ({
  name: room.name,
  location: room.location,
  capacity: String(room.capacity),
  features_text: room.features.join(", "),
});

const normalizeFeatures = (value: string) =>
  Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

export function ExamRooms() {
  const [searchQuery, setSearchQuery] = useState("");
  const [usageFilter, setUsageFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ExamRoomRecord | null>(null);
  const [formState, setFormState] = useState<ExamRoomFormState>(EMPTY_FORM);

  const debouncedSearch = useDebouncedValue(searchQuery, 250);
  const mutation = useMutationState();

  const roomsList = useAsyncList(
    () =>
      apiRequest<PaginatedResponse<ExamRoomRecord>>("/api/v1/exam-rooms/", {
        query: {
          page_size: 100,
          search: debouncedSearch || undefined,
        },
      }),
    [debouncedSearch],
  );

  const rooms = roomsList.data?.results ?? [];
  const filteredRooms = useMemo(() => {
    if (usageFilter === "assigned") {
      return rooms.filter((room) => room.exams_count > 0);
    }
    if (usageFilter === "available") {
      return rooms.filter((room) => room.exams_count === 0);
    }
    return rooms;
  }, [rooms, usageFilter]);

  const stats = useMemo(
    () => ({
      total: rooms.length,
      totalCapacity: rooms.reduce((sum, room) => sum + room.capacity, 0),
      available: rooms.filter((room) => room.exams_count === 0).length,
      assigned: rooms.filter((room) => room.exams_count > 0).length,
    }),
    [rooms],
  );

  const openCreateDialog = () => {
    setEditingRoom(null);
    setFormState(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const openEditDialog = (room: ExamRoomRecord) => {
    setEditingRoom(room);
    setFormState(toFormState(room));
    setIsDialogOpen(true);
  };

  const closeDialog = (nextOpen: boolean) => {
    setIsDialogOpen(nextOpen);
    if (!nextOpen) {
      setEditingRoom(null);
      setFormState(EMPTY_FORM);
      mutation.setError(null);
    }
  };

  const saveRoom = async () => {
    if (!formState.name.trim()) {
      notify.error("Room name is required.");
      return;
    }

    const capacity = Number(formState.capacity);
    if (Number.isNaN(capacity) || capacity < 0) {
      notify.error("Capacity must be a valid non-negative number.");
      return;
    }

    await mutation.run(async () => {
      const payload = {
        name: formState.name.trim(),
        location: formState.location.trim(),
        capacity,
        features: normalizeFeatures(formState.features_text),
      };

      if (editingRoom) {
        await apiRequest(`/api/v1/exam-rooms/${editingRoom.id}/`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        await apiRequest("/api/v1/exam-rooms/", {
          method: "POST",
          body: payload,
        });
      }

      await roomsList.reload();
      closeDialog(false);
      notify.success(editingRoom ? "Exam room updated." : "Exam room created.");
    });
  };

  const deleteRoom = async (room: ExamRoomRecord) => {
    const confirmed = await notify.confirm({
      title: "Delete this room?",
      text: `Room "${room.name}" will be permanently removed.`,
      confirmText: "Delete Room",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) {
      return;
    }

    await mutation.run(async () => {
      await apiRequest(`/api/v1/exam-rooms/${room.id}/`, { method: "DELETE" });
      await roomsList.reload();
      notify.success("Exam room deleted.");
    });
  };

  return (
    <div>
      <PageHeader
        title="Exam Rooms"
        description="Manage reusable rooms that can be attached directly to exams."
        action={
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Add Room
          </Button>
        }
      />

      {(roomsList.error || mutation.error) ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {roomsList.error ?? mutation.error}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-blue-600" />
              Total Rooms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            <p className="mt-1 text-sm text-gray-600">Registered room records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-green-600" />
              Total Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.totalCapacity}</p>
            <p className="mt-1 text-sm text-gray-600">Seats across all rooms</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.available}</p>
            <p className="mt-1 text-sm text-gray-600">Rooms not yet linked to exams</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.assigned}</p>
            <p className="mt-1 text-sm text-gray-600">Referenced by one or more exams</p>
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
                placeholder="Search exam rooms..."
                className="pl-10"
              />
            </div>
            <Select value={usageFilter} onValueChange={setUsageFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter usage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rooms</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roomsList.isLoading ? (
              <Card className="md:col-span-2 xl:col-span-3">
                <CardContent className="py-16 text-center text-sm text-gray-500">Loading exam rooms...</CardContent>
              </Card>
            ) : filteredRooms.length ? (
              filteredRooms.map((room) => (
                <Card key={room.id} className="border border-gray-200 shadow-none">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900">{room.name}</h3>
                        <p className="mt-1 text-sm text-gray-600">{room.location || "No location provided."}</p>
                      </div>
                      <Badge variant="outline">{room.exams_count > 0 ? "Assigned" : "Available"}</Badge>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                      <p className="font-medium text-gray-900">Capacity {room.capacity}</p>
                      <p className="mt-1">Linked to {room.exams_count} exam(s)</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {room.features.length ? (
                        room.features.map((feature) => (
                          <Badge key={feature} variant="outline">
                            {feature}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No features listed.</p>
                      )}
                    </div>

                    <div className="flex gap-2 border-t border-gray-200 pt-4">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(room)}>
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void deleteRoom(room)} disabled={mutation.isSubmitting}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="md:col-span-2 xl:col-span-3">
                <CardContent className="py-16 text-center text-sm text-gray-500">No exam rooms matched the current filters.</CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRoom ? "Edit Exam Room" : "Create Exam Room"}</DialogTitle>
            <DialogDescription>Register a room and list the features that matter for scheduling.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="room-name">Room Name</Label>
              <Input
                id="room-name"
                className="mt-2"
                value={formState.name}
                onChange={(event) => setFormState((previous) => ({ ...previous, name: event.target.value }))}
                placeholder="e.g. Main Hall A"
              />
            </div>
            <div>
              <Label htmlFor="room-location">Location</Label>
              <Input
                id="room-location"
                className="mt-2"
                value={formState.location}
                onChange={(event) => setFormState((previous) => ({ ...previous, location: event.target.value }))}
                placeholder="Building, floor, or virtual room label"
              />
            </div>
            <div>
              <Label htmlFor="room-capacity">Capacity</Label>
              <Input
                id="room-capacity"
                type="number"
                className="mt-2"
                value={formState.capacity}
                onChange={(event) => setFormState((previous) => ({ ...previous, capacity: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="room-features">Features</Label>
              <Input
                id="room-features"
                className="mt-2"
                value={formState.features_text}
                onChange={(event) => setFormState((previous) => ({ ...previous, features_text: event.target.value }))}
                placeholder="wifi, projector, computers"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveRoom()} disabled={mutation.isSubmitting}>
              {mutation.isSubmitting
                ? editingRoom
                  ? "Saving..."
                  : "Creating..."
                : editingRoom
                  ? "Save Changes"
                  : "Create Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
