import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard-ui";
import { PresentationSelectable } from "@/components/presentation-selectable";
import {
  Activity,
  BadgeCheck,
  Boxes,
  BrainCircuit,
  CircleX,
  Gauge,
  PackageSearch,
  Printer,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useDashboard } from "@/hooks/use-data";
import { useFilteredData, useFilters } from "@/hooks/use-dashboard";
import { calcPPM } from "@/lib/idf-calc";

export const Route = createFileRoute("/reuniao")({
  component: ReuniaoMensalPage,
});

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numero = new Intl.NumberFormat("pt-BR");

const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseDate(value: unknown): Date | null {
  const raw = String(value ?? "").trim();

  if (!raw) return null;

  // dd/mm/yyyy
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);

  if (br) {
    const d = Number(br[1]);
    const m = Number(br[2]) - 1;
    const y = Number(br[3]);

    const date = new Date(y, m, d);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  // yyyy-mm-dd / ISO
  const iso = new Date(raw);

  return Number.isNaN(iso.getTime()) ? null : iso;
}

function getCreationDate(row: any) {
  return parseDate(
    row.dataCriacao ??
      row.data_criacao ??
      row.dataRecebimento ??
      row.data ??
      row.createdAt,
  );
}

function getInspectionDate(row: any) {
  return parseDate(
    row.dataInicioInsp ??
      row.dataInicioInspecao ??
      row.data_inspecao ??
      row.dataInspecao ??
      row.dataCriacao ??
      row.data,
  );
}

function getItem(row: any) {
  return String(
    row.item ??
      row.codigo ??
      row.material ??
      row.sku ??
      row.codigoItem ??
      "",
  ).trim();
}

function getSupplier(row: any) {
  return String(
    row.fornecedor ??
      row.nomeFornecedor ??
      row.supplier ??
      row.vendor ??
      "Não informado",
  ).trim();
}

function getProblem(row: any) {
  const candidates = [
    row.problema,
    row.naoConformidade,
    row.nao_conformidade,
    row.descricaoNC,
    row.descricaoNc,
    row.motivo,
    row.defeito,
    row.observacao,
    row.descricao,
  ];

  const value = candidates.find((candidate) => String(candidate ?? "").trim());

  return String(value ?? "Não informado").trim();
}

function isRejected(row: any) {
  return normalize(row.status).includes("reprov");
}

function isConditional(row: any) {
  return normalize(row.status).includes("condicional");
}

function isApproved(row: any) {
  const status = normalize(row.status);

  return (
    status.includes("aprovado") &&
    !status.includes("condicional") &&
    !status.includes("reprov")
  );
}

