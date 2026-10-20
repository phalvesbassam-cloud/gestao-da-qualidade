import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { calcPPM } from "@/lib/idf-calc";
import type { IDFRow } from "@/lib/types";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Gauge,
  Printer,
  ScanSearch,
  Target,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFilters } from "@/hooks/use-dashboard";
import {
  DEFAULT_PRINT_ACCENT,
  getPrintAccent,
  printElement,
  setPrintAccent,
  type PrintAppearance,
} from "@/lib/print";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  inspectionDate,
  monthlyPpm,
  ppmTotals,
  ppmValue,
  referenceYear,
  type PpmMode,
} from "@/lib/monthly-metrics";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PRINT_ACCENT_PRESETS = [
  { label: "Vermelho Frasle", value: DEFAULT_PRINT_ACCENT },
  { label: "Amarelo Frasle", value: "#FFC20E" },
  { label: "Grafite", value: "#1f2937" },
  { label: "Azul Corporativo", value: "#1e3a8a" },
  { label: "Verde Qualidade", value: "#059669" },
];

/** Estilo padrão dos tooltips do Recharts (segue o tema). */
export const chartTooltip = {
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    fontSize: 12,
    color: "var(--color-popover-foreground)",
    boxShadow: "0 12px 32px -14px rgb(0 0 0 / 0.35)",
  },
  labelStyle: { color: "var(--color-popover-foreground)", fontWeight: 600 },
  itemStyle: { color: "var(--color-popover-foreground)" },
  cursor: { fill: "color-mix(in oklab, var(--color-muted-foreground) 10%, transparent)" },
};

export const numberBR = (value: number) => Number(value || 0).toLocaleString("pt-BR");

export function formatPeriodLabel(from: string, to: string): string {
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
    return <span className="text-[11px] text-muted-foreground">sem variação</span>;
  }
  if (previous === 0) {
    return <span className="text-[11px] font-medium text-info">novo período</span>;
  }
  const pct = ((current - previous) / previous) * 100;
  const up = pct > 0.05;
  const down = pct < -0.05;
  const good = invert ? down : up;
  const bad = invert ? up : down;
  const color =
    !up && !down ? "text-muted-foreground" : good ? "text-success" : bad ? "text-destructive" : "";
  const Icon = up ? ArrowUp : down ? ArrowDown : ArrowRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums",
        color,
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(pct).toFixed(1)}%
      <span className="ml-1 font-normal text-muted-foreground">
        vs {previous.toLocaleString("pt-BR")}
      </span>
    </span>
  );
}

type Tone = "default" | "success" | "warning" | "destructive" | "info" | "ppm";

const TONE_TEXT: Record<Tone, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-info",
  ppm: "text-[var(--chart-ppm)]",
};
const TONE_BG: Record<Tone, string> = {
  default: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
  ppm: "bg-[var(--chart-ppm)]",
};

/** Moldura comum dos cards de indicador. */
function KpiFrame({
  tone,
  onClick,
  className,
  title,
  children,
}: {
  tone: Tone;
  onClick?: () => void;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={title}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "surface card-premium group flex min-h-[156px] flex-col overflow-hidden p-4",
        onClick &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        className,
      )}
    >
      {/* Faixa de cor do indicador */}
      <span className={cn("absolute inset-x-0 top-0 h-[3px] opacity-80", TONE_BG[tone])} />
      <span
        className={cn(
          "pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full opacity-[0.08] blur-2xl transition-opacity group-hover:opacity-[0.16]",
          TONE_BG[tone],
        )}
      />
      {children}
    </div>
  );
}

function KpiHeader({ label, tone, icon }: { label: ReactNode; tone: Tone; icon?: ReactNode }) {
  return (
    <div className="relative flex min-h-[28px] items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase leading-tight tracking-[0.12em] text-muted-foreground">
        <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", TONE_BG[tone])} />
        <span className="truncate">{label}</span>
      </div>
      {icon && (
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background/60",
            TONE_TEXT[tone],
          )}
        >
          {icon}
        </div>
      )}
    </div>
  );
}

