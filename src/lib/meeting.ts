// Dados e slides da Reunião Mensal — uma única fonte para a tela, a impressão,
// o modo apresentação e o PowerPoint.
import { calcPPM, parseBrDate } from "@/lib/idf-calc";
import {
  MESES_CURTOS,
  inspectionDate,
  isRejectedStatus,
  monthlyPpm,
  ppmTotals,
  referenceYear,
  type PpmMode,
} from "@/lib/monthly-metrics";
import { qldSummary, moedaBR } from "@/lib/qld";
import { chartSpec, kpiSpec, tableSpec, textSpec, type SlideSpec } from "@/lib/slide-spec";
import type { IDFRow, QLDQLDERow } from "@/lib/types";
import type { PptxSlideInput } from "@/lib/presentation-pptx";

const num = (v: number) => v.toLocaleString("pt-BR");
const pct = (v: number) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const lower = (v: unknown) => String(v ?? "").toLowerCase();

export const isApproved = (r: IDFRow) => {
  const s = lower(r.status);
  return s.includes("aprovado") && !s.includes("condicional") && !s.includes("reprov");
};
export const isConditional = (r: IDFRow) => lower(r.status).includes("condicional");
export const isRejected = (r: IDFRow) => isRejectedStatus(r.status);

export type NcMode = "inspecoes" | "sku";

export type MeetingInput = {
  idf: IDFRow[];
  /** Linhas para os gráficos mensais (todos os filtros exceto datas). */
  baseRows: IDFRow[];
  efficiency: { recebidas: number; inspecionadas: number; percentual: number };
  qldQlde: QLDQLDERow[];
  alertas: number;
  rncs: number;
  hasDateFilter: boolean;
  periodo: string;
};

