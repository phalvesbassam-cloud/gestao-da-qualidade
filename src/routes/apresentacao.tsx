import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  Download,
  FilePlus2,
  GripVertical,
  Loader2,
  MonitorPlay,
  Moon,
  Plus,
  Presentation,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SlideCanvas, SlideFrame } from "@/components/slide-canvas";
import { SlidePresenter } from "@/components/slide-presenter";
import { usePresentation, type PresentationSlide } from "@/contexts/presentation-context";
import { buildDeck, closingSlide, coverSlide } from "@/lib/deck";
import { generatePresentationPptx } from "@/lib/presentation-pptx";
import { preparePresentationQualiAI } from "@/lib/quali-ai.functions";
import { ensureSpec, textSpec, type ChartKind, type SlideSpec } from "@/lib/slide-spec";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/apresentacao")({
  head: () => ({ meta: [{ title: "Editor de apresentação — QualiHub" }] }),
  component: PresentationEditorPage,
});

const CHART_KINDS: { value: ChartKind; label: string }[] = [
  { value: "line", label: "Linha" },
  { value: "area", label: "Área" },
  { value: "bar", label: "Colunas" },
  { value: "barH", label: "Barras" },
  { value: "stacked", label: "Empilhado" },
  { value: "doughnut", label: "Rosca" },
  { value: "pie", label: "Pizza" },
  { value: "combo", label: "Combinado" },
];

