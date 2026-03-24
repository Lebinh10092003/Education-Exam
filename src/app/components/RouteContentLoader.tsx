interface RouteContentLoaderProps {
  fullHeight?: boolean;
}

export function RouteContentLoader({ fullHeight = false }: RouteContentLoaderProps) {
  return (
    <div
      className={
        fullHeight
          ? "flex min-h-screen items-center justify-center bg-background px-6"
          : "flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/80 px-6 shadow-sm"
      }
    >
      <p className="text-sm text-muted-foreground">Loading page...</p>
    </div>
  );
}
