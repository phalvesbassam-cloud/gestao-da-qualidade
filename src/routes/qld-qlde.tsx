import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  PackageCheck,
  ShieldAlert,
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
import { SectionCard } from "@/components/dashboard-ui";

export const Route = createFileRoute("/qld-qlde")({
  head: () => ({
    meta: [
      {
        title: "QLD / QLDE — Gestão da Qualidade de Fornecedores",
      },
      {
        name: "description",
        content: "Visão operacional e financeira dos depósitos 522 e 523.",
      },
    ],
  }),
  component: QLDQLDEPage,
});

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numero = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

function QLDQLDEPage() {
  const data = useDashboard();

  const rows = data?.qldQlde ?? [];

  const indicadores = useMemo(() => {
    const qld = rows.filter(
      (row) => String(row.deposito).trim() === "522",
    );

    const qlde = rows.filter(
      (row) => String(row.deposito).trim() === "523",
    );

    // REGRA DE NEGÓCIO:
    // QLD  = depósito 522 -> saldo LIVRE
    // QLDE = depósito 523 -> saldo BLOQUEADO

    const qldQuantidade = qld.reduce(
      (total, row) => total + row.qtdeLivre,
      0,
    );

    const qldValor = qld.reduce(
      (total, row) => total + row.valorLivre,
      0,
    );

    const qldeQuantidade = qlde.reduce(
      (total, row) => total + row.qtdeBloqueada,
      0,
    );

    const qldeValor = qlde.reduce(
      (total, row) => total + row.valorBloqueado,
      0,
    );

    const qldSkus = new Set(
      qld
        .filter((row) => row.qtdeLivre > 0 || row.valorLivre > 0)
        .map((row) => row.item),
    ).size;

    const qldeSkus = new Set(
      qlde
        .filter(
          (row) =>
            row.qtdeBloqueada > 0 || row.valorBloqueado > 0,
        )
        .map((row) => row.item),
    ).size;

    const atencoes = qld.filter(
      (row) => row.atencao.trim() !== "",
    ).length;

    const checksPendentes = qld.filter(
      (row) =>
        row.check.trim().toLowerCase() === "falso" ||
        row.check.trim().toLowerCase() === "false",
    ).length;

    return {
      qld,
      qlde,
      qldQuantidade,
      qldValor,
      qldSkus,
      qldeQuantidade,
      qldeValor,
      qldeSkus,
      atencoes,
      checksPendentes,
      totalQuantidade: qldQuantidade + qldeQuantidade,
      totalValor: qldValor + qldeValor,
    };
  }, [rows]);

  return (
    <div className="space-y-6">

      {/* HERO */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-destructive/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <Boxes className="h-4 w-4" />
              Gestão de materiais da qualidade
            </div>

            <h1 className="text-2xl font-bold tracking-tight">
              QLD / QLDE
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Visão operacional e financeira dos materiais em tratamento,
              retrabalho, bloqueio e tratativa com fornecedores.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-background/70 px-4 py-3 backdrop-blur">
            <div className="text-xs text-muted-foreground">
              Exposição financeira total
            </div>

            <div className="mt-1 text-2xl font-bold tabular-nums">
              {moeda.format(indicadores.totalValor)}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              {numero.format(indicadores.totalQuantidade)} peças
            </div>
          </div>
        </div>
      </div>

      {/* RESUMO EXECUTIVO QLD / QLDE */}
      <SectionCard
        title="Resumo Executivo QLD / QLDE"
        printable
        printTitle="QLD / QLDE — Exposição Financeira e Materiais"
className="overflow-visible qld-print-summary"
      >
        <div className="space-y-5">

          {/* CARDS PRINCIPAIS */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

            {/* QLD */}
            <div className="relative overflow-hidden rounded-2xl border border-warning/30 bg-gradient-to-br from-warning/10 via-card to-card p-5 shadow-sm">
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-warning/10 blur-3xl" />

              <div className="relative">
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-xl bg-warning/15 p-2 text-warning">
                        <Wrench className="h-5 w-5" />
                      </div>

                      <div>
                        <h2 className="text-lg font-bold">QLD</h2>
                        <p className="text-xs text-muted-foreground">
                          Depósito 522 · Saldo livre
                        </p>
                      </div>
                    </div>
                  </div>

                  <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
                    Em tratamento
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Metric
                    label="Valor"
                    value={moeda.format(indicadores.qldValor)}
                  />

                  <Metric
                    label="Quantidade"
                    value={numero.format(indicadores.qldQuantidade)}
                  />

                  <Metric
                    label="SKUs"
                    value={numero.format(indicadores.qldSkus)}
                  />
                </div>
              </div>
            </div>

            {/* QLDE */}
            <div className="relative overflow-hidden rounded-2xl border border-destructive/30 bg-gradient-to-br from-destructive/10 via-card to-card p-5 shadow-sm">
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-destructive/10 blur-3xl" />

              <div className="relative">
                <div className="mb-5 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl bg-destructive/15 p-2 text-destructive">
                      <ShieldAlert className="h-5 w-5" />
                    </div>

                    <div>
                      <h2 className="text-lg font-bold">QLDE</h2>
                      <p className="text-xs text-muted-foreground">
                        Depósito 523 · Saldo bloqueado
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                    Bloqueado
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Metric
                    label="Valor"
                    value={moeda.format(indicadores.qldeValor)}
                  />

                  <Metric
                    label="Quantidade"
                    value={numero.format(indicadores.qldeQuantidade)}
                  />

                  <Metric
                    label="SKUs"
                    value={numero.format(indicadores.qldeSkus)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* INDICADORES OPERACIONAIS */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SmallCard
              label="Valor total"
              value={moeda.format(indicadores.totalValor)}
              icon={<CircleDollarSign className="h-4 w-4" />}
            />

            <SmallCard
              label="Peças"
              value={numero.format(indicadores.totalQuantidade)}
              icon={<Boxes className="h-4 w-4" />}
            />

            <SmallCard
              label="Itens com atenção"
              value={numero.format(indicadores.atencoes)}
              icon={<AlertTriangle className="h-4 w-4" />}
            />

            <SmallCard
              label="Checks pendentes"
              value={numero.format(indicadores.checksPendentes)}
              icon={<PackageCheck className="h-4 w-4" />}
            />
          </div>

        </div>
      </SectionCard>

{/* ANÁLISE FINANCEIRA */}
<SectionCard
  title="Análise de Exposição Financeira"
  printable
  printTitle="QLD / QLDE — Análise de Exposição Financeira"
>
  <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.4fr]">

    {/* DISTRIBUIÇÃO QLD x QLDE */}
    <div className="relative overflow-hidden rounded-2xl border border-border bg-background/40 p-5">
      <div className="mb-1 text-sm font-semibold">
        Distribuição financeira
      </div>

      <div className="text-xs text-muted-foreground">
        Participação do QLD e QLDE na exposição total
      </div>

      <div className="relative mt-4 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[
                {
                  name: "QLD",
                  value: indicadores.qldValor,
                },
                {
                  name: "QLDE",
                  value: indicadores.qldeValor,
                },
              ]}
              cx="50%"
              cy="50%"
              innerRadius={72}
              outerRadius={100}
              paddingAngle={4}
              dataKey="value"
              strokeWidth={0}
            >
              <Cell fill="#f59e0b" />
              <Cell fill="#ef4444" />
            </Pie>

            <Tooltip
              formatter={(value: number) => moeda.format(value)}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Exposição
          </span>

          <span className="mt-1 text-xl font-bold tabular-nums">
            {moeda.format(indicadores.totalValor)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-warning">
            <span className="h-2 w-2 rounded-full bg-warning" />
            QLD · 522
          </div>

          <div className="mt-2 text-lg font-bold">
            {indicadores.totalValor > 0
              ? (
                  (indicadores.qldValor /
                    indicadores.totalValor) *
                  100
                ).toFixed(1)
              : "0.0"}
            %
          </div>

          <div className="text-xs text-muted-foreground">
            {moeda.format(indicadores.qldValor)}
          </div>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-destructive">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            QLDE · 523
          </div>

          <div className="mt-2 text-lg font-bold">
            {indicadores.totalValor > 0
              ? (
                  (indicadores.qldeValor /
                    indicadores.totalValor) *
                  100
                ).toFixed(1)
              : "0.0"}
            %
          </div>

          <div className="text-xs text-muted-foreground">
            {moeda.format(indicadores.qldeValor)}
          </div>
        </div>
      </div>
    </div>

    {/* TOP EXPOSIÇÃO */}
    <div className="relative overflow-hidden rounded-2xl border border-border bg-background/40 p-5">
      <div className="mb-1 text-sm font-semibold">
        Maiores exposições financeiras
      </div>

      <div className="text-xs text-muted-foreground">
        Itens com maior impacto financeiro no estoque da Qualidade
      </div>

      <div className="mt-5 h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={[
              ...indicadores.qld.map((row) => ({
                item: row.item,
                valor: row.valorLivre,
                tipo: "QLD",
              })),
              ...indicadores.qlde.map((row) => ({
                item: row.item,
                valor: row.valorBloqueado,
                tipo: "QLDE",
              })),
            ]
              .filter((row) => row.valor > 0)
              .sort((a, b) => b.valor - a.valor)
              .slice(0, 8)}
            margin={{
              top: 5,
              right: 25,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              opacity={0.15}
            />

            <XAxis
              type="number"
              tickFormatter={(value) =>
                `${Math.round(value / 1000)}k`
              }
              tick={{ fontSize: 10 }}
            />

            <YAxis
              type="category"
              dataKey="item"
              width={75}
              tick={{ fontSize: 10 }}
            />

            <Tooltip
              formatter={(value: number) => [
                moeda.format(value),
                "Exposição",
              ]}
            />

            <Bar
              dataKey="valor"
              radius={[0, 6, 6, 0]}
            >
              {[
                ...indicadores.qld.map((row) => ({
                  item: row.item,
                  valor: row.valorLivre,
                  tipo: "QLD",
                })),
                ...indicadores.qlde.map((row) => ({
                  item: row.item,
                  valor: row.valorBloqueado,
                  tipo: "QLDE",
                })),
              ]
                .filter((row) => row.valor > 0)
                .sort((a, b) => b.valor - a.valor)
                .slice(0, 8)
                .map((entry, index) => (
                  <Cell
                    key={`${entry.item}-${index}`}
                    fill={
                      entry.tipo === "QLDE"
                        ? "#ef4444"
                        : "#f59e0b"
                    }
                  />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
</SectionCard>

      {/* TABELA QLD */}
      <SectionCard
        title="QLD · Depósito 522"
        printable
        printTitle="QLD — Depósito 522"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-3">Item</th>
                <th className="py-3 px-3 text-right">Qtde.</th>
                <th className="py-3 px-3 text-right">Valor</th>
                <th className="py-3 px-3">Ação</th>
                <th className="py-3 px-3 text-center">Check</th>
                <th className="py-3 pl-3">Atenção</th>
              </tr>
            </thead>

            <tbody>
              {indicadores.qld.map((row, index) => {
                const checked =
                  row.check.toLowerCase() === "verdadeiro" ||
                  row.check.toLowerCase() === "true";

                return (
                  <tr
                    key={`${row.item}-${index}`}
                    className="border-b last:border-0 hover:bg-muted/40"
                  >
                    <td className="py-3 pr-3 font-semibold">
                      {row.item || "—"}
                    </td>

                    <td className="py-3 px-3 text-right tabular-nums">
                      {numero.format(row.qtdeLivre)}
                    </td>

                    <td className="py-3 px-3 text-right font-medium tabular-nums">
                      {moeda.format(row.valorLivre)}
                    </td>

                    <td className="py-3 px-3">
                      {row.acao || "—"}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={
                          checked
                            ? "inline-flex rounded-full bg-success/15 px-2 py-1 text-xs font-semibold text-success"
                            : "inline-flex rounded-full bg-warning/15 px-2 py-1 text-xs font-semibold text-warning"
                        }
                      >
                        {checked ? "OK" : "Pendente"}
                      </span>
                    </td>

                    <td className="py-3 pl-3">
                      {row.atencao ? (
                        <span className="text-xs font-medium text-warning">
                          {row.atencao}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* TABELA QLDE */}
      <SectionCard
        title="QLDE · Depósito 523"
        printable
        printTitle="QLDE — Depósito 523"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-3">Item</th>
                <th className="py-3 px-3 text-right">
                  Qtde. bloqueada
                </th>
                <th className="py-3 px-3 text-right">
                  Valor bloqueado
                </th>
                <th className="py-3 pl-3">Situação</th>
              </tr>
            </thead>

            <tbody>
              {indicadores.qlde.map((row, index) => (
                <tr
                  key={`${row.item}-${index}`}
                  className="border-b last:border-0 hover:bg-muted/40"
                >
                  <td className="py-3 pr-3 font-semibold">
                    {row.item || "—"}
                  </td>

                  <td className="py-3 px-3 text-right tabular-nums">
                    {numero.format(row.qtdeBloqueada)}
                  </td>

                  <td className="py-3 px-3 text-right font-medium tabular-nums">
                    {moeda.format(row.valorBloqueado)}
                  </td>

                  <td className="py-3 pl-3">
                    <span className="inline-flex rounded-full bg-destructive/15 px-2 py-1 text-xs font-semibold text-destructive">
                      Bloqueado
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/60 p-3 backdrop-blur">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function SmallCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>

      <div className="mt-2 text-xl font-bold tabular-nums">
        {value}
      </div>
    </div>
  );
}