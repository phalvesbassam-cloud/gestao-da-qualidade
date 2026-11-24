// Gera os seis modelos PowerPoint da "Biblioteca de Templates" (16:9, 100% editáveis).
//
//   node scripts/templates/gerar-templates.mjs
//
// O desenho dos slides fica em src/lib/templates/construir.ts — o mesmo código que o
// navegador usa para montar os modelos com dados do sistema.
// Saída: public/templates/<id>.pptx e src/lib/templates-catalogo.ts (lido pela página).
// Depois rode scripts/templates/validar-e-exportar.ps1 para abrir cada arquivo no
// PowerPoint e exportar as pré-visualizações a partir dos próprios arquivos.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODELOS, construirModelo } from "../../src/lib/templates/construir.ts";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "../..");
const SAIDA = path.join(RAIZ, "public", "templates");
const CATALOGO = path.join(RAIZ, "src", "lib", "templates-catalogo.ts");
const ASSETS = path.join(RAIZ, "src", "assets", "templates");
const base64 = (arq) => `image/png;base64,${fs.readFileSync(path.join(ASSETS, arq)).toString("base64")}`;
const logos = { cor: base64("logo-frasle.png"), branca: base64("logo-frasle-branca.png") };

fs.mkdirSync(SAIDA, { recursive: true });
const so = process.argv[2];
const catalogo = [];
for (const m of MODELOS) {
  if (so && !m.id.startsWith(so)) continue;
  const { pres, resumo } = construirModelo(m, { logos });
  const arquivo = path.join(SAIDA, `${m.id}.pptx`);
  await pres.writeFile({ fileName: arquivo });
  catalogo.push({
    id: m.id,
    numero: m.numero,
    nome: m.nome,
    titulo: m.titulo,
    categoria: m.categoria,
    descricao: m.descricao,
    usos: m.usos,
    arquivo: `/templates/${m.id}.pptx`,
    nomeDownload: `Fras-le Mobility - Modelo ${m.numero} - ${m.nome}.pptx`,
    tamanho: fs.statSync(arquivo).size,
    slides: resumo.map((r, i) => ({ ...r, imagem: `/templates/${m.id}/slide-${String(i + 1).padStart(2, "0")}.jpg` })),
  });
  console.log(`✓ ${m.id}.pptx (${resumo.length} slides)`);
}

if (!so)
  fs.writeFileSync(
    CATALOGO,
    `// Arquivo gerado por scripts/templates/gerar-templates.mjs — não edite à mão.
export type TemplateSlide = { tipo: string; titulo: string; imagem: string };
export type TemplateModelo = {
  id: string;
  numero: string;
  nome: string;
  titulo: string;
  categoria: string;
  descricao: string;
  usos: string[];
  arquivo: string;
  nomeDownload: string;
  tamanho: number;
  slides: TemplateSlide[];
};

export const TEMPLATES: TemplateModelo[] = ${JSON.stringify(catalogo, null, 2)};
`,
  );
