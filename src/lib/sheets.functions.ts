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
import type { DashboardData, QLDQLDERow } from "./types";
import { encodeDashboard } from "./wire";

const SPREADSHEET_ID = "1ockGLmUaeC7u0QpwxROYo2rIz-40RnUC8oRGZwrq2Q0";
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzmgoSKMH0PZdPPLKlKFcNaxWEL9ybC8-NuNMDTRbTcT0xDt6YWRmj5ejBnWldPheI/exec";

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

  return rows;
}

function dropEmptyRows(rows: string[][]) {
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

type CacheEntry = { at: number; promise: Promise<string[][]> };
const sheetCache = new Map<string, CacheEntry>();
const SHEET_TTL_MS = 30_000;

function clearSheetCache() {
  sheetCache.clear();
  dashboardCache = null;
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

    if (res.ok) {
      const rows = parseCsv(txt);
      // QLD-QLDE mantém as linhas vazias para o número da linha bater com a planilha.
      return sheetName === "QLD-QLDE" ? rows : dropEmptyRows(rows);
    }

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

function numberBR(input: string) {
  const raw = String(input ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/R\$/gi, "");

  if (!raw) return 0;

  if (raw.includes(",")) {
    const parsed = Number(raw.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isChecked(raw: string) {
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "verdadeiro" || v === "1" || v === "sim" || v === "x";
}

function mapQLDQLDE(values: string[][]): QLDQLDERow[] {
  if (!values?.length) return [];

  const headers = values[0].map((h) =>
    String(h ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, ""),
  );

  const findColumn = (...names: string[]) => {
    const exact = headers.findIndex((header) => names.includes(header));
    if (exact >= 0) return exact;
    return headers.findIndex((header) => names.some((name) => header.includes(name)));
  };

  const idxItem = findColumn("item");
  const idxQtdeBloqueada = findColumn("qtde. bloqueada", "qtde bloqueada");
  const idxValorBloqueado = findColumn("valor bloqueado");
  const idxQtdeLivre = findColumn("qtde. livre", "qtde livre");
  const idxValorLivre = findColumn("valor livre");
  const idxDeposito = findColumn("deposito");
  const idxMotivo = findColumn("motivo");
  const idxAcao = findColumn("acao");
  const idxCheck = findColumn("check");
  const idxFinalizadoEm = findColumn("finalizado em");
  const idxFinalizadoPor = findColumn("finalizado por");
  const idxAtencao = findColumn("atencao");

  const get = (row: string[], idx: number) => (idx >= 0 ? value(row, idx) : "");

  return values
    .slice(1)
    .map((row, index) => {
      const check = get(row, idxCheck);
      return {
        row: index + 2,
        item: get(row, idxItem),
        qtdeBloqueada: numberBR(get(row, idxQtdeBloqueada)),
        valorBloqueado: numberBR(get(row, idxValorBloqueado)),
        qtdeLivre: numberBR(get(row, idxQtdeLivre)),
        valorLivre: numberBR(get(row, idxValorLivre)),
        deposito: get(row, idxDeposito),
        motivo: get(row, idxMotivo),
        acao: get(row, idxAcao),
        check,
        finalizado: isChecked(check),
        finalizadoEm: get(row, idxFinalizadoEm),
        finalizadoPor: get(row, idxFinalizadoPor),
        atencao: get(row, idxAtencao),
      };
    })
    .filter((row) => row.item || row.deposito);
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

async function buildDashboardData(): Promise<DashboardData> {
  const [cfg, overrides, idfValues, alertaValues, rncValues, qldQldeValues] = await Promise.all([
    loadConfig(),
    loadOverrides(),
    fetchPublicSheetCached("IDF"),
    fetchPublicSheetCached("ALERTA"),
    fetchPublicSheetCached("RNC"),
    fetchPublicSheetCached("QLD-QLDE"),
  ]);

  const idf = mapIDF(idfValues ?? [], cfg, overrides);
  const alerta = mapAlerta(alertaValues ?? []);
  const rnc = mapRNC(rncValues ?? []);
  const qldQlde = mapQLDQLDE(qldQldeValues ?? []);
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

  return { idf, alerta, rnc, qldQlde, fornecedores, divisoes, fetchedAt: new Date().toISOString() };
}

// Cache do painel já calculado e compactado. Responde na hora com o último
// resultado e atualiza em segundo plano quando passa de 45 s (stale-while-revalidate).
const DASHBOARD_FRESH_MS = 45_000;
const DASHBOARD_MAX_STALE_MS = 15 * 60_000;
let dashboardCache: { at: number; payload: string } | null = null;
let dashboardBuilding: Promise<string> | null = null;

function rebuildDashboard() {
  if (!dashboardBuilding) {
    dashboardBuilding = buildDashboardData()
      .then((data) => {
        const payload = encodeDashboard(data);
        dashboardCache = { at: Date.now(), payload };
        return payload;
      })
      .finally(() => {
        dashboardBuilding = null;
      });
  }
  return dashboardBuilding;
}

export const getDashboardData = createServerFn({ method: "GET" })
  .inputValidator((d: { force?: boolean } | undefined) => d ?? {})
  .handler(async ({ data }): Promise<{ payload: string }> => {
    const age = dashboardCache ? Date.now() - dashboardCache.at : Infinity;
    if (data.force || !dashboardCache || age > DASHBOARD_MAX_STALE_MS) {
      if (data.force) clearSheetCache();
      return { payload: await rebuildDashboard() };
    }
    if (age > DASHBOARD_FRESH_MS) rebuildDashboard().catch((e) => console.error("[dashboard]", e));
    return { payload: dashboardCache.payload };
  });

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
      dados: { ...data },
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
  .inputValidator(
    (d: {
      processo: string;
      codigo_item: string;
      lote?: string;
      autor?: string;
      fornecedor?: string;
      item?: string;
    }) => d,
  )
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
  .inputValidator(
    (d: {
      rnc_id: string;
      url?: string;
      nome: string;
      tipo?: string;
      observacao?: string;
      autor: string;
      file_base64?: string;
    }) => {
      if (!d.rnc_id) throw new Error("RNC obrigatório");
      if (!d.nome) throw new Error("Nome obrigatório");
      if (!d.url && !d.file_base64) throw new Error("Arquivo ou URL obrigatório");
      if (!d.autor?.trim()) throw new Error("Autor obrigatório");
      return d;
    },
  )
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
  dados: string;
  created_at: string;
};

export const listAuditLog = createServerFn({ method: "GET" })
  .inputValidator(
    (
      d: {
        autor?: string;
        entidade?: string;
        acao?: string;
        fornecedor?: string;
        item?: string;
        dataInicio?: string;
        dataFim?: string;
        limit?: number;
      } = {},
    ) => d,
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

      if (data.autor)
        rows = rows.filter((r) => r.autor.toLowerCase().includes(data.autor!.toLowerCase()));
      if (data.entidade) rows = rows.filter((r) => r.entidade === data.entidade);
      if (data.acao) rows = rows.filter((r) => r.acao === data.acao);
      if (data.fornecedor)
        rows = rows.filter((r) =>
          String(r.fornecedor ?? "")
            .toLowerCase()
            .includes(data.fornecedor!.toLowerCase()),
        );
      if (data.item)
        rows = rows.filter((r) =>
          String(r.item ?? "")
            .toLowerCase()
            .includes(data.item!.toLowerCase()),
        );
      if (data.dataInicio) rows = rows.filter((r) => String(r.created_at) >= data.dataInicio!);
      if (data.dataFim) rows = rows.filter((r) => String(r.created_at) <= data.dataFim!);

      return rows
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, data.limit ?? 500);
    } catch {
      return [];
    }
  });

/* ======================================================================
   QualiHub — gravações novas (QLD/QLDE e Organograma)
   Usam um Apps Script próprio (apps-script/QualiHub.gs), separado do
   script antigo. Configure a URL em QUALIHUB_SCRIPT_URL.
   ====================================================================== */

const QUALIHUB_SCRIPT_URL_FALLBACK = "";

function qualihubScriptUrl() {
  const url = process.env.QUALIHUB_SCRIPT_URL || QUALIHUB_SCRIPT_URL_FALLBACK;
  if (!url) {
    throw new Error(
      "Gravação ainda não configurada: publique o Apps Script de apps-script/QualiHub.gs e informe a URL em QUALIHUB_SCRIPT_URL.",
    );
  }
  return url;
}

async function postToQualiHubScript(payload: Record<string, unknown>) {
  const res = await fetch(qualihubScriptUrl(), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow",
  });
  const txt = await res.text();
  let result: { ok?: boolean; error?: string; [key: string]: unknown };
  try {
    result = JSON.parse(txt);
  } catch {
    throw new Error(
      res.ok
        ? "O Apps Script respondeu em formato inesperado. Confira se a implantação está como 'Qualquer pessoa'."
        : `Apps Script indisponível (${res.status}).`,
    );
  }
  if (result.ok === false) throw new Error(result.error || "Erro ao gravar na planilha.");
  clearSheetCache();
  return result;
}

export type QldFields = Partial<{
  item: string;
  qtdeBloqueada: number;
  valorBloqueado: number;
  qtdeLivre: number;
  valorLivre: number;
  deposito: string;
  motivo: string;
  acao: string;
}>;

function requireAutor(autor?: string) {
  if (!autor?.trim()) throw new Error("Informe seu nome para registrar a alteração.");
  return autor.trim();
}

export const updateQldItem = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { row: number; item: string; deposito: string; fields: QldFields; autor: string }) => {
      if (!d.item) throw new Error("Item obrigatório");
      requireAutor(d.autor);
      return d;
    },
  )
  .handler(async ({ data }) => {
    await postToQualiHubScript({ action: "updateQld", ...data, autor: data.autor.trim() });
    return { ok: true };
  });

