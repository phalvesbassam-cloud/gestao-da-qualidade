// Identificação de PCD no organograma, por tipo de deficiência, com ícones
// próprios para cada caso (em vez de um único símbolo genérico).
import {
  Brain,
  Ear,
  Eye,
  Flower2,
  Infinity as InfinityIcon,
  PersonStanding,
  Shapes,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export type PcdTipo =
  | "auditiva"
  | "visual"
  | "fisica"
  | "intelectual"
  | "tea"
  | "multipla"
  | "oculta";

export const PCD_TIPOS: {
  id: PcdTipo;
  label: string;
  descricao: string;
  icon: ComponentType<{ className?: string }>;
  cor: string;
}[] = [
  {
    id: "auditiva",
    label: "Auditiva",
    descricao: "Surdez ou baixa audição",
    icon: Ear,
    cor: "#0ea5e9",
  },
  {
    id: "visual",
    label: "Visual",
    descricao: "Cegueira ou baixa visão",
    icon: Eye,
    cor: "#8b5cf6",
  },
  {
    id: "fisica",
    label: "Física",
    descricao: "Deficiência física ou motora",
    icon: PersonStanding,
    cor: "#10b981",
  },
  {
    id: "intelectual",
    label: "Intelectual",
    descricao: "Deficiência intelectual",
    icon: Brain,
    cor: "#f59e0b",
  },
  {
    id: "tea",
    label: "TEA",
    descricao: "Transtorno do Espectro Autista",
    icon: InfinityIcon,
    cor: "#ec4899",
  },
  {
    id: "multipla",
    label: "Múltipla",
    descricao: "Mais de um tipo de deficiência",
    icon: Shapes,
    cor: "#14b8a6",
  },
  {
    id: "oculta",
    label: "Não visível",
    descricao: "Deficiência não aparente (girassol)",
    icon: Flower2,
    cor: "#eab308",
  },
];

export function pcdInfo(tipo?: string) {
  return PCD_TIPOS.find((t) => t.id === tipo) ?? null;
}

/** Selo exibido no card da pessoa. */
export function PcdSelo({
  tipo,
  observacao,
  className,
}: {
  tipo?: string;
  observacao?: string;
  className?: string;
}) {
  const info = pcdInfo(tipo);
  const Icon = info?.icon ?? Flower2;
  const cor = info?.cor ?? "#0ea5e9";
  const titulo = [
    "Pessoa com deficiência (PCD)",
    info ? `${info.label} — ${info.descricao}` : "",
    observacao ?? "",
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <span
      title={titulo}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold",
        className,
      )}
      style={{
        color: cor,
        borderColor: `color-mix(in oklab, ${cor} 45%, transparent)`,
        background: `color-mix(in oklab, ${cor} 12%, transparent)`,
      }}
    >
      <Icon className="h-3 w-3" />
      PCD{info ? ` · ${info.label}` : ""}
    </span>
  );
}
