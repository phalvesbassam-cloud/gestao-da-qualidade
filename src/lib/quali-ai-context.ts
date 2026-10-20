// Monta o "CONTEXTO QUALIHUB" enviado ao QualiAI.
// O Gemini aceita contextos grandes, então mandamos um retrato completo e
// compacto do recorte atual (agregados + detalhes das ocorrências), em vez de
// escolher pedaços pela pergunta.
import { calcPPM, parseBrDate } from "@/lib/idf-calc";
import {
  monthlyPpm,
  ppmTotals,
  referenceYear,
  isRejectedStatus,
  MESES_CURTOS,
} from "@/lib/monthly-metrics";
import { qldQuantidade, qldSummary, qldValor } from "@/lib/qld";
import type { OrgData } from "@/lib/org";
import type { DashboardData, IDFRow } from "@/lib/types";

const lower = (v: unknown) => String(v ?? "").toLowerCase();
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

function supplierTable(idf: IDFRow[]) {
  const now = Date.now();
  const d90 = 90 * 86400000;
  const map = new Map<
    string,
    {
      inspecoes: number;
      reprovadas: number;
      condicionais: number;
      pecas: number;
      pecasNc: number;
      rec: number;
      recRep: number;
      ant: number;
      antRep: number;
      problemas: Map<string, number>;
    }
  >();
  for (const r of idf) {
    const f = (r.fornecedor || "").trim();
    if (!f) continue;
    const e = map.get(f) ?? {
      inspecoes: 0,
      reprovadas: 0,
      condicionais: 0,
      pecas: 0,
      pecasNc: 0,
      rec: 0,
      recRep: 0,
      ant: 0,
      antRep: 0,
      problemas: new Map(),
    };
    const rej = isRejectedStatus(r.status);
    e.inspecoes += 1;
    e.pecas += r.quantidade || 0;
    if (rej) {
      e.reprovadas += 1;
      e.pecasNc += r.quantidade || 0;
      const p = (r.tipoProblema || r.problema || "Não informado").trim();
      e.problemas.set(p, (e.problemas.get(p) ?? 0) + 1);
    }
    if (lower(r.status).includes("condicional")) e.condicionais += 1;
    const t = r.dataReferencia?.getTime();
    if (t) {
      if (now - t <= d90) {
        e.rec += 1;
        if (rej) e.recRep += 1;
      } else if (now - t <= d90 * 2) {
        e.ant += 1;
        if (rej) e.antRep += 1;
      }
    }
    map.set(f, e);
  }
  return [...map.entries()]
    .map(([fornecedor, e]) => ({
      fornecedor,
      inspecoes: e.inspecoes,
      reprovadas: e.reprovadas,
      condicionais: e.condicionais,
      taxaReprovacaoPct: round((e.reprovadas / e.inspecoes) * 100),
      ppmPecas: e.pecas ? Math.round((e.pecasNc / e.pecas) * 1e6) : 0,
      ultimos90d: {
        inspecoes: e.rec,
        reprovadas: e.recRep,
        taxaPct: e.rec ? round((e.recRep / e.rec) * 100) : null,
      },
      de90a180d: {
        inspecoes: e.ant,
        reprovadas: e.antRep,
        taxaPct: e.ant ? round((e.antRep / e.ant) * 100) : null,
      },
      principaisProblemas: [...e.problemas.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([p, n]) => `${p} (${n})`),
    }))
    .sort((a, b) => b.reprovadas - a.reprovadas || b.inspecoes - a.inspecoes);
}

