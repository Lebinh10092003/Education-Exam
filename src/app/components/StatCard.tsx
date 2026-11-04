import { LucideIcon } from "lucide-react";

import { Card, CardContent } from "./ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
    /** neutral: chi la thong tin (khong phai xu huong tang/giam) -> chu xam, khong mui ten. */
    tone?: "positive" | "negative" | "neutral";
  };
  iconBgColor?: string;
  iconColor?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  iconBgColor = "bg-blue-100 dark:bg-blue-500/12",
  iconColor = "text-blue-600 dark:text-blue-300",
}: StatCardProps) {
  return (
    <Card className="relative overflow-hidden shadow-sm transition-shadow hover:shadow-md dark:shadow-[0_18px_38px_rgba(2,6,23,0.22)]">
      {/* Vach mau thuong hieu tren dau the. */}
      <span aria-hidden="true" className="brand-gradient absolute inset-x-0 top-0 h-1" />
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-foreground">{value}</p>
            {trend ? (
              <p
                className={`mt-2 text-sm ${
                  (trend.tone ?? (trend.isPositive ? "positive" : "negative")) === "neutral"
                    ? "text-muted-foreground"
                    : trend.isPositive
                      ? "text-green-600 dark:text-green-300"
                      : "text-red-600 dark:text-red-300"
                }`}
              >
                {trend.tone === "neutral" ? null : (
                  <>
                    <span aria-hidden="true">{trend.isPositive ? "\u2191" : "\u2193"}</span>{" "}
                  </>
                )}
                <span>{trend.value}</span>
              </p>
            ) : null}
          </div>
          <div className={`${iconBgColor} ${iconColor} shrink-0 rounded-lg p-3.5`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
