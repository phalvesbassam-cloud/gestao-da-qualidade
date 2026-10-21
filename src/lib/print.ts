// Impressão de cards, gráficos e relatórios em A4.
//
// Em vez de imprimir a página inteira escondendo o resto (o que deixava gráficos
// cortados e legendas brancas no papel), o conteúdo é clonado para um iframe
// próprio que:
//   - usa sempre o tema claro (cores de gráfico próprias para papel);
//   - mantém exatamente o layout da tela (largura e colunas congeladas) e
//     depois reduz tudo com zoom para caber na largura da folha;
//   - tem cabeçalho e rodapé padrão (FORM-CORP-213).
import frasleLogo from "@/assets/print/frasle-mobility.png";
import randoncorpLogo from "@/assets/print/randoncorp.png";

export type PrintOptions = {
  title: string;
  subtitle?: string;
  orientation?: "landscape" | "portrait";
  /** Cor da faixa do cabeçalho/rodapé. */
  accent?: string;
  /** Mostra cabeçalho/rodapé corporativos (padrão: true). */
  chrome?: boolean;
  /** "light" = papel claro; "screen" = mesmas cores do tema atual da tela. */
  appearance?: PrintAppearance;
};

export type PrintAppearance = "light" | "screen";

const PRINT_ACCENT_KEY = "print-accent-color";
export const DEFAULT_PRINT_ACCENT = "#E30613";

export function getPrintAccent() {
  try {
    return localStorage.getItem(PRINT_ACCENT_KEY) || DEFAULT_PRINT_ACCENT;
  } catch {
    return DEFAULT_PRINT_ACCENT;
  }
}

export function setPrintAccent(color: string) {
  try {
    localStorage.setItem(PRINT_ACCENT_KEY, color);
  } catch {
    /* sem armazenamento: usa a cor só nesta impressão */
  }
}

// Largura útil da folha A4 (margem de 9 mm) em px CSS (96 dpi).
const MM = 96 / 25.4;
const PAGE = {
  landscape: { w: (297 - 18) * MM, h: (210 - 18) * MM },
  portrait: { w: (210 - 18) * MM, h: (297 - 18) * MM },
};

/** Propriedades de layout copiadas da tela para o clone. */
const LAYOUT_PROPS = [
  "display",
  "grid-template-columns",
  "grid-column",
  "flex-direction",
  "flex-wrap",
  "align-items",
  "justify-content",
  "gap",
] as const;

