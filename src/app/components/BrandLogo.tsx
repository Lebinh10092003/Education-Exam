import { cn } from "./ui/utils";

type BrandLogoProps = {
  /** full: logo chu FermatTech (ngang); mark: bieu tuong vuong (sidebar thu gon, khong gian hep). */
  variant?: "full" | "mark";
  /** Nhan phu ben canh logo, vd. "Competitions", "EduExam", "Cong thi sinh". */
  subtitle?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  subtitleClassName?: string;
};

// Logo goc 159x60 (ty le ~2.65:1): luon dat chieu cao, de chieu rong tu dong theo ty le.
const FULL_HEIGHT = { sm: "h-7", md: "h-9 sm:h-10", lg: "h-12" } as const;
const MARK_SIZE = { sm: "h-8 w-8", md: "h-9 w-9", lg: "h-11 w-11" } as const;

export function BrandLogo({ variant = "full", subtitle, size = "md", className, subtitleClassName }: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <img
        src="/fermat-mark.svg"
        alt="FermatTech"
        className={cn("shrink-0 rounded-xl shadow-sm ring-1 ring-slate-200 dark:ring-white/10", MARK_SIZE[size], className)}
      />
    );
  }

  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)}>
      {/* Logo mau navy: tren nen toi can nen trang de khong bi chim. */}
      <span className="shrink-0 rounded-lg dark:bg-white dark:px-2 dark:py-1">
        <img
          src="/fermat-logo.png"
          alt="FermatTech"
          width={159}
          height={60}
          className={cn("block w-auto object-contain", FULL_HEIGHT[size])}
        />
      </span>
      {subtitle ? (
        <span
          className={cn(
            "shrink-0 whitespace-nowrap border-l border-slate-200 pl-3 text-[11px] font-semibold uppercase leading-tight tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:text-slate-400",
            subtitleClassName,
          )}
        >
          {subtitle}
        </span>
      ) : null}
    </span>
  );
}
