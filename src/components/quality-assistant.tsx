import { useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  CircleAlert,
  Database,
  Send,
  Sparkles,
} from "lucide-react";

import { askQualiAI } from "@/lib/quali-ai.functions";
import { Button } from "@/components/ui/button";
import agenteia from "@/assets/agenteia.png";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  buildNotifications,
  calculateSupplierQualityScores,
  detectQualityAnomalies,
  type QualityNotification,
} from "@/lib/quality-intelligence";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Quais fornecedores estão piorando?",
  "Quais são as 10 maiores reprovações?",
  "Quais RNC estão atrasadas?",
  "Qual é a situação atual do QLD e QLDE?",
  "Faça um resumo executivo da qualidade.",
];

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function buildQualiAIContext(
  data: DashboardData,
  operational: {
    recebidas: number;
    inspecionadas: number;
  },
  question: string,
) {
  const q = question.toLowerCase();

  const wantsQLD =
    q.includes("qld") ||
    q.includes("qlde") ||
    q.includes("bloquead") ||
    q.includes("estoque") ||
    q.includes("exposição") ||
    q.includes("exposicao");

  const wantsRNC =
    q.includes("rnc") ||
    q.includes("não conform") ||
    q.includes("nao conform");

  const wantsAlert =
    q.includes("alerta") ||
    q.includes("risco");

  const wantsSupplier =
    q.includes("fornecedor") ||
    q.includes("ppm") ||
    q.includes("reprova") ||
    q.includes("defeito") ||
    q.includes("problema") ||
    q.includes("qualidade");

  const wantsExecutive =
    q.includes("resumo") ||
    q.includes("reunião") ||
    q.includes("reuniao") ||
    q.includes("executiv") ||
    q.includes("indicador") ||
    q.includes("resultado") ||
    q.includes("mês") ||
    q.includes("mes");

  const context: Record<string, unknown> = {
    periodo: {
      fetchedAt: data.fetchedAt,
    },

    indicadores: {
      totalIDF: data.idf.length,
      totalAlertas: data.alerta.length,
      totalRNC: data.rnc.length,
      recebidas: operational.recebidas,
      inspecionadas: operational.inspecionadas,

      eficiencia:
        operational.recebidas > 0
          ? Number(
              (
                (operational.inspecionadas /
                  operational.recebidas) *
                100
              ).toFixed(2),
            )
          : 0,
    },
  };

  // =========================
  // QLD / QLDE
  // =========================

  if (wantsQLD || wantsExecutive) {
    const rows = data.qldQlde ?? [];

    const qld = rows.filter(
      (item) =>
        String(item.deposito).trim() === "522",
    );

    const qlde = rows.filter(
      (item) =>
        String(item.deposito).trim() === "523",
    );

    context.qldQlde = {
      qld: {
        deposito: "522",

        quantidade: qld.reduce(
          (total, item) =>
            total + (Number(item.qtdeLivre) || 0),
          0,
        ),

        valor: qld.reduce(
          (total, item) =>
            total + (Number(item.valorLivre) || 0),
          0,
        ),

        skus: new Set(
          qld.map((item) => item.item).filter(Boolean),
        ).size,
      },

      qlde: {
        deposito: "523",

        quantidade: qlde.reduce(
          (total, item) =>
            total +
            (Number(item.qtdeBloqueada) || 0),
          0,
        ),

        valor: qlde.reduce(
          (total, item) =>
            total +
            (Number(item.valorBloqueado) || 0),
          0,
        ),

        skus: new Set(
          qlde.map((item) => item.item).filter(Boolean),
        ).size,
      },

      itens: rows
        .map((item) => ({
          item: item.item,
          deposito: item.deposito,
          qtdeLivre: item.qtdeLivre,
          valorLivre: item.valorLivre,
          qtdeBloqueada: item.qtdeBloqueada,
          valorBloqueado: item.valorBloqueado,
          acao: item.acao,
          check: item.check,
          atencao: item.atencao,
        }))
        .sort(
          (a, b) =>
            Math.max(
              Number(b.valorLivre) || 0,
              Number(b.valorBloqueado) || 0,
            ) -
            Math.max(
              Number(a.valorLivre) || 0,
              Number(a.valorBloqueado) || 0,
            ),
        )
        .slice(0, 30),
    };
  }

  // =========================
  // RNC
  // =========================

  if (wantsRNC || wantsExecutive) {
    context.rnc = data.rnc
      .slice(0, 100)
      .map((item) => ({
        rnc: item.rnc,
        item: item.item,
        assunto: item.assunto,
        cliente: item.cliente,
        status: item.statusRNC,
      }));
  }

  // =========================
  // ALERTAS
  // =========================

  if (wantsAlert || wantsExecutive) {
    context.alertas = data.alerta
      .slice(0, 100)
      .map((item) => ({
        numero: item.numero,
        item: item.item,
        fornecedor: item.fornecedor,
        problema: item.problema,
        finalizado: item.finalizado,
        statusEnvio: item.statusEnvio,
      }));
  }

  // =========================
  // IDF / FORNECEDORES
  // =========================

  if (wantsSupplier || wantsExecutive) {
    const supplierMap = new Map<
      string,
      {
        fornecedor: string;
        inspecoes: number;
        reprovacoes: number;
        recorrencias: number;
      }
    >();

    for (const row of data.idf) {
      const fornecedor = String(
        row.fornecedor ?? "",
      ).trim();

      if (!fornecedor) continue;

      const current =
        supplierMap.get(fornecedor) ?? {
          fornecedor,
          inspecoes: 0,
          reprovacoes: 0,
          recorrencias: 0,
        };

      current.inspecoes += 1;

      if (
        String(row.status ?? "")
          .toLowerCase()
          .includes("reprov")
      ) {
        current.reprovacoes += 1;
      }

      if (
        (Number(row.recorrencia) || 0) > 0
      ) {
        current.recorrencias += 1;
      }

      supplierMap.set(
        fornecedor,
        current,
      );
    }

    context.fornecedores = [
      ...supplierMap.values(),
    ]
      .map((supplier) => ({
        ...supplier,

        taxaReprovacao:
          supplier.inspecoes > 0
            ? Number(
                (
                  (supplier.reprovacoes /
                    supplier.inspecoes) *
                  100
                ).toFixed(2),
              )
            : 0,
      }))
      .sort(
        (a, b) =>
          b.reprovacoes -
          a.reprovacoes,
      )
      .slice(0, 30);
  }

  return context;
}

