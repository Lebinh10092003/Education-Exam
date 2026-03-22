import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  MapPin,
  Users,
  Monitor,
  Wifi,
  Camera,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";

const examRooms = [
  {
    id: 1,
    name: "Main Hall A",
    location: "Building 1, Floor 2",
    capacity: 100,
    features: ["computers", "projector", "wifi", "proctoring"],
    status: "available" as const,
    currentExam: null,
    occupancy: 0,
  },
  {
    id: 2,
    name: "Computer Lab 1",
    location: "Building 2, Floor 1",
    capacity: 50,
    features: ["computers", "wifi", "proctoring"],
    status: "occupied" as const,
    currentExam: "Mathematics Final",
    occupancy: 45,
  },
  {
    id: 3,
    name: "Lecture Room B",
    location: "Building 1, Floor 3",
    capacity: 75,
    features: ["projector", "wifi"],
    status: "available" as const,
    currentExam: null,
    occupancy: 0,
  },
  {
    id: 4,
    name: "Computer Lab 2",
    location: "Building 2, Floor 2",
    capacity: 50,
    features: ["computers", "wifi", "proctoring"],
    status: "maintenance" as const,
    currentExam: null,
    occupancy: 0,
  },
  {
    id: 5,
    name: "Conference Room C",
    location: "Building 3, Floor 1",
    capacity: 30,
    features: ["projector", "wifi", "whiteboard"],
    status: "occupied" as const,
    currentExam: "Physics Lab Test",
    occupancy: 28,
  },
];

const featureIcons: Record<string, any> = {
  computers: Monitor,
  projector: Monitor,
  wifi: Wifi,
  proctoring: Camera,
  whiteboard: Edit,
};

export function ExamRooms() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const stats = {
    total: examRooms.length,
    available: examRooms.filter((r) => r.status === "available").length,
    occupied: examRooms.filter((r) => r.status === "occupied").length,
    totalCapacity: examRooms.reduce((sum, r) => sum + r.capacity, 0),
  };

  return (
    <div>
      <PageHeader
        title="Exam Rooms"
        description="Manage physical and virtual examination rooms"
        action={
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Room
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Exam Room</DialogTitle>
                <DialogDescription>
                  Register a new examination room
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="room-name">Room Name</Label>
                  <Input
                    id="room-name"
                    placeholder="e.g., Main Hall A"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="room-location">Location</Label>
                  <Input
                    id="room-location"
                    placeholder="e.g., Building 1, Floor 2"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="room-capacity">Capacity</Label>
                  <Input
                    id="room-capacity"
                    type="number"
                    placeholder="Maximum number of candidates"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label className="mb-3 block">Features & Equipment</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox id="feature-computers" />
                      <Label htmlFor="feature-computers" className="cursor-pointer">
                        Computers
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="feature-projector" />
                      <Label htmlFor="feature-projector" className="cursor-pointer">
                        Projector
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="feature-wifi" />
                      <Label htmlFor="feature-wifi" className="cursor-pointer">
                        WiFi
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="feature-proctoring" />
                      <Label htmlFor="feature-proctoring" className="cursor-pointer">
                        Proctoring System
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="feature-whiteboard" />
                      <Label htmlFor="feature-whiteboard" className="cursor-pointer">
                        Whiteboard
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Add Room</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              Total Rooms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-600 mt-1">Registered rooms</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-green-600" />
              Total Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.totalCapacity}</p>
            <p className="text-sm text-gray-600 mt-1">Maximum candidates</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="w-4 h-4 text-blue-600" />
              Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.available}</p>
            <p className="text-sm text-gray-600 mt-1">Ready for use</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="w-4 h-4 text-orange-600" />
              In Use
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.occupied}</p>
            <p className="text-sm text-gray-600 mt-1">Currently occupied</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search exam rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rooms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {examRooms.map((room) => (
              <Card key={room.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {room.name}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <MapPin className="w-3 h-3" />
                        <span>{room.location}</span>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        room.status === "available"
                          ? "border-green-300 text-green-700"
                          : room.status === "occupied"
                          ? "border-orange-300 text-orange-700"
                          : "border-gray-300 text-gray-700"
                      }
                    >
                      {room.status}
                    </Badge>
                  </div>

                  {room.currentExam && (
                    <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-xs text-orange-700 font-medium">
                        Current Exam
                      </p>
                      <p className="text-sm text-orange-900 mt-1">
                        {room.currentExam}
                      </p>
                      <p className="text-xs text-orange-600 mt-1">
                        {room.occupancy} / {room.capacity} candidates
                      </p>
                    </div>
                  )}

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900 font-medium">
                        Capacity: {room.capacity}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-2">Features:</p>
                      <div className="flex flex-wrap gap-1">
                        {room.features.map((feature) => {
                          const FeatureIcon = featureIcons[feature] || Monitor;
                          return (
                            <Badge
                              key={feature}
                              variant="outline"
                              className="text-xs flex items-center gap-1"
                            >
                              <FeatureIcon className="w-3 h-3" />
                              {feature}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-gray-600">
              Showing <strong>1-5</strong> of <strong>5</strong> exam rooms
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm">
                1
              </Button>
              <Button variant="outline" size="sm">
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
