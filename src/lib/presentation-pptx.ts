import PptxGenJS from "pptxgenjs";
import type { PresentationSlide } from "@/contexts/presentation-context";

type DataRecord = Record<string, unknown>;
type Tone = "red" | "blue" | "green" | "amber" | "purple" | "neutral";

type ExecutiveCardData = {
  key?: string;
  label: string;
  value: string;
  rawValue?: number;
  description?: string;
  tone?: Tone;
  icon?: string;
};

const COLORS = {
  background: "071014",
  card: "0D171C",
  card2: "101A1F",
  border: "263238",
  primary: "EF2B2D",
  white: "F5F7F8",
  muted: "9AA8AE",
  red: "EF2B2D",
  blue: "5C8FA8",
  green: "22C55E",
  amber: "F59E0B",
  purple: "B84BFF",
};

const TONE = {
  red: { accent: COLORS.red, border: "6B2427", fill: "171316", badge: "35171A" },
  blue: { accent: COLORS.blue, border: "33464F", fill: "10181C", badge: "1B2B32" },
  green: { accent: COLORS.green, border: "245936", fill: "0E1A14", badge: "143D23" },
  amber: { accent: COLORS.amber, border: "66501B", fill: "1A1710", badge: "3B2E10" },
  purple: { accent: COLORS.purple, border: "5D2A70", fill: "17111B", badge: "351A40" },
  neutral: { accent: COLORS.muted, border: COLORS.border, fill: COLORS.card, badge: "1A252B" },
} satisfies Record<Tone, { accent: string; border: string; fill: string; badge: string }>;

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

function formatLabel(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function asRecord(data: unknown): DataRecord | null {
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as DataRecord)
    : null;
}

function getFlatEntries(data: unknown): Array<[string, unknown]> {
  const record = asRecord(data);
  if (!record) return [];
  return Object.entries(record).filter(([, value]) =>
    ["string", "number", "boolean"].includes(typeof value),
  );
}

function getRows(data: unknown): DataRecord[] {
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is DataRecord => Boolean(row) && typeof row === "object" && !Array.isArray(row),
    );
  }
  const record = asRecord(data);
  if (!record) return [];
  const candidates = [
    record.rows,
    record.data,
    record.items,
    record.ranking,
    record.fornecedores,
    record.top5,
    record.bottom5,
    record.serie,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const rows = candidate.filter(
        (row): row is DataRecord => Boolean(row) && typeof row === "object" && !Array.isArray(row),
      );
      if (rows.length) return rows;
    }
  }
  return [];
}

function addBase(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  item: PresentationSlide,
  slideNumber: number,
) {
  slide.background = { color: COLORS.background };

  slide.addText("QUALIHUB", {
    x: 0.55, y: 0.28, w: 2, h: 0.25,
    fontFace: "Arial", fontSize: 9, bold: true,
    color: COLORS.primary, charSpacing: 2, margin: 0,
  });

  slide.addText("GESTÃO DA QUALIDADE", {
    x: 10.7, y: 0.3, w: 1.95, h: 0.2,
    fontFace: "Arial", fontSize: 5.5, color: COLORS.muted,
    align: "right", margin: 0,
  });

  slide.addText(item.title || "Slide sem título", {
    x: 0.55, y: 0.7, w: 11.9, h: 0.45,
    fontFace: "Arial", fontSize: 22, bold: true,
    color: COLORS.white, margin: 0, fit: "shrink",
  });

  if (item.subtitle) {
    slide.addText(item.subtitle, {
      x: 0.55, y: 1.18, w: 11.9, h: 0.28,
      fontFace: "Arial", fontSize: 9, color: COLORS.muted,
      margin: 0, fit: "shrink",
    });
  }

  slide.addShape(pptx.ShapeType.line, {
    x: 0.55, y: 1.58, w: 12.2, h: 0,
    line: { color: COLORS.border, width: 1 },
  });

  slide.addShape(pptx.ShapeType.line, {
    x: 0.55, y: 7.05, w: 12.2, h: 0,
    line: { color: COLORS.border, width: 1 },
  });

  slide.addText(item.sourceRoute ? `Fonte: QualiHub ${item.sourceRoute}` : "Fonte: QualiHub", {
    x: 0.55, y: 7.12, w: 4, h: 0.18,
    fontFace: "Arial", fontSize: 5.5, color: COLORS.muted, margin: 0,
  });

  slide.addText(`Frasle Mobility  •  ${slideNumber}`, {
    x: 9.5, y: 7.12, w: 3.25, h: 0.18,
    fontFace: "Arial", fontSize: 5.5, color: COLORS.muted,
    align: "right", margin: 0,
  });
}

