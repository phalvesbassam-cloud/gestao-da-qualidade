// @ts-nocheck — código de desenho (pptxgenjs) compartilhado entre o navegador e o
// script Node (scripts/templates/gerar-templates.mjs). Mantido em JS simples para
// rodar no Node com remoção de tipos, sem etapa de compilação.
//
// Monta os seis modelos da Biblioteca de Templates e, opcionalmente, os slides com
// dados escolhidos no QualiHub, sempre no visual Fras-le Mobility.
import PptxGenJS from "pptxgenjs";
import { excelFormat } from "../slide-spec.ts";

/** Logos em base64 ("image/png;base64,..."), definidas por construirModelo. */
let LOGO = "";
let LOGO_BRANCA = "";
const LOGO_RAZAO = 1181 / 205;

// ---------------------------------------------------------------- identidade
const C = {
  red: "EC1C24",
  graf: "54565B",
  ink: "2E3034",
  muted: "74767B",
  mid: "A5A7AC",
  line: "D9DBDF",
  grid: "E8EAED",
  soft: "F4F5F7",
  soft2: "ECEDF0",
  white: "FFFFFF",
  dark: "3F4145",
  light: "C9CBCF",
};
const F = "Segoe UI";
const FL = "Segoe UI Light";
const W = 13.333;
const H = 7.5;
const MX = 0.6;
const CW = W - 2 * MX; // 12.133
const TOPO = 1.75; // início da área de conteúdo
const BASE = 6.78; // fim da área de conteúdo
const SEM_LINHA = { type: "none" };

// ------------------------------------------------------------------ helpers
function texto(s, conteudo, o) {
  s.addText(conteudo, { fontFace: F, color: C.ink, margin: 0, valign: "top", ...o });
}
function caixa(s, x, y, w, h, cor, o = {}) {
  s.addShape("rect", { x, y, w, h, fill: { color: cor }, line: SEM_LINHA, ...o });
}
function arred(s, x, y, w, h, cor, raio = 0.08, o = {}) {
  s.addShape("roundRect", { x, y, w, h, rectRadius: raio, fill: { color: cor }, line: SEM_LINHA, ...o });
}
function linha(s, x, y, w, h, cor = C.line, largura = 0.75, o = {}) {
  s.addShape("line", { x, y, w, h, line: { color: cor, width: largura, ...o } });
}
function forma(s, x, y, w, h, pontos, cor, o = {}) {
  s.addShape("custGeom", {
    x,
    y,
    w,
    h,
    points: [...pontos.map(([px, py]) => ({ x: px, y: py })), { close: true }],
    fill: { color: cor },
    line: SEM_LINHA,
    ...o,
  });
}
/** Faixas inclinadas, inspiradas nas listras da logo. */
function faixas(s, x, y, h, inclinacao, larguras, gap, cores) {
  let ox = 0;
  larguras.forEach((bw, i) => {
    forma(
      s,
      x + ox,
      y,
      bw + inclinacao,
      h,
      [
        [inclinacao, 0],
        [inclinacao + bw, 0],
        [bw, h],
        [0, h],
      ],
      cores[i % cores.length],
    );
    ox += bw + gap;
  });
}
function bolinha(s, x, y, d, cor, rotulo, o = {}) {
  s.addShape("ellipse", { x, y, w: d, h: d, fill: { color: cor }, line: SEM_LINHA });
  if (rotulo != null)
    texto(s, rotulo, {
      x,
      y,
      w: d,
      h: d,
      align: "center",
      valign: "middle",
      bold: true,
      fontSize: 12,
      color: C.white,
      ...o,
    });
}
function notas(s, txt) {
  s.addNotes(`${txt}\n\nModelo da Biblioteca de Templates Fras-le Mobility. Substitua os textos orientativos e os dados ilustrativos pelos seus.`);
}
function lead(s, txt) {
  if (txt) texto(s, txt, { x: MX, y: 1.14, w: 10.2, h: 0.4, fontSize: 13, color: C.muted });
}
function rotuloCaps(s, txt, x, y, w, cor = C.red, tam = 10.5) {
  texto(s, txt.toUpperCase(), { x, y, w, h: 0.28, fontSize: tam, bold: true, color: cor, charSpacing: 1.5 });
}
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// ------------------------------------------------------------------ masters
function areaImagem(nome, x, y, w, h, escuro = false, centroX = null) {
  const fundo = escuro ? "4A4C51" : C.soft;
  const icone = escuro ? "55575C" : "E0E2E6";
  const icone2 = escuro ? "5C5E63" : "D6D9DD";
  const s = Math.min(w, h);
  const k = Math.min(1, s / 3.2);
  const cx = centroX ?? x + w / 2;
  const cy = y + h / 2 - 0.2 * k;
  return [
    { rect: { x, y, w, h, fill: { color: fundo } } },
    {
      text: {
        text: "",
        options: { shape: "triangle", x: cx - 0.75 * k, y: cy - 0.45 * k, w: 1.2 * k, h: 0.85 * k, fill: { color: icone } },
      },
    },
    {
      text: {
        text: "",
        options: { shape: "triangle", x: cx - 0.05 * k, y: cy - 0.05 * k, w: 0.9 * k, h: 0.45 * k, fill: { color: icone2 } },
      },
    },
    {
      text: {
        text: "",
        options: { shape: "ellipse", x: cx + 0.35 * k, y: cy - 0.75 * k, w: 0.36 * k, h: 0.36 * k, fill: { color: icone } },
      },
    },
    {
      text: {
        text: "Espaço para imagem",
        options: {
          x: cx - 1.5,
          y: cy + 0.55 * k,
          w: 3,
          h: 0.3,
          align: "center",
          fontFace: F,
          fontSize: 10,
          color: escuro ? "7C7E83" : C.mid,
          margin: 0,
        },
      },
    },
    {
      placeholder: {
        options: { name: nome, type: "pic", x, y, w, h },
        text: "Clique no ícone para inserir uma imagem",
      },
    },
  ];
}

function definirMasters(pres, deck) {
  const titulo = {
    placeholder: {
      options: {
        name: "titulo",
        type: "title",
        x: MX,
        y: 0.52,
        w: 10.2,
        h: 0.62,
        fontFace: F,
        fontSize: 26,
        bold: true,
        color: C.ink,
        align: "left",
        valign: "middle",
        margin: 0,
      },
      text: "Título do slide",
    },
  };
  const conteudo = [
    { rect: { x: MX, y: 0.4, w: 0.5, h: 0.06, fill: { color: C.red } } },
    { image: { data: LOGO, x: W - MX - 1.45, y: 0.62, w: 1.45, h: 1.45 / LOGO_RAZAO } },
    titulo,
    { line: { x: MX, y: 6.98, w: CW, h: 0, line: { color: C.line, width: 0.75 } } },
    {
      text: {
        text: `FRAS-LE MOBILITY   |   ${deck.rodape}`,
        options: { x: MX, y: 7.06, w: 9, h: 0.24, fontFace: F, fontSize: 8, color: C.muted, charSpacing: 1, margin: 0 },
      },
    },
  ];
  const numero = { x: W - MX - 0.8, y: 7.04, w: 0.8, h: 0.26, fontFace: F, fontSize: 9, bold: true, color: C.red, align: "right" };

  pres.defineSlideMaster({ title: "Capa", background: { color: C.white }, objects: [] });
  pres.defineSlideMaster({
    title: "Capa com foto",
    background: { color: C.white },
    objects: areaImagem("foto", 7.35, 0, W - 7.35, H),
  });
  pres.defineSlideMaster({
    title: "Capa com foto inteira",
    background: { color: "3A3B3F" },
    objects: areaImagem("foto", 0, 0, W, H, true, 10.9),
  });
  pres.defineSlideMaster({
    title: "Divisória",
    background: { color: C.graf },
    objects: [{ image: { data: LOGO_BRANCA, x: MX + 0.1, y: 6.82, w: 1.55, h: 1.55 / LOGO_RAZAO } }],
    slideNumber: { ...numero, color: C.white },
  });
  pres.defineSlideMaster({ title: "Conteúdo", background: { color: C.white }, objects: conteudo, slideNumber: numero });
  pres.defineSlideMaster({
    title: "Texto e imagem",
    background: { color: C.white },
    objects: [...conteudo, ...areaImagem("foto", 7.0, TOPO, W - MX - 7.0, BASE - TOPO)],
    slideNumber: numero,
  });
  pres.defineSlideMaster({
    title: "Imagem em destaque",
    background: { color: C.white },
    objects: [...conteudo, ...areaImagem("foto", MX, TOPO, 8.2, BASE - TOPO)],
    slideNumber: numero,
  });
  pres.defineSlideMaster({
    title: "Antes e depois",
    background: { color: C.white },
    objects: [
      ...conteudo,
      ...areaImagem("fotoAntes", MX, TOPO, 5.75, 3.3),
      ...areaImagem("fotoDepois", W - MX - 5.75, TOPO, 5.75, 3.3),
    ],
    slideNumber: numero,
  });
}

function slideConteudo(pres, d, master = "Conteúdo") {
  const s = pres.addSlide({ masterName: master });
  s.addText(d.titulo, { placeholder: "titulo" });
  lead(s, d.lead);
  return s;
}

// ------------------------------------------------------------- capas (motivos)
function capaTexto(s, d, escuro = false) {
  const cor = escuro ? C.white : C.ink;
  const sub = escuro ? "D5D7DA" : C.muted;
  s.addImage({ data: escuro ? LOGO_BRANCA : LOGO, x: 0.75, y: 0.7, w: 2.3, h: 2.3 / LOGO_RAZAO });
  rotuloCaps(s, d.kicker, 0.75, 2.3, 6.2, escuro ? C.light : C.red, 12);
  texto(s, d.titulo, { x: 0.75, y: 2.68, w: 6.3, h: 1.7, fontSize: 40, bold: true, color: cor, valign: "top", lineSpacingMultiple: 0.95 });
  texto(s, d.subtitulo, { x: 0.75, y: 4.4, w: 6.0, h: 0.8, fontSize: 16, color: sub });
  caixa(s, 0.75, 5.4, 0.9, 0.05, C.red);
  texto(
    s,
    [
      { text: "Nome do apresentador", options: { bold: true, fontSize: 13, color: cor, breakLine: true } },
      { text: "Cargo  |  Área  |  Data", options: { fontSize: 12, color: sub } },
    ],
    { x: 0.75, y: 5.6, w: 6, h: 0.7 },
  );
}

function motivoExecutivo(pres, s) {
  s.addText("", { placeholder: "foto" });
  // Corte diagonal sobre a foto + listras no estilo da logo
  forma(s, 7.35, 0, 1.7, H, [[0, 0], [1.7, H], [0, H]], C.white);
  forma(s, 7.35, 0, 2.0, H, [[0, 0], [0.2, 0], [1.9, H], [1.7, H]], C.red);
  forma(s, 7.35, 0, 2.4, H, [[0.42, 0], [0.5, 0], [2.2, H], [2.12, H]], C.graf);
}

function motivoIndicadores(pres, s) {
  arred(s, 7.55, 0.95, 5.18, 5.6, C.soft, 0.12);
  rotuloCaps(s, "Painel de indicadores", 7.95, 1.3, 4, C.muted, 10);
  texto(s, "00,0%", { x: 7.95, y: 1.62, w: 2.6, h: 0.8, fontSize: 36, bold: true });
  arred(s, 10.55, 1.82, 1.75, 0.42, C.white, 0.21, { line: { color: C.line, width: 0.75 } });
  texto(s, "▲ Indicador", { x: 10.55, y: 1.82, w: 1.75, h: 0.42, align: "center", valign: "middle", fontSize: 11, bold: true, color: C.red });
  const base = 5.95;
  [3.2, 3.85, 4.5, 5.15].forEach((y) => linha(s, 7.95, y, 4.4, 0, C.line, 0.5, { dashType: "dash" }));
  linha(s, 7.95, base, 4.4, 0, C.mid, 1);
  const alturas = [1.1, 1.45, 1.3, 1.85, 1.7, 2.2, 2.05, 2.6];
  const pontos = [];
  alturas.forEach((a, i) => {
    const x = 8.05 + i * 0.54;
    caixa(s, x, base - a, 0.34, a, i === alturas.length - 1 ? C.red : i % 2 ? "8A8C91" : C.graf);
    pontos.push([x + 0.17, base - a - 0.32]);
  });
  const x0 = pontos[0][0];
  const yMin = Math.min(...pontos.map((p) => p[1]));
  const yMax = Math.max(...pontos.map((p) => p[1]));
  s.addShape("custGeom", {
    x: x0,
    y: yMin,
    w: pontos.at(-1)[0] - x0,
    h: yMax - yMin,
    points: pontos.map(([px, py], i) => ({ x: px - x0, y: py - yMin, ...(i === 0 ? { moveTo: true } : {}) })),
    line: { color: C.red, width: 2.25 },
    fill: { type: "none" },
  });
  const ult = pontos.at(-1);
  bolinha(s, ult[0] - 0.09, ult[1] - 0.09, 0.18, C.red);
}

function desenhoDisco(s, cx, cy, d, escala = 1) {
  const circ = (dd, cor, larg, o = {}) =>
    s.addShape("ellipse", { x: cx - dd / 2, y: cy - dd / 2, w: dd, h: dd, fill: { type: "none" }, line: { color: cor, width: larg, ...o } });
  circ(d, C.graf, 1.5);
  circ(d * 0.9, C.mid, 0.75, { dashType: "dash" });
  circ(d * 0.44, C.graf, 1.25);
  circ(d * 0.2, C.graf, 1.5);
  for (let k = 0; k < 5; k++) {
    const a = (-90 + k * 72) * (Math.PI / 180);
    const r = d * 0.16;
    const hd = 0.05 * d;
    s.addShape("ellipse", {
      x: cx + r * Math.cos(a) - hd / 2,
      y: cy + r * Math.sin(a) - hd / 2,
      w: hd,
      h: hd,
      fill: { type: "none" },
      line: { color: C.graf, width: 1 },
    });
  }
  const ext = d * 0.58;
  linha(s, cx - ext, cy, ext * 2, 0, C.red, 0.75 * escala, { dashType: "lgDashDot" });
  linha(s, cx, cy - ext, 0, ext * 2, C.red, 0.75 * escala, { dashType: "lgDashDot" });
  // cota do diâmetro
  const yc = cy + d / 2 + 0.38;
  linha(s, cx - d / 2, cy + 0.05, 0, d / 2 + 0.48, C.mid, 0.5);
  linha(s, cx + d / 2, cy + 0.05, 0, d / 2 + 0.48, C.mid, 0.5);
  linha(s, cx - d / 2, yc, d, 0, C.graf, 0.75, { beginArrowType: "triangle", endArrowType: "triangle" });
  texto(s, "Ø 000,00", { x: cx - 0.6, y: yc - 0.3, w: 1.2, h: 0.24, align: "center", fontSize: 10, color: C.graf, fill: { color: "F7F8FA" } });
}

