// Prévia dos 3 slides da RDM, montada sobre os fundos do modelo oficial com os
// mesmos números e posições do PowerPoint gerado (1 pol = 96 px, slide 1280×720).
import { Bar, BarChart, Cell, Pie, PieChart, ReferenceLine, XAxis, YAxis } from "recharts";
import bg1 from "@/assets/rdm/slide1.jpg";
import bg2 from "@/assets/rdm/slide2.jpg";
import bg3 from "@/assets/rdm/slide3.jpg";
import { SlideFrame } from "@/components/slide-canvas";
import { RDM_META_EFICIENCIA, RDM_META_NC, brl, int, parseDestaques, pct } from "@/lib/rdm";
import { RDM_CORES, RDM_PAINEIS, corEficiencia, type RdmPptxInput } from "@/lib/rdm-pptx";

const P = (pol: number) => pol * 96;
const box = (x: number, y: number, w: number, h: number) =>
  ({ position: "absolute", left: P(x), top: P(y), width: P(w), height: P(h) }) as const;
const FONT = "Calibri, Carlito, 'Segoe UI', Arial, sans-serif";

export function RdmSlide1({ input }: { input: RdmPptxInput }) {
  return (
    <div style={{ width: 1280, height: 720, position: "relative", fontFamily: FONT }}>
      <img
        src={bg1}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      <div style={{ ...box(0.15, 4.24, 9.6, 2.44), color: "#F2F2F2", lineHeight: 1.0 }}>
        <div style={{ fontSize: 50, fontWeight: 700 }}>PRODUTO / QUALIDADE / ENGENHARIA</div>
        <div style={{ fontSize: 42, fontWeight: 700, fontStyle: "italic", marginTop: 4 }}>
          {input.manual.capaSubtitulo || "Co-Manufatura – Nakata"}
        </div>
        <div style={{ fontSize: 42, fontWeight: 700, fontStyle: "italic", marginTop: 48 }}>
          {input.mes.mesLongo}/{input.ano}
        </div>
      </div>
    </div>
  );
}

export function RdmSlide3() {
  return (
    <div style={{ width: 1280, height: 720, position: "relative" }}>
      <img
        src={bg3}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
    </div>
  );
}

function Gauge({ valor, largura }: { valor: number; largura: number }) {
  const v = Math.max(0, Math.min(100, valor));
  const cor = `#${corEficiencia(valor)}`;
  const r = 92;
  const arco = (de: number, ate: number) => {
    const a0 = Math.PI - (de / 100) * Math.PI;
    const a1 = Math.PI - (ate / 100) * Math.PI;
    const p = (a: number) => [118 + Math.cos(a) * r, 118 - Math.sin(a) * r];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
  };
  const ang = Math.PI - (v / 100) * Math.PI;
  return (
    <svg width={largura} height={largura * 0.55} viewBox="0 0 236 130">
      <path d={arco(0, 100)} stroke="#DADDE2" strokeWidth={42} fill="none" />
      {v > 0 && <path d={arco(0, v)} stroke={cor} strokeWidth={42} fill="none" />}
      <line
        x1={118}
        y1={118}
        x2={118 + Math.cos(ang) * 88}
        y2={118 - Math.sin(ang) * 88}
        stroke="#1F1F1F"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <circle cx={118} cy={118} r={9} fill="#1F1F1F" />
    </svg>
  );
}

function Painel({
  g,
  titulo,
  children,
}: {
  g: { x: number; y: number; w: number; h: number };
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        ...box(g.x, g.y, g.w, g.h),
        background: "#F5F6F8",
        border: "1px solid #E3E6EA",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: P(0.14),
          top: P(0.15),
          width: P(0.05),
          height: P(0.2),
          background: "#E30613",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: P(0.24),
          top: P(0.1),
          height: P(0.3),
          display: "flex",
          alignItems: "center",
          fontSize: 14,
          fontWeight: 700,
          color: "#404040",
          letterSpacing: 0.3,
        }}
      >
        {titulo}
      </div>
      {children}
    </div>
  );
}

/** Posição relativa ao painel (polegadas). */
const rel = (x: number, y: number, w: number, h: number) =>
  ({ position: "absolute", left: P(x), top: P(y), width: P(w), height: P(h) }) as const;