function KpiAction({ label }: { label: string }) {
  return (
    <div className="mt-auto pt-2 text-[10px] font-semibold uppercase tracking-wider text-primary opacity-70 transition-opacity group-hover:opacity-100">
      {label} →
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
  delta,
  onClick,
  actionLabel = "Ver análise",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Exclude<Tone, "ppm">;
  icon?: ReactNode;
  delta?: ReactNode;
  onClick?: () => void;
  actionLabel?: string;
}) {
  return (
    <KpiFrame tone={tone} onClick={onClick}>
      <KpiHeader label={label} tone={tone} icon={icon} />
      <div
        className={cn(
          "relative mt-3 truncate font-display font-bold leading-none tracking-tight tabular-nums",
          TONE_TEXT[tone],
        )}
        style={{
          fontSize:
            typeof value === "string" && value.length > 10
              ? "clamp(1.35rem, 1.6vw, 1.9rem)"
              : "clamp(1.875rem, 2.5vw, 2.5rem)",
        }}
        title={typeof value === "string" ? value : undefined}
      >
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </div>
      {hint && (
        <div className="relative mt-1.5 line-clamp-2 text-[12px] text-muted-foreground">{hint}</div>
      )}
      {delta && <div className="relative mt-auto pt-2">{delta}</div>}
      {onClick && !delta && <KpiAction label={actionLabel} />}
    </KpiFrame>
  );
}

export function PpmCard({
  idf,
  previous,
  onClick,
}: {
  idf: IDFRow[];
  previous?: IDFRow[] | null;
  onClick?: () => void;
}) {
  const { ppm, ncQt, totalQt } = calcPPM(idf);
  const prev = previous ? calcPPM(previous) : null;
  return (
    <KpiFrame tone="ppm" onClick={onClick}>
      <KpiHeader label="PPM" tone="ppm" icon={<Target className="h-4 w-4" />} />
      <div
        className="relative mt-3 font-display font-bold leading-none tracking-tight tabular-nums text-[var(--chart-ppm)]"
        style={{ fontSize: "clamp(1.875rem, 2.5vw, 2.5rem)" }}
      >
        {ppm.toLocaleString("pt-BR")}
      </div>
      <div className="relative mt-1.5 text-[12px] text-muted-foreground">
        {ncQt.toLocaleString("pt-BR")} peças NC / {totalQt.toLocaleString("pt-BR")} inspecionadas
      </div>
      {prev && (
        <div className="relative mt-auto pt-2">
          <DeltaBadge current={ppm} previous={prev.ppm} invert />
        </div>
      )}
      {onClick && !prev && <KpiAction label="Ver análise" />}
    </KpiFrame>
  );
}

/**
 * PPM mês a mês com alternância entre:
 *  - SKU: inspeções reprovadas ÷ inspeções × 1.000.000 (cada linha do IDF é uma inspeção);
 *  - Peças: peças NC ÷ peças inspecionadas × 1.000.000.
 */
