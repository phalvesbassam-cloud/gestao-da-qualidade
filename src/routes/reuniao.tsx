import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Boxes,
  BrainCircuit,
  CalendarDays,
  CircleX,
  Download,
  FileWarning,
  Gauge,
  Loader2,
  MonitorPlay,
  PackageSearch,
  Printer,
  Trophy,
  TrendingDown,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useDashboardFiltered } from "@/hooks/use-data";
import { useFilters } from "@/hooks/use-dashboard";
import {
  EmptyState,
  KpiCard,
  SectionCard,
  chartTooltip,
  formatPeriodLabel,
} from "@/components/dashboard-ui";
import { PresentationSelectable } from "@/components/presentation-selectable";
import { SlidePresenter } from "@/components/slide-presenter";
import { Button } from "@/components/ui/button";
import {
  buildMeeting,
  meetingSlides,
  specEficiencia,
  specFornecedores,
  specIndiceNC,
  specKpis,
  specPareto,
  specPpm,
  specQld,
  type Meeting,
  type NcMode,
} from "@/lib/meeting";
import type { PpmMode } from "@/lib/monthly-metrics";
import { generatePresentationPptx } from "@/lib/presentation-pptx";
import { printElement } from "@/lib/print";
import { moedaBR } from "@/lib/qld";
import { textSpec } from "@/lib/slide-spec";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reuniao")({
  head: () => ({ meta: [{ title: "Reunião Mensal — Gestão da Qualidade" }] }),
  component: ReuniaoMensalPage,
});

const num = (v: number) => Number(v || 0).toLocaleString("pt-BR");

