// Gera o PowerPoint (.pptx) a partir dos mesmos SlideSpec usados na tela.
// Tudo sai editável: textos em caixas de texto, cards como formas, gráficos
// nativos do PowerPoint (com planilha de dados) e tabelas nativas.
// Coordenadas: o slide da tela tem 1280×720 px; no PPT 13,333×7,5 pol (px/96).
import PptxGenJS from "pptxgenjs";
import logoUrl from "@/assets/frasle-logo.png";
import {
  THEME_HEX,
  TONE_HEX,
  excelFormat,
  formatValue,
  seriesColor,
  hex,
  type ChartSpecData,
  type KpiItem,
  type SlideSpec,
  type SlideTheme,
} from "@/lib/slide-spec";
import { CONTENT, kpiLayout } from "@/components/slide-canvas";

export type PptxSlideInput = {
  title: string;
  subtitle?: string;
  notes?: string;
  spec: SlideSpec;
};

const IN = (px: number) => px / 96;
const PT = (px: number) => Math.round(px * 0.75 * 10) / 10;
// Fontes presentes em qualquer Windows (Inter/Sora nem sempre estão instaladas).
const FONT = "Segoe UI";
const FONT_DISPLAY = "Segoe UI Semibold";

/** Carrega a logo reduzida (PNG ~120 px de altura) para não pesar o arquivo. */
async function loadLogo(url: string): Promise<{ data: string; ratio: number }> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("logo"));
    img.src = url;
  });
  const h = Math.min(120, img.height);
  const w = Math.round((img.width / img.height) * h);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return { data: canvas.toDataURL("image/png"), ratio: w / h };
}

type Ctx = {
  pptx: PptxGenJS;
  theme: SlideTheme;
  logo: string | null;
  logoRatio: number;
  dateLabel: string;
};

function addLogo(ctx: Ctx, slide: PptxGenJS.Slide, x: number, y: number, h: number) {
  if (!ctx.logo) return;
  const w = h * ctx.logoRatio;
  if (ctx.theme === "dark") {
    slide.addShape(ctx.pptx.ShapeType.roundRect, {
      x: IN(x - 12),
      y: IN(y - 6),
      w: IN(w + 24),
      h: IN(h + 12),
      fill: { color: "FFFFFF" },
      line: { color: "FFFFFF", width: 0 },
      rectRadius: 0.08,
    });
  }
  slide.addImage({ data: ctx.logo, x: IN(x), y: IN(y), w: IN(w), h: IN(h) });
}

function addChrome(
  ctx: Ctx,
  slide: PptxGenJS.Slide,
  item: PptxSlideInput,
  index: number,
  total: number,
) {
  const t = THEME_HEX[ctx.theme];
  const { pptx } = ctx;
  slide.background = { color: t.bg };
  slide.addShape(pptx.ShapeType.rect, {
    x: IN(56),
    y: 0,
    w: IN(120),
    h: IN(6),
    fill: { color: t.primary },
    line: { color: t.primary, width: 0 },
  });
  slide.addText("QUALIHUB · GESTÃO DA QUALIDADE", {
    x: IN(56),
    y: IN(34),
    w: IN(700),
    h: IN(24),
    fontFace: FONT,
    fontSize: PT(13),
    bold: true,
    color: t.primary,
    charSpacing: 2,
    margin: 0,
  });
  addLogo(ctx, slide, 1280 - 56 - 30 * ctx.logoRatio, 30, 30);
  slide.addText(item.title || "Slide sem título", {
    x: IN(56),
    y: IN(62),
    w: IN(1000),
    h: IN(52),
    fontFace: FONT_DISPLAY,
    fontSize: PT(38),
    bold: true,
    color: t.text,
    margin: 0,
    fit: "shrink",
    valign: "middle",
  });
  if (item.subtitle) {
    slide.addText(item.subtitle, {
      x: IN(56),
      y: IN(116),
      w: IN(1100),
      h: IN(26),
      fontFace: FONT,
      fontSize: PT(17),
      color: t.muted,
      margin: 0,
      fit: "shrink",
    });
  }
  slide.addShape(pptx.ShapeType.line, {
    x: IN(56),
    y: IN(720 - 36),
    w: IN(1168),
    h: 0,
    line: { color: t.border, width: 0.75 },
  });
  slide.addText(`Frasle Mobility · Gestão da Qualidade de Fornecedores · ${ctx.dateLabel}`, {
    x: IN(56),
    y: IN(720 - 30),
    w: IN(800),
    h: IN(18),
    fontFace: FONT,
    fontSize: PT(12),
    color: t.muted,
    margin: 0,
  });
  slide.addText(`${index} / ${total}`, {
    x: IN(1280 - 56 - 200),
    y: IN(720 - 30),
    w: IN(200),
    h: IN(18),
    fontFace: FONT,
    fontSize: PT(12),
    bold: true,
    color: t.muted,
    align: "right",
    margin: 0,
  });
}

