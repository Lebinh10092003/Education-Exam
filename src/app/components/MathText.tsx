import type { ReactNode } from "react";

interface MathTextProps {
  text: string;
  className?: string;
}

type Segment = {
  kind: "text" | "math";
  value: string;
};

const MATH_PATTERN = /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;

const stripMathDelimiters = (value: string) => {
  if (
    (value.startsWith("$$") && value.endsWith("$$")) ||
    (value.startsWith("\\[") && value.endsWith("\\]"))
  ) {
    return value.slice(2, -2).trim();
  }
  if (value.startsWith("\\(") && value.endsWith("\\)")) {
    return value.slice(2, -2).trim();
  }
  if (value.startsWith("$") && value.endsWith("$")) {
    return value.slice(1, -1).trim();
  }
  return value;
};

const splitMathSegments = (text: string): Segment[] => {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MATH_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ kind: "text", value: text.slice(lastIndex, index) });
    }
    segments.push({ kind: "math", value: stripMathDelimiters(match[0]) });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: "text", value: text.slice(lastIndex) });
  }

  return segments.length ? segments : [{ kind: "text", value: text }];
};

export function MathText({ text, className }: MathTextProps) {
  const segments = splitMathSegments(text || "");

  return (
    <span className={className}>
      {segments.map((segment, index): ReactNode =>
        segment.kind === "math" ? (
          <span
            key={`${segment.kind}-${index}`}
            className="mx-0.5 inline rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.95em] text-slate-950"
          >
            {segment.value}
          </span>
        ) : (
          <span key={`${segment.kind}-${index}`}>{segment.value}</span>
        ),
      )}
    </span>
  );
}