export const addQldItem = createServerFn({ method: "POST" })
  .inputValidator((d: { fields: QldFields; autor: string }) => {
    if (!d.fields?.item?.trim()) throw new Error("Informe o item.");
    if (!d.fields?.deposito?.trim()) throw new Error("Informe o depósito.");
    requireAutor(d.autor);
    return d;
  })
  .handler(async ({ data }) => {
    await postToQualiHubScript({ action: "addQld", ...data, autor: data.autor.trim() });
    return { ok: true };
  });

export const setQldCheck = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { row: number; item: string; deposito: string; checked: boolean; autor: string }) => {
      if (!d.item) throw new Error("Item obrigatório");
      requireAutor(d.autor);
      return d;
    },
  )
  .handler(async ({ data }) => {
    const result = await postToQualiHubScript({
      action: "setQldCheck",
      ...data,
      autor: data.autor.trim(),
    });
    return { ok: true, finalizadoEm: String(result.finalizadoEm ?? "") };
  });

/* Organograma compartilhado.
   Sem o Apps Script novo, usa o script que já está publicado: cada salvamento
   vira uma linha "organograma_salvo" na aba AUDITORIA (pública para leitura) e
   a versão mais recente é a que vale. As fotos vão para o Drive pela mesma
   rotina das evidências de RNC. */

