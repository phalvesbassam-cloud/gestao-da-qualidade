import type { IDFRow, AlertaRow, RNCRow, FornecedorScore } from "./types";

// ---- Parsing helpers ----
export function parseBrDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const t = String(s).trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    const month = parseInt(mo);
    const day = parseInt(d);
    const dt = new Date(year, month - 1, day);
    return !Number.isNaN(dt.getTime()) &&
      dt.getFullYear() === year &&
      dt.getMonth() === month - 1 &&
      dt.getDate() === day
      ? dt
      : null;
  }
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const year = parseInt(iso[1]);
    const month = parseInt(iso[2]);
    const day = parseInt(iso[3]);
    const dt = new Date(year, month - 1, day);
    return !Number.isNaN(dt.getTime()) &&
      dt.getFullYear() === year &&
      dt.getMonth() === month - 1 &&
      dt.getDate() === day
      ? dt
      : null;
  }
  return null;
}

export function num(s: unknown): number {
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
export function notaNC(
  status: string,
  criticidade: string,
  weights: NcWeights = DEFAULT_NC_WEIGHTS,
): number {
  const s = (status || "").toLowerCase().trim();
  if (!s.includes("reprov")) return 0;
  const c = (criticidade || "").toLowerCase().trim();
  if (c.includes("grave") || c.includes("crít") || c.includes("crit")) return weights.grave;
  if (
    c.includes("moder") ||
    c.includes("média") ||
    c.includes("media") ||
    c.includes("alta") ||
    c.includes("alto")
  )
    return weights.moderada;
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
export type NotaOverride = {
  processo: string;
  codigo_item: string;
  lote: string;
  nota_final: number;
  motivo: string;
  observacao: string | null;
  autor: string;
  updated_at: string;
};

export function overrideKey(processo: string, codigoItem: string, lote: string): string {
  return `${processo}__${codigoItem}__${lote}`;
}

type IDFColumnKey =
  | "processo"
  | "divisao"
  | "codigoItem"
  | "quantidade"
  | "dataCriacaoInsp"
  | "dataInicioInsp"
  | "horaRecebimento"
  | "horaInicioInsp"
  | "horaFimInsp"
  | "status"
  | "tipoProblema"
  | "problema"
  | "descricaoProblema"
  | "descricaoItem"
  | "fornecedor"
  | "lote"
  | "criticidade"
  | "nivel"
  | "codigoFornecedor"
  | "inspetorInicio"
  | "inspetorFinal"
  | "atencao";

type IDFColumnSpec = {
  headers: readonly string[];
  fallbackIndex: number;
};

// Fonte única para a interpretação da aba IDF. Os cabeçalhos oficiais vêm
// primeiro; os nomes antigos permanecem como aliases para a planilha publicada
// continuar funcionando enquanto os títulos são atualizados.
const IDF_COLUMN_SPECS: Record<IDFColumnKey, IDFColumnSpec> = {
  processo: { headers: ["Processo"], fallbackIndex: 0 },
  divisao: { headers: ["Divisão", "Divisao"], fallbackIndex: 1 },
  codigoItem: { headers: ["Código item", "Codigo item", "Código do item"], fallbackIndex: 2 },
  quantidade: { headers: ["Quantidade", "Qtde", "Qtd"], fallbackIndex: 3 },
  dataCriacaoInsp: {
    headers: [
      "Data de CRIAÇÃO",
      "Data CRIAÇÃO",
      "Data de CRIAÇÃO Inspeção",
      "Data CRIAÇÃO Inspeção",
      "Data de criação da inspeção",
      "Data de Finalização Inspeção",
    ],
    fallbackIndex: 4,
  },
  dataInicioInsp: {
    headers: [
      "Data de INICIO Inspeção",
      "Data INICIO",
      "Data de INICIO",
      "Data INICIO Inspeção",
      "Data (Recebimento)",
      "Data Recebimento",
      "Data de Recebimento",
    ],
    fallbackIndex: 8,
  },
  horaRecebimento: {
    headers: ["Horário Início (Recebimento)", "Horario Inicio (Recebimento)"],
    fallbackIndex: 5,
  },
  horaInicioInsp: {
    headers: ["Horário de Início Inspeção", "Horario de Inicio Inspecao"],
    fallbackIndex: 7,
  },
  horaFimInsp: {
    headers: ["Horário de Finalização Inspeção", "Horario de Finalizacao Inspecao"],
    fallbackIndex: 9,
  },
  status: { headers: ["Status"], fallbackIndex: 10 },
  tipoProblema: { headers: ["Tipo de Problema", "Tipo Problema"], fallbackIndex: 11 },
  problema: { headers: ["Problema"], fallbackIndex: 12 },
  descricaoProblema: {
    headers: ["Descrição do Problema", "Descricao do Problema"],
    fallbackIndex: 13,
  },
  descricaoItem: {
    headers: ["Descrição item", "Descricao item", "Descrição do item"],
    fallbackIndex: 14,
  },
  fornecedor: { headers: ["Fornecedor"], fallbackIndex: 15 },
  lote: { headers: ["LOTE", "Lote"], fallbackIndex: 16 },
  criticidade: { headers: ["Criticidade"], fallbackIndex: 17 },
  nivel: { headers: ["Nível", "Nivel"], fallbackIndex: 18 },
  codigoFornecedor: {
    headers: ["Código Fornecedor", "Codigo Fornecedor", "Código Fronecedor", "Codigo Fronecedor"],
    fallbackIndex: 19,
  },
  inspetorInicio: { headers: ["Inspetor Inicio", "Inspetor Início"], fallbackIndex: 20 },
  inspetorFinal: { headers: ["Inspetor Final"], fallbackIndex: 21 },
  atencao: { headers: ["Atenção", "Atencao"], fallbackIndex: 22 },
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function findIDFHeaderRow(rows: readonly unknown[][]): number {
  const expected = ["processo", "divisao", "codigo item", "quantidade", "status"];
  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = new Set((rows[i] ?? []).map(normalizeHeader));
    const score = expected.reduce((total, header) => total + (cells.has(header) ? 1 : 0), 0);
    if (score > bestScore) {
      bestIndex = i;
      bestScore = score;
    }
  }

  return bestIndex;
}

function resolveIDFColumns(header: readonly unknown[]): Record<IDFColumnKey, number> {
  const normalizedHeader = header.map(normalizeHeader);
  const headerIndex = new Map<string, number>();

  normalizedHeader.forEach((normalized, index) => {
    if (normalized && !headerIndex.has(normalized)) headerIndex.set(normalized, index);
  });

  const resolved = {} as Record<IDFColumnKey, number>;

  for (const key of Object.keys(IDF_COLUMN_SPECS) as IDFColumnKey[]) {
    const spec = IDF_COLUMN_SPECS[key];
    const byHeader = spec.headers
      .map((name) => headerIndex.get(normalizeHeader(name)))
      .find((index): index is number => index !== undefined);
    resolved[key] = byHeader ?? spec.fallbackIndex;
  }

  /*
   * Perfil documentado da aba IDF publicada em 03/09/2026.
   *
   * Nessa fonte, os dois títulos de data foram trocados, mas os valores não:
   * - a data imediatamente antes de "Horário Início (Recebimento)" é a criação/recebimento;
   * - a data imediatamente antes de "Horário de Finalização Inspeção" é o início operacional.
   *
   * A confirmação não depende da ordem cronológica: os mesmos processos (por exemplo,
   * 13257 e 13356) constam na evidência operacional com essas semânticas. O perfil só
   * é aplicado quando a assinatura completa dos cabeçalhos trocados está presente;
   * planilhas com os títulos oficiais continuam resolvidas normalmente por nome.
   */
  const receiptTimeIndex = normalizedHeader.indexOf("horario inicio recebimento");
  const inspectionFinishTimeIndex = normalizedHeader.indexOf("horario de finalizacao inspecao");
  const creationValueIndex = receiptTimeIndex - 1;
  const inspectionValueIndex = inspectionFinishTimeIndex - 1;
  const isPublishedIDFWithSwappedDateTitles =
    receiptTimeIndex > 0 &&
    inspectionFinishTimeIndex > 0 &&
    normalizedHeader[creationValueIndex] === "data de inicio inspecao" &&
    normalizedHeader[inspectionValueIndex] === "data criacao" &&
    normalizedHeader.includes("inspetor inicio") &&
    normalizedHeader.includes("status");

  if (isPublishedIDFWithSwappedDateTitles) {
    resolved.dataCriacaoInsp = creationValueIndex;
    resolved.dataInicioInsp = inspectionValueIndex;
  }

  return resolved;
}

export function mapIDF(
  rows: readonly unknown[][],
  config: AppConfig = DEFAULT_CONFIG,
  overrides: Map<string, NotaOverride> = new Map(),
): IDFRow[] {
  const out: IDFRow[] = [];
  if (rows.length === 0) return out;

  const headerRowIndex = findIDFHeaderRow(rows);
  const columns = resolveIDFColumns(rows[headerRowIndex] ?? []);
  const cell = (row: readonly unknown[], key: IDFColumnKey) =>
    String(row[columns[key]] ?? "").trim();

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const processo = cell(r, "processo");
    if (!processo) continue;

    const status = cell(r, "status");
    const criticidade = cell(r, "criticidade");
    const ncAuto = notaNC(status, criticidade, config.ncWeights);
    const codigoItem = cell(r, "codigoItem");
    const lote = cell(r, "lote");
    const dataCriacaoInsp = cell(r, "dataCriacaoInsp");
    const dataInicioInsp = cell(r, "dataInicioInsp");
    const ov = overrides.get(overrideKey(processo, codigoItem, lote));
    const ncFinal = ov ? Number(ov.nota_final) : ncAuto;

    out.push({
      processo,
      divisao: cell(r, "divisao"),
      codigoItem,
      quantidade: num(cell(r, "quantidade")),
      dataCriacaoInsp,
      dataInicioInsp,
      dataRecebimento: dataCriacaoInsp,
      dataFimInsp: dataInicioInsp,
      horaRecebimento: cell(r, "horaRecebimento"),
      horaInicioInsp: cell(r, "horaInicioInsp"),
      horaFimInsp: cell(r, "horaFimInsp"),
      status,
      tipoProblema: cell(r, "tipoProblema"),
      problema: cell(r, "problema"),
      descricaoProblema: cell(r, "descricaoProblema"),
      descricaoItem: cell(r, "descricaoItem"),
      fornecedor: cell(r, "fornecedor").toUpperCase() || "—",
      criticidade,
      nivel: cell(r, "nivel"),
      codigoFornecedor: cell(r, "codigoFornecedor"),
      inspetorInicio: cell(r, "inspetorInicio"),
      inspetorFinal: cell(r, "inspetorFinal"),
      atencao: cell(r, "atencao"),
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
      desfecho: "Não analisado",
      desfechoData: undefined,
      desfechoProcesso: undefined,
      dataReferencia: parseBrDate(dataInicioInsp),
    });
  }

  return applyDesfechoReprovacao(applyIR(out, config));
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

    const key = `${norm(r.fornecedor)}|${norm(r.codigoItem)}|${norm(r.tipoProblema || r.problema)}`;
    const hist = history.get(key) || [];
    const lote = norm(r.lote);

    let recurrenceCount = 0;

    for (const prev of hist) {
      const diff = r.dataReferencia.getTime() - prev.date.getTime();
      if (diff <= 0 || diff > windowMs) continue;

      if (lote && prev.lote) {
        if (prev.lote !== lote) recurrenceCount++;
      } else {
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
// ---- Desfecho pós-reprovação ----
// Para cada linha reprovada, verifica se depois dela apareceu nova inspeção
// do mesmo fornecedor + item.
function applyDesfechoReprovacao(rows: IDFRow[]): IDFRow[] {
  const norm = (s: string) =>
    (s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const isReprovado = (s: string) => norm(s).includes("reprov");

  const isAprovado = (s: string) => {
    const v = norm(s);
    return v.includes("aprov") && !v.includes("condicional") && !v.includes("reprov");
  };

  const keyItemFornecedor = (r: IDFRow) => `${norm(r.fornecedor)}|${norm(r.codigoItem)}`;

  const keyProblema = (r: IDFRow) =>
    `${norm(r.fornecedor)}|${norm(r.codigoItem)}|${norm(r.tipoProblema || r.problema)}`;

  const processoNum = (r: IDFRow) => Number(String(r.processo || "").replace(/\D/g, "")) || 0;

  const isPosterior = (base: IDFRow, candidato: IDFRow) => {
    const baseData = base.dataReferencia?.getTime() ?? 0;
    const candData = candidato.dataReferencia?.getTime() ?? 0;

    if (baseData && candData) {
      if (candData !== baseData) return candData > baseData;
      return processoNum(candidato) > processoNum(base);
    }

    return processoNum(candidato) > processoNum(base);
  };

  const all = [...rows].sort((a, b) => {
    const da = a.dataReferencia?.getTime() ?? 0;
    const db = b.dataReferencia?.getTime() ?? 0;

    if (da !== db) return da - db;

    return processoNum(a) - processoNum(b);
  });

  for (const row of rows) {
    if (!isReprovado(row.status)) {
      row.desfecho = "Não analisado";
      row.desfechoData = undefined;
      row.desfechoProcesso = undefined;
      continue;
    }

    const posterioresMesmoItem = all.filter((r) => {
      if (r === row) return false;
      if (keyItemFornecedor(r) !== keyItemFornecedor(row)) return false;
      return isPosterior(row, r);
    });

    const posterioresMesmoProblema = posterioresMesmoItem.filter((r) => {
      return keyProblema(r) === keyProblema(row);
    });

    const reprovouDepois = posterioresMesmoProblema.find((r) => isReprovado(r.status));
    const aprovadoDepois = posterioresMesmoItem.find((r) => isAprovado(r.status));

    if (reprovouDepois) {
      row.desfecho = "Reprovou novamente";
      row.desfechoData = reprovouDepois.dataInicioInsp;
      row.desfechoProcesso = reprovouDepois.processo;
    } else if (aprovadoDepois) {
      row.desfecho = "Aprovado depois";
      row.desfechoData = aprovadoDepois.dataInicioInsp;
      row.desfechoProcesso = aprovadoDepois.processo;
    } else {
      row.desfecho = "Sem nova entrada";
      row.desfechoData = undefined;
      row.desfechoProcesso = undefined;
    }
  }

  return rows;
}

export function mapAlerta(rows: unknown[][]): AlertaRow[] {
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
      fornecedor:
        String(r[8] ?? "")
          .trim()
          .toUpperCase() || "—",
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

export function mapRNC(rows: unknown[][]): RNCRow[] {
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

    if (s.includes("aprovação condicional") || s.includes("aprovacao condicional")) {
      f.condicionais++;
    } else if (s.includes("reprov")) {
      f.reprovados++;
    } else if (s.includes("aprovado")) {
      f.aprovados++;
    }

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

    if (!m) {
      m = new Map();
      counts.set(r.codigoItem, m);
    }

    m.set(r.fornecedor, (m.get(r.fornecedor) || 0) + 1);
  }

  const out = new Map<string, string>();

  for (const [item, m] of counts) {
    let best = "";
    let n = 0;

    for (const [f, c] of m) {
      if (c > n) {
        best = f;
        n = c;
      }
    }

    if (best) out.set(item, best);
  }

  return out;
}
