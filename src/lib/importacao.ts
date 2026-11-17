// Regras da tela "Atualizar dados": quais abas podem ser importadas, qual
// coluna tem a data de referência e quais colunas identificam uma linha
// repetida (para não importar o mesmo registro duas vezes).

export type AbaId = "IDF" | "RNC" | "ALERTA" | "QLD-QLDE";

export type AbaConfig = {
  id: AbaId;
  titulo: string;
  descricao: string;
  /** Índice (0 = coluna A) da data usada em "última data importada". */
  colunaData: number | null;
  /** Colunas que, juntas, identificam um registro. */
  chave: number[];
  /** Colunas de data (formatadas como dd/mm/aaaa ao importar). */
  colunasData: number[];
  /** Colunas numéricas. */
  colunasNumero: number[];
};

export const ABAS: AbaConfig[] = [
  {
    id: "IDF",
    titulo: "IDF",
    descricao: "Inspeções de recebimento (uma linha por inspeção)",
    colunaData: 4, // E — Data de INICIO Inspeção
    chave: [0, 2, 3, 4], // Processo + Código item + Quantidade + Data
    colunasData: [4, 6, 10],
    colunasNumero: [3],
  },
  {
    id: "RNC",
    titulo: "RNC",
    descricao: "Relatórios de não conformidade",
    colunaData: 1, // B — Data
    chave: [0], // Nº RNC
    colunasData: [1, 7, 10, 15],
    colunasNumero: [],
  },
  {
    id: "ALERTA",
    titulo: "Alertas (AQ)",
    descricao: "Alertas da Qualidade",
    colunaData: 1, // B — Data criação
    chave: [0], // Nº AQ
    colunasData: [1],
    colunasNumero: [3],
  },
  {
    id: "QLD-QLDE",
    titulo: "QLD / QLDE",
    descricao: "Materiais nos depósitos 522 e 523",
    colunaData: null,
    chave: [0, 5], // Item + Depósito
    colunasData: [],
    colunasNumero: [1, 2, 3, 4],
  },
];

export const abaConfig = (id: string) => ABAS.find((a) => a.id === id) ?? ABAS[0];

/** Converte vários formatos de data em "dd/mm/aaaa" (ou "" se não for data). */
export function paraDataBR(valor: unknown): string {
  if (valor == null || valor === "") return "";
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const d = String(valor.getDate()).padStart(2, "0");
    const m = String(valor.getMonth() + 1).padStart(2, "0");
    return `${d}/${m}/${valor.getFullYear()}`;
  }
  const s = String(valor).trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${ano}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  // Número de série do Excel (dias desde 30/12/1899)
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
    return `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}/${dt.getUTCFullYear()}`;
  }
  return "";
}

/** "dd/mm/aaaa" → número comparável (aaaammdd); 0 se inválida. */
export function dataNumero(br: string): number {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? Number(`${m[3]}${m[2]}${m[1]}`) : 0;
}

/** Converte texto/número para número (aceita "1.234,56", "R$ 10,00", "1000"). */
export function paraNumero(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  let s = String(valor).replace(/R\$/gi, "").replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizarChave(valor: unknown, coluna: number, cfg: AbaConfig) {
  if (cfg.colunasData.includes(coluna)) {
    const d = paraDataBR(valor);
    return d || String(valor ?? "").trim();
  }
  if (cfg.colunasNumero.includes(coluna)) {
    const n = paraNumero(valor);
    return n == null ? "" : String(n);
  }
  return String(valor ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/** Chave de um registro a partir de uma linha completa (índices = colunas da aba). */
export function chaveDaLinha(linha: unknown[], cfg: AbaConfig) {
  return cfg.chave.map((c) => normalizarChave(linha[c], c, cfg)).join("|");
}