function addCover(
  ctx: Ctx,
  slide: PptxGenJS.Slide,
  spec: Extract<SlideSpec, { type: "cover" | "section" }>,
) {
  const t = THEME_HEX[ctx.theme];
  const { pptx } = ctx;
  slide.background = { color: t.bg };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: IN(14),
    h: 7.5,
    fill: { color: t.primary },
    line: { color: t.primary, width: 0 },
  });
  addLogo(ctx, slide, 96, 72, 44);
  const isSection = spec.type === "section";
  const top = isSection ? 260 : 238;
  slide.addText(isSection ? "SEÇÃO" : "QUALIHUB · GESTÃO DA QUALIDADE", {
    x: IN(96),
    y: IN(top),
    w: IN(1050),
    h: IN(24),
    fontFace: FONT,
    fontSize: PT(16),
    bold: true,
    color: t.primary,
    charSpacing: 3,
    margin: 0,
  });
  slide.addText(spec.title, {
    x: IN(96),
    y: IN(top + 34),
    w: IN(1050),
    h: IN(96),
    fontFace: FONT_DISPLAY,
    fontSize: PT(66),
    bold: true,
    color: t.text,
    margin: 0,
    valign: "top",
    fit: "shrink",
  });
  if (spec.subtitle) {
    slide.addText(spec.subtitle, {
      x: IN(96),
      y: IN(top + 140),
      w: IN(1050),
      h: IN(36),
      fontFace: FONT,
      fontSize: PT(24),
      color: t.muted,
      margin: 0,
    });
  }
  const meta = spec.type === "cover" ? (spec.meta ?? ctx.dateLabel) : ctx.dateLabel;
  slide.addText(meta, {
    x: IN(96),
    y: IN(720 - 86),
    w: IN(700),
    h: IN(24),
    fontFace: FONT,
    fontSize: PT(16),
    color: t.muted,
    margin: 0,
  });
  slide.addText("Frasle Mobility", {
    x: IN(1280 - 72 - 300),
    y: IN(720 - 86),
    w: IN(300),
    h: IN(24),
    fontFace: FONT,
    fontSize: PT(14),
    color: t.muted,
    align: "right",
    margin: 0,
  });
}