function PresentationEditorPage() {
  const router = useRouter();
  const p = usePresentation();
  const { slides, deck } = p;
  const [activeId, setActiveId] = useState<string | null>(slides[0]?.id ?? null);
  const [presenting, setPresenting] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    if (!slides.some((s) => s.id === activeId)) setActiveId(slides[0]?.id ?? null);
  }, [slides, activeId]);

  const active = slides.find((s) => s.id === activeId) ?? null;
  const activeIndex = active ? slides.indexOf(active) : -1;
  const fullDeck = useMemo(() => buildDeck(slides, deck), [slides, deck]);
  const dateLabel = new Date().toLocaleDateString("pt-BR");

  const addContent = () => {
    p.startSelection();
    router.navigate({ to: "/" });
  };

  const exportPptx = async () => {
    if (!slides.length) return;
    setExporting(true);
    try {
      await generatePresentationPptx(fullDeck, {
        theme: deck.theme,
        title: deck.title,
        fileName: `${(deck.title || "Apresentacao").replace(/[^\w\-À-ú ]+/g, "").trim()}.pptx`,
      });
      toast.success("PowerPoint gerado. Tudo nele é editável (textos, gráficos e tabelas).");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o PowerPoint.");
    } finally {
      setExporting(false);
    }
  };

  const presentFrom = (slideIndex: number) => setPresenting(slideIndex + (deck.cover ? 1 : 0));

  if (slides.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <section className="hero-panel p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Presentation className="h-7 w-7" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold">Monte sua apresentação</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Clique em <strong>Adicionar conteúdo</strong>, navegue pelas telas do QualiHub e use o
            botão <strong>Adicionar</strong> que aparece em cada card ou gráfico. Depois conclua a
            seleção para editar, apresentar em tela cheia ou baixar um PowerPoint 100% editável.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={addContent} className="gap-2">
              <Plus className="h-4 w-4" /> Adicionar conteúdo
            </Button>
            <Button
              variant="outline"
              onClick={() => setActiveId(p.addManualSlide())}
              className="gap-2"
            >
              <FilePlus2 className="h-4 w-4" /> Começar com slide de texto
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra superior */}
      <div className="surface flex flex-wrap items-center gap-3 px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => router.history.back()} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="min-w-[220px] flex-1">
          <Input
            value={deck.title}
            onChange={(e) => p.setDeck({ title: e.target.value })}
            className="h-9 border-transparent bg-transparent font-display text-lg font-semibold shadow-none focus-visible:border-input"
            aria-label="Título da apresentação"
          />
        </div>
        <div className="segmented">
          <button
            type="button"
            data-active={deck.theme === "dark"}
            onClick={() => p.setDeck({ theme: "dark" })}
          >
            <span className="inline-flex items-center gap-1">
              <Moon className="h-3 w-3" /> Escuro
            </span>
          </button>
          <button
            type="button"
            data-active={deck.theme === "light"}
            onClick={() => p.setDeck({ theme: "light" })}
          >
            <span className="inline-flex items-center gap-1">
              <Sun className="h-3 w-3" /> Claro
            </span>
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={addContent} className="gap-1.5">
          <Plus className="h-4 w-4" /> Adicionar conteúdo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActiveId(p.addManualSlide())}
          className="gap-1.5"
        >
          <FilePlus2 className="h-4 w-4" /> Slide de texto
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAiOpen(true)}
          className="gap-1.5 border-primary/30 text-primary"
        >
          <Sparkles className="h-4 w-4" /> Preparar com QualiAI
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setPresenting(0)} className="gap-1.5">
          <MonitorPlay className="h-4 w-4" /> Apresentar
        </Button>
        <Button size="sm" onClick={exportPptx} disabled={exporting} className="gap-1.5">
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Baixar PowerPoint
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[250px_1fr_320px]">
        {/* Miniaturas */}
        <aside className="surface max-h-[calc(100vh-180px)] overflow-y-auto p-3">
          <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span>Slides</span>
            <span>{fullDeck.length}</span>
          </div>
          <div className="space-y-2.5">
            {deck.cover && (
              <ThumbStatic
                label="Capa"
                theme={deck.theme}
                slide={coverSlide(deck)}
                onClick={() => setPresenting(0)}
              />
            )}
            {slides.map((s, i) => (
              <div
                key={s.id}
                draggable
                onDragStart={() => setDragId(s.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId && dragId !== s.id) p.moveSlide(dragId, i);
                  setDragId(null);
                }}
                onClick={() => setActiveId(s.id)}
                className={cn(
                  "group relative cursor-pointer rounded-xl border-2 p-1 transition",
                  s.id === activeId ? "border-primary" : "border-transparent hover:border-border",
                  dragId === s.id && "opacity-40",
                )}
              >
                <div className="pointer-events-none overflow-hidden rounded-lg border">
                  <SlideFrame>
                    <SlideCanvas
                      title={s.title}
                      subtitle={s.subtitle}
                      spec={ensureSpec(s)}
                      theme={deck.theme}
                      index={i + 1}
                      total={slides.length}
                    />
                  </SlideFrame>
                </div>
                <div className="mt-1 flex items-center gap-1.5 px-1 text-[11px]">
                  <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                  <span className="truncate">{s.title}</span>
                </div>
              </div>
            ))}
            {deck.closing && (
              <ThumbStatic
                label="Encerramento"
                theme={deck.theme}
                slide={closingSlide()}
                onClick={() => setPresenting(fullDeck.length - 1)}
              />
            )}
          </div>
        </aside>

        {/* Slide ativo */}
        <main className="space-y-3">
          {active && (
            <>
              <div className="overflow-hidden rounded-2xl border shadow-lg">
                <SlideFrame>
                  <SlideCanvas
                    title={active.title}
                    subtitle={active.subtitle}
                    spec={ensureSpec(active)}
                    theme={deck.theme}
                    index={activeIndex + 1}
                    total={slides.length}
                    dateLabel={dateLabel}
                  />
                </SlideFrame>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => p.moveSlideUp(active.id)}
                    disabled={activeIndex === 0}
                    title="Mover para cima"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => p.moveSlideDown(active.id)}
                    disabled={activeIndex === slides.length - 1}
                    title="Mover para baixo"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => p.duplicateSlide(active.id)}
                    title="Duplicar"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => p.removeSlide(active.id)}
                    title="Excluir slide"
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => presentFrom(activeIndex)}
                >
                  <MonitorPlay className="h-4 w-4" /> Apresentar a partir daqui
                </Button>
              </div>
            </>
          )}
        </main>

        {/* Propriedades */}
        <aside className="surface space-y-4 p-4">
          {active && (
            <SlideEditor slide={active} onChange={(patch) => p.updateSlide(active.id, patch)} />
          )}
          <div className="space-y-3 border-t pt-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Apresentação
            </div>
            <div className="space-y-1.5">
              <Label>Subtítulo da capa</Label>
              <Input
                value={deck.subtitle}
                onChange={(e) => p.setDeck({ subtitle: e.target.value })}
              />
            </div>
            <label className="flex items-center justify-between text-sm">
              Capa
              <Switch checked={deck.cover} onCheckedChange={(v) => p.setDeck({ cover: v })} />
            </label>
            <label className="flex items-center justify-between text-sm">
              Slide de encerramento
              <Switch checked={deck.closing} onCheckedChange={(v) => p.setDeck({ closing: v })} />
            </label>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive"
              onClick={() => {
                if (confirm("Remover todos os slides da apresentação?")) p.clearSlides();
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Limpar apresentação
            </Button>
          </div>
        </aside>
      </div>

      {presenting !== null && (
        <SlidePresenter
          slides={fullDeck}
          theme={deck.theme}
          startAt={Math.min(presenting, fullDeck.length - 1)}
          fileName={`${deck.title || "Apresentacao"}.pptx`}
          onClose={() => setPresenting(null)}
        />
      )}
      <QualiAIDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onDone={(firstId) => firstId && setActiveId(firstId)}
      />
    </div>
  );
}

