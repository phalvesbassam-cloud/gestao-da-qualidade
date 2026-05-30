import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AlertaRow, DashboardData, IDFRow, RNCRow } from "@/lib/types";

export type MultiFilter = string[]; // empty = todos

export type RecorrenciaFilter = "todas" | "reincidentes" | "nao-reincidentes";

export type Filters = {
  divisao: MultiFilter;
  fornecedor: MultiFilter;
  inspetor: MultiFilter;
  criticidade: MultiFilter;
  tipoProblema: MultiFilter;
  classificacao: MultiFilter;     // A/B/C/D
  statusRNC: MultiFilter;
  statusAlerta: MultiFilter;      // "Finalizado" | "Pendente" | "Falta enviar"
  status: MultiFilter;            // IDF: "Aprovado" | "Aprovação Condicional" | "Reprovado"
  origem: MultiFilter;            // "IDF" | "ALERTA" | "RNC"
  item: string;
  processo: string;
  from: string;
  to: string;
  search: string;
  compare: boolean;
  recorrencia: RecorrenciaFilter;
};

type Ctx = {
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
  reset: () => void;
};

const FiltersContext = createContext<Ctx | null>(null);

const initial: Filters = {
  divisao: [],
  fornecedor: [],
  inspetor: [],
  criticidade: [],
  tipoProblema: [],
  classificacao: [],
  statusRNC: [],
  statusAlerta: [],
  status: [],
  origem: [],
  item: "",
  processo: "",
  from: "",
  to: "",
  search: "",
  compare: false,
  recorrencia: "todas",
};

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setState] = useState<Filters>(initial);
  const value = useMemo<Ctx>(
    () => ({
      filters,
      setFilters: (f) => setState((prev) => normalizeFilters({ ...prev, ...f })),
      reset: () => setState(initial),
    }),
    [filters],
  );
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters fora do provider");
  return ctx;
}

function inMulti(value: string | undefined, multi: MultiFilter): boolean {
  if (!multi || multi.length === 0) return true;
  if (!value) return false;
  return multi.includes(value);
}

function safeText(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanMulti(value: unknown): MultiFilter {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(safeText).filter(Boolean))];
}

function normalizeFilters(value: Partial<Filters>): Filters {
  const recorrencia = value.recorrencia === "reincidentes" || value.recorrencia === "nao-reincidentes" ? value.recorrencia : "todas";
  return {
    divisao: cleanMulti(value.divisao),
    fornecedor: cleanMulti(value.fornecedor),
    inspetor: cleanMulti(value.inspetor),
    criticidade: cleanMulti(value.criticidade),
    tipoProblema: cleanMulti(value.tipoProblema),
    classificacao: cleanMulti(value.classificacao),
    statusRNC: cleanMulti(value.statusRNC),
    statusAlerta: cleanMulti(value.statusAlerta),
    status: cleanMulti(value.status),
    origem: cleanMulti(value.origem),
    item: safeText(value.item),
    processo: safeText(value.processo),
    from: safeDateInput(value.from),
    to: safeDateInput(value.to),
    search: safeText(value.search),
    compare: Boolean(value.compare),
    recorrencia,
  };
}

function safeDateInput(value: unknown): string {
  const s = safeText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [year, month, day] = s.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return "";
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return "";
  return s;
}

