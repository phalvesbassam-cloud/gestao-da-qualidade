import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BellRing,
  CircleGauge,
  FileWarning,
  PackageSearch,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KpiCard, PpmCard, SectionCard } from "@/components/dashboard-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useDashboard } from "@/hooks/use-data";
import { parseBrDate } from "@/lib/idf-calc";
import {
  buildMonthlyEfficiency,
  buildPareto,
  calculateSupplierQualityScores,
  isApproved,
  isConditional,
  isRejected,
  supplierForRnc,
} from "@/lib/quality-intelligence";

export const Route = createFileRoute("/fornecedor/$fornecedor")({
  head: ({ params }) => ({
    meta: [{ title: `${decodeURIComponent(params.fornecedor)} — Fornecedor 360°` }],
  }),
  component: Supplier360Page,
});

function Supplier360Page() {
  const { fornecedor } = Route.useParams();
  const supplier = decodeURIComponent(fornecedor);
  const data = useDashboard();

  const view = useMemo(() => {
    if (!data) return null;
    const idf = data.idf.filter(
      (row) =>
        row.fornecedor.trim().toLocaleLowerCase("pt-BR") ===
        supplier.trim().toLocaleLowerCase("pt-BR"),
    );
    const alerta = data.alerta.filter(
      (row) =>
        row.fornecedor.trim().toLocaleLowerCase("pt-BR") ===
        supplier.trim().toLocaleLowerCase("pt-BR"),
    );
    const rnc = data.rnc.filter(
      (row) =>
        supplierForRnc(row, data.idf)?.toLocaleLowerCase("pt-BR") ===
        supplier.trim().toLocaleLowerCase("pt-BR"),
    );
    const scores = calculateSupplierQualityScores({ idf, alerta, rnc });
    return { idf, alerta, rnc, score: scores[0] ?? null };
  }, [data, supplier]);

  const evolution = useMemo(() => {
    const map = new Map<
      string,
      {
        month: string;
        total: number;
        approved: number;
        conditional: number;
        rejected: number;
        idf: number;
      }
    >();
    for (const row of view?.idf ?? []) {
      if (!row.dataReferencia) continue;
      const key = `${row.dataReferencia.getFullYear()}-${String(row.dataReferencia.getMonth() + 1).padStart(2, "0")}`;
      const bucket = map.get(key) ?? {
        month: key,
        total: 0,
        approved: 0,
        conditional: 0,
        rejected: 0,
        idf: 0,
      };
      bucket.total++;
      if (isApproved(row.status)) bucket.approved++;
      else if (isConditional(row.status)) bucket.conditional++;
      else if (isRejected(row.status)) bucket.rejected++;
      bucket.idf = bucket.total ? Math.round((bucket.approved / bucket.total) * 1000) / 10 : 0;
      map.set(key, bucket);
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }, [view?.idf]);

  const monthlyEfficiency = useMemo(() => buildMonthlyEfficiency(view?.idf ?? []), [view?.idf]);
  const defects = useMemo(() => buildPareto(view?.idf ?? [], "problema", 10), [view?.idf]);

  if (!data || !view)
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Carregando dados reais do fornecedor…
      </div>
    );
  const approved = view.idf.filter((row) => isApproved(row.status)).length;
  const conditional = view.idf.filter((row) => isConditional(row.status)).length;
  const rejected = view.idf.filter((row) => isRejected(row.status)).length;
  const idfPct = view.idf.length ? (approved / view.idf.length) * 100 : 0;
  const received = view.idf.filter((row) => parseBrDate(row.dataCriacaoInsp)).length;
  const inspected = view.idf.filter((row) => parseBrDate(row.dataInicioInsp)).length;
  const operationalEfficiency = inspected > 0 ? (received / inspected) * 100 : 0;
  const score = view.score;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" asChild>
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Command Center
          </Link>
        </Button>
        <Badge variant="outline">Visão 360° · dados reais</Badge>
      </div>

      <section className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-primary/[0.07] p-6 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Fornecedor 360°
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">{supplier}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Desempenho, risco, ocorrências e histórico conectados.
            </p>
          </div>
          {score ? (
            <div className="min-w-64 rounded-2xl border bg-background/70 p-5 backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Quality Score
                </span>
                <CircleGauge className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-2">
                <span className="text-4xl font-bold tabular-nums">{score.score}</span>
                <span className="text-sm text-muted-foreground"> / 100</span>
              </div>
              <Progress value={score.score} className="mt-3 h-2" />
              <Badge variant="outline" className="mt-3">
                {score.label}
              </Badge>
              <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                Risk Score: <b className="text-foreground">{score.riskScore.toFixed(1)} / 100</b>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Dados insuficientes para calcular score.
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        <KpiCard
          label="IDF"
          value={`${idfPct.toFixed(1)}%`}
          tone="success"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <PpmCard idf={view.idf} />
        <KpiCard label="Recebimentos" value={received} hint="Data de Criação" tone="info" />
        <KpiCard
          label="Eficiência"
          value={inspected > 0 ? `${operationalEfficiency.toFixed(2)}%` : "—"}
          hint="Recebidos ÷ Inspecionados"
          tone={operationalEfficiency >= 95 ? "success" : "warning"}
        />
        <KpiCard
          label="Inspeções"
          value={view.idf.length}
          icon={<PackageSearch className="h-4 w-4" />}
        />
        <KpiCard label="Aprovados" value={approved} tone="success" />
        <KpiCard label="Condicionais" value={conditional} tone="warning" />
        <KpiCard
          label="Reprovados"
          value={rejected}
          tone="destructive"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <KpiCard
          label="Alertas"
          value={view.alerta.length}
          tone="warning"
          icon={<BellRing className="h-4 w-4" />}
        />
        <KpiCard
          label="RNCs"
          value={view.rnc.length}
          tone="info"
          icon={<FileWarning className="h-4 w-4" />}
        />
      </div>

      {score && (
        <SectionCard title="Por que este Quality Score?">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div className="rounded-xl border bg-primary/5 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> Recomendação da QualiAI
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {score.recommendation}
              </p>
            </div>
            <div className="space-y-2">
              {score.deductions.length ? (
                score.deductions.map((deduction) => (
                  <div
                    key={deduction.key}
                    className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{deduction.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{deduction.evidence}</p>
                    </div>
                    <Badge variant="destructive">-{deduction.points.toFixed(1)} pts</Badge>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                  Nenhuma dedução relevante no modelo atual.
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Evolução dos últimos meses">
          {evolution.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolution}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="idf"
                  name="IDF %"
                  stroke="var(--color-success)"
                  strokeWidth={2.5}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyData />
          )}
        </SectionCard>
        <SectionCard
          title={`Eficiência operacional${monthlyEfficiency[0] ? ` · ${monthlyEfficiency[0].year}` : ""}`}
        >
          {monthlyEfficiency.some((row) => row.recebidas || row.inspecionadas) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyEfficiency}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="mesCurto" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Bar dataKey="recebidas" name="Recebidos" fill="var(--color-chart-insp)" />
                <Bar
                  dataKey="inspecionadas"
                  name="Inspecionados"
                  fill="var(--color-chart-approved)"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyData />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Principais defeitos · Pareto">
        {defects.length ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={defects} margin={{ bottom: 70 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                angle={-30}
                textAnchor="end"
                interval={0}
                height={80}
                fontSize={10}
              />
              <YAxis fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                }}
              />
              <Bar
                dataKey="value"
                name="Ocorrências"
                fill="var(--color-chart-rejected)"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyData />
        )}
      </SectionCard>
    </div>
  );
}

function EmptyData() {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
      Dados insuficientes neste recorte.
    </div>
  );
}
