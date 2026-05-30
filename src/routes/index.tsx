import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, AlertTriangle, Award, CheckCircle2, FileWarning, ShieldAlert, Siren, TrendingUp, Trophy, Users } from "lucide-react";
import { useMemo } from "react";
import { useDashboardFiltered } from "@/hooks/use-data";
import { KpiCard, PpmCard, SectionCard, StatusDot, ClassBadge, DeltaBadge, EmptyState, EficienciaInspecaoCard } from "@/components/dashboard-ui";
import { useNavigate } from "@tanstack/react-router";
import { scoreFornecedores } from "@/lib/idf-calc";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Consolidado — Gestão da Qualidade de Fornecedores" },
      { name: "description", content: "Visão consolidada de IDF, alertas e RNC dos fornecedores." },
    ],
  }),
  component: ConsolidadoPage,
});

const STATUS_COLORS: Record<string, string> = {
  verde: "var(--color-success)",
  azul: "var(--color-info)",
  amarelo: "var(--color-warning)",
  vermelho: "var(--color-destructive)",
};

function ConsolidadoPage() {
  const { filtered, previous, compare } = useDashboardFiltered();
  const navigate = useNavigate();
  const idf = filtered.idf;
  const alertas = filtered.alerta;
  const rncs = filtered.rnc;
  const lower = (value: unknown) => String(value ?? "").toLowerCase();

  const totalInsp = idf.length;
  const aprov = idf.filter((r) => lower(r.status).includes("aprovado")).length;
  const cond = idf.filter((r) =>
    lower(r.status).includes("aprovação condicional") ||
    lower(r.status).includes("aprovacao condicional"),
  ).length;
  const repr = idf.filter((r) => lower(r.status).includes("reprov")).length;
  const idfGlobal = totalInsp > 0 ? Math.round((aprov / totalInsp) * 1000) / 10 : 0;

  // Eficiência de Inspeção de Recebimento
  // Totais consolidados no período (independentes):
  // Recebidos = soma de itens com data na coluna I (dataRecebimento)
  // Inspecionados = soma de itens com data na coluna E (dataFimInsp)
  // Pode ultrapassar 100% (inspeções finalizam SKUs acumulados de períodos anteriores).
  const hasDate = (v: unknown) => String(v ?? "").trim() !== "";
  const skusRecebidos = idf.filter((r) => hasDate(r.dataRecebimento)).length;
  const skusInspecionados = idf.filter((r) => hasDate(r.dataFimInsp)).length;
  const skusPendentes = Math.max(0, skusRecebidos - skusInspecionados);
  const eficienciaPrev = useMemo(() => {
    if (!compare || !previous) return null;
    const rec = previous.idf.filter((r) => hasDate(r.dataRecebimento)).length;
    const ins = previous.idf.filter((r) => hasDate(r.dataFimInsp)).length;
    return rec > 0 ? (ins / rec) * 100 : 0;
  }, [compare, previous]);

  // métricas anteriores (modo comparação)
  const prev = useMemo(() => {
    if (!compare || !previous) return null;
    const pIdf = previous.idf;
    const pAprov = pIdf.filter((r) => lower(r.status).includes("aprovado")).length;
    const pCond = pIdf.filter((r) =>
      lower(r.status).includes("aprovação condicional") ||
      lower(r.status).includes("aprovacao condicional"),
    ).length;
    const pRepr = pIdf.filter((r) => lower(r.status).includes("reprov")).length;
    const pTotal = pIdf.length;
    const pIdfPct = pTotal > 0 ? Math.round((pAprov / pTotal) * 1000) / 10 : 0;
    const pAqPend = previous.alerta.filter((a) => !a.finalizado).length;
    return {
      total: pTotal,
      aprov: pAprov,
      cond: pCond,
      repr: pRepr,
      idfPct: pIdfPct,
      alertas: previous.alerta.length,
      aqPend: pAqPend,
      rncs: previous.rnc.length,
    };
  }, [compare, previous]);


  // Score Frasle (NC por reprovadas × criticidade)
  const scored = useMemo(() => scoreFornecedores(idf, alertas, rncs), [idf, alertas, rncs]);
  const ranking = useMemo(() => {
    const INVALID_FORN = /^(ano fiscal|fornecedor|total|geral|resumo|n\/a|nd|null|—|-)$/i;
    return scored
      .filter((s) => {
        const nome = String(s.fornecedor ?? "").trim();
        if (!nome || nome.length < 2) return false;
        if (INVALID_FORN.test(nome)) return false;
        // só entra no ranking se houver inspeções reais
        if (!s.totalInsp || s.totalInsp <= 0) return false;
        return true;
      })
      .map((s) => ({
        f: s.fornecedor,
        total: s.totalInsp,
        ap: s.aprovados,
        co: s.condicionais,
        re: s.reprovados,
        al: s.alertas,
        rn: s.rncs,
        pct: s.idfPct,
        cls: s.classificacao,
        status: s.status,
      }));
  }, [scored]);

  const statusDist = [
    { name: "Aprovado", value: aprov, color: "var(--color-chart-approved)" },
    { name: "Condicional", value: cond, color: "var(--color-chart-conditional)" },
    { name: "Reprovado", value: repr, color: "var(--color-chart-rejected)" },
  ];
  const statusDistVisible = statusDist.filter((s) => s.value > 0);

  const porDivisao = useMemo(() => {
    const map = new Map<string, { divisao: string; aprovado: number; condicional: number; reprovado: number }>();
    for (const r of idf) {
      const d = r.divisao || "—";
      const e = map.get(d) ?? { divisao: d, aprovado: 0, condicional: 0, reprovado: 0 };
      const s = lower(r.status);
      if (s.includes("aprovação condicional") || s.includes("aprovacao condicional")) e.condicional++;
      else if (s.includes("reprov")) e.reprovado++;
      else if (s.includes("aprovado")) e.aprovado++;
      map.set(d, e);
    }
    return [...map.values()];
  }, [idf]);

  const evolucao = useMemo(() => {
    const map = new Map<string, { mes: string; idf: number; alertas: number; rnc: number }>();
    const k = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    for (const r of idf) {
      if (!r.dataReferencia) continue;
      const key = k(r.dataReferencia);
      const e = map.get(key) ?? { mes: key, idf: 0, alertas: 0, rnc: 0 };
      e.idf++;
      map.set(key, e);
    }
    for (const a of alertas) {
      if (!a.dataReferencia) continue;
      const key = k(a.dataReferencia);
      const e = map.get(key) ?? { mes: key, idf: 0, alertas: 0, rnc: 0 };
      e.alertas++;
      map.set(key, e);
    }
    for (const r of rncs) {
      if (!r.dataReferencia) continue;
      const key = k(r.dataReferencia);
      const e = map.get(key) ?? { mes: key, idf: 0, alertas: 0, rnc: 0 };
      e.rnc++;
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  }, [idf, alertas, rncs]);

  // Índice de Não Conformidade mensal (por SKUs únicos)
  const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const indiceNC = useMemo(() => {
    // por mês: conjuntos de SKUs distintos por status
    const map = new Map<number, { reprovado: Set<string>; aprovado: Set<string>; desvio: Set<string> }>();
    for (const r of idf) {
      if (!r.dataReferencia) continue;
      if (r.dataReferencia.getFullYear() !== 2026) continue;
      const sku = (r.codigoItem || "").trim();
      if (!sku) continue;
      const m = r.dataReferencia.getMonth();
      const e = map.get(m) ?? { reprovado: new Set(), aprovado: new Set(), desvio: new Set() };
      const s = lower(r.status);
      if (s.includes("reprov")) e.reprovado.add(sku);
      else if (s.includes("condicional")) e.desvio.add(sku);
      else if (s.includes("aprovado")) e.aprovado.add(sku);
      map.set(m, e);
    }
    return MESES_PT.map((mes, i) => {
      const e = map.get(i) ?? { reprovado: new Set<string>(), aprovado: new Set<string>(), desvio: new Set<string>() };
      const reprovado = e.reprovado.size;
      const aprovado = e.aprovado.size;
      const desvio = e.desvio.size;
      // Subtotal = SKUs únicos no mês (união) para evitar dupla contagem
      const union = new Set<string>([...e.reprovado, ...e.aprovado, ...e.desvio]);
      const subtotal = union.size;
      const pct = subtotal > 0 ? (reprovado / subtotal) * 100 : 0;
      return { mes, mesCurto: mes.slice(0, 3), reprovado, aprovado, desvio, subtotal, pct: Math.round(pct * 100) / 100 };
    });
  }, [idf]);
  const metaNC = 2.0;

  // Pareto de problemas (não conformidades = reprovados + condicionais)
  const pareto = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of idf) {
      const s = lower(r.status);
      const isNC = s.includes("reprov") || s.includes("condicional");
      if (!isNC) continue;
      const nome = (r.problema || r.tipoProblema || "").trim() || "Não informado";
      map.set(nome, (map.get(nome) ?? 0) + 1);
    }
    const arr = [...map.entries()]
      .map(([problema, qtd]) => ({ problema, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 15);
    const total = arr.reduce((s, x) => s + x.qtd, 0);
    let acc = 0;
    return arr.map((x) => {
      acc += x.qtd;
      const pctAcc = total > 0 ? Math.round((acc / total) * 1000) / 10 : 0;
      const label = x.problema.length > 22 ? x.problema.slice(0, 20) + "…" : x.problema;
      return { ...x, label, pctAcc };
    });
  }, [idf]);
  const paretoTotal = pareto.reduce((s, x) => s + x.qtd, 0);

  // Eficiência mensal: Recebido conta por mês da dataRecebimento (col I);
  // Inspecionado conta por mês da dataFimInsp (col E) — independentes.
  const eficienciaMensal = useMemo(() => {
    const buckets = new Map<number, { rec: number; ins: number }>();
    const bump = (m: number, key: "rec" | "ins") => {
      const b = buckets.get(m) ?? { rec: 0, ins: 0 };
      b[key]++;
      buckets.set(m, b);
    };
    const YEAR = 2026;
    const monthOf = (s: string): number | null => {
      const m = /^\s*\d{1,2}\/(\d{1,2})\/(\d{2,4})/.exec(s ?? "");
      if (!m) return null;
      const mm = parseInt(m[1], 10);
      let yy = parseInt(m[2], 10);
      if (yy < 100) yy += 2000;
      if (yy !== YEAR) return null;
      return mm >= 1 && mm <= 12 ? mm - 1 : null;
    };
    for (const r of idf) {
      const mr = monthOf(r.dataRecebimento);
      if (mr !== null) bump(mr, "rec");
      const mi = monthOf(r.dataFimInsp);
      if (mi !== null) bump(mi, "ins");
    }
    const rows = MESES_PT.map((mes, i) => {
      const b = buckets.get(i) ?? { rec: 0, ins: 0 };
      const efic = b.rec > 0 ? Math.round((b.ins / b.rec) * 100) : 0;
      return { mes, mesCurto: mes.slice(0, 3), recebido: b.rec, inspecionado: b.ins, efic };
    });
    const totRec = rows.reduce((s, r) => s + r.recebido, 0);
    const totIns = rows.reduce((s, r) => s + r.inspecionado, 0);
    const totEfic = totRec > 0 ? Math.round((totIns / totRec) * 100) : 0;
    return { rows, totRec, totIns, totEfic };
  }, [idf]);

  const top5 = ranking.slice(0, 5);
  const bottom5 = [...ranking].reverse().slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="IDF Global" value={`${idfGlobal}%`} hint="Aprovados / Total" tone="success" icon={<TrendingUp className="h-4 w-4" />}
          delta={prev ? <DeltaBadge current={idfGlobal} previous={prev.idfPct} /> : undefined} />
        <PpmCard idf={idf} previous={previous?.idf} />
        <KpiCard label="Inspeções" value={totalInsp} hint="no período" icon={<Activity className="h-4 w-4" />}
          delta={prev ? <DeltaBadge current={totalInsp} previous={prev.total} /> : undefined} />
        <KpiCard label="Aprovados" value={aprov} tone="success" icon={<CheckCircle2 className="h-4 w-4" />}
          delta={prev ? <DeltaBadge current={aprov} previous={prev.aprov} /> : undefined} />
        <KpiCard label="Condicionais" value={cond} tone="warning" icon={<ShieldAlert className="h-4 w-4" />}
          delta={prev ? <DeltaBadge current={cond} previous={prev.cond} invert /> : undefined} />
        <KpiCard label="Reprovados" value={repr} tone="destructive" icon={<AlertTriangle className="h-4 w-4" />}
          delta={prev ? <DeltaBadge current={repr} previous={prev.repr} invert /> : undefined} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <EficienciaInspecaoCard
          recebidos={skusRecebidos}
          inspecionados={skusInspecionados}
          pendentes={skusPendentes}
          previousPct={eficienciaPrev}
          onClick={() => navigate({ to: "/idf" })}
        />
        <KpiCard label="Fornecedores" value={ranking.length} hint="Fornecedores ativos" icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Alertas (AQ)" value={alertas.length} hint="Ocorrências detectadas" tone="warning" icon={<AlertTriangle className="h-4 w-4" />}
          delta={prev ? <DeltaBadge current={alertas.length} previous={prev.alertas} invert /> : undefined} />
        <KpiCard label="AQ Pendentes" value={alertas.filter((a) => !a.finalizado).length} hint="Aguardando tratativa" tone="destructive" icon={<Siren className="h-4 w-4" />}
          delta={prev ? <DeltaBadge current={alertas.filter((a) => !a.finalizado).length} previous={prev.aqPend} invert /> : undefined} />
        <KpiCard label="RNCs" value={rncs.length} hint="Em acompanhamento" tone="info" icon={<FileWarning className="h-4 w-4" />}
          delta={prev ? <DeltaBadge current={rncs.length} previous={prev.rncs} invert /> : undefined} />

      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Distribuição de Status (IDF)" className="lg:col-span-1" printable printTitle="Distribuição de Status (IDF)">
          {statusDistVisible.length === 0 ? <EmptyState /> : <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusDistVisible} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {statusDistVisible.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>}
        </SectionCard>

        <SectionCard title="Inspeções por Divisão" className="lg:col-span-2" printable printTitle="Inspeções por Divisão">
          {porDivisao.length === 0 ? <EmptyState /> : <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porDivisao}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="divisao" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="aprovado" stackId="a" name="Aprovado" fill="var(--color-chart-approved)" />
              <Bar dataKey="condicional" stackId="a" name="Condicional" fill="var(--color-chart-conditional)" />
              <Bar dataKey="reprovado" stackId="a" name="Reprovado" fill="var(--color-chart-rejected)" />
            </BarChart>
          </ResponsiveContainer>}
        </SectionCard>
      </div>

      <SectionCard title="Evolução mensal (Inspeções · Alertas · RNC)" printable printTitle="Evolução mensal — Inspeções · Alertas · RNC">
        {evolucao.length === 0 ? <EmptyState /> : <ResponsiveContainer width="100%" height={280}>
          <LineChart data={evolucao}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
            <YAxis yAxisId="left" stroke="var(--color-muted-foreground)" fontSize={12} />
            <YAxis yAxisId="right" orientation="right" stroke="var(--color-muted-foreground)" fontSize={12} />
            <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line yAxisId="left" type="monotone" dataKey="idf" name="Inspeções" stroke="var(--color-chart-insp)" strokeWidth={2.5} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="alertas" name="Alertas" stroke="var(--color-chart-alert)" strokeWidth={2.5} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="rnc" name="RNC" stroke="var(--color-chart-rejected)" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>}
      </SectionCard>

      <SectionCard
        printable
        className="print-efficiency-card"
        printTitle="Eficiência de Inspeção — Mensal (Recebido x Inspecionado)"
        title={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span>Eficiência de Inspeção — Mensal</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-success/15 text-success border border-success/30">
              <TrendingUp className="h-3.5 w-3.5" />
              Total: {eficienciaMensal.totEfic}%
            </span>
          </span>
        }
      >
        <ResponsiveContainer width="100%" height={300} className="print-efficiency-chart">
          <ComposedChart data={eficienciaMensal.rows} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis dataKey="mesCurto" stroke="var(--color-muted-foreground)" fontSize={12} />
            <YAxis yAxisId="left" stroke="var(--color-muted-foreground)" fontSize={12} />
            <YAxis yAxisId="right" orientation="right" stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${v}%`} domain={[0, (dataMax: number) => Math.max(120, Math.ceil((dataMax + 20) / 50) * 50)]} allowDataOverflow={false} />
            <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="recebido" name="Recebido" fill="var(--color-chart-insp)" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="left" dataKey="inspecionado" name="Inspecionado" fill="var(--color-chart-approved)" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="efic" name="Eficiência %" stroke="var(--color-warning)" strokeWidth={2.5} dot={{ r: 4 }} />
            <ReferenceLine yAxisId="right" y={95} stroke="var(--color-success)" strokeDasharray="6 4" label={{ value: "Meta 95%", position: "right", fill: "var(--color-success)", fontSize: 11, fontWeight: 700 }} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="mt-4 overflow-x-auto print-efficiency-table">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-2"></th>
                {eficienciaMensal.rows.map((m) => <th key={m.mes} className="py-2 px-2 text-right font-semibold">{m.mes}</th>)}
                <th className="py-2 px-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="border-b">
                <td className="py-1 pr-2 font-semibold italic">Recebido</td>
                {eficienciaMensal.rows.map((m) => <td key={m.mes} className="py-1 px-2 text-right">{m.recebido.toLocaleString("pt-BR")}</td>)}
                <td className="py-1 px-2 text-right font-semibold">{eficienciaMensal.totRec.toLocaleString("pt-BR")}</td>
              </tr>
              <tr className="border-b">
                <td className="py-1 pr-2 font-semibold italic">Inspecionado</td>
                {eficienciaMensal.rows.map((m) => <td key={m.mes} className="py-1 px-2 text-right">{m.inspecionado.toLocaleString("pt-BR")}</td>)}
                <td className="py-1 px-2 text-right font-semibold">{eficienciaMensal.totIns.toLocaleString("pt-BR")}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2 font-semibold italic">Efic.</td>
                {eficienciaMensal.rows.map((m) => (
                  <td key={m.mes} className={`py-1 px-2 text-right font-semibold ${m.recebido === 0 ? "text-muted-foreground" : m.efic >= 95 ? "text-success" : m.efic >= 85 ? "text-warning" : "text-destructive"}`}>
                    {m.recebido > 0 ? `${m.efic}%` : "—"}
                  </td>
                ))}
                <td className={`py-1 px-2 text-right font-semibold ${eficienciaMensal.totEfic >= 95 ? "text-success" : eficienciaMensal.totEfic >= 85 ? "text-warning" : "text-destructive"}`}>{eficienciaMensal.totEfic}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>



      <SectionCard
        printable
        printTitle="Índice de Não Conformidade (mensal · por SKUs únicos)"
        title={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span>Índice de Não Conformidade (mensal · por SKUs únicos)</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-info/15 text-info border border-info/30">
              <TrendingUp className="h-3.5 w-3.5" />
              Meta: {metaNC.toFixed(1).replace(".0", "")}%
            </span>
          </span>
        }
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <span className="inline-block w-3 h-0.5 bg-info rounded-full" />
          <span>Linha azul = meta de não conformidade ({metaNC.toFixed(1).replace(".0", "")}%)</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={indiceNC} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis dataKey="mesCurto" stroke="var(--color-muted-foreground)" fontSize={12} />
            <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => `${v.toFixed(2)}%`}
            />
            <ReferenceLine
              y={metaNC}
              stroke="var(--color-info)"
              strokeWidth={3}
              strokeDasharray="6 4"
              label={{
                value: `META ${metaNC.toFixed(1).replace(".0", "")}%`,
                position: "right",
                fill: "var(--color-info)",
                fontSize: 12,
                fontWeight: 700,
                offset: 10,
              }}
            />
            <Bar dataKey="pct" name="Índice NC" fill="var(--color-chart-rejected)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-2"></th>
                {indiceNC.map((m) => <th key={m.mes} className="py-2 px-2 text-right font-semibold">{m.mes}</th>)}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="border-b">
                <td className="py-1 pr-2 font-semibold italic">Reprovado</td>
                {indiceNC.map((m) => <td key={m.mes} className="py-1 px-2 text-right">{m.reprovado.toLocaleString("pt-BR")}</td>)}
              </tr>
              <tr className="border-b">
                <td className="py-1 pr-2 font-semibold italic">Aprovado</td>
                {indiceNC.map((m) => <td key={m.mes} className="py-1 px-2 text-right">{m.aprovado.toLocaleString("pt-BR")}</td>)}
              </tr>
              <tr className="border-b">
                <td className="py-1 pr-2 font-semibold italic">Desvio</td>
                {indiceNC.map((m) => <td key={m.mes} className="py-1 px-2 text-right">{m.desvio.toLocaleString("pt-BR")}</td>)}
              </tr>
              <tr className="border-b">
                <td className="py-1 pr-2 font-semibold italic">Subtotal</td>
                {indiceNC.map((m) => <td key={m.mes} className="py-1 px-2 text-right font-semibold">{m.subtotal.toLocaleString("pt-BR")}</td>)}
              </tr>
              <tr>
                <td className="py-1 pr-2 font-semibold italic">Índice NC</td>
                {indiceNC.map((m) => <td key={m.mes} className={`py-1 px-2 text-right font-semibold ${m.pct > metaNC ? "text-destructive" : "text-success"}`}>{m.subtotal > 0 ? `${m.pct.toFixed(2)}%` : "—"}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        printable
        printTitle="Pareto de Problemas (Não Conformidades)"
        title={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span>Pareto de Problemas (Não Conformidades)</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
              <AlertTriangle className="h-3.5 w-3.5" />
              Total NC: {paretoTotal}
            </span>
          </span>
        }
      >
        {pareto.length === 0 ? <EmptyState /> : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={pareto} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} angle={-35} textAnchor="end" interval={0} height={70} />
                <YAxis yAxisId="left" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, name: string) => name === "% Acumulado" ? `${v.toFixed(1)}%` : v}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.problema ?? ""}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="qtd" name="Ocorrências" fill="var(--color-chart-rejected)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="pctAcc" name="% Acumulado" stroke="var(--color-warning)" strokeWidth={2.5} dot={{ r: 3 }} />
                <ReferenceLine yAxisId="right" y={80} stroke="var(--color-info)" strokeDasharray="6 4" label={{ value: "80%", position: "right", fill: "var(--color-info)", fontSize: 11, fontWeight: 700 }} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Problema</th>
                    <th className="py-2 px-2 text-right">Ocorrências</th>
                    <th className="py-2 px-2 text-right">% Acumulado</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {pareto.map((p, i) => (
                    <tr key={p.problema} className="border-b last:border-0">
                      <td className="py-1 pr-2">{i + 1}</td>
                      <td className="py-1 pr-2">{p.problema}</td>
                      <td className="py-1 px-2 text-right font-semibold">{p.qtd}</td>
                      <td className={`py-1 px-2 text-right font-semibold ${p.pctAcc <= 80 ? "text-destructive" : "text-muted-foreground"}`}>{p.pctAcc.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          printable
          printTitle="Top 5 Melhores Fornecedores"
          title={
            <span className="inline-flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              <Award className="h-4 w-4 text-emerald-400" />
              Top 5 Melhores Fornecedores
            </span>
          }
        >
          <RankingTable rows={top5} />
        </SectionCard>
        <SectionCard
          printable
          printTitle="Top 5 Piores Fornecedores"
          title={
            <span className="inline-flex items-center gap-2">
              <Siren className="h-4 w-4 text-red-400" />
              <ShieldAlert className="h-4 w-4 text-orange-400" />
              Top 5 Piores Fornecedores
            </span>
          }
        >
          <RankingTable rows={bottom5} />
        </SectionCard>
      </div>
    </div>
  );
}

function RankingTable({
  rows,
}: {
  rows: Array<{ f: string; total: number; ap: number; co: number; re: number; al: number; rn: number; pct: number; cls: "A" | "B" | "C" | "D"; status: "verde" | "azul" | "amarelo" | "vermelho" }>;
}) {
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Fornecedor</th>
            <th className="py-2 pr-2 text-right">IDF%</th>
            <th className="py-2 pr-2 text-center">Classif.</th>
            <th className="py-2 pr-2 text-right">Insp.</th>
            <th className="py-2 pr-2 text-right">AQ</th>
            <th className="py-2 pr-2 text-right">RNC</th>
            <th className="py-2 pr-2 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.f} className="border-b last:border-0 hover:bg-muted/40">
              <td className="py-2 pr-2 tabular-nums">{i + 1}</td>
              <td className="py-2 pr-2 font-medium">{r.f}</td>
              <td className="py-2 pr-2 text-right tabular-nums font-semibold">{r.pct}%</td>
              <td className="py-2 pr-2 text-center"><ClassBadge c={r.cls} /></td>
              <td className="py-2 pr-2 text-right tabular-nums">{r.total}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{r.al}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{r.rn}</td>
              <td className="py-2 pr-2 text-center"><StatusDot status={r.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
