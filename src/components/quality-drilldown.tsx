import { useMemo } from "react";
import { AlertTriangle, BarChart3, CalendarDays, ClipboardList, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calcPPM } from "@/lib/idf-calc";
import { isApproved, isConditional, isRejected, supplierForRnc } from "@/lib/quality-intelligence";
import type { AlertaRow, IDFRow, RNCRow } from "@/lib/types";

export type DrilldownKind =
  | "idf"
  | "ppm"
  | "inspecoes"
  | "aprovados"
  | "condicionais"
  | "reprovados"
  | "eficiencia"
  | "alertas"
  | "rnc";

type DrilldownData = {
  idf: IDFRow[];
  alerta: AlertaRow[];
  rnc: RNCRow[];
};

type EfficiencyRows = {
  recebidasRows: IDFRow[];
  inspecionadasRows: IDFRow[];
};

const TITLES: Record<DrilldownKind, string> = {
  idf: "Por que o IDF chegou a este resultado?",
  ppm: "Origem do PPM",
  inspecoes: "Inspeções do período",
  aprovados: "Inspeções aprovadas",
  condicionais: "Aprovações condicionais",
  reprovados: "Inspeções reprovadas",
  eficiencia: "Eficiência de inspeção",
  alertas: "Alertas da qualidade",
  rnc: "Registros de RNC",
};

function fmtDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  if (value instanceof Date) return value.toLocaleDateString("pt-BR");
  return value || "—";
}

function idfRowsForKind(kind: DrilldownKind, rows: IDFRow[]) {
  if (kind === "aprovados") return rows.filter((row) => isApproved(row.status));
  if (kind === "condicionais") return rows.filter((row) => isConditional(row.status));
  if (kind === "reprovados" || kind === "ppm") return rows.filter((row) => isRejected(row.status));
  return rows;
}

function topGroups(rows: IDFRow[], getter: (row: IDFRow) => string, limit = 8) {
  const map = new Map<string, { total: number; nc: number }>();
  for (const row of rows) {
    const label = getter(row).trim() || "Não informado";
    const current = map.get(label) ?? { total: 0, nc: 0 };
    current.total++;
    if (isRejected(row.status) || isConditional(row.status)) current.nc++;
    map.set(label, current);
  }
  return [...map.entries()]
    .map(([label, value]) => ({
      label,
      ...value,
      rate: value.total ? (value.nc / value.total) * 100 : 0,
    }))
    .sort((a, b) => b.nc - a.nc || b.total - a.total)
    .slice(0, limit);
}

