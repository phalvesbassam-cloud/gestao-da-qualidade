import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/dashboard-ui";
import { getAppConfig, saveAppConfig } from "@/lib/sheets.functions";
import { DEFAULT_NC_WEIGHTS, type NcWeights } from "@/lib/idf-calc";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Configurações — IR & Regras" }] }),
  component: AdminPage,
});

const WINDOW_PRESETS = [
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
  { label: "6 meses", days: 180 },
  { label: "1 ano", days: 365 },
  { label: "Todo histórico", days: 36500 },
];

function AdminPage() {
  const qc = useQueryClient();
  const fetchCfg = useServerFn(getAppConfig);
  const saveCfg = useServerFn(saveAppConfig);
  const { data } = useQuery({ queryKey: ["app-config"], queryFn: () => fetchCfg() });
  const [windowDays, setWindowDays] = useState(365);
  const [points, setPoints] = useState(5);
  const [statusFilter, setStatusFilter] = useState<"reprovado" | "reprovado+condicional">("reprovado");
  const [buckets, setBuckets] = useState<{ max: number; pct: number }[]>([]);
  const [weights, setWeights] = useState<NcWeights>(DEFAULT_NC_WEIGHTS);

  useEffect(() => {
    if (!data) return;
    setWindowDays(data.irWindowDays);
    setPoints(data.irPointsPerRecurrence);
    setStatusFilter(data.irStatusFilter);
    setBuckets(data.irBuckets);
    setWeights(data.ncWeights ?? DEFAULT_NC_WEIGHTS);
  }, [data]);

  const mut = useMutation({
    mutationFn: async () => {
      const { getCurrentAuthor } = await import("@/components/nota-edit-modal");
      const autor = getCurrentAuthor();
      if (!autor) {
        const n = window.prompt("Informe seu Nome:");
        const s = n ? window.prompt("Informe seu Sobrenome:") : null;
        if (!n?.trim() || !s?.trim()) throw new Error("Identificação obrigatória");
        localStorage.setItem("idf-user-name", n.trim());
        localStorage.setItem("idf-user-surname", s.trim());
      }
      return saveCfg({
        data: {
          irWindowDays: windowDays,
          irPointsPerRecurrence: points,
          irBuckets: buckets,
          irStatusFilter: statusFilter,
          ncWeights: weights,
          autor: getCurrentAuthor() ?? "Sistema",
        },
      });
    },
    onSuccess: () => {
      toast.success("Configurações salvas. Recalculando dashboard...");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["app-config"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <SectionCard title="Janela de Recorrência (IR)">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {WINDOW_PRESETS.map((p) => (
              <Button
                key={p.days}
                size="sm"
                variant={windowDays === p.days ? "default" : "outline"}
                onClick={() => setWindowDays(p.days)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Label className="w-40">Janela personalizada (dias)</Label>
            <Input
              type="number"
              className="w-32"
              value={windowDays}
              onChange={(e) => setWindowDays(parseInt(e.target.value || "0"))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Considera recorrência: mesmo fornecedor + item + problema + lote diferente, dentro desta janela após a ocorrência anterior.
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Pontuação IR">
        <div className="flex items-center gap-2">
          <Label className="w-60">Pontos por recorrência</Label>
          <Input
            type="number"
            className="w-32"
            value={points}
            onChange={(e) => setPoints(parseInt(e.target.value || "0"))}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">A 1ª ocorrência soma 0 IR. Cada recorrência válida soma estes pontos.</p>
      </SectionCard>

      <SectionCard title="Pesos da Nota NC (por criticidade)">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["grave", "moderada", "leve", "melhoria"] as const).map((k) => (
            <div key={k} className="space-y-1">
              <Label className="capitalize text-xs">{k}</Label>
              <Input
                type="number"
                value={weights[k]}
                onChange={(e) => setWeights((w) => ({ ...w, [k]: parseFloat(e.target.value || "0") }))}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">Padrão Frasle: Grave=8, Moderada=4, Leve=2, Melhoria=0.</p>
      </SectionCard>

      <SectionCard title="Status considerado como ocorrência">
        <div className="flex gap-2">
          <Button size="sm" variant={statusFilter === "reprovado" ? "default" : "outline"} onClick={() => setStatusFilter("reprovado")}>
            Apenas Reprovado
          </Button>
          <Button size="sm" variant={statusFilter === "reprovado+condicional" ? "default" : "outline"} onClick={() => setStatusFilter("reprovado+condicional")}>
            Reprovado + Condicional
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Tabela IR → %">
        <div className="space-y-2">
          {buckets.map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-12 text-muted-foreground">IR ≤</span>
              <Input
                type="number"
                className="w-28"
                value={b.max}
                onChange={(e) => {
                  const v = parseInt(e.target.value || "0");
                  setBuckets((bs) => bs.map((x, j) => (j === i ? { ...x, max: v } : x)));
                }}
              />
              <span className="text-muted-foreground">→</span>
              <Input
                type="number"
                className="w-24"
                value={b.pct}
                onChange={(e) => {
                  const v = parseInt(e.target.value || "0");
                  setBuckets((bs) => bs.map((x, j) => (j === i ? { ...x, pct: v } : x)));
                }}
              />
              <span className="text-muted-foreground">%</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Padrão Frasle: 0=100%, ≤5=90%, ≤10=60%, ≤15=30%, &gt;15=0%.
        </p>
      </SectionCard>

      <div className="flex justify-end">
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}
