// Renderização de um slide (1280×720) a partir do SlideSpec.
// É o mesmo desenho usado no editor, no modo apresentação e — com as mesmas
// cores e posições — no PowerPoint gerado em src/lib/presentation-pptx.ts.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import logo from "@/assets/frasle-logo.png";
import {
  THEME_HEX,
  TONE_HEX,
  formatValue,
  seriesColor,
  hex,
  type ChartSpecData,
  type KpiItem,
  type SlideSpec,
  type SlideTheme,
} from "@/lib/slide-spec";

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

/** Área útil de conteúdo (compartilhada com o PPTX). */
export const CONTENT = { x: 56, y: 172, w: 1168, h: 470 };

export type SlideCanvasProps = {
  title: string;
  subtitle?: string;
  spec: SlideSpec;
  theme: SlideTheme;
  index?: number;
  total?: number;
  dateLabel?: string;
  animate?: boolean;
};

const c = (h: string) => `#${hex(h)}`;

/** Escala o slide para caber na largura do contêiner. */
export function SlideFrame({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      // Se a altura estiver limitada (tela cheia), cabe pelos dois lados.
      const byW = w / SLIDE_W;
      const byH = h > 0 && el.dataset.fit === "contain" ? h / SLIDE_H : Infinity;
      setScale(Math.min(byW, byH));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const contain = className?.includes("slide-fit-contain");
  return (
    <div
      ref={ref}
      data-fit={contain ? "contain" : "width"}
      className={className}
      style={contain ? style : { position: "relative", height: SLIDE_H * scale, ...style }}
    >
      {scale > 0 && (
        <div
          style={{
            position: "absolute",
            left: contain ? `calc(50% - ${(SLIDE_W * scale) / 2}px)` : 0,
            top: contain ? `calc(50% - ${(SLIDE_H * scale) / 2}px)` : 0,
            width: SLIDE_W,
            height: SLIDE_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function SlideCanvas({
  title,
  subtitle,
  spec,
  theme,
  index,
  total,
  dateLabel,
  animate = false,
}: SlideCanvasProps) {
  const t = THEME_HEX[theme];
  const isCover = spec.type === "cover" || spec.type === "section";
  return (
    <div
      style={{
        width: SLIDE_W,
        height: SLIDE_H,
        background: c(t.bg),
        color: c(t.text),
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      {/* brilho vermelho de fundo, como no sistema */}
      <div
        style={{
          position: "absolute",
          right: -220,
          top: -260,
          width: 620,
          height: 620,
          borderRadius: "50%",
          background: `radial-gradient(closest-side, ${c(t.primary)}${theme === "dark" ? "33" : "14"}, transparent)`,
        }}
      />
      {isCover ? (
        <CoverContent spec={spec} theme={theme} dateLabel={dateLabel} />
      ) : (
        <>
          <Header title={title} subtitle={subtitle} theme={theme} />
          <div
            style={{
              position: "absolute",
              left: CONTENT.x,
              top: CONTENT.y,
              width: CONTENT.w,
              height: CONTENT.h,
            }}
          >
            <Body spec={spec} theme={theme} animate={animate} />
          </div>
          <Footer theme={theme} index={index} total={total} dateLabel={dateLabel} />
        </>
      )}
    </div>
  );
}

function Logo({ theme, height = 34 }: { theme: SlideTheme; height?: number }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 10,
        padding: theme === "dark" ? "6px 12px" : 0,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      <img src={logo} alt="Frasle Mobility" style={{ height, width: "auto", display: "block" }} />
    </div>
  );
}

function Header({
  title,
  subtitle,
  theme,
}: {
  title: string;
  subtitle?: string;
  theme: SlideTheme;
}) {
  const t = THEME_HEX[theme];
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 56,
          top: 0,
          width: 120,
          height: 6,
          background: c(t.primary),
          borderRadius: "0 0 4px 4px",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 56,
          top: 40,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: c(t.primary),
        }}
      >
        QUALIHUB · GESTÃO DA QUALIDADE
      </div>
      <div style={{ position: "absolute", right: 56, top: 30 }}>
        <Logo theme={theme} height={30} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 56,
          top: 66,
          width: 1000,
          fontFamily: "Sora, Inter, Arial, sans-serif",
          fontSize: 38,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title || "Slide sem título"}
      </div>
      {subtitle && (
        <div
          style={{
            position: "absolute",
            left: 56,
            top: 118,
            width: 1100,
            fontSize: 17,
            color: c(t.muted),
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {subtitle}
        </div>
      )}
    </>
  );
}

function Footer({
  theme,
  index,
  total,
  dateLabel,
}: {
  theme: SlideTheme;
  index?: number;
  total?: number;
  dateLabel?: string;
}) {
  const t = THEME_HEX[theme];
  return (
    <div
      style={{
        position: "absolute",
        left: 56,
        right: 56,
        bottom: 26,
        borderTop: `1px solid ${c(t.border)}`,
        paddingTop: 10,
        display: "flex",
        justifyContent: "space-between",
        fontSize: 12,
        color: c(t.muted),
      }}
    >
      <span>
        Frasle Mobility · Gestão da Qualidade de Fornecedores{dateLabel ? ` · ${dateLabel}` : ""}
      </span>
      {index != null && (
        <span style={{ fontWeight: 600 }}>
          {index}
          {total ? ` / ${total}` : ""}
        </span>
      )}
    </div>
  );
}

function CoverContent({
  spec,
  theme,
  dateLabel,
}: {
  spec: SlideSpec;
  theme: SlideTheme;
  dateLabel?: string;
}) {
  const t = THEME_HEX[theme];
  const title = spec.type === "cover" || spec.type === "section" ? spec.title : "";
  const subtitle = spec.type === "cover" || spec.type === "section" ? spec.subtitle : "";
  const meta = spec.type === "cover" ? spec.meta : undefined;
  const isSection = spec.type === "section";
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 14,
          background: c(t.primary),
        }}
      />
      <div style={{ position: "absolute", left: 96, top: 72 }}>
        <Logo theme={theme} height={44} />
      </div>
      <div style={{ position: "absolute", left: 96, top: isSection ? 260 : 238, width: 1050 }}>
        <div
          style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.22em", color: c(t.primary) }}
        >
          {isSection ? "SEÇÃO" : "QUALIHUB · GESTÃO DA QUALIDADE"}
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: "Sora, Inter, Arial, sans-serif",
            fontSize: 66,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ marginTop: 20, fontSize: 24, color: c(t.muted) }}>{subtitle}</div>
        )}
      </div>
      <div style={{ position: "absolute", left: 96, bottom: 64, fontSize: 16, color: c(t.muted) }}>
        {meta ?? dateLabel ?? ""}
      </div>
      <div style={{ position: "absolute", right: 72, bottom: 64, fontSize: 14, color: c(t.muted) }}>
        Frasle Mobility
      </div>
    </>
  );
}

