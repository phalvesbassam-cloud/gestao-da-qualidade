import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { textSpec, type SlideSpec, type SlideTheme } from "@/lib/slide-spec";

export type PresentationItemType =
  | "chart"
  | "kpi"
  | "kpi-group"
  | "table"
  | "text"
  | "section"
  | "timeline"
  | "ranking"
  | "ai-summary";

export type PresentationItem = {
  id: string;
  title: string;
  subtitle?: string;
  type: PresentationItemType;
  sourceRoute: string;
  /** Conteúdo estruturado do slide (ver src/lib/slide-spec.ts). */
  spec?: SlideSpec;
  /** Dados brutos (compatibilidade e contexto para o QualiAI). */
  data?: unknown;
};

export type PresentationSlide = {
  id: string;
  itemId?: string;
  title: string;
  subtitle?: string;
  notes: string;
  type: PresentationItemType | "manual" | "cover";
  sourceRoute?: string;
  spec?: SlideSpec;
  data?: unknown;
};

export type DeckSettings = {
  title: string;
  subtitle: string;
  theme: SlideTheme;
  cover: boolean;
  closing: boolean;
};

const DEFAULT_DECK: DeckSettings = {
  title: "Reunião da Qualidade",
  subtitle: "Gestão da Qualidade de Fornecedores",
  theme: "dark",
  cover: true,
  closing: true,
};

type PresentationContextValue = {
  selecting: boolean;
  selectedItems: PresentationItem[];
  slides: PresentationSlide[];
  deck: DeckSettings;

  startSelection: () => void;
  cancelSelection: () => void;
  finishSelection: () => void;

  addItem: (item: PresentationItem) => void;
  removeItem: (id: string) => void;
  toggleItem: (item: PresentationItem) => void;
  isSelected: (id: string) => boolean;

  updateSlide: (
    id: string,
    patch: Partial<Pick<PresentationSlide, "title" | "subtitle" | "notes" | "spec">>,
  ) => void;
  removeSlide: (id: string) => void;
  duplicateSlide: (id: string) => void;
  moveSlide: (id: string, toIndex: number) => void;
  moveSlideUp: (id: string) => void;
  moveSlideDown: (id: string) => void;
  addManualSlide: () => string;
  setPresentationSlides: (slides: PresentationSlide[]) => void;
  setDeck: (patch: Partial<DeckSettings>) => void;
  clearSlides: () => void;
};

const PresentationContext = createContext<PresentationContextValue | null>(null);

const STORAGE_KEY = "qf-presentation-v2";

function toSlide(item: PresentationItem, index: number): PresentationSlide {
  return {
    id: `slide-${Date.now()}-${index}-${item.id}`,
    itemId: item.id,
    title: item.title,
    subtitle: item.subtitle,
    notes: "",
    type: item.type,
    sourceRoute: item.sourceRoute,
    spec: item.spec,
    data: item.data,
  };
}

