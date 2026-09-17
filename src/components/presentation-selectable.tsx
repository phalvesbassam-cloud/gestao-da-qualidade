import type { ReactNode } from "react";
import { Check, Plus, Presentation } from "lucide-react";

import {
  usePresentation,
  type PresentationItem,
} from "@/contexts/presentation-context";

import { cn } from "@/lib/utils";

type PresentationSelectableProps = {
  item: PresentationItem;
  children: ReactNode;
  className?: string;
};

export function PresentationSelectable({
  item,
  children,
  className,
}: PresentationSelectableProps) {
  const {
    selecting,
    toggleItem,
    isSelected,
  } = usePresentation();

  const selected = isSelected(item.id);

  if (!selecting) {
    return <>{children}</>;
  }

  return (
    <div
      className={cn(
        "group/presentation relative rounded-2xl transition-all",
        selected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
          : "ring-1 ring-transparent hover:ring-primary/50",
        className,
      )}
    >
      {children}

      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();

          toggleItem(item);
        }}
        className={cn(
          "absolute right-3 top-3 z-20 flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur-md transition-all",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background/95 text-foreground hover:border-primary hover:text-primary",
        )}
      >
        {selected ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Adicionado
          </>
        ) : (
          <>
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </>
        )}
      </button>

      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10 rounded-2xl transition-colors",
          selected
            ? "bg-primary/[0.03]"
            : "group-hover/presentation:bg-primary/[0.02]",
        )}
      />

      <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-full border bg-background/90 px-2.5 py-1 text-[10px] text-muted-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover/presentation:opacity-100">
        <Presentation className="h-3 w-3" />
        Conteúdo para apresentação
      </div>
    </div>
  );
}