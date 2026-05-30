import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { calcPPM } from "@/lib/idf-calc";
import type { IDFRow } from "@/lib/types";
import { ArrowDown, ArrowRight, ArrowUp, BarChart3, CalendarDays, Printer, ScanSearch, Target } from "lucide-react";
import { useFilters } from "@/hooks/use-dashboard";
import frasleLogo from "@/assets/print/frasle-mobility.png";
import randoncorpLogo from "@/assets/print/randoncorp.png";

const PRINT_ACCENT_KEY = "print-accent-color";
const DEFAULT_PRINT_ACCENT = "#FFC20E";
const PRINT_ACCENT_PRESETS = [
  { label: "Amarelo Frasle", value: "#FFC20E" },
  { label: "Azul Corporativo", value: "#1e3a8a" },
  { label: "Verde Qualidade", value: "#10b981" },
  { label: "Vermelho Alerta", value: "#dc2626" },
  { label: "Cinza Neutro", value: "#475569" },
  { label: "Preto", value: "#0f172a" },
];

function applyPrintAccent(color: string) {
  document.documentElement.style.setProperty("--print-accent", color);
}


function formatPeriodLabel(from: string, to: string): string {
  const fmt = (s: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  };
  const f = fmt(from);
  const t = fmt(to);
  if (f && t) return `${f} a ${t}`;
  if (f) return `a partir de ${f}`;
  if (t) return `até ${t}`;
  return "Período completo (sem filtro de data)";
}

async function triggerPrint(el: HTMLElement | null) {
  if (!el) return;
  // Dispensa qualquer tooltip/hover ativo antes de imprimir.
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  // Move o mouse fora da área (sintético) para forçar saída de hover/tooltip.
  el.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
  document.body.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 0, clientY: 0 }));

  const preload = (src: string) =>
    new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });
  await Promise.all([preload(frasleLogo), preload(randoncorpLogo)]);

  el.setAttribute("data-print-target", "true");
  document.documentElement.classList.add("printing-section");
  const cleanup = () => {
    el.removeAttribute("data-print-target");
    document.documentElement.classList.remove("printing-section");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  // Aguarda 2 frames + 350ms para que o Recharts re-renderize sem animação
  // (animation/transition foram desligadas pelo CSS .printing-section).
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  setTimeout(() => window.print(), 350);
}


export function DeltaBadge({
  current,
  previous,
  invert = false,
}: {
  current: number;
  previous: number;
  invert?: boolean; // true = subir é ruim (alertas, NCs)
}) {
  if (previous === 0 && current === 0) {
    return <span className="text-[11px] text-slate-500">sem variação</span>;
  }
  if (previous === 0) {
    return <span className="text-[11px] text-sky-400 font-medium">novo período</span>;
  }
  const pct = ((current - previous) / previous) * 100;
  const up = pct > 0.05;
  const down = pct < -0.05;
  const good = invert ? down : up;
  const bad = invert ? up : down;
  const color = !up && !down ? "text-slate-400" : good ? "text-emerald-400" : bad ? "text-red-400" : "text-slate-400";
  const Icon = up ? ArrowUp : down ? ArrowDown : ArrowRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums", color)}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct).toFixed(1)}%
      <span className="text-slate-500 font-normal ml-1">vs {previous.toLocaleString("pt-BR")}</span>
    </span>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
  delta,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
  icon?: ReactNode;
  delta?: ReactNode;
}) {
  const accent: Record<string, string> = {
    default: "text-slate-100",
    success: "text-emerald-400",
    warning: "text-amber-400",
    destructive: "text-red-400",
    info: "text-sky-400",
  };
  const dot: Record<string, string> = {
    default: "bg-slate-400",
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    destructive: "bg-red-400",
    info: "bg-sky-400",
  };
  return (
    <div className="card-premium group relative rounded-xl border border-white/10 bg-[#0f172a] dark:bg-[#0b1220] p-4 overflow-hidden shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-12px_rgba(56,189,248,0.35)] hover:border-white/20 flex flex-col min-h-[152px]">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-start justify-between gap-2 min-h-[28px]">
        <div className="text-[12px] uppercase tracking-wider text-slate-300/90 font-semibold flex items-center gap-2 leading-tight min-w-0">
          <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", dot[tone])} />
          <span className="truncate">{label}</span>
        </div>
        {icon && (
          <div className={cn("opacity-90 h-7 w-7 rounded-lg flex items-center justify-center bg-white/5 shrink-0", accent[tone])}>
            {icon}
          </div>
        )}
      </div>
      <div
        className={cn("mt-3 font-display font-bold tabular-nums tracking-tight leading-none truncate", accent[tone])}
        style={{ fontSize: "clamp(1.875rem, 2.6vw, 2.625rem)" }}
      >
        {value}
      </div>
      {hint && <div className="mt-1.5 text-[12px] text-slate-400 line-clamp-2">{hint}</div>}
      {delta && <div className="mt-auto pt-2">{delta}</div>}
    </div>
  );
}


