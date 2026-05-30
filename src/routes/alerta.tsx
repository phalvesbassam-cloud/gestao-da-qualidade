import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { KpiCard, PpmCard, SectionCard, DeltaBadge, EmptyState } from "@/components/dashboard-ui";
import { Badge } from "@/components/ui/badge";
import { useDashboardFiltered } from "@/hooks/use-data";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/alerta")({
  head: () => ({
    meta: [
      { title: "Alertas — Qualidade" },
      { name: "description", content: "Alertas de qualidade (AQ) por fornecedor, status e período." },
    ],
  }),
  component: AlertaPage,
});

function AlertaPage() {
  const { filtered, previous, compare } = useDashboardFiltered();
  const rows = filtered.alerta;
  const upper = (value: unknown) => String(value ?? "").toUpperCase();

  const finalizados = rows.filter((r) => r.finalizado).length;
  const pendentes = rows.length - finalizados;
  const aEnviar = rows.filter((r) => upper(r.statusEnvio).includes("FALTA")).length;

  const prev = useMemo(() => {
    if (!compare || !previous) return null;
    const r = previous.alerta;
    const f = r.filter((x) => x.finalizado).length;
    return {
      total: r.length,
      finalizados: f,
      pendentes: r.length - f,
      aEnviar: r.filter((x) => upper(x.statusEnvio).includes("FALTA")).length,
    };
  }, [compare, previous]);

  const porFornecedor = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.fornecedor, (map.get(r.fornecedor) ?? 0) + 1);
    return [...map.entries()]
      .map(([fornecedor, total]) => ({ fornecedor, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Total de Alertas" value={rows.length} icon={<AlertTriangle className="h-4 w-4" />}
          delta={prev ? <DeltaBadge current={rows.length} previous={prev.total} invert /> : undefined} />
        <KpiCard label="Finalizados" value={finalizados} tone="success" icon={<CheckCircle2 className="h-4 w-4" />}
          delta={prev ? <DeltaBadge current={finalizados} previous={prev.finalizados} /> : undefined} />
        <KpiCard label="Pendentes" value={pendentes} tone="destructive"
          delta={prev ? <DeltaBadge current={pendentes} previous={prev.pendentes} invert /> : undefined} />
        <KpiCard label="Falta enviar" value={aEnviar} tone="warning" icon={<Send className="h-4 w-4" />}
          delta={prev ? <DeltaBadge current={aEnviar} previous={prev.aEnviar} invert /> : undefined} />
        <PpmCard idf={filtered.idf} previous={previous?.idf} />
      </div>


      <SectionCard title="Top 10 fornecedores com mais alertas">
        {porFornecedor.length === 0 ? <EmptyState /> : <ResponsiveContainer width="100%" height={280}>
          <BarChart data={porFornecedor}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis dataKey="fornecedor" stroke="var(--color-muted-foreground)" fontSize={11} angle={-20} textAnchor="end" height={60} />
            <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
            <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="total" name="Alertas" fill="var(--color-chart-alert)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>}
      </SectionCard>

      <SectionCard title={`Lista de Alertas (${rows.length})`}>
        {rows.length === 0 ? <EmptyState /> : <div className="overflow-x-auto max-h-[560px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-2 pr-2">Nº AQ</th>
                <th className="py-2 pr-2">Data</th>
                <th className="py-2 pr-2">Divisão</th>
                <th className="py-2 pr-2">Item</th>
                <th className="py-2 pr-2 text-right">Qtde</th>
                <th className="py-2 pr-2">Fornecedor</th>
                <th className="py-2 pr-2">Problema</th>
                <th className="py-2 pr-2">Inspetor</th>
                <th className="py-2 pr-2">Envio</th>
                <th className="py-2 pr-2 text-center">Finaliz.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-1.5 pr-2 font-medium">{r.numero}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{r.dataCriacao}</td>
                  <td className="py-1.5 pr-2">{r.divisao}</td>
                  <td className="py-1.5 pr-2">{r.item}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{r.qtde}</td>
                  <td className="py-1.5 pr-2 font-medium">{r.fornecedor}</td>
                  <td className="py-1.5 pr-2">{r.problema}</td>
                  <td className="py-1.5 pr-2">{r.inspetor}</td>
                  <td className="py-1.5 pr-2">
                    {upper(r.statusEnvio).includes("FALTA") ? (
                      <Badge className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/15">Falta enviar</Badge>
                    ) : (
                      <Badge variant="secondary">{r.statusEnvio || "—"}</Badge>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-center">
                    {r.finalizado ? (
                      <CheckCircle2 className="h-4 w-4 text-success inline" />
                    ) : (
                      <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      </SectionCard>
    </div>
  );
}
