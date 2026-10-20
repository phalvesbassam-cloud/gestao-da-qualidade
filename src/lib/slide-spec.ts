// Formato único de conteúdo de slide.
//
// Cada card/gráfico que pode ir para a apresentação descreve o próprio conteúdo
// neste formato (`spec`). O mesmo spec alimenta:
//   - a prévia e o modo apresentação dentro do QualiHub (SlideCanvas);
//   - o PowerPoint exportado (gráficos nativos e tabelas editáveis).
// Assim o que aparece no sistema é o que aparece no .pptx.

export type SlideTone = "red" | "blue" | "green" | "amber" | "purple" | "neutral";

export type KpiItem = {
  label: string;
  value: string;
  hint?: string;
  tone?: SlideTone;
};

export type ChartKind = "line" | "area" | "bar" | "barH" | "stacked" | "doughnut" | "pie" | "combo";
export type ValueFormat = "number" | "percent" | "currency" | "decimal";

export type ChartSeries = {
  name: string;
  values: number[];
  color?: string; // hex sem # ou com #
  /** Só para `combo`: barra ou linha. */
  type?: "bar" | "line";
  /** Só para `combo`: eixo secundário. */
  secondary?: boolean;
};

export type ChartSpecData = {
  kind: ChartKind;
  categories: string[];
  series: ChartSeries[];
  /** Cores por série (quando a série não tiver cor). */
  colors?: string[];
  /** Cores por ponto (barras ou fatias de uma única série). */
  pointColors?: string[];
  format?: ValueFormat;
  secondaryFormat?: ValueFormat;
  /** Linha de meta (ex.: Índice NC ≤ 2%). */
  target?: { value: number; label: string };
  showValues?: boolean;
};

export type TableSpecData = {
  columns: string[];
  rows: string[][];
};

export type SlideSpec =
  | { type: "cover"; title: string; subtitle?: string; meta?: string }
  | { type: "kpis"; items: KpiItem[] }
  | { type: "chart"; chart: ChartSpecData; highlights?: KpiItem[] }
  | { type: "table"; table: TableSpecData }
  | { type: "text"; bullets: string[] }
  | { type: "section"; title: string; subtitle?: string };

export const kpiSpec = (items: KpiItem[]): SlideSpec => ({ type: "kpis", items });
export const chartSpec = (chart: ChartSpecData, highlights?: KpiItem[]): SlideSpec => ({
  type: "chart",
  chart,
  highlights,
});
export const tableSpec = (columns: string[], rows: (string | number)[][]): SlideSpec => ({
  type: "table",
  table: { columns, rows: rows.map((r) => r.map((c) => String(c ?? ""))) },
});
export const textSpec = (text: string | string[]): SlideSpec => ({
  type: "text",
  bullets: (Array.isArray(text) ? text : String(text).split(/\n+/))
    .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean),
});

/* ------------------------------ Cores ------------------------------ */

export const SERIES_COLORS = [
  "E30613",
  "2563EB",
  "16A34A",
  "D97706",
  "7C3AED",
  "0891B2",
  "64748B",
  "DB2777",
];

export const TONE_HEX: Record<SlideTone, { dark: string; light: string }> = {
  red: { dark: "F43F5E", light: "DC2626" },
  blue: { dark: "38BDF8", light: "0284C7" },
  green: { dark: "22C55E", light: "16A34A" },
  amber: { dark: "F59E0B", light: "D97706" },
  purple: { dark: "C084FC", light: "7C3AED" },
  neutral: { dark: "CBD5E1", light: "334155" },
};

export type SlideTheme = "dark" | "light";

export const THEME_HEX: Record<
  SlideTheme,
  {
    bg: string;
    card: string;
    border: string;
    text: string;
    muted: string;
    grid: string;
    primary: string;
  }
