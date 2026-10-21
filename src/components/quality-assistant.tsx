import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  Bell,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  Copy,
  Database,
  FileText,
  Globe,
  Link2,
  Mail,
  MessageSquarePlus,
  Search,
  Sparkles,
  TrendingDown,
  Boxes,
} from "lucide-react";

import { askQualiAI, type QualiAISource } from "@/lib/quali-ai.functions";
import { buildQualiAIContext } from "@/lib/quali-ai-context";
import { useOrganograma } from "@/lib/org";
import { Button } from "@/components/ui/button";
import agenteia from "@/assets/agenteia.png";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useDashboardFiltered } from "@/hooks/use-data";
import { useFilters } from "@/hooks/use-dashboard";
import {
  buildNotifications,
  calculateSupplierQualityScores,
  detectQualityAnomalies,
  type QualityNotification,
} from "@/lib/quality-intelligence";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";

const SUGGESTIONS: { icon: ReactNode; title: string; prompt: string; tag: string }[] = [
  {
    icon: <TrendingDown className="h-4 w-4" />,
    tag: "Dados",
    title: "Fornecedores piorando",
    prompt: "Quais fornecedores estão piorando nos últimos 90 dias e por quê?",
  },
  {
    icon: <FileText className="h-4 w-4" />,
    tag: "Dados",
    title: "Resumo para a reunião",
    prompt: "Faça um resumo executivo da qualidade para a reunião mensal.",
  },
  {
    icon: <Boxes className="h-4 w-4" />,
    tag: "Dados",
    title: "Situação do QLD / QLDE",
    prompt: "Qual é a situação do QLD e QLDE e quais itens estão sem motivo?",
  },
  {
    icon: <BookOpenCheck className="h-4 w-4" />,
    tag: "Web",
    title: "IATF 16949 na prática",
    prompt:
      "Pesquise o que a IATF 16949 exige para controle de produto não conforme e cite as fontes.",
  },
  {
    icon: <Globe className="h-4 w-4" />,
    tag: "Web",
    title: "Notícias de um fornecedor",
    prompt:
      "Pesquise notícias recentes sobre o fornecedor mais crítico do recorte e resuma com fontes.",
  },
  {
    icon: <Mail className="h-4 w-4" />,
    tag: "Redação",
    title: "E-mail pedindo 8D",
    prompt:
      "Escreva um e-mail ao fornecedor mais crítico pedindo contenção em 24h e plano de ação 8D.",
  },
];

const CAPABILITIES = [
  { icon: <Database className="h-3 w-3" />, label: "Dados do QualiHub" },
  { icon: <Search className="h-3 w-3" />, label: "Pesquisa na web" },
  { icon: <Link2 className="h-3 w-3" />, label: "Lê links" },
  { icon: <Mail className="h-3 w-3" />, label: "Redige textos" },
];

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: QualiAISource[];
  webQueries?: string[];
  at?: string;
};

const CHAT_KEY = "qf-qualiai-chat";

function currentData(
  data: DashboardData | undefined,
  filtered: Pick<DashboardData, "idf" | "alerta" | "rnc">,
): DashboardData {
  return {
    idf: filtered.idf,
    alerta: filtered.alerta,
    rnc: filtered.rnc,
    fornecedores: data?.fornecedores ?? [],
    divisoes: data?.divisoes ?? [],
    qldQlde: data?.qldQlde ?? [],
    fetchedAt: data?.fetchedAt ?? "",
  };
}