export function RdmSlide2({ input }: { input: RdmPptxInput }) {
  const { mes, meses, qld, manual, adequacao: ad } = input;
  const G = RDM_PAINEIS;
  const nc = meses.map((m) => ({ mes: m.mes, v: Number((m.indiceNC ?? 0).toFixed(2)) }));
  const vermelho = { color: "#FF0000", fontWeight: 700, fontStyle: "italic" } as const;
  const pctMd = ad.valor > 0 ? (ad.md.valor / ad.valor) * 100 : 0;
  const secoes = [
    { titulo: "Inspeções de Recebimento", linhas: parseDestaques(manual.comentarios.inspecao) },
    { titulo: "Adequação", linhas: parseDestaques(manual.comentarios.adequacao) },
    { titulo: "QLD - QLDE", linhas: parseDestaques(manual.comentarios.qld) },
  ];
  const total = secoes.reduce((t, s) => t + Math.max(1, s.linhas.length), 0) + 6;
  const fonte = total <= 13 ? 18.5 : total <= 17 ? 16 : 14.5;
  const gEf = G.eficiencia;
  const gw = gEf.w - 0.5;

  return (
    <div
      style={{ width: 1280, height: 720, position: "relative", fontFamily: FONT, color: "#1F1F1F" }}
    >
      <img
        src={bg2}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />

      {/* A — Eficiência */}
      <Painel g={gEf} titulo="EFICIÊNCIA DE INSPEÇÃO">
        <div
          style={{
            ...rel(0.25, 0.5 + gw * 0.04, gw, gw * 0.55),
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Gauge valor={mes.eficiencia ?? 0} largura={P(gw)} />
        </div>
        <div
          style={{
            ...rel(0, 0.5 + gw / 2 + 0.06, gEf.w, 0.5),
            textAlign: "center",
            fontSize: 42,
            fontWeight: 700,
          }}
        >
          {pct(mes.eficiencia, 0)}
        </div>
        <div
          style={{
            ...rel(0.18, gEf.h - 0.72, gEf.w - 0.36, 0.6),
            fontSize: 12,
            fontWeight: 700,
            fontStyle: "italic",
          }}
        >
          {[
            ["Target", `${RDM_META_EFICIENCIA}%`],
            ["Qde Recebida:", int(mes.recebidas)],
            ["Qde Inspecionada:", int(mes.inspecionadas)],
          ].map(([a, b]) => (
            <div
              key={a}
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderBottom: "1.5px dashed #9AA0A6",
                lineHeight: "17px",
              }}
            >
              <span>{a}</span>
              <span>{b}</span>
            </div>
          ))}
        </div>
      </Painel>

      {/* B — Índice NC */}
      <Painel g={G.nc} titulo="ÍNDICE DE NÃO CONFORMIDADE">
        <div style={{ ...rel(0.24, 0.36, G.nc.w - 0.34, 0.18), fontSize: 10.5, color: "#7F7F7F" }}>
          Reprovados ÷ inspeções do mês × 100 · meta ≤ {RDM_META_NC}%
        </div>
        <div style={rel(0.08, 0.55, G.nc.w - 0.16, 1.62)}>
          <BarChart
            width={P(G.nc.w - 0.16)}
            height={P(1.62)}
            data={nc}
            margin={{ top: 16, right: 6, left: 0, bottom: 0 }}
          >
            <XAxis dataKey="mes" fontSize={10} tickLine={false} axisLine={false} stroke="#595959" />
            <YAxis
              fontSize={9}
              width={34}
              tickLine={false}
              axisLine={false}
              stroke="#595959"
              tickFormatter={(v) => `${v}%`}
            />
            <ReferenceLine y={RDM_META_NC} stroke="#404040" strokeDasharray="5 4" />
            <Bar
              dataKey="v"
              fill="#E30613"
              isAnimationActive={false}
              label={{
                position: "top",
                fontSize: 9,
                fill: "#404040",
                formatter: (v: number) =>
                  `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
              }}
            />
          </BarChart>
        </div>
        <table
          style={{
            ...rel(0.13, 2.2, G.nc.w - 0.26, 0.72),
            fontSize: 9,
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <tbody>
            <tr style={{ color: "#595959", fontWeight: 700 }}>
              <td style={{ width: P(0.72) }} />
              {meses.map((m) => (
                <td key={m.mes} style={{ textAlign: "center" }}>
                  {m.mes}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ fontWeight: 700, fontStyle: "italic" }}>Reprovados</td>
              {meses.map((m) => (
                <td key={m.mes} style={{ textAlign: "center" }}>
                  {int(m.reprovadas)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ fontWeight: 700, fontStyle: "italic" }}>Inspecionado</td>
              {meses.map((m) => (
                <td key={m.mes} style={{ textAlign: "center" }}>
                  {int(m.inspecionadas)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ fontWeight: 700, fontStyle: "italic" }}>Índice NC</td>
              {meses.map((m) => (
                <td
                  key={m.mes}
                  style={{
                    textAlign: "center",
                    color: (m.indiceNC ?? 0) <= RDM_META_NC ? "#00A651" : "#E30613",
                  }}
                >
                  {pct(m.indiceNC, 2)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </Painel>

      {/* C — Adequação */}
      <Painel g={G.adequacao} titulo="ADEQUAÇÃO DE PRODUTOS">
        {(() => {
          const dw = G.adequacao.w - 0.6;
          const tem = ad.pecas > 0;
          return (
            <>
              <div style={rel(0.3, 0.45, dw, dw)}>
                <PieChart width={P(dw)} height={P(dw)}>
                  <Pie
                    data={
                      tem
                        ? [
                            { v: ad.md.valor || ad.md.pecas },
                            { v: ad.avaria.valor || ad.avaria.pecas },
                          ]
                        : [{ v: 1 }]
                    }
                    dataKey="v"
                    innerRadius={P(dw) * 0.34}
                    outerRadius={P(dw) * 0.5}
                    startAngle={90}
                    endAngle={-270}
                    stroke="#F5F6F8"
                    isAnimationActive={false}
                  >
                    <Cell fill={tem ? `#${RDM_CORES.md}` : "#DADDE2"} />
                    <Cell fill={`#${RDM_CORES.avaria}`} />
                  </Pie>
                </PieChart>
              </div>
              <div
                style={{
                  ...rel(0.3 + dw * 0.18, 0.45 + dw * 0.3, dw * 0.64, dw * 0.4),
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: 13.5,
                  lineHeight: 1.2,
                  ...vermelho,
                }}
              >
                <span>{int(ad.pecas)} peças</span>
                <span>{brl(ad.valor)}</span>
                <span>{int(ad.skus)} SKU's</span>
              </div>
              <div
                style={{
                  ...rel(0.3, G.adequacao.h - 0.36, G.adequacao.w - 0.4, 0.22),
                  display: "flex",
                  gap: 18,
                  fontSize: 11,
                  color: "#404040",
                  alignItems: "center",
                }}
              >
                <span>
                  <span style={{ color: `#${RDM_CORES.md}` }}>●</span> MD {tem ? pct(pctMd, 0) : ""}
                </span>
                <span>
                  <span style={{ color: `#${RDM_CORES.avaria}` }}>●</span> AVARIA CD{" "}
                  {tem ? pct(100 - pctMd, 0) : ""}
                </span>
              </div>
            </>
          );
        })()}
      </Painel>

      {/* D — QLD / QLDE */}
      <Painel g={G.qld} titulo="QLD / QLDE · EXPOSIÇÃO">
        <div style={rel(0.15, 0.5, 2.05, 2.05)}>
          <PieChart width={P(2.05)} height={P(2.05)}>
            <Pie
              data={[{ v: qld.qldValor || 0.0001 }, { v: qld.qldeValor || 0.0001 }]}
              dataKey="v"
              innerRadius={P(2.05) * 0.35}
              outerRadius={P(2.05) * 0.5}
              startAngle={90}
              endAngle={-270}
              stroke="#F5F6F8"
              isAnimationActive={false}
            >
              <Cell fill={`#${RDM_CORES.qld}`} />
              <Cell fill={`#${RDM_CORES.qlde}`} />
            </Pie>
          </PieChart>
        </div>
        <div style={{ ...rel(0.45, 0.5 + 1.025 - 0.27, 1.45, 0.54), textAlign: "center" }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#7F7F7F" }}>EXPOSIÇÃO</div>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{brl(qld.totalValor)}</div>
        </div>
        {[
          {
            y: 0.55,
            rot: "QLD · 522",
            cor: `#${RDM_CORES.qld}`,
            v: qld.qldValor,
            skus: qld.qldSkus,
          },
          {
            y: 1.68,
            rot: "QLDE · 523",
            cor: `#${RDM_CORES.qlde}`,
            v: qld.qldeValor,
            skus: qld.qldeSkus,
          },
        ].map((c) => (
          <div
            key={c.rot}
            style={{
              ...rel(2.3, c.y, G.qld.w - 2.45, 1.0),
              background: "#FFFFFF",
              border: "1px solid #E3E6EA",
              borderRadius: 8,
              paddingLeft: 14,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 0,
                top: 13,
                bottom: 13,
                width: 5,
                background: c.cor,
              }}
            />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: c.cor }}>{c.rot}</span>
            <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>
              {pct(qld.totalValor > 0 ? (c.v / qld.totalValor) * 100 : 0)}
            </span>
            <span style={{ fontSize: 10.5, color: "#595959" }}>{brl(c.v)}</span>
            <span style={{ fontSize: 10, color: "#7F7F7F" }}>{int(c.skus)} SKUs</span>
          </div>
        ))}
      </Painel>

      {/* Painel da direita: só as observações */}
      <div style={{ ...box(7.17, 1.5, 5.97, 5.45), fontSize: fonte, lineHeight: 1.25 }}>
        {secoes.map((s, i) => (
          <div key={s.titulo} style={{ marginTop: i ? 12 : 0 }}>
            <div style={{ textAlign: "center", fontWeight: 700, margin: "4px 0" }}>{s.titulo}</div>
            <ul style={{ paddingLeft: 26, listStyle: "disc" }}>
              {s.linhas.map((partes, j) => (
                <li key={j} style={{ marginBottom: 2 }}>
                  {partes.map((p, k) => (
                    <span key={k} style={p.destaque ? vermelho : undefined}>
                      {p.texto}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RdmPreview({ input, slide }: { input: RdmPptxInput; slide: 1 | 2 | 3 }) {
  return (
    <SlideFrame className="overflow-hidden rounded-xl border shadow-lg">
      {slide === 1 ? (
        <RdmSlide1 input={input} />
      ) : slide === 2 ? (
        <RdmSlide2 input={input} />
      ) : (
        <RdmSlide3 />
      )}
    </SlideFrame>
  );
}
