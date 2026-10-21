// PowerPoint da RDM a partir do modelo oficial (public/rdm/modelo-rdm.pptx).
//
// O arquivo modelo é usado como está — fundos, fotos, logos, fontes e o slide
// de agradecimento não mudam. Só são trocados:
//   - slide 1: o mês/ano da capa;
//   - slide 2: os cards de dados (que antes eram prints) por gráficos, tabelas
//     e textos nativos e editáveis no PowerPoint.
// Os cards são desenhados com o pptxgenjs num arquivo temporário e as partes
// (formas, gráficos e planilhas embutidas) são transplantadas para o slide 2.
import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import {
  RDM_META_EFICIENCIA,
  RDM_META_NC,
  brl,
  int,
  parseDestaques,
  pct,
  type RdmManual,
  type RdmMes,
} from "@/lib/rdm";
import type { QldSummary } from "@/lib/qld";

export type RdmAdequacao = {
  pecas: number;
  valor: number;
  skus: number;
  md: { pecas: number; valor: number };
  avaria: { pecas: number; valor: number };
};

export type RdmPptxInput = {
  ano: number;
  mes: RdmMes; // mês da reunião
  meses: RdmMes[]; // jan → mês da reunião
  acumulado: { alertas: number; rncs: number };
  qld: QldSummary;
  adequacao: RdmAdequacao;
  manual: RdmManual;
};

const TEMPLATE_URL = "/rdm/modelo-rdm.pptx";
/** Formas do modelo que eram prints/caixas de dados e são substituídas. */
const SLIDE2_SUBSTITUIR = new Set(["22", "28", "80", "33", "49", "83", "39", "41"]);

const RED = "E30613";
const RED_TXT = "FF0000";
const GRAY = "595959";
const DARK = "1F1F1F";
const FONT = "Calibri";
const PAINEL_BG = "F5F6F8";
const PAINEL_BORDA = "E3E6EA";

/** Geometria dos 4 painéis do slide 2 (polegadas) — usada também na prévia da tela. */
export const RDM_PAINEIS = {
  eficiencia: { x: 0.6, y: 0.98, w: 2.5, h: 3.05 },
  nc: { x: 3.2, y: 0.98, w: 3.88, h: 3.05 },
  adequacao: { x: 0.6, y: 4.13, w: 2.5, h: 2.86 },
  qld: { x: 3.2, y: 4.13, w: 3.88, h: 2.86 },
} as const;

export const RDM_CORES = {
  md: "5B9BD5",
  avaria: "ED7D31",
  qld: "D97706",
  qlde: "DC2626",
};

/* ----------------------------- conteúdo do slide 2 ----------------------------- */

export function corEficiencia(v: number) {
  if (v >= RDM_META_EFICIENCIA) return "00B050";
  if (v >= RDM_META_EFICIENCIA - 10) return "FFC000";
  return "E30613";
}

type Run = PptxGenJS.TextProps;

function linhaTopicos(partes: { texto: string; destaque: boolean }[], fontSize: number): Run[] {
  return partes.map((p, i) => ({
    text: p.texto,
    options: {
      bullet: i === 0 ? { code: "2022" } : undefined,
      bold: p.destaque,
      italic: p.destaque,
      color: p.destaque ? RED_TXT : "000000",
      fontSize,
      breakLine: i === partes.length - 1,
    },
  }));
}

function titulo(texto: string, fontSize: number): Run {
  return {
    text: texto,
    options: {
      bold: true,
      align: "center",
      fontSize,
      color: "000000",
      breakLine: true,
      paraSpaceBefore: 6,
    },
  };
}

/** Painel da direita: só as observações digitadas na tela, nas 3 seções do modelo. */
function painelDireito(input: RdmPptxInput): Run[] {
  const c = input.manual.comentarios;
  const secoes = [
    { titulo: "Inspeções de Recebimento", linhas: parseDestaques(c.inspecao) },
    { titulo: "Adequação", linhas: parseDestaques(c.adequacao) },
    { titulo: "QLD - QLDE", linhas: parseDestaques(c.qld) },
  ];
  const total = secoes.reduce((t, s) => t + Math.max(1, s.linhas.length), 0) + 6;
  const fontSize = total <= 13 ? 14 : total <= 17 ? 12 : 11;
  return secoes.flatMap((s, i) => [
    ...(i > 0 ? [{ text: " ", options: { fontSize: 6, breakLine: true } } as Run] : []),
    titulo(s.titulo, fontSize),
    ...s.linhas.flatMap((l) => linhaTopicos(l, fontSize)),
  ]);
}