function ThumbStatic({
  label,
  theme,
  slide,
  onClick,
}: {
  label: string;
  theme: "dark" | "light";
  slide: { title: string; spec: SlideSpec };
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl border-2 border-transparent p-1 opacity-80 hover:border-border"
    >
      <div className="pointer-events-none overflow-hidden rounded-lg border">
        <SlideFrame>
          <SlideCanvas title={slide.title} spec={slide.spec} theme={theme} />
        </SlideFrame>
      </div>
      <div className="mt-1 px-1 text-[11px] italic text-muted-foreground">{label}</div>
    </div>
  );
}

function SlideEditor({
  slide,
  onChange,
}: {
  slide: PresentationSlide;
  onChange: (
    patch: Partial<Pick<PresentationSlide, "title" | "subtitle" | "notes" | "spec">>,
  ) => void;
}) {
  const spec = ensureSpec(slide);
  return (
    <div className="space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Slide selecionado
      </div>
      <div className="space-y-1.5">
        <Label>Título</Label>
        <Input value={slide.title} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Subtítulo</Label>
        <Input
          value={slide.subtitle ?? ""}
          onChange={(e) => onChange({ subtitle: e.target.value })}
        />
      </div>

      {spec.type === "text" && (
        <div className="space-y-1.5">
          <Label>Tópicos (um por linha)</Label>
          <Textarea
            rows={7}
            value={spec.bullets.join("\n")}
            onChange={(e) =>
              onChange({ spec: { type: "text", bullets: e.target.value.split("\n") } })
            }
          />
        </div>
      )}

      {spec.type === "chart" && (
        <div className="space-y-2">
          <Label>Tipo de gráfico</Label>
          <div className="grid grid-cols-4 gap-1">
            {CHART_KINDS.filter((k) => k.value !== "combo" || spec.chart.kind === "combo").map(
              (k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() =>
                    onChange({ spec: { ...spec, chart: { ...spec.chart, kind: k.value } } })
                  }
                  className={cn(
                    "rounded-md border px-1.5 py-1 text-[11px] font-medium transition",
                    spec.chart.kind === k.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  {k.label}
                </button>
              ),
            )}
          </div>
          <label className="flex items-center justify-between text-sm">
            Mostrar valores
            <Switch
              checked={spec.chart.showValues ?? spec.chart.categories.length <= 14}
              onCheckedChange={(v) =>
                onChange({ spec: { ...spec, chart: { ...spec.chart, showValues: v } } })
              }
            />
          </label>
        </div>
      )}

      {spec.type === "kpis" && (
        <div className="space-y-2">
          <Label>Indicadores</Label>
          {spec.items.map((k, i) => (
            <div key={i} className="grid grid-cols-2 gap-1.5 rounded-lg border p-2">
              <Input
                value={k.label}
                className="h-8 text-xs"
                onChange={(e) => {
                  const items = spec.items.map((x, j) =>
                    j === i ? { ...x, label: e.target.value } : x,
                  );
                  onChange({ spec: { type: "kpis", items } });
                }}
              />
              <Input
                value={k.value}
                className="h-8 text-xs font-semibold"
                onChange={(e) => {
                  const items = spec.items.map((x, j) =>
                    j === i ? { ...x, value: e.target.value } : x,
                  );
                  onChange({ spec: { type: "kpis", items } });
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Anotações do apresentador</Label>
        <Textarea
          rows={3}
          value={slide.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Vão para as anotações do PowerPoint."
        />
      </div>
    </div>
  );
}

function QualiAIDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (firstId?: string) => void;
}) {
  const { slides, setPresentationSlides, setDeck } = usePresentation();
  const [prompt, setPrompt] = useState("");
  const [preset, setPreset] = useState<"diaria" | "mensal" | "fornecedor" | null>("mensal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const { plan } = await preparePresentationQualiAI({
        data: {
          prompt: prompt.trim(),
          preset,
          slides: slides.map((s) => ({
            id: s.id,
            title: s.title,
            subtitle: s.subtitle,
            type: s.type,
            sourceRoute: s.sourceRoute,
            data: s.spec ?? s.data,
          })),
        },
      });
      const updates = new Map(plan.titleUpdates.map((u) => [u.id, u]));
      const byId = new Map(slides.map((s) => [s.id, s]));
      const ordered = plan.orderedSlideIds
        .map((id) => byId.get(id))
        .filter((s): s is PresentationSlide => Boolean(s))
        .map((s) => {
          const u = updates.get(s.id);
          return {
            ...s,
            title: u?.title?.trim() || s.title,
            subtitle: u?.subtitle?.trim() || s.subtitle || "",
          };
        });
      const stamp = Date.now();
      const support = (pos: "start" | "end") =>
        plan.supportSlides
          .filter((x) => x.position === pos)
          .map((x, i) => ({
            id: `qualiai-${pos}-${stamp}-${i}`,
            title: x.title,
            subtitle: x.subtitle,
            notes: "",
            type: "ai-summary" as const,
            sourceRoute: "/apresentacao",
            spec: textSpec(x.notes),
          }));
      const final = [...support("start"), ...ordered, ...support("end")];
      setPresentationSlides(final);
      if (plan.presentationTitle)
        setDeck({ title: plan.presentationTitle, subtitle: plan.presentationSubtitle || "" });
      toast.success("Apresentação organizada pelo QualiAI.");
      onDone(final[0]?.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível preparar a apresentação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Preparar com QualiAI
          </DialogTitle>
          <DialogDescription>
            O QualiAI organiza a ordem, melhora títulos e cria slides de análise usando só os dados
            selecionados.
          </DialogDescription>
        </DialogHeader>
        <div className="segmented flex w-full">
          {(
            [
              ["diaria", "Reunião diária"],
              ["mensal", "Reunião mensal"],
              ["fornecedor", "Fornecedor"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="flex-1"
              data-active={preset === value}
              onClick={() => setPreset(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <Textarea
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ex.: comece pelos indicadores, destaque fornecedores críticos e feche com plano de ação."
        />
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={run} disabled={loading} className="gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}{" "}
            Preparar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
