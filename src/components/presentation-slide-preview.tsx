import {
  BarChart3,
  FileText,
  Presentation,
  Table2,
  Trophy,
} from "lucide-react";

import type {
  PresentationSlide,
} from "@/contexts/presentation-context";

type PresentationSlidePreviewProps = {
  slide: PresentationSlide;
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "number") {
    return value.toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
    });
  }

  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }

  if (typeof value === "string") {
    return value;
  }

  return "—";
}

function formatLabel(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getFlatEntries(
  data: unknown,
): Array<[string, unknown]> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }

  return Object.entries(data as Record<string, unknown>).filter(
    ([, value]) =>
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean",
  );
}

function getPreviewRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) &&
        typeof row === "object" &&
        !Array.isArray(row),
    );
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  const record = data as Record<string, unknown>;

  const candidates = [
    record.rows,
    record.data,
    record.items,
    record.ranking,
    record.top5,
    record.bottom5,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const rows = candidate.filter(
        (row): row is Record<string, unknown> =>
          Boolean(row) &&
          typeof row === "object" &&
          !Array.isArray(row),
      );

      if (rows.length > 0) {
        return rows;
      }
    }
  }

  return [];
}

function KPIGroupPreview({
  data,
}: {
  data: unknown;
}) {
  const entries = getFlatEntries(data).slice(0, 8);

  if (entries.length === 0) {
    return <GenericPreview type="Indicadores" />;
  }

  return (
    <div className="grid h-full grid-cols-2 content-center gap-2 md:grid-cols-4">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="rounded-lg border bg-muted/20 px-3 py-3"
        >
          <div className="truncate text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
            {formatLabel(key)}
          </div>

          <div className="mt-1 truncate text-lg font-bold tracking-tight">
            {formatValue(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartPreview({
  data,
}: {
  data: unknown;
}) {
  const rows = getPreviewRows(data).slice(0, 7);

  if (rows.length === 0) {
    const entries = getFlatEntries(data)
      .filter(([, value]) => typeof value === "number")
      .slice(0, 7);

    if (entries.length === 0) {
      return <GenericPreview type="Gráfico" />;
    }

    const max = Math.max(
      ...entries.map(([, value]) => Number(value)),
      1,
    );

    return (
      <div className="flex h-full items-end gap-3 px-3 pb-3 pt-8">
        {entries.map(([key, value]) => {
          const number = Number(value);
          const height = Math.max((number / max) * 100, 8);

          return (
            <div
              key={key}
              className="flex h-full flex-1 flex-col justify-end"
            >
              <div className="mb-1 text-center text-[8px] font-semibold">
                {formatValue(number)}
              </div>

              <div className="flex h-[75%] items-end rounded-md bg-muted/30 p-1">
                <div
                  className="w-full rounded-sm bg-primary/80"
                  style={{
                    height: `${height}%`,
                  }}
                />
              </div>

              <div className="mt-1 truncate text-center text-[7px] text-muted-foreground">
                {formatLabel(key)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const numericKey = Object.keys(rows[0] ?? {}).find((key) =>
    rows.some((row) => typeof row[key] === "number"),
  );

  const labelKey = Object.keys(rows[0] ?? {}).find(
    (key) => key !== numericKey,
  );

  if (!numericKey) {
    return <GenericPreview type="Gráfico" />;
  }

  const max = Math.max(
    ...rows.map((row) => Number(row[numericKey]) || 0),
    1,
  );

  return (
    <div className="flex h-full items-end gap-2 px-3 pb-3 pt-8">
      {rows.map((row, index) => {
        const number = Number(row[numericKey]) || 0;
        const height = Math.max((number / max) * 100, 7);

        return (
          <div
            key={index}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
          >
            <div className="mb-1 truncate text-center text-[8px] font-semibold">
              {formatValue(number)}
            </div>

            <div className="flex h-[75%] items-end rounded-md bg-muted/30 p-1">
              <div
                className="w-full rounded-sm bg-primary/80"
                style={{
                  height: `${height}%`,
                }}
              />
            </div>

            <div className="mt-1 truncate text-center text-[7px] text-muted-foreground">
              {labelKey
                ? formatValue(row[labelKey])
                : index + 1}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TablePreview({
  data,
}: {
  data: unknown;
}) {
  const rows = getPreviewRows(data).slice(0, 5);

  if (rows.length === 0) {
    return <GenericPreview type="Tabela" />;
  }

  const columns = Object.keys(rows[0]).slice(0, 5);

  return (
    <div className="flex h-full items-center">
      <div className="w-full overflow-hidden rounded-lg border">
        <div
          className="grid bg-muted/50"
          style={{
            gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
          }}
        >
          {columns.map((column) => (
            <div
              key={column}
              className="truncate border-r px-2 py-1.5 text-[7px] font-bold uppercase last:border-r-0"
            >
              {formatLabel(column)}
            </div>
          ))}
        </div>

        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="grid border-t"
            style={{
              gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
            }}
          >
            {columns.map((column) => (
              <div
                key={column}
                className="truncate border-r px-2 py-1.5 text-[7px] last:border-r-0"
              >
                {formatValue(row[column])}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function RankingPreview({
  data,
}: {
  data: unknown;
}) {
  const rows = getPreviewRows(data).slice(0, 5);

  if (rows.length === 0) {
    return <GenericPreview type="Ranking" />;
  }

  return (
    <div className="flex h-full flex-col justify-center gap-2">
      {rows.map((row, index) => {
        const values = Object.entries(row);

        const label =
          values.find(([, value]) => typeof value === "string")?.[1] ??
          `Posição ${index + 1}`;

        const number =
          values.find(([, value]) => typeof value === "number")?.[1];

        return (
          <div
            key={index}
            className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              {index + 1}
            </div>

            <div className="min-w-0 flex-1 truncate text-[9px] font-semibold">
              {formatValue(label)}
            </div>

            {number !== undefined && (
              <div className="text-[10px] font-bold">
                {formatValue(number)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GenericPreview({
  type,
}: {
  type: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <Presentation className="mb-2 h-8 w-8 text-muted-foreground/50" />

      <div className="text-[10px] font-semibold">
        {type}
      </div>

      <div className="mt-1 text-[8px] text-muted-foreground">
        Conteúdo do QualiHub
      </div>
    </div>
  );
}

function SlideContent({
  slide,
}: {
  slide: PresentationSlide;
}) {
  switch (slide.type) {
    case "kpi":
    case "kpi-group":
      return <KPIGroupPreview data={slide.data} />;

    case "chart":
      return <ChartPreview data={slide.data} />;

    case "table":
      return <TablePreview data={slide.data} />;

    case "ranking":
      return <RankingPreview data={slide.data} />;

    case "text":
    case "ai-summary":
      return (
        <div className="flex h-full items-center">
          <div className="w-full rounded-lg border bg-muted/20 p-4">
            <FileText className="mb-2 h-5 w-5 text-primary" />

            <p className="text-[9px] leading-relaxed text-muted-foreground">
              {slide.notes ||
                "Adicione o conteúdo textual nas observações do slide."}
            </p>
          </div>
        </div>
      );

    case "manual":
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <FileText className="mx-auto mb-2 h-7 w-7 text-muted-foreground/50" />
            <div className="text-[9px] font-medium">
              Slide manual
            </div>
            <div className="mt-1 text-[8px] text-muted-foreground">
              Use as observações para adicionar conteúdo.
            </div>
          </div>
        </div>
      );

    case "section":
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <BarChart3 className="mx-auto mb-2 h-7 w-7 text-primary" />
            <div className="text-[10px] font-semibold">
              Seção da apresentação
            </div>
          </div>
        </div>
      );

    case "timeline":
      return <TablePreview data={slide.data} />;

    default:
      return <GenericPreview type={slide.type} />;
  }
}

export function PresentationSlidePreview({
  slide,
}: PresentationSlidePreviewProps) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border bg-background shadow-lg">
      <div className="flex h-full flex-col p-6">
        {/* Identidade */}
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary">
            QualiHub
          </div>

          <div className="text-[7px] uppercase tracking-wide text-muted-foreground">
            Gestão da Qualidade
          </div>
        </div>

        {/* Título */}
        <h3 className="line-clamp-2 text-xl font-bold leading-tight">
          {slide.title || "Slide sem título"}
        </h3>

        {slide.subtitle && (
          <p className="mt-1 line-clamp-2 text-[9px] text-muted-foreground">
            {slide.subtitle}
          </p>
        )}

        <div className="my-3 h-px shrink-0 bg-border" />

        {/* Conteúdo */}
        <div className="min-h-0 flex-1">
          <SlideContent slide={slide} />
        </div>

        {/* Rodapé */}
        <div className="mt-3 flex shrink-0 items-center justify-between border-t pt-2 text-[7px] text-muted-foreground">
          <span>
            {slide.sourceRoute
              ? `Fonte: QualiHub ${slide.sourceRoute}`
              : "QualiHub"}
          </span>

          <span>Frasle Mobility</span>
        </div>
      </div>
    </div>
  );
}