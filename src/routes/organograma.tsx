import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Loader2,
  Mail,
  Network,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PrintButton } from "@/components/dashboard-ui";
import { uploadOrgFoto } from "@/lib/sheets.functions";
import {
  LIDERANCA,
  ORG_PADRAO,
  fotoUrl,
  getAutor,
  iniciais,
  pessoasDa,
  redimensionarFoto,
  setAutor,
  useOrganograma,
  useSaveOrganograma,
  type Area,
  type OrgData,
  type Pessoa,
} from "@/lib/org";
import { cn } from "@/lib/utils";
import logoFrasle from "@/assets/print/frasle-mobility.png";
import logoRandon from "@/assets/print/randoncorp.png";

export const Route = createFileRoute("/organograma")({
  head: () => ({ meta: [{ title: "Organograma — Gestão da Qualidade" }] }),
  component: OrganogramaPage,
});

const novoId = (prefixo: string) =>
  `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function OrganogramaPage() {
  const q = useOrganograma();
  const save = useSaveOrganograma();
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<OrgData | null>(null);
  const [pessoaEdit, setPessoaEdit] = useState<Pessoa | null>(null);
  const [areaEdit, setAreaEdit] = useState<Area | null>(null);
  const [salvarAberto, setSalvarAberto] = useState(false);
  const arvoreRef = useRef<HTMLDivElement | null>(null);

  const org = rascunho ?? q.data?.org ?? ORG_PADRAO;
  const dirty = rascunho !== null;

  const update = (fn: (o: OrgData) => OrgData) => setRascunho((atual) => fn(atual ?? org));

  const lideranca = pessoasDa(org, LIDERANCA);
  const total = org.pessoas.length;

  const iniciarEdicao = () => setEditando(true);
  const descartar = () => {
    setRascunho(null);
    setEditando(false);
  };

  const moverPessoa = (pessoa: Pessoa, delta: number) =>
    update((o) => {
      const lista = pessoasDa(o, pessoa.areaId);
      const i = lista.findIndex((x) => x.id === pessoa.id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= lista.length) return o;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      const ordem = new Map(lista.map((x, idx) => [x.id, idx]));
      return {
        ...o,
        pessoas: o.pessoas.map((x) => (ordem.has(x.id) ? { ...x, ordem: ordem.get(x.id)! } : x)),
      };
    });

  const removerPessoa = (pessoa: Pessoa) => {
    if (!confirm(`Remover ${pessoa.nome} do organograma?`)) return;
    update((o) => ({ ...o, pessoas: o.pessoas.filter((x) => x.id !== pessoa.id) }));
  };

  const salvarPessoa = (pessoa: Pessoa) => {
    update((o) => {
      const existe = o.pessoas.some((x) => x.id === pessoa.id);
      const antiga = o.pessoas.find((x) => x.id === pessoa.id);
      let p = pessoa;
      // Mudou de área: vai para o fim da nova área.
      if (!existe || antiga?.areaId !== pessoa.areaId) {
        p = { ...pessoa, ordem: pessoasDa(o, pessoa.areaId).length };
      }
      return {
        ...o,
        pessoas: existe ? o.pessoas.map((x) => (x.id === p.id ? p : x)) : [...o.pessoas, p],
      };
    });
    setPessoaEdit(null);
  };

  const salvarArea = (area: Area) => {
    update((o) => {
      const existe = o.areas.some((a) => a.id === area.id);
      return {
        ...o,
        areas: existe ? o.areas.map((a) => (a.id === area.id ? area : a)) : [...o.areas, area],
      };
    });
    setAreaEdit(null);
  };

  const removerArea = (area: Area) => {
    if (pessoasDa(org, area.id).length > 0) {
      toast.error("Mova ou remova as pessoas desta área antes de excluí-la.");
      return;
    }
    if (!confirm(`Excluir a área ${area.nome}?`)) return;
    update((o) => ({ ...o, areas: o.areas.filter((a) => a.id !== area.id) }));
  };

  const moverArea = (area: Area, delta: number) =>
    update((o) => {
      const areas = [...o.areas];
      const i = areas.findIndex((a) => a.id === area.id);
      const j = i + delta;
      if (j < 0 || j >= areas.length) return o;
      [areas[i], areas[j]] = [areas[j], areas[i]];
      return { ...o, areas };
    });

  const confirmarSalvar = async (autor: string) => {
    setAutor(autor);
    try {
      const res = await save.mutateAsync({ org, autor });
      if (res.origem === "local") {
        toast.warning(
          "Salvo neste navegador. Para todos verem, publique o Apps Script de gravação (apps-script/LEIA-ME.md).",
          { duration: 8000 },
        );
      } else {
        toast.success("Organograma salvo na planilha.");
      }
      setRascunho(null);
      setEditando(false);
      setSalvarAberto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  };

  const atualizado = org.atualizadoEm ? new Date(org.atualizadoEm) : null;

  return (
    <div className="space-y-6">
      <section className="hero-panel p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">
              <Network className="h-3.5 w-3.5" /> Estrutura da equipe
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
              Organograma da Qualidade
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Controle de Qualidade e Adequação, sob a coordenação do Gildo e a gerência do Edmir.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip">
                <Users className="h-3 w-3" /> {total} pessoas
              </span>
              <span className="chip">{org.areas.length} áreas</span>
              {atualizado && !Number.isNaN(atualizado.getTime()) && (
                <span className="chip">
                  Atualizado em {atualizado.toLocaleDateString("pt-BR")}
                  {org.atualizadoPor ? ` por ${org.atualizadoPor}` : ""}
                </span>
              )}
              {dirty && (
                <span className="chip border-warning/40 text-warning">Alterações não salvas</span>
              )}
              {q.data?.origem === "local" && (
                <span
                  className="chip border-warning/40 text-warning"
                  title="Publique o Apps Script para gravar na planilha"
                >
                  Salvo só neste navegador
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!editando ? (
              <>
                <PrintButton
                  target={() => arvoreRef.current}
                  title="Organograma da Qualidade"
                  subtitle="Controle de Qualidade e Adequação"
                  defaultAppearance="screen"
                />
                <Button onClick={iniciarEdicao} className="gap-2">
                  <Pencil className="h-4 w-4" /> Editar organograma
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setPessoaEdit(novaPessoa(org.areas[0]?.id ?? LIDERANCA))}
                >
                  <Plus className="h-4 w-4" /> Pessoa
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() =>
                    setAreaEdit({ id: novoId("area"), nome: "", descricao: "", cor: "#0EA5E9" })
                  }
                >
                  <Plus className="h-4 w-4" /> Área
                </Button>
                <Button
                  variant="ghost"
                  className="gap-2"
                  onClick={() => {
                    if (confirm("Voltar ao organograma padrão? (só vale depois de salvar)"))
                      setRascunho(ORG_PADRAO);
                  }}
                >
                  <RotateCcw className="h-4 w-4" /> Padrão
                </Button>
                <Button variant="ghost" className="gap-2" onClick={descartar}>
                  <Undo2 className="h-4 w-4" /> {dirty ? "Descartar" : "Sair"}
                </Button>
                <Button
                  className="gap-2"
                  disabled={!dirty || save.isPending}
                  onClick={() => setSalvarAberto(true)}
                >
                  {save.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {q.isLoading ? (
        <div className="surface flex h-80 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando organograma…
        </div>
      ) : (
        <div ref={arvoreRef} className="surface overflow-hidden">
          {/* Faixa com as marcas */}
          <div className="relative flex items-center justify-between gap-4 border-b px-6 py-4 md:px-10">
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-[#1d4ed8]" />
            <div className="rounded-xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-black/5">
              <img src={logoFrasle} alt="Frasle Mobility" className="h-8 w-auto" />
            </div>
            <div className="hidden text-center md:block">
              <div className="eyebrow justify-center">Qualidade de Fornecedores</div>
              <div className="mt-0.5 font-display text-lg font-semibold">Estrutura da equipe</div>
            </div>
            <div className="rounded-xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-black/5">
              <img src={logoRandon} alt="RandonCorp" className="h-7 w-auto" />
            </div>
          </div>

          <div className="overflow-x-auto px-6 py-8 md:px-10">
            <div className="mx-auto flex min-w-[900px] max-w-[1500px] flex-col items-center">
              {/* Liderança: um nível por pessoa (gerente → coordenador) */}
              {lideranca.map((pessoa, i) => (
                <div key={pessoa.id} className="flex flex-col items-center">
                  {i > 0 && <Conector />}
                  <PessoaCard
                    pessoa={pessoa}
                    cor="var(--color-primary)"
                    editando={editando}
                    onEdit={() => setPessoaEdit(pessoa)}
                    onRemove={() => removerPessoa(pessoa)}
                    onMove={(d) => moverPessoa(pessoa, d)}
                  />
                </div>
              ))}

              {org.areas.length > 0 && <Conector />}

              {/* Áreas lado a lado, com o mesmo espaço para cada uma */}
              <div
                className="grid w-full"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(org.areas.length, 1)}, minmax(0, 1fr))`,
                }}
              >
                {org.areas.map((area, i) => (
                  <div key={area.id} className="relative flex flex-col items-center px-3">
                    {org.areas.length > 1 && (
                      <span
                        className="absolute top-0 h-px bg-border"
                        style={{
                          left: i === 0 ? "50%" : 0,
                          right: i === org.areas.length - 1 ? "50%" : 0,
                        }}
                      />
                    )}
                    <span className="h-6 w-px bg-border" />
                    <AreaBloco
                      area={area}
                      pessoas={pessoasDa(org, area.id)}
                      editando={editando}
                      onEditArea={() => setAreaEdit(area)}
                      onRemoveArea={() => removerArea(area)}
                      onMoveArea={(d) => moverArea(area, d)}
                      onAddPessoa={() => setPessoaEdit(novaPessoa(area.id))}
                      onEditPessoa={setPessoaEdit}
                      onRemovePessoa={removerPessoa}
                      onMovePessoa={moverPessoa}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t px-6 py-3 text-[11px] text-muted-foreground md:px-10">
            <span>Frasle Mobility · Gestão da Qualidade de Fornecedores</span>
            <span>
              {total} pessoas · {org.areas.length} áreas
            </span>
          </div>
        </div>
      )}

      <PessoaDialog
        pessoa={pessoaEdit}
        org={org}
        onClose={() => setPessoaEdit(null)}
        onSave={salvarPessoa}
      />
      <AreaDialog area={areaEdit} onClose={() => setAreaEdit(null)} onSave={salvarArea} />
      <SalvarDialog
        open={salvarAberto}
        busy={save.isPending}
        onClose={() => setSalvarAberto(false)}
        onConfirm={confirmarSalvar}
      />
    </div>
  );
}

