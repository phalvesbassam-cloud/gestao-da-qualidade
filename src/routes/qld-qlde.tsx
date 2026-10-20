import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  History,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Tag,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useDashboard } from "@/hooks/use-data";
import { PresentationSelectable } from "@/components/presentation-selectable";
import { EmptyState, PrintButton, SectionCard, chartTooltip } from "@/components/dashboard-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addQldItem, setQldCheck, updateQldItem, type QldFields } from "@/lib/sheets.functions";
import { getAutor, setAutor } from "@/lib/org";
import {
  DEP_QLD,
  DEP_QLDE,
  inteiroBR,
  isQld,
  isQlde,
  moedaBR,
  qldQuantidade,
  qldSummary,
  qldValor,
} from "@/lib/qld";
import { chartSpec, kpiSpec, tableSpec } from "@/lib/slide-spec";
import type { DashboardData, QLDQLDERow } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/qld-qlde")({
  head: () => ({
    meta: [
      { title: "QLD / QLDE — Gestão da Qualidade de Fornecedores" },
      { name: "description", content: "Visão operacional e financeira dos depósitos 522 e 523." },
    ],
  }),
  component: QLDQLDEPage,
});

const COR_QLD = "var(--chart-conditional)";
const COR_QLDE = "var(--chart-rejected)";

type Aba = "qld" | "qlde" | "resolvidos";

