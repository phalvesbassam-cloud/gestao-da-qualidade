import { useMemo } from "react";
import { AlertTriangle, Flame, CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useDashboard } from "@/hooks/use-data";
import type { IDFRow } from "@/lib/types";


const norm = (s: string) => (s || "").trim().toLowerCase();

export function recurrenceTone(n: number): {
  bg: string; text: string; border: string; icon: typeof AlertTriangle; label: string;
} {
  if (n >= 3) return {
    bg: "bg-destructive/20", text: "text-destructive", border: "border-destructive/40",
    icon: Flame, label: "Crítico",
  };
  if (n === 2) return {
    bg: "bg-[color:var(--color-chart-alert)]/20",
    text: "text-[color:var(--color-chart-alert)]",
    border: "border-[color:var(--color-chart-alert)]/40",
    icon: AlertTriangle, label: "Alerta",
  };
  return {
    bg: "bg-warning/20", text: "text-warning", border: "border-warning/40",
    icon: AlertTriangle, label: "Atenção",
  };
}

export function ReincBadge({ row }: { row: IDFRow }) {
  const data = useDashboard();
  const n = row.recorrencia || 0;

  // Histórico completo do trio fornecedor+item+problema
  const history = useMemo(() => {
    if (!data) return [row];
    const key = `${norm(row.fornecedor)}|${norm(row.codigoItem)}|${norm(row.problema || row.tipoProblema)}`;
    return data.idf
      .filter((r) =>
        `${norm(r.fornecedor)}|${norm(r.codigoItem)}|${norm(r.problema || r.tipoProblema)}` === key,
      )
      .sort((a, b) => {
        const da = a.dataReferencia?.getTime() ?? 0;
        const db = b.dataReferencia?.getTime() ?? 0;
        return da - db;
      });
  }, [data, row]);

  if (!n) return <span className="text-xs text-muted-foreground">—</span>;

  const tone = recurrenceTone(n);
  const Icon = tone.icon;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md border ${tone.bg} ${tone.text} ${tone.border} hover:brightness-110 transition cursor-pointer`}
        >
          <Icon className="h-3 w-3" /> Recorr. {n}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${tone.text}`} />
            Histórico de Recorrência — {tone.label}
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{row.fornecedor}</span> · Item{" "}
            <span className="font-medium text-foreground">{row.codigoItem}</span> ·{" "}
            <span className="font-medium text-foreground">{row.problema || row.tipoProblema || "—"}</span>
            <br />
            <span className="text-xs">
              {history.length} ocorrência(s) no histórico · {n} reincidência(s) válida(s) dentro da janela.
            </span>
          </DialogDescription>
        </DialogHeader>

        <Timeline rows={history} highlightProcesso={row.processo} />
      </DialogContent>
    </Dialog>
  );
}

function Timeline({ rows, highlightProcesso }: { rows: IDFRow[]; highlightProcesso: string }) {
  return (
    <ol className="relative border-l-2 border-border ml-3 mt-3 space-y-4">
      {rows.map((r, i) => {
        const isHighlight = r.processo === highlightProcesso;
        const isReinc = (r.recorrencia || 0) > 0;
        const tone = isReinc ? recurrenceTone(r.recorrencia) : null;
        return (
          <li key={`${r.processo}-${i}`} className="ml-6">
            <span
              className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-background ${
                isReinc ? (tone!.bg + " " + tone!.border + " border") : "bg-muted border border-border"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isReinc ? tone!.text.replace("text-", "bg-") : "bg-muted-foreground"}`} />
            </span>
            <div
              className={`rounded-lg border p-3 transition hover:shadow-md ${
                isHighlight ? "border-primary/60 bg-primary/5" : "border-border bg-card"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold tabular-nums">{r.dataRecebimento || "—"}</span>
                <Badge variant="secondary" className="text-[10px]">Proc. {r.processo}</Badge>
                {r.divisao && <Badge variant="outline" className="text-[10px]">{r.divisao}</Badge>}
                {isReinc && (
                  <Badge className={`text-[10px] ${tone!.bg} ${tone!.text} ${tone!.border}`}>
                    Reincid. {r.recorrencia}
                  </Badge>
                )}
                {isHighlight && (
                  <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">Selecionada</Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  IR +{r.irPoints || 0} · NC {r.notaNC.toFixed(1)}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1 text-xs">
                <Field label="Item" value={r.codigoItem} />
                <Field label="Lote" value={r.lote || "—"} />
                <Field label="Qtd." value={String(r.quantidade || 0)} />
                <Field label="Status" value={r.status || "—"} />
                <Field label="Fornecedor" value={r.fornecedor} />
                <Field label="Criticidade" value={r.criticidade || "—"} />
                <Field label="Tipo" value={r.tipoProblema || "—"} />
                <Field label="Problema" value={r.problema || "—"} />
              </div>
              {r.descricaoItem && (
                <div className="text-xs text-muted-foreground mt-1.5 truncate" title={r.descricaoItem}>
                  {r.descricaoItem}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1 min-w-0">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="font-medium truncate" title={value}>{value}</span>
    </div>
  );
}