function iconGlyph(icon?: string) {
  switch (icon) {
    case "gauge": return "↗";
    case "package": return "◇";
    case "check": return "✓";
    case "x": return "×";
    case "activity": return "∿";
    case "boxes": return "⬡";
    default: return "•";
  }
}

function addExecutiveKpis(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  cards: ExecutiveCardData[],
) {
  const visible = cards.slice(0, 6);
  const gap = 0.12;
  const x0 = 0.55;
  const totalW = 12.2;
  const cardW = (totalW - gap * 5) / 6;
  const y = 2.25;
  const h = 2.0;

  visible.forEach((card, index) => {
    const tone = TONE[card.tone ?? "neutral"];
    const x = x0 + index * (cardW + gap);

    // sombra/glow discreto, semelhante aos cards do sistema
    slide.addShape(pptx.ShapeType.roundRect, {
      x: x + 0.03, y: y + 0.05, w: cardW, h,
      rectRadius: 0.08,
      fill: { color: "020608", transparency: 35 },
      line: { color: "020608", transparency: 100 },
    });

    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w: cardW, h,
      rectRadius: 0.08,
      fill: { color: tone.fill },
      line: { color: tone.border, width: 1.1 },
    });

    slide.addShape(pptx.ShapeType.ellipse, {
      x: x + cardW - 0.48, y: y + 0.18, w: 0.3, h: 0.3,
      fill: { color: tone.badge },
      line: { color: tone.badge, transparency: 100 },
    });

    slide.addText(iconGlyph(card.icon), {
      x: x + cardW - 0.43, y: y + 0.215, w: 0.2, h: 0.16,
      fontFace: "Arial", fontSize: 10, bold: true,
      color: tone.accent, align: "center", margin: 0,
    });

    slide.addText(card.label.toUpperCase(), {
      x: x + 0.15, y: y + 0.18, w: cardW - 0.7, h: 0.2,
      fontFace: "Arial", fontSize: 6.2, bold: true,
      color: COLORS.muted, margin: 0, fit: "shrink",
    });

    slide.addText(card.value, {
      x: x + 0.15, y: y + 0.92, w: cardW - 0.3, h: 0.43,
      fontFace: "Arial", fontSize: card.key === "qld-qlde" ? 13 : 18,
      bold: true, color: COLORS.white, margin: 0, fit: "shrink",
    });

    if (card.description) {
      slide.addText(card.description, {
        x: x + 0.15, y: y + 1.48, w: cardW - 0.3, h: 0.22,
        fontFace: "Arial", fontSize: 6.2,
        color: COLORS.muted, margin: 0, fit: "shrink",
      });
    }
  });

  slide.addText("Consolidado dos principais indicadores da operação", {
    x: 0.55, y: 4.65, w: 12.2, h: 0.28,
    fontFace: "Arial", fontSize: 8, color: COLORS.muted,
    margin: 0, align: "center",
  });
}

