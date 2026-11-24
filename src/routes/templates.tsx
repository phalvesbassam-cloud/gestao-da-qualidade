import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  FileStack,
  LayoutTemplate,
  Layers,
  Loader2,
  MonitorPlay,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SlideCanvas, SlideFrame } from "@/components/slide-canvas";
import { usePresentation } from "@/contexts/presentation-context";
import { TEMPLATES, type TemplateModelo } from "@/lib/templates-catalogo";
import {
  baixarTemplateComDados,
  nomeDaAba,
  slidesDosDados,
  specDoItem,
  type ModoMontagem,
} from "@/lib/templates/gerar-no-navegador";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/templates")({
  head: () => ({ meta: [{ title: "Biblioteca de Templates — QualiHub" }] }),
  component: TemplatesPage,
});

const CATEGORIAS = ["Todos", ...Array.from(new Set(TEMPLATES.map((t) => t.categoria)))];

/** Nome do layout de cada tipo de slide, usado também na busca. */
const TIPO_ROTULO: Record<string, string> = {
  capa: "capa",
  sumario: "sumário pauta agenda",
  divisoria: "divisória capítulo",
  textoImagem: "texto e imagem",
  imagemDestaque: "imagem em destaque foto",
  antesDepois: "antes e depois comparação",
  kpis: "indicadores kpis",
  grafico: "gráfico",
  tabela: "tabela",
  cronograma: "cronograma gantt",
  fluxograma: "fluxograma fluxo",
  planoAcao: "plano de ação 5w2h",
  encerramento: "encerramento obrigado",
  decisoes: "decisões",
  ishikawa: "ishikawa espinha de peixe 6m",
  cincoPorques: "5 porquês causa raiz",
  especificacao: "especificação técnica desenho cad",
  sipoc: "sipoc",
  missaoVisao: "missão visão valores",
  organograma: "organograma equipe",
};

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const tamanhoMb = (b: number) =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.round(b / 1024)} KB`;

function TemplatesPage() {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("Todos");
  const [aberto, setAberto] = useState<{ modelo: TemplateModelo; slide: number } | null>(null);
  const [montando, setMontando] = useState<TemplateModelo | null>(null);
  const { templateDados, montagemPendente, setMontagemPendente, startSelection } = usePresentation();
  const navigate = useNavigate();

  // Voltando da seleção de dados: abre a montagem do template escolhido.
  useEffect(() => {
    if (!montagemPendente) return;
    const t = TEMPLATES.find((x) => x.id === montagemPendente);
    if (t) setMontando(t);
    setMontagemPendente(null);
  }, [montagemPendente, setMontagemPendente]);

  const escolherDados = useCallback(
    (t: TemplateModelo) => {
      setMontando(null);
      startSelection({ tipo: "template", id: t.id, nome: t.nome });
      toast.info(`Escolhendo dados para o modelo ${t.nome}`, {
        description:
          "Navegue pelas abas e clique em Adicionar nos cards e gráficos. Depois clique em Concluir e montar PowerPoint.",
        duration: 8000,
      });
      navigate({ to: "/" });
    },
    [navigate, startSelection],
  );

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    return TEMPLATES.filter((t) => {
      if (categoria !== "Todos" && t.categoria !== categoria) return false;
      if (!q) return true;
      const alvo = normalizar(
        [
          t.nome,
          t.descricao,
          t.categoria,
          t.numero,
          ...t.usos,
          ...t.slides.map((s) => `${s.titulo} ${TIPO_ROTULO[s.tipo] ?? ""}`),
        ].join(" "),
      );
      return q.split(/\s+/).every((p) => alvo.includes(p));
    });
  }, [busca, categoria]);

  const totalSlides = TEMPLATES.reduce((a, t) => a + t.slides.length, 0);

  return (
    <div className="space-y-6">
      {/* HERO */}
      <section className="hero-panel p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">
              <LayoutTemplate className="h-3.5 w-3.5" /> Templates
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
              Biblioteca de Templates
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Modelos oficiais de apresentação da Fras-le Mobility para Engenharia, Qualidade e áreas
              industriais. Visualize os slides e baixe o PowerPoint: tudo é editável, com gráficos,
              tabelas e formas nativas.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Resumo icone={FileStack} valor={String(TEMPLATES.length)} rotulo="modelos" />
            <Resumo icone={Layers} valor={String(totalSlides)} rotulo="layouts de slide" />
            <Resumo icone={MonitorPlay} valor="16:9" rotulo=".pptx editável" />
          </div>
        </div>
      </section>

      {/* FILTROS */}
      <div className="surface flex flex-col gap-3 p-3 md:flex-row md:items-center">
        <div className="relative md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar modelo, uso ou tipo de slide…"
            className="pl-9 pr-8"
            aria-label="Buscar templates"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Categorias">
          {CATEGORIAS.map((c) => {
            const n = c === "Todos" ? TEMPLATES.length : TEMPLATES.filter((t) => t.categoria === c).length;
            const ativo = categoria === c;
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={ativo}
                onClick={() => setCategoria(c)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  ativo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
              >
                {c}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] tabular-nums",
                    ativo ? "bg-primary-foreground/20" : "bg-muted",
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CARDS */}
      {filtrados.length === 0 ? (
        <div className="surface flex flex-col items-center gap-2 p-10 text-center">
          <Search className="h-6 w-6 text-muted-foreground" />
          <p className="font-semibold">Nenhum modelo encontrado</p>
          <p className="text-sm text-muted-foreground">Tente outro termo ou limpe os filtros.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBusca("");
              setCategoria("Todos");
            }}
          >
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((t) => (
            <CardModelo
              key={t.id}
              modelo={t}
              qtdDados={templateDados[t.id]?.length ?? 0}
              onVer={(slide) => setAberto({ modelo: t, slide })}
              onDados={() => (templateDados[t.id]?.length ? setMontando(t) : escolherDados(t))}
            />
          ))}
        </div>
      )}

      <MontarComDados
        modelo={montando}
        onFechar={() => setMontando(null)}
        onEscolherMais={escolherDados}
      />
      <Visualizador
        aberto={aberto}
        onFechar={() => setAberto(null)}
        onSlide={(slide) => setAberto((a) => (a ? { ...a, slide } : a))}
      />
    </div>
  );
}

function Resumo({ icone: Icone, valor, rotulo }: { icone: typeof Layers; valor: string; rotulo: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 backdrop-blur sm:px-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icone className="h-3.5 w-3.5" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">{rotulo}</span>
      </div>
      <div className="mt-0.5 font-display text-xl font-bold tabular-nums sm:text-2xl">{valor}</div>
    </div>
  );
}

function BotaoBaixar({ modelo, className, size }: { modelo: TemplateModelo; className?: string; size?: "sm" | "default" }) {
  return (
    <Button asChild size={size} className={className}>
      <a href={modelo.arquivo} download={modelo.nomeDownload}>
        <Download className="h-4 w-4" /> Baixar PowerPoint
      </a>
    </Button>
  );
}

function CardModelo({
  modelo,
  qtdDados,
  onVer,
  onDados,
}: {
  modelo: TemplateModelo;
  qtdDados: number;
  onVer: (slide: number) => void;
  onDados: () => void;
}) {
  const miniaturas = [1, 4, 6, 9].filter((i) => i < modelo.slides.length);
  return (
    <article className="surface group flex flex-col overflow-hidden p-0">
      <button
        type="button"
        onClick={() => onVer(0)}
        className="relative block aspect-video w-full overflow-hidden bg-muted"
        aria-label={`Visualizar ${modelo.nome}`}
      >
        <img
          src={modelo.slides[0].imagem}
          alt={`Capa do modelo ${modelo.nome}`}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-900 shadow-lg">
            <Eye className="h-4 w-4" /> Visualizar
          </span>
        </span>
        <span className="absolute left-3 top-3 rounded-md bg-neutral-900/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          Modelo {modelo.numero}
        </span>
      </button>

      <div className="grid grid-cols-4 gap-1.5 border-b border-border/60 bg-muted/40 p-2">
        {miniaturas.map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => onVer(i)}
            className="overflow-hidden rounded-[4px] border border-border/60 bg-background transition hover:border-primary"
            title={modelo.slides[i].titulo}
          >
            <img src={modelo.slides[i].imagem} alt={modelo.slides[i].titulo} loading="lazy" className="aspect-video w-full object-cover" />
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">{modelo.categoria}</span>
            <h2 className="font-display text-lg font-bold leading-tight">{modelo.nome}</h2>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
            {modelo.slides.length} slides
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{modelo.descricao}</p>
        <div className="flex flex-wrap gap-1.5">
          {modelo.usos.map((u) => (
            <span key={u} className="rounded-md border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground">
              {u}
            </span>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row">
          {/* O download acontece dentro da prévia: a pessoa vê os slides antes de baixar. */}
          <Button className="sm:flex-1" onClick={() => onVer(0)}>
            <Eye className="h-4 w-4" /> Visualizar e baixar
          </Button>
          <Button variant="outline" className="relative sm:flex-1" onClick={onDados}>
            <Database className="h-4 w-4" />
            {qtdDados ? "Montar com dados" : "Adicionar dados do sistema"}
            {qtdDados > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {qtdDados}
              </span>
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          PowerPoint (.pptx) · 16:9 · {tamanhoMb(modelo.tamanho)}
        </p>
      </div>
    </article>
  );
}

function Visualizador({
  aberto,
  onFechar,
  onSlide,
}: {
  aberto: { modelo: TemplateModelo; slide: number } | null;
  onFechar: () => void;
  onSlide: (i: number) => void;
}) {
  const modelo = aberto?.modelo;
  const atual = aberto?.slide ?? 0;
  const total = modelo?.slides.length ?? 0;
  const trilho = useRef<HTMLDivElement>(null);

  const ir = useCallback(
    (i: number) => {
      if (!total) return;
      onSlide((i + total) % total);
    },
    [onSlide, total],
  );

  useEffect(() => {
    if (!modelo) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") ir(atual + 1);
      if (e.key === "ArrowLeft") ir(atual - 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [modelo, atual, ir]);

  useEffect(() => {
    trilho.current
      ?.querySelector<HTMLElement>(`[data-slide="${atual}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [atual]);

  // Pré-carrega o próximo slide para a navegação ficar instantânea
  useEffect(() => {
    if (!modelo) return;
    const prox = modelo.slides[(atual + 1) % total];
    if (prox) new Image().src = prox.imagem;
  }, [modelo, atual, total]);

  return (
    <Dialog open={!!modelo} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="flex max-h-[94vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        {modelo && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-3 pr-12">
              <div className="min-w-0">
                <DialogTitle className="truncate font-display text-lg font-bold">
                  Modelo {modelo.numero} — {modelo.nome}
                </DialogTitle>
                <DialogDescription className="truncate text-xs">
                  {modelo.slides.length} slides · PowerPoint 16:9 editável · {tamanhoMb(modelo.tamanho)}
                </DialogDescription>
              </div>
              <BotaoBaixar modelo={modelo} size="sm" />
            </div>

            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              <div className="flex min-w-0 flex-1 flex-col bg-muted/50 p-3 sm:p-5">
                <div className="relative overflow-hidden rounded-lg border border-border/70 bg-white shadow-sm">
                  <img
                    key={modelo.slides[atual].imagem}
                    src={modelo.slides[atual].imagem}
                    alt={`Slide ${atual + 1}: ${modelo.slides[atual].titulo}`}
                    className="aspect-video w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => ir(atual - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-neutral-900/70 p-2 text-white transition hover:bg-neutral-900"
                    aria-label="Slide anterior"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => ir(atual + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-neutral-900/70 p-2 text-white transition hover:bg-neutral-900"
                    aria-label="Próximo slide"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-semibold">{modelo.slides[atual].titulo}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {atual + 1} / {total}
                  </span>
                </div>
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border/70 bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Gostou do modelo? Baixe o PowerPoint e edite textos, gráficos, tabelas e imagens.
                  </p>
                  <BotaoBaixar modelo={modelo} className="shrink-0" />
                </div>
              </div>

              <div
                ref={trilho}
                className="flex gap-2 overflow-x-auto border-t border-border/70 p-3 lg:w-60 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:border-l lg:border-t-0"
              >
                {modelo.slides.map((s, i) => (
                  <button
                    key={s.imagem}
                    type="button"
                    data-slide={i}
                    onClick={() => ir(i)}
                    className={cn(
                      "group flex w-36 shrink-0 flex-col gap-1 rounded-md p-1 text-left transition lg:w-full",
                      i === atual ? "bg-primary/10" : "hover:bg-muted",
                    )}
                  >
                    <img
                      src={s.imagem}
                      alt=""
                      loading="lazy"
                      className={cn(
                        "aspect-video w-full rounded-[4px] border object-cover",
                        i === atual ? "border-primary ring-1 ring-primary" : "border-border/70",
                      )}
                    />
                    <span className="flex gap-1.5 px-0.5 text-[11px] leading-tight">
                      <span className="tabular-nums text-muted-foreground">{i + 1}</span>
                      <span className={cn("truncate", i === atual && "font-semibold")}>{s.titulo}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const TIPO_DADO: Record<string, string> = {
  kpis: "Indicadores",
  chart: "Gráfico",
  table: "Tabela",
  text: "Texto",
  section: "Divisória",
  cover: "Divisória",
};

function MontarComDados({
  modelo,
  onFechar,
  onEscolherMais,
}: {
  modelo: TemplateModelo | null;
  onFechar: () => void;
  onEscolherMais: (t: TemplateModelo) => void;
}) {
  const {
    templateDados,
    editarDadoTemplate,
    removerDadoTemplate,
    moverDadoTemplate,
    limparDadosTemplate,
  } = usePresentation();
  const [titulo, setTitulo] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [modo, setModo] = useState<ModoMontagem>("completo");
  const [gerando, setGerando] = useState(false);

  const itens = modelo ? (templateDados[modelo.id] ?? []) : [];
  const slidesDados = slidesDosDados(itens);
  const slidesModelo = modelo
    ? modo === "completo"
      ? modelo.slides.length
      : modelo.slides.filter((s) => s.tipo === "capa" || s.tipo === "encerramento").length
    : 0;

  const gerar = async () => {
    if (!modelo || !itens.length) return;
    setGerando(true);
    try {
      const base = titulo.trim() || `Fras-le Mobility - ${modelo.nome}`;
      await baixarTemplateComDados({
        templateId: modelo.id,
        nomeArquivo: `${base.replace(/[\\/:*?"<>|]+/g, "-")} - com dados.pptx`,
        itens,
        capa: { titulo: titulo.trim(), subtitulo: subtitulo.trim() },
        modo,
      });
      toast.success("PowerPoint gerado", {
        description: `${slidesModelo + slidesDados} slides no visual do modelo ${modelo.nome}.`,
      });
    } catch (e) {
      toast.error("Não foi possível gerar o PowerPoint", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setGerando(false);
    }
  };

  const opcoesModo: [ModoMontagem, string, string][] = modelo
    ? [
        [
          "completo",
          "Modelo completo + dados",
          `Todos os layouts do modelo e, antes do plano de ação, os slides com dados (${modelo.slides.length + slidesDados} slides).`,
        ],
        [
          "dados",
          "Só capa, dados e encerramento",
          `Apresentação enxuta, pronta para a reunião (${2 + slidesDados} slides).`,
        ],
      ]
    : [];

  return (
    <Dialog open={!!modelo} onOpenChange={(o) => !o && !gerando && onFechar()}>
      <DialogContent className="flex max-h-[94vh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        {modelo && (
          <>
            <div className="border-b border-border/70 px-5 py-3 pr-12">
              <DialogTitle className="font-display text-lg font-bold">
                Modelo {modelo.numero} — {modelo.nome} com dados do sistema
              </DialogTitle>
              <DialogDescription className="text-xs">
                Os dados escolhidos viram slides no visual do modelo, com gráficos e tabelas nativos e
                editáveis.
              </DialogDescription>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {itens.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
                  <Database className="h-7 w-7 text-muted-foreground" />
                  <p className="font-semibold">Nenhum dado escolhido ainda</p>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Navegue pelas abas do QualiHub e clique em <b>Adicionar</b> nos cards, gráficos e
                    tabelas que devem ir para o PowerPoint.
                  </p>
                  <Button onClick={() => onEscolherMais(modelo)}>
                    <Plus className="h-4 w-4" /> Escolher dados no sistema
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                      Título da capa
                      <Input
                        value={titulo}
                        onChange={(e) => setTitulo(e.target.value)}
                        placeholder={`Ex.: Reunião da Qualidade — ${new Date().toLocaleDateString("pt-BR", { month: "long" })}`}
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                      Subtítulo
                      <Input
                        value={subtitulo}
                        onChange={(e) => setSubtitulo(e.target.value)}
                        placeholder="Ex.: Resultados do mês e plano de ação"
                      />
                    </label>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {opcoesModo.map(([v, t, d]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setModo(v)}
                        className={cn(
                          "rounded-xl border p-3 text-left transition",
                          modo === v
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-foreground/30",
                        )}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <span
                            className={cn(
                              "h-3.5 w-3.5 rounded-full border-2",
                              modo === v ? "border-primary bg-primary" : "border-muted-foreground/50",
                            )}
                          />
                          {t}
                        </div>
                        <p className="mt-1 pl-5 text-xs text-muted-foreground">{d}</p>
                      </button>
                    ))}
                  </div>

                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
                      <h3 className="text-sm font-bold">Dados escolhidos ({itens.length})</h3>
                      <span className="text-[11px] text-muted-foreground">
                        Prévia do conteúdo — no PowerPoint sai no visual do modelo
                      </span>
                    </div>
                    <ol className="space-y-2">
                      {itens.map((it, i) => {
                        const spec = specDoItem(it);
                        return (
                          <li
                            key={it.id}
                            className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background p-3 sm:flex-row sm:items-center"
                          >
                            <div className="w-full shrink-0 overflow-hidden rounded-md border border-border/60 sm:w-48">
                              <SlideFrame>
                                <SlideCanvas
                                  title={it.title}
                                  subtitle={it.subtitle}
                                  spec={spec}
                                  theme="light"
                                />
                              </SlideFrame>
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                <span className="text-primary">{TIPO_DADO[spec.type] ?? "Slide"}</span>
                                <span>· {nomeDaAba(it.sourceRoute)}</span>
                              </div>
                              <Input
                                value={it.title}
                                onChange={(e) =>
                                  editarDadoTemplate(modelo.id, it.id, { title: e.target.value })
                                }
                                className="h-8 font-semibold"
                                aria-label="Título do slide"
                              />
                              <Input
                                value={it.subtitle ?? ""}
                                onChange={(e) =>
                                  editarDadoTemplate(modelo.id, it.id, { subtitle: e.target.value })
                                }
                                placeholder="Subtítulo (opcional)"
                                className="h-8 text-xs"
                                aria-label="Subtítulo do slide"
                              />
                            </div>
                            <div className="flex shrink-0 gap-1 sm:flex-col">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                disabled={i === 0}
                                onClick={() => moverDadoTemplate(modelo.id, it.id, -1)}
                                aria-label="Subir"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                disabled={i === itens.length - 1}
                                onClick={() => moverDadoTemplate(modelo.id, it.id, 1)}
                                aria-label="Descer"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => removerDadoTemplate(modelo.id, it.id)}
                                aria-label="Remover"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </div>
              )}
            </div>

            {itens.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-border/70 px-5 py-3 sm:flex-row sm:items-center">
                <Button variant="outline" onClick={() => onEscolherMais(modelo)} disabled={gerando}>
                  <Plus className="h-4 w-4" /> Adicionar mais dados
                </Button>
                <Button
                  variant="ghost"
                  className="text-muted-foreground"
                  disabled={gerando}
                  onClick={() => {
                    limparDadosTemplate(modelo.id);
                    onFechar();
                  }}
                >
                  Limpar dados
                </Button>
                <div className="flex-1" />
                <span className="text-xs text-muted-foreground">
                  {slidesModelo + slidesDados} slides
                </span>
                <Button onClick={gerar} disabled={gerando}>
                  {gerando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {gerando ? "Gerando…" : "Gerar PowerPoint"}
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
