import { useQuery, useQueryClient } from "@tanstack/react-query";
import { decodeDashboard } from "@/lib/wire";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardData } from "@/lib/sheets.functions";
import { useFilteredData } from "@/hooks/use-dashboard";
import type { DashboardData } from "@/lib/types";

/** Consulta única do painel (compartilhada por todas as telas). */
export function useDashboardQuery() {
  const fetchData = useServerFn(getDashboardData);
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => decodeDashboard((await fetchData({ data: {} })).payload),
    staleTime: 2 * 60_000,
    refetchInterval: 3 * 60_000,
    refetchOnWindowFocus: false,
    // ~28 mil linhas: comparar estruturas a cada leitura custa mais do que trocar o objeto.
    structuralSharing: false,
  });
}

/** Busca os dados direto da planilha, ignorando o cache do servidor (botão Atualizar). */
export function useForceRefreshDashboard() {
  const fetchData = useServerFn(getDashboardData);
  const qc = useQueryClient();
  return async () => {
    const data = decodeDashboard((await fetchData({ data: { force: true } })).payload);
    qc.setQueryData(["dashboard"], data);
    return data;
  };
}

export function useDashboard(): DashboardData | undefined {
  return useDashboardQuery().data;
}

export function useDashboardFiltered() {
  const data = useDashboard();
  const empty: DashboardData = {
    idf: [],
    alerta: [],
    rnc: [],
    fornecedores: [],
    divisoes: [],
    qldQlde: [],
    fetchedAt: "",
  };
  const result = useFilteredData(data ?? empty);
  const {
    previous,
    compare,
    compareLabel,
    currentLabel,
    efficiency,
    previousEfficiency,
    ...filtered
  } = result;
  return {
    data,
    filtered,
    previous,
    compare,
    compareLabel,
    currentLabel,
    efficiency,
    previousEfficiency,
  };
}
