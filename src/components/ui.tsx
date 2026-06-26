/** Composants UI partagés — sobres, lisibles, zéro décoratif. */
import clsx from "clsx";
import type { ReactNode } from "react";
import type { Tone } from "@/lib/labels";

export const FIELD_LABEL_CLASS = "mb-1 block text-xs font-medium text-ink-700";
export const FIELD_INPUT_CLASS =
  "w-full min-h-11 rounded-lg border border-ink-300 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-500 focus:border-scaly-700 focus:outline-none focus:ring-2 focus:ring-scaly-200 disabled:bg-ink-50 disabled:text-ink-500";

const TONES: Record<Tone, string> = {
  slate: "bg-ink-100 text-ink-700 ring-ink-200",
  teal: "bg-scaly-50 text-scaly-700 ring-scaly-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
};

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", TONES[tone])}>
      {children}
    </span>
  );
}

export function Card({ title, subtitle, children, className, action }: { title?: string; subtitle?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={clsx("min-w-0 rounded-xl border border-ink-200 bg-white shadow-sm", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-4 py-3 sm:flex-nowrap sm:px-5">
          <div className="min-w-0 flex-1 basis-48">
            {title && <h2 className="text-sm font-semibold text-ink-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className="min-w-0 px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone = "slate" }: { label: string; value: string; sub?: string; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink-900">{value}</p>
      {sub && <p className={clsx("mt-0.5 text-xs", tone === "rose" ? "text-rose-600" : tone === "emerald" ? "text-emerald-600" : "text-ink-500")}>{sub}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-600">{subtitle}</p>}
      </div>
      {children && <div className="min-w-0 max-w-full">{children}</div>}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-ink-600">{text}</p>;
}

export function HonestyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {children}
    </p>
  );
}

export function FormNotice({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "error" | "info" }) {
  const classes =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : tone === "info"
        ? "border-sky-200 bg-sky-50 text-sky-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <p
      className={clsx("rounded-lg border px-3 py-2 text-sm", classes)}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      {children}
    </p>
  );
}
