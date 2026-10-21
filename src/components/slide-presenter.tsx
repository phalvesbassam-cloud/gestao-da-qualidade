// Modo apresentação em tela cheia (setas/espaço avançam, Esc sai).
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, Loader2, Maximize, Moon, Sun, X } from "lucide-react";
import { SlideCanvas, SlideFrame } from "@/components/slide-canvas";
import { generatePresentationPptx, type PptxSlideInput } from "@/lib/presentation-pptx";
import type { SlideTheme } from "@/lib/slide-spec";
import { cn } from "@/lib/utils";

export function SlidePresenter({
  slides,
  theme: initialTheme,
  startAt = 0,
  fileName,
  onClose,
}: {
  slides: PptxSlideInput[];
  theme: SlideTheme;
  startAt?: number;
  fileName?: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startAt);
  const [theme, setTheme] = useState<SlideTheme>(initialTheme);
  const [chrome, setChrome] = useState(true);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<number | null>(null);
  const dateLabel = new Date().toLocaleDateString("pt-BR");

  const contentSlides = slides.filter((s) => s.spec.type !== "cover" && s.spec.type !== "section");
  const numberOf = (i: number) => {
    const s = slides[i];
    if (!s || s.spec.type === "cover" || s.spec.type === "section") return undefined;
    return contentSlides.indexOf(s) + 1;
  };

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + delta))),
    [slides.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(slides.length - 1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, slides.length]);

  useEffect(() => {
    const el = rootRef.current;
    if (el && !document.fullscreenElement) el.requestFullscreen?.().catch(() => undefined);
    const onFs = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    };
  }, [onClose]);

  const poke = () => {
    setChrome(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChrome(false), 2600);
  };

  const download = async () => {
    setBusy(true);
    try {
      await generatePresentationPptx(slides, { theme, fileName });
    } finally {
      setBusy(false);
    }
  };

  const current = slides[index];
  if (!current) return null;

  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 z-[200] bg-black text-white"
      onMouseMove={poke}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        go(1);
      }}
    >
      <SlideFrame className="slide-fit-contain absolute inset-0">
        <SlideCanvas
          key={`${index}-${theme}`}
          title={current.title}
          subtitle={current.subtitle}
          spec={current.spec}
          theme={theme}
          index={numberOf(index)}
          total={contentSlides.length}
          dateLabel={dateLabel}
          animate
        />
      </SlideFrame>

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/80 to-transparent px-6 pb-5 pt-10 transition-opacity duration-300",
          chrome ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="flex items-center gap-2">
          <PresenterBtn title="Anterior (←)" onClick={() => go(-1)} disabled={index === 0}>
            <ChevronLeft className="h-5 w-5" />
          </PresenterBtn>
          <span className="min-w-[70px] text-center text-sm font-semibold tabular-nums">
            {index + 1} / {slides.length}
          </span>
          <PresenterBtn
            title="Próximo (→)"
            onClick={() => go(1)}
            disabled={index === slides.length - 1}
          >
            <ChevronRight className="h-5 w-5" />
          </PresenterBtn>
        </div>
        <div className="hidden max-w-[40%] truncate text-sm text-white/70 md:block">
          {current.title}
        </div>
        <div className="flex items-center gap-2">
          <PresenterBtn
            title={theme === "dark" ? "Tema claro" : "Tema escuro"}
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </PresenterBtn>
          <PresenterBtn
            title="Tela cheia"
            onClick={() => rootRef.current?.requestFullscreen?.().catch(() => undefined)}
          >
            <Maximize className="h-4 w-4" />
          </PresenterBtn>
          <PresenterBtn title="Baixar PowerPoint" onClick={download} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </PresenterBtn>
          <PresenterBtn title="Sair (Esc)" onClick={onClose}>
            <X className="h-4 w-4" />
          </PresenterBtn>
        </div>
      </div>

      {/* barra de progresso */}
      <div className="absolute inset-x-0 top-0 h-1 bg-white/10">
        <div
          className="h-full bg-[#E30613] transition-all duration-300"
          style={{ width: `${((index + 1) / slides.length) * 100}%` }}
        />
      </div>
    </div>,
    document.body,
  );
}

function PresenterBtn({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur transition hover:bg-white/20 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
