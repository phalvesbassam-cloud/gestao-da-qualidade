// QualiAI — assistente da Qualidade usando o Google Gemini (plano gratuito).
//
// Não usa créditos pagos: basta uma chave gratuita do Google AI Studio
// (https://aistudio.google.com/apikey) configurada em GEMINI_API_KEY.
// O Gemini responde com base no contexto do QualiHub e, quando precisa,
// pesquisa na web (Google Search) e lê páginas citadas pelo usuário (URL context).
import { createServerFn } from "@tanstack/react-start";

type QualiAIMessage = { role: "user" | "assistant"; content: string };

type QualiAIInput = {
  question: string;
  history?: QualiAIMessage[];
  /** Contexto do QualiHub já resumido no navegador (JSON). */
  context?: string;
  /** Permite pesquisar na internet (padrão: sim). */
  web?: boolean;
};

export type QualiAISource = { title: string; uri: string };

type PresentationAIInput = {
  prompt: string;
  preset: "diaria" | "mensal" | "fornecedor" | null;
  slides: Array<{
    id: string;
    title: string;
    subtitle?: string;
    type: string;
    sourceRoute?: string;
    data?: unknown;
  }>;
};

type PresentationAIPlan = {
  presentationTitle: string;
  presentationSubtitle: string;
  orderedSlideIds: string[];
  titleUpdates: Array<{ id: string; title: string; subtitle: string }>;
  supportSlides: Array<{
    position: "start" | "end";
    title: string;
    subtitle: string;
    notes: string;
  }>;
};

const API = "https://generativelanguage.googleapis.com/v1beta/models";

/** Modelos tentados em ordem (o primeiro que responder vale). */
function models() {
  const preferred = process.env.GEMINI_MODEL?.trim();
  return [
    preferred,
    // Os modelos mais novos (3.8, flash-latest) vivem sobrecarregados no plano grátis;
    // estes responderam em ~8 s nos testes. O "lite" é a reserva rápida.
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
  ].filter((m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i);
}

function apiKey() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "QualiAI sem chave: crie uma chave gratuita em https://aistudio.google.com/apikey e configure GEMINI_API_KEY no servidor.",
    );
  }
  return key;
}

type GeminiPart = {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
};
type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    };
    urlContextMetadata?: {
      urlMetadata?: Array<{ retrievedUrl?: string; urlRetrievalStatus?: string }>;
    };
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
};

class GeminiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function callGemini(
  body: Record<string, unknown>,
): Promise<{ result: GeminiResponse; model: string }> {
  const key = apiKey();
  let lastError: GeminiError | null = null;

  const list = models();
  for (const [index, model] of list.entries()) {
    // Raciocínio curto = resposta mais rápida.
    let payload: Record<string, unknown> = {
      ...body,
      generationConfig: {
        ...(body.generationConfig as Record<string, unknown>),
        thinkingConfig: { thinkingLevel: "low" },
      },
    };
    // Modelo travado não segura a resposta: passa para o próximo.
    const timeoutMs = index === list.length - 1 ? 60_000 : 25_000;
    for (let attempt = 0; attempt < 3; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${API}/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        lastError = new GeminiError(`${model} demorou mais de ${timeoutMs / 1000}s`, 504);
        console.error(`[QualiAI] ${model}: timeout`);
        break;
      }
      const result = (await res.json().catch(() => ({}))) as GeminiResponse;
      if (res.ok) return { result, model };

      const message = result.error?.message ?? `HTTP ${res.status}`;
      lastError = new GeminiError(message, res.status);
      console.error(`[QualiAI] ${model}: ${res.status} ${message}`);

      if (res.status === 400 && /thinking/i.test(message)) {
        const { thinkingConfig: _ignored, ...gen } = payload.generationConfig as Record<
          string,
          unknown
        >;
        payload = { ...payload, generationConfig: gen };
        continue;
      }
      // Ferramenta não suportada por este modelo: tenta de novo sem ferramentas.
      if (res.status === 400 && /tool|function/i.test(message) && Array.isArray(payload.tools)) {
        payload = { ...payload, tools: undefined };
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          "A chave do Gemini (GEMINI_API_KEY) é inválida ou não tem acesso à API Generative Language.",
        );
      }
      break; // 404 (modelo indisponível), 429 (cota), 5xx → próximo modelo
    }
  }

  if (lastError?.status === 429) {
    throw new Error(
      "O limite gratuito do Gemini foi atingido por agora. Aguarde um minuto e tente de novo.",
    );
  }
  throw new Error(
    `Não foi possível consultar o Gemini: ${lastError?.message ?? "erro desconhecido"}`,
  );
}

