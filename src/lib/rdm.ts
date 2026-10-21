// RDM — Reunião de Desempenho Mensal.
// Todos os números do slide de indicadores, mês a mês, a partir da planilha
// (sem filtros de tela: é o número oficial do mês).
import { parseBrDate } from "@/lib/idf-calc";
import {
  MESES_CURTOS,
  MESES_LONGOS,
  inspectionDate,
  isRejectedStatus,
} from "@/lib/monthly-metrics";
import { qldSummary } from "@/lib/qld";
import type { DashboardData } from "@/lib/types";

export const RDM_META_EFICIENCIA = 90; // Target do slide (planilha de KPIs)
export const RDM_META_NC = 2; // Índice NC máximo (%)

export type RdmMes = {
  month: number;
  mes: string;
  mesLongo: string;
  recebidas: number;
  inspecionadas: number;
  eficiencia: number | null; // inspecionadas ÷ recebidas × 100
  reprovadas: number;
  indiceNC: number | null; // reprovadas ÷ inspecionadas × 100
  pecas: number;
  pecasNc: number;
  ppmPecas: number;
  ppmSku: number;
  fornecedores: number; // fornecedores com recebimento no mês
  alertas: number;
  rncs: number;
  temDados: boolean;
};

export type RdmManual = {
  /** Adequação de produtos (vem da área de Adequação, digitado na tela). */
  adequacao: { mdPecas: number; avariaPecas: number; valor: number; skus: number };
  /** Comentários do slide. Use *texto* para destacar em vermelho. */
  comentarios: { inspecao: string; adequacao: string; qld: string };
  /** Linha de subtítulo da capa. */
  capaSubtitulo: string;
  /** PPM usado nas sugestões de texto: por peças ou por SKU (linhas). */
  ppmModo: "pecas" | "sku";
};

export const RDM_MANUAL_PADRAO: RdmManual = {
  adequacao: { mdPecas: 0, avariaPecas: 0, valor: 0, skus: 0 },
  comentarios: { inspecao: "", adequacao: "", qld: "" },
  capaSubtitulo: "Co-Manufatura – Nakata",
  ppmModo: "pecas",
};

export function anosDisponiveis(data: DashboardData) {
  const anos = new Set<number>();
  for (const r of data.idf) {
    const d = inspectionDate(r);
    if (d) anos.add(d.getFullYear());
  }
  return [...anos].sort((a, b) => b - a);
}

export function rdmAno(data: DashboardData, ano: number): RdmMes[] {
  const meses = MESES_CURTOS.map((mes, month) => ({
    month,
    mes,
    mesLongo: MESES_LONGOS[month],
    recebidas: 0,
    inspecionadas: 0,
    reprovadas: 0,
    pecas: 0,
    pecasNc: 0,
    fornecedoresSet: new Set<string>(),
    alertas: 0,
    rncs: 0,
  }));
  const noAno = (d: Date | null) => (d && d.getFullYear() === ano ? meses[d.getMonth()] : null);

  for (const r of data.idf) {
    const rec = noAno(parseBrDate(r.dataCriacaoInsp));
    if (rec) {
      rec.recebidas += 1;
      if (r.fornecedor) rec.fornecedoresSet.add(r.fornecedor.trim().toUpperCase());
    }
    const insp = noAno(inspectionDate(r));
    if (insp) {
      const qtd = Number(r.quantidade) || 0;
      insp.inspecionadas += 1;
      insp.pecas += qtd;
      if (isRejectedStatus(r.status)) {
        insp.reprovadas += 1;
        insp.pecasNc += qtd;
      }
    }
  }
  for (const a of data.alerta) {
    const m = noAno(a.dataReferencia ? new Date(a.dataReferencia) : null);
    if (m) m.alertas += 1;
  }
  for (const r of data.rnc) {
    const m = noAno(r.dataReferencia ? new Date(r.dataReferencia) : null);
    if (m) m.rncs += 1;
  }

  return meses.map(({ fornecedoresSet, ...m }) => ({
    ...m,
    fornecedores: fornecedoresSet.size,
    eficiencia: m.recebidas > 0 ? (m.inspecionadas / m.recebidas) * 100 : null,
    indiceNC: m.inspecionadas > 0 ? (m.reprovadas / m.inspecionadas) * 100 : null,
    ppmPecas: m.pecas > 0 ? Math.round((m.pecasNc / m.pecas) * 1_000_000) : 0,
    ppmSku: m.inspecionadas > 0 ? Math.round((m.reprovadas / m.inspecionadas) * 1_000_000) : 0,
    temDados: m.recebidas > 0 || m.inspecionadas > 0,
  }));
}