function ReuniaoMensalPage() {
  const data = useDashboard();
  const { filters } = useFilters();
const filtered = useFilteredData(data!);

  const [ncMode, setNcMode] = useState<"inspecoes" | "sku">("inspecoes");

  if (!data) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Activity className="h-7 w-7 animate-pulse text-primary" />
          <span className="text-sm">Preparando reunião mensal...</span>
        </div>
      </div>
    );
  }

  // IDF/Alertas/RNC respeitam os filtros globais do QualiHub.
  // QLD/QLDE permanece como fotografia atual, pois não há data de referência
  // definida no filtro global para essa base.
  const idf = filtered.idf ?? [];
  const qldQlde = data.qldQlde ?? [];

  const alertas = filtered.alerta?.length ?? 0;
  const rncs = filtered.rnc?.length ?? 0;

  const periodoLabel = useMemo(() => {
    const formatDate = (value: string) => {
      if (!value) return "";
      const [year, month, day] = value.split("-").map(Number);
      if (!year || !month || !day) return value;
      return new Date(year, month - 1, day).toLocaleDateString("pt-BR");
    };

    if (filters.from && filters.to) {
      return `${formatDate(filters.from)} a ${formatDate(filters.to)}`;
    }
    if (filters.from) return `A partir de ${formatDate(filters.from)}`;
    if (filters.to) return `Até ${formatDate(filters.to)}`;
    return "Todos os períodos";
  }, [filters.from, filters.to]);

  const hasDateFilter = Boolean(filters.from || filters.to);

  /* ======================================================
     INDICADORES PRINCIPAIS
     ====================================================== */

  const totalInspecoes = idf.length;

  const aprovados = idf.filter(isApproved).length;
  const condicionais = idf.filter(isConditional).length;
  const reprovados = idf.filter(isRejected).length;

  const inspecionados = aprovados + condicionais + reprovados;

  const eficiencia =
    totalInspecoes > 0 ? (inspecionados / totalInspecoes) * 100 : 0;

  const { ppm } = calcPPM(idf);

  /* ======================================================
     QLD / QLDE
     ====================================================== */

  const qld = qldQlde.filter(
    (row: any) => String(row.deposito).trim() === "522",
  );

  const qlde = qldQlde.filter(
    (row: any) => String(row.deposito).trim() === "523",
  );

  const valorQLD = qld.reduce(
    (total: number, row: any) => total + Number(row.valorLivre || 0),
    0,
  );

  const valorQLDE = qlde.reduce(
    (total: number, row: any) => total + Number(row.valorBloqueado || 0),
    0,
  );

  const quantidadeQLD = qld.reduce(
    (total: number, row: any) => total + Number(row.qtdeLivre || 0),
    0,
  );

  const quantidadeQLDE = qlde.reduce(
    (total: number, row: any) => total + Number(row.qtdeBloqueada || 0),
    0,
  );

  const exposicaoTotal = valorQLD + valorQLDE;
  const quantidadeTotal = quantidadeQLD + quantidadeQLDE;


  /* ======================================================
     ANO DE REFERÊNCIA
     ====================================================== */

  const anosDisponiveis = idf
    .map((row: any) => getInspectionDate(row)?.getFullYear())
    .filter((value): value is number => Boolean(value));

  const anoReferencia =
    anosDisponiveis.length > 0
      ? Math.max(...anosDisponiveis)
      : new Date().getFullYear();

  const mesesVisiveis = useMemo(() => {
    if (!hasDateFilter) return null;

    const months = new Set<number>();
    for (const row of idf) {
      const date = getInspectionDate(row);
      if (date && date.getFullYear() === anoReferencia) months.add(date.getMonth());
    }

    return months;
  }, [idf, anoReferencia, hasDateFilter]);

  /* ======================================================
     EVOLUÇÃO PPM
     ====================================================== */

  const ppmMensal = useMemo(() => {
    return MESES.map((mes, index) => {
      const rows = idf.filter((row: any) => {
        const date = getInspectionDate(row);

        return (
          date &&
          date.getFullYear() === anoReferencia &&
          date.getMonth() === index
        );
      });

      const resultado = calcPPM(rows);

      return {
        mes,
        ppm: Number(resultado.ppm || 0),
      };
    }).filter((_, index) => !mesesVisiveis || mesesVisiveis.has(index));
  }, [idf, anoReferencia, mesesVisiveis]);

  /* ======================================================
     EFICIÊNCIA MENSAL
     RECEBIDAS X INSPECIONADAS
     ====================================================== */

  const eficienciaMensal = useMemo(() => {
    return MESES.map((mes, index) => {
      const recebidas = idf.filter((row: any) => {
        const date = getCreationDate(row);

        return (
          date &&
          date.getFullYear() === anoReferencia &&
          date.getMonth() === index
        );
      }).length;

      const inspecionadasMes = idf.filter((row: any) => {
        const date = getInspectionDate(row);

        return (
          date &&
          date.getFullYear() === anoReferencia &&
          date.getMonth() === index
        );
      }).length;

      const eficienciaMes =
        recebidas > 0 ? (inspecionadasMes / recebidas) * 100 : 0;

      return {
        mes,
        recebidas,
        inspecionadas: inspecionadasMes,
        eficiencia: Number(eficienciaMes.toFixed(1)),
      };
    }).filter((_, index) => !mesesVisiveis || mesesVisiveis.has(index));
  }, [idf, anoReferencia, mesesVisiveis]);

  /* ======================================================
     ÍNDICE NC
     ====================================================== */

  const indiceNCMensal = useMemo(() => {
    return MESES.map((mes, index) => {
      const rows = idf.filter((row: any) => {
        const date = getInspectionDate(row);

        return (
          date &&
          date.getFullYear() === anoReferencia &&
          date.getMonth() === index
        );
      });

      if (ncMode === "inspecoes") {
        const inspecionadasMes = rows.length;
        const reprovadasMes = rows.filter(isRejected).length;

        return {
          mes,
          indice:
            inspecionadasMes > 0
              ? Number(((reprovadasMes / inspecionadasMes) * 100).toFixed(2))
              : 0,
        };
      }

      const skusInspecionados = new Set(
        rows.map(getItem).filter(Boolean),
      );

      const skusReprovados = new Set(
        rows.filter(isRejected).map(getItem).filter(Boolean),
      );

      return {
        mes,
        indice:
          skusInspecionados.size > 0
            ? Number(
                (
                  (skusReprovados.size / skusInspecionados.size) *
                  100
                ).toFixed(2),
              )
            : 0,
      };
    }).filter((_, index) => !mesesVisiveis || mesesVisiveis.has(index));
  }, [idf, anoReferencia, ncMode, mesesVisiveis]);

  /* ======================================================
     PARETO
     ====================================================== */

  const pareto = useMemo(() => {
    const map = new Map<string, number>();

    idf
      .filter(isRejected)
      .forEach((row: any) => {
        const problema = getProblem(row);

        map.set(problema, (map.get(problema) ?? 0) + 1);
      });

    const ordenado = Array.from(map.entries())
      .map(([problema, ocorrencias]) => ({
        problema,
        ocorrencias,
      }))
      .sort((a, b) => b.ocorrencias - a.ocorrencias)
      .slice(0, 10);

    const total = ordenado.reduce(
      (sum, item) => sum + item.ocorrencias,
      0,
    );

    let acumulado = 0;

    return ordenado.map((item) => {
      acumulado += item.ocorrencias;

      return {
        ...item,
        nome:
          item.problema.length > 24
            ? `${item.problema.slice(0, 24)}…`
            : item.problema,
        acumulado:
          total > 0
            ? Number(((acumulado / total) * 100).toFixed(1))
            : 0,
      };
    });
  }, [idf]);

  /* ======================================================
     RANKING FORNECEDORES
     ====================================================== */

  const ranking = useMemo(() => {
    const map = new Map<
      string,
      {
        fornecedor: string;
        total: number;
        aprovados: number;
        reprovados: number;
      }
    >();

    idf.forEach((row: any) => {
      const fornecedor = getSupplier(row);

      if (!fornecedor || fornecedor === "Não informado") return;

      const current = map.get(fornecedor) ?? {
        fornecedor,
        total: 0,
        aprovados: 0,
        reprovados: 0,
      };

      current.total += 1;

      if (isApproved(row)) current.aprovados += 1;
      if (isRejected(row)) current.reprovados += 1;

      map.set(fornecedor, current);
    });

    return Array.from(map.values())
      .filter((item) => item.total > 0)
      .map((item) => ({
        ...item,
        indiceNC: (item.reprovados / item.total) * 100,
        aprovacao: (item.aprovados / item.total) * 100,
      }));
  }, [idf]);

  const melhores = [...ranking]
    .sort((a, b) => {
      if (a.indiceNC !== b.indiceNC) return a.indiceNC - b.indiceNC;
      return b.total - a.total;
    })
    .slice(0, 5);

  const criticos = [...ranking]
    .filter((item) => item.reprovados > 0)
    .sort((a, b) => {
      if (b.indiceNC !== a.indiceNC) return b.indiceNC - a.indiceNC;
      return b.reprovados - a.reprovados;
    })
    .slice(0, 5);

  const maiorProblema = pareto[0];

  /* ======================================================
     LEITURA EXECUTIVA
     ====================================================== */

  const leituraExecutiva = [
    eficiencia >= 95
      ? `A eficiência consolidada está em ${eficiencia.toFixed(
          1,
        )}%, acima da meta operacional de 95%.`
      : `A eficiência consolidada está em ${eficiencia.toFixed(
          1,
        )}%, abaixo da meta operacional de 95% e requer acompanhamento.`,

    `Foram identificadas ${numero.format(
      reprovados,
    )} inspeções reprovadas no período analisado.`,

    maiorProblema
      ? `O principal motivo no Pareto é "${maiorProblema.problema}", com ${numero.format(
          maiorProblema.ocorrencias,
        )} ocorrência(s).`
      : "Não há ocorrências suficientes para formação do Pareto.",

    `A exposição financeira atual de QLD + QLDE é ${moeda.format(
      exposicaoTotal,
    )}, envolvendo ${numero.format(quantidadeTotal)} peças.`,

    criticos[0]
      ? `O fornecedor com maior índice de NC no ranking atual é ${criticos[0].fornecedor}, com ${criticos[0].indiceNC.toFixed(
          1,
        )}%.`
      : "Não há fornecedor crítico identificado no recorte atual.",
  ];

  const handlePrintReport = () => {
    const source = document.querySelector(
      ".meeting-screen-report",
    ) as HTMLElement | null;

    if (!source) {
      alert("Não foi possível localizar o relatório.");
      return;
    }

    const clone = source.cloneNode(true) as HTMLElement;

    clone.querySelectorAll("button").forEach((button) => button.remove());
    clone.querySelectorAll(".no-print").forEach((el) => el.remove());

    clone.querySelectorAll("svg").forEach((svg) => {
      svg.setAttribute("width", "100%");
      svg.style.width = "100%";
      svg.style.overflow = "visible";
    });

    const presentationWindow = window.open(
      "",
      "_blank",
      "width=1600,height=950,left=30,top=20",
    );

    if (!presentationWindow) {
      alert("O navegador bloqueou a janela. Libere pop-ups para este site.");
      return;
    }

    const headAssets = Array.from(
      document.head.querySelectorAll('link[rel="stylesheet"], style'),
    )
      .map((node) => node.outerHTML)
      .join("\n");

    const dataAtualizacao = new Date().toLocaleDateString("pt-BR");

    /*
      O conteúdo principal da Reunião Mensal possui 6 blocos:
      1 KPIs
      2 PPM + NC
      3 Eficiência
      4 Pareto
      5 Ranking
      6 QLD/QLDE
      7 QualiAI

      Na apresentação, QLD/QLDE + QualiAI ficam juntos no último slide.
    */
    const contentRoot = clone.querySelector(".space-y-6.p-4") as HTMLElement | null;
    const blocks = contentRoot ? Array.from(contentRoot.children) : [];

    const slideGroups: HTMLElement[][] = [
      blocks.slice(0, 1) as HTMLElement[],
      blocks.slice(1, 2) as HTMLElement[],
      blocks.slice(2, 3) as HTMLElement[],
      blocks.slice(3, 4) as HTMLElement[],
      blocks.slice(4, 5) as HTMLElement[],
      blocks.slice(5, 7) as HTMLElement[],
    ].filter((group) => group.length > 0);

    const slideTitles = [
      "Resumo Executivo",
      "PPM e Não Conformidade",
      "Eficiência das Inspeções",
      "Pareto das Não Conformidades",
      "Desempenho de Fornecedores",
      "QLD / QLDE e Leitura Executiva",
    ];

    const slidesHtml = slideGroups
      .map(
        (group, index) => `
          <section class="presentation-slide${index === 0 ? " is-active" : ""}" data-slide="${index}">
            <div class="slide-heading">
              <div>
                <div class="slide-kicker">REUNIÃO MENSAL · ${String(index + 1).padStart(2, "0")}</div>
                <h2>${slideTitles[index] ?? `Página ${index + 1}`}</h2>
              </div>
              <div class="slide-counter">${index + 1} / ${slideGroups.length}</div>
            </div>
            <div class="slide-body">
              ${group.map((node) => node.outerHTML).join("\n")}
            </div>
          </section>
        `,
      )
      .join("\n");

    presentationWindow.document.open();
    presentationWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Reunião Mensal — QualiHub</title>
          ${headAssets}
          <style>
            :root {
              --presentation-red: #ef2b2d;
              --presentation-ink: #0f172a;
              --presentation-muted: #64748b;
              --presentation-line: #e2e8f0;
              --presentation-bg: #f4f6f8;
            }

            * { box-sizing: border-box; }

            html, body {
              margin: 0 !important;
              min-height: 100%;
              background: var(--presentation-bg) !important;
              color: var(--presentation-ink) !important;
              font-family: Inter, Arial, sans-serif !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            body { overflow: hidden; }

            .presentation-toolbar {
              height: 58px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 18px;
              padding: 0 22px;
              background: #111827;
              color: #fff;
              border-bottom: 1px solid rgba(255,255,255,.08);
              position: fixed;
              inset: 0 0 auto 0;
              z-index: 1000;
            }

            .toolbar-brand {
              min-width: 0;
              display: flex;
              align-items: center;
              gap: 12px;
            }

            .brand-mark {
              width: 10px;
              height: 28px;
              border-radius: 999px;
              background: var(--presentation-red);
              box-shadow: 0 0 22px rgba(239,43,45,.55);
            }

            .toolbar-title {
              font-size: 13px;
              font-weight: 800;
              letter-spacing: .01em;
            }

            .toolbar-subtitle {
              margin-top: 2px;
              font-size: 9px;
              color: #94a3b8;
            }

            .toolbar-actions {
              display: flex;
              align-items: center;
              gap: 7px;
            }

            .toolbar-button {
              appearance: none;
              border: 1px solid rgba(255,255,255,.14);
              background: rgba(255,255,255,.07);
              color: #fff;
              border-radius: 9px;
              min-height: 34px;
              padding: 0 12px;
              font: inherit;
              font-size: 11px;
              font-weight: 700;
              cursor: pointer;
              transition: .18s ease;
            }

            .toolbar-button:hover {
              background: rgba(255,255,255,.13);
              transform: translateY(-1px);
            }

            .toolbar-button.primary {
              border-color: rgba(239,43,45,.55);
              background: #ef2b2d;
            }

            .presentation-stage {
              position: fixed;
              inset: 58px 0 0;
              display: grid;
              place-items: center;
              padding: 18px;
              overflow: hidden;
              background:
                radial-gradient(circle at 12% 0%, rgba(239,43,45,.08), transparent 27%),
                linear-gradient(180deg, #eef1f5, #f8fafc);
            }

            .presentation-slide {
              display: none;
              width: min(1500px, calc(100vw - 36px));
              height: min(820px, calc(100vh - 94px));
              overflow: hidden;
              background: #fff;
              border: 1px solid #dfe4ea;
              border-radius: 18px;
              box-shadow: 0 24px 70px rgba(15,23,42,.15);
              padding: 22px 28px 24px;
            }

            .presentation-slide.is-active {
              display: flex;
              flex-direction: column;
              animation: slideIn .22s ease-out;
            }

            @keyframes slideIn {
              from { opacity: 0; transform: translateY(7px) scale(.995); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }

            .slide-heading {
              flex: 0 0 auto;
              display: flex;
              align-items: flex-end;
              justify-content: space-between;
              gap: 18px;
              padding-bottom: 12px;
              margin-bottom: 14px;
              border-bottom: 3px solid var(--presentation-red);
            }

            .slide-kicker {
              font-size: 9px;
              font-weight: 900;
              letter-spacing: .18em;
              color: var(--presentation-red);
            }

            .slide-heading h2 {
              margin: 4px 0 0 !important;
              font-size: 22px !important;
              line-height: 1.05 !important;
              font-weight: 850 !important;
              color: var(--presentation-ink) !important;
            }

            .slide-counter {
              border: 1px solid #e2e8f0;
              border-radius: 999px;
              padding: 6px 10px;
              font-size: 10px;
              font-weight: 800;
              color: var(--presentation-muted);
              background: #f8fafc;
            }

            .slide-body {
              flex: 1 1 auto;
              min-height: 0;
              overflow: hidden;
            }

            .slide-body > * {
              height: 100%;
            }

            .slide-body .recharts-responsive-container {
              max-height: 100% !important;
            }

            .slide-body [data-chart-title] {
              height: 100%;
            }

            /* Gráficos lado a lado ocupam o slide inteiro. */
            .slide-body > .grid {
              height: 100%;
              align-items: stretch;
            }

            /* Eficiência e Pareto: usa melhor a área vertical. */
            .presentation-slide[data-slide="2"] .recharts-responsive-container,
            .presentation-slide[data-slide="3"] .recharts-responsive-container {
              height: 560px !important;
            }

            /* Ranking. */
            .presentation-slide[data-slide="4"] .grid {
              height: auto;
            }

            /* QLD/QLDE + QualiAI: empilha de forma compacta. */
            .presentation-slide[data-slide="5"] .slide-body {
              display: grid;
              grid-template-rows: auto 1fr;
              gap: 14px;
              overflow: auto;
              scrollbar-width: thin;
            }

            .presentation-slide[data-slide="5"] .slide-body > * {
              height: auto;
            }

            .presentation-footer {
              position: fixed;
              right: 24px;
              bottom: 7px;
              z-index: 1001;
              font-size: 9px;
              color: #64748b;
            }

            .keyboard-tip {
              font-size: 9px;
              color: #94a3b8;
              white-space: nowrap;
            }

            /* ===== Impressão / PDF ===== */
            @page {
              size: A4 landscape;
              margin: 8mm;
            }

            @media print {
              html, body {
                background: #fff !important;
                overflow: visible !important;
              }

              .presentation-toolbar,
              .presentation-footer {
                display: none !important;
              }

              .presentation-stage {
                position: static !important;
                display: block !important;
                padding: 0 !important;
                background: #fff !important;
                overflow: visible !important;
              }

              .presentation-slide,
              .presentation-slide.is-active {
                display: flex !important;
                width: 100% !important;
                height: 190mm !important;
                min-height: 190mm !important;
                max-height: 190mm !important;
                margin: 0 !important;
                padding: 7mm 8mm !important;
                border: 0 !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                overflow: hidden !important;
                break-after: page !important;
                page-break-after: always !important;
                animation: none !important;
              }

              .presentation-slide:last-child {
                break-after: auto !important;
                page-break-after: auto !important;
              }

              .slide-heading {
                margin-bottom: 4mm !important;
                padding-bottom: 3mm !important;
              }

              .slide-heading h2 {
                font-size: 17px !important;
              }

              .slide-body {
                overflow: hidden !important;
              }

              .presentation-slide[data-slide="2"] .recharts-responsive-container,
              .presentation-slide[data-slide="3"] .recharts-responsive-container {
                height: 135mm !important;
              }

              * {
                animation: none !important;
                transition: none !important;
              }
            }
          </style>
        </head>

        <body>
          <header class="presentation-toolbar">
            <div class="toolbar-brand">
              <span class="brand-mark"></span>
              <div>
                <div class="toolbar-title">Reunião Mensal · QualiHub</div>
                <div class="toolbar-subtitle">
                  Frasle Mobility · Ano-base ${anoReferencia} · Atualizado em ${dataAtualizacao}
                </div>
              </div>
            </div>

            <div class="toolbar-actions">
              <span class="keyboard-tip">← → navegar · F tela cheia</span>
              <button class="toolbar-button" id="prevSlide" type="button">← Anterior</button>
              <button class="toolbar-button" id="nextSlide" type="button">Próximo →</button>
              <button class="toolbar-button" id="fullscreen" type="button">Tela cheia</button>
              <button class="toolbar-button primary" id="printReport" type="button">Imprimir / PDF</button>
              <button class="toolbar-button" id="closePresentation" type="button">Fechar</button>
            </div>
          </header>

          <main class="presentation-stage">
            ${slidesHtml}
          </main>

          <div class="presentation-footer">
            Frasle Mobility · Gestão da Qualidade de Fornecedores
          </div>

          <script>
            (function () {
              var slides = Array.from(document.querySelectorAll(".presentation-slide"));
              var current = 0;

              function showSlide(index) {
                if (!slides.length) return;
                current = (index + slides.length) % slides.length;
                slides.forEach(function (slide, i) {
                  slide.classList.toggle("is-active", i === current);
                });
              }

              function next() { showSlide(current + 1); }
              function prev() { showSlide(current - 1); }

              document.getElementById("nextSlide").addEventListener("click", next);
              document.getElementById("prevSlide").addEventListener("click", prev);

              document.getElementById("printReport").addEventListener("click", function () {
                window.print();
              });

              document.getElementById("closePresentation").addEventListener("click", function () {
                window.close();
              });

              document.getElementById("fullscreen").addEventListener("click", function () {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(function () {});
                } else {
                  document.exitFullscreen().catch(function () {});
                }
              });

              document.addEventListener("keydown", function (event) {
                if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
                  event.preventDefault();
                  next();
                }

                if (event.key === "ArrowLeft" || event.key === "PageUp") {
                  event.preventDefault();
                  prev();
                }

                if (event.key.toLowerCase() === "f") {
                  if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(function () {});
                  } else {
                    document.exitFullscreen().catch(function () {});
                  }
                }

                if (event.key === "Escape" && !document.fullscreenElement) {
                  // Escape sai do fullscreen normalmente; fora dele, não fecha para evitar acidente.
                }
              });

              showSlide(0);
              window.focus();
            })();
          <\/script>
        </body>
      </html>
    `);

    presentationWindow.document.close();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ==================================================
          HERO
          ================================================== */}

      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/10 p-6 shadow-lg">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/4 h-52 w-96 rounded-full bg-destructive/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              <TrendingUp className="h-4 w-4" />
              Gestão da Qualidade de Fornecedores
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight">
              Reunião Mensal
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Cockpit executivo da Qualidade para análise de desempenho,
              riscos, fornecedores e exposição financeira.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-border bg-background/50 px-3 py-1 text-[11px] text-muted-foreground">
                Ano-base {anoReferencia}
              </span>

              <span className="rounded-full border border-success/25 bg-success/10 px-3 py-1 text-[11px] text-success">
                Dados sincronizados
              </span>
            </div>
          </div>

          <div className="grid min-w-[310px] grid-cols-2 gap-3">
            <HeroMetric
              label="Alertas AQ"
              value={numero.format(alertas)}
              icon={<ShieldCheck className="h-4 w-4" />}
            />

            <HeroMetric
              label="RNCs"
              value={numero.format(rncs)}
              icon={<CircleX className="h-4 w-4" />}
            />
          </div>
        </div>
      </section>

      {/* ==================================================
          FOLHA EXECUTIVA / IMPRESSÃO
          ================================================== */}

      <div className="meeting-screen-report overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <div className="text-sm font-semibold">Resumo Executivo — Reunião Mensal</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              Painel executivo completo para análise e apresentação
            </div>
          </div>

          <button
            type="button"
onClick={handlePrintReport}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted"
          >
            <Printer className="h-4 w-4" />
            Apresentar relatório
          </button>
        </div>

        <div className="space-y-6 p-4">
          {/* KPIs */}
          <PresentationSelectable
            item={{
              id: "reuniao-kpis-executivos",
              title: "Indicadores Executivos",
              subtitle: hasDateFilter ? `Período: ${periodoLabel}` : "Visão consolidada dos principais indicadores da Qualidade",
              type: "kpi-group",
              sourceRoute: "/reuniao",
              data: {
                layout: "executive-kpis",
                periodo: periodoLabel,
                anoReferencia,
                cards: [
                  {
                    key: "ppm",
                    label: "PPM",
                    value: numero.format(ppm),
                    rawValue: ppm,
                    description: "Partes por milhão",
                    tone: "red",
                    icon: "gauge",
                  },
                  {
                    key: "inspecoes",
                    label: "Inspeções",
                    value: numero.format(totalInspecoes),
                    rawValue: totalInspecoes,
                    description: "Registros recebidos",
                    tone: "blue",
                    icon: "package",
                  },
                  {
                    key: "aprovados",
                    label: "Aprovados",
                    value: numero.format(aprovados),
                    rawValue: aprovados,
                    description: "Inspeções aprovadas",
                    tone: "green",
                    icon: "check",
                  },
                  {
                    key: "reprovados",
                    label: "Reprovados",
                    value: numero.format(reprovados),
                    rawValue: reprovados,
                    description: "Não conformidades",
                    tone: "red",
                    icon: "x",
                  },
                  {
                    key: "eficiencia",
                    label: "Eficiência",
                    value: `${eficiencia.toFixed(1)}%`,
                    rawValue: eficiencia,
                    description: `${numero.format(inspecionados)} inspecionadas`,
                    tone: eficiencia >= 95 ? "green" : "amber",
                    icon: "activity",
                  },
                  {
                    key: "qld-qlde",
                    label: "QLD + QLDE",
                    value: moeda.format(exposicaoTotal),
                    rawValue: exposicaoTotal,
                    description: `${numero.format(quantidadeTotal)} peças`,
                    tone: "purple",
                    icon: "boxes",
                  },
                ],
                condicionais,
                alertas,
                rncs,
              },
            }}
          >

          <div>
            <SectionHeading
              eyebrow="Visão geral"
              title="Indicadores executivos"
              description="Consolidado dos principais indicadores da operação"
            />

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <ExecutiveCard
                label="PPM"
                value={numero.format(ppm)}
                description="Partes por milhão"
                icon={<Gauge className="h-5 w-5" />}
                tone="red"
              />

              <ExecutiveCard
                label="Inspeções"
                value={numero.format(totalInspecoes)}
                description="Registros recebidos"
                icon={<PackageSearch className="h-5 w-5" />}
                tone="blue"
              />

              <ExecutiveCard
                label="Aprovados"
                value={numero.format(aprovados)}
                description="Inspeções aprovadas"
                icon={<BadgeCheck className="h-5 w-5" />}
                tone="green"
              />

              <ExecutiveCard
                label="Reprovados"
                value={numero.format(reprovados)}
                description="Não conformidades"
                icon={<CircleX className="h-5 w-5" />}
                tone="red"
              />

              <ExecutiveCard
                label="Eficiência"
                value={`${eficiencia.toFixed(1)}%`}
                description={`${numero.format(inspecionados)} inspecionadas`}
                icon={<Activity className="h-5 w-5" />}
                tone={eficiencia >= 95 ? "green" : "amber"}
              />

              <ExecutiveCard
                label="QLD + QLDE"
                value={moeda.format(exposicaoTotal)}
                description={`${numero.format(quantidadeTotal)} peças`}
                icon={<Boxes className="h-5 w-5" />}
                tone="purple"
              />
            </div>
          </div>


          </PresentationSelectable>          {/* PPM + NC */}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <PresentationSelectable
              item={{
                id: "reuniao-evolucao-ppm",
                title: "Evolução Mensal do PPM",
                subtitle: hasDateFilter ? `Período: ${periodoLabel}` : `Comportamento do PPM em ${anoReferencia}`,
                type: "chart",
                sourceRoute: "/reuniao",
                data: { periodo: periodoLabel, anoReferencia, ppmAtual: ppm, serie: ppmMensal },
              }}
            >
<ChartPanel
              title="Evolução mensal do PPM"
              subtitle={`Comportamento do indicador em ${anoReferencia}`}
              icon={<Gauge className="h-4 w-4 text-destructive" />}
            >
              <ResponsiveContainer width="100%" height={285}>
                <LineChart
                  data={ppmMensal}
                  margin={{ top: 15, right: 20, left: 5, bottom: 5 }}
                >
                  <CartesianGrid
                    stroke="var(--color-border)"
                    strokeDasharray="3 3"
                    opacity={0.45}
                  />

                  <XAxis
                    dataKey="mes"
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                  />

                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickFormatter={(value) => numero.format(value)}
                  />

                  <Tooltip
                    formatter={(value: any) => [
                      numero.format(Number(value)),
                      "PPM",
                    ]}
                  />

                  <Line
                    type="monotone"
                    dataKey="ppm"
                    name="PPM"
                    stroke="var(--color-destructive)"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: "var(--color-destructive)",
                    }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>
          </PresentationSelectable>

                        <PresentationSelectable
              item={{
                id: "reuniao-indice-nc",
                title: "Índice de Não Conformidade",
                subtitle: hasDateFilter ? `Período: ${periodoLabel} · ${ncMode === "inspecoes" ? "Inspeções" : "SKU único"}` : `Evolução mensal por ${ncMode === "inspecoes" ? "inspeções" : "SKU único"}`,
                type: "chart",
                sourceRoute: "/reuniao",
                data: { periodo: periodoLabel, anoReferencia, modo: ncMode, meta: 2, serie: indiceNCMensal },
              }}
            >
<ChartPanel
              title="Índice de Não Conformidade"
              subtitle="Meta máxima: 2%"
              icon={<CircleX className="h-4 w-4 text-destructive" />}
              action={
                <div className="flex rounded-lg border border-border bg-muted/30 p-1">
                  <button
                    type="button"
                    onClick={() => setNcMode("inspecoes")}
                    className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition ${
                      ncMode === "inspecoes"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    Inspeções
                  </button>

                  <button
                    type="button"
                    onClick={() => setNcMode("sku")}
                    className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition ${
                      ncMode === "sku"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    SKU único
                  </button>
                </div>
              }
            >
              <ResponsiveContainer width="100%" height={285}>
                <LineChart
                  data={indiceNCMensal}
                  margin={{ top: 15, right: 20, left: 5, bottom: 5 }}
                >
                  <CartesianGrid
                    stroke="var(--color-border)"
                    strokeDasharray="3 3"
                    opacity={0.45}
                  />

                  <XAxis
                    dataKey="mes"
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                  />

                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickFormatter={(value) => `${value}%`}
                  />

                  <Tooltip
                    formatter={(value: any) => [
                      `${Number(value).toFixed(2)}%`,
                      "Índice NC",
                    ]}
                  />

                  <ReferenceLine
                    y={2}
                    stroke="var(--color-warning)"
                    strokeDasharray="6 5"
                    label={{
                      value: "Meta 2%",
                      position: "insideTopRight",
                      fill: "var(--color-warning)",
                      fontSize: 10,
                    }}
                  />

                  <Line
                    type="monotone"
                    dataKey="indice"
                    name="Índice NC"
                    stroke="var(--color-destructive)"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: "var(--color-destructive)",
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>
          </PresentationSelectable>
          </div>

          {/* EFICIÊNCIA */}

                    <PresentationSelectable
            item={{
              id: "reuniao-eficiencia-mensal",
              title: "Eficiência Mensal das Inspeções",
              subtitle: hasDateFilter ? `Período: ${periodoLabel}` : "Recebidas × Inspecionadas × Eficiência",
              type: "chart",
              sourceRoute: "/reuniao",
              data: { periodo: periodoLabel, anoReferencia, meta: 95, eficienciaConsolidada: eficiencia, serie: eficienciaMensal },
            }}
          >
<ChartPanel
            title="Eficiência mensal das inspeções"
            subtitle="Recebidas × Inspecionadas × Eficiência"
            icon={<Activity className="h-4 w-4 text-success" />}
          >
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart
                data={eficienciaMensal}
                margin={{ top: 15, right: 25, left: 5, bottom: 5 }}
              >
                <CartesianGrid
                  stroke="var(--color-border)"
                  strokeDasharray="3 3"
                  opacity={0.45}
                />

                <XAxis
                  dataKey="mes"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                />

                <YAxis
                  yAxisId="left"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                />

                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 110]}
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickFormatter={(value) => `${value}%`}
                />

                <Tooltip />

                <Legend />

                <Bar
                  yAxisId="left"
                  dataKey="recebidas"
                  name="Recebidas"
                  fill="var(--color-info)"
                  radius={[4, 4, 0, 0]}
                />

                <Bar
                  yAxisId="left"
                  dataKey="inspecionadas"
                  name="Inspecionadas"
                  fill="var(--color-primary)"
                  radius={[4, 4, 0, 0]}
                />

                <ReferenceLine
                  yAxisId="right"
                  y={95}
                  stroke="var(--color-warning)"
                  strokeDasharray="6 5"
                  label={{
                    value: "Meta 95%",
                    position: "insideTopRight",
                    fill: "var(--color-warning)",
                    fontSize: 10,
                  }}
                />

                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="eficiencia"
                  name="Eficiência %"
                  stroke="var(--color-success)"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                    fill: "var(--color-success)",
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartPanel>
          </PresentationSelectable>

          {/* PARETO */}

                    <PresentationSelectable
            item={{
              id: "reuniao-pareto-nc",
              title: "Pareto das Não Conformidades",
              subtitle: "Principais causas e percentual acumulado",
              type: "chart",
              sourceRoute: "/reuniao",
              data: { periodo: periodoLabel, serie: pareto, principalProblema: maiorProblema ?? null },
            }}
          >
<ChartPanel
            title="Pareto das Não Conformidades"
            subtitle="Principais causas e percentual acumulado"
            icon={<TrendingDown className="h-4 w-4 text-warning" />}
          >
            {pareto.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                Nenhuma não conformidade disponível para o Pareto.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart
                  data={pareto}
                  margin={{ top: 20, right: 30, left: 5, bottom: 55 }}
                >
                  <CartesianGrid
                    stroke="var(--color-border)"
                    strokeDasharray="3 3"
                    opacity={0.4}
                  />

                  <XAxis
                    dataKey="nome"
                    stroke="var(--color-muted-foreground)"
                    fontSize={9}
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                    height={75}
                  />

                  <YAxis
                    yAxisId="left"
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                  />

                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickFormatter={(value) => `${value}%`}
                  />

                  <Tooltip />

                  <Legend />

                  <Bar
                    yAxisId="left"
                    dataKey="ocorrencias"
                    name="Ocorrências"
                    fill="var(--color-destructive)"
                    radius={[5, 5, 0, 0]}
                  />

                  <ReferenceLine
                    yAxisId="right"
                    y={80}
                    stroke="var(--color-warning)"
                    strokeDasharray="6 5"
                  />

                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="acumulado"
                    name="% acumulado"
                    stroke="var(--color-warning)"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: "var(--color-warning)",
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartPanel>
          </PresentationSelectable>

          {/* RANKING */}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <PresentationSelectable
              item={{
                id: "reuniao-ranking-melhores",
                title: "Top 5 — Melhor Desempenho",
                subtitle: "Fornecedores com menor índice de NC",
                type: "ranking",
                sourceRoute: "/reuniao",
                data: { periodo: periodoLabel, fornecedores: melhores },
              }}
            >
<RankingPanel
              title="Top 5 — Melhor desempenho"
              subtitle="Fornecedores com menor índice de NC"
              icon={<Trophy className="h-4 w-4 text-success" />}
              items={melhores}
              mode="best"
            />
          </PresentationSelectable>

                        <PresentationSelectable
              item={{
                id: "reuniao-ranking-criticos",
                title: "Top 5 — Pontos de Atenção",
                subtitle: "Fornecedores com maior índice de NC",
                type: "ranking",
                sourceRoute: "/reuniao",
                data: { periodo: periodoLabel, fornecedores: criticos },
              }}
            >
<RankingPanel
              title="Top 5 — Pontos de atenção"
              subtitle="Fornecedores com maior índice de NC"
              icon={<TrendingDown className="h-4 w-4 text-destructive" />}
              items={criticos}
              mode="critical"
            />
          </PresentationSelectable>
          </div>

          {/* QLD / QLDE */}
          <PresentationSelectable
            item={{
              id: "reuniao-qld-qlde",
              title: "Exposição QLD / QLDE",
              subtitle: "Visão financeira e operacional dos depósitos 522 e 523",
              type: "kpi-group",
              sourceRoute: "/reuniao",
              data: {
                periodoIndicadores: periodoLabel,
                escopoQLDQLDE: "Fotografia atual; não filtrada pelo período do IDF",
                qld: { deposito: "522", valor: valorQLD, quantidade: quantidadeQLD, skus: qld.length },
                qlde: { deposito: "523", valor: valorQLDE, quantidade: quantidadeQLDE, skus: qlde.length },
                total: { valor: exposicaoTotal, quantidade: quantidadeTotal },
              },
            }}
          >

          <div>
            <SectionHeading
              eyebrow="Materiais sob gestão"
              title="Exposição QLD / QLDE"
              description="Visão financeira e operacional dos depósitos 522 e 523"
            />

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="relative overflow-hidden rounded-2xl border border-warning/35 bg-gradient-to-br from-warning/10 via-card to-card p-5">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-warning/15 blur-3xl" />

                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/15 text-warning">
                        <PackageSearch className="h-5 w-5" />
                      </div>

                      <div>
                        <h3 className="font-display text-base font-bold">
                          QLD
                        </h3>

                        <p className="text-xs text-muted-foreground">
                          Depósito 522 · Saldo livre
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-[11px] font-semibold text-warning">
                      Em tratamento
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <MiniMetric
                      label="Valor"
                      value={moeda.format(valorQLD)}
                    />

                    <MiniMetric
                      label="Quantidade"
                      value={numero.format(quantidadeQLD)}
                    />

                    <MiniMetric
                      label="SKUs"
                      value={numero.format(qld.length)}
                    />
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-destructive/35 bg-gradient-to-br from-destructive/10 via-card to-card p-5">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-destructive/15 blur-3xl" />

                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                        <ShieldCheck className="h-5 w-5" />
                      </div>

                      <div>
                        <h3 className="font-display text-base font-bold">
                          QLDE
                        </h3>

                        <p className="text-xs text-muted-foreground">
                          Depósito 523 · Saldo bloqueado
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-[11px] font-semibold text-destructive">
                      Bloqueado
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <MiniMetric
                      label="Valor"
                      value={moeda.format(valorQLDE)}
                    />

                    <MiniMetric
                      label="Quantidade"
                      value={numero.format(quantidadeQLDE)}
                    />

                    <MiniMetric
                      label="SKUs"
                      value={numero.format(qlde.length)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>


          </PresentationSelectable>          {/* QUALIAI */}

                    <PresentationSelectable
            item={{
              id: "reuniao-leitura-qualiai",
              title: "Leitura Executiva QualiAI",
              subtitle: "Síntese automática dos indicadores para apoio à reunião",
              type: "ai-summary",
              sourceRoute: "/reuniao",
              data: {
                pontos: leituraExecutiva,
                periodo: periodoLabel,
                anoReferencia,
                indicadores: { ppm, totalInspecoes, aprovados, reprovados, eficiencia, exposicaoTotal, quantidadeTotal, alertas, rncs },
              },
            }}
          >
<div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-5">
            <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-primary/15 blur-3xl" />

            <div className="relative">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/15 text-primary shadow-lg">
                  <BrainCircuit className="h-5 w-5" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-bold">
                      Leitura Executiva QualiAI
                    </h3>

                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Síntese automática dos indicadores para apoio à reunião
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-2">
                {leituraExecutiva.map((texto, index) => (
                  <div
                    key={index}
                    className="flex gap-3 rounded-xl border border-border/70 bg-background/50 p-3"
                  >
                    <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                      {index + 1}
                    </div>

                    <p className="text-xs leading-5 text-muted-foreground">
                      {texto}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </PresentationSelectable>
        </div>
      </div>


    </div>
  );
}

/* ========================================================
   COMPONENTES
   ======================================================== */

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </div>

      <h2 className="mt-1 font-display text-lg font-bold">
        {title}
      </h2>

      <p className="mt-1 text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function ChartPanel({
  title,
  subtitle,
  icon,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const handlePrintChart = () => {
    const safeTitle = title.replace(/[<>]/g, "");
    const safeSubtitle = subtitle.replace(/[<>]/g, "");
    const dataAtualizacao = new Date().toLocaleDateString("pt-BR");

    const chartId = `chart-print-${Math.random().toString(36).slice(2)}`;

    const source = document.querySelector(
      `[data-chart-title="${CSS.escape(title)}"]`,
    ) as HTMLElement | null;

    if (!source) {
      console.error("Não foi possível localizar o gráfico:", title);
      return;
    }

    const chartArea = source.querySelector(
      "[data-chart-content]",
    ) as HTMLElement | null;

    if (!chartArea) {
      console.error("Não foi possível localizar a área do gráfico:", title);
      return;
    }

    const clonedChart = chartArea.cloneNode(true) as HTMLElement;

    const wrapper = document.createElement("div");
    wrapper.id = chartId;
    wrapper.style.position = "fixed";
    wrapper.style.left = "-100000px";
    wrapper.style.top = "0";
    wrapper.style.width = "1100px";
    wrapper.style.background = "#ffffff";
    wrapper.style.color = "#0f172a";
    wrapper.appendChild(clonedChart);

    document.body.appendChild(wrapper);

    // Recharts usa SVG. Pegamos o SVG já renderizado na tela.
    const svg = clonedChart.querySelector("svg");

    if (svg) {
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.overflow = "visible";
    }

    const chartHTML = wrapper.innerHTML;

    document.body.removeChild(wrapper);

    const printWindow = window.open(
      "",
      "_blank",
      "width=1400,height=900,left=100,top=100",
    );

    if (!printWindow) {
      alert(
        "O navegador bloqueou a janela de impressão. Libere pop-ups para este site.",
      );
      return;
    }

    printWindow.document.open();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />

          <title>${safeTitle}</title>

          <style>
            @page {
              size: A4 landscape;
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              background: #ffffff;
              color: #0f172a;
              font-family:
                Arial,
                Helvetica,
                sans-serif;
            }

            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .sheet {
              position: relative;

              width: 297mm;
              height: 210mm;

              margin: 0 auto;

              padding:
                10mm
                13mm
                9mm
                13mm;

              overflow: hidden;

              background: #ffffff;
            }

            /* FAIXA SUPERIOR */

            .top-bar {
              width: 100%;
              height: 4mm;

              margin-bottom: 6mm;

              background: #111827;
            }

            /* CABEÇALHO */

            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;

              min-height: 16mm;
            }

            .update {
              display: flex;
              align-items: center;
              gap: 4mm;
            }

            .calendar {
              width: 7mm;
              height: 7mm;

              display: flex;
              align-items: center;
              justify-content: center;

              border: 1px solid #cbd5e1;
              border-radius: 2mm;

              font-size: 12pt;
            }

            .update-label {
              font-size: 9pt;
              font-weight: 800;
              letter-spacing: 0.04em;
            }

            .date-box {
              padding:
                2.5mm
                4mm;

              border: 1px solid #94a3b8;
              border-radius: 2mm;

              font-size: 8pt;
              font-weight: 600;
            }

            /* LOGO EM TEXTO — SEM INVENTAR IMAGEM */

            .brand {
              text-align: right;
              line-height: 1;
            }

            .brand-main {
              color: #ef4444;

              font-size: 16pt;
              font-weight: 900;
              font-style: italic;
              letter-spacing: -0.04em;
            }

            .brand-sub {
              margin-top: 1.5mm;

              color: #94a3b8;

              font-size: 5pt;
              font-weight: 700;
              letter-spacing: 0.25em;
            }

            /* TÍTULO */

            .document-title {
              margin-top: 4mm;

              font-size: 16pt;
              font-weight: 800;
              letter-spacing: -0.03em;
            }

            .document-subtitle {
              margin-top: 1.5mm;

              color: #64748b;

              font-size: 8pt;
            }

            .divider {
              height: 1px;

              margin-top: 4mm;

              background: #cbd5e1;
            }

            /* ÁREA PRINCIPAL */

            .content {
              height: 125mm;

              padding-top: 8mm;

              display: flex;
              flex-direction: column;
            }

            .section-label {
              color: #ef4444;

              font-size: 6.5pt;
              font-weight: 900;
              letter-spacing: 0.18em;
            }

            .section-title {
              margin-top: 2mm;

              font-size: 11pt;
              font-weight: 800;
            }

            .section-description {
              margin-top: 1mm;

              color: #64748b;

              font-size: 7pt;
            }

            /* CARD DO GRÁFICO */

            .chart-card {
              flex: 1;

              min-height: 0;

              margin-top: 5mm;

              padding:
                5mm
                6mm;

              border: 1px solid #cbd5e1;
              border-radius: 4mm;

              background: #ffffff;

              overflow: hidden;
            }

            .chart-inner {
              width: 100%;
              height: 100%;
            }

            /*
              O ResponsiveContainer do Recharts pode carregar
              estilos inline calculados para a tela.
            */

            .chart-inner > div {
              width: 100% !important;
              height: 100% !important;
              min-width: 0 !important;
              min-height: 0 !important;
            }

            .chart-inner svg {
              display: block !important;

              width: 100% !important;
              height: 100% !important;

              overflow: visible !important;
            }

            /*
              Recharts herda várias cores via CSS variables.
              Aqui definimos as principais para o documento.
            */

            .chart-inner {
              --color-border: #e2e8f0;
              --color-muted-foreground: #64748b;
              --color-foreground: #0f172a;
              --color-destructive: #ff3838;
              --color-success: #22c55e;
              --color-warning: #f59e0b;
              --color-info: #3b82f6;
              --color-primary: #ef4444;
              --color-chart-received: #94a3b8;
              --color-chart-inspected: #22c55e;
              --color-chart-rejected: #ef4444;
            }

            /* RODAPÉ */

            .footer {
              position: absolute;

              left: 13mm;
              right: 13mm;
              bottom: 9mm;

              height: 10mm;

              display: flex;
              align-items: center;
              justify-content: space-between;

              border-top: 1px solid #cbd5e1;

              padding-top: 2mm;
            }

            .footer-brand {
              color: #0f172a;

              font-size: 7pt;
              font-weight: 900;
              letter-spacing: -0.03em;
            }

            .footer-code {
              color: #64748b;

              font-size: 5.5pt;
            }

            .bottom-bar {
              position: absolute;

              left: 13mm;
              right: 13mm;
              bottom: 4mm;

              height: 4mm;

              background: #111827;
            }

            @media screen {
              body {
                background: #e5e7eb;
              }

              .sheet {
                margin-top: 20px;
                margin-bottom: 20px;

                box-shadow:
                  0 0 0 1px rgba(15, 23, 42, 0.1),
                  0 20px 50px rgba(15, 23, 42, 0.15);
              }
            }

            @media print {
              html,
              body {
                width: 297mm !important;
                height: 210mm !important;

                background: #ffffff !important;
              }

              .sheet {
                width: 297mm !important;
                height: 210mm !important;

                margin: 0 !important;

                page-break-after: avoid !important;
                break-after: avoid-page !important;
              }
            }
          </style>
        </head>

        <body>
          <main class="sheet">

            <div class="top-bar"></div>

            <header class="header">

              <div class="update">

                <div class="calendar">
                  ◫
                </div>

                <div class="update-label">
                  DATA DE ATUALIZAÇÃO
                </div>

                <div class="date-box">
                  Data: ${dataAtualizacao}
                </div>

              </div>

              <div class="brand">
                <div class="brand-main">
                  FRASLE
                </div>

                <div class="brand-sub">
                  MOBILITY
                </div>
              </div>

            </header>

            <div class="document-title">
              ${safeTitle}
            </div>

            <div class="document-subtitle">
              ${safeSubtitle}
            </div>

            <div class="divider"></div>

            <section class="content">

              <div class="section-label">
                INDICADOR DA QUALIDADE
              </div>

              <div class="section-title">
                ${safeTitle}
              </div>

              <div class="section-description">
                ${safeSubtitle}
              </div>

              <div class="chart-card">

                <div class="chart-inner">
                  ${chartHTML}
                </div>

              </div>

            </section>

            <footer class="footer">

              <div class="footer-brand">
                RANDONCORP
              </div>

              <div class="footer-code">
                FORM-CORP-213 — Atualização Indicadores CTL · Rev.00 · 23/01/2026
              </div>

            </footer>

            <div class="bottom-bar"></div>

          </main>

          <script>
            window.onload = function () {
              setTimeout(function () {
                window.print();
              }, 500);
            };
          </script>

        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div
      data-chart-title={title}
      className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/10 shadow-sm"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/5 blur-3xl transition-all duration-500 group-hover:bg-primary/10" />

      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background/70">
            {icon}
          </div>

          <div>
            <h3 className="text-sm font-semibold">{title}</h3>

            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {action}

          <button
            type="button"
            onClick={handlePrintChart}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            title={`Imprimir ${title}`}
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        </div>
      </div>

      <div data-chart-content className="relative p-4">
        {children}
      </div>
    </div>
  );
}

function RankingPanel({
  title,
  subtitle,
  icon,
  items,
  mode,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: Array<{
    fornecedor: string;
    total: number;
    aprovados: number;
    reprovados: number;
    indiceNC: number;
    aprovacao: number;
  }>;
  mode: "best" | "critical";
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
            mode === "best"
              ? "bg-success/10"
              : "bg-destructive/10"
          }`}
        >
          {icon}
        </div>

        <div>
          <h3 className="text-sm font-semibold">
            {title}
          </h3>

          <p className="text-[10px] text-muted-foreground">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="divide-y divide-border/70">
        {items.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Sem dados suficientes para o ranking.
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={`${item.fornecedor}-${index}`}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/20"
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  mode === "best"
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {index + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">
                  {item.fornecedor}
                </div>

                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {numero.format(item.total)} inspeções ·{" "}
                  {numero.format(item.reprovados)} reprovações
                </div>
              </div>

              <div className="text-right">
                <div
                  className={`text-sm font-bold ${
                    mode === "best"
                      ? "text-success"
                      : "text-destructive"
                  }`}
                >
                  {item.indiceNC.toFixed(1)}%
                </div>

                <div className="text-[9px] text-muted-foreground">
                  índice NC
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ExecutiveCard({
  label,
  value,
  description,
  icon,
  tone,
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  tone: "red" | "blue" | "green" | "amber" | "purple";
}) {
  const tones = {
    red: {
      border: "border-destructive/30",
      background: "from-destructive/12 via-card to-card",
      icon: "bg-destructive/15 text-destructive",
      glow: "bg-destructive/15",
    },

    blue: {
      border: "border-info/30",
      background: "from-info/12 via-card to-card",
      icon: "bg-info/15 text-info",
      glow: "bg-info/15",
    },

    green: {
      border: "border-success/30",
      background: "from-success/12 via-card to-card",
      icon: "bg-success/15 text-success",
      glow: "bg-success/15",
    },

    amber: {
      border: "border-warning/30",
      background: "from-warning/12 via-card to-card",
      icon: "bg-warning/15 text-warning",
      glow: "bg-warning/15",
    },

    purple: {
      border: "border-primary/30",
      background: "from-primary/12 via-card to-card",
      icon: "bg-primary/15 text-primary",
      glow: "bg-primary/15",
    },
  };

  const style = tones[tone];

  return (
    <div
      className={`group relative min-h-[145px] overflow-hidden rounded-2xl border ${style.border} bg-gradient-to-br ${style.background} p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
    >
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full ${style.glow} blur-3xl transition-transform duration-500 group-hover:scale-150`}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>

          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${style.icon}`}
          >
            {icon}
          </div>
        </div>

        <div className="mt-5">
          <div className="break-words font-display text-xl font-bold tracking-tight">
            {value}
          </div>

          <div className="mt-1 text-[11px] text-muted-foreground">
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/55 p-3 backdrop-blur-sm">
      <div className="text-[10px] text-muted-foreground">
        {label}
      </div>

      <div className="mt-1 break-words text-sm font-bold">
        {value}
      </div>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </div>

      <div className="mt-1 font-display text-lg font-bold">
        {value}
      </div>
    </div>
  );
}

function PrintHeader({
  ano,
  page,
  compact = false,
}: {
  ano: number;
  page: number;
  compact?: boolean;
}) {
  const hoje = new Intl.DateTimeFormat("pt-BR").format(new Date());

  return (
    <div className={`print-header ${compact ? "compact" : ""}`}>
      <div className="print-header-left">
        <div className="print-date">
          DATA DE ATUALIZAÇÃO <span>{hoje}</span>
        </div>
        <h1 className="print-title">Reunião Mensal da Qualidade — {ano}</h1>
        <div className="print-period">
          <strong>Período:</strong> Período completo (sem filtro de data)
        </div>
      </div>

      <div className="print-brand">
        <div className="print-brand-mark">FRASLE</div>
        <div className="print-brand-sub">MOBILITY</div>
        <div className="print-page-chip">RELATÓRIO EXECUTIVO · {page}/3</div>
      </div>
    </div>
  );
}

function PrintFooter({ page }: { page: number }) {
  return (
    <div className="print-footer">
      <span className="print-footer-brand">RANDONCORP</span>
      <span>FORM-CORP-213 — Atualização Indicadores CTL · Rev.00 · 23/01/2026</span>
      <span>{page} / 3</span>
    </div>
  );
}

function PrintKpi({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "red" | "blue" | "green" | "amber";
}) {
  return (
    <div className={`print-kpi ${tone}`}>
      <div className="print-kpi-label">{label}</div>
      <div className="print-kpi-value">{value}</div>
      <div className="print-kpi-note">{note}</div>
    </div>
  );
}

function PrintChart({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="print-chart">
      <div className="print-chart-title">{title}</div>
      <div className="print-chart-subtitle">{subtitle}</div>
      {children}
    </div>
  );
}

function PrintRanking({
  title,
  items,
  mode,
}: {
  title: string;
  items: Array<{
    fornecedor: string;
    total: number;
    reprovados: number;
    indiceNC: number;
  }>;
  mode: "best" | "critical";
}) {
  return (
    <div className={`print-ranking ${mode}`}>
      <div className="print-ranking-title">{title}</div>
      {items.length === 0 ? (
        <div className="print-ranking-row">
          <div />
          <div className="print-ranking-name">Sem dados suficientes</div>
          <div />
        </div>
      ) : (
        items.map((item, index) => (
          <div className="print-ranking-row" key={`${title}-${item.fornecedor}`}>
            <div className="print-rank">{index + 1}</div>
            <div>
              <div className="print-ranking-name">{item.fornecedor}</div>
              <div className="print-ranking-meta">
                {numero.format(item.total)} inspeções · {numero.format(item.reprovados)} reprovações
              </div>
            </div>
            <div className="print-ranking-rate">{item.indiceNC.toFixed(1)}%</div>
          </div>
        ))
      )}
    </div>
  );
}

function PrintStockCard({
  title,
  subtitle,
  status,
  value,
  quantity,
  skus,
  tone,
}: {
  title: string;
  subtitle: string;
  status: string;
  value: string;
  quantity: string;
  skus: string;
  tone: "amber" | "red";
}) {
  return (
    <div className={`print-stock-card ${tone}`}>
      <div className="print-stock-head">
        <div>
          <div className="print-stock-title">{title}</div>
          <div className="print-stock-subtitle">{subtitle}</div>
        </div>
        <div className="print-stock-status">{status}</div>
      </div>

      <div className="print-stock-metrics">
        <div className="print-stock-metric">
          <span>Valor</span>
          <strong>{value}</strong>
        </div>
        <div className="print-stock-metric">
          <span>Quantidade</span>
          <strong>{quantity}</strong>
        </div>
        <div className="print-stock-metric">
          <span>SKUs</span>
          <strong>{skus}</strong>
        </div>
      </div>
    </div>
  );
}