function textOf(result: GeminiResponse) {
  const parts = result.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join("")
    .trim();
}

const SYSTEM_PROMPT = `
Você é o QualiAI, o assistente de inteligência da Qualidade de Fornecedores da Frasle Mobility, integrado ao QualiHub.
Ajuda inspetores, analistas e a liderança da Qualidade a entender indicadores, achar riscos e transformar dados em ação.

COMO RESPONDER
1. Para perguntas sobre os dados da empresa (IDF, inspeções, PPM, índice de NC, eficiência, fornecedores, itens/SKUs, reprovações, alertas AQ, RNCs, QLD/QLDE, equipe), use SOMENTE o CONTEXTO QUALIHUB abaixo. Nunca invente números, fornecedores, itens, datas ou percentuais.
2. Se o contexto não tiver a informação, diga claramente o que falta e sugira onde encontrar no QualiHub (tela/filtro).
3. Para conhecimento externo (normas ISO/IATF 16949, PPAP, APQP, FMEA, 8D, MSA, CEP, legislação/INMETRO, notícias de fornecedores, mercado, conceitos técnicos de freios e autopeças), pesquise na web com as ferramentas e cite as fontes.
4. Se o usuário colar um link, leia a página e responda com base nela.
5. Separe claramente: fatos dos dados, informações da web e suas recomendações.
6. Quando apontar um problema: o que aconteceu, por que importa e qual ação recomendar (responsável sugerido, prazo).
7. Escreva em português do Brasil, objetivo e profissional. Use Markdown: títulos curtos, listas e tabelas quando ajudarem.
8. Também pode redigir e-mails a fornecedores, atas, planos de ação, 8D, resumos executivos e roteiros de reunião.

DEFINIÇÕES DO QUALIHUB
- Cada linha da aba IDF é uma inspeção. Status: Aprovado, Aprovação condicional ou Reprovado.
- PPM por SKU = inspeções reprovadas ÷ inspeções × 1.000.000. PPM por peças = peças reprovadas ÷ peças inspecionadas × 1.000.000.
- Índice de NC = inspeções reprovadas ÷ inspeções × 100 (meta máxima 2%).
- Eficiência de inspeção = inspecionadas (data de início) ÷ recebidas (data de criação) × 100 (meta 95%).
- QLD = depósito 522 (saldo livre, material em tratamento). QLDE = depósito 523 (saldo bloqueado). Itens com check marcado estão resolvidos e não entram na exposição.
`.trim();

/* ------------------------- Pesquisa na web (gratuita) -------------------------
   A busca do Google embutida no Gemini não tem cota grátis; por isso o QualiAI
   usa ferramentas próprias: busca no DuckDuckGo e leitura da página. */

const WEB_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "pesquisar_web",
        description:
          "Pesquisa na internet (DuckDuckGo). Use para normas, conceitos técnicos, notícias, empresas, legislação ou qualquer informação que não esteja no CONTEXTO QUALIHUB.",
        parameters: {
          type: "OBJECT",
          properties: { consulta: { type: "STRING", description: "Termos de busca" } },
          required: ["consulta"],
        },
      },
      {
        name: "ler_pagina",
        description:
          "Lê o texto de uma página da web (um resultado da pesquisa ou um link enviado pelo usuário).",
        parameters: {
          type: "OBJECT",
          properties: { url: { type: "STRING", description: "Endereço http(s) da página" } },
          required: ["url"],
        },
      },
    ],
  },
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

const decodeHtml = (t: string) =>
  t
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