function painel(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  g: { x: number; y: number; w: number; h: number },
  tituloPainel: string,
) {
  slide.addShape(pptx.ShapeType.roundRect, {
    ...g,
    fill: { color: PAINEL_BG },
    line: { color: PAINEL_BORDA, width: 0.75 },
    rectRadius: 0.1,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: g.x + 0.14,
    y: g.y + 0.15,
    w: 0.05,
    h: 0.2,
    fill: { color: RED },
    line: { color: RED, width: 0 },
  });
  slide.addText(tituloPainel, {
    x: g.x + 0.24,
    y: g.y + 0.1,
    w: g.w - 0.34,
    h: 0.3,
    fontFace: FONT,
    fontSize: 10.5,
    bold: true,
    color: "404040",
    charSpacing: 0.5,
    margin: 0,
    valign: "middle",
  });
}

function desenharSlide2(pptx: PptxGenJS, input: RdmPptxInput) {
  const slide = pptx.addSlide();
  const { mes, meses, qld, adequacao: ad } = input;
  const P = RDM_PAINEIS;

  /* A — Eficiência de inspeção (velocímetro) */
  {
    const g = P.eficiencia;
    painel(pptx, slide, g, "EFICIÊNCIA DE INSPEÇÃO");
    const efic = mes.eficiencia ?? 0;
    const eficGauge = Math.max(0, Math.min(100, efic));
    const gx = g.x + 0.25;
    const gy = g.y + 0.5;
    const gw = g.w - 0.5;
    slide.addChart(
      pptx.ChartType.doughnut,
      [
        {
          name: "Eficiência",
          labels: ["Alcançado", "Restante", "Base"],
          values: [eficGauge, 100 - eficGauge, 100],
        },
      ],
      {
        x: gx,
        y: gy,
        w: gw,
        h: gw,
        holeSize: 55,
        firstSliceAng: 270,
        chartColors: [corEficiencia(efic), "DADDE2", PAINEL_BG],
        showLegend: false,
        showValue: false,
        showPercent: false,
        showLabel: false,
        dataBorder: { pt: 0, color: PAINEL_BG },
      } as PptxGenJS.IChartOpts,
    );
    // ponteiro
    const cx = gx + gw / 2;
    const cy = gy + gw / 2;
    const raio = gw * 0.42;
    const ang = Math.PI - (eficGauge / 100) * Math.PI;
    const dx = Math.cos(ang) * raio;
    const dy = -Math.sin(ang) * raio;
    slide.addShape(pptx.ShapeType.line, {
      x: Math.min(cx, cx + dx),
      y: Math.min(cy, cy + dy),
      w: Math.max(Math.abs(dx), 0.001),
      h: Math.max(Math.abs(dy), 0.001),
      flipV: dx > 0 !== dy > 0,
      line: { color: DARK, width: 3 },
    });
    slide.addShape(pptx.ShapeType.ellipse, {
      x: cx - 0.08,
      y: cy - 0.08,
      w: 0.16,
      h: 0.16,
      fill: { color: DARK },
      line: { color: DARK, width: 0 },
    });
    slide.addText(pct(mes.eficiencia, 0), {
      x: g.x,
      y: cy + 0.06,
      w: g.w,
      h: 0.5,
      align: "center",
      fontFace: FONT,
      fontSize: 32,
      bold: true,
      color: DARK,
      margin: 0,
    });
    const linhaTabela = (rotulo: string, valor: string): PptxGenJS.TableCell[] => [
      { text: rotulo, options: { bold: true, italic: true, fontSize: 9, color: DARK } },
      {
        text: valor,
        options: { bold: true, italic: true, fontSize: 9, color: DARK, align: "right" },
      },
    ];
    slide.addTable(
      [
        linhaTabela("Target", `${RDM_META_EFICIENCIA}%`),
        linhaTabela("Qde Recebida:", int(mes.recebidas)),
        linhaTabela("Qde Inspecionada:", int(mes.inspecionadas)),
      ],
      {
        x: g.x + 0.18,
        y: g.y + g.h - 0.72,
        w: g.w - 0.36,
        colW: [g.w - 0.36 - 0.8, 0.8],
        rowH: 0.19,
        fontFace: FONT,
        margin: 0.02,
        border: [
          { type: "none" },
          { type: "none" },
          { type: "dash", pt: 0.75, color: "9AA0A6" },
          { type: "none" },
        ],
      },
    );
  }

  /* B — Índice de não conformidade (gráfico + tabela) */
  {
    const g = P.nc;
    painel(pptx, slide, g, "ÍNDICE DE NÃO CONFORMIDADE");
    slide.addText(`Reprovados ÷ inspeções do mês × 100 · meta ≤ ${RDM_META_NC}%`, {
      x: g.x + 0.24,
      y: g.y + 0.36,
      w: g.w - 0.34,
      h: 0.18,
      fontFace: FONT,
      fontSize: 8,
      color: "7F7F7F",
      margin: 0,
    });
    const cats = meses.map((m) => m.mes);
    (slide.addChart as unknown as (tipos: unknown, opts: unknown) => void)(
      [
        {
          type: pptx.ChartType.bar,
          data: [
            {
              name: "Índice NC (%)",
              labels: cats,
              values: meses.map((m) => Number((m.indiceNC ?? 0).toFixed(2))),
            },
          ],
          options: {
            chartColors: [RED],
            barGapWidthPct: 45,
            showValue: true,
            dataLabelPosition: "outEnd",
            dataLabelFormatCode: '0.0"%"',
            dataLabelFontSize: 7,
            dataLabelColor: "404040",
          },
        },
        {
          type: pptx.ChartType.line,
          data: [
            { name: `Meta ${RDM_META_NC}%`, labels: cats, values: cats.map(() => RDM_META_NC) },
          ],
          options: {
            chartColors: ["404040"],
            lineSize: 1.25,
            lineDash: "dash",
            lineDataSymbol: "none",
            showValue: false,
          },
        },
      ],
      {
        x: g.x + 0.08,
        y: g.y + 0.55,
        w: g.w - 0.16,
        h: 1.62,
        showLegend: false,
        catAxisLabelFontSize: 7,
        valAxisLabelFontSize: 7,
        catAxisLabelColor: "595959",
        valAxisLabelColor: "595959",
        valAxisLabelFormatCode: '0.0"%"',
        valAxisMinVal: 0,
        valGridLine: { color: "E3E6EA", style: "dash", size: 0.5 },
        catGridLine: { style: "none" },
        catAxisLineShow: false,
        valAxisLineShow: false,
        plotArea: { fill: { color: PAINEL_BG } },
      },
    );
    const fs = meses.length > 9 ? 6 : 7;
    const larg = g.w - 0.26;
    const cab: PptxGenJS.TableCell[] = [
      { text: "", options: { fontSize: fs } },
      ...meses.map((m) => ({
        text: m.mes,
        options: { fontSize: fs, bold: true, color: "595959", align: "center" as const },
      })),
    ];
    const linha = (rotulo: string, valores: string[], cores?: string[]): PptxGenJS.TableCell[] => [
      { text: rotulo, options: { fontSize: fs, bold: true, italic: true, color: DARK } },
      ...valores.map((v, i) => ({
        text: v,
        options: { fontSize: fs, align: "center" as const, color: cores?.[i] ?? DARK },
      })),
    ];
    slide.addTable(
      [
        cab,
        linha(
          "Reprovados",
          meses.map((m) => int(m.reprovadas)),
        ),
        linha(
          "Inspecionado",
          meses.map((m) => int(m.inspecionadas)),
        ),
        linha(
          "Índice NC",
          meses.map((m) => pct(m.indiceNC, 2)),
          meses.map((m) => ((m.indiceNC ?? 0) <= RDM_META_NC ? "00A651" : RED)),
        ),
      ],
      {
        x: g.x + 0.13,
        y: g.y + 2.2,
        w: larg,
        rowH: 0.18,
        fontFace: FONT,
        margin: 0.01,
        colW: [0.72, ...meses.map(() => (larg - 0.72) / Math.max(meses.length, 1))],
        border: { type: "none" },
      },
    );
  }

  /* C — Adequação de produtos */
  {
    const g = P.adequacao;
    painel(pptx, slide, g, "ADEQUAÇÃO DE PRODUTOS");
    const temDados = ad.pecas > 0;
    const pctMd = ad.valor > 0 ? (ad.md.valor / ad.valor) * 100 : 0;
    const dx = g.x + 0.3;
    const dw = g.w - 0.6;
    slide.addChart(
      pptx.ChartType.doughnut,
      temDados
        ? [
            {
              name: "Adequação (R$)",
              labels: ["MD", "AVARIA CD"],
              values: [ad.md.valor, ad.avaria.valor],
            },
          ]
        : [{ name: "Adequação", labels: ["Sem dados"], values: [1] }],
      {
        x: dx,
        y: g.y + 0.45,
        w: dw,
        h: dw,
        holeSize: 68,
        chartColors: temDados ? [RDM_CORES.md, RDM_CORES.avaria] : ["DADDE2"],
        showLegend: false,
        showValue: false,
        showPercent: false,
        dataBorder: { pt: 1, color: PAINEL_BG },
      } as PptxGenJS.IChartOpts,
    );
    slide.addText(
      [
        { text: `${int(ad.pecas)} peças`, options: { breakLine: true } },
        { text: brl(ad.valor), options: { breakLine: true } },
        { text: `${int(ad.skus)} SKU's` },
      ],
      {
        x: dx + dw * 0.18,
        y: g.y + 0.45 + dw * 0.3,
        w: dw * 0.64,
        h: dw * 0.4,
        align: "center",
        valign: "middle",
        fontFace: FONT,
        fontSize: 10.5,
        bold: true,
        italic: true,
        color: RED_TXT,
        margin: 0,
        fit: "shrink",
      },
    );
    const leg = (x: number, cor: string, rotulo: string, p: number) => {
      slide.addShape(pptx.ShapeType.ellipse, {
        x,
        y: g.y + g.h - 0.3,
        w: 0.1,
        h: 0.1,
        fill: { color: cor },
        line: { color: cor, width: 0 },
      });
      slide.addText(`${rotulo} ${temDados ? pct(p, 0) : ""}`, {
        x: x + 0.13,
        y: g.y + g.h - 0.36,
        w: 1.0,
        h: 0.22,
        fontFace: FONT,
        fontSize: 8.5,
        color: "404040",
        margin: 0,
        valign: "middle",
      });
    };
    leg(g.x + 0.3, RDM_CORES.md, "MD", pctMd);
    leg(g.x + 1.3, RDM_CORES.avaria, "AVARIA CD", 100 - pctMd);
  }

  /* D — QLD / QLDE */
  {
    const g = P.qld;
    painel(pptx, slide, g, "QLD / QLDE · EXPOSIÇÃO");
    const dw = 2.05;
    const dx = g.x + 0.15;
    const dy = g.y + 0.5;
    slide.addChart(
      pptx.ChartType.doughnut,
      [
        {
          name: "Exposição",
          labels: ["QLD · 522", "QLDE · 523"],
          values: [qld.qldValor || 0.0001, qld.qldeValor || 0.0001],
        },
      ],
      {
        x: dx,
        y: dy,
        w: dw,
        h: dw,
        holeSize: 70,
        chartColors: [RDM_CORES.qld, RDM_CORES.qlde],
        showLegend: false,
        showValue: false,
        showPercent: false,
        dataBorder: { pt: 1, color: PAINEL_BG },
      } as PptxGenJS.IChartOpts,
    );
    slide.addText(
      [
        {
          text: "EXPOSIÇÃO",
          options: { fontSize: 7, color: "7F7F7F", charSpacing: 2, breakLine: true },
        },
        { text: brl(qld.totalValor), options: { fontSize: 10.5, bold: true, color: DARK } },
      ],
      {
        x: dx + 0.3,
        y: dy + dw / 2 - 0.27,
        w: dw - 0.6,
        h: 0.54,
        align: "center",
        valign: "middle",
        fontFace: FONT,
        margin: 0,
        fit: "shrink",
      },
    );
    const caixa = (y: number, rotulo: string, cor: string, valor: number, skus: number) => {
      const p = qld.totalValor > 0 ? (valor / qld.totalValor) * 100 : 0;
      const bx = g.x + 2.3;
      const bw = g.w - 2.45;
      slide.addShape(pptx.ShapeType.roundRect, {
        x: bx,
        y,
        w: bw,
        h: 1.0,
        fill: { color: "FFFFFF" },
        line: { color: PAINEL_BORDA, width: 0.75 },
        rectRadius: 0.08,
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: bx,
        y: y + 0.14,
        w: 0.05,
        h: 0.72,
        fill: { color: cor },
        line: { color: cor, width: 0 },
      });
      slide.addText(
        [
          { text: rotulo, options: { fontSize: 8, bold: true, color: cor, breakLine: true } },
          { text: pct(p), options: { fontSize: 15, bold: true, color: DARK, breakLine: true } },
          { text: brl(valor), options: { fontSize: 8, color: "595959", breakLine: true } },
          { text: `${int(skus)} SKUs`, options: { fontSize: 7.5, color: "7F7F7F" } },
        ],
        {
          x: bx + 0.14,
          y: y + 0.05,
          w: bw - 0.2,
          h: 0.9,
          fontFace: FONT,
          margin: 0,
          valign: "middle",
        },
      );
    };
    caixa(g.y + 0.55, "QLD · 522", RDM_CORES.qld, qld.qldValor, qld.qldSkus);
    caixa(g.y + 1.68, "QLDE · 523", RDM_CORES.qlde, qld.qldeValor, qld.qldeSkus);
  }

  /* Painel da direita (texto editável no mesmo estilo do modelo) */
  slide.addText(painelDireito(input), {
    x: 7.17,
    y: 1.5,
    w: 5.97,
    h: 5.45,
    valign: "top",
    fontFace: FONT,
    margin: 0.05,
    paraSpaceAfter: 2,
  });
}