function parseLocalDate(value: string, endOfDay = false): Date | null {
  const safe = safeDateInput(value);
  if (!safe) return null;
  const [year, month, day] = safe.split("-").map(Number);
  const d = new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function useDebouncedValue<T>(value: T, delayMs = 180): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function dateOk(d: Date | null, from: Date | null, to: Date | null, strict: boolean): boolean {
  if (!from && !to) return true;
  if (!d || Number.isNaN(d.getTime())) return !strict; // em modo comparação exigimos data
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function filterAll(
  data: DashboardData,
  filters: Filters,
  from: Date | null,
  to: Date | null,
  strictDate: boolean,
): { idf: IDFRow[]; alerta: AlertaRow[]; rnc: RNCRow[] } {
  const safeData = data ?? { idf: [], alerta: [], rnc: [], fornecedores: [], divisoes: [], fetchedAt: "" };
  const f = normalizeFilters(filters);
  const q = f.search.toLowerCase();
  const itemQ = f.item.toLowerCase();
  const procQ = f.processo.toLowerCase();
  const clsMap = new Map((safeData.fornecedores ?? []).map((s) => [s.fornecedor, s.classificacao]));
  console.debug("[Dashboard] Filtros aplicados", { filtros: f, registros: { idf: safeData.idf.length, alerta: safeData.alerta.length, rnc: safeData.rnc.length } });

  const idf = safeData.idf.filter((r) => {
    if (!inMulti(r.divisao, f.divisao)) return false;
    if (!inMulti(r.fornecedor, f.fornecedor)) return false;
    if (!inMulti(r.inspetorFinal, f.inspetor)) return false;
    if (!inMulti(r.criticidade, f.criticidade)) return false;
    if (!inMulti(r.tipoProblema, f.tipoProblema)) return false;
    if (f.classificacao.length && !f.classificacao.includes(clsMap.get(r.fornecedor) || "")) return false;
    if (f.origem.length && !f.origem.includes("IDF")) return false;
    if (f.status.length) {
      const s = safeText(r.status).toLowerCase();
      const tag = s.includes("aprovação condicional") || s.includes("aprovacao condicional")
        ? "Aprovação Condicional"
        : s.includes("reprov")
        ? "Reprovado"
        : s.includes("aprovado")
        ? "Aprovado"
        : "";
      if (!f.status.includes(tag)) return false;
    }
    if (!dateOk(r.dataReferencia, from, to, strictDate)) return false;
    if (itemQ && !`${r.codigoItem ?? ""} ${r.descricaoItem ?? ""}`.toLowerCase().includes(itemQ)) return false;
    if (procQ && !safeText(r.processo).toLowerCase().includes(procQ)) return false;
    if (q && !`${r.processo ?? ""} ${r.codigoItem ?? ""} ${r.descricaoItem ?? ""} ${r.fornecedor ?? ""} ${r.problema ?? ""} ${r.descricaoProblema ?? ""}`.toLowerCase().includes(q)) return false;
    if (f.recorrencia === "reincidentes" && !(r.recorrencia > 0)) return false;
    if (f.recorrencia === "nao-reincidentes" && r.recorrencia > 0) return false;
    return true;
  });

  // Conjunto de fornecedores com reincidência (para filtrar Alerta/RNC)
  const fornReinc = new Set<string>();
  for (const r of safeData.idf) if (r.recorrencia > 0) fornReinc.add(r.fornecedor);
  const applyRecForn = (forn: string): boolean => {
    if (f.recorrencia === "todas") return true;
    if (f.recorrencia === "reincidentes") return fornReinc.has(forn);
    return !fornReinc.has(forn);
  };

  const alerta = safeData.alerta.filter((r) => {
    if (!inMulti(r.divisao, f.divisao)) return false;
    if (!inMulti(r.fornecedor, f.fornecedor)) return false;
    if (!inMulti(r.inspetor, f.inspetor)) return false;
    if (f.classificacao.length && !f.classificacao.includes(clsMap.get(r.fornecedor) || "")) return false;
    if (f.origem.length && !f.origem.includes("ALERTA")) return false;
    if (f.statusAlerta.length) {
      const tag = r.finalizado
        ? "Finalizado"
        : safeText(r.statusEnvio).toUpperCase().includes("FALTA")
        ? "Falta enviar"
        : "Pendente";
      if (!f.statusAlerta.includes(tag)) return false;
    }
    if (!dateOk(r.dataReferencia, from, to, strictDate)) return false;
    if (itemQ && !safeText(r.item).toLowerCase().includes(itemQ)) return false;
    if (q && !`${r.numero ?? ""} ${r.item ?? ""} ${r.fornecedor ?? ""} ${r.problema ?? ""} ${r.observacao ?? ""}`.toLowerCase().includes(q)) return false;
    if (!applyRecForn(r.fornecedor)) return false;
    return true;
  });

  // mapa item→fornecedor para RNC
  const item2for = new Map<string, string>();
  {
    const counts = new Map<string, Map<string, number>>();
    for (const r of safeData.idf) {
      if (!r.codigoItem || !r.fornecedor) continue;
      let m = counts.get(r.codigoItem);
      if (!m) { m = new Map(); counts.set(r.codigoItem, m); }
      m.set(r.fornecedor, (m.get(r.fornecedor) || 0) + 1);
    }
    for (const [item, m] of counts) {
      let best = ""; let n = 0;
      for (const [f, c] of m) if (c > n) { best = f; n = c; }
      if (best) item2for.set(item, best);
    }
  }

  const rnc = safeData.rnc.filter((r) => {
    if (!inMulti(r.divisao, f.divisao)) return false;
    if (f.origem.length && !f.origem.includes("RNC")) return false;
    if (f.statusRNC.length) {
      const tag = safeText(r.statusRNC).toUpperCase().includes("CONCLU") ? "Concluída" : (r.statusRNC || "Em andamento");
      if (!f.statusRNC.some((s) => tag.toLowerCase().includes(s.toLowerCase()))) return false;
    }
    if (!dateOk(r.dataReferencia, from, to, strictDate)) return false;
    if (itemQ && !safeText(r.item).toLowerCase().includes(itemQ)) return false;
    if (q && !`${r.rnc ?? ""} ${r.item ?? ""} ${r.assunto ?? ""} ${r.cliente ?? ""}`.toLowerCase().includes(q)) return false;
    if (f.recorrencia !== "todas") {
      const forn = item2for.get(r.item) || "";
      if (!applyRecForn(forn)) return false;
    }
    return true;
  });

  console.debug("[Dashboard] Resultado dos filtros", { idf: idf.length, alerta: alerta.length, rnc: rnc.length });

  return { idf, alerta, rnc };
}

const DAY = 24 * 60 * 60 * 1000;

function computeCompareWindows(
  data: DashboardData,
  filters: Filters,
): { curFrom: Date | null; curTo: Date | null; prevFrom: Date; prevTo: Date; label: string } | null {
  // janela atual
  let curFrom = parseLocalDate(filters.from);
  let curTo = parseLocalDate(filters.to, true);
  if (curFrom && curTo && curFrom > curTo) {
    const tmp = curFrom;
    curFrom = new Date(curTo);
    curFrom.setHours(0, 0, 0, 0);
    curTo = new Date(tmp);
    curTo.setHours(23, 59, 59, 999);
  }

  if (!curFrom || !curTo) {
    // fallback: usa max(dataRef) e últimos 30 dias
    let max: Date | null = null;
    for (const r of [...data.idf, ...data.alerta, ...data.rnc]) {
      if (r.dataReferencia && (!max || r.dataReferencia > max)) max = r.dataReferencia;
    }
    if (!max) return null;
    curTo = new Date(max.getTime());
    curTo.setHours(23, 59, 59, 999);
    curFrom = new Date(curTo.getTime() - 29 * DAY);
    curFrom.setHours(0, 0, 0, 0);
  }

  const span = curTo.getTime() - curFrom.getTime();
  const prevTo = new Date(curFrom.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - span);

  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const label = `${fmt(prevFrom)}–${fmt(prevTo)} vs ${fmt(curFrom)}–${fmt(curTo)}`;

  return { curFrom, curTo, prevFrom, prevTo, label };
}

export function useFilteredData(data: DashboardData) {
  const { filters } = useFilters();
  const debouncedFilters = useDebouncedValue(filters);
  return useMemo(() => {
    const safeFilters = normalizeFilters(debouncedFilters);
    let from = parseLocalDate(safeFilters.from);
    let to = parseLocalDate(safeFilters.to, true);
    if (from && to && from > to) {
      console.warn("[Dashboard] Intervalo de datas invertido; aplicando correção automática", { from: safeFilters.from, to: safeFilters.to });
      const tmp = from;
      from = new Date(to);
      from.setHours(0, 0, 0, 0);
      to = new Date(tmp);
      to.setHours(23, 59, 59, 999);
    }

    const current = filterAll(data, safeFilters, from, to, false);

    let previous: { idf: IDFRow[]; alerta: AlertaRow[]; rnc: RNCRow[] } | null = null;
    let compareLabel: string | null = null;
    let currentLabel: string | null = null;

    if (safeFilters.compare) {
      const win = computeCompareWindows(data, safeFilters);
      if (win) {
        const cur = filterAll(data, safeFilters, win.curFrom, win.curTo, true);
        const prev = filterAll(data, safeFilters, win.prevFrom, win.prevTo, true);
        // em modo comparação, alinha current à janela calculada para consistência
        previous = prev;
        compareLabel = win.label;
        const fmt = (d: Date) =>
          d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
        currentLabel = `${fmt(win.curFrom!)}–${fmt(win.curTo!)}`;
        return {
          ...cur,
          previous,
          compare: true as const,
          compareLabel,
          currentLabel,
        };
      }
    }

    return {
      ...current,
      previous: null,
      compare: false as const,
      compareLabel: null as string | null,
      currentLabel: null as string | null,
    };
  }, [data, debouncedFilters]);
}

// Tema
export function useTheme() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState<boolean>(false);
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("qf-theme") : null;
    setDark(saved === "dark");
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("qf-theme", dark ? "dark" : "light");
  }, [dark, mounted]);
  return { dark, mounted, toggle: () => setDark((v) => !v) };
}