> = {
  dark: {
    bg: "0B0F14",
    card: "131A23",
    border: "273142",
    text: "F1F5F9",
    muted: "94A3B8",
    grid: "1F2937",
    primary: "EF2B2D",
  },
  light: {
    bg: "FFFFFF",
    card: "F8FAFC",
    border: "E2E8F0",
    text: "0F172A",
    muted: "64748B",
    grid: "E5E7EB",
    primary: "E30613",
  },
};

export const hex = (c: string) => c.replace(/^#/, "").toUpperCase();

export function seriesColor(chart: ChartSpecData, index: number) {
  const s = chart.series[index];
  return hex(s?.color ?? chart.colors?.[index] ?? SERIES_COLORS[index % SERIES_COLORS.length]);
}

export function formatValue(value: number, format: ValueFormat = "number") {
  const v = Number(value) || 0;
  switch (format) {
    case "currency":
      return v.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      });
    case "percent":
      return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
    case "decimal":
      return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    default:
      return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }
}

/** Código de formato numérico para o PowerPoint/Excel. */
export function excelFormat(format: ValueFormat = "number") {
  switch (format) {
    case "currency":
      return '"R$" #,##0';
    case "percent":
      return '0.0"%"';
    case "decimal":
      return "#,##0.00";
    default:
      return "#,##0";
  }
}

/* --------------------- Compatibilidade (dados antigos) --------------------- */

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => Boolean(v) && typeof v === "object" && !Array.isArray(v);

const MONTH_KEYS = ["mes", "mesCurto", "month", "periodo", "label", "nome", "name"];
const LABEL_PT: Record<string, string> = {
  idf: "Inspeções",
  alertas: "Alertas",
  rnc: "RNC",
  aprovado: "Aprovado",
  condicional: "Condicional",
  reprovado: "Reprovado",
  ppm: "PPM",
  indice: "Índice NC (%)",
  recebidas: "Recebidas",
  inspecionadas: "Inspecionadas",
  eficiencia: "Eficiência (%)",
  efic: "Eficiência (%)",
  criadas: "Recebidas",
  iniciadas: "Inspecionadas",
  qtd: "Quantidade",
  ocorrencias: "Ocorrências",
  value: "Valor",
  valor: "Valor",
  total: "Total",
};

export function humanize(key: string) {
  if (LABEL_PT[key]) return LABEL_PT[key];
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function rowsOf(data: unknown): Rec[] {
  if (Array.isArray(data)) return data.filter(isRec);
  if (!isRec(data)) return [];
  for (const key of ["serie", "rows", "data", "items", "ranking", "fornecedores", "top5"]) {
    const v = data[key];
    if (Array.isArray(v) && v.some(isRec)) return v.filter(isRec);
  }
  return [];
}

function chartFromRows(rows: Rec[], hintKind?: ChartKind): SlideSpec | null {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]);
  const labelKey =
    MONTH_KEYS.find((k) => keys.includes(k) && typeof rows[0][k] === "string") ??
    keys.find((k) => typeof rows[0][k] === "string");
  if (!labelKey) return null;
  const numeric = keys.filter(
    (k) =>
      k !== labelKey &&
      rows.every((r) => typeof r[k] === "number" || r[k] == null) &&
      k !== "year" &&
      k !== "month",
  );
  if (!numeric.length) return null;
  // Para pizza (name/value) usa uma série com cores por ponto.
  if (numeric.length === 1 && keys.includes("value") && keys.includes("name")) {
    return chartSpec({
      kind: "doughnut",
      categories: rows.map((r) => String(r.name)),
      series: [{ name: "Total", values: rows.map((r) => Number(r.value) || 0) }],
      pointColors: rows.map(
        (r, i) => colorFromCss(String(r.color ?? "")) ?? SERIES_COLORS[i % SERIES_COLORS.length],
      ),
    });
  }
  const isMonthly = ["mes", "mesCurto", "month"].includes(labelKey);
  const statusSeries = numeric.every((k) => ["aprovado", "condicional", "reprovado"].includes(k));
  return chartSpec({
    kind: hintKind ?? (statusSeries ? "stacked" : isMonthly ? "line" : "bar"),
    categories: rows.map((r) => String(r[labelKey] ?? "")),
    series: numeric.slice(0, 5).map((k) => ({
      name: humanize(k),
      values: rows.map((r) => Number(r[k]) || 0),
      color: SEMANTIC_COLORS[k],
    })),
  });
}

