import { createServerFn } from "@tanstack/react-start";
import {
  mapIDF,
  mapAlerta,
  mapRNC,
  scoreFornecedores,
  DEFAULT_CONFIG,
  type AppConfig,
  type IrBucket,
  type NcWeights,
  type NotaOverride,
} from "./idf-calc";
import type { DashboardData } from "./types";

const SPREADSHEET_ID = "1ockGLmUaeC7u0QpwxROYo2rIz-40RnUC8oRGZwrq2Q0";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzmgoSKMH0PZdPPLKlKFcNaxWEL9ybC8-NuNMDTRbTcT0xDt6YWRmj5ejBnWldPheI/exec";

function csvUrl(sheetName: string) {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      cell += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

type CacheEntry = { at: number; promise: Promise<string[][]> };
const sheetCache = new Map<string, CacheEntry>();
const SHEET_TTL_MS = 30_000;

function clearSheetCache() {
  sheetCache.clear();
}

function fetchPublicSheetCached(sheetName: string) {
  const now = Date.now();
  const hit = sheetCache.get(sheetName);

  if (hit && now - hit.at < SHEET_TTL_MS) return hit.promise;

  const promise = fetchPublicSheet(sheetName).catch((e) => {
    sheetCache.delete(sheetName);
    throw e;
  });

  sheetCache.set(sheetName, { at: now, promise });
  return promise;
}

async function fetchPublicSheet(sheetName: string, retries = 4): Promise<string[][]> {
  let delay = 800;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(csvUrl(sheetName));
    const txt = await res.text();

    if (res.ok) return parseCsv(txt);

    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await new Promise((r) => setTimeout(r, delay + Math.random() * 300));
      delay *= 2;
      continue;
    }

    throw new Error(`Erro ao buscar aba ${sheetName}: ${res.status} - ${txt.slice(0, 300)}`);
  }

  throw new Error(`Erro ao buscar aba ${sheetName}: esgotadas as tentativas`);
}

async function postToAppsScript(payload: Record<string, unknown>) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const txt = await res.text();

  try {
    return JSON.parse(txt);
  } catch {
    return { ok: res.ok, raw: txt };
  }
}

function value(row: string[], idx: number) {
  return String(row[idx] ?? "").trim();
}

async function loadConfig(): Promise<AppConfig> {
  return DEFAULT_CONFIG;
}

async function loadOverrides(): Promise<Map<string, NotaOverride>> {
  try {
    const values = await fetchPublicSheetCached("NOTA_OVERRIDE");
    const rows = values.slice(1);
    const m = new Map<string, NotaOverride>();

    for (const row of rows) {
      const processo = value(row, 0);
      const codigo_item = value(row, 1);
      const lote = value(row, 2);
      const nota_final = Number(value(row, 3));
      const motivo = value(row, 4);
      const observacao = value(row, 5);
      const autor = value(row, 6);
      const updated_at = value(row, 7);

      if (!processo || !codigo_item || Number.isNaN(nota_final)) continue;

      m.set(`${processo}__${codigo_item}__${lote}`, {
        processo,
        codigo_item,
        lote,
        nota_final,
        motivo,
        observacao,
        autor,
        updated_at,
      });
    }

    return m;
  } catch {
    return new Map();
  }
}

export const getDashboardData = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardData> => {
    const [cfg, overrides, idfValues, alertaValues, rncValues] = await Promise.all([
      loadConfig(),
      loadOverrides(),
      fetchPublicSheetCached("IDF"),
      fetchPublicSheetCached("ALERTA"),
      fetchPublicSheetCached("RNC"),
    ]);

    const idf = mapIDF(idfValues ?? [], cfg, overrides);
    const alerta = mapAlerta(alertaValues ?? []);
    const rnc = mapRNC(rncValues ?? []);
    const fornecedores = scoreFornecedores(idf, alerta, rnc, cfg.irBuckets);

    const divisoes = Array.from(
      new Set([
        ...idf.map((r) => r.divisao),
        ...alerta.map((r) => r.divisao),
        ...rnc.map((r) => r.divisao),
      ]),
    )
      .filter(Boolean)
      .sort();

    return { idf, alerta, rnc, fornecedores, divisoes, fetchedAt: new Date().toISOString() };
  },
);

export const getAppConfig = createServerFn({ method: "GET" }).handler(async () => {
  return await loadConfig();
});

async function logAudit(entry: {
  autor: string;
  acao: string;
  entidade: string;
  entidade_id?: string | null;
  fornecedor?: string | null;
  item?: string | null;
  dados?: Record<string, unknown> | null;
}) {
  try {
    await postToAppsScript({
      action: "audit",
      autor: entry.autor,
      acao: entry.acao,
      entidade: entry.entidade,
      entidade_id: entry.entidade_id ?? "",
      fornecedor: entry.fornecedor ?? "",
      item: entry.item ?? "",
      dados: JSON.stringify(entry.dados ?? {}),
    });
    clearSheetCache();
  } catch (e) {
    console.error("audit_log insert failed", e);
  }
}

export const saveAppConfig = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      irWindowDays: number;
      irPointsPerRecurrence: number;
      irBuckets: IrBucket[];
      irStatusFilter: string;
      ncWeights: NcWeights;
      autor?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    await logAudit({
      autor: data.autor?.trim() || "Sistema",
      acao: "config_atualizada",
      entidade: "app_config",
      entidade_id: "global",
      dados: data as any,
    });

    return { ok: true };
  });

