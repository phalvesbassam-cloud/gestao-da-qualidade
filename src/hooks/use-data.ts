import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardData } from "@/lib/sheets.functions";
import { useFilteredData } from "@/hooks/use-dashboard";
import type { DashboardData } from "@/lib/types";

export function useDashboard(): DashboardData | undefined {
  const fetchData = useServerFn(getDashboardData);
  const q = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchData(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  return q.data;
}

export function useDashboardFiltered() {
  const data = useDashboard();
  const empty: DashboardData = {
    idf: [],
    alerta: [],
    rnc: [],
    fornecedores: [],
    divisoes: [],
    fetchedAt: "",
  };
  const result = useFilteredData(data ?? empty);
  const { previous, compare, compareLabel, currentLabel, ...filtered } = result;
  return { data, filtered, previous, compare, compareLabel, currentLabel };
}
