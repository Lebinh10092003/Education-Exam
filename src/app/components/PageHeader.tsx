import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 gap-3">
          {/* Vach nhan mau thuong hieu ben trai tieu de. */}
          <span aria-hidden="true" className="brand-gradient mt-1 w-1 shrink-0 self-stretch rounded-full" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-foreground sm:text-[1.75rem]">{title}</h1>
            {description && (
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500 dark:text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">{action}</div>}
      </div>
    </div>
  );
}