function QLDQLDEPage() {
  const data = useDashboard();
  const rows = data?.qldQlde ?? [];
  const s = useMemo(() => qldSummary(rows), [rows]);
  const [aba, setAba] = useState<Aba>("qld");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<QLDQLDERow | "novo" | null>(null);
  const [checando, setChecando] = useState<QLDQLDERow | null>(null);
  const resumoRef = useRef<HTMLDivElement | null>(null);
  const tabelaRef = useRef<HTMLElement | null>(null);

  const topExposicao = useMemo(
    () =>
      s.ativos
        .map((r) => ({ item: r.item, valor: qldValor(r), tipo: isQlde(r) ? "QLDE" : "QLD" }))
        .filter((r) => r.valor > 0)
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10),
    [s.ativos],
  );

  const porMotivo = useMemo(() => {
    const map = new Map<string, { motivo: string; valor: number; itens: number }>();
    for (const r of s.ativos) {
      const motivo = r.motivo.trim() || "Sem motivo informado";
      const e = map.get(motivo) ?? { motivo, valor: 0, itens: 0 };
      e.valor += qldValor(r);
      e.itens += 1;
      map.set(motivo, e);
    }
    return [...map.values()].sort((a, b) => b.valor - a.valor).slice(0, 8);
  }, [s.ativos]);

  const lista = useMemo(() => {
    const base = aba === "qld" ? s.qld : aba === "qlde" ? s.qlde : s.resolvidos;
    const termo = busca.trim().toLowerCase();
    const filtrada = termo
      ? base.filter((r) =>
          [r.item, r.motivo, r.acao, r.deposito, r.finalizadoPor].some((v) =>
            v.toLowerCase().includes(termo),
          ),
        )
      : base;
    return [...filtrada].sort((a, b) =>
      aba === "resolvidos"
        ? String(b.finalizadoEm).localeCompare(String(a.finalizadoEm))
        : qldValor(b) - qldValor(a),
    );
  }, [aba, busca, s]);

  const pctQld = s.totalValor > 0 ? (s.qldValor / s.totalValor) * 100 : 0;
  const tituloAba =
    aba === "qld"
      ? "QLD — Depósito 522"
      : aba === "qlde"
        ? "QLDE — Depósito 523"
        : "Histórico de itens resolvidos";

  return (
    <div className="space-y-6">
      {/* HERO */}
      <section className="hero-panel p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">
              <Boxes className="h-3.5 w-3.5" /> Gestão de materiais da Qualidade
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
              QLD / QLDE
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Materiais em tratamento (522) e bloqueados (523). Marque o check para finalizar um
              item: ele sai da exposição e vai para o histórico de resolvidos.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip">{s.ativos.length} itens ativos</span>
              <span className="chip border-success/40 text-success">
                <CheckCircle2 className="h-3 w-3" /> {s.resolvidos.length} resolvidos
              </span>
              {s.semMotivo > 0 && (
                <span className="chip border-warning/40 text-warning">
                  <AlertTriangle className="h-3 w-3" /> {s.semMotivo} sem motivo
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
            <div className="surface min-w-[260px] px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Exposição financeira ativa
              </div>
              <div className="mt-1 font-display text-3xl font-bold tabular-nums">
                {moedaBR.format(s.totalValor)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {inteiroBR.format(s.totalQuantidade)} peças
              </div>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
                <span style={{ width: `${pctQld}%`, background: COR_QLD }} />
                <span
                  style={{ width: `${s.totalValor > 0 ? 100 - pctQld : 0}%`, background: COR_QLDE }}
                />
              </div>
            </div>
            <Button className="gap-2" onClick={() => setEditando("novo")}>
              <Plus className="h-4 w-4" /> Adicionar item
            </Button>
          </div>
        </div>
      </section>

      {/* RESUMO */}
      <PresentationSelectable
        item={{
          id: "qld-qlde-resumo-executivo",
          title: "Resumo Executivo QLD / QLDE",
          subtitle: "Exposição ativa dos depósitos 522 e 523",
          type: "kpi-group",
          sourceRoute: "/qld-qlde",
          spec: kpiSpec([
            {
              label: "QLD · 522",
              value: moedaBR.format(s.qldValor),
              hint: `${inteiroBR.format(s.qldQuantidade)} peças · ${s.qldSkus} SKUs`,
              tone: "amber",
            },
            {
              label: "QLDE · 523",
              value: moedaBR.format(s.qldeValor),
              hint: `${inteiroBR.format(s.qldeQuantidade)} peças · ${s.qldeSkus} SKUs`,
              tone: "red",
            },
            {
              label: "Exposição total",
              value: moedaBR.format(s.totalValor),
              hint: `${inteiroBR.format(s.totalQuantidade)} peças`,
              tone: "neutral",
            },
            {
              label: "Itens resolvidos",
              value: inteiroBR.format(s.resolvidos.length),
              hint: moedaBR.format(s.resolvidosValor),
              tone: "green",
            },
          ]),
        }}
      >
        <div ref={resumoRef} className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Resumo executivo</div>
              <h2 className="mt-1 font-display text-lg font-semibold">Exposição por depósito</h2>
            </div>
            <PrintButton
              target={() => resumoRef.current}
              title="QLD / QLDE — Resumo executivo"
              subtitle="Exposição ativa (itens finalizados não entram na soma)"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DepositoCard
              titulo="QLD"
              deposito={`Depósito ${DEP_QLD} · Saldo livre`}
              status="Em tratamento"
              cor={COR_QLD}
              icon={<Wrench className="h-5 w-5" />}
              valor={s.qldValor}
              quantidade={s.qldQuantidade}
              skus={s.qldSkus}
              participacao={pctQld}
            />
            <DepositoCard
              titulo="QLDE"
              deposito={`Depósito ${DEP_QLDE} · Saldo bloqueado`}
              status="Bloqueado"
              cor={COR_QLDE}
              icon={<ShieldAlert className="h-5 w-5" />}
              valor={s.qldeValor}
              quantidade={s.qldeQuantidade}
              skus={s.qldeSkus}
              participacao={s.totalValor > 0 ? 100 - pctQld : 0}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat
              label="Valor total ativo"
              value={moedaBR.format(s.totalValor)}
              icon={<CircleDollarSign className="h-4 w-4" />}
            />
            <MiniStat
              label="Peças"
              value={inteiroBR.format(s.totalQuantidade)}
              icon={<Boxes className="h-4 w-4" />}
            />
            <MiniStat
              label="Itens sem motivo"
              value={inteiroBR.format(s.semMotivo)}
              icon={<Tag className="h-4 w-4" />}
              tone={s.semMotivo > 0 ? "warning" : undefined}
            />
            <MiniStat
              label="Resolvidos (histórico)"
              value={`${s.resolvidos.length} · ${moedaBR.format(s.resolvidosValor)}`}
              icon={<CheckCircle2 className="h-4 w-4" />}
              tone="success"
            />
          </div>
        </div>
      </PresentationSelectable>

      {/* ANÁLISE */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.35fr]">
        <PresentationSelectable
          item={{
            id: "qld-qlde-distribuicao-financeira",
            title: "Distribuição Financeira QLD × QLDE",
            subtitle: "Participação de cada depósito na exposição ativa",
            type: "chart",
            sourceRoute: "/qld-qlde",
            spec: chartSpec({
              kind: "doughnut",
              categories: ["QLD · 522", "QLDE · 523"],
              series: [{ name: "Valor (R$)", values: [s.qldValor, s.qldeValor] }],
              pointColors: ["#d97706", "#dc2626"],
              format: "currency",
            }),
          }}
        >
          <SectionCard
            title="Distribuição financeira"
            subtitle="Participação na exposição ativa"
            printable
            printTitle="QLD × QLDE — Distribuição financeira"
          >
            <div className="relative h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "QLD · 522", value: s.qldValor },
                      { name: "QLDE · 523", value: s.qldeValor },
                    ]}
                    innerRadius={74}
                    outerRadius={104}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    <Cell fill={COR_QLD} />
                    <Cell fill={COR_QLDE} />
                  </Pie>
                  <Tooltip {...chartTooltip} formatter={(v: number) => moedaBR.format(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Exposição
                </span>
                <span className="mt-1 font-display text-xl font-bold tabular-nums">
                  {moedaBR.format(s.totalValor)}
                </span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Legenda cor={COR_QLD} label="QLD · 522" pct={pctQld} valor={s.qldValor} />
              <Legenda
                cor={COR_QLDE}
                label="QLDE · 523"
                pct={s.totalValor > 0 ? 100 - pctQld : 0}
                valor={s.qldeValor}
              />
            </div>
          </SectionCard>
        </PresentationSelectable>

        <PresentationSelectable
          item={{
            id: "qld-qlde-top-exposicao",
            title: "Maiores exposições financeiras",
            subtitle: "Top 10 itens ativos em valor",
            type: "chart",
            sourceRoute: "/qld-qlde",
            spec: chartSpec({
              kind: "barH",
              categories: topExposicao.map((r) => r.item),
              series: [{ name: "Valor (R$)", values: topExposicao.map((r) => r.valor) }],
              pointColors: topExposicao.map((r) => (r.tipo === "QLDE" ? "#dc2626" : "#d97706")),
              format: "currency",
            }),
          }}
        >
          <SectionCard
            title="Maiores exposições financeiras"
            subtitle="Top 10 itens ativos — âmbar QLD, vermelho QLDE"
            printable
            printTitle="QLD / QLDE — Maiores exposições"
          >
            {topExposicao.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="h-[330px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={topExposicao}
                    margin={{ top: 0, right: 92, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                      fontSize={11}
                    />
                    <YAxis
                      type="category"
                      dataKey="item"
                      width={92}
                      fontSize={11}
                      tickLine={false}
                    />
                    <Tooltip
                      {...chartTooltip}
                      formatter={(v: number) => [moedaBR.format(v), "Exposição"]}
                    />
                    <Bar
                      dataKey="valor"
                      radius={[0, 6, 6, 0]}
                      label={{
                        position: "right",
                        fontSize: 10,
                        fill: "var(--chart-axis)",
                        formatter: (v: number) => moedaBR.format(v),
                      }}
                    >
                      {topExposicao.map((r, i) => (
                        <Cell
                          key={`${r.item}-${i}`}
                          fill={r.tipo === "QLDE" ? COR_QLDE : COR_QLD}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
        </PresentationSelectable>
      </div>

      <PresentationSelectable
        item={{
          id: "qld-qlde-por-motivo",
          title: "Exposição por motivo",
          subtitle: "Valor ativo agrupado pela coluna Motivo",
          type: "chart",
          sourceRoute: "/qld-qlde",
          spec: chartSpec({
            kind: "barH",
            categories: porMotivo.map((m) => m.motivo),
            series: [{ name: "Valor (R$)", values: porMotivo.map((m) => m.valor) }],
            format: "currency",
            colors: ["#7c3aed"],
          }),
        }}
      >
        <SectionCard
          title="Exposição por motivo"
          subtitle="Valor ativo agrupado pela coluna Motivo da planilha"
          printable
          printTitle="QLD / QLDE — Exposição por motivo"
        >
          {porMotivo.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {porMotivo.map((m) => {
                const pct = s.totalValor > 0 ? (m.valor / s.totalValor) * 100 : 0;
                return (
                  <div key={m.motivo} className="surface-muted p-3">
                    <div className="truncate text-xs font-semibold" title={m.motivo}>
                      {m.motivo}
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="font-display text-lg font-bold tabular-nums">
                        {moedaBR.format(m.valor)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{m.itens} itens</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-[var(--chart-ppm)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {pct.toFixed(1)}% da exposição
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </PresentationSelectable>

      {/* TABELA */}
      <PresentationSelectable
        item={{
          id: `qld-qlde-tabela-${aba}`,
          title: tituloAba,
          subtitle: `${lista.length} itens`,
          type: "table",
          sourceRoute: "/qld-qlde",
          spec: tableSpec(
            aba === "resolvidos"
              ? ["Item", "Depósito", "Valor", "Motivo", "Ação", "Finalizado em", "Por"]
              : ["Item", "Qtde.", "Valor", "Motivo", "Ação"],
            lista
              .slice(0, 14)
              .map((r) =>
                aba === "resolvidos"
                  ? [
                      r.item,
                      r.deposito,
                      moedaBR.format(qldValor(r)),
                      r.motivo || "—",
                      r.acao || "—",
                      r.finalizadoEm || "—",
                      r.finalizadoPor || "—",
                    ]
                  : [
                      r.item,
                      inteiroBR.format(qldQuantidade(r)),
                      moedaBR.format(qldValor(r)),
                      r.motivo || "—",
                      r.acao || "—",
                    ],
              ),
          ),
        }}
      >
        <section ref={tabelaRef} className="surface overflow-hidden">
          <header className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="segmented self-start">
              <button type="button" data-active={aba === "qld"} onClick={() => setAba("qld")}>
                QLD · 522 ({s.qld.length})
              </button>
              <button type="button" data-active={aba === "qlde"} onClick={() => setAba("qlde")}>
                QLDE · 523 ({s.qlde.length})
              </button>
              <button
                type="button"
                data-active={aba === "resolvidos"}
                onClick={() => setAba("resolvidos")}
              >
                <span className="inline-flex items-center gap-1">
                  <History className="h-3 w-3" /> Resolvidos ({s.resolvidos.length})
                </span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="no-print relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar item, motivo, ação…"
                  className="h-8 w-60 pl-8 text-xs"
                />
              </label>
              <PrintButton
                target={() => tabelaRef.current}
                title={tituloAba}
                subtitle={`${lista.length} itens · gerado pelo QualiHub`}
                orientation="portrait"
              />
            </div>
          </header>
          {lista.length === 0 ? (
            <div className="p-4">
              <EmptyState
                label={
                  aba === "resolvidos"
                    ? "Nenhum item resolvido ainda"
                    : "Nenhum item neste depósito"
                }
              />
            </div>
          ) : (
            <div className="max-h-[640px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5">Item</th>
                    {aba === "resolvidos" && <th className="px-3 py-2.5">Dep.</th>}
                    <th className="px-3 py-2.5 text-right">Qtde.</th>
                    <th className="px-3 py-2.5 text-right">Valor</th>
                    <th className="px-3 py-2.5">Motivo</th>
                    <th className="px-3 py-2.5">Ação</th>
                    {aba === "resolvidos" ? (
                      <th className="px-3 py-2.5">Finalizado</th>
                    ) : (
                      <th className="no-print px-3 py-2.5 text-center">Finalizar</th>
                    )}
                    <th className="no-print w-10 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((r) => (
                    <tr
                      key={`${r.row}-${r.item}`}
                      className="group border-b border-border/70 last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-2.5 font-semibold">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                              background: isQlde(r)
                                ? COR_QLDE
                                : isQld(r)
                                  ? COR_QLD
                                  : "var(--color-muted-foreground)",
                            }}
                          />
                          {r.item || "—"}
                        </div>
                      </td>
                      {aba === "resolvidos" && (
                        <td className="px-3 py-2.5 tabular-nums">{r.deposito}</td>
                      )}
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {inteiroBR.format(qldQuantidade(r))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                        {moedaBR.format(qldValor(r))}
                      </td>
                      <td className="max-w-[240px] px-3 py-2.5">
                        {r.motivo ? (
                          <span className="line-clamp-2 text-[13px]">{r.motivo}</span>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">Sem motivo</span>
                        )}
                      </td>
                      <td className="max-w-[260px] px-3 py-2.5">
                        <span className="line-clamp-2 text-[13px] text-muted-foreground">
                          {r.acao || "—"}
                        </span>
                      </td>
                      {aba === "resolvidos" ? (
                        <td className="px-3 py-2.5 text-xs">
                          <div className="font-medium text-success">
                            {r.finalizadoEm || "Finalizado"}
                          </div>
                          {r.finalizadoPor && (
                            <div className="text-muted-foreground">por {r.finalizadoPor}</div>
                          )}
                        </td>
                      ) : (
                        <td className="no-print px-3 py-2.5 text-center">
                          <Checkbox
                            checked={false}
                            onCheckedChange={() => setChecando(r)}
                            aria-label={`Finalizar ${r.item}`}
                            className="h-5 w-5"
                          />
                        </td>
                      )}
                      <td className="no-print px-3 py-2.5">
                        {aba === "resolvidos" ? (
                          <button
                            type="button"
                            title="Reabrir item"
                            onClick={() => setChecando(r)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Editar item"
                            onClick={() => setEditando(r)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground opacity-60 transition hover:text-foreground group-hover:opacity-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {aba !== "resolvidos" && (
                  <tfoot>
                    <tr className="border-t-2 bg-muted/40 font-semibold">
                      <td className="px-4 py-2.5">Total ativo</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {inteiroBR.format(lista.reduce((t, r) => t + qldQuantidade(r), 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {moedaBR.format(lista.reduce((t, r) => t + qldValor(r), 0))}
                      </td>
                      <td colSpan={2} />
                      <td className="no-print" colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </section>
      </PresentationSelectable>

      <ItemDialog item={editando} onClose={() => setEditando(null)} />
      <CheckDialog item={checando} onClose={() => setChecando(null)} />
    </div>
  );
}

function DepositoCard({
  titulo,
  deposito,
  status,
  cor,
  icon,
  valor,
  quantidade,
  skus,
  participacao,
}: {
  titulo: string;
  deposito: string;
  status: string;
  cor: string;
  icon: ReactNode;
  valor: number;
  quantidade: number;
  skus: number;
  participacao: number;
}) {
  return (
    <div
      className="surface overflow-hidden p-5"
      style={{ borderColor: `color-mix(in oklab, ${cor} 35%, var(--color-border))` }}
    >
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: cor }} />
      <span
        className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full opacity-[0.12] blur-3xl"
        style={{ background: cor }}
      />
      <div className="relative mb-5 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="rounded-xl p-2.5"
            style={{ color: cor, background: `color-mix(in oklab, ${cor} 14%, transparent)` }}
          >
            {icon}
          </div>
          <div>
            <h3 className="font-display text-xl font-bold">{titulo}</h3>
            <p className="text-xs text-muted-foreground">{deposito}</p>
          </div>
        </div>
        <span
          className="rounded-full border px-3 py-1 text-xs font-semibold"
          style={{ color: cor, borderColor: `color-mix(in oklab, ${cor} 40%, transparent)` }}
        >
          {status}
        </span>
      </div>
      <div className="relative font-display text-3xl font-bold tabular-nums">
        {moedaBR.format(valor)}
      </div>
      <div className="relative mt-1 text-xs text-muted-foreground">
        {participacao.toFixed(1)}% da exposição ativa
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-3">
        <div className="surface-muted px-3 py-2">
          <div className="text-[11px] text-muted-foreground">Peças</div>
          <div className="font-semibold tabular-nums">{inteiroBR.format(quantidade)}</div>
        </div>
        <div className="surface-muted px-3 py-2">
          <div className="text-[11px] text-muted-foreground">SKUs</div>
          <div className="font-semibold tabular-nums">{inteiroBR.format(skus)}</div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "warning" | "success";
}) {
  return (
    <div className="surface p-4">
      <div
        className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground",
          tone === "warning" && "text-warning",
          tone === "success" && "text-success",
        )}
      >
        {icon}
        {label}
      </div>
      <div className="mt-2 font-display text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Legenda({
  cor,
  label,
  pct,
  valor,
}: {
  cor: string;
  label: string;
  pct: number;
  valor: number;
}) {
  return (
    <div className="surface-muted p-3">
      <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: cor }}>
        <span className="h-2 w-2 rounded-full" style={{ background: cor }} /> {label}
      </div>
      <div className="mt-1.5 font-display text-lg font-bold">{pct.toFixed(1)}%</div>
      <div className="text-xs text-muted-foreground">{moedaBR.format(valor)}</div>
    </div>
  );
}

/* ============================ Gravação ============================ */

function usePatchQld() {
  const qc = useQueryClient();
  return {
    patch: (fn: (rows: QLDQLDERow[]) => QLDQLDERow[]) =>
      qc.setQueryData<DashboardData>(["dashboard"], (d) =>
        d ? { ...d, qldQlde: fn(d.qldQlde ?? []) } : d,
      ),
    // A planilha pública leva alguns segundos para refletir a gravação.
    refresh: () => setTimeout(() => qc.invalidateQueries({ queryKey: ["dashboard"] }), 4000),
  };
}

const sameRow = (a: QLDQLDERow, b: QLDQLDERow) => a.row === b.row && a.item === b.item;

function vazio(): Required<QldFields> {
  return {
    item: "",
    qtdeBloqueada: 0,
    valorBloqueado: 0,
    qtdeLivre: 0,
    valorLivre: 0,
    deposito: DEP_QLD,
    motivo: "",
    acao: "",
  };
}

function ItemDialog({ item, onClose }: { item: QLDQLDERow | "novo" | null; onClose: () => void }) {
  const update = useServerFn(updateQldItem);
  const add = useServerFn(addQldItem);
  const { patch, refresh } = usePatchQld();
  const [form, setForm] = useState<Required<QldFields>>(vazio());
  const [autor, setNome] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!item) return;
    setNome(getAutor());
    setForm(
      item === "novo"
        ? vazio()
        : {
            item: item.item,
            qtdeBloqueada: item.qtdeBloqueada,
            valorBloqueado: item.valorBloqueado,
            qtdeLivre: item.qtdeLivre,
            valorLivre: item.valorLivre,
            deposito: item.deposito,
            motivo: item.motivo,
            acao: item.acao,
          },
    );
  }, [item]);

  if (!item) return null;
  const novo = item === "novo";
  const set = (p: Partial<QldFields>) => setForm((f) => ({ ...f, ...p }));
  const bloqueado = form.deposito.trim() === DEP_QLDE;

  const salvar = async () => {
    setBusy(true);
    setAutor(autor);
    try {
      if (novo) {
        await add({ data: { fields: form, autor } });
        patch((rows) => [
          ...rows,
          {
            ...form,
            row: 0,
            check: "FALSE",
            finalizado: false,
            finalizadoEm: "",
            finalizadoPor: "",
            atencao: "",
          },
        ]);
        toast.success(`Item ${form.item} adicionado na planilha.`);
      } else {
        await update({
          data: { row: item.row, item: item.item, deposito: item.deposito, fields: form, autor },
        });
        patch((rows) => rows.map((r) => (sameRow(r, item) ? { ...r, ...form } : r)));
        toast.success(`Item ${form.item} atualizado na planilha.`);
      }
      refresh();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{novo ? "Adicionar item ao QLD / QLDE" : `Editar ${item.item}`}</DialogTitle>
          <DialogDescription>
            As alterações são gravadas direto na aba QLD-QLDE da planilha
            {!novo && ` (linha ${item.row})`}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Item</Label>
            <Input value={form.item} onChange={(e) => set({ item: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Depósito</Label>
            <div className="segmented flex w-full">
              {[DEP_QLD, DEP_QLDE].map((d) => (
                <button
                  key={d}
                  type="button"
                  className="flex-1"
                  data-active={form.deposito.trim() === d}
                  onClick={() => set({ deposito: d })}
                >
                  {d === DEP_QLD ? "522 · QLD (livre)" : "523 · QLDE (bloqueado)"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className={cn(!bloqueado && "text-muted-foreground")}>Qtde. bloqueada</Label>
            <Input
              type="number"
              value={form.qtdeBloqueada}
              onChange={(e) => set({ qtdeBloqueada: num(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={cn(!bloqueado && "text-muted-foreground")}>
              Valor bloqueado (R$)
            </Label>
            <Input
              type="number"
              step="0.01"
              value={form.valorBloqueado}
              onChange={(e) => set({ valorBloqueado: num(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={cn(bloqueado && "text-muted-foreground")}>Qtde. livre</Label>
            <Input
              type="number"
              value={form.qtdeLivre}
              onChange={(e) => set({ qtdeLivre: num(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={cn(bloqueado && "text-muted-foreground")}>Valor livre (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.valorLivre}
              onChange={(e) => set({ valorLivre: num(e.target.value) })}
            />
          </div>
          <div className="col-span-2 space-y-1.5 md:col-span-4">
            <Label>Motivo</Label>
            <Textarea
              rows={2}
              value={form.motivo}
              onChange={(e) => set({ motivo: e.target.value })}
              placeholder="Por que o material está no depósito?"
            />
          </div>
          <div className="col-span-2 space-y-1.5 md:col-span-4">
            <Label>Ação</Label>
            <Textarea
              rows={2}
              value={form.acao}
              onChange={(e) => set({ acao: e.target.value })}
              placeholder="O que está sendo feito?"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Seu nome</Label>
            <Input value={autor} onChange={(e) => setNome(e.target.value)} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          No QLD (522) conta o saldo livre; no QLDE (523), o saldo bloqueado.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !form.item.trim() || !form.deposito.trim() || !autor.trim()}
            onClick={salvar}
            className="gap-2"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{" "}
            {novo ? "Adicionar" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckDialog({ item, onClose }: { item: QLDQLDERow | null; onClose: () => void }) {
  const setCheck = useServerFn(setQldCheck);
  const { patch, refresh } = usePatchQld();
  const [autor, setNome] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (item) setNome(getAutor());
  }, [item]);
  if (!item) return null;
  const finalizar = !item.finalizado;

  const confirmar = async () => {
    setBusy(true);
    setAutor(autor);
    try {
      const res = await setCheck({
        data: {
          row: item.row,
          item: item.item,
          deposito: item.deposito,
          checked: finalizar,
          autor,
        },
      });
      patch((rows) =>
        rows.map((r) =>
          sameRow(r, item)
            ? {
                ...r,
                finalizado: finalizar,
                check: finalizar ? "TRUE" : "FALSE",
                finalizadoEm: finalizar
                  ? res.finalizadoEm || new Date().toLocaleString("pt-BR")
                  : "",
                finalizadoPor: finalizar ? autor : "",
              }
            : r,
        ),
      );
      toast.success(
        finalizar ? `${item.item} finalizado e movido para o histórico.` : `${item.item} reaberto.`,
      );
      refresh();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gravar o check.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {finalizar ? `Finalizar ${item.item}?` : `Reabrir ${item.item}?`}
          </DialogTitle>
          <DialogDescription>
            {finalizar
              ? `O valor de ${moedaBR.format(qldValor(item))} deixa de compor o depósito ${item.deposito} e o item vai para o histórico de resolvidos. O check é marcado na planilha.`
              : `O item volta a somar ${moedaBR.format(qldValor(item))} no depósito ${item.deposito}.`}
          </DialogDescription>
        </DialogHeader>
        {item.motivo && (
          <div className="surface-muted p-3 text-xs">
            <div className="font-semibold">Motivo</div>
            <div className="text-muted-foreground">{item.motivo}</div>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Seu nome</Label>
          <Input value={autor} onChange={(e) => setNome(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !autor.trim()}
            onClick={confirmar}
            className={cn(
              "gap-2",
              finalizar && "bg-success text-success-foreground hover:bg-success/90",
            )}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : finalizar ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {finalizar ? "Finalizar item" : "Reabrir item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