export const saveNotaOverride = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      processo: string;
      codigo_item: string;
      lote?: string;
      nota_final: number;
      motivo: string;
      observacao?: string;
      autor: string;
      fornecedor?: string;
      item?: string;
    }) => {
      if (!d.processo) throw new Error("Processo obrigatório");
      if (!d.codigo_item) throw new Error("Código do item obrigatório");
      if (!d.motivo?.trim()) throw new Error("Motivo obrigatório");
      if (!d.autor?.trim()) throw new Error("Autor obrigatório");
      if (typeof d.nota_final !== "number" || isNaN(d.nota_final)) throw new Error("Nota inválida");
      return d;
    },
  )
  .handler(async ({ data }) => {
    const lote = (data.lote ?? "").trim();

    const result = await postToAppsScript({
      action: "saveNotaOverride",
      processo: data.processo,
      codigo_item: data.codigo_item,
      lote,
      nota_final: data.nota_final,
      motivo: data.motivo.trim(),
      observacao: data.observacao?.trim() || "",
      autor: data.autor.trim(),
      fornecedor: data.fornecedor ?? "",
      item: data.item ?? data.codigo_item,
    });

    if (result?.ok === false) {
      throw new Error(result?.error || "Erro ao salvar nota na planilha");
    }

    clearSheetCache();
    return { ok: true };
  });

export const deleteNotaOverride = createServerFn({ method: "POST" })
  .inputValidator((d: { processo: string; codigo_item: string; lote?: string; autor?: string; fornecedor?: string; item?: string }) => d)
  .handler(async ({ data }) => {
    await logAudit({
      autor: data.autor?.trim() || "Sistema",
      acao: "nota_restaurada",
      entidade: "nota_override",
      entidade_id: `${data.processo}/${data.codigo_item}/${data.lote ?? ""}`,
      fornecedor: data.fornecedor ?? null,
      item: data.item ?? data.codigo_item,
    });

    clearSheetCache();
    return { ok: true };
  });

export type RncEvidencia = {
  id: string;
  rnc_id: string;
  url: string;
  nome: string;
  tipo: string | null;
  observacao: string | null;
  autor: string;
  created_at: string;
};

export const listEvidencias = createServerFn({ method: "GET" })
  .inputValidator((d: { rncId: string }) => d)
  .handler(async ({ data }): Promise<RncEvidencia[]> => {
    try {
      const values = await fetchPublicSheetCached("EVIDENCIAS");
      return values
        .slice(1)
        .map((row) => ({
          id: value(row, 0),
          rnc_id: value(row, 1),
          url: value(row, 2),
          nome: value(row, 3),
          tipo: value(row, 4) || null,
          observacao: value(row, 5) || null,
          autor: value(row, 6),
          created_at: value(row, 7),
        }))
        .filter((r) => r.rnc_id === data.rncId)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    } catch {
      return [];
    }
  });

export const addEvidencia = createServerFn({ method: "POST" })
  .inputValidator((d: { rnc_id: string; url?: string; nome: string; tipo?: string; observacao?: string; autor: string; file_base64?: string }) => {
    if (!d.rnc_id) throw new Error("RNC obrigatório");
    if (!d.nome) throw new Error("Nome obrigatório");
    if (!d.url && !d.file_base64) throw new Error("Arquivo ou URL obrigatório");
    if (!d.autor?.trim()) throw new Error("Autor obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const result = await postToAppsScript({
      action: "addEvidencia",
      rnc_id: data.rnc_id,
      url: data.url ?? "",
      nome: data.nome,
      tipo: data.tipo ?? "",
      observacao: data.observacao?.trim() || "",
      autor: data.autor.trim(),
      file_base64: data.file_base64 ?? "",
    });

    if (result?.ok === false) {
      throw new Error(result?.error || "Erro ao salvar evidência na planilha");
    }

    clearSheetCache();
    return { ok: true };
  });

export const deleteEvidencia = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; autor?: string }) => d)
  .handler(async ({ data }) => {
    await logAudit({
      autor: data.autor?.trim() || "Sistema",
      acao: "evidencia_removida",
      entidade: "rnc_evidencia",
      entidade_id: data.id,
    });

    clearSheetCache();
    return { ok: true };
  });

export type AuditEntry = {
  id: string;
  autor: string;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  fornecedor: string | null;
  item: string | null;
  dados: any;
  created_at: string;
};

export const listAuditLog = createServerFn({ method: "GET" })
  .inputValidator(
    (d: {
      autor?: string;
      entidade?: string;
      acao?: string;
      fornecedor?: string;
      item?: string;
      dataInicio?: string;
      dataFim?: string;
      limit?: number;
    } = {}) => d,
  )
  .handler(async ({ data }): Promise<AuditEntry[]> => {
    try {
      const values = await fetchPublicSheetCached("AUDITORIA");

      let rows = values.slice(1).map((row) => ({
        id: value(row, 0),
        created_at: value(row, 1),
        autor: value(row, 2),
        acao: value(row, 3),
        entidade: value(row, 4),
        entidade_id: value(row, 5) || null,
        fornecedor: value(row, 6) || null,
        item: value(row, 7) || null,
        dados: value(row, 8),
      }));

      if (data.autor) rows = rows.filter((r) => r.autor.toLowerCase().includes(data.autor!.toLowerCase()));
      if (data.entidade) rows = rows.filter((r) => r.entidade === data.entidade);
      if (data.acao) rows = rows.filter((r) => r.acao === data.acao);
      if (data.fornecedor) rows = rows.filter((r) => String(r.fornecedor ?? "").toLowerCase().includes(data.fornecedor!.toLowerCase()));
      if (data.item) rows = rows.filter((r) => String(r.item ?? "").toLowerCase().includes(data.item!.toLowerCase()));
      if (data.dataInicio) rows = rows.filter((r) => String(r.created_at) >= data.dataInicio!);
      if (data.dataFim) rows = rows.filter((r) => String(r.created_at) <= data.dataFim!);

      return rows
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, data.limit ?? 500);
    } catch {
      return [];
    }
  });
