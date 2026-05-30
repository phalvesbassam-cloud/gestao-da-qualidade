import { Link, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  ClipboardCheck,
  AlertTriangle,
  FileWarning,
  RefreshCw,
  Moon,
  Sun,
  Tv,
  Filter,
  Search,
  X,
  GitCompareArrows,
  Repeat,
  History,
  Settings,
  Users,
  ScanBarcode,
  Cog,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Pin,
  PinOff,
  Activity,
} from "lucide-react";


import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";


import { getDashboardData } from "@/lib/sheets.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/multi-select";
import { FiltersProvider, useFilters, useTheme, useTvController } from "@/hooks/use-dashboard";
import { TvControls } from "@/components/tv-controls";
import { ErrorBoundary } from "@/components/error-boundary";
import type { DashboardData } from "@/lib/types";
import { useDashboardFiltered } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import logo from "@/assets/frasle-logo.png";

const NAV = [
  { to: "/", label: "Consolidado", icon: LayoutDashboard },
  { to: "/idf", label: "IDF", icon: ClipboardCheck },
  { to: "/alerta", label: "Alertas", icon: AlertTriangle },
  { to: "/rnc", label: "RNC", icon: FileWarning },
  { to: "/inspecao", label: "Inspeção", icon: Activity },
  { to: "/auditoria", label: "Auditoria", icon: History },
  { to: "/admin", label: "Admin", icon: Settings },
] as const;

export function AppShell() {
  return (
    <FiltersProvider>
      <Shell />
    </FiltersProvider>
  );
}

function Shell() {
  const fetchData = useServerFn(getDashboardData);
  const q = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchData(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const router = useRouter();
  const location = useLocation();
  const { filters } = useFilters();
  const { dark, mounted, toggle: toggleTheme } = useTheme();
  const [hover, setHover] = useState(false);

  const navigateTo = useCallback(
    (to: string) => { router.navigate({ to }); },
    [router],
  );
  const tvOnTick = useCallback(() => { q.refetch(); }, [q]);
  const tvCtl = useTvController(location.pathname, navigateTo, tvOnTick);
  const { tv, toggle: toggleTv } = tvCtl;

  const sidebarOpen = hover && !tv;
  const sidebarVisible = !tv;

  return (
    <div className="min-h-screen">
      {/* Sidebar — collapsed rail, expand on hover */}
      {sidebarVisible && (
        <aside
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className={cn(
            "hidden md:flex fixed inset-y-0 left-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-40 transition-[width] duration-200 ease-out overflow-hidden",
            sidebarOpen ? "w-60" : "w-16",
          )}
        >
          <div className="px-2 py-3 border-b border-sidebar-border bg-white flex items-center justify-center h-16 shrink-0">
            <div className="logo-glow inline-flex items-center justify-center">
              <img
                src={logo}
                alt="Frasle Mobility"
                className={cn("object-contain transition-all", sidebarOpen ? "h-10 w-auto" : "h-8 w-8")}
              />
            </div>
          </div>
          {sidebarOpen && (
            <div className="px-5 pt-4 pb-2">
              <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">Qualidade</div>
              <div className="text-sm font-display font-semibold text-sidebar-primary-foreground mt-0.5 whitespace-nowrap">
                Gestão de Fornecedores
              </div>
            </div>
          )}
          <nav className="flex-1 px-2 py-2 space-y-1">
            {NAV.map((n) => {
              const active = location.pathname === n.to;
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  title={n.label}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors whitespace-nowrap",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {sidebarOpen && <span>{n.label}</span>}
                </Link>
              );
            })}
          </nav>
          {sidebarOpen && (
            <div className="p-4 text-[10px] text-sidebar-foreground/50 border-t border-sidebar-border whitespace-nowrap">
              Última leitura:{" "}
              {q.data?.fetchedAt ? new Date(q.data.fetchedAt).toLocaleTimeString("pt-BR") : "—"}
            </div>
          )}
        </aside>
      )}

      {/* TV mode mini logo */}
      {tv && (
        <div className="fixed top-3 left-3 z-40 bg-white rounded-md px-2 py-1 shadow logo-glow">
          <img src={logo} alt="Frasle" className="h-6 w-auto" />
        </div>
      )}

      {/* Conteúdo principal */}
      <div className={cn("flex flex-col min-w-0 transition-[margin] duration-200", !tv && "md:ml-16")}>
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b">
          <div className="flex items-center gap-3 px-4 md:px-6 py-3">
            <PageTitle />
            <div className="flex-1" />
            <div className="tv-hide flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => q.refetch()} disabled={q.isFetching} title="Atualizar">
                <RefreshCw className={cn("h-4 w-4", q.isFetching && "animate-spin")} />
                <span className="hidden md:inline ml-1">Atualizar</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={toggleTheme} title="Alternar tema">
                {mounted && dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="hidden md:inline ml-1">{mounted && dark ? "Claro" : "Escuro"}</span>
              </Button>
              <Button size="sm" variant={tv ? "default" : "outline"} onClick={toggleTv} title="Modo TV">
                <Tv className="h-4 w-4 mr-1" /> TV
              </Button>
            </div>
            {tv && (
              <div className="flex items-center gap-2 text-xs">
                <span className="tv-pulse inline-block h-2 w-2 rounded-full bg-success" />
                <span className="text-muted-foreground">ao vivo</span>
              </div>
            )}
          </div>
          <FilterBar data={q.data} />
        </header>

        <main className={cn("flex-1 p-4 md:p-6", tv && "tv-fade")} key={tv ? location.pathname : undefined}>
          {q.isError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive p-4 mb-4">
              <div className="font-semibold mb-1">Erro ao carregar a planilha</div>
              <div className="text-sm whitespace-pre-wrap">{String(q.error)}</div>
            </div>
          )}
          <ErrorBoundary resetKey={`${location.pathname}:${q.data?.fetchedAt ?? ""}:${JSON.stringify(filters)}`}>
            <CompareBanner />
            {q.isLoading && !q.data ? <LoadingState /> : q.data ? <Outlet /> : null}
          </ErrorBoundary>
        </main>

      </div>
      <TvControls controller={tvCtl} />
    </div>
  );
}

