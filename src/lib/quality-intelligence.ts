import { calcPPM, parseBrDate } from "./idf-calc";
import type { AlertaRow, DashboardData, IDFRow, RNCRow } from "./types";

export type RiskLevel = "critico" | "alto" | "atencao" | "controlado";
export type TrendDirection = "up" | "down" | "stable" | "insufficient";

export const QUALITY_SCORE_CONFIG = {
  version: "1.0",
  method: "deducoes-normalizadas",
  baseScore: 100,
  weights: {
    rejectionRate: 25,
    ppm: 20,
    recurrenceRate: 15,
    alertRate: 10,
    openRncRate: 15,
    severityRate: 10,
    recentTrend: 5,
  },
  minimumSample: 5,
} as const;

export type QualityScoreDeduction = {
  key: keyof typeof QUALITY_SCORE_CONFIG.weights;
  label: string;
  points: number;
  evidence: string;
};

export type SupplierQualityScore = {
  fornecedor: string;
  score: number;
  riskScore: number;
  label: "EXCELENTE" | "CONTROLADO" | "ATENÇÃO" | "ALTO RISCO" | "CRÍTICO";
  risk: RiskLevel;
  total: number;
  aprovados: number;
  condicionais: number;
  reprovados: number;
  rejectionRate: number;
  ppm: number;
  recorrencias: number;
  alertas: number;
  rncsAbertas: number;
  trend: TrendDirection;
  trendDeltaPp: number | null;
  deductions: QualityScoreDeduction[];
  recommendation: string;
};

export type QualityAnomaly = {
  fornecedor: string;
  severity: RiskLevel;
  currentRate: number;
  baselineRate: number;
  variationPct: number;
  message: string;
  sample: number;
};

export type QualitySnapshot = {
  inspecoes: number;
  recebidos: number;
  inspecionados: number;
  eficiencia: number;
  aprovados: number;
  condicionais: number;
  reprovados: number;
  rejectionRate: number;
  idfGlobal: number;
  ppm: number;
  fornecedores: number;
  alertas: number;
  alertasPendentes: number;
  rncs: number;
  rncsAbertas: number;
};

export type ChangeItem = {
  key: string;
  label: string;
  current: number;
  previous: number;
  delta: number;
  percent: number | null;
  favorable: boolean | null;
};

export type ParetoEntry = {
  key: string;
  label: string;
  value: number;
  percent: number;
  cumulative: number;
};

export type MonthlyEfficiency = {
  year: number;
  month: number;
  mes: string;
  mesCurto: string;
  recebidas: number;
  inspecionadas: number;
  pendentes: number;
  eficiencia: number | null;
};

export type QualityNotification = {
  id: string;
  level: RiskLevel | "info" | "success";
  title: string;
  description: string;
  fornecedor?: string;
};

export type QualityTimelineEvent = {
  id: string;
  date: Date;
  type: "inspecao" | "reprovacao" | "alerta" | "rnc";
  title: string;
  description: string;
  fornecedor?: string;
  item?: string;
  origin: "IDF" | "ALERTA" | "RNC";
};

export type CopilotAnswer = {
  title: string;
  summary: string;
  bullets: string[];
  supplier?: string;
  dataBasis: string;
};

const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function isApproved(status: unknown): boolean {
  const value = normalizeText(status);
  return value.includes("aprov") && !value.includes("condicional") && !value.includes("reprov");
}

export function isConditional(status: unknown): boolean {
  const value = normalizeText(status);
  return value.includes("condicional") || value.includes("desvio");
}

export function isRejected(status: unknown): boolean {
  return normalizeText(status).includes("reprov");
}