// ========== Modo TV avançado ==========

export type TvTab = { to: string; label: string; durationMs: number; enabled: boolean };

const DEFAULT_TV_TABS: TvTab[] = [
  { to: "/", label: "Consolidado", durationMs: 120_000, enabled: true },
  { to: "/idf", label: "IDF", durationMs: 180_000, enabled: true },
  { to: "/alerta", label: "Alertas", durationMs: 60_000, enabled: true },
  { to: "/rnc", label: "RNC", durationMs: 120_000, enabled: true },
];

export function useTvController(
  currentPath: string,
  navigate: (to: string) => void,
  onTick?: () => void,
) {
  const [tv, setTv] = useState(false);
  const [paused, setPaused] = useState(false);
  const [tabs, setTabs] = useState<TvTab[]>(() => {
    if (typeof window === "undefined") return DEFAULT_TV_TABS;
    try {
      const s = localStorage.getItem("qf-tv-tabs");
      if (s) {
        const parsed = JSON.parse(s) as TvTab[];
        if (Array.isArray(parsed) && parsed.length === DEFAULT_TV_TABS.length) return parsed;
      }
    } catch {}
    return DEFAULT_TV_TABS;
  });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try { localStorage.setItem("qf-tv-tabs", JSON.stringify(tabs)); } catch {}
    }
  }, [tabs]);

  const enabled = useMemo(() => tabs.filter((t) => t.enabled), [tabs]);
  const currentIndex = Math.max(0, enabled.findIndex((t) => t.to === currentPath));
  const currentTab = enabled[currentIndex] || enabled[0];

  useEffect(() => {
    document.body.classList.toggle("tv-mode", tv);
  }, [tv]);

  useEffect(() => {
    if (tv && document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (!tv && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [tv]);

  // rotação automática
  useEffect(() => {
    if (!tv || paused || enabled.length === 0) { setProgress(0); return; }
    const duration = currentTab?.durationMs ?? 60_000;
    const start = Date.now();
    setProgress(0);
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / duration);
      setProgress(p);
      if (elapsed >= duration) {
        onTick?.();
        const nextIdx = (currentIndex + 1) % enabled.length;
        navigate(enabled[nextIdx].to);
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tv, paused, currentIndex, currentTab?.durationMs, enabled.length]);

  const next = useCallback(() => {
    if (enabled.length === 0) return;
    navigate(enabled[(currentIndex + 1) % enabled.length].to);
  }, [currentIndex, enabled, navigate]);
  const prev = useCallback(() => {
    if (enabled.length === 0) return;
    navigate(enabled[(currentIndex - 1 + enabled.length) % enabled.length].to);
  }, [currentIndex, enabled, navigate]);
  const goto = useCallback((to: string) => navigate(to), [navigate]);

  // atalhos teclado
  useEffect(() => {
    if (!tv) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTv(false);
      else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tv, next, prev]);

  return {
    tv,
    paused,
    tabs,
    enabled,
    currentIndex,
    currentTab,
    progress,
    toggle: () => setTv((v) => !v),
    exit: () => setTv(false),
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    togglePause: () => setPaused((p) => !p),
    next,
    prev,
    goto,
    setTabs,
  };
}

export type TvController = ReturnType<typeof useTvController>;

// Hook legado, mantido para compat caso outros lugares importem
export function useTvMode(onTick?: () => void) {
  const [tv, setTv] = useState(false);
  useEffect(() => { document.body.classList.toggle("tv-mode", tv); }, [tv]);
  useEffect(() => {
    if (!tv) return;
    const id = setInterval(() => onTick?.(), 60_000);
    return () => clearInterval(id);
  }, [tv, onTick]);
  return { tv, toggle: () => setTv((v) => !v), exit: () => setTv(false) };
}