function currentData(
  data: DashboardData | undefined,
  filtered: Pick<
    DashboardData,
    "idf" | "alerta" | "rnc"
  >,
): DashboardData {
  return {
    idf: filtered.idf,
    alerta: filtered.alerta,
    rnc: filtered.rnc,

    fornecedores:
      data?.fornecedores ?? [],

    divisoes:
      data?.divisoes ?? [],

    qldQlde:
      data?.qldQlde ?? [],

    fetchedAt:
      data?.fetchedAt ?? "",
  };
}

export function QualityHeaderIntelligence({
  isFetching,
  fetchedAt,
}: {
  isFetching: boolean;
  fetchedAt?: string;
}) {
  const {
    data,
    filtered,
    efficiency,
  } = useDashboardFiltered();

  const scoped = useMemo(
    () =>
      currentData(
        data,
        filtered,
      ),
    [data, filtered],
  );

  const scores = useMemo(
    () =>
      calculateSupplierQualityScores(
        scoped,
      ),
    [scoped],
  );

  const anomalies = useMemo(
    () =>
      detectQualityAnomalies(
        scoped.idf,
      ),
    [scoped.idf],
  );

  const notifications = useMemo(
    () =>
      buildNotifications(
        scoped,
        scores,
        anomalies,
      ),
    [
      scoped,
      scores,
      anomalies,
    ],
  );

  const important =
    notifications.filter(
      (item) =>
        item.level === "critico" ||
        item.level === "alto",
    ).length;

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="relative"
            title="Notificações da qualidade"
          >
            <Bell className="h-4 w-4" />

            <span className="ml-1 hidden xl:inline">
              Notificações
            </span>

            {important > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                {important}
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-[min(92vw,420px)] p-0"
        >
          <div className="border-b p-4">
            <p className="text-sm font-semibold">
              Central de notificações
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Eventos derivados dos dados
              reais do recorte.
            </p>
          </div>

          <ScrollArea className="max-h-96">
            <div className="space-y-2 p-3">
              {notifications.map(
                (item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                  />
                ),
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <div
        className="hidden items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5 text-[10px] text-muted-foreground 2xl:flex"
        title={
          fetchedAt
            ? new Date(
                fetchedAt,
              ).toLocaleString(
                "pt-BR",
              )
            : "Aguardando leitura"
        }
      >
        <Database
          className={cn(
            "h-3.5 w-3.5",
            isFetching
              ? "animate-pulse text-amber-500"
              : "text-emerald-500",
          )}
        />

        {isFetching
          ? "Sincronizando"
          : "Dados online"}
      </div>

      <QualityCopilotButton
        data={scoped}
        operational={{
          recebidas:
            efficiency.recebidas,

          inspecionadas:
            efficiency.inspecionadas,
        }}
      />
    </>
  );
}

function NotificationRow({
  item,
}: {
  item: QualityNotification;
}) {
  const critical =
    item.level === "critico" ||
    item.level === "alto";

  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        critical &&
          "border-red-500/30 bg-red-500/5",
      )}
    >
      <div className="flex gap-3">
        {critical ? (
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        )}

        <div>
          <p className="text-xs font-semibold">
            {item.title}
          </p>

          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {item.description}
          </p>
        </div>
      </div>
    </div>
  );
}