export function isRncOpen(row: RNCRow): boolean {
  const status = normalizeText(row.statusRNC || row.encerramento || row.statusAcoes);
  return !status.includes("conclu") && !status.includes("encerr") && !status.includes("finaliz");
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildItemSupplierMap(rows: IDFRow[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const item = normalizeText(row.codigoItem);
    const supplier = row.fornecedor.trim();
    if (!item || !supplier || supplier === "—") continue;
    const supplierCounts = counts.get(item) ?? new Map<string, number>();
    supplierCounts.set(supplier, (supplierCounts.get(supplier) ?? 0) + 1);
    counts.set(item, supplierCounts);
  }

  const result = new Map<string, string>();
  for (const [item, supplierCounts] of counts) {
    const best = [...supplierCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) result.set(item, best[0]);
  }
  return result;
}

export function supplierForRnc(row: RNCRow, idf: IDFRow[]): string | null {
  return buildItemSupplierMap(idf).get(normalizeText(row.item)) ?? null;
}

function latestMonthlyTrend(rows: IDFRow[]): { direction: TrendDirection; deltaPp: number | null } {
  const months = new Map<string, { total: number; rejected: number }>();
  for (const row of rows) {
    if (!row.dataReferencia) continue;
    const key = monthKey(row.dataReferencia);
    const bucket = months.get(key) ?? { total: 0, rejected: 0 };
    bucket.total++;
    if (isRejected(row.status)) bucket.rejected++;
    months.set(key, bucket);
  }

  const ordered = [...months.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (ordered.length < 2) return { direction: "insufficient", deltaPp: null };
  const previous = ordered.at(-2)![1];
  const current = ordered.at(-1)![1];
  if (
    previous.total < QUALITY_SCORE_CONFIG.minimumSample ||
    current.total < QUALITY_SCORE_CONFIG.minimumSample
  ) {
    return { direction: "insufficient", deltaPp: null };
  }

  const previousRate = (previous.rejected / previous.total) * 100;
  const currentRate = (current.rejected / current.total) * 100;
  const deltaPp = round(currentRate - previousRate, 2);
  return {
    direction: deltaPp > 0.25 ? "up" : deltaPp < -0.25 ? "down" : "stable",
    deltaPp,
  };
}

function riskFromScore(score: number): RiskLevel {
  if (score < 45) return "critico";
  if (score < 65) return "alto";
  if (score < 80) return "atencao";
  return "controlado";
}

function labelFromScore(score: number): SupplierQualityScore["label"] {
  if (score >= 90) return "EXCELENTE";
  if (score >= 80) return "CONTROLADO";
  if (score >= 65) return "ATENÇÃO";
  if (score >= 45) return "ALTO RISCO";
  return "CRÍTICO";
}

export function calculateSupplierQualityScores(
  data: Pick<DashboardData, "idf" | "alerta" | "rnc">,
): SupplierQualityScore[] {
  const rowsBySupplier = new Map<string, IDFRow[]>();
  for (const row of data.idf) {
    const supplier = row.fornecedor.trim();
    if (!supplier || supplier === "—") continue;
    const rows = rowsBySupplier.get(supplier) ?? [];
    rows.push(row);
    rowsBySupplier.set(supplier, rows);
  }

  const itemSupplier = buildItemSupplierMap(data.idf);
  const alertsBySupplier = new Map<string, number>();
  for (const row of data.alerta) {
    const supplier = row.fornecedor.trim();
    if (supplier) alertsBySupplier.set(supplier, (alertsBySupplier.get(supplier) ?? 0) + 1);
  }
  const openRncsBySupplier = new Map<string, number>();
  for (const row of data.rnc) {
    if (!isRncOpen(row)) continue;
    const supplier = itemSupplier.get(normalizeText(row.item));
    if (supplier) openRncsBySupplier.set(supplier, (openRncsBySupplier.get(supplier) ?? 0) + 1);
  }

  const raw = [...rowsBySupplier.entries()].map(([fornecedor, rows]) => {
    const reprovados = rows.filter((row) => isRejected(row.status)).length;
    const condicionais = rows.filter((row) => isConditional(row.status)).length;
    const aprovados = rows.filter((row) => isApproved(row.status)).length;
    const total = rows.length;
    const rejectionRate = total > 0 ? (reprovados / total) * 100 : 0;
    const recurrenceRate =
      total > 0 ? (rows.filter((row) => row.recorrencia > 0).length / total) * 100 : 0;
    const severityRate = total > 0 ? rows.reduce((sum, row) => sum + row.notaNC, 0) / total : 0;
    const alertas = alertsBySupplier.get(fornecedor) ?? 0;
    const rncsAbertas = openRncsBySupplier.get(fornecedor) ?? 0;
    const alertRate = total > 0 ? (alertas / total) * 100 : 0;
    const openRncRate = total > 0 ? (rncsAbertas / total) * 100 : 0;
    const ppm = calcPPM(rows).ppm;
    const trend = latestMonthlyTrend(rows);
    const trendRisk = trend.direction === "up" ? Math.max(0, trend.deltaPp ?? 0) : 0;

    return {
      fornecedor,
      rows,
      total,
      aprovados,
      condicionais,
      reprovados,
      rejectionRate,
      recurrenceRate,
      severityRate,
      alertas,
      rncsAbertas,
      alertRate,
      openRncRate,
      ppm,
      trend,
      trendRisk,
    };
  });

  const max = (
    key:
      | "rejectionRate"
      | "ppm"
      | "recurrenceRate"
      | "alertRate"
      | "openRncRate"
      | "severityRate"
      | "trendRisk",
  ) => Math.max(0, ...raw.map((row) => row[key]));
  const maxima = {
    rejectionRate: max("rejectionRate"),
    ppm: max("ppm"),
    recurrenceRate: max("recurrenceRate"),
    alertRate: max("alertRate"),
    openRncRate: max("openRncRate"),
    severityRate: max("severityRate"),
    recentTrend: max("trendRisk"),
  };

  const deduction = (value: number, maximum: number, weight: number) =>
    maximum > 0 ? round((value / maximum) * weight, 2) : 0;

  return raw
    .map((row): SupplierQualityScore => {
      const deductionCandidates: QualityScoreDeduction[] = [
        {
          key: "rejectionRate",
          label: "Índice de reprovação",
          points: deduction(
            row.rejectionRate,
            maxima.rejectionRate,
            QUALITY_SCORE_CONFIG.weights.rejectionRate,
          ),
          evidence: `${row.reprovados} reprovações em ${row.total} inspeções (${round(row.rejectionRate, 2)}%)`,
        },
        {
          key: "ppm",
          label: "PPM",
          points: deduction(row.ppm, maxima.ppm, QUALITY_SCORE_CONFIG.weights.ppm),
          evidence: `${row.ppm.toLocaleString("pt-BR")} PPM`,
        },
        {
          key: "recurrenceRate",
          label: "Reincidência",
          points: deduction(
            row.recurrenceRate,
            maxima.recurrenceRate,
            QUALITY_SCORE_CONFIG.weights.recurrenceRate,
          ),
          evidence: `${row.rows.filter((item) => item.recorrencia > 0).length} registros reincidentes`,
        },
        {
          key: "alertRate",
          label: "Alertas",
          points: deduction(
            row.alertRate,
            maxima.alertRate,
            QUALITY_SCORE_CONFIG.weights.alertRate,
          ),
          evidence: `${row.alertas} alertas vinculados`,
        },
        {
          key: "openRncRate",
          label: "RNC abertas",
          points: deduction(
            row.openRncRate,
            maxima.openRncRate,
            QUALITY_SCORE_CONFIG.weights.openRncRate,
          ),
          evidence: `${row.rncsAbertas} RNC abertas inferidas pelo item`,
        },
        {
          key: "severityRate",
          label: "Gravidade",
          points: deduction(
            row.severityRate,
            maxima.severityRate,
            QUALITY_SCORE_CONFIG.weights.severityRate,
          ),
          evidence: `${round(row.severityRate, 2)} pontos NC por inspeção`,
        },
        {
          key: "recentTrend",
          label: "Tendência recente",
          points: deduction(
            row.trendRisk,
            maxima.recentTrend,
            QUALITY_SCORE_CONFIG.weights.recentTrend,
          ),
          evidence:
            row.trend.deltaPp == null
              ? "Histórico mensal insuficiente"
              : `${row.trend.deltaPp > 0 ? "+" : ""}${row.trend.deltaPp} p.p. de reprovação`,
        },
      ];
      const deductions = deductionCandidates.filter((item) => item.points > 0);

      const score = round(
        clamp(
          QUALITY_SCORE_CONFIG.baseScore - deductions.reduce((sum, item) => sum + item.points, 0),
          0,
          100,
        ),
        0,
      );
      const risk = riskFromScore(score);
      const topCause = [...deductions].sort((a, b) => b.points - a.points)[0];
      const recommendation = topCause
        ? `Priorizar ${topCause.label.toLowerCase()}: ${topCause.evidence}.`
        : "Manter o monitoramento; não há penalidades relevantes no recorte atual.";

      return {
        fornecedor: row.fornecedor,
        score,
        riskScore: round(100 - score, 1),
        label: labelFromScore(score),
        risk,
        total: row.total,
        aprovados: row.aprovados,
        condicionais: row.condicionais,
        reprovados: row.reprovados,
        rejectionRate: round(row.rejectionRate, 2),
        ppm: row.ppm,
        recorrencias: row.rows.filter((item) => item.recorrencia > 0).length,
        alertas: row.alertas,
        rncsAbertas: row.rncsAbertas,
        trend: row.trend.direction,
        trendDeltaPp: row.trend.deltaPp,
        deductions: deductions.sort((a, b) => b.points - a.points),
        recommendation,
      };
    })
    .sort((a, b) => a.score - b.score || b.reprovados - a.reprovados);
}

export function buildQualitySnapshot(
  data: Pick<DashboardData, "idf" | "alerta" | "rnc">,
  operational?: { recebidas: number; inspecionadas: number },
): QualitySnapshot {
  const inspecoes = data.idf.length;
  const recebidos =
    operational?.recebidas ?? data.idf.filter((row) => parseBrDate(row.dataCriacaoInsp)).length;
  const inspecionados =
    operational?.inspecionadas ?? data.idf.filter((row) => parseBrDate(row.dataInicioInsp)).length;
  const aprovados = data.idf.filter((row) => isApproved(row.status)).length;
  const condicionais = data.idf.filter((row) => isConditional(row.status)).length;
  const reprovados = data.idf.filter((row) => isRejected(row.status)).length;
  const rncsAbertas = data.rnc.filter(isRncOpen).length;
  return {
    inspecoes,
    recebidos,
    inspecionados,
    eficiencia: inspecionados > 0 ? round((recebidos / inspecionados) * 100, 2) : 0,
    aprovados,
    condicionais,
    reprovados,
    rejectionRate: inspecoes > 0 ? round((reprovados / inspecoes) * 100, 2) : 0,
    idfGlobal: inspecoes > 0 ? round((aprovados / inspecoes) * 100, 1) : 0,
    ppm: calcPPM(data.idf).ppm,
    fornecedores: new Set(
      data.idf.map((row) => row.fornecedor).filter((value) => value && value !== "—"),
    ).size,
    alertas: data.alerta.length,
    alertasPendentes: data.alerta.filter((row) => !row.finalizado).length,
    rncs: data.rnc.length,
    rncsAbertas,
  };
}

export function buildChanges(current: QualitySnapshot, previous: QualitySnapshot): ChangeItem[] {
  const items: Array<[string, string, keyof QualitySnapshot, boolean | null]> = [
    ["inspecoes", "Inspeções", "inspecoes", true],
    ["recebidos", "Recebimentos", "recebidos", true],
    ["eficiencia", "Eficiência", "eficiencia", true],
    ["aprovados", "Aprovados", "aprovados", true],
    ["reprovados", "Reprovações", "reprovados", false],
    ["condicionais", "Condicionais", "condicionais", false],
    ["alertas", "Alertas", "alertas", false],
    ["rncsAbertas", "RNC abertas", "rncsAbertas", false],
    ["idfGlobal", "IDF Global", "idfGlobal", true],
    ["ppm", "PPM", "ppm", false],
  ];
  return items
    .map(([key, label, field, higherIsBetter]) => {
      const currentValue = Number(current[field]);
      const previousValue = Number(previous[field]);
      const delta = round(
        currentValue - previousValue,
        field === "idfGlobal" || field === "eficiencia" ? 2 : 0,
      );
      const percent = previousValue === 0 ? null : round((delta / previousValue) * 100, 1);
      return {
        key,
        label,
        current: currentValue,
        previous: previousValue,
        delta,
        percent,
        favorable: delta === 0 ? null : higherIsBetter ? delta > 0 : delta < 0,
      };
    })
    .sort((a, b) => Math.abs(b.percent ?? b.delta) - Math.abs(a.percent ?? a.delta));
}

function rowsInWindow<T>(rows: T[], dateOf: (row: T) => Date | null, from: Date, to: Date): T[] {
  return rows.filter((row) => {
    const date = dateOf(row);
    return Boolean(date && date >= from && date <= to);
  });
}

export function buildRecentPeriodComparison(
  data: DashboardData,
  days = 30,
): { current: QualitySnapshot; previous: QualitySnapshot; from: Date; to: Date } | null {
  const dates = [
    ...data.idf.map((row) => row.dataReferencia),
    ...data.alerta.map((row) => row.dataReferencia),
    ...data.rnc.map((row) => row.dataReferencia),
  ].filter((date): date is Date => Boolean(date));
  if (dates.length === 0) return null;
  const to = new Date(Math.max(...dates.map((date) => date.getTime())));
  to.setHours(23, 59, 59, 999);
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  from.setHours(0, 0, 0, 0);
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - (days - 1) * 86_400_000);
  previousFrom.setHours(0, 0, 0, 0);

  const select = (start: Date, end: Date): QualitySnapshot => {
    const inspectedRows = rowsInWindow(
      data.idf,
      (row) => parseBrDate(row.dataInicioInsp),
      start,
      end,
    );
    const receivedRows = rowsInWindow(
      data.idf,
      (row) => parseBrDate(row.dataCriacaoInsp),
      start,
      end,
    );
    return buildQualitySnapshot(
      {
        idf: inspectedRows,
        alerta: rowsInWindow(data.alerta, (row) => row.dataReferencia, start, end),
        rnc: rowsInWindow(data.rnc, (row) => row.dataReferencia, start, end),
      },
      { recebidas: receivedRows.length, inspecionadas: inspectedRows.length },
    );
  };

  return {
    current: select(from, to),
    previous: select(previousFrom, previousTo),
    from,
    to,
  };
}

export function buildMonthlyEfficiency(rows: IDFRow[], selectedYear?: number): MonthlyEfficiency[] {
  const creationDates = rows
    .map((row) => parseBrDate(row.dataCriacaoInsp))
    .filter((date): date is Date => Boolean(date));
  const inspectionDates = rows
    .map((row) => parseBrDate(row.dataInicioInsp))
    .filter((date): date is Date => Boolean(date));
  const years = [...creationDates, ...inspectionDates].map((date) => date.getFullYear());
  const year = selectedYear ?? (years.length > 0 ? Math.max(...years) : new Date().getFullYear());

  return MONTHS_PT.map((mes, month) => {
    const recebidas = creationDates.filter(
      (date) => date.getFullYear() === year && date.getMonth() === month,
    ).length;
    const inspecionadas = inspectionDates.filter(
      (date) => date.getFullYear() === year && date.getMonth() === month,
    ).length;
    return {
      year,
      month,
      mes,
      mesCurto: mes.slice(0, 3),
      recebidas,
      inspecionadas,
      pendentes: rows.filter((row) => {
        const creation = parseBrDate(row.dataCriacaoInsp);
        return (
          creation?.getFullYear() === year &&
          creation.getMonth() === month &&
          !parseBrDate(row.dataInicioInsp)
        );
      }).length,
      eficiencia: inspecionadas > 0 ? round((recebidas / inspecionadas) * 100, 2) : null,
    };
  });
}

export function buildPareto(
  rows: IDFRow[],
  dimension: "problema" | "fornecedor" | "item" | "divisao",
  limit = 12,
): ParetoEntry[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!isRejected(row.status) && !isConditional(row.status)) continue;
    const raw =
      dimension === "problema"
        ? row.tipoProblema || row.problema || "Não informado"
        : dimension === "fornecedor"
          ? row.fornecedor
          : dimension === "item"
            ? row.codigoItem
            : row.divisao;
    const key = String(raw || "Não informado").trim() || "Não informado";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const all = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const total = all.reduce((sum, [, value]) => sum + value, 0);
  const ordered = all.slice(0, limit);
  let cumulative = 0;
  return ordered.map(([key, value]) => {
    const percent = total > 0 ? (value / total) * 100 : 0;
    cumulative += percent;
    return {
      key,
      label: key.length > 28 ? `${key.slice(0, 26)}…` : key,
      value,
      percent: round(percent, 1),
      cumulative: round(cumulative, 1),
    };
  });
}

