import { useEffect, useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { saveNotaOverride, deleteNotaOverride } from "@/lib/sheets.functions";
import type { IDFRow } from "@/lib/types";

const NAME_KEY = "idf-user-name";
const SURNAME_KEY = "idf-user-surname";

export function getCurrentAuthor(): string | null {
  if (typeof window === "undefined") return null;
  const n = localStorage.getItem(NAME_KEY)?.trim();
  const s = localStorage.getItem(SURNAME_KEY)?.trim();
  return n && s ? `${n} ${s}` : null;
}

function IdentityGate({ onReady }: { onReady: (author: string) => void }) {
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Para registrar alterações na auditoria, informe seu nome completo. Esta informação será salva neste dispositivo.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Nome *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="space-y-1">
          <Label>Sobrenome *</Label>
          <Input value={surname} onChange={(e) => setSurname(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={() => {
            const n = name.trim();
            const s = surname.trim();
            if (!n || !s) {
              toast.error("Informe nome e sobrenome");
              return;
            }
            localStorage.setItem(NAME_KEY, n);
            localStorage.setItem(SURNAME_KEY, s);
            onReady(`${n} ${s}`);
          }}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}

export function NotaEditButton({ row }: { row: IDFRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition"
        title={row.notaOverride ? `Manual: ${row.overrideAutor} — ${row.overrideMotivo}` : "Editar nota manualmente"}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      {open && <NotaEditModal row={row} open={open} onOpenChange={setOpen} />}
    </>
  );
}

function NotaEditModal({ row, open, onOpenChange }: { row: IDFRow; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveNotaOverride);
  const delFn = useServerFn(deleteNotaOverride);
  const [author, setAuthor] = useState<string | null>(null);
  const [nota, setNota] = useState<number>(row.notaNC);
  const [motivo, setMotivo] = useState(row.overrideMotivo ?? "");
  const [obs, setObs] = useState(row.overrideObservacao ?? "");

  useEffect(() => {
    setAuthor(getCurrentAuthor());
  }, [open]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          processo: row.processo,
          codigo_item: row.codigoItem,
          lote: row.lote ?? "",
          nota_final: Number(nota),
          motivo,
          observacao: obs || undefined,
          autor: author!,
          fornecedor: row.fornecedor,
          item: row.codigoItem,
        },
      }),
    onSuccess: () => {
      toast.success("Nota atualizada — recalculando dashboard");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const restore = useMutation({
    mutationFn: () => delFn({ data: { processo: row.processo, codigo_item: row.codigoItem, lote: row.lote ?? "", autor: author ?? undefined, fornecedor: row.fornecedor, item: row.codigoItem } }),
    onSuccess: () => {
      toast.success("Nota restaurada ao valor automático");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao restaurar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Nota NC — Processo {row.processo}</DialogTitle>
          <DialogDescription>
            {row.fornecedor} · Item {row.codigoItem} · {row.criticidade || "—"}
          </DialogDescription>
        </DialogHeader>

        {!author ? (
          <IdentityGate onReady={setAuthor} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nota Automática</Label>
                <div className="h-9 px-3 rounded-md border bg-muted/40 flex items-center tabular-nums">
                  {row.notaNCAuto.toFixed(1)}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nota Final *</Label>
                <Input type="number" step="0.5" value={nota} onChange={(e) => setNota(parseFloat(e.target.value || "0"))} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Motivo da alteração *</Label>
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: Reclassificação após análise de engenharia" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Observação (opcional)</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
            </div>

            <div className="text-xs text-muted-foreground border-t pt-3">
              Alteração será registrada como: <span className="font-medium text-foreground">{author}</span>
            </div>

            <DialogFooter className="gap-2">
              {row.notaOverride && (
                <Button variant="outline" onClick={() => restore.mutate()} disabled={restore.isPending}>
                  <RotateCcw className="h-3 w-3 mr-1" /> Restaurar automática
                </Button>
              )}
              <Button
                onClick={() => {
                  if (!motivo.trim()) return toast.error("Motivo é obrigatório");
                  save.mutate();
                }}
                disabled={save.isPending}
              >
                {save.isPending ? "Salvando..." : "Salvar nova nota"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
