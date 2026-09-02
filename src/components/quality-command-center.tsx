import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bot,
  ChevronRight,
  CircleGauge,
  GitCompareArrows,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildExecutiveSummary,
  buildPareto,
  type ChangeItem,
  type QualityAnomaly,
  type QualitySnapshot,
  type RiskLevel,
  type SupplierQualityScore,
} from "@/lib/quality-intelligence";
import type { IDFRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const RISK_STYLE: Record<
  RiskLevel,
  { label: string; text: string; bg: string; border: string; dot: string }
> = {
  critico: {
    label: "CRÍTICO",
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    dot: "bg-red-500",
  },
  alto: {
    label: "ALTO",
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    dot: "bg-orange-500",
  },
  atencao: {
    label: "ATENÇÃO",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    dot: "bg-amber-500",
  },
  controlado: {
    label: "CONTROLADO",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    dot: "bg-emerald-500",
  },
};

export function QualityCommandHero({
  snapshot,
  fetchedAt,
}: {
  snapshot: QualitySnapshot;
  fetchedAt?: string;
}) {
  const updated = fetchedAt ? new Date(fetchedAt) : null;
  const updatedLabel =
    updated && !Number.isNaN(updated.getTime())
      ? updated.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "aguardando leitura";
  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.07] p-5 shadow-sm md:p-7">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
            <CircleGauge className="h-3.5 w-3.5" /> QualiHub · Quality Intelligence Platform
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-4xl">
            QUALITY COMMAND CENTER
          </h2>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">
            Central de Inteligência da Qualidade
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3 lg:min-w-[560px]">
          <HeroFact value={snapshot.fornecedores} label="fornecedores monitorados" />
          <HeroFact value={snapshot.inspecoes} label="inspeções no recorte" />
          <HeroFact value={updatedLabel} label="dados atualizados" raw />
        </div>
      </div>
    </section>
  );
}

