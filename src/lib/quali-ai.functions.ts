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

    const answer =
      result.output_text ??
      result.output
        ?.flatMap((item: any) => item.content ?? [])
        ?.filter((item: any) => item.type === "output_text")
        ?.map((item: any) => item.text)
        ?.join("\n")
        ?.trim();

    if (!answer) {
      throw new Error("A OpenAI não retornou uma resposta.");
    }

    return {
      answer,
      responseId: result.id ?? null,
    };
  });