function addQldQldeKpis(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  record: DataRecord,
) {
  const qld = asRecord(record.qld);
  const qlde = asRecord(record.qlde);
  if (!qld && !qlde) return false;

  const cards = [
    { title: "QLD", deposito: "Depósito 522 · Saldo livre", data: qld, tone: TONE.amber, status: "Em tratamento" },
    { title: "QLDE", deposito: "Depósito 523 · Saldo bloqueado", data: qlde, tone: TONE.red, status: "Bloqueado" },
  ] as const;

  cards.forEach((card, index) => {
    if (!card.data) return;
    const x = 0.65 + index * 6.1;
    const y = 2.0;
    const w = 5.85;
    const h = 2.25;

    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w, h, rectRadius: 0.08,
      fill: { color: card.tone.fill },
      line: { color: card.tone.border, width: 1.1 },
    });
    slide.addText(card.title, {
      x: x + 0.25, y: y + 0.2, w: 1.2, h: 0.25,
      fontFace: "Arial", fontSize: 12, bold: true, color: COLORS.white, margin: 0,
    });
    slide.addText(card.deposito, {
      x: x + 0.25, y: y + 0.5, w: 3.4, h: 0.2,
      fontFace: "Arial", fontSize: 7, color: COLORS.muted, margin: 0,
    });
    slide.addShape(pptx.ShapeType.roundRect, {
      x: x + 4.35, y: y + 0.18, w: 1.2, h: 0.32, rectRadius: 0.05,
      fill: { color: card.tone.badge }, line: { color: card.tone.border },
    });
    slide.addText(card.status, {
      x: x + 4.4, y: y + 0.26, w: 1.1, h: 0.12,
      fontFace: "Arial", fontSize: 5.5, bold: true,
      color: card.tone.accent, align: "center", margin: 0,
    });

    const fields = [
      ["Valor", card.data.valor],
      ["Quantidade", card.data.quantidade],
      ["SKUs", card.data.skus],
    ] as const;

    fields.forEach(([label, value], fieldIndex) => {
      const fw = 1.7;
      const fx = x + 0.25 + fieldIndex * 1.82;
      slide.addShape(pptx.ShapeType.roundRect, {
        x: fx, y: y + 1.05, w: fw, h: 0.85, rectRadius: 0.04,
        fill: { color: COLORS.background }, line: { color: COLORS.border, width: 0.7 },
      });
      slide.addText(label, {
        x: fx + 0.1, y: y + 1.18, w: fw - 0.2, h: 0.13,
        fontFace: "Arial", fontSize: 5.5, color: COLORS.muted, margin: 0,
      });
      const formatted = label === "Valor" && typeof value === "number"
        ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : formatValue(value);
      slide.addText(formatted, {
        x: fx + 0.1, y: y + 1.48, w: fw - 0.2, h: 0.22,
        fontFace: "Arial", fontSize: label === "Valor" ? 9 : 11,
        bold: true, color: COLORS.white, margin: 0, fit: "shrink",
      });
    });
  });

  return true;
}

function addKpis(pptx: PptxGenJS, slide: PptxGenJS.Slide, data: unknown) {
  const record = asRecord(data);

  // QLD/QLDE possui objetos aninhados; getFlatEntries não consegue renderizá-los.
  // Renderizamos diretamente os dois cards com os valores reais selecionados.
  if (record && addQldQldeKpis(pptx, slide, record)) return;

  const cards = record?.cards;
  if (record?.layout === "executive-kpis" && Array.isArray(cards)) {
    addExecutiveKpis(pptx, slide, cards as ExecutiveCardData[]);
    return;
  }

  const entries = getFlatEntries(data).slice(0, 8);
  if (!entries.length) return addFallback(pptx, slide, "Indicadores");

  const columns = Math.min(entries.length, 4);
  const gap = 0.18;
  const cardWidth = (12.2 - gap * (columns - 1)) / columns;

  entries.forEach(([key, value], index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 0.55 + column * (cardWidth + gap);
    const y = 2.1 + row * 1.55;

    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w: cardWidth, h: 1.25, rectRadius: 0.08,
      fill: { color: COLORS.card }, line: { color: COLORS.border, width: 1 },
    });
    slide.addText(formatLabel(key).toUpperCase(), {
      x: x + 0.18, y: y + 0.18, w: cardWidth - 0.36, h: 0.18,
      fontFace: "Arial", fontSize: 6, bold: true, color: COLORS.muted,
      margin: 0, fit: "shrink",
    });
    slide.addText(formatValue(value), {
      x: x + 0.18, y: y + 0.53, w: cardWidth - 0.36, h: 0.42,
      fontFace: "Arial", fontSize: 20, bold: true, color: COLORS.white,
      margin: 0, fit: "shrink",
    });
  });
}

function addPpmChart(pptx: PptxGenJS, slide: PptxGenJS.Slide, serie: DataRecord[]) {
  const labels = serie.map((row) => formatValue(row.mes));
  const values = serie.map((row) => Number(row.ppm) || 0);

  slide.addChart(
    pptx.ChartType.line,
    [{ name: "PPM", labels, values }],
    {
      x: 0.8, y: 1.95, w: 11.7, h: 4.65,
      chartColors: [COLORS.primary],
      showLegend: false,
      showTitle: false,
      showValue: true,
      showValAxisTitle: false,
      showCatAxisTitle: false,
      catAxisLabelColor: COLORS.muted,
      valAxisLabelColor: COLORS.muted,
      catAxisLabelFontFace: "Arial",
      valAxisLabelFontFace: "Arial",
      catAxisLabelFontSize: 10,
      valAxisLabelFontSize: 9,
      valGridLine: { color: COLORS.border },
      dataLabelColor: COLORS.white,
      dataLabelPosition: "t",
      dataLabelFormatCode: "#,##0",
      lineSize: 2.5,
      showMarker: true,
      markerSize: 5,
    } as any,
  );
}

