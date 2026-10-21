import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CalendarRange,
  ClipboardCheck,
  Download,
  FileWarning,
  Gauge,
  Loader2,
  PackageSearch,
  Presentation,
  Save,
  Sparkles,
  TrendingDown,
  Truck,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useDashboard } from "@/hooks/use-data";
import {
  DeltaBadge,
  KpiCard,
  PrintButton,
  SectionCard,
  chartTooltip,
} from "@/components/dashboard-ui";
import { RdmPreview } from "@/components/rdm-slide-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAdequacaoMensal, getQualihubDados, saveQualihubDados } from "@/lib/sheets.functions";
import { getAutor, setAutor } from "@/lib/org";
import {
  RDM_MANUAL_PADRAO,
  RDM_META_EFICIENCIA,
  RDM_META_NC,
  anosDisponiveis,
  brl,
  int,
  pct,
  rdmAcumulado,
  rdmAno,
  rdmQld,
  sugestoesRdm,
  type RdmManual,
  type RdmMes,
} from "@/lib/rdm";
import { gerarPptxRdm, type RdmPptxInput } from "@/lib/rdm-pptx";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/rdm")({
  head: () => ({ meta: [{ title: "RDM — Reunião de Desempenho Mensal" }] }),
  component: RdmPage,
});

const chaveMes = (ano: number, month: number) => `rdm:${ano}-${String(month + 1).padStart(2, "0")}`;

type DadosSalvos = Record<string, { valor: RdmManual; atualizadoEm: string; autor: string }>;

function lerLocal(chave: string): RdmManual | null {
  try {
    const raw = localStorage.getItem(`qf-${chave}`);
    return raw ? (JSON.parse(raw) as RdmManual) : null;
  } catch {
    return null;
  }
}

function mesclar(base: Partial<RdmManual> | null | undefined): RdmManual {
  return {
    adequacao: { ...RDM_MANUAL_PADRAO.adequacao, ...(base?.adequacao ?? {}) },
    comentarios: { ...RDM_MANUAL_PADRAO.comentarios, ...(base?.comentarios ?? {}) },
    capaSubtitulo: base?.capaSubtitulo ?? RDM_MANUAL_PADRAO.capaSubtitulo,
    ppmModo: base?.ppmModo === "sku" ? "sku" : "pecas",
  };
}

