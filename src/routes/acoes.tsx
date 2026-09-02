import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardPlus,
  FileWarning,
  UserRound,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { QualityActionsWorkspace } from "@/components/quality-actions-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashboardFiltered } from "@/hooks/use-data";
import { parseBrDate } from "@/lib/idf-calc";
import { isRncOpen, supplierForRnc } from "@/lib/quality-intelligence";

export const Route = createFileRoute("/acoes")({
  head: () => ({ meta: [{ title: "Central de Ações — QualiHub" }] }),
  component: QualityActionsPage,
});

function QualityActionsPage() {
  const { data, filtered } = useDashboardFiltered();
  const openRncs = useMemo(
    () =>
      filtered.rnc.filter(isRncOpen).map((row) => ({
        row,
        supplier: supplierForRnc(row, data?.idf ?? filtered.idf),
        due: parseBrDate(row.prazoAcoes || row.prazoAnalise),
      })),
    [data?.idf, filtered.idf, filtered.rnc],
  );
  const pendingAlerts = useMemo(
    () => filtered.alerta.filter((row) => !row.finalizado),
    [filtered.alerta],
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = openRncs.filter((item) => item.due && item.due < today).length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-primary/[0.06] p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <ClipboardPlus className="h-4 w-4" /> Problema → decisão → ação
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Central de Ações</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Pendências reais identificadas nas abas ALERTA e RNC. Nenhum prazo, responsável ou
              status é fabricado.
            </p>
          </div>
          <Button asChild className="gap-2">
            <a href="#workspace">
              <ClipboardPlus className="h-4 w-4" /> Criar ação
            </a>
          </Button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <ActionMetric
          label="RNC em acompanhamento"
          value={openRncs.length}
          icon={<FileWarning className="h-4 w-4" />}
        />
        <ActionMetric
          label="RNC com prazo vencido"
          value={overdue}
          tone="danger"
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <ActionMetric
          label="Alertas pendentes"
          value={pendingAlerts.length}
          tone="warning"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <div id="workspace" className="scroll-mt-24">
        <QualityActionsWorkspace />
      </div>

      <Tabs defaultValue="rnc" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rnc">RNC ({openRncs.length})</TabsTrigger>
          <TabsTrigger value="alertas">Alertas ({pendingAlerts.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="rnc" className="space-y-2">
          {openRncs.length === 0 ? (
            <EmptyActions />
          ) : (
            openRncs.map(({ row, supplier, due }, index) => {
              const isOverdue = Boolean(due && due < today);
              return (
                <article
                  key={`${row.rnc}-${index}`}
                  className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm lg:grid-cols-[130px_1fr_auto]"
                >
                  <div>
                    <Badge variant={isOverdue ? "destructive" : "secondary"}>
                      RNC {row.rnc || "—"}
                    </Badge>
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {isOverdue ? "Prazo vencido" : "Em acompanhamento"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {supplier || "Fornecedor não relacionado"} ·{" "}
                      {row.item || "Item não informado"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.assunto || row.descrAcao || "Descrição não informada"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" /> Prazo:{" "}
                        {due ? due.toLocaleDateString("pt-BR") : "não informado"}
                      </span>
                      <span className="flex items-center gap-1">
                        <UserRound className="h-3 w-3" /> Responsável: não disponível na aba
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="h-fit">
                    {row.statusRNC || row.statusAcoes || "Em acompanhamento"}
                  </Badge>
                </article>
              );
            })
          )}
        </TabsContent>
        <TabsContent value="alertas" className="space-y-2">
          {pendingAlerts.length === 0 ? (
            <EmptyActions />
          ) : (
            pendingAlerts.map((row, index) => (
              <article
                key={`${row.numero}-${index}`}
                className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm lg:grid-cols-[130px_1fr_auto]"
              >
                <div>
                  <Badge variant="outline">AQ {row.numero || "—"}</Badge>
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Pendente
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {row.fornecedor || "Fornecedor não informado"} ·{" "}
                    {row.item || "Item não informado"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.problema || row.observacao || "Descrição não informada"}
                  </p>
                  <p className="mt-3 text-[10px] text-muted-foreground">
                    Criado em {row.dataCriacao || "data não informada"} · Inspetor{" "}
                    {row.inspetor || "não informado"}
                  </p>
                </div>
                <Badge variant="secondary" className="h-fit">
                  {row.statusEnvio || "Aguardando tratativa"}
                </Badge>
              </article>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ActionMetric({
  label,
  value,
  tone = "default",
  icon,
}: {
  label: string;
  value: number;
  tone?: "default" | "warning" | "danger";
  icon: ReactNode;
}) {
  const color =
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-primary";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span className={color}>{icon}</span>
      </div>
      <div className={`mt-2 text-3xl font-bold tabular-nums ${color}`}>
        {value.toLocaleString("pt-BR")}
      </div>
    </div>
  );
}

function EmptyActions() {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed text-center">
      <CheckCircle2 className="mb-2 h-7 w-7 text-emerald-500" />
      <p className="text-sm font-semibold">Nenhuma pendência neste recorte</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Aplique outros filtros para consultar um contexto diferente.
      </p>
    </div>
  );
}