/** Cores fixas por indicador, iguais às do sistema. */
const SEMANTIC_COLORS: Record<string, string> = {
  aprovado: "16A34A",
  aprovados: "16A34A",
  condicional: "D97706",
  condicionais: "D97706",
  reprovado: "DC2626",
  reprovados: "DC2626",
  alertas: "EA580C",
  rnc: "0284C7",
  rncs: "0284C7",
  idf: "64748B",
  inspecoes: "64748B",
  ppm: "7C3AED",
  recebidas: "94A3B8",
  criadas: "94A3B8",
  inspecionadas: "2563EB",
  iniciadas: "2563EB",
  eficiencia: "16A34A",
  efic: "16A34A",
};

function colorFromCss(value: string): string | null {
  if (/^#?[0-9a-f]{6}$/i.test(value)) return hex(value);
  if (value.includes("approved")) return "16A34A";
  if (value.includes("conditional")) return "D97706";
  if (value.includes("rejected")) return "DC2626";
  return null;
}

function tableFromRows(rows: Rec[]): SlideSpec | null {
  if (!rows.length) return null;
  const columns = Object.keys(rows[0])
    .filter((k) => rows.some((r) => ["string", "number", "boolean"].includes(typeof r[k])))
    .slice(0, 7);
  return tableSpec(
    columns.map(humanize),
    rows.slice(0, 14).map((r) =>
      columns.map((c) => {
        const v = r[c];
        if (typeof v === "number") return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
        if (typeof v === "boolean") return v ? "Sim" : "Não";
        return String(v ?? "—");
      }),
    ),
  );
}

function kpisFromRecord(data: Rec): SlideSpec | null {
  if (Array.isArray(data.cards)) {
    const items = (data.cards as Rec[]).filter(isRec).map((c) => ({
      label: String(c.label ?? ""),
      value: String(c.value ?? ""),
      hint: c.description ? String(c.description) : undefined,
      tone: (["red", "blue", "green", "amber", "purple"].includes(String(c.tone))
        ? c.tone
        : "neutral") as SlideTone,
    }));
    return items.length ? kpiSpec(items) : null;
  }
  const items: KpiItem[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "number")
      items.push({
        label: humanize(k),
        value: v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }),
      });
    else if (isRec(v)) {
      for (const [k2, v2] of Object.entries(v)) {
        if (typeof v2 === "number")
          items.push({
            label: `${humanize(k)} · ${humanize(k2)}`,
            value: v2.toLocaleString("pt-BR", { maximumFractionDigits: 2 }),
          });
      }
    }
  }
  return items.length ? kpiSpec(items.slice(0, 8)) : null;
}

/** Garante um spec para itens antigos que só têm `data`. */
export function ensureSpec(slide: {
  spec?: SlideSpec;
  type: string;
  data?: unknown;
  notes?: string;
  title?: string;
}): SlideSpec {
  if (slide.spec) return slide.spec;
  const { type, data } = slide;
  if (type === "ai-summary" || type === "manual" || type === "text") {
    const content =
      isRec(data) && typeof data.content === "string" ? data.content : (slide.notes ?? "");
    return textSpec(content || "Escreva aqui os pontos principais deste slide.");
  }
  const rows = rowsOf(data);
  if (type === "chart") {
    const s = chartFromRows(rows);
    if (s) return s;
  }
  if (type === "table" || type === "ranking") {
    const s = tableFromRows(rows);
    if (s) return s;
  }
  if (isRec(data)) {
    const s = kpisFromRecord(data);
    if (s) return s;
  }
  return (
    chartFromRows(rows) ??
    tableFromRows(rows) ??
    textSpec(slide.notes || "Conteúdo sem dados estruturados.")
  );
}