function novaPessoa(areaId: string): Pessoa {
  return {
    id: novoId("p"),
    nome: "",
    nomeCompleto: "",
    cargo: "",
    email: "",
    foto: "",
    areaId,
    ordem: 999,
  };
}

function Conector() {
  return <span className="block h-7 w-px bg-border" />;
}

function AreaBloco({
  area,
  pessoas,
  editando,
  onEditArea,
  onRemoveArea,
  onMoveArea,
  onAddPessoa,
  onEditPessoa,
  onRemovePessoa,
  onMovePessoa,
}: {
  area: Area;
  pessoas: Pessoa[];
  editando: boolean;
  onEditArea: () => void;
  onRemoveArea: () => void;
  onMoveArea: (delta: number) => void;
  onAddPessoa: () => void;
  onEditPessoa: (p: Pessoa) => void;
  onRemovePessoa: (p: Pessoa) => void;
  onMovePessoa: (p: Pessoa, delta: number) => void;
}) {
  return (
    <div
      className="print-avoid-break w-full flex-1 overflow-hidden rounded-2xl border bg-background/40"
      style={{ borderColor: `color-mix(in oklab, ${area.cor} 35%, var(--color-border))` }}
    >
      <div
        className="flex items-start justify-between gap-3 px-5 py-3.5"
        style={{
          background: `linear-gradient(90deg, color-mix(in oklab, ${area.cor} 16%, transparent), transparent)`,
        }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: area.cor }} />
            <h2 className="font-display text-base font-bold">{area.nome || "Nova área"}</h2>
            <span className="chip">
              {pessoas.length} {pessoas.length === 1 ? "pessoa" : "pessoas"}
            </span>
          </div>
          {area.descricao && <p className="mt-1 text-xs text-muted-foreground">{area.descricao}</p>}
        </div>
        {editando && (
          <div className="flex shrink-0 items-center gap-1">
            <IconBtn title="Mover para a esquerda" onClick={() => onMoveArea(-1)}>
              <ArrowLeft className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn title="Mover para a direita" onClick={() => onMoveArea(1)}>
              <ArrowRight className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn title="Editar área" onClick={onEditArea}>
              <Pencil className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn title="Excluir área" onClick={onRemoveArea} danger>
              <Trash2 className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
        )}
      </div>

      <div className="p-4">
        {pessoas.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
            Nenhuma pessoa nesta área.
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-2.5">
            {pessoas.map((pessoa) => (
              <PessoaCard
                key={pessoa.id}
                pessoa={pessoa}
                cor={area.cor}
                editando={editando}
                onEdit={() => onEditPessoa(pessoa)}
                onRemove={() => onRemovePessoa(pessoa)}
                onMove={(d) => onMovePessoa(pessoa, d)}
              />
            ))}
          </div>
        )}
        {editando && (
          <button
            type="button"
            onClick={onAddPessoa}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed p-2.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar pessoa em {area.nome || "nova área"}
          </button>
        )}
      </div>
    </div>
  );
}

