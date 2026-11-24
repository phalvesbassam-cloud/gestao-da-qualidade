// Monta, no navegador, um modelo da Biblioteca de Templates com dados escolhidos no
// QualiHub. Usa o mesmo código de desenho dos arquivos da biblioteca
// (src/lib/templates/construir.ts), então o visual é idêntico ao modelo baixado.
import logoCorUrl from "@/assets/templates/logo-frasle.png";
import logoBrancaUrl from "@/assets/templates/logo-frasle-branca.png";
import { ensureSpec, type SlideSpec } from "@/lib/slide-spec";
import type { PresentationItem } from "@/contexts/presentation-context";

export type ModoMontagem = "completo" | "dados";

const ROTAS: Record<string, string> = {
  "/": "Consolidado",
  "/reuniao": "Reunião Mensal",
  "/rdm": "RDM",
  "/qld-qlde": "QLD / QLDE",
  "/idf": "IDF",
  "/alerta": "Alertas",
  "/rnc": "RNC",
  "/inspecao": "Inspeção",
};

export const nomeDaAba = (rota: string) =>
  rota.startsWith("/fornecedor/") ? "Fornecedor 360°" : (ROTAS[rota] ?? rota);

async function emBase64(url: string) {
  const blob = await (await fetch(url)).blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  return dataUrl.replace(/^data:/, "");
}

export function specDoItem(item: PresentationItem): SlideSpec {
  return ensureSpec({ spec: item.spec, type: item.type, data: item.data, title: item.title });
}

/** Quantos slides os dados vão ocupar (divisória + tabelas paginadas). */
export function slidesDosDados(itens: PresentationItem[]) {
  if (!itens.length) return 0;
  return (
    1 +
    itens.reduce((n, it) => {
      const s = specDoItem(it);
      return n + (s.type === "table" ? Math.max(1, Math.ceil(s.table.rows.length / 11)) : 1);
    }, 0)
  );
}

export async function baixarTemplateComDados(opcoes: {
  templateId: string;
  nomeArquivo: string;
  itens: PresentationItem[];
  capa: { titulo: string; subtitulo: string };
  modo: ModoMontagem;
}) {
  const [{ construirModelo, modeloPorId }, cor, branca] = await Promise.all([
    import("./construir"),
    emBase64(logoCorUrl),
    emBase64(logoBrancaUrl),
  ]);
  const modelo = modeloPorId(opcoes.templateId);
  if (!modelo) throw new Error("Modelo não encontrado.");
  const hoje = new Date().toLocaleDateString("pt-BR");
  const dados = opcoes.itens.map((it) => ({
    titulo: it.title,
    subtitulo: it.subtitle,
    spec: specDoItem(it),
    fonte: `Fonte: QualiHub › ${nomeDaAba(it.sourceRoute)} · ${hoje}`,
  }));
  const { pres } = construirModelo(modelo, {
    logos: { cor, branca },
    capa: opcoes.capa,
    dados,
    modo: opcoes.modo,
  });
  await pres.writeFile({ fileName: opcoes.nomeArquivo });
}