function addNcChart(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  serie: DataRecord[],
  meta: number,
) {
  const labels = serie.map((row) => formatValue(row.mes));
  const values = serie.map((row) => Number(row.indice) || 0);
  const metas = labels.map(() => meta);

  slide.addChart(
    pptx.ChartType.line,
    [
      { name: "Índice NC", labels, values },
      { name: `Meta ${meta}%`, labels, values: metas },
    ],
    {
      x: 0.8, y: 1.95, w: 11.7, h: 4.65,
      chartColors: [COLORS.primary, COLORS.amber],
      showLegend: true,
      legendColor: COLORS.muted,
      legendFontSize: 8,
      legendPos: "b",
      showTitle: false,
      showValue: true,
      showValAxisTitle: false,
      showCatAxisTitle: false,
      catAxisLabelColor: COLORS.muted,
      valAxisLabelColor: COLORS.muted,
      catAxisLabelFontSize: 10,
      valAxisLabelFontSize: 9,
      valGridLine: { color: COLORS.border },
      dataLabelColor: COLORS.white,
      dataLabelPosition: "t",
      // Os dados do QualiHub já chegam em pontos percentuais:
      // 1.66 = 1,66%, 2.02 = 2,02%. Não usar "0.00%" aqui,
      // pois o PowerPoint multiplicaria novamente por 100.
      dataLabelFormatCode: '0.00"%"',
      valAxisLabelFormatCode: '0.0"%"',
      showMarker: true,
      markerSize: 5,
      lineSize: 2.5,
    } as any,
  );
}