function gradeCad(s, x, y, w, h, passo = 0.3, cor = "E9ECEF") {
  for (let gx = x + passo; gx < x + w - 0.01; gx += passo) linha(s, gx, y, 0, h, cor, 0.5);
  for (let gy = y + passo; gy < y + h - 0.01; gy += passo) linha(s, x, gy, w, 0, cor, 0.5);
}

function motivoEngenharia(pres, s) {
  caixa(s, 7.3, 0, W - 7.3, H, "F7F8FA");
  gradeCad(s, 7.3, 0, W - 7.3, H);
  desenhoDisco(s, 10.3, 3.25, 4.1);
  // balão de referência
  linha(s, 8.35, 1.35, 0.65, 0.55, C.graf, 0.75);
  s.addShape("ellipse", { x: 7.95, y: 1.0, w: 0.42, h: 0.42, fill: { color: C.white }, line: { color: C.graf, width: 1 } });
  texto(s, "A", { x: 7.95, y: 1.0, w: 0.42, h: 0.42, align: "center", valign: "middle", bold: true, fontSize: 12, color: C.graf });
  // carimbo
  const cx = 10.75;
  const cy = 6.45;
  s.addShape("rect", { x: cx, y: cy, w: 2.0, h: 0.72, fill: { color: C.white }, line: { color: C.graf, width: 0.75 } });
  linha(s, cx, cy + 0.36, 2.0, 0, C.graf, 0.5);
  linha(s, cx + 1.0, cy + 0.36, 0, 0.36, C.graf, 0.5);
  texto(s, "DESENHO Nº 0000-00", { x: cx + 0.08, y: cy + 0.08, w: 1.9, h: 0.22, fontSize: 7.5, bold: true, color: C.graf });
  texto(s, "ESC. 1:1", { x: cx + 0.08, y: cy + 0.44, w: 0.9, h: 0.22, fontSize: 7.5, color: C.graf });
  texto(s, "REV. A", { x: cx + 1.08, y: cy + 0.44, w: 0.9, h: 0.22, fontSize: 7.5, color: C.graf });
}

function anelPdca(s, cx, cy, d, comRotulos = true, tamLetra = 22) {
  const arcos = [
    { r: [272, 358], cor: C.red, letra: "P", nome: "Planejar", ang: -45 },
    { r: [2, 88], cor: C.graf, letra: "D", nome: "Executar", ang: 45 },
    { r: [92, 178], cor: "8A8C91", letra: "C", nome: "Verificar", ang: 135 },
    { r: [182, 268], cor: "B5B7BC", letra: "A", nome: "Agir", ang: 225 },
  ];
  const esp = 0.32;
  const rMeio = (d / 2) * (1 - esp / 2);
  arcos.forEach((a) => {
    s.addShape("blockArc", { x: cx - d / 2, y: cy - d / 2, w: d, h: d, angleRange: a.r, arcThicknessRatio: esp, fill: { color: a.cor }, line: SEM_LINHA });
    const rad = (a.ang * Math.PI) / 180;
    const lx = cx + rMeio * Math.cos(rad);
    const ly = cy + rMeio * Math.sin(rad);
    texto(s, a.letra, { x: lx - 0.35, y: ly - 0.32, w: 0.7, h: 0.64, align: "center", valign: "middle", bold: true, fontSize: tamLetra, color: C.white });
    if (comRotulos) {
      const ro = d / 2 + 0.42;
      const ox = cx + ro * Math.cos(rad);
      const oy = cy + ro * Math.sin(rad);
      texto(s, a.nome, { x: ox - 0.7, y: oy - 0.16, w: 1.4, h: 0.32, align: "center", fontSize: 11, bold: true, color: C.muted });
    }
  });
}

function motivoQualidade(pres, s) {
  caixa(s, 7.3, 0, W - 7.3, H, C.soft);
  anelPdca(s, 10.15, 3.5, 4.4);
  texto(s, "Melhoria\ncontínua", { x: 9.15, y: 3.0, w: 2.0, h: 1.0, align: "center", valign: "middle", fontSize: 15, bold: true, color: C.ink });
  faixas(s, 11.35, 6.55, 0.5, 0.35, [0.22, 0.22, 0.22], 0.12, [C.red]);
}

function motivoProcessos(pres, s) {
  caixa(s, 7.3, 0, W - 7.3, H, C.soft);
  const eng = (tipo, x, y, d, cor) => {
    s.addShape(tipo, { x, y, w: d, h: d, fill: { color: cor }, line: SEM_LINHA });
    s.addShape("ellipse", { x: x + d * 0.36, y: y + d * 0.36, w: d * 0.28, h: d * 0.28, fill: { color: C.soft }, line: SEM_LINHA });
  };
  eng("gear9", 7.95, 0.95, 3.4, C.graf);
  eng("gear6", 10.62, 3.15, 2.25, C.red);
  eng("gear6", 8.7, 4.25, 1.75, C.light);
  // fluxo
  const ys = 6.45;
  ["Entrada", "Processo", "Saída"].forEach((r, i) => {
    s.addShape(i === 0 ? "homePlate" : "chevron", {
      x: 7.95 + i * 1.62,
      y: ys,
      w: 1.72,
      h: 0.46,
      fill: { color: i === 1 ? C.red : C.graf },
      line: SEM_LINHA,
    });
    texto(s, r, { x: 7.95 + i * 1.62 + 0.18, y: ys, w: 1.4, h: 0.46, align: "center", valign: "middle", fontSize: 10.5, bold: true, color: C.white });
  });
}

function motivoInstitucional(pres, s) {
  s.addText("", { placeholder: "foto" });
  caixa(s, 0, 0, 7.6, H, C.graf, { fill: { color: C.graf, transparency: 6 } });
  forma(s, 7.6, 0, 1.7, H, [[0, 0], [1.6, 0], [0, H]], C.graf, { fill: { color: C.graf, transparency: 6 } });
  forma(s, 7.6, 0, 1.95, H, [[1.6, 0], [1.8, 0], [0.2, H], [0, H]], C.red);
}

function capa(pres, deck, d) {
  const mot = deck.motivo;
  const master = mot === "executivo" ? "Capa com foto" : mot === "institucional" ? "Capa com foto inteira" : "Capa";
  const s = pres.addSlide({ masterName: master });
  ({
    executivo: motivoExecutivo,
    indicadores: motivoIndicadores,
    engenharia: motivoEngenharia,
    qualidade: motivoQualidade,
    processos: motivoProcessos,
    institucional: motivoInstitucional,
  })[mot](pres, s);
  capaTexto(s, d, mot === "institucional");
  notas(s, "Capa: edite título, subtítulo, apresentador e data." + (master !== "Capa" ? " Clique no ícone da área de imagem para inserir uma fotografia." : ""));
}

// -------------------------------------------------------------- tipos de slide
function sumario(pres, deck, d) {
  const s = slideConteudo(pres, { titulo: d.titulo ?? "Sumário", lead: d.lead });
  const itens = d.itens;
  itens.forEach((it, i) => {
    const col = i < 3 ? 0 : 1;
    const lin = i % 3;
    const x = MX + col * 6.2;
    const y = TOPO + 0.1 + lin * 1.62;
    texto(s, String(i + 1).padStart(2, "0"), { x, y: y - 0.06, w: 1.0, h: 0.7, fontFace: FL, fontSize: 34, color: C.red });
    texto(s, it[0], { x: x + 1.05, y: y + 0.02, w: 4.8, h: 0.4, fontSize: 17, bold: true });
    texto(s, it[1], { x: x + 1.05, y: y + 0.46, w: 4.8, h: 0.62, fontSize: 12, color: C.muted });
    linha(s, x, y + 1.32, 5.93, 0, C.line, 0.75);
  });
  notas(s, "Sumário: liste os capítulos da apresentação (até 6). Duplique a divisória para cada capítulo.");
}

function divisoria(pres, deck, d) {
  const s = pres.addSlide({ masterName: "Divisória" });
  faixas(s, 8.35, 0, H, 1.7, [1.0, 1.0, 0.28], 0.38, ["5C5E63", "606267", C.red]);
  texto(s, d.numero ?? "01", { x: 0.75, y: 1.75, w: 3, h: 1.3, fontSize: 80, bold: true, color: C.red });
  texto(s, d.titulo, { x: 0.75, y: 3.15, w: 7.4, h: 1.0, fontSize: 36, bold: true, color: C.white });
  caixa(s, 0.78, 4.25, 0.9, 0.05, C.red);
  texto(s, d.texto, { x: 0.75, y: 4.5, w: 7.0, h: 1.0, fontSize: 15, color: "D3D5D8" });
  notas(s, "Divisória de capítulo: duplique este slide para abrir cada parte da apresentação.");
}

function textoImagem(pres, deck, d) {
  const s = slideConteudo(pres, d, "Texto e imagem");
  s.addText("", { placeholder: "foto" });
  texto(s, d.paragrafo, { x: MX, y: TOPO + 0.05, w: 6.0, h: 1.05, fontSize: 14, color: C.ink, lineSpacingMultiple: 1.1 });
  texto(
    s,
    d.topicos.map((t) => ({ text: t, options: { bullet: { indent: 18 }, breakLine: true } })),
    { x: MX, y: TOPO + 1.25, w: 6.0, h: 2.45, fontSize: 13.5, color: C.ink, paraSpaceAfter: 8 },
  );
  caixa(s, MX, 5.6, 6.0, 1.15, C.soft);
  caixa(s, MX, 5.6, 0.07, 1.15, C.red);
  rotuloCaps(s, d.destaqueTitulo ?? "Destaque", MX + 0.3, 5.75, 5.5, C.red, 10);
  texto(s, d.destaque, { x: MX + 0.3, y: 6.05, w: 5.5, h: 0.62, fontSize: 12.5 });
  notas(s, "Texto e imagem: clique no ícone à direita para inserir a foto. Mantenha até 5 tópicos.");
}

function imagemDestaque(pres, deck, d) {
  const s = slideConteudo(pres, d, "Imagem em destaque");
  s.addText("", { placeholder: "foto" });
  const x = 9.15;
  const w = W - MX - x;
  rotuloCaps(s, d.kicker ?? "Destaque", x, TOPO + 0.05, w);
  texto(s, d.chamada, { x, y: TOPO + 0.4, w, h: 1.05, fontSize: 20, bold: true, lineSpacingMultiple: 0.95 });
  texto(s, d.texto, { x, y: TOPO + 1.55, w, h: 1.35, fontSize: 12.5, color: C.muted, lineSpacingMultiple: 1.1 });
  d.numeros.forEach(([v, r], i) => {
    const y = TOPO + 3.1 + i * 0.95;
    linha(s, x, y, w, 0, C.line, 0.75);
    texto(s, v, { x, y: y + 0.12, w: 1.55, h: 0.6, fontSize: 24, bold: true, color: C.red });
    texto(s, r, { x: x + 1.6, y: y + 0.18, w: w - 1.6, h: 0.55, fontSize: 11.5, color: C.muted, valign: "middle" });
  });
  notas(s, "Imagem em destaque: use uma fotografia de boa resolução (paisagem). Os números à direita são opcionais.");
}

function antesDepois(pres, deck, d) {
  const s = slideConteudo(pres, d, "Antes e depois");
  s.addText("", { placeholder: "fotoAntes" });
  s.addText("", { placeholder: "fotoDepois" });
  const xs = [MX, W - MX - 5.75];
  const etiquetas = [
    [d.rotuloAntes ?? "ANTES", C.graf],
    [d.rotuloDepois ?? "DEPOIS", C.red],
  ];
  xs.forEach((x, i) => {
    const tw = Math.max(1.3, etiquetas[i][0].length * 0.12 + 0.5);
    arred(s, x + 0.2, TOPO + 0.2, tw, 0.38, etiquetas[i][1], 0.19);
    texto(s, etiquetas[i][0], { x: x + 0.2, y: TOPO + 0.2, w: tw, h: 0.38, align: "center", valign: "middle", fontSize: 10.5, bold: true, color: C.white, charSpacing: 1.5 });
    const itens = i === 0 ? d.antes : d.depois;
    caixa(s, x, 5.2, 5.75, 1.55, C.soft);
    caixa(s, x, 5.2, 5.75, 0.05, etiquetas[i][1]);
    texto(
      s,
      itens.map((t) => ({ text: t, options: { bullet: { indent: 16 }, breakLine: true } })),
      { x: x + 0.25, y: 5.38, w: 5.3, h: 1.3, fontSize: 12.5, paraSpaceAfter: 4 },
    );
  });
  const cx = W / 2;
  s.addShape("ellipse", { x: cx - 0.36, y: TOPO + 1.29, w: 0.72, h: 0.72, fill: { color: C.white }, line: { color: C.line, width: 1 } });
  s.addShape("rightArrow", { x: cx - 0.18, y: TOPO + 1.5, w: 0.38, h: 0.3, fill: { color: C.red }, line: SEM_LINHA });
  notas(s, "Antes e depois: insira as duas fotos nas áreas indicadas e descreva as diferenças abaixo de cada uma.");
}

function kpis(pres, deck, d) {
  const s = slideConteudo(pres, d);
  const n = d.cards.length;
  const gap = 0.18;
  const w = (CW - gap * (n - 1)) / n;
  d.cards.forEach((c, i) => {
    const x = MX + i * (w + gap);
    const y = TOPO;
    const h = 2.6;
    const destaque = i === (d.destaque ?? 0);
    caixa(s, x, y, w, h, C.soft);
    caixa(s, x, y, w, 0.06, destaque ? C.red : C.graf);
    rotuloCaps(s, c[0], x + 0.25, y + 0.3, w - 0.5, C.muted, 10);
    texto(s, c[1], { x: x + 0.25, y: y + 0.62, w: w - 0.5, h: 0.85, fontSize: 36, bold: true, color: destaque ? C.red : C.ink });
    texto(s, c[2], { x: x + 0.25, y: y + 1.5, w: w - 0.5, h: 0.3, fontSize: 11, color: C.muted });
    caixa(s, x + 0.25, y + 1.92, w - 0.5, 0.08, C.line);
    caixa(s, x + 0.25, y + 1.92, (w - 0.5) * (c[4] ?? 0.65), 0.08, destaque ? C.red : C.graf);
    texto(s, c[3], { x: x + 0.25, y: y + 2.1, w: w - 0.5, h: 0.3, fontSize: 10.5, bold: true, color: C.graf });
  });
  const y2 = TOPO + 2.9;
  const hw = (CW - 0.3) / 2;
  [
    [d.blocos?.[0]?.[0] ?? "Destaques do período", C.graf, d.blocos?.[0]?.[1]],
    [d.blocos?.[1]?.[0] ?? "Pontos de atenção", C.red, d.blocos?.[1]?.[1]],
  ].forEach(([tt, cor, itens], i) => {
    const x = MX + i * (hw + 0.3);
    caixa(s, x, y2, 0.06, BASE - y2, cor);
    texto(s, tt, { x: x + 0.25, y: y2, w: hw - 0.3, h: 0.36, fontSize: 14, bold: true });
    texto(
      s,
      (itens ?? ["Descreva o principal resultado do período.", "Explique a causa da variação em relação à meta.", "Indique a próxima ação ou decisão necessária."]).map((t) => ({
        text: t,
        options: { bullet: { indent: 16 }, breakLine: true },
      })),
      { x: x + 0.25, y: y2 + 0.45, w: hw - 0.3, h: BASE - y2 - 0.45, fontSize: 12.5, color: C.ink, paraSpaceAfter: 5 },
    );
  });
  notas(s, "Indicadores e KPIs: substitua 00,0 pelos valores reais. A barra mostra o atingimento da meta — ajuste a largura da forma.");
}

