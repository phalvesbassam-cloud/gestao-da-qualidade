// Indicadores mensais compartilhados entre Consolidado, Reunião Mensal,
// apresentações e QualiAI. A data-base é a Data de Início da Inspeção
// (a mesma usada em "Inspecionadas").
import { parseBrDate } from "@/lib/idf-calc";
import type { IDFRow } from "@/lib/types";

export const MESES_CURTOS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export const MESES_LONGOS = [
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

export type PpmMode = "sku" | "pecas";

export type MonthlyPpm = {
  month: number;
  mes: string;
  mesLongo: string;
  /** Inspeções (cada linha da aba IDF é uma inspeção). */
  inspecoes: number;
  reprovadas: number;
  /** Peças inspecionadas e peças em inspeções reprovadas. */
  pecas: number;
  pecasNc: number;
  /** Inspeções reprovadas ÷ inspeções × 1.000.000. */
  ppmSku: number;
  /** Peças NC ÷ peças inspecionadas × 1.000.000. */
  ppmPecas: number;
  temDados: boolean;
};

export const isRejectedStatus = (status: unknown) =>
  String(status ?? "")
    .toLowerCase()
    .includes("reprov");

export function inspectionDate(row: IDFRow): Date | null {
  return parseBrDate(row.dataInicioInsp) ?? row.dataReferencia ?? null;
}

/** Ano mais recente com inspeções (ou o ano atual). */
export function referenceYear(rows: IDFRow[]): number {
  let year = 0;
  for (const row of rows) {
    const y = inspectionDate(row)?.getFullYear() ?? 0;
    if (y > year) year = y;
  }
  return year || new Date().getFullYear();
}

export function monthlyPpm(rows: IDFRow[], year = referenceYear(rows)): MonthlyPpm[] {
  const acc = MESES_CURTOS.map((mes, month) => ({
    month,
    mes,
    mesLongo: MESES_LONGOS[month],
    inspecoes: 0,
    reprovadas: 0,
    pecas: 0,
    pecasNc: 0,
  }));

  for (const row of rows) {
    const date = inspectionDate(row);
    if (!date || date.getFullYear() !== year) continue;
    const m = acc[date.getMonth()];
    const qtd = Number(row.quantidade) || 0;
    const rejected = isRejectedStatus(row.status);
    m.inspecoes += 1;
    m.pecas += qtd;
    if (rejected) {
      m.reprovadas += 1;
      m.pecasNc += qtd;
    }
  }

  return acc.map((m) => ({
    ...m,
    ppmSku: m.inspecoes > 0 ? Math.round((m.reprovadas / m.inspecoes) * 1_000_000) : 0,
    ppmPecas: m.pecas > 0 ? Math.round((m.pecasNc / m.pecas) * 1_000_000) : 0,
    temDados: m.inspecoes > 0,
  }));
}

export function ppmTotals(rows: MonthlyPpm[]) {
  const t = rows.reduce(
    (s, r) => ({
      inspecoes: s.inspecoes + r.inspecoes,
      reprovadas: s.reprovadas + r.reprovadas,
      pecas: s.pecas + r.pecas,
      pecasNc: s.pecasNc + r.pecasNc,
    }),
    { inspecoes: 0, reprovadas: 0, pecas: 0, pecasNc: 0 },
  );
  return {
    ...t,
    ppmSku: t.inspecoes > 0 ? Math.round((t.reprovadas / t.inspecoes) * 1_000_000) : 0,
    ppmPecas: t.pecas > 0 ? Math.round((t.pecasNc / t.pecas) * 1_000_000) : 0,
  };
}

export const ppmValue = (row: Pick<MonthlyPpm, "ppmSku" | "ppmPecas">, mode: PpmMode) =>
  mode === "sku" ? row.ppmSku : row.ppmPecas;
