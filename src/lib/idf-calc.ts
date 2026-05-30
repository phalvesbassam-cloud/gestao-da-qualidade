import type { IDFRow, AlertaRow, RNCRow, FornecedorScore } from "./types";

// ---- Parsing helpers ----
export function parseBrDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const t = String(s).trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    const dt = new Date(year, parseInt(mo) - 1, parseInt(d));
    return isNaN(dt.getTime()) ? null : dt;
  }
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const dt = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    return isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

export function num(s: any): number {
  if (s === null || s === undefined || s === "") return 0;
  const n = Number(String(s).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

// ---- Configuração de IR (carregada de app_config) ----
export type IrBucket = { max: number; pct: number };
export type NcWeights = { grave: number; moderada: number; leve: number; melhoria: number };
export type AppConfig = {
  irWindowDays: number;
  irPointsPerRecurrence: number;
  irBuckets: IrBucket[];
  irStatusFilter: "reprovado" | "reprovado+condicional";
  ncWeights: NcWeights;
};

export const DEFAULT_NC_WEIGHTS: NcWeights = { grave: 8, moderada: 4, leve: 2, melhoria: 0 };

export const DEFAULT_CONFIG: AppConfig = {
  irWindowDays: 365,
  irPointsPerRecurrence: 5,
  irBuckets: [
    { max: 0, pct: 100 },
    { max: 5, pct: 90 },
    { max: 10, pct: 60 },
    { max: 15, pct: 30 },
    { max: 999999, pct: 0 },
  ],
  irStatusFilter: "reprovado",
  ncWeights: DEFAULT_NC_WEIGHTS,
};

export function irPercent(ir: number, buckets: IrBucket[] = DEFAULT_CONFIG.irBuckets): number {
  for (const b of buckets) if (ir <= b.max) return b.pct;
  return 0;
}

// ---- Nota NC por linha (com pesos configuráveis) ----
export function notaNC(status: string, criticidade: string, weights: NcWeights = DEFAULT_NC_WEIGHTS): number {
  const s = (status || "").toLowerCase().trim();
  if (!s.includes("reprov")) return 0;
  const c = (criticidade || "").toLowerCase().trim();
  if (c.includes("grave") || c.includes("crít") || c.includes("crit")) return weights.grave;
  if (c.includes("moder") || c.includes("média") || c.includes("media") || c.includes("alta") || c.includes("alto")) return weights.moderada;
  if (c.includes("leve") || c.includes("baixa") || c.includes("baixo")) return weights.leve;
  if (c.includes("melhor")) return weights.melhoria;
  return weights.moderada;
}

// ---- IDF% pelo total de pontos NC ----
export function idfPercentFromNC(nc: number): number {
  if (nc <= 0) return 100;
  if (nc <= 8) return 90;
  if (nc <= 16) return 80;
  if (nc <= 20) return 60;
  if (nc <= 28) return 40;
  if (nc <= 32) return 20;
  return 0;
}

export function classificacaoFromIdf(pct: number): {
  cls: "A" | "B" | "C" | "D";
  status: "verde" | "azul" | "amarelo" | "vermelho";
  label: string;
} {
  if (pct >= 100) return { cls: "A", status: "verde", label: "Excelente" };
  if (pct >= 90) return { cls: "A", status: "verde", label: "Muito Bom" };
  if (pct >= 80) return { cls: "B", status: "azul", label: "Bom" };
  if (pct >= 60) return { cls: "C", status: "amarelo", label: "Atenção" };
  if (pct >= 40) return { cls: "D", status: "vermelho", label: "Crítico" };
  if (pct >= 20) return { cls: "D", status: "vermelho", label: "Muito Crítico" };
  return { cls: "D", status: "vermelho", label: "Bloqueado" };
}

// ---- Mapeadores ----
export type NotaOverride = { processo: string; codigo_item: string; lote: string; nota_final: number; motivo: string; observacao: string | null; autor: string; updated_at: string };

export function overrideKey(processo: string, codigoItem: string, lote: string): string {
  return `${processo}__${codigoItem}__${lote}`;
}

export function mapIDF(
  rows: any[][],
  config: AppConfig = DEFAULT_CONFIG,
  overrides: Map<string, NotaOverride> = new Map(),
): IDFRow[] {
  const out: IDFRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    if (!r[0]) continue;
    // Colunas reais da planilha IDF:
    // A Processo | B Divisão | C Código item | D Quantidade
    // E Data Finalização Insp | F Hora Recebimento | G Data Início Insp | H Hora Início Insp
    // I Data Recebimento | J Hora Finalização Insp | K Status | L Tipo de Problema
    // M Problema | N Descrição do Problema | O Descrição item | P Fornecedor
    // Q LOTE | R Criticidade | S Nível | T Código Fornecedor
    // U Inspetor Início | V Inspetor Final | W Atenção
    const status = String(r[10] ?? "");
    const criticidade = String(r[17] ?? "");
    const ncAuto = notaNC(status, criticidade, config.ncWeights);
    const processo = String(r[0] ?? "");
    const codigoItem = String(r[2] ?? "");
    const lote = String(r[16] ?? "").trim();
    const ov = overrides.get(overrideKey(processo, codigoItem, lote));
    const ncFinal = ov ? Number(ov.nota_final) : ncAuto;
    out.push({
      processo,
      divisao: String(r[1] ?? ""),
      codigoItem: String(r[2] ?? ""),
      quantidade: num(r[3]),
      dataRecebimento: String(r[8] ?? ""),
      horaRecebimento: String(r[5] ?? ""),
      dataInicioInsp: String(r[6] ?? ""),
      horaInicioInsp: String(r[7] ?? ""),
      dataFimInsp: String(r[4] ?? ""),
      horaFimInsp: String(r[9] ?? ""),
      status,
      tipoProblema: String(r[11] ?? ""),
      problema: String(r[12] ?? ""),
      descricaoProblema: String(r[13] ?? ""),
      descricaoItem: String(r[14] ?? ""),
      fornecedor: String(r[15] ?? "").trim().toUpperCase() || "—",
      criticidade,
      nivel: String(r[18] ?? ""),
      codigoFornecedor: String(r[19] ?? ""),
      inspetorInicio: String(r[20] ?? ""),
      inspetorFinal: String(r[21] ?? ""),
      atencao: String(r[22] ?? ""),
      lote,
      notaNC: ncFinal,
      notaNCBase: ncFinal,
      notaNCAuto: ncAuto,
      notaOverride: !!ov,
      overrideMotivo: ov?.motivo,
      overrideObservacao: ov?.observacao ?? undefined,
      overrideAutor: ov?.autor,
      overrideAt: ov?.updated_at,
      recorrencia: 0,
      irPoints: 0,
      dataReferencia: parseBrDate(String(r[8] ?? "")),
    });
  }
  return applyIR(out, config);
}

// ---- Cálculo IR (híbrido: com ou sem lote) ----
// Regra completa (com lote nos dois registros): fornecedor + item + problema + LOTE DIFERENTE + janela.
// Regra legada (algum dos registros sem lote): fornecedor + item + problema + janela.
// Detecta automaticamente por linha — sem configuração manual.
function applyIR(rows: IDFRow[], cfg: AppConfig): IDFRow[] {
  const norm = (s: string) => (s || "").trim().toLowerCase();
  const matchesStatus = (s: string) => {
    const l = s.toLowerCase();
    if (cfg.irStatusFilter === "reprovado+condicional") {
      return l.includes("reprov") || l.includes("condicional");
    }
    return l.includes("reprov");
  };

  const indexed = rows.map((r, i) => ({ r, i }));
  indexed.sort((a, b) => {
    const da = a.r.dataReferencia?.getTime() ?? 0;
    const db = b.r.dataReferencia?.getTime() ?? 0;
    if (da !== db) return da - db;
    return a.i - b.i;
  });

  const history = new Map<string, { date: Date; lote: string }[]>();
  const windowMs = cfg.irWindowDays * 24 * 60 * 60 * 1000;

  for (const { r } of indexed) {
    if (!matchesStatus(r.status)) continue;
    if (!r.dataReferencia) continue;
    const key = `${norm(r.fornecedor)}|${norm(r.codigoItem)}|${norm(r.problema || r.tipoProblema)}`;
    const hist = history.get(key) || [];
    const lote = norm(r.lote);

    let recurrenceCount = 0;
    for (const prev of hist) {
      const diff = r.dataReferencia.getTime() - prev.date.getTime();
      if (diff <= 0 || diff > windowMs) continue;
      if (lote && prev.lote) {
        // ambos têm lote → exige lote diferente
        if (prev.lote !== lote) recurrenceCount++;
      } else {
        // legado: algum dos lados sem lote → conta recorrência do trio
        recurrenceCount++;
      }
    }

    if (recurrenceCount > 0) {
      r.recorrencia = recurrenceCount;
      r.irPoints = cfg.irPointsPerRecurrence * recurrenceCount;
    }

    hist.push({ date: r.dataReferencia, lote });
    history.set(key, hist);
  }

  return rows;
}

export function mapAlerta(rows: any[][]): AlertaRow[] {
  const out: AlertaRow[] = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] || [];
    if (!r[0]) continue;
    out.push({
      numero: String(r[0] ?? ""),
      dataCriacao: String(r[1] ?? ""),
      item: String(r[2] ?? ""),
      qtde: num(r[3]),
      lote: String(r[4] ?? ""),
      nf: String(r[5] ?? ""),
      invoice: String(r[6] ?? ""),
      divisao: String(r[7] ?? ""),
      fornecedor: String(r[8] ?? "").trim().toUpperCase() || "—",
      codigoFornecedor: String(r[9] ?? ""),
      inspetor: String(r[10] ?? ""),
      problema: String(r[11] ?? ""),
      observacao: String(r[12] ?? ""),
      statusEnvio: String(r[13] ?? ""),
      finalizado: String(r[14] ?? "").toUpperCase() === "TRUE",
      dataReferencia: parseBrDate(String(r[1] ?? "")),
    });
  }
  return out;
}