function addChart(pptx: PptxGenJS, slide: PptxGenJS.Slide, item: PresentationSlide) {
  const record = asRecord(item.data);
  const serie = record?.serie;
  const rows = Array.isArray(serie)
    ? serie.filter((row): row is DataRecord => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    : [];

  if (rows.length && rows.some((row) => "mes" in row && "ppm" in row)) {
    addPpmChart(pptx, slide, rows);
    return;
  }

  if (rows.length && rows.some((row) => "mes" in row && "indice" in row)) {
    addNcChart(pptx, slide, rows, Number(record?.meta) || 2);
    return;
  }

  // Eficiência mensal: preserva as séries Recebidas, Inspecionadas e Eficiência.
  // Aceita nomes de propriedades usados em diferentes pontos do QualiHub.
  if (
    rows.length &&
    rows.some((row) =>
      "mes" in row &&
      (
        "recebidas" in row ||
        "recebidos" in row ||
        "inspecionadas" in row ||
        "inspecionados" in row ||
        "eficiencia" in row ||
        "eficienciaPct" in row ||
        "eficienciaPercentual" in row
      )
    )
  ) {
    const labels = rows.map((row) => formatValue(row.mes));
    const pickNumber = (row: DataRecord, keys: string[]) => {
      for (const key of keys) {
        const value = row[key];
        if (value !== undefined && value !== null && value !== "") {
          const parsed = Number(value);
          if (Number.isFinite(parsed)) return parsed;
        }
      }
      return 0;
    };

    const recebidas = rows.map((row) =>
      pickNumber(row, ["recebidas", "recebidos", "recebimento", "totalRecebidas"]),
    );
    const inspecionadas = rows.map((row) =>
      pickNumber(row, ["inspecionadas", "inspecionados", "inspecao", "totalInspecionadas"]),
    );
    const eficiencia = rows.map((row) =>
      pickNumber(row, ["eficiencia", "eficienciaPct", "eficienciaPercentual"]),
    );

    slide.addChart(
      pptx.ChartType.bar,
      [
        { name: "Recebidas", labels, values: recebidas },
        { name: "Inspecionadas", labels, values: inspecionadas },
      ],
      {
        x: 0.8, y: 1.95, w: 11.7, h: 4.65,
        chartColors: [COLORS.muted, COLORS.primary],
        showLegend: true,
        legendPos: "b",
        legendColor: COLORS.muted,
        showTitle: false,
        showValue: true,
        catAxisLabelColor: COLORS.muted,
        valAxisLabelColor: COLORS.muted,
        valGridLine: { color: COLORS.border },
        dataLabelColor: COLORS.white,
        dataLabelPosition: "outEnd",
        dataLabelFormatCode: "#,##0",
      } as any,
    );

    // A eficiência fica explicitamente visível como rótulo mensal.
    // Isso evita perder o indicador mesmo em versões do PptxGenJS que
    // não suportam bem gráfico combinado/segundo eixo.
    eficiencia.forEach((value, index) => {
      const usableW = 10.8;
      const x = 1.05 + (usableW / Math.max(labels.length, 1)) * index;
      slide.addText(`${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`, {
        x, y: 1.77, w: usableW / Math.max(labels.length, 1), h: 0.16,
        fontFace: "Arial", fontSize: 5.5, bold: true,
        color: COLORS.green, align: "center", margin: 0, fit: "shrink",
      });
    });
    return;
  }

  // Pareto: usa ocorrências e, quando disponível, mostra também o acumulado
  // no próprio slide em vez de reduzir o conteúdo a uma série genérica.
  if (
    rows.length &&
    rows.some((row) =>
      "ocorrencias" in row ||
      "ocorrência" in row ||
      "ocorrencia" in row ||
      "quantidade" in row
    )
  ) {
    const labels = rows.map((row, index) =>
      formatValue(
        row.motivo ??
        row.problema ??
        row.descricao ??
        row.causa ??
        row.label ??
        `Item ${index + 1}`,
      ),
    );
    const values = rows.map((row) =>
      Number(row.ocorrencias ?? row["ocorrência"] ?? row.ocorrencia ?? row.quantidade) || 0,
    );

    slide.addChart(
      pptx.ChartType.bar,
      [{ name: "Ocorrências", labels, values }],
      {
        x: 0.8, y: 1.95, w: 11.7, h: 4.65,
        chartColors: [COLORS.primary],
        showLegend: true,
        legendPos: "b",
        legendColor: COLORS.muted,
        showTitle: false,
        showValue: true,
        catAxisLabelColor: COLORS.muted,
        valAxisLabelColor: COLORS.muted,
        valGridLine: { color: COLORS.border },
        dataLabelColor: COLORS.white,
        dataLabelPosition: "outEnd",
        dataLabelFormatCode: "#,##0",
      } as any,
    );
    return;
  }

  const genericRows = getRows(item.data).slice(0, 12);
  if (genericRows.length) {
    const keys = Object.keys(genericRows[0] ?? {});
    const numericKey = keys.find((key) => genericRows.some((row) => typeof row[key] === "number"));
    const labelKey = keys.find((key) => key !== numericKey && genericRows.some((row) => typeof row[key] === "string"));

    if (numericKey) {
      slide.addChart(
        pptx.ChartType.bar,
        [{
          name: formatLabel(numericKey),
          labels: genericRows.map((row, index) => labelKey ? formatValue(row[labelKey]) : String(index + 1)),
          values: genericRows.map((row) => Number(row[numericKey]) || 0),
        }],
        {
          x: 0.8, y: 1.95, w: 11.7, h: 4.65,
          chartColors: [COLORS.primary],
          showLegend: false,
          showTitle: false,
          showValue: true,
          catAxisLabelColor: COLORS.muted,
          valAxisLabelColor: COLORS.muted,
          valGridLine: { color: COLORS.border },
          dataLabelColor: COLORS.white,
        } as any,
      );
      return;
    }
  }

  addFallback(pptx, slide, "Gráfico");
}

function addTable(pptx: PptxGenJS, slide: PptxGenJS.Slide, data: unknown) {
  const rows = getRows(data).slice(0, 10);
  if (!rows.length) return addFallback(pptx, slide, "Tabela");
  const columns = Object.keys(rows[0]).slice(0, 6);
  const tableRows: PptxGenJS.TableRow[] = [
    columns.map((column) => ({
      text: formatLabel(column),
      options: { bold: true, color: COLORS.white, fill: { color: COLORS.primary } },
    })),
    ...rows.map((row) => columns.map((column) => ({
      text: formatValue(row[column]),
      options: { color: COLORS.white, fill: { color: COLORS.card } },
    }))),
  ];

  slide.addTable(tableRows, {
    x: 0.65, y: 1.95, w: 12, h: 4.7,
    border: { type: "solid", color: COLORS.border, pt: 1 },
    fontFace: "Arial", fontSize: 8, color: COLORS.white, margin: 0.08,
  });
}

function addRanking(pptx: PptxGenJS, slide: PptxGenJS.Slide, data: unknown) {
  const rows = getRows(data).slice(0, 8);
  if (!rows.length) return addFallback(pptx, slide, "Ranking");

  rows.forEach((row, index) => {
    const label = String(row.fornecedor ?? row.nome ?? row.label ?? `Posição ${index + 1}`);
    const number = row.indiceNC ?? row.valor ?? row.total;
    const y = 1.9 + index * 0.58;

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.8, y, w: 11.7, h: 0.48, rectRadius: 0.04,
      fill: { color: COLORS.card }, line: { color: COLORS.border },
    });
    slide.addText(String(index + 1), {
      x: 1, y: y + 0.12, w: 0.3, h: 0.18,
      fontSize: 8, bold: true, color: COLORS.primary, margin: 0, align: "center",
    });
    slide.addText(label, {
      x: 1.5, y: y + 0.1, w: 8.5, h: 0.22,
      fontSize: 9, bold: true, color: COLORS.white, margin: 0, fit: "shrink",
    });
    if (number !== undefined) {
      slide.addText(typeof number === "number" ? `${Number(number).toFixed(1)}%` : formatValue(number), {
        x: 10.5, y: y + 0.1, w: 1.6, h: 0.22,
        fontSize: 9, bold: true, color: COLORS.white, margin: 0, align: "right",
      });
    }
  });
}

