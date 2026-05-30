import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiCard, PpmCard, SectionCard, ClassBadge, StatusDot, DeltaBadge, EmptyState } from "@/components/dashboard-ui";
import { IdfHelpButton } from "@/components/idf-help";
import { useDashboardFiltered } from "@/hooks/use-data";
import { ReincBadge } from "@/components/recorrencia-modal";
import { NotaEditButton } from "@/components/nota-edit-modal";
import { scoreFornecedores, classificacaoFromIdf } from "@/lib/idf-calc";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/idf")({
  head: () => ({
    meta: [
      { title: "IDF — Inspeções de Recebimento" },
      { name: "description", content: "Inspeções, Nota NC, IDF% e classificação por fornecedor." },
    ],
  }),
  component: IdfPage,
});

function IdfPage() {
  const { filtered, previous, compare } = useDashboardFiltered();
  const rows = filtered.idf;
  const score = useMemo(() => scoreFornecedores(rows, filtered.alerta, filtered.rnc), [rows, filtered.alerta, filtered.rnc]);

  const totalNC = rows.reduce((s, r) => s + r.notaNC, 0);
  const idfMedio =
    score.length > 0 ? Math.round((score.reduce((s, r) => s + r.idfPct, 0) / score.length) * 10) / 10 : 0;

  const top10 = score.slice(0, 10).map((s) => ({ name: s.fornecedor, idf: s.idfPct, status: s.status }));

  const prev = useMemo(() => {
    if (!compare || !previous) return null;
    const pScore = scoreFornecedores(previous.idf, previous.alerta, previous.rnc);
    const pNC = previous.idf.reduce((s, r) => s + r.notaNC, 0);
    const pIdfMed = pScore.length > 0 ? Math.round((pScore.reduce((s, r) => s + r.idfPct, 0) / pScore.length) * 10) / 10 : 0;
    return { insp: previous.idf.length, idfMed: pIdfMed, nc: pNC, forn: pScore.length };
  }, [compare, previous]);

  function downloadCsv() {
    const headers = [
      "Processo","Divisão","Código item","Quantidade","Data Recebimento","Status","Tipo Problema",
      "Problema","Descrição item","Fornecedor","Criticidade","Nota NC",
    ];
    const lines = [headers.join(";")];
    for (const r of rows) {
      lines.push([
        r.processo, r.divisao, r.codigoItem, r.quantidade, r.dataRecebimento, r.status, r.tipoProblema,
        r.problema, r.descricaoItem, r.fornecedor, r.criticidade, r.notaNC,
      ].map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(";"));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `IDF-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const totalRecorrencias = rows.reduce((s, r) => s + (r.irPoints > 0 ? 1 : 0), 0);
  const irMedio = score.length > 0 ? Math.round((score.reduce((s, r) => s + r.irPct, 0) / score.length) * 10) / 10 : 0;
  const maiorIR = score.reduce((m, s) => s.ir > m.ir ? s : m, { ir: 0, fornecedor: "—" } as any);
  const irGeral = score.reduce((s, r) => s + r.ir, 0);
  const topReinc = [...score].filter(s => s.ir > 0).sort((a, b) => b.ir - a.ir).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-stretch">
        <KpiCard label="Inspeções" value={rows.length}
          delta={prev ? <DeltaBadge current={rows.length} previous={prev.insp} /> : undefined} />
        <KpiCard label="IDF Médio" value={`${idfMedio}%`} tone="success"
          delta={prev ? <DeltaBadge current={idfMedio} previous={prev.idfMed} /> : undefined} />
        <PpmCard idf={rows} previous={previous?.idf} />
        <KpiCard label="Pontos NC" value={totalNC.toFixed(0)} tone="warning" hint="Σ por reprovadas"
          delta={prev ? <DeltaBadge current={totalNC} previous={prev.nc} invert /> : undefined} />
        <KpiCard label="Fornecedores" value={score.length}
          delta={prev ? <DeltaBadge current={score.length} previous={prev.forn} /> : undefined} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-stretch">
        <KpiCard label="Índice IR Geral" value={irGeral} tone="warning" hint="Σ pontos IR" />
        <KpiCard label="IR Médio" value={`${irMedio}%`} tone="success" hint="média % IR fornecedores" />
        <KpiCard label="Total de Recorrências" value={totalRecorrencias} tone="warning" />
        <KpiCard label="Maior IR" value={maiorIR.ir} tone="warning" hint={maiorIR.fornecedor} />
        <KpiCard label="Mais Reincidente" value={topReinc[0]?.fornecedor || "—"} hint={topReinc[0] ? `IR ${topReinc[0].ir}` : "sem recorrências"} />
      </div>



      <SectionCard
        title="Ranking IDF — Top 10 Fornecedores"
        action={
          <div className="flex gap-2">
            <IdfHelpButton />
            <Button size="sm" variant="outline" onClick={downloadCsv}>
              <Download className="h-3 w-3 mr-1" /> CSV
            </Button>
          </div>
        }
      >
        {top10.length === 0 ? <EmptyState /> : <ResponsiveContainer width="100%" height={320}>
          <BarChart data={top10} layout="vertical" margin={{ left: 90 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} stroke="var(--color-muted-foreground)" fontSize={12} />
            <YAxis dataKey="name" type="category" stroke="var(--color-muted-foreground)" fontSize={11} width={120} />
            <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="idf" name="IDF %" radius={[0, 6, 6, 0]}>
              {top10.map((e, i) => (
                <Cell
                  key={i}
                  fill={
                    e.status === "verde" ? "var(--color-chart-approved)" :
                    e.status === "azul" ? "var(--color-chart-rnc)" :
                    e.status === "amarelo" ? "var(--color-chart-conditional)" :
                    "var(--color-chart-rejected)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>}
      </SectionCard>

      <SectionCard title="Classificação por Fornecedor">
        {score.length === 0 ? <EmptyState /> : <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Fornecedor</th>
                <th className="py-2 pr-2 text-right">Inspeções</th>
                <th className="py-2 pr-2 text-right">Aprov.</th>
                <th className="py-2 pr-2 text-right">Cond.</th>
                <th className="py-2 pr-2 text-right">Reprov.</th>
                <th className="py-2 pr-2 text-right">AQ</th>
                <th className="py-2 pr-2 text-right">RNC</th>
                <th className="py-2 pr-2 text-right">Pontos NC</th>
                <th className="py-2 pr-2 text-right">IR</th>
                <th className="py-2 pr-2 text-right">IR %</th>
                <th className="py-2 pr-2 text-right">IDF %</th>
                <th className="py-2 pr-2">Avaliação</th>
                <th className="py-2 pr-2 text-center">Classif.</th>
                <th className="py-2 pr-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {score.map((s, i) => (
                <tr key={s.fornecedor} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2 pr-2 tabular-nums">{i + 1}</td>
                  <td className="py-2 pr-2 font-medium">{s.fornecedor}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{s.totalInsp}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-success">{s.aprovados}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-warning">{s.condicionais}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-destructive">{s.reprovados}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{s.alertas}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{s.rncs}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{s.pontosNC.toFixed(0)}</td>
                  <td className={`py-2 pr-2 text-right tabular-nums ${s.ir > 0 ? "text-destructive font-semibold" : ""}`}>{s.ir}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{s.irPct}%</td>
                  <td className="py-2 pr-2 text-right tabular-nums font-semibold">{s.idfPct}%</td>
                  <td className="py-2 pr-2 text-xs">{classificacaoFromIdf(s.idfPct).label}</td>
                  <td className="py-2 pr-2 text-center"><ClassBadge c={s.classificacao} /></td>
                  <td className="py-2 pr-2 text-center"><StatusDot status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      </SectionCard>

      <SectionCard title={`Inspeções recentes (${rows.length})`}>
        {rows.length === 0 ? <EmptyState /> : <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-2 pr-2">Data</th>
                <th className="py-2 pr-2">Processo</th>
                <th className="py-2 pr-2">Divisão</th>
                <th className="py-2 pr-2">Item</th>
                <th className="py-2 pr-2">Descrição</th>
                <th className="py-2 pr-2">Fornecedor</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Problema</th>
                <th className="py-2 pr-2 text-center">Reincid.</th>
                <th className="py-2 pr-2 text-right">Nota Auto</th>
                <th className="py-2 pr-2 text-right">Nota Final</th>
                <th className="py-2 pr-2 text-center w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map((r, i) => (
                <tr key={`${r.processo}__${r.codigoItem}__${r.lote ?? ""}__${i}`} className={`border-b last:border-0 hover:bg-muted/40 ${r.recorrencia ? "bg-destructive/5" : ""}`}>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{r.dataRecebimento}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{r.processo}</td>
                  <td className="py-1.5 pr-2">{r.divisao}</td>
                  <td className="py-1.5 pr-2">{r.codigoItem}</td>
                  <td className="py-1.5 pr-2 max-w-[220px] truncate">{r.descricaoItem}</td>
                  <td className="py-1.5 pr-2 font-medium">{r.fornecedor}</td>
                  <td className="py-1.5 pr-2"><StatusBadge s={r.status} /></td>
                  <td className="py-1.5 pr-2 max-w-[180px] truncate text-muted-foreground">{r.problema || "—"}</td>
                  <td className="py-1.5 pr-2 text-center"><ReincBadge row={r} /></td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">{r.notaNCAuto.toFixed(1)}</td>
                  <td className={`py-1.5 pr-2 text-right tabular-nums ${r.notaOverride ? "text-primary font-semibold" : ""}`} title={r.notaOverride ? `Manual: ${r.overrideAutor} — ${r.overrideMotivo}` : undefined}>
                    {r.notaNC.toFixed(1)}{r.notaOverride ? " ✎" : ""}
                  </td>
                  <td className="py-1.5 pr-2 text-center"><NotaEditButton row={r} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 300 && (
            <div className="text-xs text-muted-foreground pt-2">Mostrando 300 de {rows.length}. Use os filtros para refinar.</div>
          )}
        </div>}
      </SectionCard>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const l = s.toLowerCase();
  if (l.includes("aprovação condicional") || l.includes("aprovacao condicional"))
    return <Badge className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/15">Condicional</Badge>;
  if (l.includes("reprov"))
    return <Badge className="bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/15">Reprovado</Badge>;
  if (l.includes("aprovado"))
    return <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/15">Aprovado</Badge>;
  return <Badge variant="secondary">{s || "—"}</Badge>;
}

