import { useMemo, useState } from "react";
import {
  Bell,
  Bot,
  CheckCircle2,
  CircleAlert,
  Database,
  ExternalLink,
  Send,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  answerQualityQuestion,
  buildNotifications,
  calculateSupplierQualityScores,
  detectQualityAnomalies,
  type CopilotAnswer,
  type QualityNotification,
} from "@/lib/quality-intelligence";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Quais fornecedores estão piorando?",
  "Quais são as 10 maiores reprovações?",
  "Quais RNC estão atrasadas?",
  "Por que o IDF mudou?",
  "Quais problemas estão se repetindo?",
];

function currentData(
  data: DashboardData | undefined,
  filtered: Pick<DashboardData, "idf" | "alerta" | "rnc">,
): DashboardData {
  return {
    idf: filtered.idf,
    alerta: filtered.alerta,
    rnc: filtered.rnc,
    fornecedores: [],
    divisoes: data?.divisoes ?? [],
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
  const important = notifications.filter(
    (item) => item.level === "critico" || item.level === "alto",
  ).length;

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="relative" title="Notificações da qualidade">
            <Bell className="h-4 w-4" />
            <span className="hidden xl:inline ml-1">Notificações</span>
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
        className="hidden 2xl:flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5 text-[10px] text-muted-foreground"
        title={fetchedAt ? new Date(fetchedAt).toLocaleString("pt-BR") : "Aguardando leitura"}
      >
        <Database
          className={cn(
            "h-3.5 w-3.5",
            isFetching ? "animate-pulse text-amber-500" : "text-emerald-500",
          )}
        />
        {isFetching ? "Sincronizando" : "Dados online"}
      </div>
      <QualityCopilotButton data={scoped} />
    </>
  );
}

function NotificationRow({ item }: { item: QualityNotification }) {
  const critical = item.level === "critico" || item.level === "alto";
  return (
    <div className={cn("rounded-xl border p-3", critical && "border-red-500/30 bg-red-500/5")}>
      <div className="flex gap-3">
        {critical ? (
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
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

function QualityCopilotButton({ data }: { data: DashboardData }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<CopilotAnswer | null>(null);

  const ask = (value = question) => {
    const clean = value.trim();
    if (!clean) return;
    setQuestion(clean);
    setAnswer(answerQualityQuestion(data, clean));
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
          title="Abrir Quali Copilot"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden xl:inline">QualiAI</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-xl">
        <SheetHeader className="border-b bg-gradient-to-br from-primary/10 to-transparent p-6 text-left">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <Bot className="h-4 w-4" /> Quality Copilot
          </div>
          <SheetTitle>QualiAI</SheetTitle>
          <SheetDescription>
            Consulta analítica com contexto do recorte atual. As respostas são calculadas antes de
            serem exibidas.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="space-y-5 p-6">
            {!answer && (
              <div className="rounded-2xl border bg-muted/25 p-5">
                <p className="text-sm font-semibold">O que você quer investigar?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Experimente uma das análises abaixo ou informe o nome de um fornecedor.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => ask(suggestion)}
                      className="rounded-full border bg-background px-3 py-1.5 text-left text-xs hover:border-primary hover:text-primary"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {answer && (
              <AnswerCard
                answer={answer}
                onSupplier={(supplier) => {
                  window.location.href = `/fornecedor/${encodeURIComponent(supplier)}`;
                }}
              />
            )}
          </div>
        </ScrollArea>
        <div className="border-t bg-background p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              ask();
            }}
            className="flex gap-2"
          >
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Pergunte sobre risco, fornecedor, IDF, RNC…"
            />
            <Button type="submit" size="icon" aria-label="Enviar pergunta">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Não há geração de números: o Copilot referencia somente os campos carregados pelo
            QualiHub.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AnswerCard({
  answer,
  onSupplier,
}: {
  answer: CopilotAnswer;
  onSupplier: (supplier: string) => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border bg-card">
      <div className="border-b bg-primary/5 p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Sparkles className="h-4 w-4" /> Análise QualiAI
        </div>
        <h3 className="mt-2 text-lg font-semibold">{answer.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer.summary}</p>
      </div>
      <div className="space-y-2 p-5">
        {answer.bullets.length ? (
          answer.bullets.map((bullet, index) => (
            <div key={`${bullet}-${index}`} className="flex gap-3 rounded-xl bg-muted/35 p-3">
              <span className="font-mono text-[10px] text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="text-xs leading-relaxed">{bullet}</p>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">
            Dados insuficientes para detalhar esta análise.
          </p>
        )}
        {answer.supplier && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSupplier(answer.supplier!)}
            className="mt-2 gap-2"
          >
            Ver fornecedor 360° <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
        <div className="pt-2 text-[10px] text-muted-foreground">
          <Badge variant="outline" className="mr-2 text-[9px]">
            Base da resposta
          </Badge>
          {answer.dataBasis}
        </div>
      </div>
    </article>
  );
}
