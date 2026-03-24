import { Badge } from "./ui/badge";

type StatusValue = string;

interface StatusBadgeProps {
  status: StatusValue;
}

const statusConfig = {
  // Exam statuses
  draft: { label: "Draft", className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
  upcoming: { label: "Upcoming", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  open: { label: "Open", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  paused: { label: "Paused", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
  closed: { label: "Closed", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  archived: { label: "Archived", className: "bg-gray-100 text-gray-600 hover:bg-gray-100" },
  
  // User statuses
  active: { label: "Active", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  locked: { label: "Locked", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
  pending_grading: { label: "Pending Grading", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
  finalized: { label: "Finalized", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  
  // Exam attempt statuses
  "in-progress": { label: "In Progress", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  pass: { label: "Pass", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  passed: { label: "Passed", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  fail: { label: "Fail", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  submitted: { label: "Submitted", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  expired: { label: "Expired", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  terminated: { label: "Terminated", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  not_started: { label: "Not Started", className: "bg-gray-100 text-gray-700 hover:bg-gray-100" },
  published: { label: "Published", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  resolved: { label: "Resolved", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  dismissed: { label: "Dismissed", className: "bg-gray-100 text-gray-700 hover:bg-gray-100" },
  warning: { label: "Warning", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
  critical: { label: "Critical", className: "bg-red-100 text-red-800 hover:bg-red-100" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalizedStatus = status.trim().toLowerCase().replaceAll("-", "_").replace(/\s+/g, "_");
  const config =
    statusConfig[normalizedStatus as keyof typeof statusConfig] ??
    statusConfig[status as keyof typeof statusConfig] ??
    {
      label: status
        .split(/[_-\s]/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
      className: "bg-gray-100 text-gray-700 hover:bg-gray-100",
    };

  return (
    <Badge className={config.className}>
      {config.label}
    </Badge>
  );
}
