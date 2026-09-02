import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  FileUp,
  History,
  Loader2,
  LogIn,
  LogOut,
  MessageSquarePlus,
  Plus,
  Save,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type QualityAction = Tables<"quality_actions">;
type QualityComment = Tables<"quality_action_comments">;
type QualityAttachment = Tables<"quality_action_attachments">;
type QualityHistory = Tables<"quality_action_history">;

const INITIAL_FORM = {
  title: "",
  description: "",
  responsible: "",
  due_date: "",
  priority: "media",
  origin_type: "MANUAL",
  origin_id: "",
  supplier: "",
  division: "",
  item: "",
  lot: "",
};

function messageFromError(error: unknown) {
  const value = error instanceof Error ? error.message : String(error ?? "Erro desconhecido");
  if (
    value.includes("quality_actions") ||
    value.includes("schema cache") ||
    value.includes("42501")
  )
    return "A migração quality_actions ainda não foi aplicada no projeto Supabase ou os grants ainda não estão ativos.";
  return value;
}

export function QualityActionsWorkspace() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [actions, setActions] = useState<QualityAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [selected, setSelected] = useState<QualityAction | null>(null);
  const [comments, setComments] = useState<QualityComment[]>([]);
  const [attachments, setAttachments] = useState<QualityAttachment[]>([]);
  const [history, setHistory] = useState<QualityHistory[]>([]);
  const [comment, setComment] = useState("");

  const loadActions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("quality_actions")
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setActions(data ?? []);
    } catch (cause) {
      setError(messageFromError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    try {
      supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setAuthLoading(false);
      });
      const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setAuthLoading(false);
      });
      return () => {
        active = false;
        listener.subscription.unsubscribe();
      };
    } catch (cause) {
      setError(messageFromError(cause));
      setAuthLoading(false);
      return () => {
        active = false;
      };
    }
  }, []);

  useEffect(() => {
    if (session) void loadActions();
    else setActions([]);
  }, [loadActions, session]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.href },
      });
      if (authError) throw authError;
      setNotice("Link seguro enviado. Abra o e-mail para entrar na Central de Ações.");
    } catch (cause) {
      setError(messageFromError(cause));
    }
  };

  const createAction = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const { error: insertError } = await supabase.from("quality_actions").insert({
      title: form.title.trim(),
      description: form.description.trim(),
      responsible: form.responsible.trim(),
      due_date: form.due_date || null,
      priority: form.priority,
      origin_type: form.origin_type,
      origin_id: form.origin_id.trim() || null,
      supplier: form.supplier.trim() || null,
      division: form.division.trim() || null,
      item: form.item.trim() || null,
      lot: form.lot.trim() || null,
    });
    if (insertError) {
      setError(messageFromError(insertError));
      return;
    }
    setForm(INITIAL_FORM);
    setCreateOpen(false);
    await loadActions();
  };

  const updateStatus = async (action: QualityAction, status: string) => {
    setError("");
    const { error: updateError } = await supabase
      .from("quality_actions")
      .update({ status })
      .eq("id", action.id);
    if (updateError) setError(messageFromError(updateError));
    else await loadActions();
  };

  const openDetails = async (action: QualityAction) => {
    setSelected(action);
    setError("");
    const [commentResult, attachmentResult, historyResult] = await Promise.all([
      supabase
        .from("quality_action_comments")
        .select("*")
        .eq("action_id", action.id)
        .order("created_at"),
      supabase
        .from("quality_action_attachments")
        .select("*")
        .eq("action_id", action.id)
        .order("created_at"),
      supabase
        .from("quality_action_history")
        .select("*")
        .eq("action_id", action.id)
        .order("created_at", { ascending: false }),
    ]);
    const firstError = commentResult.error || attachmentResult.error || historyResult.error;
    if (firstError) setError(messageFromError(firstError));
    setComments(commentResult.data ?? []);
    setAttachments(attachmentResult.data ?? []);
    setHistory(historyResult.data ?? []);
  };

  const addComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !comment.trim()) return;
    const { error: commentError } = await supabase
      .from("quality_action_comments")
      .insert({ action_id: selected.id, body: comment.trim() });
    if (commentError) setError(messageFromError(commentError));
    else {
      setComment("");
      await openDetails(selected);
    }
  };

  const uploadFile = async (file: File | undefined) => {
    if (!file || !selected || !session) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("O anexo ultrapassa o limite seguro de 10 MB.");
      return;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const path = `${session.user.id}/${selected.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("quality-action-attachments")
      .upload(path, file, { upsert: false });
    if (uploadError) {
      setError(messageFromError(uploadError));
      return;
    }
    const { error: metadataError } = await supabase.from("quality_action_attachments").insert({
      action_id: selected.id,
      storage_path: path,
      file_name: file.name,
      content_type: file.type || null,
      size_bytes: file.size,
    });
    if (metadataError) {
      await supabase.storage.from("quality-action-attachments").remove([path]);
      setError(messageFromError(metadataError));
      return;
    }
    await openDetails(selected);
  };

  const openAttachment = async (attachment: QualityAttachment) => {
    const { data, error: signedError } = await supabase.storage
      .from("quality-action-attachments")
      .createSignedUrl(attachment.storage_path, 60);
    if (signedError) setError(messageFromError(signedError));
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (authLoading)
    return (
      <div className="flex min-h-44 items-center justify-center rounded-xl border">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validando sessão segura…
      </div>
    );

  if (!session)
    return (
      <section className="rounded-2xl border bg-card p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <LogIn className="h-4 w-4 text-primary" /> Área segura de ações
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Entre por link mágico para criar e manter suas ações. O acesso usa Supabase Auth e
              cada usuário só enxerga os próprios registros pelas políticas RLS.
            </p>
          </div>
          <form onSubmit={signIn} className="flex gap-2">
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu.email@empresa.com"
            />
            <Button type="submit">Enviar link</Button>
          </form>
        </div>
        <Messages error={error} notice={notice} />
      </section>
    );

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Save className="h-4 w-4 text-primary" /> Ações registradas no Supabase
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Sessão: {session.user.email ?? session.user.id}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nova ação
          </Button>
          <Button size="sm" variant="outline" onClick={() => supabase.auth.signOut()}>
            <LogOut className="mr-1 h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
      <Messages error={error} notice={notice} />
      {loading ? (
        <div className="flex min-h-44 items-center justify-center">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando ações…
        </div>
      ) : actions.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma ação criada por este usuário.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {actions.map((action) => (
            <div
              key={action.id}
              className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_180px_auto]"
            >
              <button type="button" onClick={() => openDetails(action)} className="text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold hover:text-primary">{action.title}</p>
                  <Badge variant="outline">{action.priority}</Badge>
                  <Badge variant="secondary">
                    {action.origin_type}
                    {action.origin_id ? ` ${action.origin_id}` : ""}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {action.responsible} · prazo{" "}
                  {action.due_date
                    ? new Date(`${action.due_date}T00:00:00`).toLocaleDateString("pt-BR")
                    : "não definido"}
                </p>
              </button>
              <Select value={action.status} onValueChange={(value) => updateStatus(action, value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberta">Aberta</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="bloqueada">Bloqueada</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => openDetails(action)}>
                Detalhes
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova ação da qualidade</DialogTitle>
            <DialogDescription>
              Os campos informados serão persistidos na sua área segura.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createAction} className="grid gap-4 sm:grid-cols-2">
            <Field label="Título">
              <Input
                required
                minLength={3}
                maxLength={160}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="Responsável">
              <Input
                required
                value={form.responsible}
                onChange={(e) => setForm({ ...form, responsible: e.target.value })}
              />
            </Field>
            <Field label="Prazo">
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </Field>
            <Field label="Prioridade">
              <Select
                value={form.priority}
                onValueChange={(value) => setForm({ ...form, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Origem">
              <Select
                value={form.origin_type}
                onValueChange={(value) => setForm({ ...form, origin_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="IDF">IDF</SelectItem>
                  <SelectItem value="ALERTA">Alerta</SelectItem>
                  <SelectItem value="RNC">RNC</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Identificador da origem">
              <Input
                value={form.origin_id}
                onChange={(e) => setForm({ ...form, origin_id: e.target.value })}
              />
            </Field>
            <Field label="Fornecedor">
              <Input
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              />
            </Field>
            <Field label="Divisão">
              <Input
                value={form.division}
                onChange={(e) => setForm({ ...form, division: e.target.value })}
              />
            </Field>
            <Field label="Item">
              <Input
                value={form.item}
                onChange={(e) => setForm({ ...form, item: e.target.value })}
              />
            </Field>
            <Field label="Lote">
              <Input value={form.lot} onChange={(e) => setForm({ ...form, lot: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Descrição">
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit">
                <Save className="mr-2 h-4 w-4" /> Salvar ação
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>
                  {selected.description || "Sem descrição complementar."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-3">
                <Info label="Responsável" value={selected.responsible} />
                <Info label="Prioridade" value={selected.priority} />
                <Info label="Status" value={selected.status} />
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <section>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <MessageSquarePlus className="h-4 w-4" /> Comentários
                  </div>
                  <form onSubmit={addComment} className="flex gap-2">
                    <Input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Adicionar comentário"
                    />
                    <Button type="submit" size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </form>
                  <div className="mt-3 space-y-2">
                    {comments.map((item) => (
                      <div key={item.id} className="rounded-lg bg-muted/40 p-3 text-xs">
                        <p>{item.body}</p>
                        <p className="mt-1 text-[9px] text-muted-foreground">
                          {new Date(item.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
                <section>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <FileUp className="h-4 w-4" /> Anexos
                  </div>
                  <Input
                    type="file"
                    onChange={(event) => {
                      void uploadFile(event.target.files?.[0]);
                    }}
                  />
                  <div className="mt-3 space-y-2">
                    {attachments.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openAttachment(item)}
                        className="block w-full rounded-lg border p-3 text-left text-xs hover:border-primary"
                      >
                        {item.file_name} ·{" "}
                        {item.size_bytes
                          ? `${Math.ceil(item.size_bytes / 1024)} KB`
                          : "tamanho não informado"}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
              <section>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <History className="h-4 w-4" /> Histórico
                </div>
                <div className="space-y-2">
                  {history.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3 text-xs">
                      <Badge variant="outline">{item.event_type}</Badge>
                      <span className="ml-2 text-muted-foreground">
                        {new Date(item.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Label className="space-y-2">
      <span>{label}</span>
      {children}
    </Label>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
function Messages({ error, notice }: { error: string; notice: string }) {
  return (
    <>
      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {notice && (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-600 dark:text-emerald-400">
          {notice}
        </div>
      )}
    </>
  );
}
