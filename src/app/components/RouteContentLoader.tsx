interface RouteContentLoaderProps {
  fullHeight?: boolean;
}

export function RouteContentLoader({ fullHeight = false }: RouteContentLoaderProps) {
  return (
    <div
      className={
        fullHeight
          ? "flex min-h-screen items-center justify-center bg-gray-50 px-6"
          : "flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white px-6"
      }
    >
      <p className="text-sm text-gray-500">Loading page...</p>
    </div>
  );
}