export function QualityHeaderIntelligence({
  isFetching,
  fetchedAt,
}: {
  isFetching: boolean;
  fetchedAt?: string;
}) {
  const { data, filtered } = useDashboardFiltered();
  const scoped = useMemo(() => currentData(data, filtered), [data, filtered]);
  const scores = useMemo(() => calculateSupplierQualityScores(scoped), [scoped]);
  const anomalies = useMemo(() => detectQualityAnomalies(scoped.idf), [scoped.idf]);
  const notifications = useMemo(
    () => buildNotifications(scoped, scores, anomalies),
    [scoped, scores, anomalies],
  );
  const important = notifications.filter((n) => n.level === "critico" || n.level === "alto").length;

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="relative" title="Notificações da qualidade">
            <Bell className="h-4 w-4" />
            <span className="ml-1 hidden xl:inline">Notificações</span>
            {important > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                {important}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(92vw,420px)] p-0">
          <div className="border-b p-4">
            <p className="text-sm font-semibold">Central de notificações</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Eventos derivados dos dados reais do recorte.
            </p>
          </div>
          <ScrollArea className="max-h-96">
            <div className="space-y-2 p-3">
              {notifications.map((item) => (
                <NotificationRow key={item.id} item={item} />
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <div
        className="hidden items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5 text-[10px] text-muted-foreground 2xl:flex"
        title={fetchedAt ? new Date(fetchedAt).toLocaleString("pt-BR") : "Aguardando leitura"}
      >
        <Database
          className={cn("h-3.5 w-3.5", isFetching ? "animate-pulse text-warning" : "text-success")}
        />
        {isFetching ? "Sincronizando" : "Dados online"}
      </div>

      <QualiAIButton data={scoped} />
    </>
  );
}

function NotificationRow({ item }: { item: QualityNotification }) {
  const critical = item.level === "critico" || item.level === "alto";
  return (
    <div
      className={cn("rounded-xl border p-3", critical && "border-destructive/30 bg-destructive/5")}
    >
      <div className="flex gap-3">
        {critical ? (
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        )}
        <div>
          <p className="text-xs font-semibold">{item.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
        </div>
      </div>
    </div>
  );
}

const hostOf = (uri: string) => {
  try {
    return new URL(uri).hostname.replace(/^www\./, "");
  } catch {
    return uri;
  }
};

function QualiAIButton({ data }: { data: DashboardData }) {
  const ask = useServerFn(askQualiAI);
  const { efficiency } = useDashboardFiltered();
  const { filters } = useFilters();
  const org = useOrganograma();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [web, setWeb] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // A conversa continua ao trocar de tela ou recarregar a página.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(CHAT_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch {
      /* sem armazenamento */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      /* sem armazenamento */
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  // Caixa de texto cresce com o conteúdo.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [question]);

  const now = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const send = async (value = question) => {
    const clean = value.trim();
    if (!clean || thinking) return;
    const history = messages.slice(-12).map((m) => ({ role: m.role, content: m.content }));
    setMessages((c) => [
      ...c,
      { id: crypto.randomUUID(), role: "user", content: clean, at: now() },
    ]);
    setQuestion("");
    setThinking(true);
    setError(null);
    try {
      const activeFilters = Object.fromEntries(
        Object.entries(filters).filter(([, v]) =>
          Array.isArray(v) ? v.length > 0 : Boolean(v) && v !== "todas",
        ),
      );
      const context = buildQualiAIContext({
        data,
        efficiency,
        filtros: activeFilters,
        org: org.data?.org,
      });
      const result = await ask({ data: { question: clean, history, context, web } });
      setMessages((c) => [
        ...c,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.answer,
          sources: result.sources,
          webQueries: result.webQueries,
          at: now(),
        },
      ]);
    } catch (e) {
      console.error("[QualiAI]", e);
      setError(e instanceof Error ? e.message : "Não foi possível consultar o QualiAI.");
    } finally {
      setThinking(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="gap-2 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
          title="Abrir QualiAI"
        >
          <img src={agenteia} alt="" className="h-5 w-5 rounded-full object-cover" />
          <span className="hidden xl:inline">QualiAI</span>
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l p-0 sm:max-w-2xl lg:max-w-[52rem]"
      >
        {/* Cabeçalho */}
        <SheetHeader className="relative overflow-hidden border-b p-0 text-left">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex items-center gap-4 py-6 pl-6 pr-14">
            <div className="relative shrink-0">
              <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/40 p-[2px] shadow-lg shadow-primary/30">
                <img
                  src={agenteia}
                  alt="Avatar QualiAI"
                  className="h-16 w-16 rounded-[14px] bg-background object-cover"
                />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-success">
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white/80" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="font-display text-2xl">QualiAI</SheetTitle>
              <SheetDescription className="mt-0.5 text-xs">
                Online · Google Gemini · sem custo de créditos
              </SheetDescription>
            </div>
            {messages.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setMessages([]);
                  setError(null);
                }}
                className="gap-1.5"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" /> Nova conversa
              </Button>
            )}
          </div>
          <div className="relative flex flex-wrap gap-1.5 px-6 pb-4">
            {CAPABILITIES.map((c) => (
              <span key={c.label} className="chip">
                {c.icon} {c.label}
              </span>
            ))}
          </div>
        </SheetHeader>

        {/* Conversa */}
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 px-6 py-6">
            {messages.length === 0 && (
              <div>
                <h3 className="font-display text-xl font-semibold">
                  Olá! Como posso ajudar a Qualidade hoje?
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Analiso todo o recorte filtrado do QualiHub — inspeções, PPM, fornecedores, RNC,
                  alertas, QLD/QLDE e equipe — e busco na internet quando a resposta não está nos
                  dados.
                </p>
                <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.title}
                      type="button"
                      disabled={thinking}
                      onClick={() => send(s.prompt)}
                      className="group flex items-start gap-3 rounded-xl border bg-card p-3.5 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md disabled:opacity-50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                        {s.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          {s.title}
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {s.tag}
                          </span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                          {s.prompt}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex flex-col items-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm shadow-primary/20">
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                  {m.at && <span className="mt-1 text-[10px] text-muted-foreground">{m.at}</span>}
                </div>
              ) : (
                <div key={m.id} className="flex gap-3">
                  <img
                    src={agenteia}
                    alt=""
                    className="mt-1 h-8 w-8 shrink-0 rounded-lg border border-primary/20 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2 text-xs">
                      <span className="font-semibold text-primary">QualiAI</span>
                      {m.at && <span className="text-muted-foreground">{m.at}</span>}
                    </div>
                    <div className="rounded-2xl rounded-tl-md border bg-card px-5 py-4 shadow-sm">
                      <Markdown content={m.content} />

                      {m.webQueries && m.webQueries.length > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Search className="h-3 w-3" /> Pesquisou:
                          {m.webQueries.slice(0, 3).map((q) => (
                            <span key={q} className="rounded-md bg-muted px-1.5 py-0.5">
                              {q}
                            </span>
                          ))}
                        </div>
                      )}
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {m.sources.map((s, i) => (
                            <a
                              key={s.uri}
                              href={s.uri}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-2.5 py-2 transition hover:border-primary/50"
                              title={s.title}
                            >
                              <img
                                src={`https://www.google.com/s2/favicons?domain=${hostOf(s.uri)}&sz=32`}
                                alt=""
                                className="h-4 w-4 shrink-0 rounded"
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-medium">
                                  {i + 1}. {s.title}
                                </span>
                                <span className="block truncate text-[10px] text-muted-foreground">
                                  {hostOf(s.uri)}
                                </span>
                              </span>
                            </a>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-3 border-t pt-2.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(m.content);
                            setCopied(m.id);
                            window.setTimeout(
                              () => setCopied((c) => (c === m.id ? null : c)),
                              2000,
                            );
                          }}
                          className={cn(
                            "inline-flex items-center gap-1 text-[11px] transition-colors",
                            copied === m.id
                              ? "font-medium text-success"
                              : "text-muted-foreground hover:text-primary",
                          )}
                        >
                          <Copy className="h-3 w-3" />
                          {copied === m.id ? "Copiado" : "Copiar resposta"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ),
            )}

            {thinking && (
              <div className="flex gap-3">
                <img
                  src={agenteia}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-lg border border-primary/20 object-cover"
                />
                <div className="flex items-center gap-3 rounded-2xl rounded-tl-md border bg-card px-4 py-3 text-xs text-muted-foreground">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </span>
                  {web ? "Analisando os dados e pesquisando na web…" : "Analisando os dados…"}
                </div>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </div>
            )}
            <div ref={endRef} />
          </div>
        </ScrollArea>

        {/* Composer */}
        <div className="border-t bg-background/80 p-4 backdrop-blur">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="rounded-2xl border bg-card shadow-sm transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15"
          >
            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Pergunte sobre os dados, peça um e-mail ou cole um link…"
              disabled={thinking}
              className="block max-h-[180px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
              <button
                type="button"
                onClick={() => setWeb((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                  web
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Permite que o QualiAI pesquise na internet"
              >
                <Globe className="h-3.5 w-3.5" /> Pesquisa na web {web ? "ligada" : "desligada"}
              </button>
              <div className="flex items-center gap-2">
                <span className="hidden text-[10px] text-muted-foreground sm:inline">
                  Enter envia · Shift+Enter quebra linha
                </span>
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Enviar pergunta"
                  disabled={thinking || !question.trim()}
                  className="h-8 w-8 rounded-full"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Os números vêm dos dados do QualiHub. Análises e textos são gerados por IA — confira
            antes de enviar.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Markdown({ content }: { content: string }) {
  return (
    <div className="min-w-0 overflow-hidden text-sm leading-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-5 font-display text-lg font-bold first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-5 font-display text-base font-bold first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-sm font-bold text-primary first:mt-0">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-3 leading-6 last:mb-0">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 ml-5 list-disc space-y-1 marker:text-primary">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 ml-5 list-decimal space-y-1 marker:font-semibold marker:text-primary">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1 leading-6">{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 rounded-r-lg border-l-2 border-primary bg-primary/5 py-1 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-4 max-w-full overflow-x-auto rounded-xl border">
              <table className="w-full table-auto border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/70">{children}</thead>,
          th: ({ children }) => (
            <th className="whitespace-normal break-words border-b px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="whitespace-normal break-words border-b px-3 py-2 align-top">
              {children}
            </td>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