function addKpis(
  ctx: Ctx,
  slide: PptxGenJS.Slide,
  items: KpiItem[],
  box: { x: number; y: number; w: number; h: number },
  columns?: number,
  compact = false,
) {
  const t = THEME_HEX[ctx.theme];
  const { pptx } = ctx;
  const layout = columns ? { cols: columns, rows: items.length } : kpiLayout(items.length);
  const gap = compact ? 14 : 20;
  const cardW = (box.w - gap * (layout.cols - 1)) / layout.cols;
  const cardH = Math.min(compact ? 128 : 220, (box.h - gap * (layout.rows - 1)) / layout.rows);
  const gridH = cardH * layout.rows + gap * (layout.rows - 1);
  const startY = compact ? box.y : box.y + (box.h - gridH) / 2;

  items.forEach((k, i) => {
    const col = i % layout.cols;
    const row = Math.floor(i / layout.cols);
    const x = box.x + col * (cardW + gap);
    const y = startY + row * (cardH + gap);
    const tone = TONE_HEX[k.tone ?? "neutral"][ctx.theme];
    slide.addShape(pptx.ShapeType.roundRect, {
      x: IN(x),
      y: IN(y),
      w: IN(cardW),
      h: IN(cardH),
      fill: { color: t.card },
      line: { color: t.border, width: 0.75 },
      rectRadius: 0.12,
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: IN(x + 10),
      y: IN(y),
      w: IN(cardW - 20),
      h: IN(5),
      fill: { color: tone },
      line: { color: tone, width: 0 },
    });
    const padX = compact ? 18 : 26;
    const padY = compact ? 16 : 24;
    slide.addText(k.label.toUpperCase(), {
      x: IN(x + padX),
      y: IN(y + padY),
      w: IN(cardW - padX * 2),
      h: IN(20),
      fontFace: FONT,
      fontSize: PT(compact ? 12 : 14),
      bold: true,
      color: t.muted,
      charSpacing: 1,
      margin: 0,
      fit: "shrink",
    });
    const valueSize = compact ? 30 : k.value.length > 12 ? 38 : 50;
    slide.addText(k.value, {
      x: IN(x + padX),
      y: IN(y + padY + (compact ? 26 : 34)),
      w: IN(cardW - padX * 2),
      h: IN(valueSize * 1.25),
      fontFace: FONT_DISPLAY,
      fontSize: PT(valueSize),
      bold: true,
      color: k.tone && k.tone !== "neutral" ? tone : t.text,
      margin: 0,
      fit: "shrink",
      valign: "middle",
    });
    if (k.hint) {
      slide.addText(k.hint, {
        x: IN(x + padX),
        y: IN(y + cardH - padY - 20),
        w: IN(cardW - padX * 2),
        h: IN(22),
        fontFace: FONT,
        fontSize: PT(compact ? 12 : 15),
        color: t.muted,
        margin: 0,
        fit: "shrink",
      });
    }
  });
}

function chartType(pptx: PptxGenJS, kind: ChartSpecData["kind"]) {
  switch (kind) {
    case "line":
      return pptx.ChartType.line;
    case "area":
      return pptx.ChartType.area;
    case "doughnut":
      return pptx.ChartType.doughnut;
    case "pie":
      return pptx.ChartType.pie;
    default:
      return pptx.ChartType.bar;
  }
}