const ORG_ACAO = "organograma_salvo";
const ORG_FOTO_RNC = "ORGANOGRAMA";

function newScriptUrl() {
  return process.env.QUALIHUB_SCRIPT_URL || QUALIHUB_SCRIPT_URL_FALLBACK;
}

async function lerOrgDaAuditoria(): Promise<string | null> {
  const values = await fetchPublicSheet("AUDITORIA");
  const header = (values[0] ?? []).map((h) => String(h).trim().toLowerCase());
  if (header[0] !== "id" || !header.includes("dados")) return null;
  const iData = header.indexOf("data");
  const iAcao = header.indexOf("acao");
  const iDados = header.indexOf("dados");
  let melhor: { data: string; dados: string } | null = null;
  for (const row of values.slice(1)) {
    if (value(row, iAcao) !== ORG_ACAO) continue;
    const data = value(row, iData);
    const dados = value(row, iDados);
    if (!dados.startsWith("{")) continue;
    if (!melhor || data >= melhor.data) melhor = { data, dados };
  }
  return melhor?.dados ?? null;
}

export const getOrganograma = createServerFn({ method: "GET" }).handler(async () => {
  const url = newScriptUrl();
  try {
    if (url) {
      const res = await fetch(`${url}?action=getOrg`, {
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      const data = (await res.json()) as { ok?: boolean; org?: unknown };
      return { json: data?.org ? JSON.stringify(data.org) : null };
    }
    return { json: await lerOrgDaAuditoria() };
  } catch (e) {
    console.error("[organograma] leitura", e);
    return { json: null as string | null };
  }
});

export const saveOrganograma = createServerFn({ method: "POST" })
  .inputValidator((d: { json: string; autor: string }) => {
    if (!d.json?.trim().startsWith("{")) throw new Error("Organograma inválido");
    if (d.json.length > 900_000) throw new Error("Organograma grande demais para salvar.");
    requireAutor(d.autor);
    return d;
  })
  .handler(async ({ data }) => {
    const autor = data.autor.trim();
    if (newScriptUrl()) {
      const result = await postToQualiHubScript({
        action: "saveOrg",
        org: JSON.parse(data.json),
        autor,
      });
      return { ok: true, atualizadoEm: String(result.atualizadoEm ?? "") };
    }
    if (data.json.length > 45_000) {
      throw new Error(
        "Com fotos, o organograma precisa do Apps Script atualizado (apps-script/LEIA-ME.md).",
      );
    }
    const atualizadoEm = new Date().toISOString();
    const org = { ...JSON.parse(data.json), atualizadoEm, atualizadoPor: autor };
    const result = await postToAppsScript({
      action: "audit",
      autor,
      acao: ORG_ACAO,
      entidade: "organograma",
      entidade_id: "global",
      fornecedor: "",
      item: "",
      dados: JSON.stringify(org),
    });
    if (result?.ok === false) throw new Error(result?.error || "Erro ao salvar o organograma.");
    clearSheetCache();
    return { ok: true, atualizadoEm };
  });

function driveIdFromUrl(url: string) {
  return url.match(/[?&]id=([\w-]+)/)?.[1] ?? url.match(/\/d\/([\w-]+)/)?.[1] ?? "";
}

export const uploadOrgFoto = createServerFn({ method: "POST" })
  .inputValidator((d: { base64: string; nome: string }) => {
    if (!d.base64) throw new Error("Foto vazia");
    if (d.base64.length > 2_000_000) throw new Error("Foto muito grande");
    return d;
  })
  .handler(async ({ data }) => {
    if (newScriptUrl()) {
      const result = await postToQualiHubScript({
        action: "uploadFoto",
        base64: data.base64,
        nome: data.nome,
        mime: "image/jpeg",
      });
      return { fileId: String(result.fileId ?? "") };
    }
    // Usa a rotina de evidências do script atual (salva no Drive e registra a URL).
    const nome = `organograma-${data.nome}-${Date.now()}.jpg`;
    const result = await postToAppsScript({
      action: "addEvidencia",
      rnc_id: ORG_FOTO_RNC,
      url: "",
      nome,
      tipo: "image/jpeg",
      observacao: "Foto do organograma",
      autor: "QualiHub",
      file_base64: data.base64,
    });
    if (result?.ok === false) throw new Error(result?.error || "Erro ao enviar a foto.");
    const direta = String(result?.url ?? result?.fileUrl ?? "");
    let fileId = String(result?.fileId ?? result?.id_drive ?? "") || driveIdFromUrl(direta);
    if (!fileId) {
      const values = await fetchPublicSheet("EVIDENCIAS");
      const linha = values.find((row) => value(row, 3) === nome);
      fileId = linha ? driveIdFromUrl(value(linha, 2)) : "";
    }
    if (!fileId)
      throw new Error("A foto foi enviada, mas não foi possível localizar o arquivo no Drive.");
    return { fileId };
  });

/* ============ Dados digitados no QualiHub (ex.: campos manuais da RDM) ============
   Ficam na aba QUALIHUB_DADOS pelo Apps Script (ações kvGet/kvSet). */

function scriptUrlGeral() {
  return process.env.QUALIHUB_SCRIPT_URL || QUALIHUB_SCRIPT_URL_FALLBACK || APPS_SCRIPT_URL;
}

export const getQualihubDados = createServerFn({ method: "GET" })
  .inputValidator((d: { prefixo: string }) => d)
  .handler(async ({ data }) => {
    try {
      const res = await fetch(
        `${scriptUrlGeral()}?action=kvGet&prefixo=${encodeURIComponent(data.prefixo)}`,
        { redirect: "follow", signal: AbortSignal.timeout(15000) },
      );
      const body = (await res.json()) as {
        dados?: Record<string, { valor: unknown; atualizadoEm: string; autor: string }>;
      };
      // Sem "dados" = Apps Script ainda na versão anterior (sem kvGet).
      return {
        json: body?.dados ? JSON.stringify(body.dados) : null,
        suportado: Boolean(body?.dados),
      };
    } catch {
      return { json: null as string | null, suportado: false };
    }
  });

export const saveQualihubDados = createServerFn({ method: "POST" })
  .inputValidator((d: { chave: string; json: string; autor: string }) => {
    if (!d.chave?.trim()) throw new Error("Chave obrigatória");
    if (d.json.length > 40_000) throw new Error("Conteúdo grande demais");
    requireAutor(d.autor);
    return d;
  })
  .handler(async ({ data }) => {
    const res = await fetch(scriptUrlGeral(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "kvSet",
        chave: data.chave,
        valor: JSON.parse(data.json),
        autor: data.autor.trim(),
      }),
      redirect: "follow",
    });
    const result = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      atualizadoEm?: string;
    };
    if (result.ok === false || !result.ok) {
      const msg = result.error ?? "";
      throw new Error(
        /desconhecida/i.test(msg)
          ? "O Apps Script precisa ser atualizado para salvar os dados da RDM (apps-script/LEIA-ME.md)."
          : msg || "Não foi possível salvar.",
      );
    }
    return { ok: true, atualizadoEm: result.atualizadoEm ?? "" };
  });