/* ------------------------------- transplante XML ------------------------------- */

const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

function parseXml(text: string) {
  return new DOMParser().parseFromString(text, "application/xml");
}
function serialize(doc: Document) {
  return new XMLSerializer().serializeToString(doc);
}

function resolvePath(base: string, target: string) {
  if (target.startsWith("/")) return target.slice(1); // caminho absoluto no pacote
  const parts = base.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

async function addContentType(zip: JSZip, partName: string, contentType: string) {
  const file = zip.file("[Content_Types].xml")!;
  const doc = parseXml(await file.async("string"));
  const types = doc.documentElement;
  const exists = Array.from(types.getElementsByTagName("Override")).some(
    (o) => o.getAttribute("PartName") === `/${partName}`,
  );
  if (!exists) {
    const o = doc.createElementNS(types.namespaceURI, "Override");
    o.setAttribute("PartName", `/${partName}`);
    o.setAttribute("ContentType", contentType);
    types.appendChild(o);
  }
  zip.file("[Content_Types].xml", serialize(doc));
}

async function ensureDefault(zip: JSZip, ext: string, contentType: string) {
  const file = zip.file("[Content_Types].xml")!;
  const doc = parseXml(await file.async("string"));
  const types = doc.documentElement;
  const exists = Array.from(types.getElementsByTagName("Default")).some(
    (d) => d.getAttribute("Extension")?.toLowerCase() === ext,
  );
  if (!exists) {
    const d = doc.createElementNS(types.namespaceURI, "Default");
    d.setAttribute("Extension", ext);
    d.setAttribute("ContentType", contentType);
    types.insertBefore(d, types.firstChild);
    zip.file("[Content_Types].xml", serialize(doc));
  }
}

async function transplantarSlide2(template: JSZip, gerado: JSZip) {
  const slidePath = "ppt/slides/slide2.xml";
  const relsPath = "ppt/slides/_rels/slide2.xml.rels";
  const slideDoc = parseXml(await template.file(slidePath)!.async("string"));
  const relsDoc = parseXml(await template.file(relsPath)!.async("string"));

  // 1) remove os prints/caixas de dados antigos
  const spTree = slideDoc.getElementsByTagNameNS("*", "spTree")[0];
  for (const child of Array.from(spTree.children)) {
    const cNvPr = child.getElementsByTagNameNS("*", "cNvPr")[0];
    if (cNvPr && SLIDE2_SUBSTITUIR.has(cNvPr.getAttribute("id") ?? "")) spTree.removeChild(child);
  }

  // 2) partes geradas pelo pptxgenjs
  const genSlide = parseXml(await gerado.file("ppt/slides/slide1.xml")!.async("string"));
  const genRels = parseXml(await gerado.file("ppt/slides/_rels/slide1.xml.rels")!.async("string"));
  const genTree = genSlide.getElementsByTagNameNS("*", "spTree")[0];

  const existentes = new Set(
    Array.from(relsDoc.getElementsByTagNameNS(REL_NS, "Relationship")).map((r) =>
      r.getAttribute("Id"),
    ),
  );
  let nextRel = 100;
  const novoRelId = () => {
    while (existentes.has(`rId${nextRel}`)) nextRel++;
    existentes.add(`rId${nextRel}`);
    return `rId${nextRel}`;
  };
  const mapaRel = new Map<string, string>();
  const stamp = Date.now().toString(36);

  for (const rel of Array.from(genRels.getElementsByTagNameNS(REL_NS, "Relationship"))) {
    const type = rel.getAttribute("Type") ?? "";
    const target = rel.getAttribute("Target") ?? "";
    const oldId = rel.getAttribute("Id") ?? "";
    if (type.endsWith("/slideLayout") || type.endsWith("/notesSlide")) continue;
    const src = resolvePath("ppt/slides/slide1.xml", target);

    if (type.endsWith("/chart")) {
      const nome = `rdm${stamp}${oldId}`;
      const chartPath = `ppt/charts/${nome}.xml`;
      template.file(chartPath, await gerado.file(src)!.async("uint8array"));
      // planilha embutida do gráfico (para "Editar dados" no PowerPoint)
      const chartRelsSrc = src.replace("charts/", "charts/_rels/") + ".rels";
      const chartRels = gerado.file(chartRelsSrc);
      if (chartRels) {
        const crDoc = parseXml(await chartRels.async("string"));
        for (const r of Array.from(crDoc.getElementsByTagNameNS(REL_NS, "Relationship"))) {
          const t = r.getAttribute("Target") ?? "";
          const embSrc = resolvePath(src, t);
          const ext = embSrc.split(".").pop() ?? "xlsx";
          const embName = `ppt/embeddings/${nome}.${ext}`;
          template.file(embName, await gerado.file(embSrc)!.async("uint8array"));
          r.setAttribute("Target", `../embeddings/${nome}.${ext}`);
          await ensureDefault(
            template,
            ext,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          );
        }
        template.file(`ppt/charts/_rels/${nome}.xml.rels`, serialize(crDoc));
      }
      await addContentType(
        template,
        chartPath,
        "application/vnd.openxmlformats-officedocument.drawingml.chart+xml",
      );
      const id = novoRelId();
      mapaRel.set(oldId, id);
      const novo = relsDoc.createElementNS(REL_NS, "Relationship");
      novo.setAttribute("Id", id);
      novo.setAttribute("Type", type);
      novo.setAttribute("Target", `../charts/${nome}.xml`);
      relsDoc.documentElement.appendChild(novo);
    } else if (type.endsWith("/image")) {
      const ext = src.split(".").pop() ?? "png";
      const nome = `ppt/media/rdm${stamp}${oldId}.${ext}`;
      template.file(nome, await gerado.file(src)!.async("uint8array"));
      await ensureDefault(template, ext, ext === "png" ? "image/png" : "image/jpeg");
      const id = novoRelId();
      mapaRel.set(oldId, id);
      const novo = relsDoc.createElementNS(REL_NS, "Relationship");
      novo.setAttribute("Id", id);
      novo.setAttribute("Type", type);
      novo.setAttribute("Target", `../media/rdm${stamp}${oldId}.${ext}`);
      relsDoc.documentElement.appendChild(novo);
    }
  }

  // 3) copia as formas, com ids novos e relacionamentos remapeados
  let nextId = 1000;
  for (const child of Array.from(genTree.children)) {
    const local = child.localName;
    if (local === "nvGrpSpPr" || local === "grpSpPr") continue;
    const node = slideDoc.importNode(child, true) as Element;
    for (const el of Array.from(node.getElementsByTagNameNS("*", "cNvPr")))
      el.setAttribute("id", String(nextId++));
    const all = [node, ...Array.from(node.getElementsByTagName("*"))];
    for (const el of all) {
      for (const attr of Array.from(el.attributes)) {
        if (
          (attr.localName === "id" || attr.localName === "embed" || attr.localName === "link") &&
          attr.prefix === "r"
        ) {
          const novo = mapaRel.get(attr.value);
          if (novo) el.setAttributeNS(attr.namespaceURI, attr.name, novo);
        }
      }
    }
    spTree.appendChild(node);
  }

  // 4) remove relacionamentos/imagens que só serviam aos prints removidos
  const xmlFinal = serialize(slideDoc);
  for (const rel of Array.from(relsDoc.getElementsByTagNameNS(REL_NS, "Relationship"))) {
    const id = rel.getAttribute("Id") ?? "";
    const type = rel.getAttribute("Type") ?? "";
    if (type.endsWith("/image") && !xmlFinal.includes(`"${id}"`)) rel.parentNode?.removeChild(rel);
  }

  template.file(slidePath, xmlFinal);
  template.file(relsPath, serialize(relsDoc));
}

async function trocarMesDaCapa(template: JSZip, rotulo: string, subtitulo: string) {
  const path = "ppt/slides/slide1.xml";
  let xml = await template.file(path)!.async("string");
  // "Maio/2026" (ou qualquer Mês/AAAA) → mês escolhido
  xml = xml.replace(/<a:t>[A-Za-zÀ-ú]+\/\d{4}<\/a:t>/, `<a:t>${rotulo}</a:t>`);
  if (subtitulo.trim()) {
    const partes = subtitulo.split(/\s+[–-]\s+/);
    // Mantém a formatação do modelo: "Co-Manufatura" + " – Nakata"
    if (partes.length >= 2 && xml.includes("<a:t>Co-Manufatura</a:t>")) {
      xml = xml
        .replace("<a:t>Co-Manufatura</a:t>", `<a:t>${escapeXml(partes[0])}</a:t>`)
        .replace(
          /<a:t> – Nakata<\/a:t>/,
          `<a:t> – ${escapeXml(partes.slice(1).join(" – "))}</a:t>`,
        );
    }
  }
  template.file(path, xml);
}

function escapeXml(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function gerarPptxRdm(input: RdmPptxInput, opcoes: { output?: "file" | "blob" } = {}) {
  const resp = await fetch(TEMPLATE_URL);
  if (!resp.ok) throw new Error("Modelo da RDM não encontrado.");
  const template = await JSZip.loadAsync(await resp.arrayBuffer());

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13,333 × 7,5 pol — mesmo tamanho do modelo
  desenharSlide2(pptx, input);
  const gerado = await JSZip.loadAsync(
    (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer,
  );

  await transplantarSlide2(template, gerado);
  await trocarMesDaCapa(template, `${input.mes.mesLongo}/${input.ano}`, input.manual.capaSubtitulo);

  const blob = await template.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    compression: "DEFLATE",
  });
  if (opcoes.output === "blob") return blob;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `RDM - ${input.mes.mesLongo} ${input.ano} - Qualidade.pptx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
