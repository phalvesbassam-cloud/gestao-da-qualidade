import { createServerFn } from "@tanstack/react-start";

type QualiAIMessage = {
  role: "user" | "assistant";
  content: string;
};

type QualiAIInput = {
  question: string;
  history?: QualiAIMessage[];
  context?: unknown;
};

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
  titleUpdates: Array<{
    id: string;
    title: string;
    subtitle: string;
  }>;
  supportSlides: Array<{
    position: "start" | "end";
    title: string;
    subtitle: string;
    notes: string;
  }>;
};

function getOutputText(result: any) {
  return (
    result.output_text ??
    result.output
      ?.flatMap((item: any) => item.content ?? [])
      ?.filter((item: any) => item.type === "output_text")
      ?.map((item: any) => item.text)
      ?.join("\n")
      ?.trim()
  );
}

export const askQualiAI = createServerFn({ method: "POST" })
  .inputValidator((data: QualiAIInput) => {
    if (!data.question?.trim()) {
      throw new Error("Pergunta obrigatória");
    }

    return data;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY não configurada no servidor.");
    }

    const history = (data.history ?? [])
      .slice(-10)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const systemPrompt = `
Você é o QualiAI, assistente de inteligência da qualidade integrado ao QualiHub.

Sua função é ajudar profissionais de Qualidade e Engenharia a analisar informações,
identificar riscos, explicar indicadores e transformar dados em ações.

REGRAS IMPORTANTES:

1. Quando a pergunta envolver números, fornecedores, IDF, PPM, inspeções, RNC,
alertas, QLD, QLDE, reprovações, SKUs ou indicadores do QualiHub, utilize SOMENTE
os dados fornecidos no CONTEXTO QUALIHUB.
2. Nunca invente números, fornecedores, itens, RNCs, percentuais ou resultados.
3. Se os dados disponíveis não forem suficientes, diga claramente que não há
informação suficiente no contexto atual.
4. Você também é um assistente profissional de uso geral. Pode escrever e-mails,
resumos executivos, planos de ação, apresentações, atas, análises, textos e
explicações quando solicitado.
5. Responda em português do Brasil por padrão.
6. Seja objetivo, profissional e fácil de entender.
7. Quando encontrar um problema relevante nos dados, explique:
- o que aconteceu;
- por que merece atenção;
- qual ação recomenda.
8. Diferencie fatos encontrados nos dados de recomendações ou interpretações.

CONTEXTO QUALIHUB:
${JSON.stringify(data.context ?? {}, null, 2)}
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        instructions: systemPrompt,
        input: [
          ...history,
          {
            role: "user",
            content: data.question.trim(),
          },
        ],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("[QualiAI] OpenAI error:", result);
      throw new Error(
        result?.error?.message || "Erro ao consultar a OpenAI.",
      );
    }

    const answer = getOutputText(result);

    if (!answer) {
      throw new Error("A OpenAI não retornou uma resposta.");
    }

    return {
      answer,
      responseId: result.id ?? null,
    };
  });

/**
 * Planeja uma apresentação usando somente os slides/dados já selecionados.
 *
 * A IA NÃO devolve nem altera os dados estruturados dos slides.
 * Ela só pode:
 * - escolher a ordem dos IDs existentes;
 * - melhorar títulos/subtítulos;
 * - criar slides textuais de apoio.
 */
export const preparePresentationQualiAI = createServerFn({ method: "POST" })
  .inputValidator((data: PresentationAIInput) => {
    if (!Array.isArray(data.slides) || data.slides.length === 0) {
      throw new Error("Selecione pelo menos um conteúdo para a apresentação.");
    }

    return data;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY não configurada no servidor.");
    }

    const allowedIds = data.slides.map((slide) => slide.id);

    const instructions = `
Você é o QualiAI no modo EDITOR DE APRESENTAÇÃO do QualiHub.

Sua tarefa é preparar a narrativa de uma apresentação profissional da Qualidade
a partir EXCLUSIVAMENTE dos slides e dados fornecidos.

REGRAS OBRIGATÓRIAS:
1. Nunca invente, estime, arredonde ou altere números.
2. Nunca crie fatos, fornecedores, indicadores, causas ou conclusões que não
estejam sustentados pelos dados recebidos.
3. orderedSlideIds deve conter SOMENTE IDs recebidos.
4. Preserve TODOS os slides recebidos: nenhum ID pode ser removido.
5. Cada ID recebido deve aparecer UMA única vez em orderedSlideIds.
6. Você pode melhorar títulos e subtítulos, mas não pode mudar o significado.
7. Slides de apoio podem conter análise, resumo, pontos de atenção e próximos
passos. Diferencie claramente fato, interpretação e recomendação.
8. Se não houver dados suficientes para uma conclusão, diga isso em vez de inventar.
9. Escreva em português do Brasil, com linguagem executiva, curta e clara.
10. Para supportSlides, use notes como o conteúdo principal do slide. Prefira
bullets curtos separados por quebras de linha.
11. Crie no máximo 3 supportSlides. Só crie os que realmente agregarem valor.
12. Não coloque números em supportSlides a menos que eles apareçam explicitamente
nos dados recebidos.

TIPO DE REUNIÃO:
${data.preset ?? "personalizada"}

PEDIDO DO USUÁRIO:
${data.prompt?.trim() || "Organize a apresentação de forma executiva e lógica."}

SLIDES E DADOS DISPONÍVEIS:
${JSON.stringify(data.slides, null, 2)}
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        instructions,
        input:
          "Prepare a estrutura da apresentação obedecendo rigorosamente às regras e ao schema.",
        text: {
          format: {
            type: "json_schema",
            name: "qualihub_presentation_plan",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                presentationTitle: { type: "string" },
                presentationSubtitle: { type: "string" },
                orderedSlideIds: {
                  type: "array",
                  items: { type: "string" },
                },
                titleUpdates: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      subtitle: { type: "string" },
                    },
                    required: ["id", "title", "subtitle"],
                  },
                },
                supportSlides: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      position: {
                        type: "string",
                        enum: ["start", "end"],
                      },
                      title: { type: "string" },
                      subtitle: { type: "string" },
                      notes: { type: "string" },
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
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("[QualiAI Presentation] OpenAI error:", result);
      throw new Error(
        result?.error?.message ||
          "Erro ao preparar a apresentação com o QualiAI.",
      );
    }

    const output = getOutputText(result);

    if (!output) {
      throw new Error("O QualiAI não retornou um plano de apresentação.");
    }

    let plan: PresentationAIPlan;

    try {
      plan = JSON.parse(output) as PresentationAIPlan;
    } catch {
      console.error("[QualiAI Presentation] JSON inválido:", output);
      throw new Error("O QualiAI retornou uma estrutura inválida.");
    }

    // Segurança adicional no servidor: a resposta da IA não pode introduzir IDs.
    const uniqueOrderedIds = Array.from(
      new Set(
        plan.orderedSlideIds.filter((id) => allowedIds.includes(id)),
      ),
    );

    // Se a IA omitir algum slide, ele é recolocado no fim.
    for (const id of allowedIds) {
      if (!uniqueOrderedIds.includes(id)) {
        uniqueOrderedIds.push(id);
      }
    }

    const safeTitleUpdates = plan.titleUpdates.filter((update) =>
      allowedIds.includes(update.id),
    );

    const safeSupportSlides = plan.supportSlides.slice(0, 3);

    return {
      plan: {
        ...plan,
        orderedSlideIds: uniqueOrderedIds,
        titleUpdates: safeTitleUpdates,
        supportSlides: safeSupportSlides,
      },
      responseId: result.id ?? null,
    };
  });