function PageTitle() {
  const loc = useLocation();
  const n = NAV.find((x) => x.to === loc.pathname);
  const subtitles: Record<string, string> = {
    "/": "Visão executiva da qualidade de fornecedores",
    "/idf": "Índice de desempenho de fornecedores",
    "/alerta": "Alertas da qualidade",
    "/rnc": "Não conformidades registradas",
    "/inspecao": "Monitoramento operacional e desempenho da equipe",
    "/auditoria": "Trilha de auditoria",
    "/admin": "Configurações do dashboard",
  };
  const labels: Record<string, string> = {
    "/inspecao": "Gestão de Inspeção",
  };
  return (
    <div className="flex flex-col leading-tight">
      <h1 className="text-base md:text-xl font-display font-semibold tracking-tight">{labels[loc.pathname] ?? n?.label ?? "Dashboard"}</h1>
      <span className="hidden md:inline text-[11px] text-muted-foreground">
        {subtitles[loc.pathname] ?? "Gestão da Qualidade de Fornecedores"}
      </span>
    </div>
  );
}

function FilterBar({ data }: { data?: DashboardData }) {
  const { filters, setFilters, reset } = useFilters();

  const fornecedores = useMemo(
    () => (data ? [...data.fornecedores.map((f) => f.fornecedor)].sort() : []),
    [data],
  );
  const statusRncOpts = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.rnc.map((r) => r.statusRNC).filter(Boolean))].sort();
  }, [data]);

  const activeCount =
    filters.divisao.length +
    filters.fornecedor.length +
    filters.statusRNC.length +
    filters.statusAlerta.length +
    filters.status.length +
    (filters.item ? 1 : 0) +
    (filters.processo ? 1 : 0) +
    (filters.search ? 1 : 0) +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0) +
    (filters.compare ? 1 : 0) +
    (filters.recorrencia !== "todas" ? 1 : 0);
  const hasFilters = activeCount > 0;

  // Auto-recolher ao rolar
  const [pinned, setPinned] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [manualOpen, setManualOpen] = useState(true);
  const leaveTimer = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
  }, []);

  const collapsed = scrolled && !pinned && !manualOpen;
  const showPanel = !collapsed || hovering;
  const floating = collapsed && hovering;

  const handleEnter = () => {
    if (leaveTimer.current) { window.clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    if (collapsed) setHovering(true);
  };
  const handleLeave = () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setHovering(false), 140);
  };

  return (
    <div
      className="tv-hide relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* Aba compacta (sempre visível) */}
      <div className="filter-tab">
        <Filter className="h-3.5 w-3.5 text-primary" />
        <span className="font-semibold uppercase tracking-wider text-[11px] text-muted-foreground">
          Filtros
        </span>
        {hasFilters && (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold">
            {activeCount} ativo{activeCount > 1 ? "s" : ""}
          </Badge>
        )}
        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
          >
            Limpar tudo
          </button>
        )}

        <div className="flex-1" />

        {data && (
          <div className="hidden md:flex items-center gap-2 mr-1">
            <div className="kpi-mini text-info">
              <span className="kpi-icon"><ClipboardCheck className="h-4 w-4" /></span>
              <div className="flex flex-col">
                <span className="kpi-value text-foreground">{data.idf.length.toLocaleString("pt-BR")}</span>
                <span className="kpi-label">IDF</span>
              </div>
            </div>
            <div className="kpi-mini text-warning">
              <span className="kpi-icon"><AlertTriangle className="h-4 w-4" /></span>
              <div className="flex flex-col">
                <span className="kpi-value text-foreground">{data.alerta.length.toLocaleString("pt-BR")}</span>
                <span className="kpi-label">AQ</span>
              </div>
            </div>
            <div className="kpi-mini text-destructive">
              <span className="kpi-icon"><FileWarning className="h-4 w-4" /></span>
              <div className="flex flex-col">
                <span className="kpi-value text-foreground">{data.rnc.length.toLocaleString("pt-BR")}</span>
                <span className="kpi-label">RNC</span>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          className="filter-tab-btn"
          data-active={pinned ? "true" : "false"}
          onClick={() => setPinned((p) => !p)}
          title={pinned ? "Desfixar filtros" : "Fixar filtros abertos"}
        >
          {pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          className="filter-tab-btn"
          onClick={() => setManualOpen((o) => !o)}
          title={showPanel ? "Ocultar filtros" : "Mostrar filtros"}
        >
          {showPanel ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Painel completo — sempre montado, colapsa com grid-rows */}
      <div
        className={cn(
          "filter-panel-wrap",
          showPanel ? "filter-panel-wrap--open" : "filter-panel-wrap--closed",
          floating && "filter-panel-wrap--floating",
        )}
        aria-hidden={!showPanel}
      >
        <div className="filter-panel-inner">
          <div className="filter-shell px-4 md:px-6 py-3 space-y-2.5">

          {/* Linha 2 — filtros principais */}
          <div className="filter-grid-primary">
            <MultiSelect
              label="Divisão"
              icon={<LayoutDashboard className="h-3.5 w-3.5" />}
              options={data?.divisoes ?? []}
              value={filters.divisao}
              onChange={(v) => setFilters({ divisao: v })}
            />
            <MultiSelect
              label="Fornecedor"
              icon={<Users className="h-3.5 w-3.5" />}
              options={fornecedores}
              value={filters.fornecedor}
              onChange={(v) => setFilters({ fornecedor: v })}
            />
            <MultiSelect
              label="Status RNC"
              icon={<FileWarning className="h-3.5 w-3.5" />}
              options={statusRncOpts}
              value={filters.statusRNC}
              onChange={(v) => setFilters({ statusRNC: v })}
            />
            <MultiSelect
              label="Status"
              icon={<ClipboardCheck className="h-3.5 w-3.5" />}
              options={["Aprovado", "Aprovação Condicional", "Reprovado"]}
              value={filters.status}
              onChange={(v) => setFilters({ status: v })}
            />
            <MultiSelect
              label="Status Alerta"
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              options={["Pendente", "Falta enviar", "Finalizado"]}
              value={filters.statusAlerta}
              onChange={(v) => setFilters({ statusAlerta: v })}
            />
          </div>

          {/* Linha 3 — filtros secundários */}
          <div className="filter-grid-secondary">
            <label className="filter-control" data-active={filters.item ? "true" : "false"}>
              <ScanBarcode className="h-3.5 w-3.5 opacity-70 shrink-0" />
              <input
                type="text"
                placeholder="Item / código"
                value={filters.item}
                onChange={(e) => setFilters({ item: e.target.value })}
              />
              {filters.item && (
                <button type="button" onClick={() => setFilters({ item: "" })} aria-label="Limpar item">
                  <X className="h-3.5 w-3.5 opacity-60 hover:opacity-100" />
                </button>
              )}
            </label>

            <label className="filter-control" data-active={filters.processo ? "true" : "false"}>
              <Cog className="h-3.5 w-3.5 opacity-70 shrink-0" />
              <input
                type="text"
                placeholder="Processo"
                value={filters.processo}
                onChange={(e) => setFilters({ processo: e.target.value })}
              />
              {filters.processo && (
                <button type="button" onClick={() => setFilters({ processo: "" })} aria-label="Limpar processo">
                  <X className="h-3.5 w-3.5 opacity-60 hover:opacity-100" />
                </button>
              )}
            </label>

            <DateField
              value={filters.from}
              onChange={(v) => setFilters({ from: v })}
              placeholder="Data inicial"
            />
            <DateField
              value={filters.to}
              onChange={(v) => setFilters({ to: v })}
              placeholder="Data final"
            />

            <label className="filter-control" data-active={filters.search ? "true" : "false"}>
              <Search className="h-3.5 w-3.5 opacity-70 shrink-0" />
              <input
                type="text"
                placeholder="Buscar fornecedor, item ou código..."
                value={filters.search}
                onChange={(e) => setFilters({ search: e.target.value })}
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => setFilters({ search: "" })}
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5 opacity-60 hover:opacity-100" />
                </button>
              )}
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-active={filters.compare ? "true" : "false"}
                onClick={() => setFilters({ compare: !filters.compare })}
                className="filter-control justify-center cursor-pointer whitespace-nowrap"
                title="Comparar com período anterior equivalente"
              >
                <GitCompareArrows className="h-3.5 w-3.5" />
                <span>Comparar</span>
              </button>
            </div>
          </div>

          {/* Recorrência (linha extra discreta) */}
          <div className="flex flex-wrap items-center gap-2">
            <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
            <Select
              value={filters.recorrencia}
              onValueChange={(v) => setFilters({ recorrencia: v as any })}
            >
              <SelectTrigger
                className="filter-control h-9 w-auto min-w-[210px] text-xs"
                data-active={filters.recorrencia !== "todas" ? "true" : "false"}
                title="Filtrar por reincidência"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Recorrência: Todas</SelectItem>
                <SelectItem value="reincidentes">🔥 Só reincidentes</SelectItem>
                <SelectItem value="nao-reincidentes">Só não reincidentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function CompareBanner() {
  const { filters } = useFilters();
  const { compare, compareLabel, previous, filtered } = useDashboardFiltered();
  if (!compare || !compareLabel) return null;
  const curN = filtered.idf.length + filtered.alerta.length + filtered.rnc.length;
  const prevN = previous ? previous.idf.length + previous.alerta.length + previous.rnc.length : 0;
  return (
    <div className="tv-hide mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 flex items-center gap-3 text-xs">
      <GitCompareArrows className="h-4 w-4 text-primary" />
      <span className="font-medium text-foreground">Modo Comparação:</span>
      <span className="text-muted-foreground">{compareLabel}</span>
      <span className="ml-auto text-muted-foreground">
        {prevN.toLocaleString("pt-BR")} registros (anterior) → <span className="text-foreground font-semibold">{curN.toLocaleString("pt-BR")} (atual)</span>
      </span>
      {!filters.from && !filters.to && (
        <span className="text-[10px] text-muted-foreground italic">(janela automática: últimos 30 dias)</span>
      )}
    </div>
  );
}


function LoadingState() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
      ))}
    </div>
  );
}

function parseISODate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function DateField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseISODate(value);
  const label = selected
    ? selected.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    : placeholder;
  const active = Boolean(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-active={active ? "true" : "false"}
          data-state={open ? "open" : "closed"}
          className="filter-control justify-between cursor-pointer"
          title={placeholder}
        >
          <span className="flex items-center gap-2 min-w-0">
            <CalendarDays className="h-3.5 w-3.5 opacity-70 shrink-0" />
            <span className={cn("truncate", !active && "text-muted-foreground")}>{label}</span>
          </span>
          {active ? (
            <X
              className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-0 rounded-xl border-border/70 bg-popover/95 backdrop-blur-xl shadow-2xl animate-in fade-in-0 zoom-in-95"
      >
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selected}
          onSelect={(d) => {
            if (d) onChange(toISODate(d));
            else onChange("");
            setOpen(false);
          }}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
