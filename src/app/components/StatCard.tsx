import { LucideIcon } from "lucide-react";

import { Card, CardContent } from "./ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  iconBgColor?: string;
  iconColor?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  iconBgColor = "bg-blue-100",
  iconColor = "text-blue-600",
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="mb-1 text-sm text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {trend ? (
              <p className={`mt-2 text-sm ${trend.isPositive ? "text-green-600" : "text-red-600"}`}>
                <span aria-hidden="true">{trend.isPositive ? "\u2191" : "\u2193"}</span>{" "}
                <span>{trend.value}</span>
              </p>
            ) : null}
          </div>
          <div className={`${iconBgColor} ${iconColor} rounded-xl p-4`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
