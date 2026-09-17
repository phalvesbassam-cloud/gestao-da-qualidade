import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { generatePresentationPptx } from "@/lib/presentation-pptx";
import { preparePresentationQualiAI } from "@/lib/quali-ai.functions";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  FilePlus2,
  Loader2,
  Presentation,
  Sparkles,
  X,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PresentationSlidePreview } from "@/components/presentation-slide-preview";
import { usePresentation } from "@/contexts/presentation-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/apresentacao")({
  component: PresentationEditorPage,
});

function PresentationEditorPage() {
  const router = useRouter();

  const {
    slides,
    updateSlide,
    removeSlide,
    moveSlideUp,
    moveSlideDown,
    addManualSlide,
    setPresentationSlides,
  } = usePresentation();

  const [activeSlideId, setActiveSlideId] = useState<string | null>(
    slides[0]?.id ?? null,
  );

  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPreset, setAiPreset] = useState<
    "diaria" | "mensal" | "fornecedor" | null
  >(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const activeSlide =
    slides.find((slide) => slide.id === activeSlideId) ??
    slides[0] ??
    null;

  const activeIndex = activeSlide
    ? slides.findIndex((slide) => slide.id === activeSlide.id)
    : -1;

  useEffect(() => {
    if (slides.length === 0) {
      setActiveSlideId(null);
      return;
    }

    const stillExists = slides.some(
      (slide) => slide.id === activeSlideId,
    );

    if (!stillExists) {
      setActiveSlideId(slides[0].id);
    }
  }, [slides, activeSlideId]);

  const handleBack = () => {
    router.navigate({
      to: "/",
    });
  };

  const handleAddManualSlide = () => {
    addManualSlide();
  };

  const handleGeneratePowerPoint = async () => {
  if (slides.length === 0) return;

  try {
    await generatePresentationPptx(slides);
  } catch (error) {
    console.error("Erro ao gerar PowerPoint:", error);
  }
};

  const handlePrepareWithQualiAI = async () => {
    if (slides.length === 0 || aiLoading) return;

    setAiLoading(true);
    setAiError(null);

    try {
      const result = await preparePresentationQualiAI({
        data: {
          prompt: aiPrompt.trim(),
          preset: aiPreset,
          slides: slides.map((slide) => ({
            id: slide.id,
            title: slide.title,
            subtitle: slide.subtitle,
            type: slide.type,
            sourceRoute: slide.sourceRoute,
            data: slide.data,
          })),
        },
      });

      const plan = result.plan;

      const titleUpdates = new Map(
        plan.titleUpdates.map((update) => [update.id, update]),
      );

      const existingById = new Map(
        slides.map((slide) => [slide.id, slide]),
      );

      // Reconstrói os slides EXISTENTES a partir dos IDs.
      // Os dados originais nunca vêm da IA e nunca são substituídos.
      const orderedExisting = plan.orderedSlideIds
        .map((id) => {
          const original = existingById.get(id);
          if (!original) return null;

          const update = titleUpdates.get(id);

          return {
            ...original,
            title: update?.title?.trim() || original.title,
            subtitle:
              update?.subtitle?.trim() || original.subtitle || "",
          };
        })
        .filter((slide): slide is NonNullable<typeof slide> => Boolean(slide));

      const stamp = Date.now();

      const supportSlides = plan.supportSlides.map((support, index) => ({
        id: `qualiai-${stamp}-${index}`,
        title: support.title,
        subtitle: support.subtitle,
        notes: support.notes,
        type: "ai-summary" as const,
        sourceRoute: "/apresentacao",
        data: {
          generatedBy: "QualiAI",
          content: support.notes,
        },
      }));

      const startSlides = supportSlides.filter(
        (_, index) => plan.supportSlides[index]?.position === "start",
      );

      const endSlides = supportSlides.filter(
        (_, index) => plan.supportSlides[index]?.position === "end",
      );

      const finalSlides = [
        ...startSlides,
        ...orderedExisting,
        ...endSlides,
      ];

      setPresentationSlides(finalSlides);
      setActiveSlideId(finalSlides[0]?.id ?? null);
      setAiOpen(false);
    } catch (error) {
      console.error("Erro ao preparar apresentação com QualiAI:", error);
      setAiError(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar a apresentação.",
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleRemoveSlide = (id: string) => {
    const index = slides.findIndex((slide) => slide.id === id);

    const nextSlide =
      slides[index + 1] ??
      slides[index - 1] ??
      null;

    removeSlide(id);

    if (activeSlideId === id) {
      setActiveSlideId(nextSlide?.id ?? null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-primary/10 text-primary">
            <Presentation className="h-5 w-5" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">
                Editor de Apresentação
              </h2>

              <Badge variant="secondary">
                {slides.length}{" "}
                {slides.length === 1 ? "slide" : "slides"}
              </Badge>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Organize, edite e prepare os conteúdos antes de gerar o
              PowerPoint.
            </p>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao QualiHub
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setAiError(null);
              setAiOpen(true);
            }}
            disabled={slides.length === 0}
            className="gap-2 border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
          >
            <Sparkles className="h-4 w-4" />
            Criar com QualiAI
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleAddManualSlide}
            className="gap-2"
          >
            <FilePlus2 className="h-4 w-4" />
            Novo slide
          </Button>

<Button
  type="button"
  onClick={handleGeneratePowerPoint}
  disabled={slides.length === 0}
  className="gap-2"
>
  <Presentation className="h-4 w-4" />
  Gerar PowerPoint
</Button>
        </div>
      </div>

      {/* Estado vazio */}
      {slides.length === 0 ? (
        <div className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl border border-dashed bg-card/40 px-6 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Presentation className="h-8 w-8" />
          </div>

          <h3 className="text-xl font-semibold">
            Nenhum conteúdo na apresentação
          </h3>

          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Volte ao QualiHub e use o botão "Criar apresentação" para
            selecionar gráficos, indicadores e outros conteúdos.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              onClick={handleBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Selecionar conteúdos
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleAddManualSlide}
              className="gap-2"
            >
              <FilePlus2 className="h-4 w-4" />
              Criar slide manual
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid min-h-[720px] overflow-hidden rounded-2xl border bg-card shadow-sm xl:grid-cols-[280px_minmax(0,1fr)]">
          {/* COLUNA ESQUERDA */}
          <aside className="border-b bg-muted/10 xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-sm font-semibold">
                  Slides
                </div>

                <div className="text-[11px] text-muted-foreground">
                  {slides.length} na apresentação
                </div>
              </div>

              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={handleAddManualSlide}
                title="Novo slide"
              >
                <FilePlus2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[680px] space-y-3 overflow-y-auto p-3">
              {slides.map((slide, index) => {
                const selected =
                  activeSlide?.id === slide.id;

                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() =>
                      setActiveSlideId(slide.id)
                    }
                    className={cn(
                      "group w-full rounded-xl border p-2 text-left transition-all",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-background hover:border-primary/40 hover:bg-muted/20",
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                        {slide.title || "Slide sem título"}
                      </div>
                    </div>

                    {/* Miniatura */}
                    <div className="pointer-events-none overflow-hidden rounded-md border bg-background">
                      <div className="origin-top-left">
                        <PresentationSlidePreview
                          slide={slide}
                        />
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="truncate text-[9px] text-muted-foreground">
                        {slide.type === "manual"
                          ? "Manual"
                          : slide.sourceRoute ?? "QualiHub"}
                      </span>

                      <Badge
                        variant="outline"
                        className="h-5 px-1.5 text-[8px]"
                      >
                        {slide.type}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* ÁREA PRINCIPAL */}
          {activeSlide && (
            <section className="min-w-0">
              {/* Barra do slide ativo */}
              <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 px-5 py-3">
                <div className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-primary/10 px-2 text-xs font-bold text-primary">
                  {activeIndex + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {activeSlide.title ||
                      "Slide sem título"}
                  </div>

                  <div className="text-[10px] text-muted-foreground">
                    {activeSlide.type === "manual"
                      ? "Slide manual"
                      : `Origem: ${
                          activeSlide.sourceRoute ??
                          "QualiHub"
                        }`}
                  </div>
                </div>

                <Badge variant="outline">
                  {activeSlide.type}
                </Badge>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={activeIndex === 0}
                    onClick={() =>
                      moveSlideUp(activeSlide.id)
                    }
                    title="Mover slide para cima"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={
                      activeIndex === slides.length - 1
                    }
                    onClick={() =>
                      moveSlideDown(activeSlide.id)
                    }
                    title="Mover slide para baixo"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      handleRemoveSlide(activeSlide.id)
                    }
                    className="text-destructive hover:text-destructive"
                    title="Excluir slide"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-6 p-5 2xl:grid-cols-[minmax(0,1.45fr)_380px]">
                {/* Preview grande */}
                <div className="min-w-0">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Visualização
                    </span>

                    <span className="text-[10px] text-muted-foreground">
                      16:9
                    </span>
                  </div>

                  <div className="flex min-h-[430px] items-center justify-center rounded-xl border bg-muted/20 p-5">
                    <div className="w-full max-w-5xl">
                      <PresentationSlidePreview
                        slide={activeSlide}
                      />
                    </div>
                  </div>
                </div>

                {/* Propriedades */}
                <div className="min-w-0">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Propriedades do slide
                  </div>

                  <div className="space-y-5 rounded-xl border bg-background p-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">
                        Título
                      </label>

                      <input
                        type="text"
                        value={activeSlide.title}
                        onChange={(event) =>
                          updateSlide(activeSlide.id, {
                            title: event.target.value,
                          })
                        }
                        placeholder="Título do slide"
                        className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">
                        Subtítulo
                      </label>

                      <input
                        type="text"
                        value={activeSlide.subtitle ?? ""}
                        onChange={(event) =>
                          updateSlide(activeSlide.id, {
                            subtitle: event.target.value,
                          })
                        }
                        placeholder="Subtítulo opcional"
                        className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">
                        Observações
                      </label>

                      <textarea
                        value={activeSlide.notes}
                        onChange={(event) =>
                          updateSlide(activeSlide.id, {
                            notes: event.target.value,
                          })
                        }
                        placeholder="Adicione comentários, destaques ou informações para a reunião..."
                        rows={8}
                        className="w-full resize-y rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Tipo de conteúdo
                      </div>

                      <div className="mt-1 text-sm font-medium">
                        {activeSlide.type}
                      </div>

                      {activeSlide.sourceRoute && (
                        <>
                          <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Origem
                          </div>

                          <div className="mt-1 text-sm font-medium">
                            {activeSlide.sourceRoute}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {aiOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAiOpen(false);
          }}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border bg-background shadow-2xl">
            <div className="flex items-start gap-3 border-b p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold">
                  Criar apresentação com QualiAI
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Organize a narrativa da reunião sem alterar os dados originais do QualiHub.
                </p>
              </div>

              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setAiOpen(false)}
                disabled={aiLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tipo de reunião
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    ["diaria", "Reunião Diária"],
                    ["mensal", "Reunião Mensal"],
                    ["fornecedor", "Fornecedor"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setAiPreset(value as "diaria" | "mensal" | "fornecedor")
                      }
                      className={cn(
                        "rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors",
                        aiPreset === value
                          ? "border-primary bg-primary/10 text-primary"
                          : "bg-card hover:border-primary/40",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  O que você quer apresentar?
                </label>

                <textarea
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  rows={5}
                  placeholder="Ex.: Prepare minha reunião mensal destacando eficiência, NC, PPM, Pareto e QLD/QLDE. Termine com pontos de atenção e próximos passos."
                  className="w-full resize-y rounded-xl border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {aiError && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  {aiError}
                </div>
              )}

              <div className="rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground">
                <strong className="text-foreground">Proteção dos indicadores:</strong>{" "}
                os valores e dados estruturados dos slides existentes são preservados.
                O QualiAI atua na organização, narrativa e slides de apoio.
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t bg-muted/10 p-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAiOpen(false)}
                disabled={aiLoading}
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={handlePrepareWithQualiAI}
                disabled={aiLoading}
                className="gap-2"
              >
                {aiLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {aiLoading
                  ? "QualiAI preparando..."
                  : "Preparar apresentação"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}