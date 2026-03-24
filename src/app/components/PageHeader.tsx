import { Button } from "./ui/button";
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-8 border-b border-border/70 pb-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">{action}</div>}
      </div>
    </div>
  );
}