function RdmPage() {
  const data = useDashboard();
  const anos = useMemo(() => (data ? anosDisponiveis(data) : []), [data]);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  useEffect(() => {
    if (anos.length && !anos.includes(ano)) setAno(anos[0]);
  }, [anos, ano]);

  const meses = useMemo(() => (data ? rdmAno(data, ano) : []), [data, ano]);
  const ultimoComDados = useMemo(() => {
    const com = meses.filter((m) => m.temDados);
    const ultimo = com.length ? com[com.length - 1].month : 0;
    // A RDM fala do mês fechado: no ano corrente, o padrão é o mês anterior.
    const hoje = new Date();
    if (ano === hoje.getFullYear() && ultimo >= hoje.getMonth() && hoje.getMonth() > 0) {
      return hoje.getMonth() - 1;
    }
    return ultimo;
  }, [meses, ano]);
  const [mesSel, setMesSel] = useState<number | null>(null);
  const month = mesSel ?? ultimoComDados;
  const mes = meses[month];
  const anterior = month > 0 ? meses[month - 1] : null;
  const ate = useMemo(() => meses.filter((m) => m.month <= month), [meses, month]);
  const acumulado = useMemo(() => rdmAcumulado(meses, month), [meses, month]);
  const qld = useMemo(() => (data ? rdmQld(data) : null), [data]);

  // Adequação: lida do sistema da área (mesma planilha do painel de Adequação).
  const getAdequacao = useServerFn(getAdequacaoMensal);
  const adequacaoQ = useQuery({
    queryKey: ["adequacao-mensal"],
    queryFn: () => getAdequacao(),
    staleTime: 5 * 60_000,
  });

  /* ---------------------- campos digitados (por mês) ---------------------- */
  const qc = useQueryClient();
  const getDados = useServerFn(getQualihubDados);
  const saveDados = useServerFn(saveQualihubDados);
  const salvos = useQuery({
    queryKey: ["rdm-dados"],
    queryFn: async () => {
      const r = await getDados({ data: { prefixo: "rdm:" } });
      return { dados: (r.json ? JSON.parse(r.json) : {}) as DadosSalvos, suportado: r.suportado };
    },
    staleTime: 60_000,
  });
  const chave = chaveMes(ano, month);
  const remoto = salvos.data?.dados[chave];
  const [manual, setManual] = useState<RdmManual>(RDM_MANUAL_PADRAO);
  const [dirty, setDirty] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [slide, setSlide] = useState<1 | 2 | 3>(2);
  const relatorioRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const local = lerLocal(chave);
    setManual(mesclar(remoto?.valor ?? local ?? null));
    setDirty(false);
  }, [chave, remoto]);

  const editar = (patch: (m: RdmManual) => RdmManual) => {
    setManual((m) => patch(m));
    setDirty(true);
  };

  const salvar = async () => {
    const autor =
      getAutor() || window.prompt("Seu nome (para registrar quem salvou):")?.trim() || "";
    if (!autor) return;
    setAutor(autor);
    setSalvando(true);
    try {
      await saveDados({ data: { chave, json: JSON.stringify(manual), autor } });
      try {
        localStorage.removeItem(`qf-${chave}`);
      } catch {
        /* sem armazenamento */
      }
      await qc.invalidateQueries({ queryKey: ["rdm-dados"] });
      setDirty(false);
      toast.success(`RDM de ${mes?.mesLongo}/${ano} salva para todos.`);
    } catch (e) {
      try {
        localStorage.setItem(`qf-${chave}`, JSON.stringify(manual));
      } catch {
        /* sem armazenamento */
      }
      setDirty(false);
      toast.warning(
        `${e instanceof Error ? e.message : "Não foi possível salvar na planilha."} Por enquanto ficou salvo neste navegador.`,
        { duration: 9000 },
      );
    } finally {
      setSalvando(false);
    }
  };

  const doSistema = adequacaoQ.data?.meses.find((a) => a.ano === ano && a.mes === month);
  const adequacao = doSistema ?? {
    pecas: manual.adequacao.mdPecas + manual.adequacao.avariaPecas,
    valor: manual.adequacao.valor,
    skus: manual.adequacao.skus,
    md: { pecas: manual.adequacao.mdPecas, valor: 0 },
    avaria: { pecas: manual.adequacao.avariaPecas, valor: 0 },
  };

  const input: RdmPptxInput | null =
    mes && qld
      ? {
          ano,
          mes,
          meses: ate,
          acumulado: { alertas: acumulado.alertas, rncs: acumulado.rncs },
          qld,
          adequacao,
          manual,
        }
      : null;

  const sugestoes =
    mes && qld
      ? sugestoesRdm({
          mes,
          acumulado: { alertas: acumulado.alertas, rncs: acumulado.rncs },
          ppmModo: manual.ppmModo,
          adequacao,
          qld,
        })
      : null;

  const gerar = async () => {
    if (!input) return;
    setGerando(true);
    try {
      await gerarPptxRdm(input);
      toast.success("PowerPoint da RDM gerado: capa, indicadores e agradecimento — tudo editável.");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o PowerPoint da RDM.");
    } finally {
      setGerando(false);
    }
  };

  if (!data || !mes || !qld || !input) {
    return (
      <div className="surface flex h-80 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando indicadores…
      </div>
    );
  }

  const deltaInv = (atual: number | null, ant: number | null | undefined) =>
    anterior && atual != null && ant != null ? (
      <DeltaBadge current={atual} previous={ant} invert />
    ) : undefined;
  const delta = (atual: number | null, ant: number | null | undefined) =>
    anterior && atual != null && ant != null ? (
      <DeltaBadge current={atual} previous={ant} />
    ) : undefined;

  return (
    <div className="space-y-6">
      {/* HERO */}
      <section className="hero-panel p-6 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="eyebrow">
              <Presentation className="h-3.5 w-3.5" /> RDM · Reunião de Desempenho Mensal
            </div>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
              Qualidade do Produto
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              Todos os números do slide da diretoria, mês a mês, direto da planilha — sem calcular
              no Excel nem tirar print. Escolha o mês e gere o PowerPoint oficial em 1 clique.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <select
                value={ano}
                onChange={(e) => {
                  setAno(Number(e.target.value));
                  setMesSel(null);
                }}
                className="h-9 rounded-lg border bg-background px-3 text-sm font-semibold"
                aria-label="Ano"
              >
                {(anos.length ? anos : [ano]).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <div className="segmented flex-wrap">
                {meses.map((m) => (
                  <button
                    key={m.mes}
                    type="button"
                    disabled={!m.temDados}
                    data-active={m.month === month}
                    onClick={() => setMesSel(m.month)}
                    className="disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {m.mes}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row xl:flex-col xl:items-stretch">
            <Button
              size="lg"
              onClick={gerar}
              disabled={gerando}
              className="gap-2 shadow-lg shadow-primary/25"
            >
              {gerando ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
              Gerar PowerPoint da RDM
            </Button>
            <div className="flex gap-2">
              <PrintButton
                target={() => relatorioRef.current}
                title={`RDM — Qualidade do Produto · ${mes.mesLongo}/${ano}`}
                subtitle="Indicadores dos processos"
                label="Imprimir indicadores"
                className="flex-1"
              />
            </div>
            <span className="chip justify-center">
              <CalendarRange className="h-3 w-3" /> {mes.mesLongo}/{ano} · 3 slides: capa,
              indicadores e agradecimento
            </span>
          </div>
        </div>
      </section>

      <div ref={relatorioRef} className="space-y-6">
        {/* KPIs DO MÊS */}
        <div>
          <div className="eyebrow">Indicadores de {mes.mesLongo}</div>
          <h2 className="mt-1 font-display text-xl font-semibold">Inspeções de recebimento</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-7">
            <KpiCard
              label="Eficiência"
              value={pct(mes.eficiencia)}
              hint={`${int(mes.inspecionadas)} de ${int(mes.recebidas)} recebidas · meta ${RDM_META_EFICIENCIA}%`}
              tone={(mes.eficiencia ?? 0) >= RDM_META_EFICIENCIA ? "success" : "warning"}
              icon={<Gauge className="h-4 w-4" />}
              delta={delta(mes.eficiencia, anterior?.eficiencia)}
            />
            <PpmRdmCard
              mes={mes}
              anterior={anterior}
              modo={manual.ppmModo}
              onModo={(modo) => editar((m) => ({ ...m, ppmModo: modo }))}
            />
            <KpiCard
              label="Índice NC"
              value={pct(mes.indiceNC, 2)}
              hint={`${int(mes.reprovadas)} reprovadas · meta ≤ ${RDM_META_NC}%`}
              tone={(mes.indiceNC ?? 0) <= RDM_META_NC ? "success" : "destructive"}
              icon={<TrendingDown className="h-4 w-4" />}
              delta={deltaInv(mes.indiceNC, anterior?.indiceNC)}
            />
            <KpiCard
              label="Fornecedores"
              value={int(mes.fornecedores)}
              hint="Com recebimento no mês"
              icon={<Truck className="h-4 w-4" />}
              delta={delta(mes.fornecedores, anterior?.fornecedores)}
            />
            <KpiCard
              label="Alertas (AQ)"
              value={int(mes.alertas)}
              hint={`${int(acumulado.alertas)} no ano até ${mes.mes}`}
              tone="warning"
              icon={<AlertTriangle className="h-4 w-4" />}
              delta={deltaInv(mes.alertas, anterior?.alertas)}
            />
            <KpiCard
              label="RNCs"
              value={int(mes.rncs)}
              hint={`${int(acumulado.rncs)} no ano até ${mes.mes}`}
              tone="info"
              icon={<FileWarning className="h-4 w-4" />}
              delta={deltaInv(mes.rncs, anterior?.rncs)}
            />
          </div>
        </div>

        {/* EFICIÊNCIA + NC */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
          <SectionCard
            title="Eficiência de inspeção · recebimento"
            icon={<Gauge className="h-4 w-4" />}
          >
            <GaugeGrande valor={mes.eficiencia ?? 0} />
            <div className="mt-2 space-y-1.5 text-sm">
              <Linha rotulo="Target" valor={`${RDM_META_EFICIENCIA}%`} />
              <Linha rotulo="Qde recebida" valor={int(mes.recebidas)} />
              <Linha rotulo="Qde inspecionada" valor={int(mes.inspecionadas)} />
              <Linha
                rotulo="Pendência (recebida − inspecionada)"
                valor={int(mes.recebidas - mes.inspecionadas)}
                destaque={mes.recebidas - mes.inspecionadas > 0}
              />
            </div>
          </SectionCard>
          <SectionCard
            title="Índice de não conformidade · mês a mês"
            subtitle={`Reprovados do mês ÷ inspeções do mês × 100 · meta ≤ ${RDM_META_NC}%`}
            icon={<TrendingDown className="h-4 w-4" />}
          >
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={ate.map((m) => ({
                    mes: m.mes,
                    nc: Number((m.indiceNC ?? 0).toFixed(2)),
                    atual: m.month === month,
                  }))}
                  margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={40}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    {...chartTooltip}
                    formatter={(v: number) => [`${v.toLocaleString("pt-BR")}%`, "Índice NC"]}
                  />
                  <ReferenceLine
                    y={RDM_META_NC}
                    stroke="var(--color-warning)"
                    strokeDasharray="6 5"
                    label={{
                      value: `Meta ${RDM_META_NC}%`,
                      position: "insideTopRight",
                      fill: "var(--color-warning)",
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="nc" radius={[6, 6, 0, 0]}>
                    {ate.map((m) => (
                      <Cell
                        key={m.mes}
                        fill="var(--color-primary)"
                        fillOpacity={m.month === month ? 1 : 0.45}
                      />
                    ))}
                    <LabelList
                      dataKey="nc"
                      position="top"
                      fontSize={10}
                      fill="var(--chart-axis)"
                      formatter={(v: number) =>
                        `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`
                      }
                    />
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="nc"
                    stroke="var(--chart-axis)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        {/* MÊS A MÊS */}
        <SectionCard
          title={`Mês a mês · ${ano}`}
          subtitle="Todos os indicadores do slide, com o acumulado do ano até o mês escolhido"
          icon={<CalendarRange className="h-4 w-4" />}
          printable
          printTitle={`RDM — Indicadores mês a mês · ${ano}`}
          bodyClassName="p-0"
        >
          <TabelaMeses meses={meses} month={month} acumulado={acumulado} onMes={setMesSel} />
        </SectionCard>

        {/* ADEQUAÇÃO + QLD */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <SectionCard
            title="Adequação de produtos"
            subtitle={
              doSistema
                ? `Lido do sistema da Adequação · ${mes.mesLongo}/${ano}`
                : adequacaoQ.isLoading
                  ? "Lendo o sistema da Adequação…"
                  : "Sem registros no sistema da Adequação para este mês — preencha abaixo"
            }
            icon={<PackageSearch className="h-4 w-4" />}
            action={
              <a
                href="https://adequacaofraslemobility.netlify.app/"
                target="_blank"
                rel="noreferrer"
                className="no-print text-xs font-medium text-primary hover:underline"
              >
                Abrir sistema ↗
              </a>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_200px]">
              {doSistema ? (
                <div className="grid grid-cols-2 gap-3">
                  <Mini
                    rotulo="Peças adequadas"
                    valor={int(adequacao.pecas)}
                    detalhe={`${int(adequacao.skus)} SKUs`}
                    cor="var(--color-primary)"
                  />
                  <Mini
                    rotulo="Valor recuperado"
                    valor={brl(adequacao.valor)}
                    detalhe="Peça × valor unitário"
                    cor="var(--chart-approved)"
                  />
                  <Mini
                    rotulo="MD"
                    valor={brl(adequacao.md.valor)}
                    detalhe={`${int(adequacao.md.pecas)} peças`}
                    cor="#5B9BD5"
                  />
                  <Mini
                    rotulo="Avaria CD"
                    valor={brl(adequacao.avaria.valor)}
                    detalhe={`${int(adequacao.avaria.pecas)} peças`}
                    cor="#ED7D31"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Campo
                    rotulo="Peças MD"
                    valor={manual.adequacao.mdPecas}
                    onChange={(v) =>
                      editar((m) => ({ ...m, adequacao: { ...m.adequacao, mdPecas: v } }))
                    }
                  />
                  <Campo
                    rotulo="Peças Avaria CD"
                    valor={manual.adequacao.avariaPecas}
                    onChange={(v) =>
                      editar((m) => ({ ...m, adequacao: { ...m.adequacao, avariaPecas: v } }))
                    }
                  />
                  <Campo
                    rotulo="Valor total (R$)"
                    valor={manual.adequacao.valor}
                    passo={0.01}
                    onChange={(v) =>
                      editar((m) => ({ ...m, adequacao: { ...m.adequacao, valor: v } }))
                    }
                  />
                  <Campo
                    rotulo="SKUs"
                    valor={manual.adequacao.skus}
                    onChange={(v) =>
                      editar((m) => ({ ...m, adequacao: { ...m.adequacao, skus: v } }))
                    }
                  />
                </div>
              )}
              <Rosca
                dados={[
                  {
                    nome: "MD",
                    valor: doSistema ? adequacao.md.valor : adequacao.md.pecas,
                    cor: "#5B9BD5",
                  },
                  {
                    nome: "Avaria CD",
                    valor: doSistema ? adequacao.avaria.valor : adequacao.avaria.pecas,
                    cor: "#ED7D31",
                  },
                ]}
                centro={`${int(adequacao.pecas)} peças`}
              />
            </div>
          </SectionCard>
          <SectionCard
            title="QLD / QLDE · exposição"
            subtitle="Fotografia atual dos depósitos 522 e 523 (itens ativos)"
            icon={<Boxes className="h-4 w-4" />}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
              <Rosca
                dados={[
                  { nome: "QLD", valor: qld.qldValor, cor: "#D97706" },
                  { nome: "QLDE", valor: qld.qldeValor, cor: "#DC2626" },
                ]}
                centro={brl(qld.totalValor)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Mini
                  rotulo="QLD · 522"
                  valor={brl(qld.qldValor)}
                  detalhe={`${int(qld.qldSkus)} SKUs · ${int(qld.qldQuantidade)} peças`}
                  cor="#D97706"
                />
                <Mini
                  rotulo="QLDE · 523"
                  valor={brl(qld.qldeValor)}
                  detalhe={`${int(qld.qldeSkus)} SKUs · ${int(qld.qldeQuantidade)} peças`}
                  cor="#DC2626"
                />
                <Mini
                  rotulo="Exposição ativa"
                  valor={brl(qld.totalValor)}
                  detalhe={`${int(qld.totalQuantidade)} peças`}
                  cor="var(--color-foreground)"
                />
                <Mini
                  rotulo="Resolvidos"
                  valor={int(qld.resolvidos.length)}
                  detalhe={brl(qld.resolvidosValor)}
                  cor="var(--chart-approved)"
                />
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* COMENTÁRIOS + PRÉVIA */}
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[420px_1fr]">
        <SectionCard
          title="Observações do slide"
          subtitle="Texto da direita do slide 2. Cada linha vira um tópico; *asteriscos* destacam em vermelho."
          icon={<Sparkles className="h-4 w-4" />}
          action={
            <Button size="sm" onClick={salvar} disabled={salvando || !dirty} className="gap-1.5">
              {salvando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Salvar
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Subtítulo da capa</Label>
              <Input
                value={manual.capaSubtitulo}
                onChange={(e) => editar((m) => ({ ...m, capaSubtitulo: e.target.value }))}
              />
            </div>
            <Comentario
              rotulo="Inspeções de recebimento"
              valor={manual.comentarios.inspecao}
              sugestao={sugestoes?.inspecao}
              exemplo="Ex.: *Fornecedor X* com 3 lotes reprovados por dimensional."
              onChange={(v) =>
                editar((m) => ({ ...m, comentarios: { ...m.comentarios, inspecao: v } }))
              }
            />
            <Comentario
              rotulo="Adequação"
              valor={manual.comentarios.adequacao}
              sugestao={sugestoes?.adequacao}
              exemplo="Ex.: Estamos *em período de obras*, afetando a produtividade."
              onChange={(v) =>
                editar((m) => ({ ...m, comentarios: { ...m.comentarios, adequacao: v } }))
              }
            />
            <Comentario
              rotulo="QLD - QLDE"
              valor={manual.comentarios.qld}
              sugestao={sugestoes?.qld}
              exemplo="Ex.: *CT 30826* com retrabalho *por mão de obra externa*."
              onChange={(v) => editar((m) => ({ ...m, comentarios: { ...m.comentarios, qld: v } }))}
            />
            <p className="text-[11px] text-muted-foreground">
              {dirty
                ? "Alterações não salvas."
                : remoto
                  ? `Salvo por ${remoto.autor} em ${new Date(remoto.atualizadoEm).toLocaleString("pt-BR")}.`
                  : lerLocal(chave)
                    ? "Salvo só neste navegador (atualize o Apps Script para salvar para todos)."
                    : "Ainda não há comentários salvos para este mês."}
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Prévia da apresentação"
          subtitle="Exatamente o que vai para o PowerPoint (o fundo é o do modelo oficial)"
          icon={<Presentation className="h-4 w-4" />}
          action={
            <div className="segmented">
              {([1, 2, 3] as const).map((n) => (
                <button key={n} type="button" data-active={slide === n} onClick={() => setSlide(n)}>
                  {n === 1 ? "1 · Capa" : n === 2 ? "2 · Indicadores" : "3 · Obrigado"}
                </button>
              ))}
            </div>
          }
        >
          <RdmPreview input={input} slide={slide} />
        </SectionCard>
      </div>
    </div>
  );
}

function GaugeGrande({ valor }: { valor: number }) {
  const v = Math.max(0, Math.min(100, valor));
  const cor =
    valor >= RDM_META_EFICIENCIA
      ? "var(--chart-approved)"
      : valor >= RDM_META_EFICIENCIA - 10
        ? "var(--chart-conditional)"
        : "var(--chart-rejected)";
  const r = 92;
  const ponto = (p: number, raio = r) => {
    const a = Math.PI - (p / 100) * Math.PI;
    return [130 + Math.cos(a) * raio, 124 - Math.sin(a) * raio];
  };
  const arco = (a: number, b: number) => {
    const [x0, y0] = ponto(a);
    const [x1, y1] = ponto(b);
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
  };
  const [nx, ny] = ponto(v, 84);
  const [mx, my] = ponto(RDM_META_EFICIENCIA, 120);
  const [mx0, my0] = ponto(RDM_META_EFICIENCIA, 64);
  return (
    <div className="relative mx-auto w-[260px]">
      <svg viewBox="0 0 260 140" className="w-full">
        <path d={arco(0, 100)} stroke="var(--color-muted)" strokeWidth={40} fill="none" />
        {v > 0 && <path d={arco(0, v)} stroke={cor} strokeWidth={40} fill="none" />}
        <line
          x1={mx0}
          y1={my0}
          x2={mx}
          y2={my}
          stroke="var(--color-foreground)"
          strokeWidth={2}
          strokeDasharray="3 3"
        />
        <line
          x1={130}
          y1={124}
          x2={nx}
          y2={ny}
          stroke="var(--color-foreground)"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <circle cx={130} cy={124} r={8} fill="var(--color-foreground)" />
      </svg>
      <div className="-mt-2 text-center font-display text-4xl font-bold tabular-nums">
        {pct(valor)}
      </div>
    </div>
  );
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed pb-1">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className={cn("font-semibold tabular-nums", destaque && "text-warning")}>{valor}</span>
    </div>
  );
}

function TabelaMeses({
  meses,
  month,
  acumulado,
  onMes,
}: {
  meses: RdmMes[];
  month: number;
  acumulado: ReturnType<typeof rdmAcumulado>;
  onMes: (m: number) => void;
}) {
  const linhas: {
    rotulo: string;
    valor: (m: RdmMes) => string;
    acc: string;
    cor?: (m: RdmMes) => string | undefined;
  }[] = [
    { rotulo: "Recebidas", valor: (m) => int(m.recebidas), acc: int(acumulado.recebidas) },
    {
      rotulo: "Inspecionadas",
      valor: (m) => int(m.inspecionadas),
      acc: int(acumulado.inspecionadas),
    },
    {
      rotulo: "Eficiência",
      valor: (m) => pct(m.eficiencia),
      acc: pct(acumulado.eficiencia),
      cor: (m) =>
        m.eficiencia == null
          ? undefined
          : m.eficiencia >= RDM_META_EFICIENCIA
            ? "text-success"
            : "text-warning",
    },
    { rotulo: "Reprovadas", valor: (m) => int(m.reprovadas), acc: int(acumulado.reprovadas) },
    {
      rotulo: "Índice NC",
      valor: (m) => pct(m.indiceNC, 2),
      acc: pct(acumulado.indiceNC, 2),
      cor: (m) =>
        m.indiceNC == null
          ? undefined
          : m.indiceNC <= RDM_META_NC
            ? "text-success"
            : "text-destructive",
    },
    { rotulo: "PPM (peças)", valor: (m) => int(m.ppmPecas), acc: int(acumulado.ppmPecas) },
    { rotulo: "PPM (SKU)", valor: (m) => int(m.ppmSku), acc: int(acumulado.ppmSku) },
    { rotulo: "Fornecedores", valor: (m) => int(m.fornecedores), acc: "—" },
    { rotulo: "Alertas (AQ)", valor: (m) => int(m.alertas), acc: int(acumulado.alertas) },
    { rotulo: "RNCs", valor: (m) => int(m.rncs), acc: int(acumulado.rncs) },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="sticky left-0 bg-card px-4 py-2.5 text-left">Indicador</th>
            {meses.map((m) => (
              <th
                key={m.mes}
                className={cn(
                  "cursor-pointer px-2.5 py-2.5 text-right transition hover:text-foreground",
                  m.month === month && "bg-primary/10 text-primary",
                  !m.temDados && "opacity-40",
                )}
                onClick={() => m.temDados && onMes(m.month)}
              >
                {m.mes}
              </th>
            ))}
            <th className="bg-muted/50 px-3 py-2.5 text-right">Acum. até {meses[month]?.mes}</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.rotulo} className="border-b last:border-0 hover:bg-muted/30">
              <td className="sticky left-0 whitespace-nowrap bg-card px-4 py-2 font-medium">
                {l.rotulo}
              </td>
              {meses.map((m) => (
                <td
                  key={m.mes}
                  className={cn(
                    "px-2.5 py-2 text-right tabular-nums",
                    m.month === month && "bg-primary/5 font-semibold",
                    !m.temDados && "text-muted-foreground/40",
                    m.temDados && l.cor?.(m),
                  )}
                >
                  {m.temDados ? l.valor(m) : "—"}
                </td>
              ))}
              <td className="bg-muted/50 px-3 py-2 text-right font-semibold tabular-nums">
                {l.acc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Campo({
  rotulo,
  valor,
  onChange,
  passo = 1,
}: {
  rotulo: string;
  valor: number;
  onChange: (v: number) => void;
  passo?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{rotulo}</Label>
      <Input
        type="number"
        step={passo}
        value={valor || ""}
        placeholder="0"
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

function Rosca({
  dados,
  centro,
}: {
  dados: { nome: string; valor: number; cor: string }[];
  centro: string;
}) {
  const total = dados.reduce((s, d) => s + d.valor, 0);
  return (
    <div>
      <div className="relative h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total > 0 ? dados : [{ nome: "—", valor: 1, cor: "var(--color-muted)" }]}
              dataKey="valor"
              nameKey="nome"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={2}
              strokeWidth={0}
            >
              {(total > 0 ? dados : [{ cor: "var(--color-muted)" }]).map((d, i) => (
                <Cell key={i} fill={d.cor} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-xs font-bold">
          {centro}
        </div>
      </div>
      <div className="mt-1 flex justify-center gap-3 text-[11px] text-muted-foreground">
        {dados.map((d) => (
          <span key={d.nome} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: d.cor }} />
            {d.nome} {total > 0 ? `${Math.round((d.valor / total) * 100)}%` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function Mini({
  rotulo,
  valor,
  detalhe,
  cor,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  cor: string;
}) {
  return (
    <div className="surface-muted relative overflow-hidden p-3">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} />
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {rotulo}
      </div>
      <div className="mt-0.5 font-display text-base font-bold tabular-nums">{valor}</div>
      <div className="text-[11px] text-muted-foreground">{detalhe}</div>
    </div>
  );
}

function Comentario({
  rotulo,
  valor,
  exemplo,
  sugestao,
  onChange,
}: {
  rotulo: string;
  valor: string;
  exemplo: string;
  sugestao?: string;
  onChange: (v: string) => void;
}): ReactNode {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>{rotulo}</Label>
        {sugestao && (
          <button
            type="button"
            onClick={() => onChange(valor.trim() ? `${valor.trim()}\n${sugestao}` : sugestao)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            title="Insere um texto pronto com os números do mês (você pode editar)"
          >
            <Sparkles className="h-3 w-3" /> Sugerir texto
          </button>
        )}
      </div>
      <Textarea
        rows={4}
        value={valor}
        placeholder={exemplo}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function PpmRdmCard({
  mes,
  anterior,
  modo,
  onModo,
}: {
  mes: RdmMes;
  anterior: RdmMes | null;
  modo: "pecas" | "sku";
  onModo: (m: "pecas" | "sku") => void;
}) {
  const valor = modo === "sku" ? mes.ppmSku : mes.ppmPecas;
  const ant = anterior ? (modo === "sku" ? anterior.ppmSku : anterior.ppmPecas) : null;
  return (
    <div className="surface card-premium flex min-h-[156px] flex-col overflow-hidden p-4">
      <span className="absolute inset-x-0 top-0 h-[3px] bg-info opacity-80" />
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-info" /> PPM
        </div>
        <div className="segmented">
          <button type="button" data-active={modo === "pecas"} onClick={() => onModo("pecas")}>
            Peças
          </button>
          <button type="button" data-active={modo === "sku"} onClick={() => onModo("sku")}>
            SKU
          </button>
        </div>
      </div>
      <div
        className="mt-3 font-display font-bold leading-none tracking-tight tabular-nums text-info"
        style={{ fontSize: "clamp(1.875rem, 2.5vw, 2.5rem)" }}
      >
        {int(valor)}
      </div>
      <div className="mt-1.5 text-[12px] text-muted-foreground">
        {modo === "sku"
          ? `${int(mes.reprovadas)} linhas reprovadas / ${int(mes.inspecionadas)} (1 linha = 1 SKU)`
          : `${int(mes.pecasNc)} peças NC / ${int(mes.pecas)} peças`}
      </div>
      {ant != null && (
        <div className="mt-auto pt-2">
          <DeltaBadge current={valor} previous={ant} invert />
        </div>
      )}
    </div>
  );
}