export function mapRNC(rows: any[][]): RNCRow[] {
  const out: RNCRow[] = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] || [];
    if (!r[0]) continue;
    out.push({
      rnc: String(r[0] ?? ""),
      data: String(r[1] ?? ""),
      item: String(r[2] ?? ""),
      lote: String(r[3] ?? "").trim(),
      divisao: String(r[4] ?? ""),
      cliente: String(r[5] ?? ""),
      assunto: String(r[6] ?? ""),
      prazoAnalise: String(r[7] ?? ""),
      resultadoAnalise: String(r[8] ?? ""),
      statusAnalise: String(r[9] ?? ""),
      prazoAcoes: String(r[10] ?? ""),
      descrAcao: String(r[11] ?? ""),
      acaoConcluida: String(r[12] ?? ""),
      statusAcoes: String(r[13] ?? ""),
      verEficacia: String(r[14] ?? ""),
      dataConclusao: String(r[15] ?? ""),
      encerramento: String(r[16] ?? ""),
      statusRNC: String(r[16] ?? ""),
      dataReferencia: parseBrDate(String(r[1] ?? "")),
    });
  }
  return out;
}

// ---- Score por fornecedor ----
export function scoreFornecedores(
  idf: IDFRow[],
  alertas: AlertaRow[],
  rncs: RNCRow[],
  buckets: IrBucket[] = DEFAULT_CONFIG.irBuckets,
): FornecedorScore[] {
  const map = new Map<string, FornecedorScore>();
  const ensure = (f: string) => {
    if (!map.has(f)) {
      map.set(f, {
        fornecedor: f,
        totalInsp: 0,
        aprovados: 0,
        condicionais: 0,
        reprovados: 0,
        pontosNC: 0,
        idfPct: 100,
        classificacao: "A",
        status: "verde",
        alertas: 0,
        rncs: 0,
        ir: 0,
        irPct: 100,
        recorrencias: 0,
      });
    }
    return map.get(f)!;
  };

  for (const r of idf) {
    const f = ensure(r.fornecedor);
    f.totalInsp++;
    const s = r.status.toLowerCase();
    if (s.includes("aprovação condicional") || s.includes("aprovacao condicional")) f.condicionais++;
    else if (s.includes("reprov")) f.reprovados++;
    else if (s.includes("aprovado")) f.aprovados++;
    f.pontosNC += r.notaNC;
    f.ir += r.irPoints;
    if (r.irPoints > 0) f.recorrencias++;
  }
  for (const a of alertas) ensure(a.fornecedor).alertas++;

  const item2for = buildItemFornecedorMap(idf);
  for (const r of rncs) {
    const f = item2for.get(r.item);
    if (f && map.has(f)) map.get(f)!.rncs++;
  }

  for (const f of map.values()) {
    f.idfPct = idfPercentFromNC(f.pontosNC);
    const c = classificacaoFromIdf(f.idfPct);
    f.classificacao = c.cls;
    f.status = c.status;
    f.irPct = irPercent(f.ir, buckets);
  }
  return [...map.values()].sort((a, b) => b.idfPct - a.idfPct || a.pontosNC - b.pontosNC);
}