function addCombo(pres, s, tipos, opts) {
  s.addChart(tipos, opts);
}

const EIXOS = {
  catAxisLabelColor: C.muted,
  catAxisLabelFontFace: F,
  catAxisLabelFontSize: 10,
  valAxisLabelColor: C.muted,
  valAxisLabelFontFace: F,
  valAxisLabelFontSize: 10,
  catAxisLineShow: true,
  catAxisLineColor: C.line,
  valAxisLineShow: false,
  valGridLine: { color: C.grid, style: "solid", size: 0.75 },
  showLegend: true,
  legendPos: "b",
  legendFontFace: F,
  legendFontSize: 10,
  legendColor: C.muted,
};

function grafico(pres, deck, d) {
  const s = slideConteudo(pres, d);
  const gx = MX;
  const gy = TOPO;
  const gw = 8.25;
  const gh = 4.7;
  const kind = d.tipo ?? "combo";
  if (kind === "combo") {
    addCombo(
      pres,
      s,
      [
        {
          type: pres.ChartType.bar,
          data: [{ name: "Realizado", labels: MESES, values: [62, 68, 65, 71, 74, 70, 76, 79, 77, 82, 84, 86] }],
          options: { chartColors: [C.graf], barGapWidthPct: 55 },
        },
        {
          type: pres.ChartType.line,
          data: [{ name: "Meta", labels: MESES, values: Array(12).fill(80) }],
          options: { chartColors: [C.red], lineSize: 2.5, lineDataSymbol: "none", lineDash: "dash" },
        },
      ],
      { x: gx, y: gy, w: gw, h: gh, ...EIXOS, valAxisMinVal: 0, valAxisMaxVal: 100 },
    );
  } else if (kind === "pareto") {
    const cats = d.categorias ?? ["Causa A", "Causa B", "Causa C", "Causa D", "Causa E", "Causa F", "Outras"];
    const vals = [38, 24, 14, 9, 6, 5, 4];
    let ac = 0;
    const tot = vals.reduce((a, b) => a + b, 0);
    const acum = vals.map((v) => Math.round(((ac += v) / tot) * 1000) / 10);
    addCombo(
      pres,
      s,
      [
        {
          type: pres.ChartType.bar,
          data: [{ name: "Ocorrências", labels: cats, values: vals }],
          options: { chartColors: [C.graf], barGapWidthPct: 40, showValue: true, dataLabelPosition: "outEnd", dataLabelColor: C.ink, dataLabelFontSize: 10 },
        },
        {
          type: pres.ChartType.line,
          data: [{ name: "% acumulado", labels: cats, values: acum }],
          options: { chartColors: [C.red], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 7, secondaryValAxis: true, secondaryCatAxis: true },
        },
      ],
      {
        x: gx,
        y: gy,
        w: gw,
        h: gh,
        ...EIXOS,
        valAxes: [
          { showValAxisTitle: false, valAxisMinVal: 0, valGridLine: { color: C.grid, style: "solid", size: 0.75 }, valAxisLabelColor: C.muted },
          { showValAxisTitle: false, valAxisMinVal: 0, valAxisMaxVal: 100, valGridLine: { style: "none" }, valAxisLabelColor: C.muted, valAxisLabelFormatCode: '0"%"' },
        ],
        catAxes: [{ catAxisTitle: "" }, { catAxisHidden: true }],
      },
    );
  } else if (kind === "linhas") {
    s.addChart(
      pres.ChartType.line,
      [
        { name: d.series?.[0] ?? "Indicador A", labels: MESES, values: [3.2, 2.9, 3.1, 2.6, 2.4, 2.5, 2.1, 1.9, 2.0, 1.7, 1.6, 1.5] },
        { name: d.series?.[1] ?? "Indicador B", labels: MESES, values: [2.1, 2.3, 2.0, 2.2, 1.9, 1.8, 1.9, 1.6, 1.5, 1.6, 1.4, 1.3] },
        { name: "Meta", labels: MESES, values: Array(12).fill(2) },
      ],
      { x: gx, y: gy, w: gw, h: gh, ...EIXOS, chartColors: [C.graf, "9A9CA1", C.red], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 6 },
    );
  } else if (kind === "barrasH") {
    const cats = d.categorias ?? ["Item A", "Item B", "Item C", "Item D", "Item E", "Item F"];
    s.addChart(
      pres.ChartType.bar,
      [
        { name: "Antes", labels: cats, values: [42, 37, 33, 28, 22, 18] },
        { name: "Depois", labels: cats, values: [30, 26, 25, 19, 15, 12] },
      ],
      { x: gx, y: gy, w: gw, h: gh, ...EIXOS, barDir: "bar", chartColors: ["B5B7BC", C.red], barGapWidthPct: 45, showValue: true, dataLabelColor: C.ink, dataLabelFontSize: 9, dataLabelPosition: "outEnd" },
    );
  } else if (kind === "rosca") {
    const cats = d.categorias ?? ["Categoria A", "Categoria B", "Categoria C", "Categoria D"];
    s.addChart(pres.ChartType.doughnut, [{ name: "Distribuição", labels: cats, values: [40, 28, 20, 12] }], {
      x: gx,
      y: gy,
      w: gw,
      h: gh,
      holeSize: 62,
      chartColors: [C.red, C.graf, "8A8C91", C.light],
      showPercent: true,
      showValue: false,
      dataLabelColor: C.white,
      dataLabelFontSize: 11,
      showLegend: true,
      legendPos: "r",
      legendFontFace: F,
      legendFontSize: 11,
      legendColor: C.ink,
    });
  }
  texto(s, "Dados ilustrativos — clique com o botão direito no gráfico › Editar dados.", { x: gx, y: gy + gh + 0.06, w: gw, h: 0.24, fontSize: 9, color: C.mid, italic: true });
  const px = 9.2;
  const pw = W - MX - px;
  caixa(s, px, gy, pw, BASE - gy, C.soft);
  texto(s, d.painelTitulo ?? "Leitura do gráfico", { x: px + 0.3, y: gy + 0.3, w: pw - 0.6, h: 0.4, fontSize: 15, bold: true });
  (d.leituras ?? ["Tendência principal do período.", "Ponto fora da curva e sua causa.", "Ação ou decisão recomendada."]).forEach((t, i) => {
    const y = gy + 0.95 + i * 1.22;
    bolinha(s, px + 0.3, y, 0.42, i === 0 ? C.red : C.graf, String(i + 1), { fontSize: 12 });
    texto(s, t, { x: px + 0.88, y: y - 0.02, w: pw - 1.15, h: 1.05, fontSize: 12.5, color: C.ink });
  });
  notas(s, "Gráfico nativo do PowerPoint: clique com o botão direito › Editar dados para colar os seus valores. Cores e legenda já seguem a identidade.");
}

function tabela(pres, deck, d) {
  const s = slideConteudo(pres, d);
  const cab = d.colunas.map((c) => ({
    text: c,
    options: { bold: true, color: C.white, fill: { color: C.graf }, fontSize: 11, valign: "middle", align: "left" },
  }));
  const linhas = d.linhas.map((l, i) =>
    l.map((v, j) => {
      const st = d.status?.[v];
      return {
        text: v,
        options: {
          fill: { color: i % 2 ? "F8F8F9" : C.white },
          color: st ?? (j === 0 ? C.ink : "45474B"),
          bold: j === 0 || !!st,
          fontSize: 11,
          valign: "middle",
          align: d.alinhar?.[j] ?? "left",
        },
      };
    }),
  );
  s.addTable([cab, ...linhas], {
    x: MX,
    y: TOPO,
    w: CW,
    colW: d.larguras,
    rowH: d.alturaLinha ?? 0.56,
    fontFace: F,
    margin: [0.04, 0.12, 0.04, 0.12],
    border: { type: "solid", pt: 0.75, color: C.line },
  });
  if (d.legenda) {
    const y = BASE - 0.3;
    let x = MX;
    d.legenda.forEach(([r, cor]) => {
      bolinha(s, x, y + 0.06, 0.16, cor);
      texto(s, r, { x: x + 0.24, y, w: 1.9, h: 0.28, fontSize: 10.5, color: C.muted, valign: "middle" });
      x += 2.1;
    });
  }
  notas(s, "Tabela nativa: clique dentro dela para editar. Use Tab para criar novas linhas; o estilo é mantido.");
}

function cronograma(pres, deck, d) {
  const s = slideConteudo(pres, d);
  const per = d.periodos ?? MESES;
  const lx = MX;
  const lw = 3.25;
  const gx = lx + lw + 0.15;
  const gw = W - MX - gx;
  const cw = gw / per.length;
  const y0 = TOPO;
  const rh = 0.56;
  const tarefas = d.tarefas;
  const yfim = y0 + 0.45 + tarefas.length * rh;
  per.forEach((p, i) => {
    if (i % 2 === 0) caixa(s, gx + i * cw, y0, cw, yfim - y0, "F8F8F9");
    texto(s, p, { x: gx + i * cw, y: y0 + 0.06, w: cw, h: 0.3, align: "center", fontSize: 10.5, bold: true, color: C.muted });
  });
  linha(s, lx, y0 + 0.45, W - MX - lx, 0, C.mid, 0.75);
  const cores = { feito: C.graf, andamento: C.red, previsto: C.light };
  tarefas.forEach(([nome, resp, ini, dur, st], i) => {
    const y = y0 + 0.45 + i * rh;
    texto(s, nome, { x: lx, y: y + 0.07, w: lw, h: 0.26, fontSize: 12, bold: true });
    texto(s, resp, { x: lx, y: y + 0.3, w: lw, h: 0.22, fontSize: 9.5, color: C.muted });
    linha(s, lx, y + rh, W - MX - lx, 0, C.grid, 0.5);
    if (st === "marco") {
      const cx = gx + ini * cw + cw / 2;
      s.addShape("diamond", { x: cx - 0.15, y: y + 0.13, w: 0.3, h: 0.3, fill: { color: C.red }, line: SEM_LINHA });
      texto(s, "Marco", { x: cx + 0.2, y: y + 0.15, w: 1.2, h: 0.26, fontSize: 9.5, bold: true, color: C.red });
    } else {
      arred(s, gx + ini * cw + 0.05, y + 0.15, dur * cw - 0.1, 0.27, cores[st], 0.135);
    }
  });
  const hoje = gx + (d.hoje ?? 5.5) * cw;
  linha(s, hoje, y0 + 0.4, 0, yfim - y0 - 0.35, C.red, 1, { dashType: "dash" });
  arred(s, hoje - 0.35, y0 + 0.37, 0.7, 0.22, C.red, 0.11);
  texto(s, "Hoje", { x: hoje - 0.35, y: y0 + 0.37, w: 0.7, h: 0.22, align: "center", valign: "middle", fontSize: 8.5, bold: true, color: C.white });
  const ly = BASE - 0.28;
  let x = gx;
  [
    ["Concluído", C.graf],
    ["Em andamento", C.red],
    ["Previsto", C.light],
  ].forEach(([r, cor]) => {
    arred(s, x, ly + 0.06, 0.4, 0.16, cor, 0.08);
    texto(s, r, { x: x + 0.5, y: ly, w: 1.6, h: 0.28, fontSize: 10.5, color: C.muted, valign: "middle" });
    x += 2.0;
  });
  s.addShape("diamond", { x, y: ly + 0.05, w: 0.18, h: 0.18, fill: { color: C.red }, line: SEM_LINHA });
  texto(s, "Marco", { x: x + 0.3, y: ly, w: 1.2, h: 0.28, fontSize: 10.5, color: C.muted, valign: "middle" });
  notas(s, "Cronograma: arraste e redimensione as barras para cada etapa. Cinza = concluído, vermelho = em andamento, claro = previsto. Mova a linha 'Hoje' conforme a data.");
}

function fluxograma(pres, deck, d) {
  const s = slideConteudo(pres, d);
  const cy = TOPO + 1.25;
  const nos = d.etapas; // 5 nós: início, processo, decisão, processo, fim
  const geo = [
    { x: MX, w: 1.75, h: 0.85, tipo: "inicio" },
    { x: 2.9, w: 2.05, h: 0.95, tipo: "processo" },
    { x: 5.5, w: 2.25, h: 1.5, tipo: "decisao" },
    { x: 8.3, w: 2.05, h: 0.95, tipo: "processo" },
    { x: 10.93, w: 1.8, h: 0.85, tipo: "fim" },
  ];
  geo.forEach((g, i) => {
    const y = cy - g.h / 2;
    const [tt, sub] = nos[i];
    if (g.tipo === "inicio" || g.tipo === "fim") {
      arred(s, g.x, y, g.w, g.h, g.tipo === "fim" ? C.red : C.graf, g.h / 2);
      texto(s, tt, { x: g.x, y, w: g.w, h: g.h, align: "center", valign: "middle", fontSize: 13, bold: true, color: C.white });
    } else if (g.tipo === "decisao") {
      s.addShape("diamond", { x: g.x, y, w: g.w, h: g.h, fill: { color: C.white }, line: { color: C.red, width: 1.75 } });
      texto(s, [{ text: tt, options: { bold: true, breakLine: true } }, { text: sub, options: { fontSize: 9.5, color: C.muted } }], {
        x: g.x + 0.3,
        y,
        w: g.w - 0.6,
        h: g.h,
        align: "center",
        valign: "middle",
        fontSize: 12,
      });
    } else {
      s.addShape("rect", { x: g.x, y, w: g.w, h: g.h, fill: { color: C.soft }, line: { color: C.graf, width: 1.25 } });
      caixa(s, g.x, y, 0.07, g.h, C.graf);
      texto(s, [{ text: tt, options: { bold: true, breakLine: true } }, { text: sub, options: { fontSize: 10, color: C.muted } }], {
        x: g.x + 0.2,
        y,
        w: g.w - 0.3,
        h: g.h,
        valign: "middle",
        fontSize: 12.5,
      });
    }
  });
  const seta = { endArrowType: "triangle" };
  for (let i = 0; i < geo.length - 1; i++) {
    const a = geo[i];
    const b = geo[i + 1];
    linha(s, a.x + a.w + 0.04, cy, b.x - a.x - a.w - 0.08, 0, C.graf, 1.5, seta);
  }
  texto(s, "Sim", { x: 7.75, y: cy - 0.38, w: 0.55, h: 0.26, align: "center", fontSize: 10.5, bold: true, color: C.graf });
  // ramo "Não"
  const dx = geo[2].x + geo[2].w / 2;
  const by = cy + 0.75;
  const bx = 5.6;
  const bw = 2.05;
  const bt = cy + 1.4;
  linha(s, dx, by + 0.02, 0, bt - by - 0.06, C.red, 1.5, seta);
  texto(s, "Não", { x: dx + 0.1, y: by + 0.1, w: 0.6, h: 0.26, fontSize: 10.5, bold: true, color: C.red });
  s.addShape("rect", { x: bx, y: bt, w: bw, h: 0.85, fill: { color: "FDEDEE" }, line: { color: C.red, width: 1.25 } });
  texto(s, [{ text: d.desvio[0], options: { bold: true, breakLine: true } }, { text: d.desvio[1], options: { fontSize: 10, color: C.muted } }], {
    x: bx + 0.15,
    y: bt,
    w: bw - 0.3,
    h: 0.85,
    valign: "middle",
    align: "center",
    fontSize: 12,
  });
  const rx = geo[1].x + geo[1].w / 2;
  linha(s, rx, bt + 0.425, bx - rx - 0.02, 0, C.red, 1.5);
  linha(s, rx, cy + geo[1].h / 2 + 0.04, 0, bt + 0.425 - cy - geo[1].h / 2 - 0.04, C.red, 1.5, { beginArrowType: "triangle" });
  // faixa de informações
  const iy = 5.55;
  const iw = (CW - 0.36) / 3;
  (d.infos ?? [
    ["Entradas", "Documentos, materiais e informações que iniciam o fluxo."],
    ["Saídas", "Resultado entregue ao final do processo."],
    ["Indicador", "Como o desempenho do fluxo é medido."],
  ]).forEach(([tt, tx], i) => {
    const x = MX + i * (iw + 0.18);
    caixa(s, x, iy, iw, BASE - iy, C.soft);
    rotuloCaps(s, tt, x + 0.25, iy + 0.18, iw - 0.5, i === 2 ? C.red : C.graf, 10);
    texto(s, tx, { x: x + 0.25, y: iy + 0.5, w: iw - 0.5, h: 0.65, fontSize: 11.5 });
  });
  notas(s, "Fluxograma com formas e conectores editáveis. Para incluir etapas, copie uma caixa e uma seta (Ctrl+D) e reposicione.");
}