function Body({ spec, theme, animate }: { spec: SlideSpec; theme: SlideTheme; animate: boolean }) {
  switch (spec.type) {
    case "kpis":
      return <KpiGrid items={spec.items} theme={theme} width={CONTENT.w} height={CONTENT.h} />;
    case "chart": {
      const side = spec.highlights?.length ? 300 : 0;
      return (
        <div style={{ display: "flex", gap: 24, height: "100%" }}>
          <ChartPanel
            chart={spec.chart}
            theme={theme}
            width={CONTENT.w - side - (side ? 24 : 0)}
            height={CONTENT.h}
            animate={animate}
          />
          {side > 0 && (
            <div style={{ width: side }}>
              <KpiGrid
                items={spec.highlights!}
                theme={theme}
                width={side}
                height={CONTENT.h}
                columns={1}
                compact
              />
            </div>
          )}
        </div>
      );
    }
    case "table":
      return <TableView spec={spec} theme={theme} />;
    case "text":
      return <TextView bullets={spec.bullets} theme={theme} />;
    default:
      return null;
  }
}

export function kpiLayout(n: number) {
  if (n <= 4) return { cols: Math.max(n, 1), rows: 1 };
  if (n <= 6) return { cols: 3, rows: 2 };
  return { cols: 4, rows: Math.ceil(n / 4) };
}

