import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileWarning,
  Search,
  ShieldAlert,
} from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDashboardFiltered } from "@/hooks/use-data";
import { buildQualityTimeline } from "@/lib/quality-intelligence";

export const Route = createFileRoute("/timeline")({
  head: () => ({ meta: [{ title: "Timeline da Qualidade — QualiHub" }] }),
  component: QualityTimelinePage,
});

function QualityTimelinePage() {
  const { data, filtered } = useDashboardFiltered();
  const scoped = useMemo(
    () => ({
      idf: filtered.idf,
      alerta: filtered.alerta,
      rnc: filtered.rnc,
      fornecedores: [],
      divisoes: data?.divisoes ?? [],
      fetchedAt: data?.fetchedAt ?? "",
    }),
    [data?.divisoes, data?.fetchedAt, filtered],
  );
  const events = useMemo(() => buildQualityTimeline(scoped, 250), [scoped]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-primary/[0.06] p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          <Clock3 className="h-4 w-4" /> Rastreabilidade 360°
        </div>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">Timeline da Qualidade</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Inspeções, reprovações, alertas e RNC organizados pelas datas de origem preservadas em
          cada módulo.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="flex gap-2">
          <Badge variant="outline">{events.length} eventos exibidos</Badge>
          <Badge variant="secondary">recorte atual</Badge>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Use os filtros globais para pesquisar" disabled />
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
          Nenhum evento com data válida neste recorte.
        </div>
      ) : (
        <div className="relative ml-4 space-y-3 border-l pl-7 md:ml-10">
          {events.map((event) => {
            const Icon =
              event.type === "reprovacao"
                ? ShieldAlert
                : event.type === "alerta"
                  ? AlertTriangle
                  : event.type === "rnc"
                    ? FileWarning
                    : CheckCircle2;
            const tone =
              event.type === "reprovacao"
                ? "text-red-500 bg-red-500/10 border-red-500/30"
                : event.type === "alerta"
                  ? "text-amber-500 bg-amber-500/10 border-amber-500/30"
                  : event.type === "rnc"
                    ? "text-sky-500 bg-sky-500/10 border-sky-500/30"
                    : "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
            return (
              <article key={event.id} className="relative rounded-xl border bg-card p-4 shadow-sm">
                <span
                  className={`absolute -left-[45px] top-4 flex h-8 w-8 items-center justify-center rounded-full border bg-background ${tone}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{event.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{event.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium tabular-nums">
                      {event.date.toLocaleDateString("pt-BR")}
                    </p>
                    <Badge variant="outline" className="mt-1 text-[9px]">
                      Origem {event.origin}
                    </Badge>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