export function PpmCard({ idf, previous }: { idf: IDFRow[]; previous?: IDFRow[] | null }) {
  const { ppm, ncQt, totalQt } = calcPPM(idf);
  const prev = previous ? calcPPM(previous) : null;
  return (
    <div className="card-premium relative rounded-xl border border-white/10 bg-[#0f172a] dark:bg-[#0b1220] p-4 overflow-hidden shadow-sm flex flex-col min-h-[152px]">
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-chart-ppm)" }} />
          PPM
        </div>
        <Target className="h-4 w-4" style={{ color: "var(--color-chart-ppm)" }} />
      </div>
      <div className="mt-2 text-3xl font-display font-bold tabular-nums" style={{ color: "var(--color-chart-ppm)" }}>
        {ppm.toLocaleString("pt-BR")}
      </div>
      <div className="mt-1 text-xs text-slate-400">
        {ncQt.toLocaleString("pt-BR")} NC / {totalQt.toLocaleString("pt-BR")} insp.
      </div>
      {prev && (
        <div className="mt-2">
          <DeltaBadge current={ppm} previous={prev.ppm} invert />
        </div>
      )}
    </div>
  );
}

export function EficienciaInspecaoCard({
  recebidos,
  inspecionados,
  pendentes,
  meta = 95,
  onClick,
  previousPct,
}: {
  recebidos: number;
  inspecionados: number;
  pendentes?: number;
  meta?: number;
  onClick?: () => void;
  previousPct?: number | null;
}) {
  const pct = recebidos > 0 ? (inspecionados / recebidos) * 100 : 0;
  const pctRounded = Math.round(pct * 10) / 10;
  const pend = pendentes ?? Math.max(0, recebidos - inspecionados);
  const tone =
    pct >= 95 ? { text: "text-emerald-400", dot: "bg-emerald-400", ring: "ring-emerald-400/30", glow: "from-emerald-500/15" } :
    pct >= 85 ? { text: "text-amber-400", dot: "bg-amber-400", ring: "ring-amber-400/30", glow: "from-amber-500/15" } :
                { text: "text-red-400", dot: "bg-red-400", ring: "ring-red-400/30", glow: "from-red-500/15" };
  const gap = pctRounded - meta;
  const trend = previousPct == null
    ? null
    : pctRounded > previousPct + 0.05
    ? { Icon: ArrowUp, color: "text-emerald-400" }
    : pctRounded < previousPct - 0.05
    ? { Icon: ArrowDown, color: "text-red-400" }
    : { Icon: ArrowRight, color: "text-slate-400" };

  const tooltip = `Eficiência = (Inspeções Finalizadas ÷ SKUs Recebidos) × 100\n${inspecionados.toLocaleString("pt-BR")} ÷ ${recebidos.toLocaleString("pt-BR")} × 100 = ${pctRounded.toFixed(1)}%\nPendentes: ${pend.toLocaleString("pt-BR")}`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      className={cn(
        "card-premium group relative text-left rounded-xl border border-white/10 bg-[#0f172a] dark:bg-[#0b1220] p-4 overflow-hidden shadow-sm ring-1 transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer w-full flex flex-col min-h-[152px]",
        tone.ring,
      )}
    >

      <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent opacity-60 pointer-events-none", tone.glow)} />
      <div className="relative flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium flex items-center gap-2">
          <span className={cn("inline-block h-1.5 w-1.5 rounded-full animate-pulse", tone.dot)} />
          Eficiência de Inspeção
        </div>
        <ScanSearch className={cn("h-4 w-4 opacity-80", tone.text)} />
      </div>
      <div className="relative mt-2 flex items-baseline gap-2">
        <span
          key={pctRounded}
          className={cn("text-3xl font-display font-bold tabular-nums animate-fade-in", tone.text)}
        >
          {pctRounded.toFixed(1)}%
        </span>
        {trend && <trend.Icon className={cn("h-4 w-4", trend.color)} />}
      </div>
      <div className="relative mt-2 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", tone.dot)}
          style={{ width: `${Math.min(100, Math.max(0, pctRounded))}%` }}
        />
      </div>
      <div className="relative mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
        <div>
          <div className="text-slate-500">Recebidos</div>
          <div className="text-slate-200 font-semibold tabular-nums">{recebidos.toLocaleString("pt-BR")}</div>
        </div>
        <div>
          <div className="text-slate-500">Inspec.</div>
          <div className="text-slate-200 font-semibold tabular-nums">{inspecionados.toLocaleString("pt-BR")}</div>
        </div>
        <div>
          <div className="text-slate-500">Pendentes</div>
          <div className={cn("font-semibold tabular-nums", pend > 0 ? "text-amber-400" : "text-slate-200")}>{pend.toLocaleString("pt-BR")}</div>
        </div>
      </div>
      <div className="relative mt-2 text-[11px] flex items-center gap-1">
        <span className="text-slate-500">Meta {meta}%:</span>
        <span className={cn("font-semibold tabular-nums", gap >= 0 ? "text-emerald-400" : "text-red-400")}>
          {gap >= 0 ? "+" : ""}{gap.toFixed(1)} p.p.
        </span>
      </div>
    </button>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className,
  printable = false,
  printTitle,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  printable?: boolean;
  printTitle?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [accent, setAccent] = useState<string>(DEFAULT_PRINT_ACCENT);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(PRINT_ACCENT_KEY) : null;
    const initial = stored ?? DEFAULT_PRINT_ACCENT;
    setAccent(initial);
    applyPrintAccent(initial);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const updateAccent = (c: string) => {
    setAccent(c);
    applyPrintAccent(c);
    try { window.localStorage.setItem(PRINT_ACCENT_KEY, c); } catch { /* ignore */ }
  };
  const handlePrint = () => {
    setOpen(false);
    triggerPrint(ref.current);
  };

  let filters: ReturnType<typeof useFilters>["filters"] | null = null;
  try {
    filters = useFilters().filters;
  } catch {
    filters = null;
  }
  const periodo = filters ? formatPeriodLabel(filters.from, filters.to) : "";
  const headingText = printTitle ?? (typeof title === "string" ? title : "Indicador");

  return (
    <section ref={ref} className={cn("section-premium rounded-xl border bg-card", className)}>
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-display font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          {action}
          {printable && (
            <div ref={popRef} className="no-print relative">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                title="Imprimir este card (A4 paisagem)"
                aria-label="Imprimir este card"
                aria-expanded={open}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <Printer className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Imprimir</span>
              </button>
              {open && (
                <div
                  role="dialog"
                  aria-label="Opções de impressão"
                  className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-3 space-y-3"
                >
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                      Cor das faixas
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {PRINT_ACCENT_PRESETS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => updateAccent(p.value)}
                          title={p.label}
                          aria-label={`Cor ${p.label}`}
                          className={cn(
                            "h-6 w-6 rounded-full border transition-transform",
                            accent.toLowerCase() === p.value.toLowerCase()
                              ? "ring-2 ring-offset-2 ring-offset-popover ring-foreground scale-110"
                              : "border-border/60 hover:scale-110",
                          )}
                          style={{ background: p.value }}
                        />
                      ))}
                      <label className="relative inline-flex items-center" title="Cor personalizada">
                        <input
                          type="color"
                          value={accent}
                          onChange={(e) => updateAccent(e.target.value)}
                          className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                          aria-label="Escolher cor personalizada"
                        />
                        <span className="h-6 w-6 rounded-full border border-dashed border-border bg-gradient-to-br from-red-400 via-yellow-300 to-blue-500" />
                      </label>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-block h-3 w-6 rounded-sm border border-border" style={{ background: accent }} />
                      <span className="tabular-nums">{accent.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="text-xs px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Imprimir
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>



      {/* Capa de impressão (FORM-CORP-213) — visível só no @media print */}
      {printable && (
        <>
          <div className="print-only print-chrome-bar print-chrome-bar-top" />
          <div className="print-only print-header">
            <div className="print-header-left">
              <CalendarDays className="print-header-icon" />
              <span className="print-header-title">DATA DE ATUALIZAÇÃO</span>
              <span className="print-header-datebox">Data: {new Date().toLocaleDateString("pt-BR")}</span>
            </div>
            <img src={frasleLogo} alt="Frasle Mobility" className="print-header-logo" />
          </div>
          <div className="print-only print-titlebar">
            <h1 className="print-doc-title">{headingText}</h1>
            <div className="print-doc-period">
              <strong>Período:</strong> {periodo}
            </div>
          </div>
        </>
      )}

      <div className="p-4 print-content">{children}</div>

      {printable && (
        <>
          <div className="print-only print-footer">
            <img src={randoncorpLogo} alt="RandonCorp" className="print-footer-logo" />
            <span className="print-footer-code">
              FORM-CORP-213 — Atualização Indicadores CTL · Rev.00 · 23/01/2026
            </span>
          </div>
          <div className="print-only print-chrome-bar print-chrome-bar-bottom" />
        </>
      )}
    </section>
  );
}

export function EmptyState({ label = "Nenhum dado encontrado" }: { label?: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
      <BarChart3 className="mb-2 h-5 w-5 opacity-70" />
      {label}
    </div>
  );
}

export function StatusDot({ status }: { status: "verde" | "azul" | "amarelo" | "vermelho" }) {
  const map: Record<string, string> = {
    verde: "bg-success",
    azul: "bg-info",
    amarelo: "bg-warning",
    vermelho: "bg-destructive",
  };
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", map[status])} />;
}

export function ClassBadge({ c }: { c: "A" | "B" | "C" | "D" | string | undefined | null }) {
  const map: Record<string, string> = {
    A: "bg-success/15 text-success border-success/30",
    B: "bg-info/15 text-info border-info/30",
    C: "bg-warning/15 text-warning border-warning/30",
    D: "bg-destructive/15 text-destructive border-destructive/30",
  };
  const raw = String(c ?? "").trim().toUpperCase();
  const safe = raw === "A" || raw === "B" || raw === "C" || raw === "D" ? raw : "—";
  return (
    <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-md border text-xs font-bold", map[safe] ?? "bg-muted text-muted-foreground border-border")}>
      {safe}
    </span>
  );
}