export function detectQualityAnomalies(rows: IDFRow[]): QualityAnomaly[] {
  const suppliers = new Map<string, IDFRow[]>();
  for (const row of rows) {
    const list = suppliers.get(row.fornecedor) ?? [];
    list.push(row);
    suppliers.set(row.fornecedor, list);
  }

  const anomalies: QualityAnomaly[] = [];
  for (const [fornecedor, supplierRows] of suppliers) {
    const months = new Map<string, { total: number; rejected: number }>();
    for (const row of supplierRows) {
      if (!row.dataReferencia) continue;
      const key = monthKey(row.dataReferencia);
      const bucket = months.get(key) ?? { total: 0, rejected: 0 };
      bucket.total++;
      if (isRejected(row.status)) bucket.rejected++;
      months.set(key, bucket);
    }
    const ordered = [...months.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (ordered.length < 4) continue;
    const current = ordered.at(-1)![1];
    const history = ordered
      .slice(0, -1)
      .map(([, value]) => value)
      .filter((value) => value.total >= QUALITY_SCORE_CONFIG.minimumSample);
    if (current.total < QUALITY_SCORE_CONFIG.minimumSample || history.length < 3) continue;
    const currentRate = (current.rejected / current.total) * 100;
    const rates = history.map((value) => (value.rejected / value.total) * 100);
    const baselineRate = rates.reduce((sum, value) => sum + value, 0) / rates.length;
    const variance =
      rates.reduce((sum, value) => sum + (value - baselineRate) ** 2, 0) / rates.length;
    const stdDev = Math.sqrt(variance);
    const variationPct =
      baselineRate > 0
        ? ((currentRate - baselineRate) / baselineRate) * 100
        : currentRate > 0
          ? 100
          : 0;
    const threshold = Math.max(baselineRate + 2 * stdDev, baselineRate + 2);
    if (currentRate <= threshold || currentRate <= baselineRate) continue;
    const severity: RiskLevel =
      variationPct >= 100 || currentRate >= 10
        ? "critico"
        : variationPct >= 50 || currentRate >= 5
          ? "alto"
          : "atencao";
    anomalies.push({
      fornecedor,
      severity,
      currentRate: round(currentRate, 2),
      baselineRate: round(baselineRate, 2),
      variationPct: round(variationPct, 1),
      sample: current.total,
      message: `Reprovações em ${round(currentRate, 2)}%, acima do padrão histórico de ${round(baselineRate, 2)}%.`,
    });
  }
  return anomalies.sort((a, b) => b.variationPct - a.variationPct);
}

export function buildExecutiveSummary(
  snapshot: QualitySnapshot,
  scores: SupplierQualityScore[],
  anomalies: QualityAnomaly[],
): string[] {
  const lines = [
    `O recorte atual contém ${snapshot.inspecoes.toLocaleString("pt-BR")} inspeções e IDF global de ${snapshot.idfGlobal.toFixed(1)}%.`,
  ];
  if (snapshot.inspecionados > 0)
    lines.push(
      `Eficiência operacional de ${snapshot.eficiencia.toFixed(2)}%: ${snapshot.recebidos.toLocaleString("pt-BR")} recebimentos pela Data de Criação ÷ ${snapshot.inspecionados.toLocaleString("pt-BR")} inspeções pela Data de Início.`,
    );
  if (snapshot.reprovados > 0)
    lines.push(
      `${snapshot.reprovados.toLocaleString("pt-BR")} reprovações foram identificadas (${snapshot.rejectionRate.toFixed(2)}% das inspeções).`,
    );
  if (snapshot.alertasPendentes > 0)
    lines.push(`${snapshot.alertasPendentes.toLocaleString("pt-BR")} alertas aguardam conclusão.`);
  if (snapshot.rncsAbertas > 0)
    lines.push(`${snapshot.rncsAbertas.toLocaleString("pt-BR")} RNC permanecem em acompanhamento.`);
  const highestRisk = scores.find((score) => score.risk !== "controlado");
  if (highestRisk)
    lines.push(
      `${highestRisk.fornecedor} possui o maior risco atual (Quality Score ${highestRisk.score}/100): ${highestRisk.recommendation}`,
    );
  if (anomalies[0])
    lines.push(`Anomalia confirmada em ${anomalies[0].fornecedor}: ${anomalies[0].message}`);
  else lines.push("Nenhuma anomalia estatística foi confirmada com o histórico disponível.");
  return lines;
}

export function buildNotifications(
  data: DashboardData,
  scores: SupplierQualityScore[],
  anomalies: QualityAnomaly[],
): QualityNotification[] {
  const notifications: QualityNotification[] = [];
  for (const anomaly of anomalies.slice(0, 3)) {
    notifications.push({
      id: `anomaly-${anomaly.fornecedor}`,
      level: anomaly.severity,
      title: "Anomalia de reprovação",
      description: `${anomaly.fornecedor}: ${anomaly.message}`,
      fornecedor: anomaly.fornecedor,
    });
  }
  for (const score of scores
    .filter((item) => item.risk === "critico" || item.risk === "alto")
    .slice(0, 3)) {
    notifications.push({
      id: `risk-${score.fornecedor}`,
      level: score.risk,
      title: `Risco ${score.risk === "critico" ? "crítico" : "alto"}`,
      description: `${score.fornecedor} está com Quality Score ${score.score}/100.`,
      fornecedor: score.fornecedor,
    });
  }
  notifications.push({
    id: `update-${data.fetchedAt}`,
    level: "info",
    title: "Dados atualizados",
    description: data.fetchedAt
      ? `Última leitura às ${new Date(data.fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`
      : "Aguardando primeira leitura.",
  });
  return notifications;
}

export function buildQualityTimeline(data: DashboardData, limit = 40): QualityTimelineEvent[] {
  const events: QualityTimelineEvent[] = [];
  for (const row of data.idf) {
    if (!row.dataReferencia) continue;
    const rejected = isRejected(row.status);
    events.push({
      id: `idf-${row.processo}-${row.codigoItem}-${row.dataInicioInsp}`,
      date: row.dataReferencia,
      type: rejected ? "reprovacao" : "inspecao",
      title: rejected ? "Reprovação detectada" : "Inspeção realizada",
      description: `${row.fornecedor} · ${row.codigoItem}${row.tipoProblema ? ` · ${row.tipoProblema}` : ""}`,
      fornecedor: row.fornecedor,
      item: row.codigoItem,
      origin: "IDF",
    });
  }
  for (const row of data.alerta) {
    if (!row.dataReferencia) continue;
    events.push({
      id: `alerta-${row.numero}`,
      date: row.dataReferencia,
      type: "alerta",
      title: `Alerta AQ ${row.numero || "registrado"}`,
      description: `${row.fornecedor} · ${row.item}${row.problema ? ` · ${row.problema}` : ""}`,
      fornecedor: row.fornecedor,
      item: row.item,
      origin: "ALERTA",
    });
  }
  for (const row of data.rnc) {
    if (!row.dataReferencia) continue;
    events.push({
      id: `rnc-${row.rnc}`,
      date: row.dataReferencia,
      type: "rnc",
      title: `RNC ${row.rnc || "registrada"}`,
      description: `${row.item}${row.assunto ? ` · ${row.assunto}` : ""} · ${row.statusRNC || "Em acompanhamento"}`,
      item: row.item,
      origin: "RNC",
    });
  }
  return events.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
}

function countBy(rows: IDFRow[], getter: (row: IDFRow) => string, rejectedOnly = false) {
  const map = new Map<string, { total: number; rejected: number }>();
  for (const row of rows) {
    const key = getter(row).trim() || "Não informado";
    const current = map.get(key) ?? { total: 0, rejected: 0 };
    current.total++;
    if (isRejected(row.status)) current.rejected++;
    map.set(key, current);
  }
  return [...map.entries()]
    .map(([label, values]) => ({
      label,
      ...values,
      rate: values.total > 0 ? (values.rejected / values.total) * 100 : 0,
    }))
    .filter((item) => !rejectedOnly || item.rejected > 0)
    .sort((a, b) => b.rejected - a.rejected || b.rate - a.rate || b.total - a.total);
}

export function answerQualityQuestion(
  data: DashboardData,
  question: string,
  operational?: { recebidas: number; inspecionadas: number },
): CopilotAnswer {
  const query = normalizeText(question);
  const snapshot = buildQualitySnapshot(data, operational);
  const scores = calculateSupplierQualityScores(data);
  const anomalies = detectQualityAnomalies(data.idf);
  const supplier = scores.find((item) => query.includes(normalizeText(item.fornecedor)));

  if (supplier) {
    return {
      title: `${supplier.fornecedor} · visão analítica`,
      summary: `Quality Score ${supplier.score}/100 (${supplier.label}), calculado sobre ${supplier.total.toLocaleString("pt-BR")} inspeções do recorte.`,
      bullets: [
        `IDF: ${supplier.total > 0 ? ((supplier.aprovados / supplier.total) * 100).toFixed(1) : "0,0"}% · Reprovações: ${supplier.reprovados} (${supplier.rejectionRate.toFixed(2)}%).`,
        `PPM: ${supplier.ppm.toLocaleString("pt-BR")} · Alertas: ${supplier.alertas} · RNC abertas relacionadas por item: ${supplier.rncsAbertas}.`,
        supplier.deductions[0]?.evidence ??
          "Nenhuma dedução relevante foi identificada no modelo atual.",
        supplier.recommendation,
      ],
      supplier: supplier.fornecedor,
      dataBasis: "IDF + ALERTA + RNC do recorte carregado",
    };
  }

  if (query.includes("pior") || query.includes("queda") || query.includes("tendencia")) {
    const worsening = scores.filter((item) => item.trend === "up").slice(0, 10);
    return {
      title: "Fornecedores com piora recente",
      summary: worsening.length
        ? `${worsening.length} fornecedores apresentaram aumento mensurável na taxa de reprovação.`
        : "Nenhuma piora foi confirmada com amostra mensal suficiente.",
      bullets: worsening.length
        ? worsening.map(
            (item) =>
              `${item.fornecedor}: +${item.trendDeltaPp?.toFixed(2)} p.p. na taxa de reprovação · score ${item.score}/100.`,
          )
        : [
            "O sistema exige ao menos dois meses com amostra suficiente; não inventou tendência onde faltam dados.",
          ],
      dataBasis: "Comparação dos dois meses mais recentes com amostra mínima",
    };
  }

  if (query.includes("maior") && query.includes("reprov")) {
    const ranking = countBy(data.idf, (row) => row.fornecedor, true).slice(0, 10);
    return {
      title: "Maiores concentrações de reprovação",
      summary: `${snapshot.reprovados.toLocaleString("pt-BR")} reprovações foram encontradas no recorte.`,
      bullets: ranking.map(
        (item, index) =>
          `${index + 1}. ${item.label}: ${item.rejected} reprovações em ${item.total} inspeções (${item.rate.toFixed(2)}%).`,
      ),
      dataBasis: "Status da aba IDF",
    };
  }

  if (query.includes("rnc") && (query.includes("atras") || query.includes("venc"))) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = data.rnc
      .filter(isRncOpen)
      .map((row) => ({ row, due: parseBrDate(row.prazoAcoes || row.prazoAnalise) }))
      .filter((item): item is { row: RNCRow; due: Date } => Boolean(item.due && item.due < today))
      .sort((a, b) => a.due.getTime() - b.due.getTime());
    return {
      title: "RNC com prazo vencido",
      summary: `${overdue.length} RNC abertas possuem prazo válido anterior a ${today.toLocaleDateString("pt-BR")}.`,
      bullets: overdue.length
        ? overdue
            .slice(0, 15)
            .map(
              ({ row, due }) =>
                `RNC ${row.rnc || "sem número"} · item ${row.item || "não informado"} · prazo ${due.toLocaleDateString("pt-BR")} · ${row.statusRNC || row.statusAcoes || "em acompanhamento"}.`,
            )
        : [
            "Nenhuma RNC aberta com prazo vencido foi encontrada, ou os registros não possuem uma data de prazo válida.",
          ],
      dataBasis: "Prazos e status preservados da aba RNC",
    };
  }

  if (query.includes("divis") && (query.includes("reprov") || query.includes("maior"))) {
    const divisions = countBy(data.idf, (row) => row.divisao, true)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10);
    return {
      title: "Índice de reprovação por divisão",
      summary: divisions[0]
        ? `${divisions[0].label} possui a maior taxa no recorte: ${divisions[0].rate.toFixed(2)}%.`
        : "Não há reprovações suficientes para classificar divisões.",
      bullets: divisions.map(
        (item) =>
          `${item.label}: ${item.rejected} reprovações / ${item.total} inspeções (${item.rate.toFixed(2)}%).`,
      ),
      dataBasis: "Divisão e status da aba IDF",
    };
  }

  if (query.includes("risco")) {
    const risks = scores.filter((item) => item.risk !== "controlado").slice(0, 10);
    return {
      title: "Fornecedores com maior risco",
      summary: risks.length
        ? `${risks.length} fornecedores exigem atenção no modelo atual.`
        : "Nenhum fornecedor está acima do nível controlado neste recorte.",
      bullets: risks.length
        ? risks.map(
            (item) =>
              `${item.fornecedor}: score ${item.score}/100 (${item.label}) · ${item.deductions[0]?.evidence ?? item.recommendation}`,
          )
        : ["Continue monitorando a evolução mensal e as novas ocorrências."],
      dataBasis: `Quality Score ${QUALITY_SCORE_CONFIG.version} · IDF + ALERTA + RNC`,
    };
  }

  if ((query.includes("idf") && query.includes("por que")) || query.includes("impactou")) {
    const contributors = countBy(data.idf, (row) => row.fornecedor, true).slice(0, 10);
    return {
      title: "Principais impactos no IDF",
      summary: `O IDF atual é ${snapshot.idfGlobal.toFixed(1)}%; os fornecedores abaixo concentram as reprovações que reduzem o resultado.`,
      bullets: contributors.map(
        (item) =>
          `${item.label}: ${item.rejected} reprovações, taxa de ${item.rate.toFixed(2)}% em ${item.total} inspeções.`,
      ),
      dataBasis: "Aprovados ÷ total e contribuições por fornecedor na aba IDF",
    };
  }

  if (query.includes("problema") || query.includes("repet")) {
    const pareto = buildPareto(data.idf, "problema", 10);
    return {
      title: "Problemas mais recorrentes",
      summary: pareto[0]
        ? `${pareto[0].key} é o problema mais frequente entre as não conformidades (${pareto[0].percent.toFixed(1)}%).`
        : "Não há tipos de problema associados a não conformidades neste recorte.",
      bullets: pareto.map(
        (item) =>
          `${item.key}: ${item.value} ocorrências · ${item.percent.toFixed(1)}% · acumulado ${item.cumulative.toFixed(1)}%.`,
      ),
      dataBasis: "Tipo de Problema de reprovados e condicionais na aba IDF",
    };
  }

  if (query.includes("compar") || query.includes("mudou")) {
    const comparison = buildRecentPeriodComparison(data);
    if (!comparison)
      return {
        title: "Comparação de períodos",
        summary: "Não há datas válidas suficientes para montar períodos equivalentes.",
        bullets: [],
        dataBasis: "Datas disponíveis no recorte",
      };
    const changes = buildChanges(comparison.current, comparison.previous).slice(0, 8);
    return {
      title: "O que mudou nos últimos 30 dias",
      summary: `Período atual encerrado em ${comparison.to.toLocaleDateString("pt-BR")} comparado aos 30 dias anteriores.`,
      bullets: changes.map(
        (item) =>
          `${item.label}: ${item.previous.toLocaleString("pt-BR")} → ${item.current.toLocaleString("pt-BR")} (${item.delta > 0 ? "+" : ""}${item.delta.toLocaleString("pt-BR")}).`,
      ),
      dataBasis: "Períodos equivalentes pelas datas de referência de cada módulo",
    };
  }

  const summary = buildExecutiveSummary(snapshot, scores, anomalies);
  return {
    title: "Resumo executivo da qualidade",
    summary:
      "Leitura automática do recorte atual. Você também pode perguntar por fornecedor, risco, reprovações, RNC, divisão, tendência ou problemas recorrentes.",
    bullets: summary,
    dataBasis: "Indicadores atuais do QualiHub",
  };
}