export function QualityDrilldown({
  kind,
  open,
  onOpenChange,
  data,
  efficiency,
  onSupplier,
}: {
  kind: DrilldownKind | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DrilldownData;
  efficiency?: EfficiencyRows;
  onSupplier?: (supplier: string) => void;
}) {
  const activeKind = kind ?? "inspecoes";
  const rows = useMemo(() => idfRowsForKind(activeKind, data.idf), [activeKind, data.idf]);
  const ppm = useMemo(() => calcPPM(data.idf), [data.idf]);
  const suppliers = useMemo(() => topGroups(rows, (row) => row.fornecedor), [rows]);
  const divisions = useMemo(() => topGroups(rows, (row) => row.divisao), [rows]);
  const items = useMemo(() => topGroups(rows, (row) => row.codigoItem), [rows]);
  const problems = useMemo(
    () => topGroups(rows, (row) => row.tipoProblema || row.problema),
    [rows],
  );

  const totalLabel =
    activeKind === "alertas"
      ? `${data.alerta.length.toLocaleString("pt-BR")} alertas`
      : activeKind === "rnc"
        ? `${data.rnc.length.toLocaleString("pt-BR")} RNCs`
        : activeKind === "eficiencia"
          ? `${efficiency?.inspecionadasRows.length.toLocaleString("pt-BR") ?? 0} / ${efficiency?.recebidasRows.length.toLocaleString("pt-BR") ?? 0}`
          : activeKind === "ppm"
            ? `${ppm.ppm.toLocaleString("pt-BR")} PPM`
            : `${rows.length.toLocaleString("pt-BR")} registros`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-3xl">
        <SheetHeader className="border-b bg-muted/30 px-6 py-5 text-left">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Search className="h-4 w-4" /> Drill-down · dados reais
          </div>
          <SheetTitle className="text-xl">{TITLES[activeKind]}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{totalLabel}</Badge>
            <span>Do indicador ao registro de origem, respeitando o recorte atual.</span>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-132px)]">
          <div className="space-y-5 p-6">
            {activeKind === "eficiencia" ? (
              <EfficiencyDetail efficiency={efficiency} onSupplier={onSupplier} />
            ) : activeKind === "alertas" ? (
              <AlertRecords rows={data.alerta} onSupplier={onSupplier} />
            ) : activeKind === "rnc" ? (
              <RncRecords rows={data.rnc} idf={data.idf} onSupplier={onSupplier} />
            ) : (
              <>
                <Tabs defaultValue="porque" className="space-y-4">
                  <TabsList className="grid h-auto w-full grid-cols-2">
                    <TabsTrigger value="porque">Por quê?</TabsTrigger>
                    <TabsTrigger value="registros">Registros ({rows.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="porque" className="space-y-4">
                    <div className="rounded-xl border bg-card p-4">
                      <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                        <BarChart3 className="h-4 w-4 text-primary" /> Principais contribuições
                      </div>
                      <p className="text-xs text-muted-foreground">
                        A ordenação usa a quantidade real de não conformidades e, em seguida, o
                        volume do recorte.
                      </p>
                    </div>
                    <ContributorGrid title="Fornecedores" rows={suppliers} onSelect={onSupplier} />
                    <ContributorGrid title="Divisões" rows={divisions} />
                    <ContributorGrid title="Itens" rows={items} />
                    <ContributorGrid title="Tipos de problema" rows={problems} />
                  </TabsContent>
                  <TabsContent value="registros">
                    <IdfRecords rows={rows} onSupplier={onSupplier} />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function ContributorGrid({
  title,
  rows,
  onSelect,
}: {
  title: string;
  rows: ReturnType<typeof topGroups>;
  onSelect?: (label: string) => void;
}) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Dados insuficientes neste recorte.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div
              key={row.label}
              className="grid grid-cols-[24px_1fr_auto] items-center gap-2 rounded-lg bg-muted/45 px-3 py-2 text-xs"
            >
              <span className="font-mono text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(row.label)}
                  className="truncate text-left font-medium hover:text-primary hover:underline"
                  title={`Abrir fornecedor ${row.label}`}
                >
                  {row.label}
                </button>
              ) : (
                <span className="truncate font-medium" title={row.label}>
                  {row.label}
                </span>
              )}
              <span className="tabular-nums text-muted-foreground">
                {row.nc} NC · {row.total} total · {row.rate.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EfficiencyDetail({
  efficiency,
  onSupplier,
}: {
  efficiency?: EfficiencyRows;
  onSupplier?: (supplier: string) => void;
}) {
  const received = efficiency?.recebidasRows ?? [];
  const inspected = efficiency?.inspecionadasRows ?? [];
  const pct = inspected.length ? (received.length / inspected.length) * 100 : null;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Recebidos" value={received.length} hint="Data de Criação no período" />
        <Metric label="Inspecionados" value={inspected.length} hint="Data de Início no período" />
        <Metric
          label="Eficiência"
          value={pct === null ? "—" : `${pct.toFixed(2)}%`}
          hint="Recebidos ÷ Inspecionados × 100"
        />
      </div>
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <p className="font-semibold">Regra aplicada</p>
        <p className="mt-1 text-muted-foreground">
          Recebimentos e inspeções são selecionados de forma independente pelas duas datas oficiais.
          Por isso, uma inspeção iniciada no período pode ter sido recebida anteriormente.
        </p>
      </div>
      <Tabs defaultValue="recebidos">
        <TabsList>
          <TabsTrigger value="recebidos">Recebidos ({received.length})</TabsTrigger>
          <TabsTrigger value="inspecionados">Inspecionados ({inspected.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="recebidos">
          <IdfRecords rows={received} dateField="creation" onSupplier={onSupplier} />
        </TabsContent>
        <TabsContent value="inspecionados">
          <IdfRecords rows={inspected} dateField="start" onSupplier={onSupplier} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-bold tabular-nums">
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function IdfRecords({
  rows,
  dateField = "start",
  onSupplier,
}: {
  rows: IDFRow[];
  dateField?: "creation" | "start";
  onSupplier?: (supplier: string) => void;
}) {
  if (!rows.length) return <EmptyMessage />;
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="p-3">Data</th>
              <th className="p-3">Processo</th>
              <th className="p-3">Fornecedor</th>
              <th className="p-3">Divisão</th>
              <th className="p-3">Item</th>
              <th className="p-3">Lote</th>
              <th className="p-3">Qtd.</th>
              <th className="p-3">Status</th>
              <th className="p-3">Problema</th>
              <th className="p-3">Inspetor início</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((row, index) => (
              <tr key={`${row.processo}-${row.codigoItem}-${index}`} className="border-t">
                <td className="p-3 whitespace-nowrap">
                  {fmtDate(dateField === "creation" ? row.dataCriacaoInsp : row.dataInicioInsp)}
                </td>
                <td className="p-3">{row.processo || "—"}</td>
                <td className="p-3 font-medium">
                  {onSupplier && row.fornecedor && row.fornecedor !== "—" ? (
                    <button
                      type="button"
                      className="hover:text-primary hover:underline"
                      onClick={() => onSupplier(row.fornecedor)}
                    >
                      {row.fornecedor}
                    </button>
                  ) : (
                    row.fornecedor || "—"
                  )}
                </td>
                <td className="p-3">{row.divisao || "—"}</td>
                <td className="p-3">{row.codigoItem || "—"}</td>
                <td className="p-3">{row.lote || "—"}</td>
                <td className="p-3 tabular-nums">{row.quantidade.toLocaleString("pt-BR")}</td>
                <td className="p-3">{row.status || "—"}</td>
                <td className="p-3">{row.tipoProblema || row.problema || "—"}</td>
                <td className="p-3">{row.inspetorInicio || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 500 && (
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          Exibindo os 500 primeiros de {rows.length.toLocaleString("pt-BR")} registros.
        </div>
      )}
    </div>
  );
}

function AlertRecords({
  rows,
  onSupplier,
}: {
  rows: AlertaRow[];
  onSupplier?: (supplier: string) => void;
}) {
  if (!rows.length) return <EmptyMessage />;
  return (
    <div className="space-y-2">
      {rows.slice(0, 300).map((row, index) => (
        <div
          key={`${row.numero}-${index}`}
          className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-[110px_1fr_auto]"
        >
          <div className="font-mono text-xs text-primary">AQ {row.numero || "—"}</div>
          <div>
            <p className="text-sm font-semibold">
              {onSupplier && row.fornecedor ? (
                <button
                  type="button"
                  className="hover:text-primary hover:underline"
                  onClick={() => onSupplier(row.fornecedor)}
                >
                  {row.fornecedor}
                </button>
              ) : (
                row.fornecedor || "Fornecedor não informado"
              )}{" "}
              · {row.item || "Item não informado"} · lote {row.lote || "não informado"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.problema || row.observacao || "Problema não informado"} ·{" "}
              {fmtDate(row.dataCriacao)}
            </p>
          </div>
          <Badge variant={row.finalizado ? "secondary" : "destructive"}>
            {row.finalizado ? "Finalizado" : "Pendente"}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function RncRecords({
  rows,
  idf,
  onSupplier,
}: {
  rows: RNCRow[];
  idf: IDFRow[];
  onSupplier?: (supplier: string) => void;
}) {
  if (!rows.length) return <EmptyMessage />;
  return (
    <div className="space-y-2">
      {rows.slice(0, 300).map((row, index) => {
        const supplier = supplierForRnc(row, idf);
        return (
          <div
            key={`${row.rnc}-${index}`}
            className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-[110px_1fr_auto]"
          >
            <div className="font-mono text-xs text-primary">RNC {row.rnc || "—"}</div>
            <div>
              <p className="text-sm font-semibold">
                {supplier && onSupplier ? (
                  <button
                    type="button"
                    className="hover:text-primary hover:underline"
                    onClick={() => onSupplier(supplier)}
                  >
                    {supplier}
                  </button>
                ) : (
                  supplier || "Fornecedor não relacionado"
                )}{" "}
                · {row.item || "Item não informado"} · lote {row.lote || "não informado"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.assunto || "Assunto não informado"} · {fmtDate(row.data)}
              </p>
            </div>
            <Badge variant="secondary">
              {row.statusRNC || row.statusAcoes || "Em acompanhamento"}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

function EmptyMessage() {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
      <ClipboardList className="mb-2 h-7 w-7 text-muted-foreground" />
      <p className="text-sm font-semibold">Nenhum registro neste recorte</p>
      <p className="mt-1 text-xs text-muted-foreground">
        <CalendarDays className="mr-1 inline h-3 w-3" />
        Revise os filtros de período ou de negócio.
      </p>
    </div>
  );
}