export function buildQualiAIContext(input: {
  data: DashboardData;
  efficiency: { recebidas: number; inspecionadas: number; percentual: number; pendentes: number };
  filtros: Record<string, unknown>;
  org?: OrgData | null;
}) {
  const { data, efficiency, filtros, org } = input;
  const idf = data.idf;
  const year = referenceYear(idf);
  const meses = monthlyPpm(idf, year).filter((m) => m.temDados);
  const ppm = calcPPM(idf);
  const reprovadas = idf.filter((r) => isRejectedStatus(r.status));
  const condicionais = idf.filter((r) => lower(r.status).includes("condicional"));

  const pareto = new Map<string, number>();
  for (const r of reprovadas) {
    const p = (r.tipoProblema || r.problema || "Não informado").trim();
    pareto.set(p, (pareto.get(p) ?? 0) + 1);
  }

  const inspetores = new Map<string, { inspecoes: number; reprovadas: number }>();
  for (const r of idf) {
    const n = (r.inspetorInicio || r.inspetorFinal || "").trim();
    if (!n) continue;
    const e = inspetores.get(n) ?? { inspecoes: 0, reprovadas: 0 };
    e.inspecoes += 1;
    if (isRejectedStatus(r.status)) e.reprovadas += 1;
    inspetores.set(n, e);
  }

  const itens = new Map<
    string,
    { item: string; descricao: string; fornecedor: string; inspecoes: number; reprovadas: number }
  >();
  for (const r of idf) {
    const k = r.codigoItem || "";
    if (!k) continue;
    const e = itens.get(k) ?? {
      item: k,
      descricao: r.descricaoItem,
      fornecedor: r.fornecedor,
      inspecoes: 0,
      reprovadas: 0,
    };
    e.inspecoes += 1;
    if (isRejectedStatus(r.status)) e.reprovadas += 1;
    itens.set(k, e);
  }

  const qld = qldSummary(data.qldQlde ?? []);
  const ppmAno = ppmTotals(meses);

  const context = {
    geradoEm: new Date().toISOString(),
    dadosAtualizadosEm: data.fetchedAt,
    filtrosAtivos: filtros,
    totais: {
      inspecoes: idf.length,
      aprovadas: idf.filter(
        (r) => lower(r.status).includes("aprovado") && !lower(r.status).includes("condicional"),
      ).length,
      condicionais: condicionais.length,
      reprovadas: reprovadas.length,
      indiceNcPct: idf.length ? round((reprovadas.length / idf.length) * 100) : 0,
      ppmPorPecas: ppm.ppm,
      pecasInspecionadas: ppm.totalQt,
      pecasNc: ppm.ncQt,
      ppmPorSku: idf.length ? Math.round((reprovadas.length / idf.length) * 1e6) : 0,
      eficienciaInspecaoPct: round(efficiency.percentual),
      recebidas: efficiency.recebidas,
      inspecionadas: efficiency.inspecionadas,
      recebidasSemInicio: efficiency.pendentes,
      alertasAQ: data.alerta.length,
      alertasPendentes: data.alerta.filter((a) => !a.finalizado).length,
      rncs: data.rnc.length,
      fornecedoresComInspecao: new Set(idf.map((r) => r.fornecedor).filter(Boolean)).size,
    },
    mensal: {
      ano: year,
      meses: meses.map((m) => ({
        mes: MESES_CURTOS[m.month],
        inspecoes: m.inspecoes,
        reprovadas: m.reprovadas,
        indiceNcPct: m.inspecoes ? round((m.reprovadas / m.inspecoes) * 100) : 0,
        ppmSku: m.ppmSku,
        ppmPecas: m.ppmPecas,
        recebidas: idf.filter((r) => {
          const d = parseBrDate(r.dataCriacaoInsp);
          return d && d.getFullYear() === year && d.getMonth() === m.month;
        }).length,
      })),
      acumuladoAno: { ppmSku: ppmAno.ppmSku, ppmPecas: ppmAno.ppmPecas },
    },
    paretoReprovacoes: [...pareto.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([problema, ocorrencias]) => ({ problema, ocorrencias })),
    fornecedores: supplierTable(idf).slice(0, 50),
    scoreIdfFornecedores: (data.fornecedores ?? []).slice(0, 80).map((f) => ({
      fornecedor: f.fornecedor,
      idfPct: f.idfPct,
      classificacao: f.classificacao,
      alertas: f.alertas,
      rncs: f.rncs,
      recorrencias: f.recorrencias,
    })),
    itensComMaisReprovacao: [...itens.values()]
      .filter((i) => i.reprovadas > 0)
      .sort((a, b) => b.reprovadas - a.reprovadas)
      .slice(0, 40),
    reprovacoesDetalhadas: reprovadas
      .slice()
      .sort((a, b) => (b.dataReferencia?.getTime() ?? 0) - (a.dataReferencia?.getTime() ?? 0))
      .slice(0, 120)
      .map((r) => ({
        data: r.dataInicioInsp || r.dataCriacaoInsp,
        processo: r.processo,
        fornecedor: r.fornecedor,
        item: r.codigoItem,
        descricaoItem: r.descricaoItem,
        divisao: r.divisao,
        quantidade: r.quantidade,
        tipoProblema: r.tipoProblema,
        problema: r.problema,
        descricao: r.descricaoProblema?.slice(0, 180),
        inspetor: r.inspetorInicio,
        recorrencia: r.recorrencia,
        desfecho: r.desfecho,
      })),
    condicionaisRecentes: condicionais.slice(0, 60).map((r) => ({
      data: r.dataInicioInsp,
      fornecedor: r.fornecedor,
      item: r.codigoItem,
      problema: r.tipoProblema || r.problema,
    })),
    inspetores: [...inspetores.entries()]
      .map(([nome, e]) => ({ nome, ...e }))
      .sort((a, b) => b.inspecoes - a.inspecoes),
    alertas: data.alerta.slice(0, 80).map((a) => ({
      numero: a.numero,
      data: a.dataCriacao,
      fornecedor: a.fornecedor,
      item: a.item,
      quantidade: a.qtde,
      problema: a.problema,
      status: a.finalizado ? "Finalizado" : a.statusEnvio || "Pendente",
      inspetor: a.inspetor,
    })),
    rncs: data.rnc.slice(0, 80).map((r) => ({
      rnc: r.rnc,
      data: r.data,
      item: r.item,
      cliente: r.cliente,
      assunto: r.assunto,
      status: r.statusRNC,
      prazoAnalise: r.prazoAnalise,
      prazoAcoes: r.prazoAcoes,
      acao: r.descrAcao,
      statusAcoes: r.statusAcoes,
    })),
    qldQlde: {
      regra:
        "QLD=depósito 522 (saldo livre); QLDE=depósito 523 (saldo bloqueado); check marcado = resolvido (fora da exposição).",
      qld: { valor: round(qld.qldValor), pecas: qld.qldQuantidade, skus: qld.qldSkus },
      qlde: { valor: round(qld.qldeValor), pecas: qld.qldeQuantidade, skus: qld.qldeSkus },
      exposicaoAtiva: round(qld.totalValor),
      itensAtivos: qld.ativos
        .slice()
        .sort((a, b) => qldValor(b) - qldValor(a))
        .slice(0, 80)
        .map((r) => ({
          item: r.item,
          deposito: r.deposito,
          quantidade: qldQuantidade(r),
          valor: round(qldValor(r)),
          motivo: r.motivo,
          acao: r.acao,
        })),
      resolvidos: qld.resolvidos.slice(0, 40).map((r) => ({
        item: r.item,
        deposito: r.deposito,
        valor: round(qldValor(r)),
        motivo: r.motivo,
        finalizadoEm: r.finalizadoEm,
        por: r.finalizadoPor,
      })),
    },
    equipe: org
      ? org.pessoas.map((p) => ({
          nome: p.nomeCompleto || p.nome,
          cargo: p.cargo,
          area:
            p.areaId === "lideranca"
              ? "Liderança"
              : (org.areas.find((a) => a.id === p.areaId)?.nome ?? p.areaId),
        }))
      : undefined,
  };

  return JSON.stringify(context);
}
