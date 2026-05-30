import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { FileWarning, CheckCircle2, Clock } from "lucide-react";
import { KpiCard, PpmCard, SectionCard, DeltaBadge, EmptyState } from "@/components/dashboard-ui";
import { Badge } from "@/components/ui/badge";
import { useDashboardFiltered } from "@/hooks/use-data";
import { EvidenciaButton } from "@/components/rnc-evidencia-modal";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";

export const Route = createFileRoute("/rnc")({
  head: () => ({
    meta: [
      { title: "RNC — Não Conformidades" },
      { name: "description", content: "Acompanhamento de Relatórios de Não Conformidade (RNC)." },
    ],
  }),
  component: RncPage,
});

function RncPage() {
  const { filtered, previous, compare } = useDashboardFiltered();
  const rows = filtered.rnc;
  const upper = (value: unknown) => String(value ?? "").toUpperCase();

  const concluidos = rows.filter((r) => upper(r.statusRNC).includes("CONCLU")).length;
  const emAndamento = rows.length - concluidos;
  const eficacia = rows.length ? Math.round((concluidos / rows.length) * 1000) / 10 : 0;

  const prev = useMemo(() => {
    if (!compare || !previous) return null;
    const r = previous.rnc;
    const c = r.filter((x) => upper(x.statusRNC).includes("CONCLU")).length;
    return {
      total: r.length,
      concluidos: c,
      emAndamento: r.length - c,
      eficacia: r.length ? Math.round((c / r.length) * 1000) / 10 : 0,
    };
  }, [compare, previous]);

  const porStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const k = (r.statusRNC || "Sem status").trim();
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    const palette = [
      "var(--color-chart-rnc)","var(--color-chart-conditional)","var(--color-chart-approved)","var(--color-chart-rejected)","var(--color-chart-alert)",
    ];
    return [...map.entries()].map(([name, value], i) => ({ name, value, color: palette[i % palette.length] }));
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Total RNCs" value={rows.length} icon={<FileWarning className="h-4 w-4" />}
          delta={prev ? <DeltaBadge current={rows.length} previous={prev.total} invert /> : undefined} />
        <KpiCard label="Concluídas" value={concluidos} tone="success" icon={<CheckCircle2 className="h-4 w-4" />}
          delta={prev ? <DeltaBadge current={concluidos} previous={prev.concluidos} /> : undefined} />
        <KpiCard label="Em andamento" value={emAndamento} tone="warning" icon={<Clock className="h-4 w-4" />}
          delta={prev ? <DeltaBadge current={emAndamento} previous={prev.emAndamento} invert /> : undefined} />
        <KpiCard label="Eficácia %" value={rows.length ? `${eficacia}%` : "—"} tone="info"
          delta={prev ? <DeltaBadge current={eficacia} previous={prev.eficacia} /> : undefined} />
        <PpmCard idf={filtered.idf} previous={previous?.idf} />
      </div>


      <SectionCard title="Distribuição por Status">
        {porStatus.length === 0 ? <EmptyState /> : <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={porStatus} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
              {porStatus.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>}
      </SectionCard>

      <SectionCard title={`Lista de RNCs (${rows.length})`}>
        {rows.length === 0 ? <EmptyState /> : <div className="overflow-x-auto max-h-[560px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-2 pr-2">RNC</th>
                <th className="py-2 pr-2">Data</th>
                <th className="py-2 pr-2">Item</th>
                <th className="py-2 pr-2">Divisão</th>
                <th className="py-2 pr-2">Cliente/Setor</th>
                <th className="py-2 pr-2">Assunto</th>
                <th className="py-2 pr-2">Status Análise</th>
                <th className="py-2 pr-2">Prazo Ações</th>
                <th className="py-2 pr-2">Status RNC</th>
                <th className="py-2 pr-2 text-center">Evid.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-1.5 pr-2 font-medium">{r.rnc}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{r.data}</td>
                  <td className="py-1.5 pr-2">{r.item}</td>
                  <td className="py-1.5 pr-2">{r.divisao}</td>
                  <td className="py-1.5 pr-2">{r.cliente}</td>
                  <td className="py-1.5 pr-2 max-w-[240px] truncate">{r.assunto}</td>
                  <td className="py-1.5 pr-2">{r.statusAnalise || "—"}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{r.prazoAcoes || "—"}</td>
                  <td className="py-1.5 pr-2">
                    {upper(r.statusRNC).includes("CONCLU") ? (
                      <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/15">Concluída</Badge>
                    ) : (
                      <Badge className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/15">{r.statusRNC || "Em andamento"}</Badge>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-center">
                    <EvidenciaButton rncId={r.rnc} />
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
