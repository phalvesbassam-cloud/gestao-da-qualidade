import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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
  data?: unknown;
};

export type PresentationSlide = {
  id: string;
  itemId?: string;
  title: string;
  subtitle?: string;
  notes: string;
  type: PresentationItemType | "manual";
  sourceRoute?: string;
  data?: unknown;
};

type PresentationContextValue = {
  selecting: boolean;
  selectedItems: PresentationItem[];
  slides: PresentationSlide[];

  startSelection: () => void;
  cancelSelection: () => void;
  finishSelection: () => void;

  addItem: (item: PresentationItem) => void;
  removeItem: (id: string) => void;
  toggleItem: (item: PresentationItem) => void;
  isSelected: (id: string) => boolean;

  updateSlide: (
    id: string,
    patch: Partial<Pick<PresentationSlide, "title" | "subtitle" | "notes">>,
  ) => void;

  removeSlide: (id: string) => void;
  moveSlideUp: (id: string) => void;
  moveSlideDown: (id: string) => void;
  addManualSlide: () => void;

  // Permite ao QualiAI substituir/reorganizar a apresentação inteira.
  setPresentationSlides: (slides: PresentationSlide[]) => void;

  clearSlides: () => void;
};

const PresentationContext =
  createContext<PresentationContextValue | null>(null);

export function PresentationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<PresentationItem[]>([]);
  const [slides, setSlides] = useState<PresentationSlide[]>([]);

  /**
   * Inicia uma nova seleção.
   */
  const startSelection = useCallback(() => {
    setSelectedItems([]);
    setSelecting(true);
  }, []);

  /**
   * Cancela a seleção atual.
   */
  const cancelSelection = useCallback(() => {
    setSelectedItems([]);
    setSelecting(false);
  }, []);

  /**
   * Finaliza a seleção e transforma cada conteúdo
   * selecionado em um slide editável.
   */
  const finishSelection = useCallback(() => {
    const generatedSlides: PresentationSlide[] = selectedItems.map(
      (item, index) => ({
        id: `slide-${Date.now()}-${index}-${item.id}`,
        itemId: item.id,
        title: item.title,
        subtitle: item.subtitle,
        notes: "",
        type: item.type,
        sourceRoute: item.sourceRoute,
        data: item.data,
      }),
    );

    setSlides(generatedSlides);
    setSelecting(false);
  }, [selectedItems]);

  const addItem = useCallback((item: PresentationItem) => {
    setSelectedItems((current) => {
      if (current.some((existing) => existing.id === item.id)) {
        return current;
      }

      return [...current, item];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setSelectedItems((current) =>
      current.filter((item) => item.id !== id),
    );
  }, []);

  const toggleItem = useCallback((item: PresentationItem) => {
    setSelectedItems((current) => {
      const exists = current.some(
        (existing) => existing.id === item.id,
      );

      if (exists) {
        return current.filter(
          (existing) => existing.id !== item.id,
        );
      }

      return [...current, item];
    });
  }, []);

  const isSelected = useCallback(
    (id: string) =>
      selectedItems.some((item) => item.id === id),
    [selectedItems],
  );

  /**
   * Atualiza título, subtítulo ou observações.
   */
  const updateSlide = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<PresentationSlide, "title" | "subtitle" | "notes">
      >,
    ) => {
      setSlides((current) =>
        current.map((slide) =>
          slide.id === id
            ? {
                ...slide,
                ...patch,
              }
            : slide,
        ),
      );
    },
    [],
  );

  /**
   * Exclui um slide do editor.
   */
  const removeSlide = useCallback((id: string) => {
    setSlides((current) =>
      current.filter((slide) => slide.id !== id),
    );
  }, []);

  /**
   * Move um slide uma posição para cima.
   */
  const moveSlideUp = useCallback((id: string) => {
    setSlides((current) => {
      const index = current.findIndex(
        (slide) => slide.id === id,
      );

      if (index <= 0) {
        return current;
      }

      const next = [...current];

      [next[index - 1], next[index]] = [
        next[index],
        next[index - 1],
      ];

      return next;
    });
  }, []);

  /**
   * Move um slide uma posição para baixo.
   */
  const moveSlideDown = useCallback((id: string) => {
    setSlides((current) => {
      const index = current.findIndex(
        (slide) => slide.id === id,
      );

      if (
        index === -1 ||
        index >= current.length - 1
      ) {
        return current;
      }

      const next = [...current];

      [next[index], next[index + 1]] = [
        next[index + 1],
        next[index],
      ];

      return next;
    });
  }, []);

  /**
   * Cria um slide totalmente manual.
   */
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
      },
    ]);
  }, []);

  /**
   * Substitui toda a estrutura da apresentação.
   *
   * Será usado pelo QualiAI para reorganizar slides existentes,
   * alterar títulos/subtítulos e adicionar slides de análise.
   */
  const setPresentationSlides = useCallback(
    (newSlides: PresentationSlide[]) => {
      setSlides(newSlides);
    },
    [],
  );

  /**
   * Limpa a apresentação atual.
   */
  const clearSlides = useCallback(() => {
    setSlides([]);
    setSelectedItems([]);
  }, []);

  const value = useMemo<PresentationContextValue>(
    () => ({
      selecting,
      selectedItems,
      slides,
      startSelection,
      cancelSelection,
      finishSelection,
      addItem,
      removeItem,
      toggleItem,
      isSelected,
      updateSlide,
      removeSlide,
      moveSlideUp,
      moveSlideDown,
      addManualSlide,
      setPresentationSlides,
      clearSlides,
    }),
    [
      selecting,
      selectedItems,
      slides,
      startSelection,
      cancelSelection,
      finishSelection,
      addItem,
      removeItem,
      toggleItem,
      isSelected,
      updateSlide,
      removeSlide,
      moveSlideUp,
      moveSlideDown,
      addManualSlide,
      setPresentationSlides,
      clearSlides,
    ],
  );

  return (
    <PresentationContext.Provider value={value}>
      {children}
    </PresentationContext.Provider>
  );
}

export function usePresentation() {
  const context = useContext(PresentationContext);

  if (!context) {
    throw new Error(
      "usePresentation deve ser usado dentro de PresentationProvider.",
    );
  }

  return context;
}