function KpiGrid({
  items,
  theme,
  width,
  height,
  columns,
  compact = false,
}: {
  items: KpiItem[];
  theme: SlideTheme;
  width: number;
  height: number;
  columns?: number;
  compact?: boolean;
}) {
  const t = THEME_HEX[theme];
  const layout = columns ? { cols: columns, rows: items.length } : kpiLayout(items.length);
  const gap = compact ? 14 : 20;
  const cardH = Math.min(compact ? 128 : 220, (height - gap * (layout.rows - 1)) / layout.rows);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
        gap,
        width,
        alignContent: compact ? "start" : "center",
        height: compact ? undefined : height,
      }}
    >
      {items.map((k, i) => {
        const tone = c(TONE_HEX[k.tone ?? "neutral"][theme]);
        return (
          <div
            key={`${k.label}-${i}`}
            style={{
              position: "relative",
              height: cardH,
              borderRadius: 18,
              background: c(t.card),
              border: `1px solid ${c(t.border)}`,
              padding: compact ? "16px 18px" : "24px 26px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                height: 5,
                background: tone,
              }}
            />
            <div
              style={{
                fontSize: compact ? 12 : 14,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: c(t.muted),
              }}
            >
              {k.label}
            </div>
            <div
              style={{
                marginTop: compact ? 8 : 14,
                fontFamily: "Sora, Inter, Arial, sans-serif",
                fontSize: compact ? 30 : k.value.length > 12 ? 38 : 50,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: k.tone && k.tone !== "neutral" ? tone : c(t.text),
                lineHeight: 1.05,
                whiteSpace: "nowrap",
              }}
            >
              {k.value}
            </div>
            {k.hint && (
              <div style={{ marginTop: "auto", fontSize: compact ? 12 : 15, color: c(t.muted) }}>
                {k.hint}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChartPanel({
  chart,
  theme,
  width,
  height,
  animate,
}: {
  chart: ChartSpecData;
  theme: SlideTheme;
  width: number;
  height: number;
  animate: boolean;
}) {
  const t = THEME_HEX[theme];
  const pad = 22;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 18,
        background: c(t.card),
        border: `1px solid ${c(t.border)}`,
        padding: pad,
      }}
    >
      <ChartView chart={chart} theme={theme} width={innerW} height={innerH} animate={animate} />
    </div>
  );
}

export function ChartView({
  chart,
  theme,
  width,
  height,
  animate = false,
}: {
  chart: ChartSpecData;
  theme: SlideTheme;
  width: number;
  height: number;
  animate?: boolean;
}) {
  const t = THEME_HEX[theme];
  const fmt = (v: number) => formatValue(v, chart.format);
  const fmt2 = (v: number) => formatValue(v, chart.secondaryFormat ?? chart.format);
  const rows = chart.categories.map((cat, i) => {
    const r: Record<string, string | number> = { cat };
    chart.series.forEach((s, si) => (r[`s${si}`] = Number(s.values[i]) || 0));
    return r;
  });
  const axis = { stroke: c(t.muted), fontSize: 14, tickLine: false };
  // Rótulos longos (ex.: Pareto) inclinados para não se sobreporem.
  const longLabels =
    chart.categories.length > 6 && Math.max(...chart.categories.map((x) => x.length), 0) > 8;
  const xAxis = longLabels
    ? { ...axis, fontSize: 12, angle: -28, textAnchor: "end" as const, height: 96, interval: 0 }
    : { ...axis, interval: 0 };
  const grid = <CartesianGrid stroke={c(t.grid)} strokeDasharray="4 4" vertical={false} />;
  const legend = chart.series.length > 1 && (
    <Legend wrapperStyle={{ fontSize: 14, color: c(t.muted), paddingTop: 8 }} iconType="circle" />
  );
  const showValues = chart.showValues ?? chart.categories.length <= 14;
  const labelStyle = { fill: c(t.text), fontSize: 13, fontWeight: 600 };
  const target = chart.target && (
    <ReferenceLine
      y={chart.target.value}
      yAxisId={chart.kind === "combo" ? "left" : undefined}
      stroke={c(TONE_HEX.amber[theme])}
      strokeDasharray="8 6"
      strokeWidth={2}
      label={{
        value: chart.target.label,
        position: "insideTopRight",
        fill: c(TONE_HEX.amber[theme]),
        fontSize: 14,
      }}
    />
  );
  const anim = animate;

  if (chart.kind === "doughnut" || chart.kind === "pie") {
    const s = chart.series[0];
    const total = (s?.values ?? []).reduce((a, b) => a + (Number(b) || 0), 0);
    const data = chart.categories.map((cat, i) => ({
      name: cat,
      value: Number(s?.values[i]) || 0,
    }));
    const color = (i: number) =>
      c(chart.pointColors?.[i] ?? seriesColor({ ...chart, series: [] }, i));
    const size = Math.min(height, width * 0.5);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 36, width, height }}>
        <div style={{ position: "relative", width: size, height: size }}>
          <PieChart width={size} height={size}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={chart.kind === "doughnut" ? size * 0.3 : 0}
              outerRadius={size * 0.46}
              paddingAngle={chart.kind === "doughnut" ? 2 : 0}
              stroke="none"
              isAnimationActive={anim}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={color(i)} />
              ))}
            </Pie>
          </PieChart>
          {chart.kind === "doughnut" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 13, letterSpacing: "0.14em", color: c(t.muted) }}>
                TOTAL
              </span>
              <span style={{ fontFamily: "Sora, Inter", fontSize: 26, fontWeight: 700 }}>
                {fmt(total)}
              </span>
            </div>
          )}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          {data.map((d, i) => (
            <div
              key={d.name}
              style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 18 }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: color(i),
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, color: c(t.text) }}>{d.name}</span>
              <span style={{ fontWeight: 700 }}>{fmt(d.value)}</span>
              <span style={{ width: 70, textAlign: "right", color: c(t.muted) }}>
                {total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (chart.kind === "barH") {
    const longest = Math.max(...chart.categories.map((x) => x.length), 4);
    return (
      <BarChart
        width={width}
        height={height}
        data={rows}
        layout="vertical"
        margin={{ top: 4, right: 120, left: 8, bottom: 4 }}
      >
        <CartesianGrid stroke={c(t.grid)} strokeDasharray="4 4" horizontal={false} />
        <XAxis type="number" {...axis} tickFormatter={fmt} />
        <YAxis type="category" dataKey="cat" {...axis} width={Math.min(260, longest * 9 + 16)} />
        {chart.series.map((s, si) => (
          <Bar
            key={si}
            dataKey={`s${si}`}
            name={s.name}
            fill={c(seriesColor(chart, si))}
            radius={[0, 6, 6, 0]}
            isAnimationActive={anim}
          >
            {chart.pointColors &&
              chart.series.length === 1 &&
              rows.map((_, i) => (
                <Cell key={i} fill={c(chart.pointColors![i] ?? seriesColor(chart, 0))} />
              ))}
            {showValues && (
              <LabelList dataKey={`s${si}`} position="right" formatter={fmt} style={labelStyle} />
            )}
          </Bar>
        ))}
        {legend}
      </BarChart>
    );
  }

  if (chart.kind === "bar" || chart.kind === "stacked") {
    const stacked = chart.kind === "stacked";
    return (
      <BarChart
        width={width}
        height={height}
        data={rows}
        margin={{ top: 26, right: 12, left: 4, bottom: 4 }}
      >
        {grid}
        <XAxis dataKey="cat" {...xAxis} />
        <YAxis {...axis} tickFormatter={fmt} width={84} />
        {chart.series.map((s, si) => (
          <Bar
            key={si}
            dataKey={`s${si}`}
            name={s.name}
            stackId={stacked ? "a" : undefined}
            fill={c(seriesColor(chart, si))}
            radius={stacked ? (si === chart.series.length - 1 ? [6, 6, 0, 0] : 0) : [6, 6, 0, 0]}
            isAnimationActive={anim}
          >
            {chart.pointColors &&
              chart.series.length === 1 &&
              rows.map((_, i) => (
                <Cell key={i} fill={c(chart.pointColors![i] ?? seriesColor(chart, 0))} />
              ))}
            {showValues && !stacked && (
              <LabelList dataKey={`s${si}`} position="top" formatter={fmt} style={labelStyle} />
            )}
          </Bar>
        ))}
        {target}
        {legend}
      </BarChart>
    );
  }

  if (chart.kind === "combo") {
    return (
      <ComposedChart
        width={width}
        height={height}
        data={rows}
        margin={{ top: 26, right: 12, left: 4, bottom: 4 }}
      >
        {grid}
        <XAxis dataKey="cat" {...xAxis} />
        <YAxis yAxisId="left" {...axis} tickFormatter={fmt} width={84} />
        {chart.series.some((s) => s.secondary) && (
          <YAxis yAxisId="right" orientation="right" {...axis} tickFormatter={fmt2} width={70} />
        )}
        {chart.series.map((s, si) =>
          s.type === "line" ? (
            <Line
              key={si}
              yAxisId={s.secondary ? "right" : "left"}
              type="monotone"
              dataKey={`s${si}`}
              name={s.name}
              stroke={c(seriesColor(chart, si))}
              strokeWidth={3.5}
              dot={{ r: 5, fill: c(seriesColor(chart, si)), strokeWidth: 0 }}
              isAnimationActive={anim}
            >
              {showValues && (
                <LabelList
                  dataKey={`s${si}`}
                  position="top"
                  formatter={s.secondary ? fmt2 : fmt}
                  style={labelStyle}
                />
              )}
            </Line>
          ) : (
            <Bar
              key={si}
              yAxisId={s.secondary ? "right" : "left"}
              dataKey={`s${si}`}
              name={s.name}
              fill={c(seriesColor(chart, si))}
              radius={[6, 6, 0, 0]}
              isAnimationActive={anim}
            />
          ),
        )}
        {target}
        {legend}
      </ComposedChart>
    );
  }

  const Chart = chart.kind === "area" ? AreaChart : LineChart;
  return (
    <Chart
      width={width}
      height={height}
      data={rows}
      margin={{ top: 28, right: 24, left: 4, bottom: 4 }}
    >
      {grid}
      <XAxis dataKey="cat" {...xAxis} />
      <YAxis {...axis} tickFormatter={fmt} width={84} />
      {chart.series.map((s, si) =>
        chart.kind === "area" ? (
          <Area
            key={si}
            type="monotone"
            dataKey={`s${si}`}
            name={s.name}
            stroke={c(seriesColor(chart, si))}
            fill={c(seriesColor(chart, si))}
            fillOpacity={0.18}
            strokeWidth={3.5}
            isAnimationActive={anim}
          />
        ) : (
          <Line
            key={si}
            type="monotone"
            dataKey={`s${si}`}
            name={s.name}
            stroke={c(seriesColor(chart, si))}
            strokeWidth={3.5}
            dot={{ r: 5, fill: c(seriesColor(chart, si)), strokeWidth: 0 }}
            isAnimationActive={anim}
          >
            {showValues && chart.series.length === 1 && (
              <LabelList dataKey={`s${si}`} position="top" formatter={fmt} style={labelStyle} />
            )}
          </Line>
        ),
      )}
      {target}
      {legend}
    </Chart>
  );
}

