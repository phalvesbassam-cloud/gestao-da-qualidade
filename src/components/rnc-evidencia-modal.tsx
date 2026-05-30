import { useState } from "react";
import { Paperclip, Upload, Trash2, FileText, ImageIcon, ExternalLink, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { listEvidencias, addEvidencia, deleteEvidencia, type RncEvidencia } from "@/lib/sheets.functions";
import { getCurrentAuthor } from "./nota-edit-modal";

function isImage(tipo: string | null, nome: string) {
  if (tipo?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(nome);
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function NameGate({ onReady }: { onReady: () => void }) {
  const [n, setN] = useState("");
  const [s, setS] = useState("");
  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">Informe nome e sobrenome para registrar a evidência.</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input value={n} onChange={(e) => setN(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Sobrenome *</Label><Input value={s} onChange={(e) => setS(e.target.value)} /></div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => {
          const nn = n.trim(); const ss = s.trim();
          if (!nn || !ss) { toast.error("Informe nome e sobrenome"); return; }
          localStorage.setItem("idf-user-name", nn);
          localStorage.setItem("idf-user-surname", ss);
          onReady();
        }}>Salvar identificação</Button>
      </div>
    </div>
  );
}

export function EvidenciaButton({ rncId }: { rncId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6" title="Evidências">
          <Paperclip className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Paperclip className="h-4 w-4" /> Evidências da RNC {rncId}</DialogTitle>
          <DialogDescription>Anexe fotos, PDFs e documentos relacionados a esta RNC.</DialogDescription>
        </DialogHeader>
        {open && <EvidenciaBody rncId={rncId} />}
      </DialogContent>
    </Dialog>
  );
}

function EvidenciaBody({ rncId }: { rncId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listEvidencias);
  const addFn = useServerFn(addEvidencia);
  const delFn = useServerFn(deleteEvidencia);

  const [author, setAuthor] = useState<string | null>(getCurrentAuthor());
  const [file, setFile] = useState<File | null>(null);
  const [obs, setObs] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["evidencias", rncId],
    queryFn: () => listFn({ data: { rncId } }),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id, autor: author ?? undefined } }),
    onSuccess: () => { toast.success("Evidência removida"); qc.invalidateQueries({ queryKey: ["evidencias", rncId] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  async function handleUpload() {
    if (!file) { toast.error("Selecione um arquivo"); return; }
    const a = author ?? getCurrentAuthor();
    if (!a) { toast.error("Identificação obrigatória"); return; }
    setUploading(true);
    try {
      const fileBase64 = await fileToBase64(file);
      await addFn({
        data: {
          rnc_id: rncId,
          nome: file.name,
          tipo: file.type,
          observacao: obs,
          autor: a,
          file_base64: fileBase64,
        },
      });
      toast.success("Evidência enviada");
      setFile(null); setObs("");
      const input = document.getElementById(`file-${rncId}`) as HTMLInputElement | null;
      if (input) input.value = "";
      qc.invalidateQueries({ queryKey: ["evidencias", rncId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  if (!author) return <NameGate onReady={() => setAuthor(getCurrentAuthor())} />;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Identificado como: <span className="font-medium text-foreground">{author}</span></span>
          <button className="underline hover:text-foreground" onClick={() => { localStorage.removeItem("idf-user-name"); localStorage.removeItem("idf-user-surname"); setAuthor(null); }}>trocar</button>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Arquivo</Label>
          <Input id={`file-${rncId}`} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Observação (opcional)</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Descrição da evidência..." />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
            Enviar evidência
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Timeline ({items.length})</h4>
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Carregando...</div>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhuma evidência registrada.</p>
        ) : (
          <ol className="relative border-l border-border ml-2 space-y-3">
            {items.map((it: RncEvidencia) => (
              <li key={it.id} className="ml-4">
                <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                <div className="rounded-md border border-border bg-card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isImage(it.tipo, it.nome) ? <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" /> : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <a href={it.url} target="_blank" rel="noreferrer" className="text-sm font-medium truncate hover:underline flex items-center gap-1">
                        {it.nome} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { if (confirm("Remover esta evidência?")) del.mutate(it.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {isImage(it.tipo, it.nome) && (
                    <a href={it.url} target="_blank" rel="noreferrer">
                      <img src={it.url} alt={it.nome} className="max-h-48 rounded border border-border object-contain bg-muted/30" loading="lazy" />
                    </a>
                  )}
                  {it.observacao && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{it.observacao}</p>}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{it.autor}</Badge>
                    <span>{fmtDate(it.created_at)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
