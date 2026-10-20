// Formato compacto para enviar o DashboardData do servidor ao navegador.
//
// Antes, ~28 mil linhas do IDF iam como objetos completos (≈36 MB a cada minuto).
// Aqui cada lista de objetos vira colunas, e colunas de texto repetitivo
// (status, fornecedor, divisão, datas…) viram índices de um dicionário.
// O resultado é um JSON de poucos MB que o navegador reconstrói rapidamente.
import type { DashboardData } from "@/lib/types";

type Col =
  | { k: string; t: "raw"; v: unknown[] } // valores como estão
  | { k: string; t: "dict"; d: unknown[]; i: number[] } // dicionário + índices
  | { k: string; t: "date"; v: (number | null)[] }; // Date → epoch ms

type Table = { n: number; c: Col[] };

function encodeTable(rows: Record<string, unknown>[]): Table {
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k);
  const cols: Col[] = [];
  for (const k of keys) {
    const values = rows.map((r) => r[k]);
    if (values.some((v) => v instanceof Date)) {
      cols.push({ k, t: "date", v: values.map((v) => (v instanceof Date ? v.getTime() : null)) });
      continue;
    }
    const dict = new Map<unknown, number>();
    for (const v of values) if (!dict.has(v)) dict.set(v, dict.size);
    if (dict.size < values.length * 0.6) {
      cols.push({ k, t: "dict", d: [...dict.keys()], i: values.map((v) => dict.get(v)!) });
    } else {
      cols.push({ k, t: "raw", v: values });
    }
  }
  return { n: rows.length, c: cols };
}

function decodeTable<T>(table: Table): T[] {
  const rows: Record<string, unknown>[] = Array.from({ length: table.n }, () => ({}));
  for (const col of table.c) {
    for (let i = 0; i < table.n; i++) {
      let v: unknown;
      if (col.t === "raw") v = col.v[i];
      else if (col.t === "dict") v = col.d[col.i[i]];
      else v = col.v[i] == null ? null : new Date(col.v[i] as number);
      if (v !== undefined) rows[i][col.k] = v;
    }
  }
  return rows as T[];
}

const TABLES = ["idf", "alerta", "rnc", "qldQlde", "fornecedores"] as const;

export function encodeDashboard(data: DashboardData): string {
  const out: Record<string, unknown> = { ...data };
  for (const key of TABLES)
    out[key] = encodeTable(data[key] as unknown as Record<string, unknown>[]);
  return JSON.stringify(out);
}

export function decodeDashboard(payload: string): DashboardData {
  const raw = JSON.parse(payload) as Record<string, unknown>;
  for (const key of TABLES) raw[key] = decodeTable(raw[key] as Table);
  return raw as unknown as DashboardData;
}