function planoAcao(pres, deck, d) {
  tabela(pres, deck, {
    titulo: d.titulo ?? "Plano de ação",
    lead: d.lead ?? "Ações definidas no formato 5W2H, com responsável, prazo e situação",
    colunas: ["#", "O quê (ação)", "Por quê", "Quem", "Quando", "Onde / Como", "Status"],
    larguras: [0.45, 2.95, 2.3, 1.55, 1.2, 2.33, 1.35],
    alinhar: ["center", "left", "left", "left", "center", "left", "left"],
    linhas: (d.linhas ?? [
      ["Descreva a ação", "Causa ou objetivo tratado", "Responsável", "dd/mm/aaaa", "Local e método", "Concluída"],
      ["Descreva a ação", "Causa ou objetivo tratado", "Responsável", "dd/mm/aaaa", "Local e método", "Em andamento"],
      ["Descreva a ação", "Causa ou objetivo tratado", "Responsável", "dd/mm/aaaa", "Local e método", "Em andamento"],
      ["Descreva a ação", "Causa ou objetivo tratado", "Responsável", "dd/mm/aaaa", "Local e método", "Atrasada"],
      ["Descreva a ação", "Causa ou objetivo tratado", "Responsável", "dd/mm/aaaa", "Local e método", "Não iniciada"],
      ["Descreva a ação", "Causa ou objetivo tratado", "Responsável", "dd/mm/aaaa", "Local e método", "Não iniciada"],
    ]).map((l, i) => [String(i + 1), ...l]),
    status: { Concluída: "2F7D4F", "Em andamento": "B7791F", Atrasada: C.red, "Não iniciada": C.muted },
    legenda: [
      ["Concluída", "2F7D4F"],
      ["Em andamento", "B7791F"],
      ["Atrasada", C.red],
      ["Não iniciada", C.mid],
    ],
    alturaLinha: 0.58,
  });
}

function encerramento(pres, deck, d) {
  const s = pres.addSlide({ masterName: "Capa" });
  forma(s, 7.9, 0, W - 7.9, H, [[1.5, 0], [W - 7.9, 0], [W - 7.9, H], [0.3, H]], C.graf);
  forma(s, 7.6, 0, 1.6, H, [[1.2, 0], [1.42, 0], [0.22, H], [0, H]], C.red);
  s.addImage({ data: LOGO_BRANCA, x: 9.55, y: 3.3, w: 2.9, h: 2.9 / LOGO_RAZAO });
  texto(s, deck.rodape.toUpperCase(), { x: 9.1, y: 3.95, w: 3.8, h: 0.3, align: "center", fontSize: 10, color: C.light, charSpacing: 2 });
  s.addImage({ data: LOGO, x: 0.75, y: 0.7, w: 2.3, h: 2.3 / LOGO_RAZAO });
  texto(s, d.titulo ?? "Obrigado!", { x: 0.75, y: 2.1, w: 6.6, h: 1.1, fontSize: 54, bold: true });
  texto(s, d.subtitulo ?? "Dúvidas, comentários e próximos passos", { x: 0.75, y: 3.25, w: 6.6, h: 0.5, fontSize: 18, color: C.muted });
  caixa(s, 0.78, 4.0, 0.9, 0.05, C.red);
  texto(
    s,
    [
      { text: "Nome do apresentador", options: { bold: true, fontSize: 15, breakLine: true } },
      { text: "Cargo  |  Área", options: { fontSize: 12.5, color: C.muted, breakLine: true } },
      { text: "E-mail  |  Telefone / ramal", options: { fontSize: 12.5, color: C.muted } },
    ],
    { x: 0.75, y: 4.25, w: 6.4, h: 1.2, paraSpaceAfter: 3 },
  );
  notas(s, "Encerramento: atualize os contatos do apresentador.");
}

// ------------------------------------------------------- slides especializados
function decisoes(pres, deck, d) {
  const s = slideConteudo(pres, d);
  const gap = 0.25;
  const w = (CW - gap * 2) / 3;
  d.cards.forEach(([tt, tx, rec, imp], i) => {
    const x = MX + i * (w + gap);
    const y = TOPO;
    const h = BASE - y;
    s.addShape("rect", { x, y, w, h, fill: { color: C.white }, line: { color: C.line, width: 1 } });
    caixa(s, x, y, w, 0.06, i === 0 ? C.red : C.graf);
    bolinha(s, x + 0.3, y + 0.35, 0.55, i === 0 ? C.red : C.graf, String(i + 1), { fontSize: 15 });
    arred(s, x + w - 1.75, y + 0.45, 1.45, 0.34, C.soft, 0.17);
    texto(s, `Impacto: ${imp}`, { x: x + w - 1.75, y: y + 0.45, w: 1.45, h: 0.34, align: "center", valign: "middle", fontSize: 10, bold: true, color: C.graf });
    texto(s, tt, { x: x + 0.3, y: y + 1.15, w: w - 0.6, h: 0.75, fontSize: 17, bold: true });
    texto(s, tx, { x: x + 0.3, y: y + 1.95, w: w - 0.6, h: 1.35, fontSize: 12.5, color: C.muted });
    caixa(s, x + 0.3, y + 3.45, w - 0.6, 1.3, C.soft);
    rotuloCaps(s, "Recomendação", x + 0.5, y + 3.6, w - 1.0, C.red, 9.5);
    texto(s, rec, { x: x + 0.5, y: y + 3.92, w: w - 1.0, h: 0.75, fontSize: 12 });
  });
  notas(s, "Pontos para decisão: um card por tema que precisa de deliberação da liderança.");
}

function ishikawa(pres, deck, d) {
  const s = slideConteudo(pres, d);
  const ey = 4.05; // espinha
  const hx = 10.65;
  linha(s, MX + 0.2, ey, hx - MX - 0.25, 0, C.graf, 3, { endArrowType: "triangle" });
  s.addShape("rect", { x: hx, y: ey - 0.85, w: W - MX - hx, h: 1.7, fill: { color: C.red }, line: SEM_LINHA });
  texto(s, [{ text: "EFEITO", options: { fontSize: 10, bold: true, charSpacing: 2, breakLine: true } }, { text: d.efeito, options: { fontSize: 14, bold: true } }], {
    x: hx + 0.2,
    y: ey - 0.85,
    w: W - MX - hx - 0.4,
    h: 1.7,
    valign: "middle",
    color: C.white,
  });
  const cats = ["Método", "Máquina", "Medição", "Mão de obra", "Material", "Meio ambiente"];
  const xs = [3.55, 6.35, 9.15];
  cats.forEach((c, i) => {
    const cima = i < 3;
    const xa = xs[i % 3];
    const dx = 1.35;
    const dy = 1.75;
    if (cima) linha(s, xa - dx, ey - dy, dx, dy, C.graf, 1.75);
    else s.addShape("line", { x: xa - dx, y: ey, w: dx, h: dy, flipV: true, line: { color: C.graf, width: 1.75 } });
    const ly = cima ? ey - dy - 0.48 : ey + dy + 0.08;
    arred(s, xa - dx - 0.85, ly, 1.75, 0.4, i === 0 ? C.red : C.graf, 0.2);
    texto(s, c, { x: xa - dx - 0.85, y: ly, w: 1.75, h: 0.4, align: "center", valign: "middle", fontSize: 11.5, bold: true, color: C.white });
    texto(s, "• Causa provável\n• Causa provável", {
      x: xa - dx + 0.05 - (cima ? 1.45 : 1.45) + 0.85,
      y: cima ? ey - 1.15 : ey + 0.3,
      w: 1.4,
      h: 0.7,
      fontSize: 10,
      color: C.muted,
    });
  });
  notas(s, "Diagrama de Ishikawa (6M): registre as causas prováveis em cada categoria e destaque a(s) causa(s) mais provável(is).");
}

function cincoPorques(pres, deck, d) {
  const s = slideConteudo(pres, d);
  const pw = 3.3;
  caixa(s, MX, TOPO, pw, BASE - TOPO, C.graf);
  caixa(s, MX, TOPO, 0.07, BASE - TOPO, C.red);
  rotuloCaps(s, "Problema", MX + 0.3, TOPO + 0.3, pw - 0.6, C.light, 10.5);
  texto(s, d.problema, { x: MX + 0.3, y: TOPO + 0.65, w: pw - 0.6, h: 2.0, fontSize: 17, bold: true, color: C.white });
  texto(s, "O quê, onde, quando e quanto. Descreva o problema com dados objetivos.", { x: MX + 0.3, y: TOPO + 2.8, w: pw - 0.6, h: 1.0, fontSize: 11.5, color: C.light });
  const x0 = MX + pw + 0.3;
  const rw = W - MX - x0;
  for (let i = 0; i < 5; i++) {
    const y = TOPO + i * 0.78;
    const tom = ["54565B", "64666B", "74767B", "86888D", "989A9F"][i];
    s.addShape("homePlate", { x: x0, y, w: 1.7, h: 0.62, fill: { color: tom }, line: SEM_LINHA });
    texto(s, `Por quê ${i + 1}?`, { x: x0 + 0.12, y, w: 1.4, h: 0.62, valign: "middle", fontSize: 12, bold: true, color: C.white });
    s.addShape("rect", { x: x0 + 1.85, y, w: rw - 1.85, h: 0.62, fill: { color: C.soft }, line: SEM_LINHA });
    texto(s, i === 0 ? "Por que o problema ocorreu? Escreva a resposta com base em fatos." : "Por que a resposta anterior aconteceu?", {
      x: x0 + 2.05,
      y,
      w: rw - 2.25,
      h: 0.62,
      valign: "middle",
      fontSize: 12,
      color: C.muted,
    });
  }
  const yc = TOPO + 5 * 0.78 + 0.08;
  s.addShape("rect", { x: x0, y: yc, w: rw, h: BASE - yc, fill: { color: C.red }, line: SEM_LINHA });
  texto(s, [{ text: "CAUSA RAIZ   ", options: { bold: true, charSpacing: 2, fontSize: 11 } }, { text: "Descreva a causa fundamental que, se eliminada, impede a recorrência.", options: { fontSize: 13 } }], {
    x: x0 + 0.3,
    y: yc,
    w: rw - 0.6,
    h: BASE - yc,
    valign: "middle",
    color: C.white,
  });
  notas(s, "5 Porquês: pergunte 'por quê?' até chegar à causa raiz. Nem sempre são necessários os cinco níveis.");
}

function especificacao(pres, deck, d) {
  const s = slideConteudo(pres, d);
  const pw = 5.6;
  caixa(s, MX, TOPO, pw, BASE - TOPO, "F7F8FA");
  gradeCad(s, MX, TOPO, pw, BASE - TOPO, 0.25);
  s.addShape("rect", { x: MX, y: TOPO, w: pw, h: BASE - TOPO, fill: { type: "none" }, line: { color: C.line, width: 0.75 } });
  desenhoDisco(s, MX + pw / 2, TOPO + 2.2, 3.0);
  texto(s, "Desenho ilustrativo — substitua pelo desenho técnico do item.", { x: MX + 0.2, y: BASE - 0.35, w: pw - 0.4, h: 0.25, fontSize: 9, italic: true, color: C.mid });
  const tx = MX + pw + 0.35;
  const tw = W - MX - tx;
  const linhas = d.linhas;
  s.addTable(
    [
      ["Característica", "Especificação", "Tolerância", "Método"].map((c) => ({
        text: c,
        options: { bold: true, color: C.white, fill: { color: C.graf }, fontSize: 11 },
      })),
      ...linhas.map((l, i) => l.map((v, j) => ({ text: v, options: { fontSize: 11, bold: j === 0, color: j === 0 ? C.ink : "45474B", fill: { color: i % 2 ? "F8F8F9" : C.white } } }))),
    ],
    { x: tx, y: TOPO, w: tw, colW: [2.0, 1.55, 1.25, tw - 4.8], rowH: 0.46, fontFace: F, margin: [0.04, 0.1, 0.04, 0.1], border: { type: "solid", pt: 0.75, color: C.line }, valign: "middle" },
  );
  const cy = TOPO + 0.46 * (linhas.length + 1) + 0.3;
  caixa(s, tx, cy, tw, BASE - cy, C.soft);
  caixa(s, tx, cy, 0.07, BASE - cy, C.red);
  rotuloCaps(s, "Características críticas", tx + 0.3, cy + 0.18, tw - 0.6, C.red, 10);
  texto(s, "Liste as características especiais (CC/SC) e como são controladas no processo.", { x: tx + 0.3, y: cy + 0.5, w: tw - 0.6, h: BASE - cy - 0.6, fontSize: 12 });
  notas(s, "Especificação técnica: insira o desenho (Inserir › Imagem) sobre a área quadriculada e preencha a tabela de características.");
}