function HeroFact({
  value,
  label,
  raw = false,
}: {
  value: number | string;
  label: string;
  raw?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-background/55 px-3 py-3 backdrop-blur">
      <div className="font-semibold tabular-nums">
        {raw ? value : Number(value).toLocaleString("pt-BR")}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export function QualityIntelligenceSections({
  idf,
  snapshot,
  scores,
  anomalies,
  changes,
  onSupplier,
}: {
  idf: IDFRow[];
  snapshot: QualitySnapshot;
  scores: SupplierQualityScore[];
  anomalies: QualityAnomaly[];
  changes: ChangeItem[];
  onSupplier: (supplier: string) => void;
}) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const summary = useMemo(
    () => buildExecutiveSummary(snapshot, scores, anomalies),
    [snapshot, scores, anomalies],
  );
  const topRisks = scores.filter((score) => score.risk !== "controlado").slice(0, 5);
  const paretos = useMemo(
    () => ({
      problema: buildPareto(idf, "problema"),
      fornecedor: buildPareto(idf, "fornecedor"),
      item: buildPareto(idf, "item"),
      divisao: buildPareto(idf, "divisao"),
    }),
    [idf],
  );

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Target className="h-4 w-4 text-destructive" /> Riscos que exigem atenção
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Priorização calculada pelo Quality Score e evidências disponíveis.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSummaryOpen(true)}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" /> Explicar meus indicadores
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {topRisks.length === 0 ? (
              <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed bg-emerald-500/5 p-5 text-center">
                <ShieldCheck className="mb-2 h-7 w-7 text-emerald-500" />
                <p className="text-sm font-semibold">Nenhum risco alto no recorte</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Os fornecedores com dados suficientes estão em nível controlado.
                </p>
              </div>
            ) : (
              topRisks.map((score, index) => (
                <RiskRow
                  key={score.fornecedor}
                  score={score}
                  index={index}
                  onClick={() => onSupplier(score.fornecedor)}
                />
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Radar className="h-4 w-4 text-primary" /> Detector de anomalias
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Compara a taxa recente de reprovação com o histórico mensal disponível.
          </p>
          <div className="mt-4 space-y-2">
            {anomalies.length === 0 ? (
              <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed p-5 text-center">
                <Radar className="mb-2 h-7 w-7 text-muted-foreground" />
                <p className="text-sm font-semibold">Nenhuma anomalia confirmada</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Quando não há amostra histórica suficiente, o sistema não fabrica uma conclusão.
                </p>
              </div>
            ) : (
              anomalies
                .slice(0, 4)
                .map((anomaly) => (
                  <AnomalyRow
                    key={anomaly.fornecedor}
                    anomaly={anomaly}
                    onClick={() => onSupplier(anomaly.fornecedor)}
                  />
                ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <GitCompareArrows className="h-4 w-4 text-primary" /> O que mudou?
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Período atual comparado ao período anterior equivalente.
        </p>
        {changes.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">
            Selecione “Comparar” nos filtros ou disponibilize histórico suficiente para esta
            análise.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {changes.map((change) => (
              <ChangeCard key={change.key} change={change} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BarChart3Icon /> Pareto inteligente
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Não conformidades reais: reprovados e condicionais.
          </p>
          <Tabs defaultValue="problema" className="mt-4">
            <TabsList className="grid h-auto w-full grid-cols-4">
              <TabsTrigger value="problema">Defeitos</TabsTrigger>
              <TabsTrigger value="fornecedor">Fornecedores</TabsTrigger>
              <TabsTrigger value="item">Itens</TabsTrigger>
              <TabsTrigger value="divisao">Divisões</TabsTrigger>
            </TabsList>
            {(Object.keys(paretos) as Array<keyof typeof paretos>).map((key) => (
              <TabsContent key={key} value={key}>
                <ParetoChart data={paretos[key]} />
              </TabsContent>
            ))}
          </Tabs>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CircleGauge className="h-4 w-4 text-primary" /> Matriz de risco
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Clique em um fornecedor para abrir a visão 360°.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(["critico", "alto", "atencao", "controlado"] as RiskLevel[]).map((risk) => {
              const group = scores.filter((score) => score.risk === risk);
              const style = RISK_STYLE[risk];
              return (
                <div
                  key={risk}
                  className={cn("min-h-32 rounded-xl border p-3", style.bg, style.border)}
                >
                  <div className={cn("flex items-center gap-2 text-[11px] font-bold", style.text)}>
                    <span className={cn("h-2 w-2 rounded-full", style.dot)} />
                    {style.label}
                    <span className="ml-auto tabular-nums">{group.length}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {group.slice(0, 10).map((score) => (
                      <button
                        key={score.fornecedor}
                        type="button"
                        onClick={() => onSupplier(score.fornecedor)}
                        className="rounded-md border bg-background/70 px-2 py-1 text-[10px] font-medium hover:border-primary"
                      >
                        {score.fornecedor} · {score.score}
                      </button>
                    ))}
                    {group.length === 0 && (
                      <span className="text-[10px] text-muted-foreground">Nenhum fornecedor</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CircleGauge className="h-4 w-4 text-primary" /> Quality Score dos fornecedores
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Score 0–100 com deduções versionadas e explicáveis; não há pesos escondidos.
            </p>
          </div>
          <Badge variant="outline">Modelo v1.0</Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {scores.slice(0, 9).map((score) => (
            <QualityScoreCard
              key={score.fornecedor}
              score={score}
              onClick={() => onSupplier(score.fornecedor)}
            />
          ))}
        </div>
      </section>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <Bot className="h-4 w-4" /> Qualidade Explica
            </div>
            <DialogTitle>Resumo executivo do recorte atual</DialogTitle>
            <DialogDescription>
              Gerado exclusivamente pelos indicadores calculados a partir da base carregada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {summary.map((line, index) => (
              <div
                key={`${line}-${index}`}
                className="flex gap-3 rounded-xl border bg-muted/30 p-4"
              >
                <span className="font-mono text-xs text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-sm leading-relaxed">{line}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RiskRow({
  score,
  index,
  onClick,
}: {
  score: SupplierQualityScore;
  index: number;
  onClick: () => void;
}) {
  const style = RISK_STYLE[score.risk];
  const reason = score.deductions[0]?.evidence ?? "Sem evidência de impacto relevante.";
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[34px_1fr_auto] items-center gap-3 rounded-xl border bg-muted/25 p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
    >
      <span className="font-mono text-sm text-muted-foreground">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="font-semibold">{score.fornecedor}</span>
          <Badge variant="outline" className={cn(style.bg, style.border, style.text)}>
            {style.label}
          </Badge>
        </span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{reason}</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="text-right">
          <span className="block text-lg font-bold tabular-nums">{score.score}</span>
          <span className="block text-[9px] uppercase text-muted-foreground">score</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </span>
    </button>
  );
}

function AnomalyRow({ anomaly, onClick }: { anomaly: QualityAnomaly; onClick: () => void }) {
  const style = RISK_STYLE[anomaly.severity];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("w-full rounded-xl border p-3 text-left", style.bg, style.border)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{anomaly.fornecedor}</span>
        <Badge variant="outline" className={cn(style.text, style.border)}>
          +{anomaly.variationPct.toFixed(0)}%
        </Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{anomaly.message}</p>
      <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        Amostra recente: {anomaly.sample} inspeções
      </p>
    </button>
  );
}

function ChangeCard({ change }: { change: ChangeItem }) {
  const up = change.delta > 0;
  const Icon = change.delta === 0 ? ArrowRight : up ? ArrowUpRight : ArrowDownRight;
  const favorable = change.favorable;
  const color =
    favorable === true
      ? "text-emerald-600 dark:text-emerald-400"
      : favorable === false
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";
  return (
    <div className="rounded-xl border bg-muted/25 p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{change.label}</span>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      <div className={cn("mt-2 text-2xl font-bold tabular-nums", color)}>
        {change.delta > 0 ? "+" : ""}
        {change.delta.toLocaleString("pt-BR")}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">
        {change.previous.toLocaleString("pt-BR")} → {change.current.toLocaleString("pt-BR")}
        {change.percent === null
          ? ""
          : ` · ${change.percent > 0 ? "+" : ""}${change.percent.toFixed(1)}%`}
      </div>
    </div>
  );
}

function ParetoChart({ data }: { data: ReturnType<typeof buildPareto> }) {
  if (!data.length)
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">
        Nenhuma não conformidade neste recorte.
      </div>
    );
  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: -20, bottom: 50 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            angle={-30}
            textAnchor="end"
            interval={0}
            height={70}
            fontSize={10}
            stroke="var(--color-muted-foreground)"
          />
          <YAxis fontSize={11} stroke="var(--color-muted-foreground)" />
          <Tooltip
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="value"
            name="Ocorrências"
            fill="var(--color-chart-rejected)"
            radius={[5, 5, 0, 0]}
          />
          <Line dataKey="cumulative" name="% acumulado" stroke="var(--color-warning)" />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground">
        Os itens exibidos representam {data.at(-1)?.cumulative.toFixed(1)}% das ocorrências
        consideradas.
      </p>
    </div>
  );
}

function QualityScoreCard({
  score,
  onClick,
}: {
  score: SupplierQualityScore;
  onClick: () => void;
}) {
  const style = RISK_STYLE[score.risk];
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border bg-muted/20 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold">{score.fornecedor}</p>
          <Badge variant="outline" className={cn("mt-1", style.bg, style.border, style.text)}>
            {score.label}
          </Badge>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold tabular-nums">{score.score}</span>
          <span className="text-xs text-muted-foreground"> / 100</span>
        </div>
      </div>
      <Progress value={score.score} className="mt-4 h-1.5" />
      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
        <span>
          {score.total}
          <b className="block text-foreground">inspeções</b>
        </span>
        <span>
          {score.rejectionRate.toFixed(1)}%<b className="block text-foreground">reprovação</b>
        </span>
        <span>
          {score.riskScore.toFixed(1)}
          <b className="block text-foreground">Risk Score</b>
        </span>
      </div>
      <p className="mt-3 truncate text-[10px] text-muted-foreground">
        {score.deductions[0]?.evidence ?? "Sem deduções relevantes."}
      </p>
    </button>
  );
}

function BarChart3Icon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 text-primary"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 3v18h18" />
      <path d="M7 16v-4M12 16V8M17 16V5" />
    </svg>
  );
}
