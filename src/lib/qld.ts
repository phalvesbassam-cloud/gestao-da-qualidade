// Regras do QLD / QLDE.
//  - QLD  = depósito 522 → saldo LIVRE (material em tratamento).
//  - QLDE = depósito 523 → saldo BLOQUEADO.
//  - Item com Check marcado está resolvido: sai dos totais do depósito e vai
//    para o histórico de itens resolvidos.
import type { QLDQLDERow } from "@/lib/types";

export const DEP_QLD = "522";
export const DEP_QLDE = "523";

export const isQld = (r: QLDQLDERow) => String(r.deposito).trim() === DEP_QLD;
export const isQlde = (r: QLDQLDERow) => String(r.deposito).trim() === DEP_QLDE;

/** Quantidade/valor que o item soma no depósito dele. */
export function qldQuantidade(r: QLDQLDERow) {
  return isQlde(r) ? r.qtdeBloqueada : isQld(r) ? r.qtdeLivre : r.qtdeLivre + r.qtdeBloqueada;
}
export function qldValor(r: QLDQLDERow) {
  return isQlde(r) ? r.valorBloqueado : isQld(r) ? r.valorLivre : r.valorLivre + r.valorBloqueado;
}

export function qldSummary(rows: QLDQLDERow[]) {
  const ativos = rows.filter((r) => !r.finalizado);
  const resolvidos = rows.filter((r) => r.finalizado);
  const qld = ativos.filter(isQld);
  const qlde = ativos.filter(isQlde);
  const sum = (list: QLDQLDERow[], fn: (r: QLDQLDERow) => number) =>
    list.reduce((t, r) => t + (fn(r) || 0), 0);
  const skus = (list: QLDQLDERow[]) =>
    new Set(list.filter((r) => qldValor(r) > 0 || qldQuantidade(r) > 0).map((r) => r.item)).size;

  const qldValorTotal = sum(qld, qldValor);
  const qldeValorTotal = sum(qlde, qldValor);
  const qldQtd = sum(qld, qldQuantidade);
  const qldeQtd = sum(qlde, qldQuantidade);

  return {
    ativos,
    resolvidos,
    qld,
    qlde,
    qldValor: qldValorTotal,
    qldeValor: qldeValorTotal,
    qldQuantidade: qldQtd,
    qldeQuantidade: qldeQtd,
    qldSkus: skus(qld),
    qldeSkus: skus(qlde),
    totalValor: qldValorTotal + qldeValorTotal,
    totalQuantidade: qldQtd + qldeQtd,
    resolvidosValor: sum(resolvidos, qldValor),
    semMotivo: ativos.filter((r) => !r.motivo.trim()).length,
  };
}

export type QldSummary = ReturnType<typeof qldSummary>;

export const moedaBR = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const inteiroBR = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