function TableView({
  spec,
  theme,
}: {
  spec: Extract<SlideSpec, { type: "table" }>;
  theme: SlideTheme;
}) {
  const t = THEME_HEX[theme];
  const rows = spec.table.rows.slice(0, 12);
  const fontSize = rows.length > 9 ? 14 : 16;
  return (
    <div style={{ borderRadius: 16, border: `1px solid ${c(t.border)}`, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize }}>
        <thead>
          <tr style={{ background: c(t.primary), color: "#fff" }}>
            {spec.table.columns.map((col) => (
              <th key={col} style={{ textAlign: "left", padding: "12px 14px", fontWeight: 700 }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              style={{
                background: i % 2 ? c(t.card) : c(t.bg),
                borderTop: `1px solid ${c(t.border)}`,
              }}
            >
              {r.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: "9px 14px",
                    fontWeight: j === 0 ? 600 : 400,
                    color: j === 0 ? c(t.text) : c(t.text),
                    maxWidth: 360,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {spec.table.rows.length > rows.length && (
        <div style={{ padding: "8px 14px", fontSize: 13, color: c(t.muted) }}>
          + {spec.table.rows.length - rows.length} linhas não exibidas
        </div>
      )}
    </div>
  );
}

function TextView({ bullets, theme }: { bullets: string[]; theme: SlideTheme }) {
  const t = THEME_HEX[theme];
  const fontSize = bullets.length > 7 ? 20 : 24;
  return (
    <div
      style={{
        height: "100%",
        borderRadius: 18,
        background: c(t.card),
        border: `1px solid ${c(t.border)}`,
        padding: "34px 40px",
        display: "flex",
        flexDirection: "column",
        gap: bullets.length > 7 ? 12 : 18,
      }}
    >
      {bullets.map((b, i) => (
        <div key={i} style={{ display: "flex", gap: 18, fontSize, lineHeight: 1.35 }}>
          <span
            style={{
              marginTop: fontSize * 0.45,
              width: 10,
              height: 10,
              borderRadius: 3,
              background: c(t.primary),
              flexShrink: 0,
            }}
          />
          <span>{b}</span>
        </div>
      ))}
    </div>
  );
}