export function PresentationProvider({ children }: { children: ReactNode }) {
  const [selecting, setSelecting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<PresentationItem[]>([]);
  const [slides, setSlides] = useState<PresentationSlide[]>([]);
  const [deck, setDeckState] = useState<DeckSettings>(DEFAULT_DECK);
  const [restored, setRestored] = useState(false);

  // A apresentação em edição sobrevive a um recarregar de página.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { slides?: PresentationSlide[]; deck?: DeckSettings };
        if (Array.isArray(saved.slides)) setSlides(saved.slides);
        if (saved.deck) setDeckState({ ...DEFAULT_DECK, ...saved.deck });
      }
    } catch {
      /* armazenamento indisponível */
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ slides, deck }));
    } catch {
      /* armazenamento cheio/indisponível: segue só em memória */
    }
  }, [slides, deck, restored]);

  const startSelection = useCallback(() => {
    // Recomeça a seleção a partir do que já está na apresentação.
    setSelectedItems([]);
    setSelecting(true);
  }, []);

  const cancelSelection = useCallback(() => {
    setSelectedItems([]);
    setSelecting(false);
  }, []);

  const finishSelection = useCallback(() => {
    setSlides((current) => [...current, ...selectedItems.map(toSlide)]);
    setSelectedItems([]);
    setSelecting(false);
  }, [selectedItems]);

  const addItem = useCallback((item: PresentationItem) => {
    setSelectedItems((current) =>
      current.some((e) => e.id === item.id) ? current : [...current, item],
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setSelectedItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toggleItem = useCallback((item: PresentationItem) => {
    setSelectedItems((current) =>
      current.some((e) => e.id === item.id)
        ? current.filter((e) => e.id !== item.id)
        : [...current, item],
    );
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedItems.some((item) => item.id === id),
    [selectedItems],
  );

  const updateSlide = useCallback<PresentationContextValue["updateSlide"]>((id, patch) => {
    setSlides((current) =>
      current.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)),
    );
  }, []);

  const removeSlide = useCallback((id: string) => {
    setSlides((current) => current.filter((slide) => slide.id !== id));
  }, []);

  const duplicateSlide = useCallback((id: string) => {
    setSlides((current) => {
      const i = current.findIndex((s) => s.id === id);
      if (i < 0) return current;
      const copy = {
        ...current[i],
        id: `${current[i].id}-copia-${Date.now()}`,
        title: `${current[i].title} (cópia)`,
      };
      return [...current.slice(0, i + 1), copy, ...current.slice(i + 1)];
    });
  }, []);

  const moveSlide = useCallback((id: string, toIndex: number) => {
    setSlides((current) => {
      const from = current.findIndex((s) => s.id === id);
      if (from < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved);
      return next;
    });
  }, []);

  const moveSlideUp = useCallback(
    (id: string) =>
      setSlides((c) => {
        const i = c.findIndex((s) => s.id === id);
        if (i <= 0) return c;
        const n = [...c];
        [n[i - 1], n[i]] = [n[i], n[i - 1]];
        return n;
      }),
    [],
  );

  const moveSlideDown = useCallback(
    (id: string) =>
      setSlides((c) => {
        const i = c.findIndex((s) => s.id === id);
        if (i < 0 || i >= c.length - 1) return c;
        const n = [...c];
        [n[i], n[i + 1]] = [n[i + 1], n[i]];
        return n;
      }),
    [],
  );

  const addManualSlide = useCallback(() => {
    const id = `manual-${Date.now()}`;
    setSlides((current) => [
      ...current,
      {
        id,
        title: "Novo slide",
        subtitle: "",
        notes: "",
        type: "manual",
        spec: textSpec(["Primeiro ponto", "Segundo ponto", "Próximos passos"]),
      },
    ]);
    return id;
  }, []);

  const setPresentationSlides = useCallback(
    (newSlides: PresentationSlide[]) => setSlides(newSlides),
    [],
  );
  const setDeck = useCallback(
    (patch: Partial<DeckSettings>) => setDeckState((d) => ({ ...d, ...patch })),
    [],
  );

  const clearSlides = useCallback(() => {
    setSlides([]);
    setSelectedItems([]);
  }, []);

  const value = useMemo<PresentationContextValue>(
    () => ({
      selecting,
      selectedItems,
      slides,
      deck,
      startSelection,
      cancelSelection,
      finishSelection,
      addItem,
      removeItem,
      toggleItem,
      isSelected,
      updateSlide,
      removeSlide,
      duplicateSlide,
      moveSlide,
      moveSlideUp,
      moveSlideDown,
      addManualSlide,
      setPresentationSlides,
      setDeck,
      clearSlides,
    }),
    [
      selecting,
      selectedItems,
      slides,
      deck,
      startSelection,
      cancelSelection,
      finishSelection,
      addItem,
      removeItem,
      toggleItem,
      isSelected,
      updateSlide,
      removeSlide,
      duplicateSlide,
      moveSlide,
      moveSlideUp,
      moveSlideDown,
      addManualSlide,
      setPresentationSlides,
      setDeck,
      clearSlides,
    ],
  );

  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>;
}

export function usePresentation() {
  const context = useContext(PresentationContext);
  if (!context) throw new Error("usePresentation deve ser usado dentro de PresentationProvider.");
  return context;
}