// ---- PPM ----
export function calcPPM(idf: IDFRow[]): { ppm: number; ncQt: number; totalQt: number } {
  let nc = 0;
  let total = 0;
  for (const r of idf) {
    const q = r.quantidade || 0;
    total += q;
    const s = r.status.toLowerCase();
    if (s.includes("reprov")) nc += q;
  }
  const ppm = total > 0 ? Math.round((nc / total) * 1_000_000) : 0;
  return { ppm, ncQt: nc, totalQt: total };
}

export function ppmTone(ppm: number): "success" | "warning" | "destructive" {
  if (ppm < 1000) return "success";
  if (ppm < 5000) return "warning";
  return "destructive";
}

function buildItemFornecedorMap(idf: IDFRow[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const r of idf) {
    if (!r.codigoItem || !r.fornecedor) continue;
    let m = counts.get(r.codigoItem);
    if (!m) { m = new Map(); counts.set(r.codigoItem, m); }
    m.set(r.fornecedor, (m.get(r.fornecedor) || 0) + 1);
  }
  const out = new Map<string, string>();
  for (const [item, m] of counts) {
    let best = ""; let n = 0;
    for (const [f, c] of m) if (c > n) { best = f; n = c; }
    if (best) out.set(item, best);
  }
  return out;
}