/** Acumulado de janeiro até o mês escolhido. */
export function rdmAcumulado(meses: RdmMes[], ateMes: number) {
  const ate = meses.filter((m) => m.month <= ateMes);
  const s = ate.reduce(
    (t, m) => ({
      recebidas: t.recebidas + m.recebidas,
      inspecionadas: t.inspecionadas + m.inspecionadas,
      reprovadas: t.reprovadas + m.reprovadas,
      pecas: t.pecas + m.pecas,
      pecasNc: t.pecasNc + m.pecasNc,
      alertas: t.alertas + m.alertas,
      rncs: t.rncs + m.rncs,
    }),
    { recebidas: 0, inspecionadas: 0, reprovadas: 0, pecas: 0, pecasNc: 0, alertas: 0, rncs: 0 },
  );
  return {
    ...s,
    eficiencia: s.recebidas > 0 ? (s.inspecionadas / s.recebidas) * 100 : null,
    indiceNC: s.inspecionadas > 0 ? (s.reprovadas / s.inspecionadas) * 100 : null,
    ppmPecas: s.pecas > 0 ? Math.round((s.pecasNc / s.pecas) * 1_000_000) : 0,
    ppmSku: s.inspecionadas > 0 ? Math.round((s.reprovadas / s.inspecionadas) * 1_000_000) : 0,
  };
}

export function rdmQld(data: DashboardData) {
  return qldSummary(data.qldQlde ?? []);
}

export const pct = (v: number | null, casas = 1) =>
  v == null
    ? "—"
    : `${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
export const int = (v: number) => Math.round(v || 0).toLocaleString("pt-BR");
export const brl = (v: number) =>
  (v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

/**
 * Converte o texto dos comentários em trechos: cada linha é um tópico e
 * *trecho entre asteriscos* sai destacado em vermelho (negrito e itálico).
 */
export function parseDestaques(texto: string) {
  return texto
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-•]\s*/, "").trim())
    .filter(Boolean)
    .map((linha) =>
      linha
        .split(/(\*[^*]+\*)/g)
        .filter(Boolean)
        .map((parte) =>
          parte.startsWith("*") && parte.endsWith("*")
            ? { texto: parte.slice(1, -1), destaque: true }
            : { texto: parte, destaque: false },
        ),
    );
}

/** Textos sugeridos para as observações (o usuário edita antes de gerar). */
export function sugestoesRdm(args: {
  mes: RdmMes;
  acumulado: { alertas: number; rncs: number };
  ppmModo: "pecas" | "sku";
  adequacao: {
    pecas: number;
    valor: number;
    skus: number;
    md: { valor: number };
    avaria: { valor: number };
  };
  qld: { qldeSkus: number; totalValor: number; qldValor: number; qldeValor: number };
}) {
  const { mes, acumulado, ppmModo, adequacao: ad, qld } = args;
  const ppm = ppmModo === "sku" ? `${int(mes.ppmSku)} (SKU)` : `${int(mes.ppmPecas)} (Peças)`;
  const pctMd = ad.valor > 0 ? Math.round((ad.md.valor / ad.valor) * 100) : 0;
  return {
    inspecao: [
      `*PPM* = *${ppm}*`,
      `*${int(mes.fornecedores)}* fornecedores recebidos no mês`,
      `*${int(mes.alertas)}* Alertas da Qualidade gerados no mês *(${int(acumulado.alertas)} no ano)*`,
      `*${int(mes.rncs)} RNCs* por não conformidades significativas *(${int(acumulado.rncs)} no ano)*`,
    ].join("\n"),
    adequacao: ad.pecas
      ? [
          `*${int(ad.pecas)} peças* adequadas no mês, somando *${brl(ad.valor)}* em *${int(ad.skus)} SKUs*.`,
          `MD representa *${pctMd}%* do valor e Avaria CD *${100 - pctMd}%*.`,
        ].join("\n")
      : "",
    qld: [
      `*QLDE* estoque com *${int(qld.qldeSkus)} sku's*.`,
      `Exposição ativa de *${brl(qld.totalValor)}* (QLD ${brl(qld.qldValor)} · QLDE ${brl(qld.qldeValor)}).`,
    ].join("\n"),
  };
}