function addChart(
  ctx: Ctx,
  slide: PptxGenJS.Slide,
  chart: ChartSpecData,
  box: { x: number; y: number; w: number; h: number },
) {
  const t = THEME_HEX[ctx.theme];
  const { pptx } = ctx;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: IN(box.x),
    y: IN(box.y),
    w: IN(box.w),
    h: IN(box.h),
    fill: { color: t.card },
    line: { color: t.border, width: 0.75 },
    rectRadius: 0.12,
  });
  const pad = 22;
  const area = {
    x: IN(box.x + pad),
    y: IN(box.y + pad),
    w: IN(box.w - pad * 2),
    h: IN(box.h - pad * 2),
  };

  const base = {
    ...area,
    showLegend:
      chart.series.length > 1 ||
      chart.kind === "doughnut" ||
      chart.kind === "pie" ||
      Boolean(chart.target),
    legendPos: chart.kind === "doughnut" || chart.kind === "pie" ? "r" : "b",
    legendFontSize: 12,
    legendColor: t.muted,
    legendFontFace: FONT,
    catAxisLabelColor: t.muted,
    valAxisLabelColor: t.muted,
    catAxisLabelFontSize: 12,
    valAxisLabelFontSize: 11,
    catAxisLabelFontFace: FONT,
    valAxisLabelFontFace: FONT,
    catAxisLineShow: false,
    valAxisLineShow: false,
    valGridLine: { color: t.grid, style: "dash", size: 0.75 },
    catGridLine: { style: "none" },
    valAxisLabelFormatCode: excelFormat(chart.format),
    dataLabelFormatCode: excelFormat(chart.format),
    dataLabelColor: t.text,
    dataLabelFontSize: 11,
    dataLabelFontFace: FONT,
    showValue: chart.showValues ?? chart.categories.length <= 14,
    plotArea: { fill: { color: t.card } },
    catAxisLabelRotate:
      chart.categories.length > 6 &&
      Math.max(...chart.categories.map((x) => x.length), 0) > 8 &&
      chart.kind !== "barH"
        ? -30
        : 0,
  } as Record<string, unknown>;

  const colors = chart.series.map((_, i) => seriesColor(chart, i));
  const data = chart.series.map((s) => ({
    name: s.name,
    labels: chart.categories,
    values: s.values.map((v) => Number(v) || 0),
  }));

  if (chart.kind === "doughnut" || chart.kind === "pie") {
    slide.addChart(chartType(pptx, chart.kind), data.slice(0, 1), {
      ...base,
      chartColors: chart.categories.map((_, i) =>
        hex(chart.pointColors?.[i] ?? seriesColor({ ...chart, series: [] }, i)),
      ),
      holeSize: 58,
      showPercent: true,
      showValue: false,
      showLabel: false,
      dataLabelColor: "FFFFFF",
      dataLabelFormatCode: "0.0%",
      legendFontSize: 14,
    } as PptxGenJS.IChartOpts);
    return;
  }

  // Meta como série tracejada (fica editável no PowerPoint).
  const withTarget = chart.target
    ? [
        ...data,
        {
          name: chart.target.label,
          labels: chart.categories,
          values: chart.categories.map(() => chart.target!.value),
        },
      ]
    : data;

  if (chart.kind === "combo") {
    const bars = chart.series.map((s, i) => ({ s, i })).filter(({ s }) => s.type !== "line");
    const lines = chart.series.map((s, i) => ({ s, i })).filter(({ s }) => s.type === "line");
    const hasSecondary = lines.some(({ s }) => s.secondary);
    const toData = (list: { s: ChartSpecData["series"][number] }[]) =>
      list.map(({ s }) => ({
        name: s.name,
        labels: chart.categories,
        values: s.values.map((v) => Number(v) || 0),
      }));
    const multi = [
      ...(bars.length
        ? [
            {
              type: pptx.ChartType.bar,
              data: toData(bars),
              options: {
                chartColors: bars.map(({ i }) => colors[i]),
                barGrouping: "clustered",
                barGapWidthPct: 60,
                showValue: base.showValue,
                dataLabelPosition: "outEnd",
                dataLabelFormatCode: excelFormat(chart.format),
                dataLabelColor: t.text,
                dataLabelFontSize: 10,
              },
            },
          ]
        : []),
      ...(lines.length
        ? [
            {
              type: pptx.ChartType.line,
              data: toData(lines),
              options: {
                chartColors: lines.map(({ i }) => colors[i]),
                lineSize: 3,
                lineDataSymbolSize: 8,
                secondaryValAxis: hasSecondary,
                secondaryCatAxis: hasSecondary,
                showValue: base.showValue,
                dataLabelPosition: "t",
                dataLabelFormatCode: excelFormat(
                  hasSecondary ? (chart.secondaryFormat ?? chart.format) : chart.format,
                ),
                dataLabelColor: t.text,
                dataLabelFontSize: 10,
              },
            },
          ]
        : []),
    ];
    // Gráfico combinado (barras + linhas): assinatura multi-tipo do pptxgenjs.
    (slide.addChart as unknown as (types: unknown, opts: unknown) => void)(multi, {
      ...base,
      showValue: false,
      valAxes: hasSecondary
        ? [
            {
              showValAxisTitle: false,
              valAxisMinVal: 0,
              valAxisLabelFormatCode: excelFormat(chart.format),
              valGridLine: { color: t.grid, style: "dash", size: 0.75 },
              valAxisLabelColor: t.muted,
            },
            {
              showValAxisTitle: false,
              valAxisMinVal: 0,
              valAxisLabelFormatCode: excelFormat(chart.secondaryFormat ?? chart.format),
              valGridLine: { style: "none" },
              valAxisLabelColor: t.muted,
            },
          ]
        : undefined,
      catAxes: hasSecondary ? [{ catAxisTitle: "" }, { catAxisHidden: true }] : undefined,
    });
    return;
  }

  const isLine = chart.kind === "line" || chart.kind === "area";
  if (chart.target && (isLine || chart.kind === "bar")) {
    const mainType = chartType(pptx, chart.kind);
    const multi = [
      {
        type: mainType,
        data,
        options: {
          chartColors: colors,
          lineSize: 3,
          lineDataSymbol: "circle",
          lineDataSymbolSize: 8,
          barGapWidthPct: 55,
          showValue: base.showValue,
          dataLabelPosition: isLine ? "t" : "outEnd",
          dataLabelFormatCode: excelFormat(chart.format),
          dataLabelColor: t.text,
          dataLabelFontSize: 11,
        },
      },
      {
        type: pptx.ChartType.line,
        data: [withTarget[withTarget.length - 1]],
        options: {
          chartColors: [TONE_HEX.amber[ctx.theme]],
          lineSize: 2,
          lineDash: "dash",
          lineDataSymbol: "none",
          showValue: false,
        },
      },
    ];
    (slide.addChart as unknown as (types: unknown, opts: unknown) => void)(multi, {
      ...base,
      showValue: false,
      valAxisMinVal: 0,
    });
    return;
  }
  slide.addChart(chartType(pptx, chart.kind), withTarget, {
    ...base,
    chartColors: [...colors, chart.target ? TONE_HEX.amber[ctx.theme] : undefined].filter(
      Boolean,
    ) as string[],
    barDir: chart.kind === "barH" ? "bar" : "col",
    barGrouping: chart.kind === "stacked" ? "stacked" : "clustered",
    barGapWidthPct: 55,
    lineSize: 3,
    lineDataSymbol: isLine ? "circle" : undefined,
    lineDataSymbolSize: 8,
    lineSmooth: isLine,
    dataLabelPosition:
      chart.kind === "barH" ? "outEnd" : isLine ? "t" : chart.kind === "stacked" ? "ctr" : "outEnd",
    catAxisOrientation: chart.kind === "barH" ? "maxMin" : "minMax",
    showValue: chart.kind === "stacked" ? false : base.showValue,
    valAxisMinVal: chart.kind === "line" || chart.kind === "area" ? undefined : 0,
  } as PptxGenJS.IChartOpts);
}