export function PpmMensalCard({ rows }: { rows: IDFRow[] }) {
  const [mode, setMode] = useState<PpmMode>("sku");
  const [open, setOpen] = useState(false);
  const year = useMemo(() => referenceYear(rows), [rows]);
  const months = useMemo(() => monthlyPpm(rows, year), [rows, year]);
  const withData = months.filter((m) => m.temDados);
  const last = withData[withData.length - 1];
  const before = withData[withData.length - 2];
  const value = last ? ppmValue(last, mode) : 0;
  const prevValue = before ? ppmValue(before, mode) : 0;
  const chart = months.map((m) => ({ mes: m.mes, ppm: ppmValue(m, mode), atual: m === last }));

  return (
    <>
      <KpiFrame tone="ppm" onClick={() => setOpen(true)} title="Abrir PPM mês a mês">
        <div className="relative flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--chart-ppm)]" />
            <span className="truncate">PPM mensal</span>
          </div>
          <div className="segmented" onClick={(e) => e.stopPropagation()}>
            <button type="button" data-active={mode === "sku"} onClick={() => setMode("sku")}>
              SKU
            </button>
            <button type="button" data-active={mode === "pecas"} onClick={() => setMode("pecas")}>
              Peças
            </button>
          </div>
        </div>
        <div className="relative mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-[2rem] font-bold leading-none tracking-tight tabular-nums text-[var(--chart-ppm)]">
              {value.toLocaleString("pt-BR")}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {last ? `${last.mesLongo}/${year}` : "Sem inspeções no ano"}
            </div>
          </div>
          {before && <DeltaBadge current={value} previous={prevValue} invert />}
        </div>
        <div className="relative mt-2 h-[46px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <Tooltip
                {...chartTooltip}
                formatter={(v: number) => [
                  v.toLocaleString("pt-BR"),
                  mode === "sku" ? "PPM (SKU)" : "PPM (peças)",
                ]}
              />
              <Bar dataKey="ppm" radius={[3, 3, 0, 0]}>
                {chart.map((c) => (
                  <Cell key={c.mes} fill="var(--chart-ppm)" fillOpacity={c.atual ? 1 : 0.38} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </KpiFrame>
      <PpmMensalDialog
        open={open}
        onOpenChange={setOpen}
        rows={rows}
        year={year}
        mode={mode}
        onMode={setMode}
      />
    </>
  );
}

function PpmMensalDialog({
  open,
  onOpenChange,
  rows,
  year,
  mode,
  onMode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: IDFRow[];
  year: number;
  mode: PpmMode;
  onMode: (m: PpmMode) => void;
}) {
  const months = useMemo(() => monthlyPpm(rows, year), [rows, year]);
  const totals = ppmTotals(months);
  const semData = useMemo(() => rows.filter((r) => !inspectionDate(r)).length, [rows]);
  const chart = months.map((m) => ({ mes: m.mes, ppm: ppmValue(m, mode) }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-[var(--chart-ppm)]" /> PPM mês a mês — {year}
          </DialogTitle>
          <DialogDescription>
            {mode === "sku"
              ? "Por SKU: cada linha da aba IDF conta como 1 SKU. PPM = linhas reprovadas ÷ linhas do mês × 1.000.000."
              : "Por peças: peças das inspeções reprovadas ÷ peças inspecionadas × 1.000.000."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="segmented">
            <button type="button" data-active={mode === "sku"} onClick={() => onMode("sku")}>
              Calculado por SKU
            </button>
            <button type="button" data-active={mode === "pecas"} onClick={() => onMode("pecas")}>
              Calculado por peças
            </button>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Acumulado do ano
            </div>
            <div className="font-display text-xl font-bold tabular-nums text-[var(--chart-ppm)]">
              {(mode === "sku" ? totals.ppmSku : totals.ppmPecas).toLocaleString("pt-BR")}
            </div>
          </div>
        </div>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={11}
                width={56}
                tickFormatter={(v) => Number(v).toLocaleString("pt-BR")}
              />
              <Tooltip
                {...chartTooltip}
                formatter={(v: number) => [v.toLocaleString("pt-BR"), "PPM"]}
              />
              <Bar
                dataKey="ppm"
                fill="var(--chart-ppm)"
                radius={[5, 5, 0, 0]}
                label={{
                  position: "top",
                  fontSize: 10,
                  fill: "var(--chart-axis)",
                  formatter: (v: number) => (v ? v.toLocaleString("pt-BR") : ""),
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-muted-foreground">
          O mês é definido pela data de inspeção de cada linha.
          {semData > 0 &&
            ` ${semData.toLocaleString("pt-BR")} linhas ainda sem data de inspeção não entram em nenhum mês.`}
        </p>
        <div className="max-h-[260px] overflow-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted text-muted-foreground">
              <tr className="text-left">
                <th className="px-3 py-2">Mês</th>
                <th className="px-3 py-2 text-right">Linhas (SKUs)</th>
                <th className="px-3 py-2 text-right">Linhas reprovadas</th>
                <th className="px-3 py-2 text-right">PPM SKU</th>
                <th className="px-3 py-2 text-right">Peças</th>
                <th className="px-3 py-2 text-right">Peças NC</th>
                <th className="px-3 py-2 text-right">PPM peças</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.mes} className={cn("border-t", !m.temDados && "text-muted-foreground")}>
                  <td className="px-3 py-1.5 font-medium">{m.mesLongo}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{numberBR(m.inspecoes)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{numberBR(m.reprovadas)}</td>
                  <td
                    className={cn(
                      "px-3 py-1.5 text-right font-semibold tabular-nums",
                      mode === "sku" && "text-[var(--chart-ppm)]",
                    )}
                  >
                    {numberBR(m.ppmSku)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{numberBR(m.pecas)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{numberBR(m.pecasNc)}</td>
                  <td
                    className={cn(
                      "px-3 py-1.5 text-right font-semibold tabular-nums",
                      mode === "pecas" && "text-[var(--chart-ppm)]",
                    )}
                  >
                    {numberBR(m.ppmPecas)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EficienciaInspecaoCard({
  criadas,
  iniciadas,
  pendentes,
  meta = 95,
  onClick,
  previousPct,
}: {
  criadas: number;
  iniciadas: number;
  pendentes?: number;
  meta?: number;
  onClick?: () => void;
  previousPct?: number | null;
}) {
  // Eficiência = inspecionadas ÷ recebidas (igual ao gráfico mensal).
  const pct = criadas > 0 ? (iniciadas / criadas) * 100 : 0;
  const pctRounded = Math.round(pct * 100) / 100;
  const pend = pendentes ?? 0;
  const tone: Tone = pct >= 95 ? "success" : pct >= 85 ? "warning" : "destructive";
  const gap = pctRounded - meta;
  const trend =
    previousPct == null
      ? null
      : pctRounded > previousPct + 0.05
        ? { Icon: ArrowUp, color: "text-success" }
        : pctRounded < previousPct - 0.05
          ? { Icon: ArrowDown, color: "text-destructive" }
          : { Icon: ArrowRight, color: "text-muted-foreground" };

  const tooltip =
    `Eficiência = (Inspecionados ÷ Recebidos) × 100\n` +
    `${iniciadas.toLocaleString("pt-BR")} ÷ ${criadas.toLocaleString("pt-BR")} × 100 = ${pctRounded.toFixed(2)}%`;

  return (
    <KpiFrame tone={tone} onClick={onClick} title={tooltip}>
      <KpiHeader
        label="Eficiência de inspeção"
        tone={tone}
        icon={<ScanSearch className="h-4 w-4" />}
      />
      <div className="relative mt-3 flex items-baseline gap-2">
        <span
          className={cn(
            "font-display font-bold leading-none tracking-tight tabular-nums",
            TONE_TEXT[tone],
          )}
          style={{ fontSize: "clamp(1.875rem, 2.5vw, 2.5rem)" }}
        >
          {pctRounded.toFixed(2)}%
        </span>
        {trend && <trend.Icon className={cn("h-4 w-4", trend.color)} />}
      </div>
      <div className="relative mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", TONE_BG[tone])}
          style={{ width: `${Math.min(100, Math.max(0, pctRounded))}%` }}
        />
      </div>
      <div className="relative mt-2.5 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
        <div>
          <div>Recebidas</div>
          <div className="font-semibold tabular-nums text-foreground">
            {criadas.toLocaleString("pt-BR")}
          </div>
        </div>
        <div>
          <div>Inspec.</div>
          <div className="font-semibold tabular-nums text-foreground">
            {iniciadas.toLocaleString("pt-BR")}
          </div>
        </div>
        <div>
          <div>Sem início</div>
          <div
            className={cn(
              "font-semibold tabular-nums",
              pend > 0 ? "text-warning" : "text-foreground",
            )}
          >
            {pend.toLocaleString("pt-BR")}
          </div>
        </div>
      </div>
      <div className="relative mt-auto flex items-center gap-1 pt-2 text-[11px]">
        <span className="text-muted-foreground">Meta {meta}%:</span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            gap >= 0 ? "text-success" : "text-destructive",
          )}
        >
          {gap >= 0 ? "+" : ""}
          {gap.toFixed(1)} p.p.
        </span>
      </div>
    </KpiFrame>
  );
}

/** Botão "Imprimir" com escolha da cor da faixa. Imprime o elemento `target`. */
export function PrintButton({
  target,
  title,
  subtitle,
  orientation = "landscape",
  label = "Imprimir",
  className,
  defaultAppearance = "light",
}: {
  target: () => HTMLElement | null;
  title: string;
  subtitle?: string;
  orientation?: "landscape" | "portrait";
  label?: string;
  className?: string;
  /** "light" = papel claro (econômico); "screen" = igual ao que aparece na tela. */
  defaultAppearance?: PrintAppearance;
}) {
  const [accent, setAccent] = useState<string>(DEFAULT_PRINT_ACCENT);
  const [appearance, setAppearance] = useState<PrintAppearance>(defaultAppearance);
  const [layout, setLayout] = useState<"landscape" | "portrait">(orientation);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setAccent(getPrintAccent()), []);

  const pick = (c: string) => {
    setAccent(c);
    setPrintAccent(c);
  };

  const run = async () => {
    setOpen(false);
    setBusy(true);
    try {
      await printElement(target(), { title, subtitle, orientation: layout, accent, appearance });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Imprimir (A4)"
          aria-label={`Imprimir ${title}`}
          disabled={busy}
          className={cn(
            "no-print inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60",
            className,
          )}
        >
          <Printer className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{busy ? "Preparando…" : label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 rounded-xl p-3">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Aparência
          </div>
          <div className="segmented flex w-full">
            <button
              type="button"
              className="flex-1"
              data-active={appearance === "screen"}
              onClick={() => setAppearance("screen")}
            >
              Igual à tela
            </button>
            <button
              type="button"
              className="flex-1"
              data-active={appearance === "light"}
              onClick={() => setAppearance("light")}
            >
              Clara (econômica)
            </button>
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Folha A4
          </div>
          <div className="segmented flex w-full">
            <button
              type="button"
              className="flex-1"
              data-active={layout === "landscape"}
              onClick={() => setLayout("landscape")}
            >
              Paisagem
            </button>
            <button
              type="button"
              className="flex-1"
              data-active={layout === "portrait"}
              onClick={() => setLayout("portrait")}
            >
              Retrato
            </button>
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cor da faixa
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PRINT_ACCENT_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => pick(p.value)}
                title={p.label}
                aria-label={`Cor ${p.label}`}
                className={cn(
                  "h-6 w-6 rounded-full border transition-transform",
                  accent.toLowerCase() === p.value.toLowerCase()
                    ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-popover"
                    : "border-border/60 hover:scale-110",
                )}
                style={{ background: p.value }}
              />
            ))}
            <label className="relative inline-flex items-center" title="Cor personalizada">
              <input
                type="color"
                value={accent}
                onChange={(e) => pick(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Escolher cor personalizada"
              />
              <span className="h-6 w-6 rounded-full border border-dashed border-border bg-gradient-to-br from-red-400 via-yellow-300 to-blue-500" />
            </label>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            Cabeçalho com as logos Frasle Mobility e RandonCorp e rodapé FORM-CORP-213.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={run}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SectionCard({
  title,
  subtitle,
  icon,
  action,
  children,
  className,
  bodyClassName,
  printable = false,
  printTitle,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  printable?: boolean;
  printTitle?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const { filters } = useFilters();
  const periodo = formatPeriodLabel(filters.from, filters.to);
  const headingText = printTitle ?? (typeof title === "string" ? title : "Indicador");

  return (
    <section ref={ref} className={cn("surface section-premium overflow-hidden", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background/60 text-primary">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate font-display text-sm font-semibold">{title}</h2>
            {subtitle && (
              <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {printable && (
            <PrintButton
              target={() => ref.current}
              title={headingText}
              subtitle={`Período: ${periodo}`}
            />
          )}
        </div>
      </header>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({ label = "Nenhum dado encontrado" }: { label?: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
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
  const raw = String(c ?? "")
    .trim()
    .toUpperCase();
  const safe = raw === "A" || raw === "B" || raw === "C" || raw === "D" ? raw : "—";
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold",
        map[safe] ?? "border-border bg-muted text-muted-foreground",
      )}
    >
      {safe}
    </span>
  );
}