function freezeLayout(source: Element, clone: Element) {
  if (source instanceof HTMLElement && clone instanceof HTMLElement) {
    const cs = getComputedStyle(source);
    const printOnly = source.classList.contains("print-only");
    for (const prop of LAYOUT_PROPS) {
      if (printOnly && prop === "display") continue;
      const value = cs.getPropertyValue(prop);
      if (value) clone.style.setProperty(prop, value);
    }
    // Contêineres de gráfico: altura fixa da tela (o SVG já tem largura em px).
    if (
      source.classList.contains("recharts-responsive-container") ||
      source.classList.contains("recharts-wrapper")
    ) {
      const rect = source.getBoundingClientRect();
      clone.style.width = `${rect.width}px`;
      clone.style.height = `${rect.height}px`;
    }
  }
  const a = source.children;
  const b = clone.children;
  for (let i = 0; i < a.length && i < b.length; i++) freezeLayout(a[i], b[i]);
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function waitFor(doc: Document) {
  const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
  const imgs = Array.from(doc.images);
  const pending = [
    ...links.map(
      (l) =>
        new Promise<void>((r) => {
          if (l.sheet) return r();
          l.addEventListener("load", () => r(), { once: true });
          l.addEventListener("error", () => r(), { once: true });
        }),
    ),
    ...imgs.map(
      (img) =>
        new Promise<void>((r) => {
          if (img.complete) return r();
          img.addEventListener("load", () => r(), { once: true });
          img.addEventListener("error", () => r(), { once: true });
        }),
    ),
  ];
  const fonts = (doc as Document & { fonts?: FontFaceSet }).fonts;
  return Promise.race([
    Promise.all([...pending, fonts?.ready ?? Promise.resolve()]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
}

/** Imprime um ou mais elementos da tela, cada um começando numa folha nova. */
export async function printElements(elements: HTMLElement[], options: PrintOptions) {
  const els = elements.filter(Boolean);
  if (!els.length) return;

  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

  const orientation = options.orientation ?? "landscape";
  const page = PAGE[orientation];
  const accent = options.accent ?? getPrintAccent();
  const chrome = options.chrome ?? true;
  const screenDark =
    options.appearance === "screen" && document.documentElement.classList.contains("dark");
  const dateLabel = new Date().toLocaleDateString("pt-BR");

  const blocks = els.map((el) => {
    const width = Math.ceil(el.getBoundingClientRect().width) || 1200;
    const clone = el.cloneNode(true) as HTMLElement;
    freezeLayout(el, clone);
    clone
      .querySelectorAll(
        ".no-print, .recharts-tooltip-wrapper, [data-radix-popper-content-wrapper], [role='tooltip']",
      )
      .forEach((n) => n.remove());
    clone.querySelectorAll("button:not(.print-keep)").forEach((n) => {
      // Botões de alternância (ex.: Inspeções/SKU) mostram só a opção ativa.
      if ((n as HTMLElement).dataset.active === "true") {
        (n as HTMLElement).classList.add("print-active-toggle");
        return;
      }
      n.remove();
    });
    clone.querySelectorAll(".print-only").forEach((n) => n.classList.remove("print-only"));
    clone.querySelectorAll("input, textarea").forEach((n) => {
      const value = (n as HTMLInputElement).value;
      const span = document.createElement("span");
      span.textContent = value;
      n.replaceWith(span);
    });
    clone.style.width = `${width}px`;
    clone.style.margin = "0";
    // Reduz para caber na folha; cards estreitos são levemente ampliados.
    const zoom = Math.min(1.3, page.w / width);
    return `<div class="print-block" style="zoom:${zoom.toFixed(4)}">${clone.outerHTML}</div>`;
  });

  const styles = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => n.outerHTML)
    .join("\n");

  const header = chrome
    ? `<header class="ph">
        <div class="ph-bar"></div>
        <div class="ph-row">
          <div>
            <div class="ph-kicker">QualiHub · Gestão da Qualidade de Fornecedores</div>
            <h1 class="ph-title">${escapeHtml(options.title)}</h1>
            ${options.subtitle ? `<div class="ph-sub">${escapeHtml(options.subtitle)}</div>` : ""}
          </div>
          <div class="ph-right">
            <img src="${frasleLogo}" alt="Frasle Mobility" class="ph-logo" />
            <div class="ph-date">Atualizado em ${dateLabel}</div>
          </div>
        </div>
      </header>`
    : "";

  const footer = chrome
    ? `<footer class="pf">
        <img src="${randoncorpLogo}" alt="RandonCorp" class="pf-logo" />
        <span>FORM-CORP-213 — Atualização Indicadores CTL · Rev.00 · 23/01/2026</span>
      </footer>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR"${screenDark ? ' class="dark"' : ""}>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(options.title)}</title>
${styles}
<style>
  @page { size: A4 ${orientation}; margin: 9mm; }
  html, body { background: ${options.appearance === "screen" ? "var(--background)" : "#fff"} !important; margin: 0; padding: 0; }
  body { color: var(--foreground); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  *, *::before, *::after { animation: none !important; transition: none !important; }
  .print-sheet + .print-sheet { break-before: page; }
  .print-block { width: max-content; }
  .print-block .card-premium:hover, .print-block .section-premium:hover { transform: none; }
  .print-block .surface, .print-block .card-premium, .print-block .section-premium,
  .print-block .hero-panel { box-shadow: none !important; }
  .print-block .hero-panel::after { display: none; }
  .print-block section, .print-block .surface, .print-block .card-premium,
  .print-block .recharts-wrapper, .print-block tr, .print-block .print-avoid-break {
    break-inside: avoid; page-break-inside: avoid;
  }
  .print-block .overflow-auto, .print-block .overflow-x-auto, .print-block .overflow-y-auto,
  .print-block [class*="max-h-"] { overflow: visible !important; max-height: none !important; }
  .print-block .sticky { position: static !important; }
  .print-block .print-active-toggle { pointer-events: none; }
  .ph { margin-bottom: 4mm; }
  .ph-bar { height: 2.2mm; background: ${accent}; border-radius: 1mm; margin-bottom: 3mm; }
  .ph-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8mm; }
  .ph-kicker { font: 700 7pt Inter, Arial, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: ${accent}; }
  .ph-title { font: 800 16pt Sora, Inter, Arial, sans-serif; margin: 1mm 0 0; color: var(--foreground); letter-spacing: -.01em; }
  .ph-sub { font: 500 8.5pt Inter, Arial, sans-serif; color: var(--muted-foreground); margin-top: 1mm; }
  .ph-right { text-align: right; }
  .ph-logo { height: 10mm; width: auto; background: #fff; border-radius: 2mm; padding: ${screenDark ? "1.2mm 2.5mm" : "0"}; }
  .ph-date { margin-top: 1.5mm; font: 600 7.5pt Inter, Arial, sans-serif; color: var(--muted-foreground); }
  .pf { margin-top: 4mm; padding-top: 2mm; border-top: .3mm solid var(--border); display: flex; align-items: center; justify-content: space-between; font: 500 7pt Inter, Arial, sans-serif; color: var(--muted-foreground); break-inside: avoid; }
  .pf-logo { height: 5mm; width: auto; background: #fff; border-radius: 1mm; padding: ${screenDark ? "0.6mm 1.5mm" : "0"}; }
</style>
</head>
<body>
${blocks.map((block) => `<div class="print-sheet">${header}${block}${footer}</div>`).join("\n")}
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: `${Math.round(page.w)}px`,
    height: `${Math.round(page.h)}px`,
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();

  await waitFor(doc);
  await new Promise((r) => setTimeout(r, 150));

  const win = iframe.contentWindow!;
  const cleanup = () => setTimeout(() => iframe.remove(), 500);
  win.addEventListener("afterprint", cleanup, { once: true });
  win.focus();
  win.print();
  // Alguns navegadores não disparam afterprint no iframe.
  setTimeout(() => iframe.isConnected && iframe.remove(), 60_000);
}

export function printElement(el: HTMLElement | null, options: PrintOptions) {
  if (!el) return Promise.resolve();
  return printElements([el], options);
}