function sipoc(pres, deck, d) {
  const s = slideConteudo(pres, d);
  const cols = [
    ["S", "Fornecedores", "Quem fornece as entradas"],
    ["I", "Entradas", "Materiais e informações"],
    ["P", "Processo", "Etapas principais"],
    ["O", "Saídas", "O que é entregue"],
    ["C", "Clientes", "Quem recebe as saídas"],
  ];
  const gap = 0.08;
  const w = (CW - gap * 4) / 5;
  cols.forEach(([l, nome, sub], i) => {
    const x = MX + i * (w + gap);
    const cor = i === 2 ? C.red : C.graf;
    s.addShape(i === 0 ? "homePlate" : "chevron", { x, y: TOPO, w: w + 0.22, h: 0.95, fill: { color: cor }, line: SEM_LINHA });
    texto(s, [{ text: `${l}  `, options: { fontSize: 22, bold: true } }, { text: nome, options: { fontSize: 13, bold: true } }], {
      x: x + (i === 0 ? 0.18 : 0.6),
      y: TOPO,
      w: w - (i === 0 ? 0.3 : 0.6),
      h: 0.95,
      valign: "middle",
      color: C.white,
    });
    texto(s, sub, { x: x + 0.05, y: TOPO + 1.05, w: w - 0.1, h: 0.3, fontSize: 10.5, color: C.muted, align: "center" });
    for (let k = 0; k < 4; k++) {
      const y = TOPO + 1.5 + k * 0.85;
      s.addShape("rect", { x: x + 0.05, y, w: w - 0.1, h: 0.72, fill: { color: i === 2 ? "FDEDEE" : C.soft }, line: SEM_LINHA });
      texto(s, i === 2 ? `Etapa ${k + 1}` : "Item", { x: x + 0.2, y, w: w - 0.4, h: 0.72, valign: "middle", fontSize: 12, color: i === 2 ? C.ink : C.muted, bold: i === 2 });
    }
  });
  notas(s, "SIPOC: mapeie fornecedores, entradas, etapas do processo, saídas e clientes. A coluna P (processo) deve ter de 4 a 7 etapas.");
}

function missaoVisao(pres, deck, d) {
  const s = slideConteudo(pres, d);
  const gap = 0.25;
  const w = (CW - gap * 2) / 3;
  [
    ["Missão", "Por que a área existe e qual valor entrega para a empresa e para os clientes."],
    ["Visão", "Onde a área quer chegar nos próximos anos. Escreva de forma inspiradora e mensurável."],
    ["Valores", "Princípios que orientam o trabalho da equipe no dia a dia."],
  ].forEach(([tt, tx], i) => {
    const x = MX + i * (w + gap);
    caixa(s, x, TOPO, w, BASE - TOPO, i === 1 ? C.graf : C.soft);
    texto(s, String(i + 1).padStart(2, "0"), { x: x + 0.35, y: TOPO + 0.3, w: 1.2, h: 0.75, fontFace: FL, fontSize: 40, color: i === 1 ? "FF7A7F" : C.red });
    texto(s, tt, { x: x + 0.35, y: TOPO + 1.2, w: w - 0.7, h: 0.55, fontSize: 24, bold: true, color: i === 1 ? C.white : C.ink });
    caixa(s, x + 0.38, TOPO + 1.88, 0.6, 0.05, C.red);
    texto(s, tx, { x: x + 0.35, y: TOPO + 2.15, w: w - 0.7, h: 2.4, fontSize: 14, color: i === 1 ? "E1E2E4" : C.muted, lineSpacingMultiple: 1.15 });
  });
  notas(s, "Missão, visão e valores da área ou do projeto.");
}

function organograma(pres, deck, d) {
  const s = slideConteudo(pres, d);
  const no = (x, y, w, h, nome, cargo, cor, escuro) => {
    s.addShape("rect", { x, y, w, h, fill: { color: escuro ? cor : C.white }, line: { color: escuro ? cor : C.line, width: 1 } });
    if (!escuro) caixa(s, x, y, 0.07, h, cor);
    s.addShape("ellipse", { x: x + 0.2, y: y + (h - 0.6) / 2, w: 0.6, h: 0.6, fill: { color: escuro ? "6A6C71" : C.soft2 }, line: SEM_LINHA });
    texto(s, "Foto", { x: x + 0.2, y: y + (h - 0.6) / 2, w: 0.6, h: 0.6, align: "center", valign: "middle", fontSize: 8, color: escuro ? C.light : C.mid });
    texto(s, [{ text: nome, options: { bold: true, fontSize: 12.5, breakLine: true } }, { text: cargo, options: { fontSize: 10, color: escuro ? C.light : C.muted } }], {
      x: x + 0.92,
      y,
      w: w - 1.05,
      h,
      valign: "middle",
      color: escuro ? C.white : C.ink,
    });
  };
  const bw = 2.9;
  const topoX = W / 2 - bw / 2;
  no(topoX, TOPO, bw, 0.9, "Nome do gestor", "Gerência / Coordenação", C.graf, true);
  const ys = TOPO + 1.55;
  const xs = [MX + 0.25, W / 2 - bw / 2, W - MX - 0.25 - bw];
  linha(s, W / 2, TOPO + 0.9, 0, 0.33, C.mid, 1.25);
  linha(s, xs[0] + bw / 2, TOPO + 1.23, xs[2] - xs[0], 0, C.mid, 1.25);
  xs.forEach((x, i) => {
    linha(s, x + bw / 2, TOPO + 1.23, 0, 0.32, C.mid, 1.25);
    no(x, ys, bw, 0.85, `Área / célula ${i + 1}`, "Liderança da área", C.red, false);
    linha(s, x + 0.3, ys + 0.85, 0, 2.15, C.line, 1);
    [0, 1].forEach((k) => {
      const yy = ys + 1.15 + k * 1.0;
      linha(s, x + 0.3, yy + 0.4, 0.3, 0, C.line, 1);
      no(x + 0.6, yy, bw - 0.6, 0.8, "Nome", "Cargo", C.graf, false);
    });
  });
  notas(s, "Estrutura da equipe: duplique as caixas para incluir pessoas. Clique com o botão direito no círculo › Formatar forma › Preenchimento com imagem para inserir a foto.");
}

const TIPOS = {
  sumario,
  divisoria,
  textoImagem,
  imagemDestaque,
  antesDepois,
  kpis,
  grafico,
  tabela,
  cronograma,
  fluxograma,
  planoAcao,
  encerramento,
  decisoes,
  ishikawa,
  cincoPorques,
  especificacao,
  sipoc,
  missaoVisao,
  organograma,
};

// ------------------------------------------------------------------- modelos
const T_PADRAO = (prefixo) => [
  [`${prefixo} — etapa 1`, "Responsável", 0, 2, "feito"],
  [`${prefixo} — etapa 2`, "Responsável", 1, 3, "feito"],
  [`${prefixo} — etapa 3`, "Responsável", 3, 4, "andamento"],
  [`${prefixo} — etapa 4`, "Responsável", 6, 3, "previsto"],
  [`${prefixo} — etapa 5`, "Responsável", 8, 3, "previsto"],
  ["Entrega / aprovação", "Responsável", 10, 1, "marco"],
];