function ReuniaoMensalPage() {
  const { data, filtered, efficiency } = useDashboardFiltered();
  const { filters } = useFilters();
  const [ncMode, setNcMode] = useState<NcMode>("inspecoes");
  const [ppmMode, setPpmMode] = useState<PpmMode>("sku");
  const [presenting, setPresenting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const hasDateFilter = Boolean(filters.from || filters.to);
  const periodo = hasDateFilter ? formatPeriodLabel(filters.from, filters.to) : "Todos os períodos";

  const m = useMemo(
    () =>
      buildMeeting({
        idf: filtered.idf,
        baseRows: efficiency.baseRows,
        efficiency,
        qldQlde: data?.qldQlde ?? [],
        alertas: filtered.alerta.length,
        rncs: filtered.rnc.length,
        hasDateFilter,
        periodo,
      }),
    [filtered, efficiency, data?.qldQlde, hasDateFilter, periodo],
  );

  const slides = useMemo(() => meetingSlides(m, { ncMode, ppmMode }), [m, ncMode, ppmMode]);
  const indiceNC = useMemo(() => m.indiceNC(ncMode), [m, ncMode]);
  const ppmSerie = m.ppm.map((x) => ({
    mes: x.mes,
    ppm: ppmMode === "sku" ? x.ppmSku : x.ppmPecas,
  }));
  const k = m.kpis;
  const sub = hasDateFilter ? `Período: ${periodo}` : `Ano-base ${m.year}`;

  const baixarPptx = async () => {
    setExporting(true);
    try {
      await generatePresentationPptx(slides, {
        theme: "dark",
        title: "Reunião Mensal da Qualidade",
        fileName: `Reuniao-Mensal-Qualidade-${new Date().toISOString().slice(0, 10)}.pptx`,
      });
      toast.success("PowerPoint da reunião gerado — textos, gráficos e tabelas editáveis.");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o PowerPoint.");
    } finally {
      setExporting(false);
    }
  };

  const imprimir = () =>
    printElement(reportRef.current, {
      title: "Reunião Mensal da Qualidade",
      subtitle: `${sub} · Resumo executivo`,
    });

  return (
    <div className="space-y-6">
      {/* HERO */}
      <section className="hero-panel p-6 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="eyebrow">
              <CalendarDays className="h-3.5 w-3.5" /> Gestão da Qualidade de Fornecedores
            </div>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
              Reunião Mensal
            </h1>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Cockpit executivo da Qualidade: desempenho, riscos, fornecedores e exposição
              financeira — pronto para apresentar em tela cheia ou baixar em PowerPoint editável.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip">{sub}</span>
              <span className="chip border-success/40 text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Dados sincronizados
              </span>
              <span className="chip">{slides.length} slides prontos</span>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                size="lg"
                onClick={() => setPresenting(true)}
                className="gap-2 shadow-lg shadow-primary/25"
              >
                <MonitorPlay className="h-5 w-5" /> Apresentar reunião
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={baixarPptx}
                disabled={exporting}
                className="gap-2"
              >
                {exporting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
                Baixar PowerPoint
              </Button>
              <Button size="lg" variant="ghost" onClick={imprimir} className="gap-2">
                <Printer className="h-5 w-5" /> Imprimir relatório
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:min-w-[440px]">
            <HeroStat
              label="Inspeções"
              value={num(k.totalInspecoes)}
              icon={<PackageSearch className="h-4 w-4" />}
            />
            <HeroStat
              label="Reprovadas"
              value={num(k.reprovados)}
              icon={<CircleX className="h-4 w-4" />}
              tone="text-destructive"
            />
            <HeroStat
              label="Alertas AQ"
              value={num(k.alertas)}
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="text-warning"
            />
            <HeroStat
              label="RNCs"
              value={num(k.rncs)}
              icon={<FileWarning className="h-4 w-4" />}
              tone="text-info"
            />
          </div>
        </div>
      </section>

      <div ref={reportRef} className="space-y-6">
        {/* KPIs */}
        <PresentationSelectable
          item={{
            id: "reuniao-kpis-executivos",
            title: "Indicadores executivos",
            subtitle: sub,
            type: "kpi-group",
            sourceRoute: "/reuniao",
            spec: specKpis(m),
          }}
        >
          <div>
            <SectionTitle
              eyebrow="Visão geral"
              title="Indicadores executivos"
              description="Consolidado dos principais indicadores da operação"
            />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <KpiCard
                label="PPM (peças)"
                value={num(k.ppmPecas)}
                hint={`${num(k.pecasNc)} NC / ${num(k.pecasTotal)} peças`}
                tone="info"
                icon={<Gauge className="h-4 w-4" />}
              />
              <KpiCard
                label="Inspeções"
                value={num(k.totalInspecoes)}
                hint={`${num(k.aprovados)} aprovadas · ${num(k.condicionais)} condicionais`}
                icon={<PackageSearch className="h-4 w-4" />}
              />
              <KpiCard
                label="Aprovados"
                value={num(k.aprovados)}
                hint="Inspeções aprovadas"
                tone="success"
                icon={<BadgeCheck className="h-4 w-4" />}
              />
              <KpiCard
                label="Reprovados"
                value={num(k.reprovados)}
                hint={`PPM SKU ${num(k.ppmSku)}`}
                tone="destructive"
                icon={<CircleX className="h-4 w-4" />}
              />
              <KpiCard
                label="Eficiência"
                value={`${k.eficiencia.toFixed(1)}%`}
                hint={`${num(k.inspecionadas)} de ${num(k.recebidas)} recebidas · meta 95%`}
                tone={k.eficiencia >= 95 ? "success" : "warning"}
                icon={<Activity className="h-4 w-4" />}
              />
              <KpiCard
                label="QLD + QLDE"
                value={moedaBR.format(m.qld.totalValor)}
                hint={`${num(m.qld.totalQuantidade)} peças ativas`}
                tone="warning"
                icon={<Boxes className="h-4 w-4" />}
              />
            </div>
          </div>
        </PresentationSelectable>

        {/* PPM + NC */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <PresentationSelectable
            item={{
              id: `reuniao-ppm-${ppmMode}`,
              title: "PPM mês a mês",
              subtitle:
                ppmMode === "sku"
                  ? "Linhas reprovadas ÷ linhas da planilha × 1.000.000 (cada linha = 1 SKU)"
                  : "Peças NC ÷ peças inspecionadas × 1.000.000",
              type: "chart",
              sourceRoute: "/reuniao",
              spec: specPpm(m, ppmMode),
            }}
          >
            <SectionCard
              title="PPM mês a mês"
              subtitle={
                ppmMode === "sku"
                  ? "Por SKU: cada linha da planilha IDF conta como 1 SKU"
                  : "Calculado por peças"
              }
              icon={<Gauge className="h-4 w-4" />}
              action={
                <div className="segmented">
                  <button
                    type="button"
                    data-active={ppmMode === "sku"}
                    onClick={() => setPpmMode("sku")}
                  >
                    SKU
                  </button>
                  <button
                    type="button"
                    data-active={ppmMode === "pecas"}
                    onClick={() => setPpmMode("pecas")}
                  >
                    Peças
                  </button>
                </div>
              }
              printable
              printTitle="Reunião Mensal — PPM mês a mês"
            >
              <div className="h-[290px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ppmSerie} margin={{ top: 24, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      width={60}
                      tickFormatter={(v) => num(v)}
                    />
                    <Tooltip {...chartTooltip} formatter={(v: number) => [num(v), "PPM"]} />
                    <Bar dataKey="ppm" fill="var(--chart-ppm)" radius={[6, 6, 0, 0]}>
                      <LabelList
                        dataKey="ppm"
                        position="top"
                        fontSize={10}
                        fill="var(--chart-axis)"
                        formatter={(v: number) => (v ? num(v) : "")}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="chip">
                  Acumulado:{" "}
                  <strong className="text-foreground">
                    {num(ppmMode === "sku" ? m.ppmAno.ppmSku : m.ppmAno.ppmPecas)}
                  </strong>
                </span>
                <span className="chip">
                  {ppmMode === "sku"
                    ? `${num(m.ppmAno.reprovadas)} reprovadas / ${num(m.ppmAno.inspecoes)} inspeções`
                    : `${num(m.ppmAno.pecasNc)} peças NC / ${num(m.ppmAno.pecas)} peças`}
                </span>
              </div>
            </SectionCard>
          </PresentationSelectable>

          <PresentationSelectable
            item={{
              id: `reuniao-indice-nc-${ncMode}`,
              title: "Índice de Não Conformidade",
              subtitle: `${ncMode === "inspecoes" ? "Por inspeções" : "Por SKU único"} · meta máxima 2%`,
              type: "chart",
              sourceRoute: "/reuniao",
              spec: specIndiceNC(m, ncMode),
            }}
          >
            <SectionCard
              title="Índice de Não Conformidade"
              subtitle="Meta máxima: 2%"
              icon={<TrendingDown className="h-4 w-4" />}
              action={
                <div className="segmented">
                  <button
                    type="button"
                    data-active={ncMode === "inspecoes"}
                    onClick={() => setNcMode("inspecoes")}
                  >
                    Inspeções
                  </button>
                  <button
                    type="button"
                    data-active={ncMode === "sku"}
                    onClick={() => setNcMode("sku")}
                  >
                    SKU único
                  </button>
                </div>
              }
              printable
              printTitle="Reunião Mensal — Índice de Não Conformidade"
            >
              <div className="h-[290px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={indiceNC} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      width={44}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      {...chartTooltip}
                      formatter={(v: number) => [`${Number(v).toFixed(2)}%`, "Índice NC"]}
                    />
                    <ReferenceLine
                      y={2}
                      stroke="var(--color-warning)"
                      strokeDasharray="6 5"
                      label={{
                        value: "Meta 2%",
                        position: "insideTopRight",
                        fill: "var(--color-warning)",
                        fontSize: 11,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="indice"
                      stroke="var(--color-primary)"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "var(--color-primary)", strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    >
                      <LabelList
                        dataKey="indice"
                        position="top"
                        fontSize={10}
                        fill="var(--chart-axis)"
                        formatter={(v: number) => (v ? `${v}%` : "")}
                      />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </PresentationSelectable>
        </div>

        {/* EFICIÊNCIA */}
        <PresentationSelectable
          item={{
            id: "reuniao-eficiencia-mensal",
            title: "Eficiência das inspeções",
            subtitle: "Recebidas × inspecionadas × eficiência (meta 95%)",
            type: "chart",
            sourceRoute: "/reuniao",
            spec: specEficiencia(m),
          }}
        >
          <SectionCard
            title="Eficiência mensal das inspeções"
            subtitle="Recebidas (data de criação) × inspecionadas (data de início) · meta 95%"
            icon={<Activity className="h-4 w-4" />}
            printable
            printTitle="Reunião Mensal — Eficiência das inspeções"
          >
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={m.eficienciaMensal}
                  margin={{ top: 22, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={54}
                    tickFormatter={(v) => num(v)}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={44}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip {...chartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine
                    yAxisId="right"
                    y={95}
                    stroke="var(--color-warning)"
                    strokeDasharray="6 5"
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="recebidas"
                    name="Recebidas"
                    fill="var(--chart-insp)"
                    radius={[5, 5, 0, 0]}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="inspecionadas"
                    name="Inspecionadas"
                    fill="var(--chart-rnc)"
                    radius={[5, 5, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="eficiencia"
                    name="Eficiência (%)"
                    stroke="var(--chart-approved)"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 0, fill: "var(--chart-approved)" }}
                  >
                    <LabelList
                      dataKey="eficiencia"
                      position="top"
                      fontSize={10}
                      fill="var(--chart-axis)"
                      formatter={(v: number) => (v ? `${v}%` : "")}
                    />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </PresentationSelectable>

        {/* PARETO + FORNECEDORES */}
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.4fr_1fr]">
          <PresentationSelectable
            item={{
              id: "reuniao-pareto",
              title: "Pareto das reprovações",
              subtitle: "Principais causas e percentual acumulado",
              type: "chart",
              sourceRoute: "/reuniao",
              spec: specPareto(m),
            }}
          >
            <SectionCard
              title="Pareto das reprovações"
              subtitle="Principais causas e percentual acumulado"
              icon={<BarChartIcon />}
              printable
              printTitle="Reunião Mensal — Pareto das reprovações"
            >
              {m.pareto.length === 0 ? (
                <EmptyState label="Sem reprovações no recorte" />
              ) : (
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={m.pareto}
                      margin={{ top: 18, right: 8, left: 0, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="nome"
                        tickLine={false}
                        axisLine={false}
                        fontSize={10}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        yAxisId="left"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        width={40}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 100]}
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        width={44}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip {...chartTooltip} />
                      <Bar
                        yAxisId="left"
                        dataKey="ocorrencias"
                        name="Ocorrências"
                        fill="var(--color-primary)"
                        radius={[5, 5, 0, 0]}
                      >
                        <LabelList
                          dataKey="ocorrencias"
                          position="top"
                          fontSize={10}
                          fill="var(--chart-axis)"
                        />
                      </Bar>
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="acumulado"
                        name="% acumulado"
                        stroke="var(--chart-conditional)"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>
          </PresentationSelectable>

          <div className="grid grid-cols-1 gap-4">
            <PresentationSelectable
              item={{
                id: "reuniao-fornecedores-criticos",
                title: "Fornecedores críticos",
                subtitle: "Maior índice de reprovação no período",
                type: "table",
                sourceRoute: "/reuniao",
                spec: specFornecedores(m.criticos),
              }}
            >
              <Ranking
                title="Fornecedores críticos"
                subtitle="Maior índice de reprovação"
                list={m.criticos}
                tone="bad"
              />
            </PresentationSelectable>
            <PresentationSelectable
              item={{
                id: "reuniao-fornecedores-melhores",
                title: "Melhores fornecedores",
                subtitle: "Menor índice de reprovação (mín. 5 inspeções)",
                type: "table",
                sourceRoute: "/reuniao",
                spec: specFornecedores(m.melhores),
              }}
            >
              <Ranking
                title="Melhores fornecedores"
                subtitle="Menor índice de reprovação (mín. 5 inspeções)"
                list={m.melhores}
                tone="good"
              />
            </PresentationSelectable>
          </div>
        </div>

        {/* QLD + LEITURA */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <PresentationSelectable
            item={{
              id: "reuniao-qld-qlde",
              title: "QLD / QLDE",
              subtitle: "Exposição financeira ativa dos depósitos 522 e 523",
              type: "kpi-group",
              sourceRoute: "/reuniao",
              spec: specQld(m),
            }}
          >
            <SectionCard
              title="QLD / QLDE"
              subtitle="Exposição financeira ativa (itens resolvidos não entram)"
              icon={<Boxes className="h-4 w-4" />}
            >
              <div className="grid grid-cols-2 gap-3">
                <StockBox
                  label="QLD · 522"
                  value={moedaBR.format(m.qld.qldValor)}
                  hint={`${num(m.qld.qldQuantidade)} peças · ${m.qld.qldSkus} SKUs`}
                  cor="var(--chart-conditional)"
                />
                <StockBox
                  label="QLDE · 523"
                  value={moedaBR.format(m.qld.qldeValor)}
                  hint={`${num(m.qld.qldeQuantidade)} peças · ${m.qld.qldeSkus} SKUs`}
                  cor="var(--chart-rejected)"
                />
                <StockBox
                  label="Exposição ativa"
                  value={moedaBR.format(m.qld.totalValor)}
                  hint={`${num(m.qld.totalQuantidade)} peças`}
                  cor="var(--color-foreground)"
                />
                <StockBox
                  label="Resolvidos"
                  value={num(m.qld.resolvidos.length)}
                  hint={moedaBR.format(m.qld.resolvidosValor)}
                  cor="var(--chart-approved)"
                />
              </div>
            </SectionCard>
          </PresentationSelectable>

          <PresentationSelectable
            item={{
              id: "reuniao-leitura-executiva",
              title: "Leitura executiva",
              subtitle: "Fatos do período gerados a partir dos dados",
              type: "text",
              sourceRoute: "/reuniao",
              spec: textSpec(m.leitura),
            }}
          >
            <SectionCard
              title="Leitura executiva"
              subtitle="Fatos do período, direto dos dados do QualiHub"
              icon={<BrainCircuit className="h-4 w-4" />}
            >
              <ul className="space-y-3">
                {m.leitura.map((l, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-sm bg-primary" />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </PresentationSelectable>
        </div>
      </div>

      {presenting && (
        <SlidePresenter
          slides={slides}
          theme="dark"
          fileName={`Reuniao-Mensal-Qualidade-${new Date().toISOString().slice(0, 10)}.pptx`}
          onClose={() => setPresenting(false)}
        />
      )}
    </div>
  );
}

function BarChartIcon() {
  return <TrendingDown className="h-4 w-4 rotate-90" />;
}

function HeroStat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <div className="surface px-4 py-3.5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <span className={cn("text-muted-foreground", tone)}>{icon}</span>
        {label}
      </div>
      <div className={cn("mt-1.5 font-display text-3xl font-bold tabular-nums", tone)}>{value}</div>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h2 className="mt-1 font-display text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Ranking({
  title,
  subtitle,
  list,
  tone,
}: {
  title: string;
  subtitle: string;
  list: Meeting["criticos"];
  tone: "good" | "bad";
}) {
  const color = tone === "bad" ? "var(--chart-rejected)" : "var(--chart-approved)";
  const max = Math.max(...list.map((x) => x.indiceNC), 1);
  return (
    <SectionCard
      title={title}
      subtitle={subtitle}
      icon={tone === "bad" ? <AlertTriangle className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
    >
      {list.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          Sem fornecedores no recorte.
        </div>
      ) : (
        <ol className="space-y-2.5">
          {list.map((x, i) => (
            <li key={x.fornecedor} className="flex items-center gap-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                style={{ background: `color-mix(in oklab, ${color} 15%, transparent)`, color }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{x.fornecedor}</span>
                  <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color }}>
                    {x.indiceNC.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, (x.indiceNC / max) * 100)}%`,
                        background: color,
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {x.reprovados}/{x.total} insp.
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

function StockBox({
  label,
  value,
  hint,
  cor,
}: {
  label: string;
  value: string;
  hint: string;
  cor: string;
}) {
  return (
    <div className="surface-muted relative overflow-hidden p-4">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} />
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