function QualityCopilotButton({
  data,
  operational,
}: {
  data: DashboardData;

  operational: {
    recebidas: number;
    inspecionadas: number;
  };
}) {
  const [
    question,
    setQuestion,
  ] = useState("");

  const [
    messages,
    setMessages,
  ] = useState<
    ChatMessage[]
  >([]);

  const [
    isThinking,
    setIsThinking,
  ] = useState(false);

  const [
    aiError,
    setAiError,
  ] = useState<
    string | null
  >(null);

  const ask = async (
    value = question,
  ) => {
    const clean =
      value.trim();

    if (
      !clean ||
      isThinking
    ) {
      return;
    }

    const userMessage: ChatMessage =
      {
        id: crypto.randomUUID(),
        role: "user",
        content: clean,
      };

    const previousMessages =
      messages;

    setMessages(
      (current) => [
        ...current,
        userMessage,
      ],
    );

    setQuestion("");
    setIsThinking(true);
    setAiError(null);

    try {
      const result =
        await askQualiAI({
          data: {
            question: clean,

            history:
              previousMessages
                .slice(-10)
                .map(
                  (
                    message,
                  ) => ({
                    role:
                      message.role,
                    content:
                      message.content,
                  }),
                ),

            context:
              buildQualiAIContext(
                data,
                operational,
                clean,
              ),
          },
        });

      const assistantMessage: ChatMessage =
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            result.answer,
        };

      setMessages(
        (current) => [
          ...current,
          assistantMessage,
        ],
      );
    } catch (error) {
      console.error(
        "[QualiAI]",
        error,
      );

      setAiError(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar o QualiAI.",
      );
    } finally {
      setIsThinking(false);
    }
  };

  const newConversation =
    () => {
      setMessages([]);
      setQuestion("");
      setAiError(null);
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
          <img
            src={agenteia}
            alt="QualiAI"
            className="h-5 w-5 rounded-full object-cover"
          />

          <span className="hidden xl:inline">
            QualiAI
          </span>
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b bg-gradient-to-br from-primary/10 via-background to-background p-6 text-left">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <img
                src={agenteia}
                alt="Avatar QualiAI"
                className="h-20 w-20 rounded-2xl border border-primary/30 object-cover shadow-lg"
              />

              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-emerald-500">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <Sparkles className="h-4 w-4" />
                Quality Copilot
              </div>

              <SheetTitle className="mt-1 text-xl">
                QualiAI
              </SheetTitle>

              {messages.length >
                0 && (
                <button
                  type="button"
                  onClick={
                    newConversation
                  }
                  className="mt-1 text-xs font-medium text-primary hover:underline"
                >
                  + Nova conversa
                </button>
              )}

              <SheetDescription className="mt-2 leading-relaxed">
                Seu assistente de
                inteligência da
                qualidade. Analiso
                fornecedores,
                defeitos, SKUs,
                RNCs, QLD/QLDE e
                tendências do
                recorte atual.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-5 p-6">
            {messages.length ===
              0 && (
              <div className="overflow-hidden rounded-2xl border bg-muted/25">
                <div className="flex items-center gap-4 border-b bg-primary/5 p-5">
                  <img
                    src={
                      agenteia
                    }
                    alt="QualiAI"
                    className="h-14 w-14 rounded-xl border border-primary/20 object-cover"
                  />

                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                      <Sparkles className="h-4 w-4" />
                      Análise
                      QualiAI
                    </div>

                    <p className="mt-1 text-sm font-semibold">
                      O que você
                      quer
                      investigar?
                    </p>
                  </div>
                </div>

                <div className="p-5">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Posso analisar
                    os dados do
                    QualiHub ou
                    ajudar com
                    e-mails,
                    relatórios,
                    resumos,
                    planos de ação
                    e outras
                    atividades
                    profissionais.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {SUGGESTIONS.map(
                      (
                        suggestion,
                      ) => (
                        <button
                          key={
                            suggestion
                          }
                          type="button"
                          disabled={
                            isThinking
                          }
                          onClick={() =>
                            ask(
                              suggestion,
                            )
                          }
                          className="rounded-full border bg-background px-3 py-1.5 text-left text-xs transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                        >
                          {
                            suggestion
                          }
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}

            {messages.map(
              (message) => (
                <div
                  key={
                    message.id
                  }
                  className={cn(
                    "flex w-full",
                    message.role ===
                      "user"
                      ? "justify-end"
                      : "justify-start",
                  )}
                >
                  {message.role ===
                  "assistant" ? (
                    <div className="flex max-w-[92%] gap-3">
                      <img
                        src={
                          agenteia
                        }
                        alt="QualiAI"
                        className="h-9 w-9 shrink-0 rounded-xl border border-primary/20 object-cover"
                      />

                      <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-xs font-semibold text-primary">
                            QualiAI
                          </span>

                          <Sparkles className="h-3 w-3 text-primary" />
                        </div>

                        <div className="rounded-2xl rounded-tl-sm border bg-card p-4 shadow-sm">
                          <p className="whitespace-pre-wrap text-sm leading-6">
                            {
                              message.content
                            }
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              navigator.clipboard.writeText(
                                message.content,
                              )
                            }
                            className="mt-3 text-[10px] text-muted-foreground transition-colors hover:text-primary"
                          >
                            Copiar
                            resposta
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm">
                      <p className="whitespace-pre-wrap">
                        {
                          message.content
                        }
                      </p>
                    </div>
                  )}
                </div>
              ),
            )}

            {isThinking && (
              <div className="flex items-center gap-3">
                <img
                  src={agenteia}
                  alt="QualiAI"
                  className="h-9 w-9 rounded-xl border border-primary/20 object-cover"
                />

                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-xs text-muted-foreground">
                  <Sparkles className="h-4 w-4 animate-pulse text-primary" />

                  QualiAI está
                  analisando...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t bg-background p-4">
          <form
            onSubmit={(
              event,
            ) => {
              event.preventDefault();
              ask();
            }}
            className="flex gap-2"
          >
            <Input
              value={
                question
              }
              onChange={(
                event,
              ) =>
                setQuestion(
                  event.target
                    .value,
                )
              }
              placeholder="Converse com o QualiAI..."
              disabled={
                isThinking
              }
            />

            <Button
              type="submit"
              size="icon"
              aria-label="Enviar pergunta"
              disabled={
                isThinking ||
                !question.trim()
              }
            >
              {isThinking ? (
                <Sparkles className="h-4 w-4 animate-pulse" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>

          {aiError && (
            <p className="mt-2 text-xs text-destructive">
              {aiError}
            </p>
          )}

          <p className="mt-2 text-[10px] text-muted-foreground">
            Indicadores são
            fundamentados nos dados
            carregados pelo QualiHub.
            Análises, recomendações e
            textos são gerados pelo
            QualiAI.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}