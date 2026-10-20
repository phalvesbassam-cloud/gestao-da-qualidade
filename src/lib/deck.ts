import type { DeckSettings, PresentationSlide } from "@/contexts/presentation-context";
import { ensureSpec, type SlideSpec } from "@/lib/slide-spec";
import type { PptxSlideInput } from "@/lib/presentation-pptx";

export function coverSlide(deck: Pick<DeckSettings, "title" | "subtitle">): PptxSlideInput {
  const spec: SlideSpec = {
    type: "cover",
    title: deck.title || "Reunião da Qualidade",
    subtitle: deck.subtitle,
    meta: new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
  };
  return { title: spec.title, spec };
}

export function closingSlide(): PptxSlideInput {
  return {
    title: "Obrigado",
    spec: { type: "section", title: "Obrigado!", subtitle: "Dúvidas, decisões e próximos passos" },
  };
}

/** Monta a sequência final (capa + slides + encerramento) para apresentar ou exportar. */
export function buildDeck(slides: PresentationSlide[], deck: DeckSettings): PptxSlideInput[] {
  const body = slides.map((s) => ({
    title: s.title,
    subtitle: s.subtitle,
    notes: s.notes,
    spec: ensureSpec(s),
  }));
  return [
    ...(deck.cover ? [coverSlide(deck)] : []),
    ...body,
    ...(deck.closing ? [closingSlide()] : []),
  ];
}
