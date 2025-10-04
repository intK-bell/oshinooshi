"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";

interface HintTooltipProps {
  label: string;
  children: ReactNode;
}

export function HintTooltip({ label, children }: HintTooltipProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-describedby={open ? tooltipId : undefined}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-white text-[10px] font-semibold text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-2)]"
        onClick={() => setOpen((prev) => !prev)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      {open && (
        <div
          role="tooltip"
          id={tooltipId}
          className="absolute left-1/2 top-full z-10 mt-2 w-56 -translate-x-1/2 rounded-lg border border-[color:var(--color-border)] bg-white p-3 text-[11px] text-[color:var(--color-fg-muted)] shadow-md"
        >
          <p className="text-xs font-semibold text-[#0b1f33]">{label}</p>
          <div className="mt-1 text-[11px] leading-relaxed">{children}</div>
        </div>
      )}
    </span>
  );
}