export const MODELOS = [
  {
    id: "01-executivo",
    numero: "01",
    nome: "Executivo",
    titulo: "Apresentação Executiva",
    categoria: "Gestão",
    rodape: "Apresentação Executiva",
    descricao: "Reuniões gerenciais, resultados para a diretoria e tomada de decisão.",
    usos: ["Reuniões de diretoria", "Resultados mensais", "Pontos para decisão"],
    motivo: "executivo",
    slides: [
      ["capa", { kicker: "Apresentação executiva", titulo: "Título da apresentação", subtitulo: "Reunião de resultados  |  Objetivo do encontro" }],
      ["sumario", { titulo: "Pauta", lead: "Assuntos da reunião em ordem de apresentação", itens: [["Contexto", "Cenário atual e objetivo da reunião"], ["Resultados do período", "Indicadores principais versus metas"], ["Destaques", "Entregas e conquistas relevantes"], ["Riscos e atenção", "Desvios, impactos e contenções"], ["Pontos para decisão", "Temas que precisam de deliberação"], ["Próximos passos", "Plano, prazos e responsáveis"]] }],
      ["divisoria", { numero: "01", titulo: "Resultados do período", texto: "Visão consolidada dos principais indicadores e do atingimento das metas." }],
      ["kpis", { titulo: "Resultados em destaque", lead: "Principais indicadores do período comparados às metas", cards: [["Indicador 1", "00,0%", "Meta: 00,0%", "▲ 0,0 p.p. vs. período anterior", 0.82], ["Indicador 2", "000", "Meta: 000", "▼ 0,0% vs. período anterior", 0.6], ["Indicador 3", "R$ 0,0 mi", "Orçado: R$ 0,0 mi", "▲ 0,0% vs. orçado", 0.7], ["Indicador 4", "00 dias", "Meta: 00 dias", "▬ estável", 0.5]] }],
      ["grafico", { titulo: "Evolução mensal versus meta", lead: "Realizado acumulado no ano em comparação com a meta", tipo: "combo", leituras: ["Descreva a tendência do indicador no período.", "Explique os meses fora da meta e suas causas.", "Indique a ação ou decisão necessária."] }],
      ["tabela", { titulo: "Resumo por área", lead: "Situação dos indicadores de cada área no período", colunas: ["Área", "Indicador", "Meta", "Realizado", "Tendência", "Situação"], larguras: [2.4, 3.0, 1.45, 1.45, 1.9, 1.933], alinhar: ["left", "left", "center", "center", "center", "left"], linhas: [["Área 1", "Nome do indicador", "00%", "00%", "▲", "Dentro da meta"], ["Área 2", "Nome do indicador", "00%", "00%", "▼", "Fora da meta"], ["Área 3", "Nome do indicador", "00%", "00%", "▲", "Dentro da meta"], ["Área 4", "Nome do indicador", "00%", "00%", "▬", "Em atenção"], ["Área 5", "Nome do indicador", "00%", "00%", "▲", "Dentro da meta"], ["Área 6", "Nome do indicador", "00%", "00%", "▼", "Fora da meta"]], status: { "Dentro da meta": "2F7D4F", "Fora da meta": C.red, "Em atenção": "B7791F" } }],
      ["textoImagem", { titulo: "Contexto e cenário", lead: "O que mudou no período e por que isso importa", paragrafo: "Apresente em poucas linhas o cenário do negócio, o objetivo desta apresentação e a mensagem principal para a liderança.", topicos: ["Fato relevante 1 com dado objetivo", "Fato relevante 2 com dado objetivo", "Impacto esperado no resultado", "Premissas consideradas"], destaqueTitulo: "Mensagem principal", destaque: "Escreva aqui, em uma frase, a conclusão que a diretoria deve levar." }],
      ["imagemDestaque", { titulo: "Entrega em destaque", lead: "Projeto, conquista ou marco relevante do período", kicker: "Destaque do período", chamada: "Título da entrega ou conquista", texto: "Descreva o que foi feito, quem participou e qual o benefício gerado para a empresa.", numeros: [["00%", "Ganho obtido no indicador principal"], ["R$ 00 mil", "Resultado financeiro estimado"]] }],
      ["antesDepois", { titulo: "Antes e depois", lead: "Comparativo visual da situação anterior e da atual", antes: ["Situação encontrada", "Principal problema ou limitação", "Indicador antes: 00"], depois: ["Solução implementada", "Benefício observado", "Indicador depois: 00"] }],
      ["decisoes", { titulo: "Pontos para decisão", lead: "Temas que precisam de deliberação da liderança", cards: [["Tema para decisão 1", "Contextualize o tema, as alternativas avaliadas e o prazo para decidir.", "Alternativa recomendada e justificativa.", "Alto"], ["Tema para decisão 2", "Contextualize o tema, as alternativas avaliadas e o prazo para decidir.", "Alternativa recomendada e justificativa.", "Médio"], ["Tema para decisão 3", "Contextualize o tema, as alternativas avaliadas e o prazo para decidir.", "Alternativa recomendada e justificativa.", "Médio"]] }],
      ["fluxograma", { titulo: "Fluxo de aprovação", lead: "Caminho da proposta até a implantação", etapas: [["Início", ""], ["Proposta", "Elaboração e análise"], ["Aprovado?", "Comitê / diretoria"], ["Implantação", "Execução e acompanhamento"], ["Concluído", ""]], desvio: ["Revisão", "Ajustes solicitados"] }],
      ["cronograma", { titulo: "Próximos passos", lead: "Cronograma das entregas previstas", tarefas: T_PADRAO("Entrega"), hoje: 5.5 }],
      ["planoAcao", {}],
      ["encerramento", {}],
    ],
  },
  {
    id: "02-indicadores",
    numero: "02",
    nome: "Indicadores e Resultados",
    titulo: "Indicadores e Resultados",
    categoria: "Indicadores",
    rodape: "Indicadores e Resultados",
    descricao: "KPIs, gráficos, tabelas, comparativos, metas e evolução mensal.",
    usos: ["Reunião de resultados", "Painel de KPIs", "Análise de tendência"],
    motivo: "indicadores",
    slides: [
      ["capa", { kicker: "Indicadores e resultados", titulo: "Resultados do período", subtitulo: "Mês / ano  |  Área responsável" }],
      ["sumario", { titulo: "Sumário", lead: "Estrutura da apresentação de resultados", itens: [["Visão geral", "Painel com os indicadores principais"], ["Evolução mensal", "Tendência versus meta"], ["Estratificação", "Pareto e distribuição"], ["Comparativos", "Períodos, áreas ou produtos"], ["Análise", "Causas dos desvios"], ["Plano de ação", "Ações para recuperar a meta"]] }],
      ["kpis", { titulo: "Painel de indicadores", lead: "Resultado do mês em relação às metas", cards: [["Eficiência", "00,0%", "Meta: 00%", "▲ 0,0 p.p. vs. mês anterior", 0.86], ["Índice de falhas", "0,00%", "Meta: ≤ 0,00%", "▼ 0,0 p.p. vs. mês anterior", 0.55], ["PPM", "0.000", "Meta: ≤ 0.000", "▲ 000 vs. mês anterior", 0.7], ["Atendimento", "00,0%", "Meta: 00%", "▬ estável", 0.9]] }],
      ["divisoria", { numero: "01", titulo: "Evolução dos indicadores", texto: "Tendência mensal, estratificação e comparação com as metas." }],
      ["grafico", { titulo: "Evolução mensal", lead: "Realizado mês a mês em relação à meta", tipo: "combo" }],
      ["grafico", { titulo: "Tendência de indicadores", lead: "Comparação de dois indicadores ao longo do ano", tipo: "linhas", series: ["Indicador A", "Indicador B"], painelTitulo: "Análise da tendência" }],
      ["grafico", { titulo: "Estratificação (Pareto)", lead: "Concentração das ocorrências por categoria", tipo: "pareto", painelTitulo: "Leitura do Pareto", leituras: ["As primeiras categorias concentram a maior parte das ocorrências.", "Priorize as ações nas causas de maior impacto.", "Acompanhe a redução das três principais causas."] }],
      ["tabela", { titulo: "Quadro de indicadores", lead: "Resultado mensal por indicador", colunas: ["Indicador", "Unidade", "Meta", "Jan", "Fev", "Mar", "Abr", "Acum."], larguras: [3.0, 1.2, 1.2, 1.3, 1.3, 1.3, 1.3, 1.533], alinhar: ["left", "center", "center", "center", "center", "center", "center", "center"], linhas: [["Indicador 1", "%", "00", "00", "00", "00", "00", "00"], ["Indicador 2", "PPM", "000", "000", "000", "000", "000", "000"], ["Indicador 3", "un.", "00", "00", "00", "00", "00", "00"], ["Indicador 4", "%", "00", "00", "00", "00", "00", "00"], ["Indicador 5", "dias", "00", "00", "00", "00", "00", "00"], ["Indicador 6", "R$", "0,0", "0,0", "0,0", "0,0", "0,0", "0,0"]] }],
      ["antesDepois", { titulo: "Comparativo entre períodos", lead: "Resultado do período anterior versus o atual", rotuloAntes: "PERÍODO 1", rotuloDepois: "PERÍODO 2", antes: ["Resultado do indicador: 00", "Principal causa de perda", "Contexto do período"], depois: ["Resultado do indicador: 00", "Variação: 0,0%", "O que explica a melhoria"] }],
      ["textoImagem", { titulo: "Análise dos desvios", lead: "Por que o indicador ficou fora da meta", paragrafo: "Explique de forma objetiva o desvio observado, quando começou e qual o impacto no resultado.", topicos: ["Causa 1 identificada com evidência", "Causa 2 identificada com evidência", "Contenção aplicada", "Resultado esperado após as ações"], destaqueTitulo: "Conclusão", destaque: "Resuma a análise em uma frase para a reunião." }],
      ["fluxograma", { titulo: "Fluxo de apuração", lead: "Da coleta dos dados à divulgação do indicador", etapas: [["Coleta", ""], ["Consolidação", "Base de dados mensal"], ["Dentro da meta?", "Comparação com a meta"], ["Divulgação", "Painel e reunião"], ["Fim", ""]], desvio: ["Análise de causa", "Plano de ação"], infos: [["Fonte dos dados", "Sistema, planilha ou relatório de origem."], ["Frequência", "Diária, semanal ou mensal."], ["Responsável", "Quem apura e quem valida o indicador."]] }],
      ["cronograma", { titulo: "Cronograma de recuperação", lead: "Ações para trazer os indicadores de volta à meta", tarefas: T_PADRAO("Ação"), hoje: 4.5 }],
      ["planoAcao", { lead: "Ações para os indicadores fora da meta" }],
      ["encerramento", {}],
    ],
  },
  {
    id: "03-engenharia",
    numero: "03",
    nome: "Engenharia e Projetos",
    titulo: "Engenharia e Projetos",
    categoria: "Engenharia",
    rodape: "Engenharia e Projetos",
    descricao: "Desenvolvimento de projetos, melhorias, validações, cronogramas e apresentações técnicas.",
    usos: ["Gate de projeto", "Validação de produto", "Apresentação técnica"],
    motivo: "engenharia",
    slides: [
      ["capa", { kicker: "Engenharia e projetos", titulo: "Nome do projeto", subtitulo: "Apresentação técnica  |  Fase do projeto" }],
      ["sumario", { titulo: "Sumário", lead: "Estrutura da apresentação técnica", itens: [["Escopo", "Objetivo, premissas e requisitos"], ["Solução técnica", "Conceito, desenho e especificação"], ["Validação", "Ensaios e resultados"], ["Cronograma", "Fases e marcos do projeto"], ["Riscos", "Pontos de atenção técnicos"], ["Próximos passos", "Plano de ação e aprovações"]] }],
      ["divisoria", { numero: "01", titulo: "Escopo do projeto", texto: "Objetivo, requisitos do cliente e premissas técnicas." }],
      ["textoImagem", { titulo: "Escopo e objetivo", lead: "O que será desenvolvido e por quê", paragrafo: "Descreva o objetivo do projeto, o problema a resolver e o cliente ou aplicação atendida.", topicos: ["Requisito técnico 1", "Requisito técnico 2", "Normas e especificações aplicáveis", "Premissas e restrições"], destaqueTitulo: "Critério de sucesso", destaque: "Como saberemos que o projeto atingiu o objetivo." }],
      ["especificacao", { titulo: "Especificação técnica", lead: "Desenho e características principais do item", linhas: [["Diâmetro externo", "000,0 mm", "± 0,0", "Paquímetro"], ["Espessura", "00,0 mm", "± 0,0", "Micrômetro"], ["Dureza", "000 HB", "± 00", "Durômetro"], ["Coef. de atrito", "0,00 µ", "± 0,00", "Dinamômetro"], ["Massa", "0,00 kg", "± 0,00", "Balança"]] }],
      ["imagemDestaque", { titulo: "Protótipo / solução proposta", lead: "Imagem do protótipo, do modelo 3D ou do item instalado", kicker: "Solução técnica", chamada: "Conceito da solução proposta", texto: "Explique como a solução atende aos requisitos e quais são os diferenciais em relação à condição atual.", numeros: [["00%", "Melhoria esperada no desempenho"], ["00 h", "Horas de ensaio previstas"]] }],
      ["antesDepois", { titulo: "Melhoria implementada", lead: "Comparação entre a condição original e a proposta", rotuloAntes: "ORIGINAL", rotuloDepois: "PROPOSTA", antes: ["Condição original do produto ou processo", "Limitação técnica encontrada", "Resultado de referência: 00"], depois: ["Alteração realizada", "Ganho técnico obtido", "Resultado validado: 00"] }],
      ["kpis", { titulo: "Status do projeto", lead: "Situação de prazo, custo, escopo e qualidade", destaque: 0, cards: [["Avanço físico", "00%", "Planejado: 00%", "▲ No prazo", 0.62], ["Prazo", "00 dias", "Para o próximo marco", "▬ Em dia", 0.5], ["Custo", "R$ 0,0 mil", "Orçado: R$ 0,0 mil", "▼ 0% abaixo do orçado", 0.74], ["Ensaios", "0 / 0", "Ensaios aprovados", "▲ 0 concluídos no mês", 0.4]], blocos: [["Avanços do período", ["Entrega técnica concluída no período.", "Resultado de ensaio relevante.", "Aprovação obtida com o cliente."]], ["Riscos técnicos", ["Risco técnico e probabilidade de ocorrência.", "Dependência de fornecedor ou ferramental.", "Ação de mitigação prevista."]]] }],
      ["grafico", { titulo: "Resultados de validação", lead: "Desempenho da proposta em relação à referência", tipo: "barrasH", categorias: ["Ensaio A", "Ensaio B", "Ensaio C", "Ensaio D", "Ensaio E", "Ensaio F"], painelTitulo: "Conclusões dos ensaios", leituras: ["A proposta atende ao requisito em todos os ensaios?", "Qual ensaio apresentou maior ganho?", "Há algum ensaio pendente ou com restrição?"] }],
      ["tabela", { titulo: "Plano de validação", lead: "Ensaios, normas e critérios de aceitação", colunas: ["Ensaio", "Norma / método", "Critério de aceitação", "Amostras", "Responsável", "Situação"], larguras: [2.4, 2.1, 2.7, 1.2, 1.8, 1.933], alinhar: ["left", "left", "left", "center", "left", "left"], linhas: [["Ensaio 1", "Norma / procedimento", "Critério mínimo", "0", "Laboratório", "Aprovado"], ["Ensaio 2", "Norma / procedimento", "Critério mínimo", "0", "Laboratório", "Aprovado"], ["Ensaio 3", "Norma / procedimento", "Critério mínimo", "0", "Laboratório", "Em execução"], ["Ensaio 4", "Norma / procedimento", "Critério mínimo", "0", "Laboratório", "Em execução"], ["Ensaio 5", "Norma / procedimento", "Critério mínimo", "0", "Laboratório", "Pendente"], ["Ensaio 6", "Norma / procedimento", "Critério mínimo", "0", "Laboratório", "Pendente"]], status: { Aprovado: "2F7D4F", "Em execução": "B7791F", Pendente: C.muted } }],
      ["cronograma", { titulo: "Cronograma do projeto", lead: "Fases, entregas e marcos de aprovação", tarefas: [["Conceito e viabilidade", "Engenharia de produto", 0, 2, "feito"], ["Projeto detalhado", "Engenharia de produto", 2, 2, "feito"], ["Protótipos", "Engenharia / fornecedor", 3, 3, "andamento"], ["Validação e ensaios", "Laboratório", 5, 3, "previsto"], ["Lote piloto", "Processos / qualidade", 8, 2, "previsto"], ["Aprovação (PPAP)", "Qualidade", 10, 1, "marco"]], hoje: 4.6 }],
      ["fluxograma", { titulo: "Fluxo de desenvolvimento", lead: "Etapas e gates de aprovação do projeto", etapas: [["Ideia", ""], ["Projeto", "Desenho e especificação"], ["Validado?", "Ensaios e análise"], ["Industrialização", "Processo e ferramental"], ["Lançamento", ""]], desvio: ["Reprojeto", "Ajustes técnicos"], infos: [["Entradas", "Requisitos do cliente, normas e especificações."], ["Saídas", "Desenho aprovado, plano de controle e PPAP."], ["Gate", "Critérios para avançar para a próxima fase."]] }],
      ["planoAcao", { lead: "Ações técnicas, responsáveis e prazos" }],
      ["encerramento", {}],
    ],
  },
  {
    id: "04-qualidade",
    numero: "04",
    nome: "Gestão da Qualidade",
    titulo: "Gestão da Qualidade",
    categoria: "Qualidade",
    rodape: "Gestão da Qualidade",
    descricao: "Auditorias, não conformidades, análise de falhas, causa raiz, planos de ação e indicadores da qualidade.",
    usos: ["Análise de não conformidade", "Auditorias", "8D / causa raiz"],
    motivo: "qualidade",
    slides: [
      ["capa", { kicker: "Gestão da qualidade", titulo: "Análise de não conformidade", subtitulo: "Tratativa, causa raiz e plano de ação  |  Nº do registro" }],
      ["sumario", { titulo: "Sumário", lead: "Etapas da análise", itens: [["Descrição do problema", "O que, onde, quando e quanto"], ["Contenção", "Ações imediatas de proteção ao cliente"], ["Análise de causa", "Ishikawa e 5 Porquês"], ["Plano de ação", "Ações corretivas e preventivas"], ["Verificação", "Eficácia das ações"], ["Padronização", "Lições aprendidas e documentos"]] }],
      ["kpis", { titulo: "Indicadores da qualidade", lead: "Desempenho do período em relação às metas", cards: [["PPM", "0.000", "Meta: ≤ 0.000", "▼ 000 vs. mês anterior", 0.7], ["Índice de NC", "0,00%", "Meta: ≤ 0,00%", "▼ 0,0 p.p. vs. mês anterior", 0.55], ["Reclamações", "00", "Meta: ≤ 00", "▬ estável", 0.45], ["Ações no prazo", "00%", "Meta: 00%", "▲ 0 p.p. vs. mês anterior", 0.85]] }],
      ["divisoria", { numero: "01", titulo: "Descrição do problema", texto: "Fatos e dados da não conformidade e ações de contenção." }],
      ["textoImagem", { titulo: "Descrição da não conformidade", lead: "O que, onde, quando, quanto e como foi detectado", paragrafo: "Descreva o problema com fatos e dados: item, lote, quantidade afetada, cliente e forma de detecção.", topicos: ["Item / código e descrição", "Quantidade inspecionada e reprovada", "Data e local da detecção", "Requisito não atendido"], destaqueTitulo: "Contenção imediata", destaque: "Ações tomadas para proteger o cliente (segregação, retrabalho, inspeção 100%)." }],
      ["imagemDestaque", { titulo: "Evidência da falha", lead: "Registro fotográfico do defeito", kicker: "Evidência", chamada: "Descrição do defeito encontrado", texto: "Indique a característica afetada, a localização do defeito na peça e a referência à especificação.", numeros: [["000 pç", "Quantidade afetada"], ["0,00%", "Percentual do lote"]] }],
      ["grafico", { titulo: "Pareto dos defeitos", lead: "Principais modos de falha no período", tipo: "pareto", categorias: ["Defeito A", "Defeito B", "Defeito C", "Defeito D", "Defeito E", "Defeito F", "Outros"], painelTitulo: "Leitura do Pareto", leituras: ["Os principais defeitos concentram a maior parte das ocorrências.", "Priorize a análise de causa nos defeitos de maior frequência.", "Acompanhe a redução após o plano de ação."] }],
      ["ishikawa", { titulo: "Análise de causa (Ishikawa)", lead: "Causas prováveis organizadas pelos 6M", efeito: "Descreva o efeito / problema" }],
      ["cincoPorques", { titulo: "5 Porquês", lead: "Aprofundamento até a causa raiz", problema: "Descreva o problema em uma frase objetiva" }],
      ["antesDepois", { titulo: "Contenção e correção", lead: "Condição encontrada e condição após a ação", rotuloAntes: "NÃO CONFORME", rotuloDepois: "CONFORME", antes: ["Condição não conforme encontrada", "Característica fora da especificação", "Medição: 00,0 (especificado 00,0)"], depois: ["Condição após a correção", "Característica dentro da especificação", "Medição: 00,0 (especificado 00,0)"] }],
      ["tabela", { titulo: "Checklist de auditoria", lead: "Requisitos verificados e resultado", colunas: ["Requisito", "Evidência verificada", "Conforme", "Não conforme", "Observação"], larguras: [2.9, 3.6, 1.3, 1.5, 2.833], alinhar: ["left", "left", "center", "center", "left"], linhas: [["Requisito 1", "Documento / registro verificado", "●", "", "Sem desvios"], ["Requisito 2", "Documento / registro verificado", "", "●", "Descrever a não conformidade"], ["Requisito 3", "Documento / registro verificado", "●", "", "Sem desvios"], ["Requisito 4", "Documento / registro verificado", "●", "", "Oportunidade de melhoria"], ["Requisito 5", "Documento / registro verificado", "", "●", "Descrever a não conformidade"], ["Requisito 6", "Documento / registro verificado", "●", "", "Sem desvios"]] }],
      ["fluxograma", { titulo: "Fluxo de tratamento de NC", lead: "Da detecção ao encerramento da não conformidade", etapas: [["Detecção", ""], ["Registro e contenção", "Abertura da RNC"], ["Causa definida?", "Ishikawa / 5 Porquês"], ["Ação corretiva", "Implementação e verificação"], ["Encerramento", ""]], desvio: ["Nova análise", "Aprofundar investigação"], infos: [["Entradas", "Registro da não conformidade e evidências."], ["Saídas", "RNC encerrada, documentos atualizados."], ["Indicador", "Prazo médio de encerramento e reincidência."]] }],
      ["planoAcao", { lead: "Ações corretivas e preventivas (5W2H)", linhas: [["Ação de contenção", "Proteger o cliente", "Responsável", "dd/mm/aaaa", "Segregação e inspeção", "Concluída"], ["Ação corretiva da causa 1", "Eliminar a causa raiz", "Responsável", "dd/mm/aaaa", "Local e método", "Em andamento"], ["Ação corretiva da causa 2", "Eliminar a causa raiz", "Responsável", "dd/mm/aaaa", "Local e método", "Em andamento"], ["Ação preventiva", "Evitar recorrência", "Responsável", "dd/mm/aaaa", "Local e método", "Não iniciada"], ["Atualizar FMEA / plano de controle", "Padronizar", "Responsável", "dd/mm/aaaa", "Revisão de documentos", "Não iniciada"], ["Verificar eficácia", "Confirmar resultado", "Responsável", "dd/mm/aaaa", "Acompanhamento de 3 lotes", "Atrasada"]] }],
      ["cronograma", { titulo: "Cronograma das ações", lead: "Prazos das ações e verificação de eficácia", periodos: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10"], tarefas: [["Contenção", "Qualidade", 0, 1, "feito"], ["Análise de causa", "Equipe multifuncional", 1, 2, "feito"], ["Ações corretivas", "Responsáveis", 2, 4, "andamento"], ["Padronização", "Engenharia / processos", 5, 2, "previsto"], ["Verificação de eficácia", "Qualidade", 7, 3, "previsto"], ["Encerramento", "Qualidade", 9, 1, "marco"]], hoje: 3.6 }],
      ["encerramento", {}],
    ],
  },
  {
    id: "05-processos",
    numero: "05",
    nome: "Processos Industriais",
    titulo: "Processos Industriais",
    categoria: "Processos",
    rodape: "Processos Industriais",
    descricao: "Fluxogramas, procedimentos, etapas operacionais, produtividade e melhorias de processos.",
    usos: ["Mapeamento de processo", "Kaizen / melhoria", "Procedimento operacional"],
    motivo: "processos",
    slides: [
      ["capa", { kicker: "Processos industriais", titulo: "Nome do processo ou projeto de melhoria", subtitulo: "Linha / setor  |  Objetivo da apresentação" }],
      ["sumario", { titulo: "Sumário", lead: "Estrutura da apresentação", itens: [["Visão do processo", "SIPOC e fluxo atual"], ["Etapas operacionais", "Procedimento e pontos de controle"], ["Indicadores", "Produtividade e eficiência"], ["Melhorias", "Antes e depois"], ["Implantação", "Cronograma e responsáveis"], ["Padronização", "Plano de ação e treinamentos"]] }],
      ["divisoria", { numero: "01", titulo: "Visão do processo", texto: "Mapeamento do processo de ponta a ponta: fornecedores, etapas e clientes." }],
      ["sipoc", { titulo: "SIPOC do processo", lead: "Fornecedores, entradas, processo, saídas e clientes" }],
      ["fluxograma", { titulo: "Fluxograma do processo", lead: "Sequência das etapas e pontos de decisão", etapas: [["Início", ""], ["Preparação", "Setup e materiais"], ["Peça OK?", "Inspeção de processo"], ["Produção", "Operação e embalagem"], ["Expedição", ""]], desvio: ["Ajuste / retrabalho", "Correção do processo"], infos: [["Entradas", "Matéria-prima, ordem de produção e instruções."], ["Saídas", "Peças conformes, registros de produção."], ["Indicador", "Produtividade, OEE ou refugo."]] }],
      ["textoImagem", { titulo: "Etapa operacional", lead: "Descrição do posto de trabalho e da operação", paragrafo: "Descreva a operação realizada neste posto, os equipamentos utilizados e o resultado esperado.", topicos: ["Equipamentos e ferramentas", "Parâmetros de processo", "Pontos de controle da qualidade", "EPIs e cuidados de segurança"], destaqueTitulo: "Ponto crítico", destaque: "Característica ou parâmetro que exige atenção especial do operador." }],
      ["tabela", { titulo: "Procedimento passo a passo", lead: "Sequência de execução da operação", colunas: ["Passo", "Atividade", "Ponto-chave", "Responsável", "Registro"], larguras: [0.9, 3.8, 3.4, 1.9, 2.133], alinhar: ["center", "left", "left", "left", "left"], linhas: [["1", "Descreva a atividade", "Cuidado ou parâmetro", "Operador", "Formulário"], ["2", "Descreva a atividade", "Cuidado ou parâmetro", "Operador", "Formulário"], ["3", "Descreva a atividade", "Cuidado ou parâmetro", "Operador", "Formulário"], ["4", "Descreva a atividade", "Cuidado ou parâmetro", "Inspetor", "Formulário"], ["5", "Descreva a atividade", "Cuidado ou parâmetro", "Operador", "Formulário"], ["6", "Descreva a atividade", "Cuidado ou parâmetro", "Líder", "Formulário"]] }],
      ["kpis", { titulo: "Produtividade do processo", lead: "Indicadores de desempenho da linha ou célula", cards: [["OEE", "00,0%", "Meta: 00%", "▲ 0,0 p.p. vs. mês anterior", 0.78], ["Produtividade", "000 pç/h", "Meta: 000 pç/h", "▲ 0,0% vs. mês anterior", 0.82], ["Refugo", "0,0%", "Meta: ≤ 0,0%", "▼ 0,0 p.p. vs. mês anterior", 0.4], ["Setup", "00 min", "Meta: ≤ 00 min", "▬ estável", 0.6]], blocos: [["Ganhos obtidos", ["Melhoria implantada e ganho medido.", "Redução de perdas no processo.", "Estabilidade do indicador nas últimas semanas."]], ["Perdas principais", ["Principal causa de parada.", "Principal causa de refugo.", "Ação em andamento para cada perda."]]] }],
      ["grafico", { titulo: "Evolução da produtividade", lead: "Resultado mensal versus meta", tipo: "combo", painelTitulo: "Leitura do gráfico" }],
      ["antesDepois", { titulo: "Melhoria de processo", lead: "Layout, método ou posto de trabalho antes e depois", antes: ["Como o processo era executado", "Desperdícios observados", "Tempo de ciclo: 00 s"], depois: ["Como o processo passou a ser executado", "Desperdícios eliminados", "Tempo de ciclo: 00 s"] }],
      ["imagemDestaque", { titulo: "Posto de trabalho padronizado", lead: "Imagem do posto, dispositivo ou layout final", kicker: "Padrão operacional", chamada: "Posto ou dispositivo implantado", texto: "Explique a padronização adotada: gestão visual, dispositivos poka-yoke e organização (5S).", numeros: [["00%", "Redução do tempo de ciclo"], ["00 pç", "Aumento da produção por turno"]] }],
      ["cronograma", { titulo: "Cronograma de implantação", lead: "Etapas para implantar a melhoria", periodos: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12"], tarefas: [["Diagnóstico do processo", "Processos", 0, 2, "feito"], ["Definição da solução", "Equipe kaizen", 2, 2, "feito"], ["Implantação piloto", "Produção", 4, 3, "andamento"], ["Treinamento", "Líderes", 6, 2, "previsto"], ["Padronização", "Processos / qualidade", 8, 3, "previsto"], ["Validação final", "Gestão", 11, 1, "marco"]], hoje: 5.4 }],
      ["planoAcao", { lead: "Ações de implantação e padronização" }],
      ["encerramento", {}],
    ],
  },
  {
    id: "06-institucional",
    numero: "06",
    nome: "Apresentação Institucional",
    titulo: "Apresentação Institucional",
    categoria: "Institucional",
    rodape: "Apresentação Institucional",
    descricao: "Apresentação de setores, equipes, estruturas, atividades, resultados e projetos da empresa.",
    usos: ["Apresentação de setor", "Integração de novos colaboradores", "Visitas e clientes"],
    motivo: "institucional",
    slides: [
      ["capa", { kicker: "Apresentação institucional", titulo: "Nome do setor ou da equipe", subtitulo: "Quem somos, o que fazemos e nossos resultados" }],
      ["sumario", { titulo: "Sumário", lead: "O que você vai conhecer nesta apresentação", itens: [["Quem somos", "Missão, visão e valores"], ["Estrutura", "Organograma e equipe"], ["Atividades", "O que a área entrega"], ["Como trabalhamos", "Fluxo de atendimento"], ["Resultados", "Indicadores e conquistas"], ["Projetos", "Iniciativas em andamento"]] }],
      ["divisoria", { numero: "01", titulo: "Quem somos", texto: "Propósito, estrutura e equipe do setor." }],
      ["missaoVisao", { titulo: "Missão, visão e valores", lead: "O propósito que orienta o trabalho da área" }],
      ["textoImagem", { titulo: "Sobre o setor", lead: "Apresentação geral da área", paragrafo: "Conte em poucas linhas o papel do setor na empresa, onde atua e a quem atende.", topicos: ["Principais responsabilidades", "Clientes internos e externos", "Sistemas e ferramentas utilizados", "Certificações e normas atendidas"], destaqueTitulo: "Em números", destaque: "00 colaboradores  |  00 turnos  |  00 processos atendidos" }],
      ["organograma", { titulo: "Estrutura e equipe", lead: "Organização da área e responsabilidades" }],
      ["tabela", { titulo: "Atividades da área", lead: "Principais entregas, frequência e clientes atendidos", colunas: ["Atividade", "Descrição", "Frequência", "Cliente", "Responsável"], larguras: [2.6, 4.2, 1.6, 1.8, 1.933], linhas: [["Atividade 1", "Descreva a entrega realizada", "Diária", "Cliente interno", "Equipe"], ["Atividade 2", "Descreva a entrega realizada", "Semanal", "Cliente interno", "Equipe"], ["Atividade 3", "Descreva a entrega realizada", "Mensal", "Cliente externo", "Equipe"], ["Atividade 4", "Descreva a entrega realizada", "Sob demanda", "Cliente interno", "Equipe"], ["Atividade 5", "Descreva a entrega realizada", "Mensal", "Diretoria", "Equipe"], ["Atividade 6", "Descreva a entrega realizada", "Anual", "Auditoria", "Equipe"]] }],
      ["fluxograma", { titulo: "Como trabalhamos", lead: "Fluxo de atendimento das demandas", etapas: [["Solicitação", ""], ["Análise", "Entendimento da demanda"], ["Viável?", "Prazo e recursos"], ["Execução", "Entrega e acompanhamento"], ["Entrega", ""]], desvio: ["Alinhamento", "Ajuste com o solicitante"], infos: [["Como solicitar", "Canal de entrada das demandas da área."], ["Prazo de resposta", "Tempo médio para retorno ao solicitante."], ["Indicador", "Satisfação ou prazo de atendimento."]] }],
      ["kpis", { titulo: "Nossos resultados", lead: "Indicadores que mostram a contribuição da área", cards: [["Indicador 1", "00%", "Meta: 00%", "▲ evolução no ano", 0.8], ["Indicador 2", "000", "Entregas no ano", "▲ 00 vs. ano anterior", 0.7], ["Indicador 3", "00", "Projetos concluídos", "▲ 0 vs. ano anterior", 0.6], ["Indicador 4", "0,0", "Satisfação dos clientes", "▬ estável", 0.85]], blocos: [["Conquistas", ["Reconhecimento, certificação ou prêmio recebido.", "Projeto concluído com ganho relevante.", "Melhoria percebida pelos clientes."]], ["Desafios", ["Principal desafio para o próximo ano.", "Recurso ou capacidade necessária.", "Iniciativa planejada."]]] }],
      ["grafico", { titulo: "Distribuição das atividades", lead: "Como o esforço da equipe se divide", tipo: "rosca", categorias: ["Atividade A", "Atividade B", "Atividade C", "Atividade D"], painelTitulo: "Leitura do gráfico", leituras: ["Qual atividade concentra mais esforço?", "Há espaço para automatizar ou simplificar?", "Como a distribuição deve evoluir?"] }],
      ["imagemDestaque", { titulo: "Projeto em destaque", lead: "Iniciativa relevante conduzida pela área", kicker: "Projeto", chamada: "Nome do projeto", texto: "Descreva o objetivo do projeto, as áreas envolvidas e o resultado alcançado ou esperado.", numeros: [["00%", "Ganho no indicador principal"], ["00", "Pessoas envolvidas"]] }],
      ["antesDepois", { titulo: "Nossa evolução", lead: "Como a área evoluiu ao longo do tempo", rotuloAntes: "ONTEM", rotuloDepois: "HOJE", antes: ["Como a área funcionava", "Principais limitações", "Estrutura e recursos disponíveis"], depois: ["Como a área funciona hoje", "Melhorias implantadas", "Estrutura e recursos atuais"] }],
      ["cronograma", { titulo: "Projetos e próximos passos", lead: "Iniciativas planejadas para o ano", tarefas: T_PADRAO("Projeto"), hoje: 6.5 }],
      ["planoAcao", { titulo: "Plano de ação da área", lead: "Iniciativas, responsáveis e prazos" }],
      ["encerramento", {}],
    ],
  },
];


// ------------------------------------------------- slides com dados do sistema
// Recebem os mesmos SlideSpec do "Criar apresentação" (src/lib/slide-spec.ts) e
// desenham no visual do modelo: gráficos nativos, tabelas nativas e textos editáveis.

const PALETA = [C.graf, C.red, "8A8C91", "B5B7BC", C.ink, "F28B8F", "6B6D72", "D3D5D8"];
const TOM = { red: C.red, green: "2F7D4F", amber: "B7791F", blue: C.graf, purple: C.graf, neutral: C.graf };
/** Converte a cor usada na tela para a paleta Fras-le, mantendo o sentido (status). */
function semCerquilha(c, i = 0) {
  const h = String(c ?? "").replace(/^#/, "").toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(h)) return "";
  const [r, g, b] = [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  if (sat < 0.2) return h; // cinzas e preto ficam como estão
  let hue = 0;
  if (max === r) hue = ((g - b) / (max - min)) * 60;
  else if (max === g) hue = (2 + (b - r) / (max - min)) * 60;
  else hue = (4 + (r - g) / (max - min)) * 60;
  if (hue < 0) hue += 360;
  if (hue < 15 || hue >= 330) return C.red;
  if (hue < 65) return "B7791F"; // âmbar / atenção
  if (hue < 170) return "2F7D4F"; // verde / ok
  return ["54565B", "8A8C91", "B5B7BC", "2E3034"][i % 4]; // azuis/roxos → grafites
}

/** Cores de todas as séries: as que vêm da tela são convertidas; as demais pegam
 *  a próxima cor da paleta que ainda não foi usada (evita duas séries iguais). */
function coresDasSeries(chart) {
  const usadas = new Set();
  const cores = chart.series.map((se, i) => {
    const c = se.color ? semCerquilha(se.color, i) : "";
    if (c) usadas.add(c);
    return c;
  });
  return cores.map((c) => {
    if (c) return c;
    const livre = PALETA.find((p) => !usadas.has(p)) ?? PALETA[usadas.size % PALETA.length];
    usadas.add(livre);
    return livre;
  });
}

function rodapeFonte(s, fonte) {
  if (!fonte) return;
  texto(s, fonte, { x: MX, y: BASE - 0.02, w: 9, h: 0.22, fontSize: 8.5, italic: true, color: C.mid });
}

function kpisDados(pres, deck, d) {
  const s = slideConteudo(pres, d);
  const itens = d.spec.items.slice(0, 8);
  const linhas = itens.length > 4 ? 2 : 1;
  const porLinha = Math.ceil(itens.length / linhas);
  const gap = 0.18;
  const w = (CW - gap * (porLinha - 1)) / porLinha;
  const h = linhas === 1 ? 2.35 : 2.05;
  itens.forEach((k, i) => {
    const x = MX + (i % porLinha) * (w + gap);
    const y = TOPO + Math.floor(i / porLinha) * (h + gap);
    const cor = TOM[k.tone] ?? C.graf;
    caixa(s, x, y, w, h, C.soft);
    caixa(s, x, y, w, 0.06, cor);
    rotuloCaps(s, k.label, x + 0.25, y + 0.28, w - 0.5, C.muted, 10);
    const longo = String(k.value).length > 9;
    texto(s, String(k.value), {
      x: x + 0.25,
      y: y + 0.62,
      w: w - 0.5,
      h: 0.8,
      fontSize: longo ? 24 : porLinha > 3 ? 30 : 34,
      bold: true,
      color: k.tone === "red" ? C.red : C.ink,
    });
    if (k.hint) texto(s, k.hint, { x: x + 0.25, y: y + 1.45, w: w - 0.5, h: h - 1.6, fontSize: 11, color: C.muted });
  });
  if (linhas === 1) {
    const y2 = TOPO + h + 0.35;
    caixa(s, MX, y2, 0.06, BASE - y2 - 0.3, C.red);
    texto(s, "Análise", { x: MX + 0.25, y: y2, w: 6, h: 0.36, fontSize: 14, bold: true });
    texto(s, "Escreva aqui a leitura destes indicadores: o que melhorou, o que piorou e qual a próxima ação.", {
      x: MX + 0.25,
      y: y2 + 0.45,
      w: CW - 0.3,
      h: 1.2,
      fontSize: 12.5,
      color: C.muted,
    });
  }
  rodapeFonte(s, d.fonte);
  notas(s, `Dados do QualiHub. ${d.fonte ?? ""}`);
}

function graficoSpec(pres, s, chart, box) {
  const n = chart.categories.length;
  const base = {
    ...box,
    ...EIXOS,
    showLegend: chart.series.length > 1 || !!chart.target || chart.kind === "doughnut" || chart.kind === "pie",
    valAxisLabelFormatCode: excelFormat(chart.format),
    dataLabelFormatCode: excelFormat(chart.format),
    dataLabelColor: C.ink,
    dataLabelFontSize: 9,
    dataLabelFontFace: F,
    showValue: chart.showValues ?? (n <= 12 && (chart.series.length === 1 || !["line", "area"].includes(chart.kind))),
    catAxisLabelRotate:
      n > 6 && Math.max(0, ...chart.categories.map((c) => String(c).length)) > 8 && chart.kind !== "barH" ? -30 : 0,
  };
  const cores = coresDasSeries(chart);
  const paraDados = (lista) =>
    lista.map((se) => ({ name: se.name, labels: chart.categories, values: se.values.map((v) => Number(v) || 0) }));
  const dados = paraDados(chart.series);

  if (chart.kind === "doughnut" || chart.kind === "pie") {
    s.addChart(chart.kind === "pie" ? pres.ChartType.pie : pres.ChartType.doughnut, dados.slice(0, 1), {
      ...base,
      chartColors: chart.categories.map((_, i) => semCerquilha(chart.pointColors?.[i], i) || PALETA[i % PALETA.length]),
      holeSize: 60,
      showPercent: true,
      showValue: false,
      showLegend: true,
      dataLabelColor: C.white,
      dataLabelFontSize: 11,
      dataLabelFormatCode: "0.0%",
      legendPos: "r",
      legendFontSize: 11,
      legendColor: C.ink,
    });
    return;
  }

  if (chart.kind === "combo") {
    const barras = chart.series.map((se, i) => ({ se, i })).filter(({ se }) => se.type !== "line");
    const linhas = chart.series.map((se, i) => ({ se, i })).filter(({ se }) => se.type === "line");
    const sec = linhas.some(({ se }) => se.secondary);
    const rotulos = (fmt) => ({
      showValue: base.showValue && barras.length <= 1,
      dataLabelFormatCode: excelFormat(fmt),
      dataLabelColor: C.ink,
      dataLabelFontSize: 9,
    });
    s.addChart(
      [
        ...(barras.length
          ? [
              {
                type: pres.ChartType.bar,
                data: paraDados(barras.map(({ se }) => se)),
                options: {
                  chartColors: barras.map(({ se }, k) => (se.color ? semCerquilha(se.color, k) || C.graf : [C.graf, "9A9CA1", "C9CBCF", C.ink][k % 4])),
                  barGapWidthPct: 55,
                  dataLabelPosition: "outEnd",
                  ...rotulos(chart.format),
                },
              },
            ]
          : []),
        ...(linhas.length
          ? [
              {
                type: pres.ChartType.line,
                data: paraDados(linhas.map(({ se }) => se)),
                options: {
                  chartColors: linhas.map(({ se }, k) => (se.color ? semCerquilha(se.color, k) || C.red : [C.red, C.ink, "F28B8F"][k % 3])),
                  lineSize: 2.5,
                  lineDataSymbolSize: 7,
                  secondaryValAxis: sec,
                  secondaryCatAxis: sec,
                  dataLabelPosition: "t",
                  ...rotulos(sec ? (chart.secondaryFormat ?? chart.format) : chart.format),
                },
              },
            ]
          : []),
      ],
      {
        ...base,
        showValue: false,
        valAxes: sec
          ? [
              {
                showValAxisTitle: false,
                valAxisMinVal: 0,
                valAxisLabelFormatCode: excelFormat(chart.format),
                valGridLine: { color: C.grid, style: "solid", size: 0.75 },
                valAxisLabelColor: C.muted,
              },
              {
                showValAxisTitle: false,
                valAxisMinVal: 0,
                valAxisLabelFormatCode: excelFormat(chart.secondaryFormat ?? chart.format),
                valGridLine: { style: "none" },
                valAxisLabelColor: C.muted,
              },
            ]
          : undefined,
        catAxes: sec ? [{ catAxisTitle: "" }, { catAxisHidden: true }] : undefined,
      },
    );
    return;
  }

  const tipo =
    chart.kind === "line" ? pres.ChartType.line : chart.kind === "area" ? pres.ChartType.area : pres.ChartType.bar;
  const porPonto = chart.series.length === 1 && chart.pointColors?.length;
  const opcoes = {
    barDir: chart.kind === "barH" ? "bar" : "col",
    barGrouping: chart.kind === "stacked" ? "stacked" : "clustered",
    barGapWidthPct: 55,
    lineSize: 2.5,
    lineDataSymbol: "circle",
    lineDataSymbolSize: 6,
    dataLabelPosition:
      chart.kind === "stacked" ? "ctr" : chart.kind === "line" || chart.kind === "area" ? "t" : "outEnd",
    chartColors: porPonto ? chart.pointColors.map((c, i) => semCerquilha(c, i) || PALETA[i % PALETA.length]) : cores,
  };
  if (chart.target && chart.kind !== "barH" && chart.kind !== "stacked") {
    s.addChart(
      [
        {
          type: tipo,
          data: dados,
          options: {
            ...opcoes,
            showValue: base.showValue,
            dataLabelFormatCode: excelFormat(chart.format),
            dataLabelColor: C.ink,
            dataLabelFontSize: 9,
          },
        },
        {
          type: pres.ChartType.line,
          data: [
            {
              name: chart.target.label,
              labels: chart.categories,
              values: chart.categories.map(() => chart.target.value),
            },
          ],
          options: { chartColors: [C.red], lineSize: 2, lineDataSymbol: "none", lineDash: "dash", showValue: false },
        },
      ],
      { ...base, showValue: false },
    );
    return;
  }
  s.addChart(tipo, dados, { ...base, ...opcoes });
}

function graficoDados(pres, deck, d) {
  const s = slideConteudo(pres, d);
  const destaques = d.spec.highlights?.slice(0, 4) ?? [];
  const gw = destaques.length ? 8.25 : CW;
  graficoSpec(pres, s, d.spec.chart, { x: MX, y: TOPO, w: gw, h: BASE - TOPO - 0.3 });
  if (destaques.length) {
    const px = 9.2;
    const pw = W - MX - px;
    caixa(s, px, TOPO, pw, BASE - TOPO, C.soft);
    texto(s, "Destaques", { x: px + 0.3, y: TOPO + 0.28, w: pw - 0.6, h: 0.4, fontSize: 15, bold: true });
    destaques.forEach((k, i) => {
      const y = TOPO + 0.95 + i * 1.0;
      linha(s, px + 0.3, y - 0.1, pw - 0.6, 0, C.line, 0.75);
      texto(s, String(k.value), {
        x: px + 0.3,
        y,
        w: pw - 0.6,
        h: 0.5,
        fontSize: String(k.value).length > 10 ? 17 : 22,
        bold: true,
        color: k.tone === "red" ? C.red : C.ink,
      });
      texto(s, k.label + (k.hint ? ` · ${k.hint}` : ""), {
        x: px + 0.3,
        y: y + 0.5,
        w: pw - 0.6,
        h: 0.36,
        fontSize: 10.5,
        color: C.muted,
      });
    });
  }
  rodapeFonte(s, d.fonte);
  notas(s, `Gráfico nativo com os dados do QualiHub (botão direito › Editar dados). ${d.fonte ?? ""}`);
}

function tabelaDados(pres, deck, d) {
  const { columns, rows } = d.spec.table;
  const porSlide = 11;
  const paginas = Math.max(1, Math.ceil(rows.length / porSlide));
  // Larguras proporcionais ao conteúdo (com limites)
  const pesos = columns.map((c, j) =>
    Math.min(28, Math.max(5, String(c).length, ...rows.slice(0, 40).map((r) => String(r[j] ?? "").length))),
  );
  const soma = pesos.reduce((a, b) => a + b, 0);
  const colW = pesos.map((p) => (p / soma) * CW);
  const fs = columns.length > 7 ? 9.5 : 10.5;
  const numerico = (v) => /^[-+]?[\d.,]+\s*%?$/.test(v.trim()) || /^R\$/.test(v.trim());
  for (let p = 0; p < paginas; p++) {
    const titulo = paginas > 1 ? `${d.titulo} (${p + 1}/${paginas})` : d.titulo;
    const s = slideConteudo(pres, { ...d, titulo });
    const parte = rows.slice(p * porSlide, (p + 1) * porSlide);
    s.addTable(
      [
        columns.map((c) => ({
          text: String(c),
          options: { bold: true, color: C.white, fill: { color: C.graf }, fontSize: fs, valign: "middle" },
        })),
        ...parte.map((r, i) =>
          columns.map((_, j) => {
            const v = String(r[j] ?? "");
            return {
              text: v,
              options: {
                fontSize: fs,
                valign: "middle",
                bold: j === 0,
                color: j === 0 ? C.ink : "45474B",
                align: numerico(v) ? "right" : "left",
                fill: { color: i % 2 ? "F8F8F9" : C.white },
              },
            };
          }),
        ),
      ],
      {
        x: MX,
        y: TOPO,
        w: CW,
        colW,
        rowH: 0.4,
        fontFace: F,
        margin: [0.03, 0.1, 0.03, 0.1],
        border: { type: "solid", pt: 0.75, color: C.line },
      },
    );
    rodapeFonte(s, d.fonte);
    notas(s, `Tabela nativa com os dados do QualiHub. ${d.fonte ?? ""}`);
  }
}

function textoDados(pres, deck, d) {
  const s = slideConteudo(pres, d);
  caixa(s, MX, TOPO, 0.06, BASE - TOPO - 0.35, C.red);
  const n = d.spec.bullets.length;
  texto(
    s,
    d.spec.bullets.map((t) => ({ text: t, options: { bullet: { indent: 18 }, breakLine: true } })),
    { x: MX + 0.3, y: TOPO, w: CW - 0.3, h: BASE - TOPO - 0.4, fontSize: n > 10 ? 12 : n > 6 ? 13.5 : 15, paraSpaceAfter: 8 },
  );
  rodapeFonte(s, d.fonte);
  notas(s, `Conteúdo do QualiHub. ${d.fonte ?? ""}`);
}

function slidesDeDados(pres, deck, dados, numero) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  divisoria(pres, deck, {
    numero,
    titulo: "Dados do QualiHub",
    texto: `Indicadores e análises extraídos do sistema de Gestão da Qualidade em ${hoje}.`,
  });
  for (const d of dados) {
    const base = { ...d, lead: d.subtitulo };
    const tipo = d.spec?.type;
    if (tipo === "kpis") kpisDados(pres, deck, base);
    else if (tipo === "chart") graficoDados(pres, deck, base);
    else if (tipo === "table") tabelaDados(pres, deck, base);
    else if (tipo === "text") textoDados(pres, deck, base);
    else if (tipo === "section" || tipo === "cover")
      divisoria(pres, deck, { numero, titulo: d.spec.title ?? d.titulo, texto: d.spec.subtitle ?? d.subtitulo ?? "" });
  }
}

/**
 * Monta um modelo da biblioteca.
 *  - opcoes.logos: { cor, branca } em base64 ("image/png;base64,...")
 *  - opcoes.capa: { titulo, subtitulo } (opcional)
 *  - opcoes.dados: [{ titulo, subtitulo?, spec, fonte? }] (opcional)
 *  - opcoes.modo: "completo" (modelo inteiro + dados antes do plano de ação)
 *                 ou "dados" (só capa, dados e encerramento)
 */
export function construirModelo(modelo, opcoes) {
  LOGO = opcoes.logos.cor;
  LOGO_BRANCA = opcoes.logos.branca;
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";
  pres.author = "Fras-le Mobility";
  pres.company = "Fras-le Mobility";
  pres.subject = `Modelo ${modelo.numero} — ${modelo.nome}`;
  pres.title = opcoes.capa?.titulo || modelo.titulo;
  pres.theme = { headFontFace: F, bodyFontFace: F };
  definirMasters(pres, modelo);

  const dados = opcoes.dados ?? [];
  const modo = dados.length ? (opcoes.modo ?? "completo") : "completo";
  let slides = modelo.slides;
  if (modo === "dados") slides = slides.filter(([t]) => t === "capa" || t === "encerramento");
  let pos = slides.findIndex(([t]) => t === "planoAcao");
  if (pos < 0) pos = slides.findIndex(([t]) => t === "encerramento");
  if (pos < 0) pos = slides.length;
  const numero = String(slides.slice(0, pos).filter(([t]) => t === "divisoria").length + 1).padStart(2, "0");

  const resumo = [];
  slides.forEach(([tipo, d], i) => {
    if (dados.length && i === pos) slidesDeDados(pres, modelo, dados, numero);
    if (tipo === "capa") {
      const c = opcoes.capa ?? {};
      capa(pres, modelo, { ...d, titulo: c.titulo || d.titulo, subtitulo: c.subtitulo || d.subtitulo });
    } else TIPOS[tipo](pres, modelo, d);
    resumo.push({
      tipo,
      titulo:
        tipo === "capa"
          ? "Capa"
          : tipo === "encerramento"
            ? "Encerramento"
            : tipo === "planoAcao"
              ? (d.titulo ?? "Plano de ação")
              : (d.titulo ?? tipo),
    });
  });
  if (dados.length && pos >= slides.length) slidesDeDados(pres, modelo, dados, numero);
  return { pres, resumo };
}

export const modeloPorId = (id) => MODELOS.find((m) => m.id === id);