function Avatar({ pessoa, cor, size }: { pessoa: Pessoa; cor: string; size: number }) {
  const url = fotoUrl(pessoa.foto);
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full bg-muted"
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 0 3px var(--color-card), 0 0 0 5px ${cor}`,
      }}
    >
      {url ? (
        <img src={url} alt={pessoa.nome} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-display font-bold text-white"
          style={{ background: cor, fontSize: size * 0.34 }}
        >
          {iniciais(pessoa.nomeCompleto || pessoa.nome) || "?"}
        </div>
      )}
    </div>
  );
}

/** Todos os cards têm o mesmo tamanho e mostram o cargo — ninguém em destaque. */
function PessoaCard({
  pessoa,
  cor,
  editando,
  onEdit,
  onRemove,
  onMove,
}: {
  pessoa: Pessoa;
  cor: string;
  editando: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  return (
    <div
      className={cn(
        "group relative flex w-[148px] flex-col items-center rounded-2xl border bg-card px-3 pb-3.5 pt-5 text-center shadow-sm transition",
        editando
          ? "cursor-pointer hover:border-primary/50"
          : "hover:-translate-y-0.5 hover:shadow-md",
      )}
      style={{ minHeight: 212 }}
      onClick={editando ? onEdit : undefined}
    >
      <span
        className="absolute inset-x-8 top-0 h-[3px] rounded-b-full"
        style={{ background: cor }}
      />
      <Avatar pessoa={pessoa} cor={cor} size={74} />
      <div className="mt-3 font-display text-sm font-bold leading-tight">
        {pessoa.nome || "Sem nome"}
      </div>
      {pessoa.nomeCompleto && pessoa.nomeCompleto !== pessoa.nome && (
        <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
          {pessoa.nomeCompleto}
        </div>
      )}
      {pessoa.cargo && (
        <div
          className="mt-auto rounded-lg px-2 py-1 text-[10.5px] font-semibold leading-snug"
          style={{
            color: cor,
            background: `color-mix(in oklab, ${cor} 12%, transparent)`,
          }}
        >
          {pessoa.cargo}
        </div>
      )}
      {editando && (
        <div
          className="absolute -top-3 right-1 flex gap-1 opacity-0 transition group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <IconBtn title="Antes" onClick={() => onMove(-1)}>
            <ArrowLeft className="h-3 w-3" />
          </IconBtn>
          <IconBtn title="Depois" onClick={() => onMove(1)}>
            <ArrowRight className="h-3 w-3" />
          </IconBtn>
          <IconBtn title="Remover" onClick={onRemove} danger>
            <X className="h-3 w-3" />
          </IconBtn>
        </div>
      )}
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-md border bg-popover text-muted-foreground shadow-sm transition hover:text-foreground",
        danger && "hover:border-destructive/50 hover:text-destructive",
      )}
    >
      {children}
    </button>
  );
}

function PessoaDialog({
  pessoa,
  org,
  onClose,
  onSave,
}: {
  pessoa: Pessoa | null;
  org: OrgData;
  onClose: () => void;
  onSave: (p: Pessoa) => void;
}) {
  const [form, setForm] = useState<Pessoa | null>(pessoa);
  const [enviando, setEnviando] = useState(false);
  const upload = useServerFn(uploadOrgFoto);
  const fileRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => setForm(pessoa), [pessoa]);

  const cargos = useMemo(
    () => [...new Set(org.pessoas.map((p) => p.cargo).filter(Boolean))].sort(),
    [org],
  );

  if (!form) return null;
  const set = (patch: Partial<Pessoa>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const isNova = !org.pessoas.some((p) => p.id === form.id);

  const trocarFoto = async (file: File) => {
    setEnviando(true);
    try {
      const dataUrl = await redimensionarFoto(file);
      const { fileId } = await upload({ data: { base64: dataUrl, nome: form.nome || form.id } });
      set({ foto: `drive:${fileId}` });
      toast.success("Foto enviada. Salve o organograma para manter a alteração.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar a foto.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNova ? "Nova pessoa" : `Editar ${form.nome}`}</DialogTitle>
          <DialogDescription>
            As alterações só vão para a planilha quando você clicar em Salvar.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-4">
          <Avatar pessoa={form} cor="var(--color-primary)" size={72} />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) trocarFoto(f);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={enviando}
              onClick={() => fileRef.current?.click()}
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {form.foto ? "Trocar foto" : "Enviar foto"}
            </Button>
            {form.foto && (
              <Button size="sm" variant="ghost" onClick={() => set({ foto: "" })}>
                Usar iniciais
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Nome de exibição</Label>
            <Input
              value={form.nome}
              onChange={(e) => set({ nome: e.target.value })}
              placeholder="Ex.: Ana Keila"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input
              value={form.nomeCompleto}
              onChange={(e) => set({ nomeCompleto: e.target.value })}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Cargo</Label>
            <Input
              value={form.cargo}
              onChange={(e) => set({ cargo: e.target.value })}
              list="cargos-org"
              placeholder="Ex.: Inspetor de Produto - Fornecedor"
            />
            <datalist id="cargos-org">
              {cargos.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Área / nível</Label>
            <Select value={form.areaId} onValueChange={(v) => set({ areaId: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={LIDERANCA}>Liderança (topo)</SelectItem>
                {org.areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome || "Nova área"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              type="email"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!form.nome.trim() || enviando}
            onClick={() =>
              onSave({
                ...form,
                nome: form.nome.trim(),
                nomeCompleto: form.nomeCompleto.trim() || form.nome.trim(),
              })
            }
          >
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AreaDialog({
  area,
  onClose,
  onSave,
}: {
  area: Area | null;
  onClose: () => void;
  onSave: (a: Area) => void;
}) {
  const [form, setForm] = useState<Area | null>(area);
  useEffect(() => setForm(area), [area]);
  if (!form) return null;
  const set = (patch: Partial<Area>) => setForm((f) => (f ? { ...f, ...patch } : f));
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{form.nome ? `Área ${form.nome}` : "Nova área"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => set({ nome: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              value={form.descricao}
              onChange={(e) => set({ descricao: e.target.value })}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex items-center gap-2">
              {["#E30613", "#2563EB", "#059669", "#D97706", "#7C3AED", "#0EA5E9", "#475569"].map(
                (c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set({ cor: c })}
                    className={cn(
                      "h-7 w-7 rounded-full border",
                      form.cor === c &&
                        "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                    )}
                    style={{ background: c }}
                    aria-label={`Cor ${c}`}
                  />
                ),
              )}
              <input
                type="color"
                value={form.cor}
                onChange={(e) => set({ cor: e.target.value })}
                className="h-7 w-9"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!form.nome.trim()}
            onClick={() => onSave({ ...form, nome: form.nome.trim() })}
          >
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SalvarDialog({
  open,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (autor: string) => void;
}) {
  const [autor, setNome] = useState("");
  useEffect(() => {
    if (open) setNome(getAutor());
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Salvar organograma</DialogTitle>
          <DialogDescription>
            A alteração fica registrada na aba ORGANOGRAMA e na auditoria.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Seu nome</Label>
          <Input value={autor} onChange={(e) => setNome(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!autor.trim() || busy}
            onClick={() => onConfirm(autor.trim())}
            className="gap-2"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