function addTextSlide(pptx: PptxGenJS, slide: PptxGenJS.Slide, item: PresentationSlide) {
  const record = asRecord(item.data);
  const pontos = Array.isArray(record?.pontos) ? record?.pontos.map(String) : [];
  const text = pontos.length ? pontos.map((p, i) => `${i + 1}. ${p}`).join("\n\n") : item.notes || "Adicione observações no Editor de Apresentação.";

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 2, w: 11.7, h: 4.2, rectRadius: 0.08,
    fill: { color: COLORS.card }, line: { color: COLORS.border },
  });
  slide.addText(text, {
    x: 1.1, y: 2.3, w: 11.1, h: 3.5,
    fontFace: "Arial", fontSize: 14, color: COLORS.white,
    valign: "middle", margin: 0.05, fit: "shrink", breakLine: false,
  });
}

function addFallback(pptx: PptxGenJS, slide: PptxGenJS.Slide, label: string) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 2, w: 11.7, h: 4.2, rectRadius: 0.08,
    fill: { color: COLORS.card }, line: { color: COLORS.border },
  });
  slide.addText(label, {
    x: 1, y: 3.5, w: 11.3, h: 0.5,
    fontFace: "Arial", fontSize: 22, bold: true,
    color: COLORS.muted, align: "center", margin: 0,
  });
}

export async function generatePresentationPptx(slides: PresentationSlide[]) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "QualiHub";
  pptx.company = "Frasle Mobility";
  pptx.subject = "Apresentação da Qualidade";
  pptx.title = "QualiHub — Gestão da Qualidade";
  pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };

  slides.forEach((item, index) => {
    const slide = pptx.addSlide();
    addBase(pptx, slide, item, index + 1);

    switch (item.type) {
      case "kpi":
      case "kpi-group":
        addKpis(pptx, slide, item.data);
        break;
      case "chart":
        addChart(pptx, slide, item);
        break;
      case "table":
      case "timeline":
        addTable(pptx, slide, item.data);
        break;
      case "ranking":
        addRanking(pptx, slide, item.data);
        break;
      case "text":
      case "ai-summary":
      case "manual":
        addTextSlide(pptx, slide, item);
        break;
      default:
        addFallback(pptx, slide, item.type);
    }
  });

  const safeDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).replace(/\//g, "-");

  await pptx.writeFile({ fileName: `QualiHub-Apresentacao-${safeDate}.pptx` });
}
