import { Badge } from "./ui/badge";

type ExamStatus = "draft" | "scheduled" | "open" | "paused" | "closed" | "archived";
type UserStatus = "active" | "locked" | "pending";
type ExamAttemptStatus = "pending" | "in-progress" | "completed" | "failed";

interface StatusBadgeProps {
  status: ExamStatus | UserStatus | ExamAttemptStatus;
}

const statusConfig = {
  // Exam statuses
  draft: { label: "Draft", className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  open: { label: "Open", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  paused: { label: "Paused", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
  closed: { label: "Closed", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  archived: { label: "Archived", className: "bg-gray-100 text-gray-600 hover:bg-gray-100" },
  
  // User statuses
  active: { label: "Active", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  locked: { label: "Locked", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
  
  // Exam attempt statuses
  "in-progress": { label: "In Progress", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800 hover:bg-red-100" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge className={config.className}>
      {config.label}
    </Badge>
  );
}