async function pesquisarWeb(consulta: string) {
  const res = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ q: consulta, kl: "br-pt" }).toString(),
    signal: AbortSignal.timeout(12000),
  });
  const html = await res.text();
  const results: { title: string; url: string; snippet: string }[] = [];
  const re =
    /class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && results.length < 6) {
    let url = m[1];
    const uddg = url.match(/uddg=([^&]+)/);
    if (uddg) url = decodeURIComponent(uddg[1]);
    if (url.startsWith("//")) url = `https:${url}`;
    if (!/^https?:/.test(url) || url.includes("duckduckgo.com/y.js")) continue;
    results.push({ title: decodeHtml(m[2]), url, snippet: decodeHtml(m[3]) });
  }
  return results;
}

async function lerPagina(url: string) {
  if (!/^https?:\/\//i.test(url)) throw new Error("URL inválida");
  const host = new URL(url).hostname;
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    throw new Error("Endereço não permitido");
  }
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("html") && !type.includes("text")) {
    return {
      url,
      titulo: host,
      texto: `Conteúdo do tipo ${type || "desconhecido"} não pode ser lido como texto.`,
    };
  }
  const html = (await res.text()).slice(0, 600_000);
  const titulo = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? host);
  const texto = decodeHtml(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|div|li|h\d|tr)>|<br\s*\/?>/gi, "\n"),
  ).slice(0, 14_000);
  return { url, titulo, texto };
}

export const askQualiAI = createServerFn({ method: "POST" })
  .inputValidator((data: QualiAIInput) => {
    if (!data.question?.trim()) throw new Error("Pergunta obrigatória");
    return data;
  })
  .handler(async ({ data }) => {
    const history = (data.history ?? []).slice(-12).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }] as GeminiPart[],
    }));
    const contents: Array<{ role: string; parts: GeminiPart[] }> = [
      ...history,
      { role: "user", parts: [{ text: data.question.trim() }] },
    ];
    const useWeb = data.web !== false;
    const sources: QualiAISource[] = [];
    const webQueries: string[] = [];
    const addSource = (s: QualiAISource) => {
      if (s.uri && !sources.some((x) => x.uri === s.uri)) sources.push(s);
    };

    const system = `${SYSTEM_PROMPT}\n\nData de hoje: ${new Date().toLocaleDateString("pt-BR")}.\n${
      useWeb
        ? "FERRAMENTAS: se a resposta estiver no CONTEXTO QUALIHUB, responda direto, sem pesquisar. Só quando a pergunta pedir informação externa ou atual (normas, notícias, empresas, leis, preços), chame pesquisar_web antes de responder; use ler_pagina para aprofundar um resultado ou ler um link enviado pelo usuário. Cite as fontes usadas (título e link) ao final."
        : "A pesquisa na web está desligada pelo usuário: responda só com o contexto e seu conhecimento."
    }\n\nCONTEXTO QUALIHUB (JSON):\n${data.context ?? "{}"}`;

    let answer = "";
    let usedModel = "";
    // O modelo pode pesquisar e ler páginas em até 5 rodadas antes de responder.
    const MAX_ROUNDS = 6;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const lastRound = round === MAX_ROUNDS - 1;
      const { result, model } = await callGemini({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        tools: useWeb && !lastRound ? WEB_TOOLS : undefined,
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
      });
      usedModel = model;

      if (result.promptFeedback?.blockReason) {
        throw new Error("O Gemini recusou esta pergunta. Tente reformular.");
      }

      const parts = result.candidates?.[0]?.content?.parts ?? [];
      const calls = parts.filter((p) => p.functionCall);
      if (!calls.length) {
        answer = textOf(result);
        break;
      }

      // Devolve as partes do modelo intactas (inclui as assinaturas de raciocínio).
      contents.push({ role: "model", parts });
      const responses: GeminiPart[] = [];
      for (const part of calls) {
        const { name, args = {} } = part.functionCall!;
        try {
          if (name === "pesquisar_web") {
            const consulta = String(args.consulta ?? "");
            webQueries.push(consulta);
            const resultados = await pesquisarWeb(consulta);
            resultados.slice(0, 3).forEach((r) => addSource({ title: r.title, uri: r.url }));
            responses.push({ functionResponse: { name, response: { resultados } } });
          } else if (name === "ler_pagina") {
            const pagina = await lerPagina(String(args.url ?? ""));
            addSource({ title: pagina.titulo, uri: pagina.url });
            responses.push({ functionResponse: { name, response: pagina } });
          } else {
            responses.push({
              functionResponse: { name, response: { erro: "Ferramenta desconhecida" } },
            });
          }
        } catch (e) {
          responses.push({
            functionResponse: {
              name,
              response: { erro: e instanceof Error ? e.message : "Falha ao acessar a web" },
            },
          });
        }
      }
      contents.push({ role: "user", parts: responses });
    }

    if (!answer) throw new Error("O QualiAI não retornou resposta. Tente novamente.");

    return { answer, sources: sources.slice(0, 8), webQueries, model: usedModel };
  });