export function buildMeeting(input: MeetingInput) {
  const { idf, baseRows, efficiency, qldQlde, alertas, rncs, hasDateFilter } = input;
  const year = referenceYear(baseRows.length ? baseRows : idf);

  // Com filtro de data, os gráficos mensais mostram só os meses do recorte.
  const visible = new Set<number>();
  for (const r of idf) {
    const d = inspectionDate(r);
    if (d && d.getFullYear() === year) visible.add(d.getMonth());
  }
  const monthRows = hasDateFilter ? idf : baseRows;
  // Sem filtro, vai de janeiro até o último mês com inspeção (sem meses futuros zerados).
  let lastMonth = -1;
  for (const r of monthRows) {
    const d = inspectionDate(r);
    if (d && d.getFullYear() === year) lastMonth = Math.max(lastMonth, d.getMonth());
  }
  const keepMonth = (m: number) => (hasDateFilter ? visible.has(m) : m <= lastMonth);

  const totalInspecoes = idf.length;
  const aprovados = idf.filter(isApproved).length;
  const condicionais = idf.filter(isConditional).length;
  const reprovados = idf.filter(isRejected).length;
  const ppmPecas = calcPPM(idf);
  const ppmSku = totalInspecoes > 0 ? Math.round((reprovados / totalInspecoes) * 1_000_000) : 0;
  const eficiencia = efficiency.percentual;

  const ppm = monthlyPpm(monthRows, year).filter((m) => keepMonth(m.month));
  const ppmAno = ppmTotals(ppm);

  const byMonth = (rows: IDFRow[], m: number, date: (r: IDFRow) => Date | null) =>
    rows.filter((r) => {
      const d = date(r);
      return d && d.getFullYear() === year && d.getMonth() === m;
    });

  const indiceNC = (mode: NcMode) =>
    MESES_CURTOS.map((mes, m) => {
      const rows = byMonth(monthRows, m, inspectionDate);
      if (mode === "inspecoes") {
        const rep = rows.filter(isRejected).length;
        return {
          mes,
          month: m,
          indice: rows.length ? Number(((rep / rows.length) * 100).toFixed(2)) : 0,
          base: rows.length,
        };
      }
      const skus = new Set(rows.map((r) => r.codigoItem).filter(Boolean));
      const rej = new Set(
        rows
          .filter(isRejected)
          .map((r) => r.codigoItem)
          .filter(Boolean),
      );
      return {
        mes,
        month: m,
        indice: skus.size ? Number(((rej.size / skus.size) * 100).toFixed(2)) : 0,
        base: skus.size,
      };
    }).filter((x) => keepMonth(x.month));

  const eficienciaMensal = MESES_CURTOS.map((mes, m) => {
    const recebidas = byMonth(monthRows, m, (r) => parseBrDate(r.dataCriacaoInsp)).length;
    const inspecionadas = byMonth(monthRows, m, inspectionDate).length;
    return {
      mes,
      month: m,
      recebidas,
      inspecionadas,
      eficiencia: recebidas > 0 ? Number(((inspecionadas / recebidas) * 100).toFixed(1)) : 0,
    };
  }).filter((x) => keepMonth(x.month));

  // Pareto das reprovações
  const problemas = new Map<string, number>();
  for (const r of idf.filter(isRejected)) {
    const p = (r.tipoProblema || r.problema || r.descricaoProblema || "").trim() || "Não informado";
    problemas.set(p, (problemas.get(p) ?? 0) + 1);
  }
  const paretoBase = [...problemas.entries()]
    .map(([problema, ocorrencias]) => ({ problema, ocorrencias }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias)
    .slice(0, 10);
  const paretoTotal = paretoBase.reduce((s, x) => s + x.ocorrencias, 0);
  let acc = 0;
  const pareto = paretoBase.map((x) => {
    acc += x.ocorrencias;
    return {
      ...x,
      nome: x.problema.length > 26 ? `${x.problema.slice(0, 25)}…` : x.problema,
      acumulado: paretoTotal ? Number(((acc / paretoTotal) * 100).toFixed(1)) : 0,
    };
  });

  // Ranking de fornecedores
  const fornecedores = new Map<
    string,
    { fornecedor: string; total: number; aprovados: number; reprovados: number }
  >();
  for (const r of idf) {
    const f = (r.fornecedor || "").trim();
    if (!f || f === "Não informado") continue;
    const e = fornecedores.get(f) ?? { fornecedor: f, total: 0, aprovados: 0, reprovados: 0 };
    e.total += 1;
    if (isApproved(r)) e.aprovados += 1;
    if (isRejected(r)) e.reprovados += 1;
    fornecedores.set(f, e);
  }
  const ranking = [...fornecedores.values()].map((x) => ({
    ...x,
    indiceNC: (x.reprovados / x.total) * 100,
    aprovacao: (x.aprovados / x.total) * 100,
  }));
  const melhores = [...ranking]
    .filter((x) => x.total >= 5)
    .sort((a, b) => a.indiceNC - b.indiceNC || b.total - a.total)
    .slice(0, 5);
  const criticos = ranking
    .filter((x) => x.reprovados > 0)
    .sort((a, b) => b.indiceNC - a.indiceNC || b.reprovados - a.reprovados)
    .slice(0, 5);

  const qld = qldSummary(qldQlde);

  const maior = pareto[0];
  const leitura = [
    eficiencia >= 95
      ? `Eficiência de inspeção em ${pct(eficiencia)}, acima da meta de 95% (${num(efficiency.inspecionadas)} de ${num(efficiency.recebidas)} recebidas).`
      : `Eficiência de inspeção em ${pct(eficiencia)}, abaixo da meta de 95% (${num(efficiency.inspecionadas)} de ${num(efficiency.recebidas)} recebidas).`,
    `${num(reprovados)} inspeções reprovadas de ${num(totalInspecoes)} no período — PPM ${num(ppmPecas.ppm)} por peças e ${num(ppmSku)} por SKU.`,
    maior
      ? `Principal causa de reprovação: "${maior.problema}" (${num(maior.ocorrencias)} ocorrência${maior.ocorrencias > 1 ? "s" : ""}).`
      : "Sem reprovações suficientes para formar o Pareto.",
    `Exposição ativa QLD + QLDE de ${moedaBR.format(qld.totalValor)} em ${num(qld.totalQuantidade)} peças; ${qld.resolvidos.length} itens já resolvidos.`,
    criticos[0]
      ? `Fornecedor mais crítico: ${criticos[0].fornecedor}, com ${pct(criticos[0].indiceNC)} de reprovação (${criticos[0].reprovados}/${criticos[0].total}).`
      : "Nenhum fornecedor com reprovação no recorte.",
  ];

  return {
    year,
    periodo: input.periodo,
    kpis: {
      totalInspecoes,
      aprovados,
      condicionais,
      reprovados,
      ppmPecas: ppmPecas.ppm,
      pecasNc: ppmPecas.ncQt,
      pecasTotal: ppmPecas.totalQt,
      ppmSku,
      eficiencia,
      recebidas: efficiency.recebidas,
      inspecionadas: efficiency.inspecionadas,
      alertas,
      rncs,
    },
    ppm,
    ppmAno,
    indiceNC,
    eficienciaMensal,
    pareto,
    melhores,
    criticos,
    qld,
    leitura,
  };
}

export type Meeting = ReturnType<typeof buildMeeting>;

/* ------------------------------ Specs ------------------------------ */

export function specKpis(m: Meeting): SlideSpec {
  const k = m.kpis;
  return kpiSpec([
    {
      label: "PPM (peças)",
      value: num(k.ppmPecas),
      hint: `${num(k.pecasNc)} NC / ${num(k.pecasTotal)} peças`,
      tone: "purple",
    },
    {
      label: "Inspeções",
      value: num(k.totalInspecoes),
      hint: `${num(k.aprovados)} aprovadas`,
      tone: "blue",
    },
    {
      label: "Reprovados",
      value: num(k.reprovados),
      hint: `${num(k.condicionais)} condicionais`,
      tone: "red",
    },
    {
      label: "Eficiência",
      value: pct(k.eficiencia),
      hint: `${num(k.inspecionadas)} de ${num(k.recebidas)} recebidas`,
      tone: k.eficiencia >= 95 ? "green" : "amber",
    },
    {
      label: "QLD + QLDE",
      value: moedaBR.format(m.qld.totalValor),
      hint: `${num(m.qld.totalQuantidade)} peças ativas`,
      tone: "amber",
    },
    {
      label: "Alertas · RNCs",
      value: `${num(k.alertas)} · ${num(k.rncs)}`,
      hint: "Ocorrências no período",
      tone: "neutral",
    },
  ]);
}

export function specPpm(m: Meeting, mode: PpmMode): SlideSpec {
  return chartSpec(
    {
      kind: "bar",
      categories: m.ppm.map((x) => x.mes),
      series: [
        {
          name: mode === "sku" ? "PPM por SKU" : "PPM por peças",
          values: m.ppm.map((x) => (mode === "sku" ? x.ppmSku : x.ppmPecas)),
          color: "7C3AED",
        },
      ],
    },
    [
      {
        label: "Acumulado do ano",
        value: num(mode === "sku" ? m.ppmAno.ppmSku : m.ppmAno.ppmPecas),
        tone: "purple",
      },
      {
        label: mode === "sku" ? "Inspeções reprovadas" : "Peças NC",
        value: num(mode === "sku" ? m.ppmAno.reprovadas : m.ppmAno.pecasNc),
        hint:
          mode === "sku"
            ? `de ${num(m.ppmAno.inspecoes)} inspeções`
            : `de ${num(m.ppmAno.pecas)} peças`,
        tone: "red",
      },
    ],
  );
}

export function specIndiceNC(m: Meeting, mode: NcMode): SlideSpec {
  const serie = m.indiceNC(mode);
  return chartSpec({
    kind: "line",
    categories: serie.map((x) => x.mes),
    series: [
      {
        name: mode === "inspecoes" ? "Índice NC (inspeções)" : "Índice NC (SKU único)",
        values: serie.map((x) => x.indice),
        color: "E30613",
      },
    ],
    format: "percent",
    target: { value: 2, label: "Meta 2%" },
  });
}

export function specEficiencia(m: Meeting): SlideSpec {
  return chartSpec({
    kind: "combo",
    categories: m.eficienciaMensal.map((x) => x.mes),
    series: [
      {
        name: "Recebidas",
        values: m.eficienciaMensal.map((x) => x.recebidas),
        type: "bar",
        color: "94A3B8",
      },
      {
        name: "Inspecionadas",
        values: m.eficienciaMensal.map((x) => x.inspecionadas),
        type: "bar",
        color: "2563EB",
      },
      {
        name: "Eficiência (%)",
        values: m.eficienciaMensal.map((x) => x.eficiencia),
        type: "line",
        secondary: true,
        color: "16A34A",
      },
    ],
    secondaryFormat: "percent",
  });
}

export function specPareto(m: Meeting): SlideSpec {
  return chartSpec({
    kind: "combo",
    categories: m.pareto.map((x) => x.nome),
    series: [
      {
        name: "Ocorrências",
        values: m.pareto.map((x) => x.ocorrencias),
        type: "bar",
        color: "E30613",
      },
      {
        name: "% acumulado",
        values: m.pareto.map((x) => x.acumulado),
        type: "line",
        secondary: true,
        color: "D97706",
      },
    ],
    secondaryFormat: "percent",
  });
}

export function specFornecedores(list: Meeting["criticos"]): SlideSpec {
  return tableSpec(
    ["Fornecedor", "Inspeções", "Aprovadas", "Reprovadas", "Índice NC"],
    list.map((x) => [
      x.fornecedor,
      num(x.total),
      num(x.aprovados),
      num(x.reprovados),
      pct(x.indiceNC),
    ]),
  );
}

export function specQld(m: Meeting): SlideSpec {
  return kpiSpec([
    {
      label: "QLD · 522",
      value: moedaBR.format(m.qld.qldValor),
      hint: `${num(m.qld.qldQuantidade)} peças · ${m.qld.qldSkus} SKUs`,
      tone: "amber",
    },
    {
      label: "QLDE · 523",
      value: moedaBR.format(m.qld.qldeValor),
      hint: `${num(m.qld.qldeQuantidade)} peças · ${m.qld.qldeSkus} SKUs`,
      tone: "red",
    },
    {
      label: "Exposição ativa",
      value: moedaBR.format(m.qld.totalValor),
      hint: `${num(m.qld.totalQuantidade)} peças`,
      tone: "neutral",
    },
    {
      label: "Resolvidos",
      value: num(m.qld.resolvidos.length),
      hint: moedaBR.format(m.qld.resolvidosValor),
      tone: "green",
    },
  ]);
}

export function meetingSlides(
  m: Meeting,
  opts: { ncMode: NcMode; ppmMode: PpmMode },
): PptxSlideInput[] {
  const periodo =
    m.periodo === "Todos os períodos" ? `Ano-base ${m.year}` : `Período: ${m.periodo}`;
  return [
    {
      title: "Reunião Mensal da Qualidade",
      spec: {
        type: "cover",
        title: "Reunião Mensal da Qualidade",
        subtitle: `Gestão da Qualidade de Fornecedores · ${periodo}`,
        meta: new Date().toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
      },
    },
    { title: "Indicadores executivos", subtitle: periodo, spec: specKpis(m) },
    {
      title: "PPM mês a mês",
      subtitle:
        opts.ppmMode === "sku"
          ? "Linhas reprovadas ÷ linhas da planilha × 1.000.000 (cada linha = 1 SKU)"
          : "Peças NC ÷ peças inspecionadas × 1.000.000",
      spec: specPpm(m, opts.ppmMode),
    },
    {
      title: "Índice de Não Conformidade",
      subtitle: `${opts.ncMode === "inspecoes" ? "Por inspeções" : "Por SKU único"} · meta máxima 2%`,
      spec: specIndiceNC(m, opts.ncMode),
    },
    {
      title: "Eficiência das inspeções",
      subtitle: "Recebidas × inspecionadas × eficiência (meta 95%)",
      spec: specEficiencia(m),
    },
    {
      title: "Pareto das reprovações",
      subtitle: "Principais causas e percentual acumulado",
      spec: specPareto(m),
    },
    {
      title: "Fornecedores críticos",
      subtitle: "Maior índice de reprovação no período",
      spec: specFornecedores(m.criticos),
    },
    {
      title: "Melhores fornecedores",
      subtitle: "Menor índice de reprovação (mín. 5 inspeções)",
      spec: specFornecedores(m.melhores),
    },
    {
      title: "QLD / QLDE",
      subtitle: "Exposição financeira ativa dos depósitos 522 e 523",
      spec: specQld(m),
    },
    {
      title: "Leitura executiva",
      subtitle: "Fatos do período gerados a partir dos dados do QualiHub",
      spec: textSpec(m.leitura),
    },
    {
      title: "Obrigado",
      spec: {
        type: "section",
        title: "Obrigado!",
        subtitle: "Dúvidas, decisões e próximos passos",
      },
    },
  ];
}