function addTable(ctx: Ctx, slide: PptxGenJS.Slide, spec: Extract<SlideSpec, { type: "table" }>) {
  const t = THEME_HEX[ctx.theme];
  const rows = spec.table.rows.slice(0, 12);
  const fontSize = PT(rows.length > 9 ? 14 : 16);
  const header = spec.table.columns.map((col) => ({
    text: col,
    options: { bold: true, color: "FFFFFF", fill: { color: t.primary }, fontFace: FONT, fontSize },
  }));
  const body = rows.map((r, i) =>
    r.map((cell, j) => ({
      text: cell,
      options: {
        color: t.text,
        bold: j === 0,
        fill: { color: i % 2 ? t.card : t.bg },
        fontFace: FONT,
        fontSize,
      },
    })),
  );
  slide.addTable([header, ...body] as PptxGenJS.TableRow[], {
    x: IN(CONTENT.x),
    y: IN(CONTENT.y),
    w: IN(CONTENT.w),
    border: { type: "solid", pt: 0.5, color: t.border },
    margin: 0.08,
    rowH: IN(rows.length > 9 ? 34 : 38),
    autoPage: false,
  });
  if (spec.table.rows.length > rows.length) {
    slide.addText(`+ ${spec.table.rows.length - rows.length} linhas não exibidas`, {
      x: IN(CONTENT.x),
      y: IN(CONTENT.y + CONTENT.h - 10),
      w: IN(600),
      h: IN(20),
      fontFace: FONT,
      fontSize: PT(13),
      color: t.muted,
      margin: 0,
    });
  }
}