/**
 * Planeja uma apresentação usando somente os slides/dados já selecionados.
 * A IA só reordena IDs existentes, melhora títulos e cria slides de apoio.
 */
export const preparePresentationQualiAI = createServerFn({ method: "POST" })
  .inputValidator((data: PresentationAIInput) => {
    if (!Array.isArray(data.slides) || data.slides.length === 0) {
      throw new Error("Selecione pelo menos um conteúdo para a apresentação.");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const allowedIds = data.slides.map((s) => s.id);

    const instructions = `
Você é o QualiAI no modo EDITOR DE APRESENTAÇÃO do QualiHub (Qualidade de Fornecedores — Frasle Mobility).
Prepare a narrativa de uma apresentação executiva usando EXCLUSIVAMENTE os slides e dados fornecidos.

REGRAS:
1. Nunca invente, estime ou altere números; não crie fatos, fornecedores ou causas que não estejam nos dados.
2. orderedSlideIds deve conter TODOS os IDs recebidos, cada um uma única vez, e nenhum outro.
3. Pode melhorar títulos (máx. 60 caracteres) e subtítulos (máx. 90), sem mudar o significado.
4. supportSlides: no máximo 3, só se agregarem valor (ex.: abertura com objetivos, pontos de atenção, próximos passos).
   Em "notes" escreva de 3 a 6 tópicos curtos, um por linha, sem marcadores.
5. Diferencie fato, interpretação e recomendação. Português do Brasil, linguagem executiva.

TIPO DE REUNIÃO: ${data.preset ?? "personalizada"}
PEDIDO DO USUÁRIO: ${data.prompt?.trim() || "Organize a apresentação de forma executiva e lógica."}

SLIDES E DADOS:
${JSON.stringify(data.slides).slice(0, 180_000)}
`.trim();

    const { result } = await callGemini({
      contents: [{ role: "user", parts: [{ text: instructions }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            presentationTitle: { type: "STRING" },
            presentationSubtitle: { type: "STRING" },
            orderedSlideIds: { type: "ARRAY", items: { type: "STRING" } },
            titleUpdates: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "STRING" },
                  title: { type: "STRING" },
                  subtitle: { type: "STRING" },
                },
                required: ["id", "title", "subtitle"],
              },
            },
            supportSlides: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  position: { type: "STRING", enum: ["start", "end"] },
                  title: { type: "STRING" },
                  subtitle: { type: "STRING" },
                  notes: { type: "STRING" },
                },
                required: ["position", "title", "subtitle", "notes"],
              },
            },
          },
          required: [
            "presentationTitle",
            "presentationSubtitle",
            "orderedSlideIds",
            "titleUpdates",
            "supportSlides",
          ],
        },
      },
    });

    const output = textOf(result);
    let plan: PresentationAIPlan;
    try {
      plan = JSON.parse(output) as PresentationAIPlan;
    } catch {
      console.error("[QualiAI Presentation] JSON inválido:", output);
      throw new Error("O QualiAI retornou uma estrutura inválida. Tente novamente.");
    }

    const ordered = Array.from(
      new Set((plan.orderedSlideIds ?? []).filter((id) => allowedIds.includes(id))),
    );
    for (const id of allowedIds) if (!ordered.includes(id)) ordered.push(id);

    return {
      plan: {
        presentationTitle: plan.presentationTitle ?? "",
        presentationSubtitle: plan.presentationSubtitle ?? "",
        orderedSlideIds: ordered,
        titleUpdates: (plan.titleUpdates ?? []).filter((u) => allowedIds.includes(u.id)),
        supportSlides: (plan.supportSlides ?? []).slice(0, 3),
      },
    };
  });
