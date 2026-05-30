import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Search, RotateCcw } from "lucide-react";
import { SectionCard } from "@/components/dashboard-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listAuditLog, type AuditEntry } from "@/lib/sheets.functions";

export const Route = createFileRoute("/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — Histórico de Alterações" }] }),
  component: AuditPage,
});

const ACOES_LABEL: Record<string, { label: string; tone: string }> = {
  nota_alterada: { label: "Nota alterada", tone: "bg-warning/15 text-warning border-warning/30" },
  nota_restaurada: { label: "Nota restaurada", tone: "bg-muted text-muted-foreground border-border" },
  evidencia_adicionada: { label: "Evidência anexada", tone: "bg-info/15 text-info border-info/30" },
  evidencia_removida: { label: "Evidência removida", tone: "bg-destructive/15 text-destructive border-destructive/30" },
  config_atualizada: { label: "Configuração atualizada", tone: "bg-primary/15 text-primary border-primary/30" },
};

const ENTIDADES = ["nota_override", "rnc_evidencia", "app_config"];

function fmt(iso: string) { try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; } }

function AuditPage() {
  const fn = useServerFn(listAuditLog);
  const [autor, setAutor] = useState("");
  const [acao, setAcao] = useState<string>("");
  const [entidade, setEntidade] = useState<string>("");
  const [fornecedor, setFornecedor] = useState("");
  const [item, setItem] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [query, setQuery] = useState({});
  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["audit", query],
    queryFn: () => fn({ data: query as any }),
  });

  function aplicar() {
    setQuery({
      autor: autor || undefined,
      acao: acao || undefined,
      entidade: entidade || undefined,
      fornecedor: fornecedor || undefined,
      item: item || undefined,
      dataInicio: dataInicio ? new Date(dataInicio).toISOString() : undefined,
      dataFim: dataFim ? new Date(`${dataFim}T23:59:59`).toISOString() : undefined,
      limit: 500,
    });
  }
  function limpar() {
    setAutor(""); setAcao(""); setEntidade(""); setFornecedor(""); setItem(""); setDataInicio(""); setDataFim("");
    setQuery({});
  }

  const acoesDisponiveis = useMemo(() => Object.keys(ACOES_LABEL), []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <History className="h-5 w-5" />
        <div>
          <h1 className="text-xl font-semibold">Auditoria</h1>
          <p className="text-xs text-muted-foreground">Histórico de alterações no dashboard</p>
        </div>
      </div>

      <SectionCard title="Filtros">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1"><Label className="text-xs">Usuário</Label><Input value={autor} onChange={(e) => setAutor(e.target.value)} placeholder="Nome..." /></div>
          <div className="space-y-1">
            <Label className="text-xs">Ação</Label>
            <Select value={acao || "all"} onValueChange={(v) => setAcao(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {acoesDisponiveis.map((a) => <SelectItem key={a} value={a}>{ACOES_LABEL[a]?.label ?? a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Entidade</Label>
            <Select value={entidade || "all"} onValueChange={(v) => setEntidade(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {ENTIDADES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Fornecedor</Label><Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Item</Label><Input value={item} onChange={(e) => setItem(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Data início</Label><Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Data fim</Label><Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></div>
          <div className="flex items-end gap-2">
            <Button onClick={aplicar} className="flex-1"><Search className="h-3.5 w-3.5 mr-1" /> Filtrar</Button>
            <Button variant="outline" onClick={limpar} title="Limpar"><RotateCcw className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={`Registros (${rows.length})`}>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhum registro encontrado.</p>
        ) : (
          <div className="overflow-x-auto max-h-[640px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left uppercase tracking-wider text-muted-foreground border-b">
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 pr-2">Usuário</th>
                  <th className="py-2 pr-2">Ação</th>
                  <th className="py-2 pr-2">Entidade</th>
                  <th className="py-2 pr-2">Referência</th>
                  <th className="py-2 pr-2">Fornecedor</th>
                  <th className="py-2 pr-2">Item</th>
                  <th className="py-2 pr-2">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: AuditEntry) => {
                  const meta = ACOES_LABEL[r.acao] ?? { label: r.acao, tone: "bg-muted text-muted-foreground border-border" };
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40 align-top">
                      <td className="py-1.5 pr-2 whitespace-nowrap">{fmt(r.created_at)}</td>
                      <td className="py-1.5 pr-2 font-medium">{r.autor}</td>
                      <td className="py-1.5 pr-2"><Badge variant="outline" className={meta.tone}>{meta.label}</Badge></td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{r.entidade}</td>
                      <td className="py-1.5 pr-2 font-mono text-[10px]">{r.entidade_id ?? "—"}</td>
                      <td className="py-1.5 pr-2">{r.fornecedor ?? "—"}</td>
                      <td className="py-1.5 pr-2">{r.item ?? "—"}</td>
                      <td className="py-1.5 pr-2 max-w-[280px]">
                        {r.dados ? (
                          <code className="text-[10px] text-muted-foreground line-clamp-2 break-all">{JSON.stringify(r.dados)}</code>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