function addBullets(ctx: Ctx, slide: PptxGenJS.Slide, bullets: string[]) {
  const t = THEME_HEX[ctx.theme];
  slide.addShape(ctx.pptx.ShapeType.roundRect, {
    x: IN(CONTENT.x),
    y: IN(CONTENT.y),
    w: IN(CONTENT.w),
    h: IN(CONTENT.h),
    fill: { color: t.card },
    line: { color: t.border, width: 0.75 },
    rectRadius: 0.12,
  });
  const fontSize = PT(bullets.length > 7 ? 20 : 24);
  slide.addText(
    bullets.map((b) => ({
      text: b,
      options: {
        bullet: { code: "25A0" },
        color: t.text,
        paraSpaceAfter: bullets.length > 7 ? 6 : 12,
      },
    })),
    {
      x: IN(CONTENT.x + 34),
      y: IN(CONTENT.y + 28),
      w: IN(CONTENT.w - 68),
      h: IN(CONTENT.h - 56),
      fontFace: FONT,
      fontSize,
      valign: "top",
      margin: 0,
      color: t.text,
    },
  );
}

function addBody(ctx: Ctx, slide: PptxGenJS.Slide, spec: SlideSpec) {
  switch (spec.type) {
    case "kpis":
      addKpis(ctx, slide, spec.items, CONTENT);
      break;
    case "chart": {
      const side = spec.highlights?.length ? 300 : 0;
      addChart(ctx, slide, spec.chart, {
        x: CONTENT.x,
        y: CONTENT.y,
        w: CONTENT.w - side - (side ? 24 : 0),
        h: CONTENT.h,
      });
      if (side)
        addKpis(
          ctx,
          slide,
          spec.highlights!,
          { x: CONTENT.x + CONTENT.w - side, y: CONTENT.y, w: side, h: CONTENT.h },
          1,
          true,
        );
      break;
    }
    case "table":
      addTable(ctx, slide, spec);
      break;
    case "text":
      addBullets(ctx, slide, spec.bullets);
      break;
  }
}

export async function generatePresentationPptx(
  slides: PptxSlideInput[],
  options: { theme?: SlideTheme; fileName?: string; title?: string; output?: "file" | "blob" } = {},
): Promise<Blob | void> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "QualiHub — Frasle Mobility";
  pptx.company = "Frasle Mobility";
  pptx.title = options.title ?? "Apresentação QualiHub";

  let logo: string | null = null;
  let logoRatio = 3;
  try {
    const loaded = await loadLogo(logoUrl);
    logo = loaded.data;
    logoRatio = loaded.ratio;
  } catch {
    logo = null;
  }

  const ctx: Ctx = {
    pptx,
    theme: options.theme ?? "dark",
    logo,
    logoRatio,
    dateLabel: new Date().toLocaleDateString("pt-BR"),
  };

  const contentTotal = slides.filter(
    (s) => s.spec.type !== "cover" && s.spec.type !== "section",
  ).length;
  let n = 0;
  for (const item of slides) {
    const slide = pptx.addSlide();
    if (item.spec.type === "cover" || item.spec.type === "section") {
      addCover(ctx, slide, item.spec);
    } else {
      n += 1;
      addChrome(ctx, slide, item, n, contentTotal);
      addBody(ctx, slide, item.spec);
    }
    if (item.notes?.trim()) slide.addNotes(item.notes.trim());
  }

  if (options.output === "blob") return (await pptx.write({ outputType: "blob" })) as Blob;
  const stamp = new Date().toISOString().slice(0, 10);
  await pptx.writeFile({ fileName: options.fileName ?? `QualiHub-Apresentacao-${stamp}.pptx` });
}

/** Valor formatado igual ao slide (útil para textos de apoio). */
export const fmtSlideValue = formatValue;