/* ===================== Adequação (sistema da área de Adequação) =====================
   O painel https://adequacaofraslemobility.netlify.app lê esta planilha publicada.
   A RDM usa as mesmas abas de registros (peças adequadas por ITEM, ORIGEM e DATA FIM). */

const ADEQUACAO_PUB =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTjprYWeQEHkIJAKElPa7_a0HJ3toPZJGvm8-VaJ2rp80e7rZlhQiUFDixa3fd055ikTSwUAs5cSzK6/pub";
const ADEQUACAO_ABAS = ["2081330396", "2058453745"]; // registros 2026 e 2025

export type AdequacaoMes = {
  ano: number;
  mes: number; // 0-11
  pecas: number;
  valor: number;
  skus: number;
  md: { pecas: number; valor: number };
  avaria: { pecas: number; valor: number };
};

let adequacaoCache: { at: number; data: AdequacaoMes[] } | null = null;

export const getAdequacaoMensal = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ meses: AdequacaoMes[]; ok: boolean }> => {
    if (adequacaoCache && Date.now() - adequacaoCache.at < 5 * 60_000) {
      return { meses: adequacaoCache.data, ok: true };
    }
    try {
      const mapa = new Map<string, AdequacaoMes & { itens: Set<string> }>();
      for (const gid of ADEQUACAO_ABAS) {
        const res = await fetch(`${ADEQUACAO_PUB}?gid=${gid}&single=true&output=csv`, {
          redirect: "follow",
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) continue;
        const rows = parseCsv(await res.text());
        const norm = (s: string) => s.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        const hi = rows.findIndex(
          (r) => r.some((c) => norm(c) === "ITEM") && r.some((c) => norm(c) === "ORIGEM"),
        );
        if (hi < 0) continue;
        const h = rows[hi].map(norm);
        const iItem = h.indexOf("ITEM");
        const iQtd = h.findIndex((c) => c.startsWith("QTDE"));
        const iValor = h.findIndex((c) => c.startsWith("PECA X VALOR"));
        const iOrigem = h.indexOf("ORIGEM");
        const iData = h.indexOf("DATA FIM");
        for (const r of rows.slice(hi + 1)) {
          const item = value(r, iItem);
          const m = value(r, iData).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (!item || !m) continue;
          const ano = Number(m[3]);
          const mes = Number(m[2]) - 1;
          const k = `${ano}-${mes}`;
          const e = mapa.get(k) ?? {
            ano,
            mes,
            pecas: 0,
            valor: 0,
            skus: 0,
            md: { pecas: 0, valor: 0 },
            avaria: { pecas: 0, valor: 0 },
            itens: new Set<string>(),
          };
          // "1.520" é mil quinhentos e vinte (separador de milhar), não 1,52.
          const qtdTxt = value(r, iQtd);
          const qtd = /^\d{1,3}(\.\d{3})+$/.test(qtdTxt)
            ? Number(qtdTxt.replace(/\./g, ""))
            : numberBR(qtdTxt);
          const val = numberBR(value(r, iValor));
          e.pecas += qtd;
          e.valor += val;
          e.itens.add(item.toUpperCase());
          const origem = norm(value(r, iOrigem));
          const alvo = origem.includes("AVARIA") ? e.avaria : e.md;
          alvo.pecas += qtd;
          alvo.valor += val;
          mapa.set(k, e);
        }
      }
      const data = [...mapa.values()]
        .map(({ itens, ...e }) => ({
          ...e,
          skus: itens.size,
          valor: Math.round(e.valor * 100) / 100,
        }))
        .sort((a, b) => a.ano - b.ano || a.mes - b.mes);
      adequacaoCache = { at: Date.now(), data };
      return { meses: data, ok: true };
    } catch (e) {
      console.error("[adequacao]", e);
      return { meses: adequacaoCache?.data ?? [], ok: false };
    }
  },
);
