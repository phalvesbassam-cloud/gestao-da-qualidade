import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  Activity,
  Award,
  Check,
  CheckCircle2,
  Target,
  X,
  TrendingUp,
  Users,
  XCircle,
  AlertTriangle,
  Sparkles,
  Trophy,
  Medal,
} from "lucide-react";
import { KpiCard, SectionCard, EmptyState } from "@/components/dashboard-ui";
import { useDashboardFiltered } from "@/hooks/use-data";
import type { IDFRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inspecao")({
  head: () => ({
    meta: [
      { title: "Gestão de Inspeção — Visão Executiva" },
      { name: "description", content: "Monitoramento operacional e desempenho da equipe de inspeção." },
    ],
  }),
  component: InspecaoPage,
});

// ---- inspetores válidos ----
const INSPETORES_VALIDOS = [
  "Jacklane Freire",
  "Ademar Ribas",
  "Edson Pereira Nunes Lopes",
  "Leonardo Ap. Wohlers",
  "Douglas Lopes",
  "Estefany",
  "SKIP",
] as const;

const META_PCT = 17; // meta individual mensal em %

function normalizeStr(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Resolve o nome do inspetor para a forma canônica ou retorna null se inválido. */
function resolveInspetor(raw: string): string | null {
  const v = (raw || "").trim();
  if (!v) return null;
  const n = normalizeStr(v);
  if (n === "master") return "SKIP";
  if (n === "skip") return "SKIP";
  for (const nome of INSPETORES_VALIDOS) {
    if (nome === "SKIP") continue;
    const nn = normalizeStr(nome);
    if (n === nn) return nome;
    // tolerância: primeiro nome + último nome
    const partsRaw = n.split(/\s+/);
    const partsRef = nn.split(/\s+/);
    if (
      partsRaw[0] === partsRef[0] &&
      partsRaw[partsRaw.length - 1] === partsRef[partsRef.length - 1]
    ) {
      return nome;
    }
  }
  return null;
}

type InspetorAgg = {
  nome: string;
  total: number;
  aprovados: number;
  reprovados: number;
  condicionais: number;
  eficienciaPct: number; // participação % do volume total
  diffPP: number;        // diferença em pontos percentuais vs META_PCT
};

function statusTag(s: string): "aprovado" | "reprovado" | "condicional" | "outro" {
  const x = (s || "").toLowerCase();
  if (x.includes("condicional")) return "condicional";
  if (x.includes("reprov")) return "reprovado";
  if (x.includes("aprovado")) return "aprovado";
  return "outro";
}

function aggregateInspetores(rows: IDFRow[], totalGeral: number): InspetorAgg[] {
  const map = new Map<string, { total: number; ap: number; rep: number; cond: number }>();
  for (const r of rows) {
    const nome = resolveInspetor(r.inspetorFinal || "");
    if (!nome) continue;
    const agg = map.get(nome) ?? { total: 0, ap: 0, rep: 0, cond: 0 };
    agg.total++;
    const tag = statusTag(r.status);
    if (tag === "aprovado") agg.ap++;
    else if (tag === "reprovado") agg.rep++;
    else if (tag === "condicional") agg.cond++;
    map.set(nome, agg);
  }
  const out: InspetorAgg[] = [];
  for (const [nome, a] of map) {
    const efic = totalGeral ? (a.total / totalGeral) * 100 : 0;
    out.push({
      nome,
      total: a.total,
      aprovados: a.ap,
      reprovados: a.rep,
      condicionais: a.cond,
      eficienciaPct: Math.round(efic * 10) / 10,
      diffPP: Math.round((efic - META_PCT) * 10) / 10,
    });
  }
  out.sort((x, y) => y.total - x.total);
  return out;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function toneFor(pct: number): "success" | "warning" | "destructive" {
  if (pct >= META_PCT) return "success";
  if (pct >= META_PCT - 3) return "warning";
  return "destructive";
}

// paleta corporativa fixa por inspetor (mesma cor em todos os gráficos/legendas)
const COLOR_INSPETOR: Record<string, string> = {
  "Estefany": "#22c55e",                    // verde
  "Edson Pereira Nunes Lopes": "#38BDF8",   // azul claro
  "Leonardo Ap. Wohlers": "#A78BFA",        // roxo
  "Jacklane Freire": "#FACC15",             // amarelo
  "Douglas Lopes": "#22D3EE",               // ciano
  "Ademar Ribas": "#FB923C",                // laranja
  "SKIP": "#475569",                        // cinza escuro
};
const colorFor = (nome: string) => COLOR_INSPETOR[nome] ?? "#64748b";

function InspecaoPage() {
  const { filtered } = useDashboardFiltered();

  const allRows = useMemo(
    () => filtered.idf.filter((r) => resolveInspetor(r.inspetorFinal || "") !== null),
    [filtered.idf],
  );

  // ---- seleção interativa de inspetores ----
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (nome: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  };
  const clearSelected = () => setSelected(new Set());

  // rows filtradas pela seleção (vazio = todos)
  const rows = useMemo(() => {
    if (selected.size === 0) return allRows;
    return allRows.filter((r) => {
      const nome = resolveInspetor(r.inspetorFinal || "");
      return nome != null && selected.has(nome);
    });
  }, [allRows, selected]);

  const totalGeral = allRows.length;
  const inspetoresAll = useMemo(() => aggregateInspetores(allRows, totalGeral), [allRows, totalGeral]);

  const totalInsp = rows.length;
  const inspetores = useMemo(
    () => aggregateInspetores(rows, selected.size === 0 ? totalInsp : totalGeral),
    [rows, totalInsp, totalGeral, selected.size],
  );

  const totalReprovados = rows.filter((r) => statusTag(r.status) === "reprovado").length;
  const totalAprovados = rows.filter((r) => statusTag(r.status) === "aprovado").length;
  const taxaApr = totalInsp ? (totalAprovados / totalInsp) * 100 : 0;
  const taxaRep = totalInsp ? (totalReprovados / totalInsp) * 100 : 0;

  const pendentes = useMemo(
    () => rows.filter((r) => !r.dataFimInsp || !r.status).length,
    [rows],
  );

  const totalAvaliados = inspetoresAll.filter((i) => i.nome !== "SKIP").length;
  const acimaMeta = inspetoresAll.filter((i) => i.nome !== "SKIP" && i.eficienciaPct >= META_PCT).length;
  const eficienciaEquipe = inspetores.length
    ? Math.round((inspetores.reduce((s, i) => s + i.eficienciaPct, 0) / inspetores.length) * 10) / 10
    : 0;

  const inspetoresAllNoSkip = inspetoresAll.filter((i) => i.nome !== "SKIP");
  const melhor = inspetoresAllNoSkip[0];
  const pior = inspetoresAllNoSkip.length > 1 ? inspetoresAllNoSkip[inspetoresAllNoSkip.length - 1] : undefined;

  const barEficiencia = useMemo(
    () => inspetores.map((i) => ({ nome: i.nome.split(" ")[0], nomeFull: i.nome, eficiencia: i.eficienciaPct, meta: META_PCT })),
    [inspetores],
  );
  const barInspecoes = useMemo(
    () => inspetores.map((i) => ({ nome: i.nome.split(" ")[0], nomeFull: i.nome, total: i.total })),
    [inspetores],
  );
  const aprXRep = useMemo(
    () => inspetores.map((i) => ({ nome: i.nome.split(" ")[0], nomeFull: i.nome, aprovados: i.aprovados, reprovados: i.reprovados })),
    [inspetores],
  );

  const evolucaoMensal = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (!r.dataReferencia) continue;
      const d = r.dataReferencia;
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, total]) => ({ mes, total }));
  }, [rows]);

  const donut = useMemo(
    () => inspetores.map((i) => ({ nome: i.nome.split(" ")[0], nomeFull: i.nome, value: i.total })),
    [inspetores],
  );

  const insights = useMemo(() => {
    const out: string[] = [];
    if (melhor && totalGeral) {
      out.push(`${melhor.nome} realizou ${melhor.eficienciaPct.toFixed(1)}% das inspeções (${melhor.total}).`);
    }
    out.push(`${acimaMeta} de ${totalAvaliados} inspetores ${acimaMeta === 1 ? "atingiu" : "atingiram"} a meta de ${META_PCT}%.`);
    if (pendentes > 0) out.push(`${pendentes} inspeç${pendentes > 1 ? "ões" : "ão"} aguardando finalização.`);
    if (taxaApr >= 90) out.push(`Taxa de aprovação saudável: ${taxaApr.toFixed(1)}%.`);
    else if (taxaRep >= 10) out.push(`Atenção: taxa de reprovação em ${taxaRep.toFixed(1)}%.`);
    if (pior && pior.eficienciaPct < META_PCT) {
      out.push(`${pior.nome} abaixo da meta: ${pior.eficienciaPct.toFixed(1)}% (${pior.diffPP.toFixed(1)} p.p.).`);
    }
    return out.slice(0, 6);
  }, [melhor, pior, totalGeral, acimaMeta, totalAvaliados, pendentes, taxaApr, taxaRep]);

  const metaStatus =
    acimaMeta >= Math.ceil(totalAvaliados / 2)
      ? { tone: "success" as const, label: "🟢 Acima" }
      : acimaMeta > 0
        ? { tone: "warning" as const, label: "🟡 Atenção" }
        : { tone: "destructive" as const, label: "🔴 Abaixo" };

  if (allRows.length === 0) return <EmptyState label="Sem dados de inspeção no período" />;


  return (
    <div className="space-y-5">
      {/* Filtros ativos */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2 card-premium">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Filtros ativos:</span>
          {[...selected].map((nome) => (
            <button
              key={nome}
              type="button"
              onClick={() => toggle(nome)}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
              style={{ borderColor: colorFor(nome), boxShadow: `inset 0 0 0 1px ${colorFor(nome)}33` }}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorFor(nome) }} />
              {nome === "SKIP" ? "SKIP" : nome.split(" ")[0]}
              <X className="h-3 w-3 opacity-70" />
            </button>
          ))}
          <button
            type="button"
            onClick={clearSelected}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Limpar filtros
          </button>
        </div>
      )}

      {/* KPIs principais */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">

        <KpiCard
          label="Inspeções realizadas"
          value={totalInsp.toLocaleString("pt-BR")}
          hint={`${inspetores.length} inspetores ativos`}
          tone="info"
          icon={<Activity className="h-4 w-4" />}
        />
        <KpiCard
          label="Atingiram meta"
          value={`${acimaMeta}/${inspetores.length}`}
          hint={`Meta individual: ${META_PCT}%`}
          tone={metaStatus.tone}
          icon={<Target className="h-4 w-4" />}
        />
        <KpiCard
          label="Pendências"
          value={pendentes.toLocaleString("pt-BR")}
          hint="Aguardando finalização"
          tone={pendentes > 0 ? "warning" : "success"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <KpiCard
          label="Taxa de aprovação"
          value={`${taxaApr.toFixed(1)}%`}
          hint={`${totalAprovados.toLocaleString("pt-BR")} aprovados`}
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <KpiCard
          label="Taxa de reprovação"
          value={`${taxaRep.toFixed(1)}%`}
          hint={`${totalReprovados.toLocaleString("pt-BR")} reprovados`}
          tone="destructive"
          icon={<XCircle className="h-4 w-4" />}
        />
      </div>

      {/* Destaques + meta */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
        <div className="card-premium rounded-xl border bg-card p-4">
          <div className="text-[12px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Trophy className="h-4 w-4 text-emerald-400" /> Melhor inspetor
          </div>
          <div className="mt-2 text-2xl font-display font-bold text-emerald-400 truncate">{melhor?.nome ?? "—"}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {melhor ? `${melhor.total} inspeções · ${melhor.eficienciaPct.toFixed(1)}% (${melhor.diffPP >= 0 ? "+" : ""}${melhor.diffPP.toFixed(1)} p.p.)` : "—"}
          </div>
        </div>
        <div className="card-premium rounded-xl border bg-card p-4">
          <div className="text-[12px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" /> Menor desempenho
          </div>
          <div className="mt-2 text-2xl font-display font-bold text-red-400 truncate">{pior?.nome ?? "—"}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {pior ? `${pior.total} inspeções · ${pior.eficienciaPct.toFixed(1)}% (${pior.diffPP >= 0 ? "+" : ""}${pior.diffPP.toFixed(1)} p.p.)` : "—"}
          </div>
        </div>
        <div className="card-premium rounded-xl border bg-card p-4">
          <div className="text-[12px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Target className="h-4 w-4" /> Meta da equipe
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <div className="text-3xl font-display font-bold tabular-nums">{eficienciaEquipe.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">média / {META_PCT}%</div>
          </div>
          <div className="mt-2 text-sm font-semibold">{metaStatus.label}</div>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <SectionCard
          title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-sky-400" /> Insights automáticos</span>}
          printable
          printTitle="Insights automáticos — Gestão de Inspeção"
        >
          <ul className="grid gap-2 md:grid-cols-2">
            {insights.map((s, i) => (
              <li key={i} className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-foreground">
                {s}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Ranking individual */}
      <SectionCard
        title={<span className="flex items-center gap-2"><Users className="h-4 w-4" /> Ranking de inspetores</span>}
        printable
        printTitle="Ranking de inspetores"
      >
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {inspetoresAll.map((i, idx) => {
            const isSkip = i.nome === "SKIP";
            const tone = toneFor(i.eficienciaPct);
            const dot = tone === "success" ? "🟢" : tone === "warning" ? "🟡" : "🔴";
            const efClass =
              tone === "success" ? "text-emerald-400"
              : tone === "warning" ? "text-amber-400"
              : "text-red-400";
            const isSelected = selected.has(i.nome);
            const color = colorFor(i.nome);
            return (
              <button
                key={i.nome}
                type="button"
                onClick={() => toggle(i.nome)}
                aria-pressed={isSelected}
                title={isSelected ? "Clique para remover da seleção" : "Clique para filtrar por este inspetor"}
                className={cn(
                  "card-premium rounded-xl border bg-card p-4 flex flex-col gap-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer",
                  isSelected && "ring-2 ring-offset-2 ring-offset-background scale-[1.01] shadow-lg",
                )}
                style={isSelected ? { borderColor: color, boxShadow: `0 0 0 1px ${color}, 0 10px 30px -12px ${color}55` } : undefined}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="relative h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm text-foreground shrink-0"
                    style={{ background: `${color}22`, border: `1px solid ${color}55` }}
                  >
                    {isSkip ? "—" : initials(i.nome)}
                    {!isSkip && idx < 3 && (
                      <span className="absolute -top-1 -right-1">
                        {idx === 0 && <Trophy className="h-4 w-4 text-amber-400" />}
                        {idx === 1 && <Medal className="h-4 w-4 text-slate-300" />}
                        {idx === 2 && <Award className="h-4 w-4 text-amber-700" />}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate text-foreground">{i.nome}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {isSkip ? "Categoria operacional" : `#${idx + 1} · ${i.total} inspeções`}
                    </div>
                  </div>
                  {isSelected ? (
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white shrink-0"
                      style={{ background: color }}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    !isSkip && (
                      <span className="text-lg" title={`${i.eficienciaPct}% vs meta ${META_PCT}%`}>{dot}</span>
                    )
                  )}
                </div>

                {isSkip ? (
                  <div className="mt-1 flex items-baseline gap-2">
                    <div className="text-2xl font-display font-bold tabular-nums text-foreground">
                      {i.total.toLocaleString("pt-BR")}
                    </div>
                    <div className="text-xs text-muted-foreground">inspeções</div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center mt-1">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Efic.</div>
                        <div className={cn("text-sm font-bold tabular-nums", efClass)}>{i.eficienciaPct.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">vs Meta</div>
                        <div className={cn("text-sm font-bold tabular-nums", efClass)}>
                          {i.diffPP >= 0 ? "+" : ""}{i.diffPP.toFixed(1)} p.p.
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Reprov.</div>
                        <div className="text-sm font-bold text-red-400 tabular-nums">{i.reprovados}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground text-center">Meta: {META_PCT}%</div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </SectionCard>


      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title={`Eficiência por inspetor (meta ${META_PCT}%)`}
          printable
          printTitle={`Eficiência por inspetor (meta ${META_PCT}%)`}
        >
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={barEficiencia} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" stroke="rgba(255,255,255,0.5)" fontSize={11} />
                <YAxis type="category" dataKey="nome" stroke="rgba(255,255,255,0.6)" fontSize={11} width={80} />
                <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #1e293b" }} />
                <Bar dataKey="eficiencia" radius={[0, 6, 6, 0]}>
                  {barEficiencia.map((d, i) => {
                    const t = toneFor(d.eficiencia);
                    const fill = t === "success" ? "#34d399" : t === "warning" ? "#fbbf24" : "#fb7185";
                    return <Cell key={i} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Inspeções por inspetor" printable printTitle="Inspeções por inspetor">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={barInspecoes}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="nome" stroke="rgba(255,255,255,0.5)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.5)" fontSize={11} />
                <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #1e293b" }} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                  {barInspecoes.map((d, i) => (
                    <Cell key={i} fill={colorFor(d.nomeFull)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>


        <SectionCard title="Aprovações x Reprovações por inspetor" printable printTitle="Aprovações x Reprovações por inspetor">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={aprXRep}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="nome" stroke="rgba(255,255,255,0.5)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.5)" fontSize={11} />
                <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #1e293b" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="aprovados" fill="#34d399" radius={[6, 6, 0, 0]} />
                <Bar dataKey="reprovados" fill="#fb7185" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Evolução mensal das inspeções" printable printTitle="Evolução mensal das inspeções">
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={evolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="mes" stroke="rgba(255,255,255,0.5)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.5)" fontSize={11} />
                <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #1e293b" }} />
                <Line type="monotone" dataKey="total" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Ranking de participação por inspetor"
          className="lg:col-span-2"
          printable
          printTitle="Ranking de participação por inspetor"
        >
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="nome" innerRadius={55} outerRadius={95} paddingAngle={2} isAnimationActive={false}>
                  {donut.map((d, i) => (
                    <Cell key={i} fill={colorFor(d.nomeFull)} stroke="rgba(15,23,42,0.6)" strokeWidth={1} />
                  ))}

                </Pie>
                <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #1e293b" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
