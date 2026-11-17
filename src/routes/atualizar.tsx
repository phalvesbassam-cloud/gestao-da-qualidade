import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Copy,
  FileSpreadsheet,
  History,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  desfazerImportacao,
  getStatusImportacao,
  importarLinhasPlanilha,
  verificarDuplicadas,
  type StatusAba,
} from "@/lib/sheets.functions";
import {
  ABAS,
  abaConfig,
  chaveDaLinha,
  dataNumero,
  paraDataBR,
  paraNumero,
  type AbaConfig,
  type AbaId,
} from "@/lib/importacao";
import { getAutor, setAutor } from "@/lib/org";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/atualizar")({
  head: () => ({ meta: [{ title: "Atualizar dados — QualiHub" }] }),
  component: AtualizarPage,
});

type Celula = string | number;
type Arquivo = { nome: string; planilhas: Record<string, Celula[][]> };
type StatusLinha = "nova" | "repetida" | "antiga" | "problema";

const NAO_IMPORTAR = -1;
const POR_PAGINA = 50;
const LOTE = 1000;

const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const letra = (i: number) =>
  i < 26
    ? String.fromCharCode(65 + i)
    : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));

function lerArquivo(file: File): Promise<Arquivo> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: "array", cellDates: true });
        const planilhas: Record<string, Celula[][]> = {};
        for (const nome of wb.SheetNames) {
          const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nome], {
            header: 1,
            raw: true,
            defval: "",
            blankrows: false,
          });
          planilhas[nome] = linhas.map((l) =>
            l.map((v) =>
              v instanceof Date
                ? paraDataBR(v)
                : typeof v === "number"
                  ? v
                  : String(v ?? "").trim(),
            ),
          );
        }
        resolve({ nome: file.name, planilhas });
      } catch {
        reject(new Error("Arquivo inválido. Use Excel (.xlsx, .xls) ou CSV."));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/** Linha do cabeçalho: a que mais se parece com os títulos da aba de destino. */
function detectarCabecalho(linhas: Celula[][], alvo: string[]) {
  const alvos = new Set(alvo.map(norm).filter(Boolean));
  let melhor = 0;
  let pontos = -1;
  linhas.slice(0, 15).forEach((l, i) => {
    const p = l.filter((c) => alvos.has(norm(c))).length;
    if (p > pontos) {
      pontos = p;
      melhor = i;
    }
  });
  return melhor;
}

function mapearAutomatico(origem: Celula[], alvo: string[]): number[] {
  const usados = new Set<number>();
  return alvo.map((titulo) => {
    const t = norm(titulo);
    if (!t) return NAO_IMPORTAR;
    let i = origem.findIndex((h, j) => !usados.has(j) && norm(h) === t);
    if (i < 0)
      i = origem.findIndex(
        (h, j) => !usados.has(j) && norm(h) && (norm(h).includes(t) || t.includes(norm(h))),
      );
    if (i >= 0) usados.add(i);
    return i;
  });
}

function formatarValor(valor: unknown, coluna: number, cfg: AbaConfig): Celula {
  if (valor === "" || valor == null) return "";
  if (cfg.colunasData.includes(coluna)) return paraDataBR(valor) || String(valor);
  if (cfg.colunasNumero.includes(coluna)) {
    const n = paraNumero(valor);
    return n == null ? String(valor) : n;
  }
  return typeof valor === "number" ? valor : String(valor).trim();
}

function celulaInvalida(valor: Celula, coluna: number, cfg: AbaConfig) {
  if (valor === "") return false;
  if (cfg.colunasData.includes(coluna)) return !paraDataBR(valor);
  if (cfg.colunasNumero.includes(coluna)) return paraNumero(valor) == null;
  return false;
}

function AtualizarPage() {
  const qc = useQueryClient();
  const getStatus = useServerFn(getStatusImportacao);
  const status = useQuery({
    queryKey: ["status-importacao"],
    queryFn: () => getStatus(),
    staleTime: 30_000,
  });
  const verificar = useServerFn(verificarDuplicadas);
  const importar = useServerFn(importarLinhasPlanilha);
  const desfazer = useServerFn(desfazerImportacao);

  const [abaId, setAbaId] = useState<AbaId>("IDF");
  const cfg = abaConfig(abaId);
  const st = status.data?.abas.find((a) => a.aba === abaId);
  const alvo = st?.cabecalho ?? [];

  const [arquivo, setArquivo] = useState<Arquivo | null>(null);
  const [planilha, setPlanilha] = useState("");
  const [linhaCab, setLinhaCab] = useState(0);
  const [mapa, setMapa] = useState<number[]>([]);
  const [edicoes, setEdicoes] = useState<Record<number, Record<number, Celula>>>({});
  const [excluidas, setExcluidas] = useState<Set<number>>(new Set());
  const [repetidas, setRepetidas] = useState<Set<number> | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | StatusLinha>("todas");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [ignorarRepetidas, setIgnorarRepetidas] = useState(true);
  const [ignorarAntigas, setIgnorarAntigas] = useState(true);
  const [confirmar, setConfirmar] = useState(false);
  const [importando, setImportando] = useState<{ feito: number; total: number } | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const brutas = arquivo?.planilhas[planilha] ?? [];
  const cabecalhoOrigem = brutas[linhaCab] ?? [];
  const dadosOrigem = useMemo(
    () => brutas.slice(linhaCab + 1).filter((l) => l.some((c) => c !== "")),
    [brutas, linhaCab],
  );

  const colunasImportadas = mapa
    .map((origem, destino) => ({ origem, destino }))
    .filter((m) => m.origem !== NAO_IMPORTAR);

  /** Linhas no formato da aba de destino (com as edições feitas na tela). */
  const linhas = useMemo(() => {
    return dadosOrigem.map((l, i) => {
      const destino: Celula[] = alvo.map(() => "");
      for (const { origem, destino: d } of colunasImportadas)
        destino[d] = formatarValor(l[origem], d, cfg);
      const ed = edicoes[i];
      if (ed) for (const [c, v] of Object.entries(ed)) destino[Number(c)] = v;
      return destino;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dadosOrigem, mapa, edicoes, alvo, cfg]);

  const ultimaDataNum = dataNumero(st?.ultimaData ?? "");
  const statusLinhas: StatusLinha[] = useMemo(
    () =>
      linhas.map((l, i) => {
        const chaveVazia = cfg.chave.some((c) => String(l[c] ?? "").trim() === "");
        const invalida = colunasImportadas.some(({ destino }) =>
          celulaInvalida(l[destino], destino, cfg),
        );
        if (chaveVazia || invalida) return "problema";
        if (repetidas?.has(i)) return "repetida";
        if (
          cfg.colunaData != null &&
          ultimaDataNum &&
          dataNumero(paraDataBR(l[cfg.colunaData])) < ultimaDataNum
        )
          return "antiga";
        return "nova";
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linhas, repetidas, ultimaDataNum, cfg],
  );

  const contagem = useMemo(() => {
    const c = { nova: 0, repetida: 0, antiga: 0, problema: 0 };
    statusLinhas.forEach((s, i) => {
      if (!excluidas.has(i)) c[s] += 1;
    });
    return c;
  }, [statusLinhas, excluidas]);

  const vaoImportar = useMemo(
    () =>
      linhas
        .map((l, i) => ({ l, i, s: statusLinhas[i] }))
        .filter(
          ({ i, s }) =>
            !excluidas.has(i) &&
            s !== "problema" &&
            !(s === "repetida" && ignorarRepetidas) &&
            !(s === "antiga" && ignorarAntigas),
        ),
    [linhas, statusLinhas, excluidas, ignorarRepetidas, ignorarAntigas],
  );

  const visiveis = useMemo(() => {
    const termo = norm(busca);
    return linhas
      .map((l, i) => ({ l, i }))
      .filter(({ i }) => filtro === "todas" || statusLinhas[i] === filtro)
      .filter(({ l }) => !termo || l.some((c) => norm(c).includes(termo)));
  }, [linhas, statusLinhas, filtro, busca]);

  const paginas = Math.max(1, Math.ceil(visiveis.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas - 1);

  const reiniciarRevisao = () => {
    setEdicoes({});
    setExcluidas(new Set());
    setRepetidas(null);
    setPagina(0);
    setFiltro("todas");
  };

  const carregar = async (file: File) => {
    try {
      const arq = await lerArquivo(file);
      const nomes = Object.keys(arq.planilhas);
      const escolhida =
        nomes.find((n) => norm(n) === norm(abaId)) ??
        nomes.find((n) => norm(n).includes(norm(abaId))) ??
        nomes[0];
      const cab = detectarCabecalho(arq.planilhas[escolhida] ?? [], alvo);
      setArquivo(arq);
      setPlanilha(escolhida);
      setLinhaCab(cab);
      setMapa(mapearAutomatico(arq.planilhas[escolhida]?.[cab] ?? [], alvo));
      reiniciarRevisao();
      toast.success(`${file.name} carregado. Revise as colunas e os dados antes de importar.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler o arquivo.");
    }
  };

  const trocarPlanilha = (nome: string) => {
    setPlanilha(nome);
    const cab = detectarCabecalho(arquivo?.planilhas[nome] ?? [], alvo);
    setLinhaCab(cab);
    setMapa(mapearAutomatico(arquivo?.planilhas[nome]?.[cab] ?? [], alvo));
    reiniciarRevisao();
  };

  const trocarCabecalho = (n: number) => {
    setLinhaCab(n);
    setMapa(mapearAutomatico(brutas[n] ?? [], alvo));
    reiniciarRevisao();
  };

  const trocarAba = (id: AbaId) => {
    setAbaId(id);
    setArquivo(null);
    setMapa([]);
    reiniciarRevisao();
  };

  const verificarRepetidas = async () => {
    setVerificando(true);
    try {
      const chaves = linhas.map((l) => chaveDaLinha(l, cfg));
      const { repetidas: idx } = await verificar({ data: { aba: abaId, chaves } });
      // repetidas dentro do próprio arquivo também contam
      const vistas = new Map<string, number>();
      const set = new Set(idx);
      chaves.forEach((k, i) => {
        if (vistas.has(k)) set.add(i);
        else vistas.set(k, i);
      });
      setRepetidas(set);
      toast.success(
        set.size ? `${set.size} linhas já existem na planilha.` : "Nenhuma linha repetida.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível comparar com a planilha.");
    } finally {
      setVerificando(false);
    }
  };

  const editar = (linha: number, coluna: number, valor: string) =>
    setEdicoes((e) => ({ ...e, [linha]: { ...(e[linha] ?? {}), [coluna]: valor } }));

  const executarImportacao = async (autor: string) => {
    setAutor(autor);
    setConfirmar(false);
    const colunas = colunasImportadas.map((c) => c.destino);
    // Formata na hora de enviar: datas dd/mm/aaaa e números como número.
    const dados = vaoImportar.map(({ l }) =>
      colunas.map((c) => {
        const v = formatarValor(l[c], c, cfg);
        return v === "" ? null : v;
      }),
    );
    const ultimaData =
      cfg.colunaData != null
        ? (vaoImportar
            .map(({ l }) => paraDataBR(l[cfg.colunaData!]))
            .sort((a, b) => dataNumero(b) - dataNumero(a))[0] ?? "")
        : "";
    setImportando({ feito: 0, total: dados.length });
    let primeira: number | undefined;
    try {
      for (let i = 0; i < dados.length; i += LOTE) {
        const res = await importar({
          data: {
            aba: abaId,
            colunas,
            linhas: dados.slice(i, i + LOTE),
            autor,
            arquivo: arquivo?.nome ?? "",
            ultimaData,
            primeiraLinhaImportacao: primeira,
          },
        });
        primeira ??= res.primeiraLinha;
        setImportando({ feito: Math.min(i + LOTE, dados.length), total: dados.length });
      }
      toast.success(`${dados.length} linhas importadas para a aba ${cfg.titulo}.`);
      setArquivo(null);
      reiniciarRevisao();
      await qc.invalidateQueries({ queryKey: ["status-importacao"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.error(
        `${e instanceof Error ? e.message : "Falha na importação."}${primeira ? " Parte das linhas já foi gravada — use Desfazer se precisar." : ""}`,
        { duration: 10000 },
      );
      await qc.invalidateQueries({ queryKey: ["status-importacao"] });
    } finally {
      setImportando(null);
    }
  };

  const desfazerUltima = async (aba: StatusAba) => {
    const autor = getAutor() || window.prompt("Seu nome:")?.trim() || "";
    if (!autor) return;
    if (
      !confirm(
        `Desfazer a última importação da aba ${abaConfig(aba.aba).titulo} (${aba.ultimaImportacao?.linhas} linhas)?`,
      )
    )
      return;
    try {
      const r = await desfazer({ data: { aba: aba.aba, autor } });
      toast.success(`${r.linhas} linhas removidas da aba ${abaConfig(aba.aba).titulo}.`);
      await qc.invalidateQueries({ queryKey: ["status-importacao"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível desfazer.");
    }
  };

  return (
    <div className="space-y-6">
      {/* HERO */}
      <section className="hero-panel p-6 md:p-8">
        <div className="eyebrow">
          <CloudUpload className="h-3.5 w-3.5" /> Atualizar dados
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
          Importar planilha mestre
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          O sistema grava no SHEETS pelo sistema, sem abrir o SHEETS. 
          Escolha a aba, envie o Excel, confira as colunas e os dados, edite o que precisar e importe só o que é novo.
        </p>
      </section>

      {/* STATUS DAS ABAS */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ABAS.map((a) => {
          const s = status.data?.abas.find((x) => x.aba === a.id);
          const imp = s?.ultimaImportacao;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => trocarAba(a.id)}
              className={cn(
                "surface p-4 text-left transition hover:-translate-y-0.5",
                abaId === a.id && "ring-2 ring-primary",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-base font-bold">{a.titulo}</span>
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{a.descricao}</div>
              {status.isLoading ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lendo a planilha…
                </div>
              ) : (
                <div className="mt-3 space-y-1 text-xs">
                  <Info
                    rotulo="Linhas na planilha"
                    valor={(s?.linhas ?? 0).toLocaleString("pt-BR")}
                  />
                  {a.colunaData != null && (
                    <Info rotulo="Última data importada" valor={s?.ultimaData || "—"} destaque />
                  )}
                  <Info
                    rotulo="Última atualização"
                    valor={
                      imp
                        ? `${new Date(imp.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · ${imp.autor}`
                        : "Ainda não importado pelo site"
                    }
                  />
                  {imp && (
                    <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
                      <span>
                        {imp.desfeitaEm ? "Desfeita · " : ""}
                        {imp.linhas.toLocaleString("pt-BR")} linhas · {imp.arquivo || "arquivo"}
                      </span>
                      {!imp.desfeitaEm && s && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            desfazerUltima(s);
                          }}
                          className="inline-flex items-center gap-1 font-medium text-destructive hover:underline"
                        >
                          <Undo2 className="h-3 w-3" /> Desfazer
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ENVIO DO ARQUIVO */}
      {!arquivo ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            const f = e.dataTransfer.files?.[0];
            if (f) carregar(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "surface flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-12 text-center transition",
            arrastando ? "border-primary bg-primary/5" : "hover:border-primary/50",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.xlsm,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) carregar(f);
              e.target.value = "";
            }}
          />
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Upload className="h-7 w-7" />
          </div>
          <div className="font-display text-lg font-semibold">
            Arraste o Excel da aba {cfg.titulo} aqui
          </div>
          <div className="text-sm text-muted-foreground">
            ou clique para escolher · .xlsx, .xls ou .csv · pode ser a planilha inteira ou só as
            linhas novas
          </div>
          {st?.ultimaData && (
            <div className="chip">
              Última data na planilha: <strong className="text-foreground">{st.ultimaData}</strong>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* CONFIGURAÇÃO */}
          <section className="surface space-y-4 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Arquivo
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <FileSpreadsheet className="h-4 w-4 text-success" /> {arquivo.nome}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Planilha do arquivo</Label>
                <select
                  value={planilha}
                  onChange={(e) => trocarPlanilha(e.target.value)}
                  className="h-9 rounded-lg border bg-background px-2 text-sm"
                >
                  {Object.keys(arquivo.planilhas).map((n) => (
                    <option key={n} value={n}>
                      {n} ({arquivo.planilhas[n].length} linhas)
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Linha do cabeçalho</Label>
                <Input
                  type="number"
                  min={1}
                  value={linhaCab + 1}
                  onChange={(e) => trocarCabecalho(Math.max(0, Number(e.target.value) - 1))}
                  className="h-9 w-24"
                />
              </div>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => setMapa(mapearAutomatico(cabecalhoOrigem, alvo))}
              >
                <RotateCcw className="h-4 w-4" /> Refazer ligação automática
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => setArquivo(null)}
              >
                <Trash2 className="h-4 w-4" /> Trocar arquivo
              </Button>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">
                  Colunas: arquivo → aba {cfg.titulo} da planilha
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {colunasImportadas.length} de {alvo.filter(Boolean).length} colunas ligadas ·
                  confira se cada informação caiu na coluna certa
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {alvo.map((titulo, destino) =>
                  titulo ? (
                    <div
                      key={destino}
                      className={cn(
                        "rounded-lg border p-2",
                        mapa[destino] === NAO_IMPORTAR ? "border-dashed opacity-70" : "bg-muted/30",
                        cfg.chave.includes(destino) &&
                          mapa[destino] === NAO_IMPORTAR &&
                          "border-destructive opacity-100",
                      )}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                        <span className="rounded bg-muted px-1 font-mono text-[10px]">
                          {letra(destino)}
                        </span>
                        <span className="truncate" title={titulo}>
                          {titulo}
                        </span>
                        {cfg.chave.includes(destino) && (
                          <span
                            className="ml-auto rounded bg-primary/10 px-1 text-[9px] text-primary"
                            title="Usada para achar linhas repetidas"
                          >
                            chave
                          </span>
                        )}
                      </div>
                      <select
                        value={mapa[destino] ?? NAO_IMPORTAR}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setMapa((m) => m.map((x, j) => (j === destino ? v : x)));
                          setRepetidas(null);
                        }}
                        className="mt-1 h-8 w-full rounded-md border bg-background px-1.5 text-xs"
                      >
                        <option value={NAO_IMPORTAR}>— não importar —</option>
                        {cabecalhoOrigem.map((h, i) => (
                          <option key={i} value={i}>
                            {letra(i)} · {String(h || "(sem título)")}
                            {dadosOrigem[0]?.[i] !== undefined && dadosOrigem[0]?.[i] !== ""
                              ? ` — ex.: ${String(dadosOrigem[0][i]).slice(0, 18)}`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          </section>

          {/* RESUMO */}
          <section className="surface flex flex-wrap items-center gap-3 p-4">
            <Resumo
              cor="text-success"
              icon={<CheckCircle2 className="h-4 w-4" />}
              rotulo="Novas"
              valor={contagem.nova}
              ativo={filtro === "nova"}
              onClick={() => setFiltro(filtro === "nova" ? "todas" : "nova")}
            />
            <Resumo
              cor="text-info"
              icon={<Copy className="h-4 w-4" />}
              rotulo={repetidas ? "Já existem" : "Já existem (verificar)"}
              valor={contagem.repetida}
              ativo={filtro === "repetida"}
              onClick={() => setFiltro(filtro === "repetida" ? "todas" : "repetida")}
            />
            {cfg.colunaData != null && (
              <Resumo
                cor="text-warning"
                icon={<History className="h-4 w-4" />}
                rotulo={`Antes de ${st?.ultimaData || "—"}`}
                valor={contagem.antiga}
                ativo={filtro === "antiga"}
                onClick={() => setFiltro(filtro === "antiga" ? "todas" : "antiga")}
              />
            )}
            <Resumo
              cor="text-destructive"
              icon={<AlertTriangle className="h-4 w-4" />}
              rotulo="Com problema"
              valor={contagem.problema}
              ativo={filtro === "problema"}
              onClick={() => setFiltro(filtro === "problema" ? "todas" : "problema")}
            />
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={verificarRepetidas}
              disabled={verificando || !colunasImportadas.length}
              className="gap-1.5"
            >
              {verificando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Comparar com a planilha
            </Button>
            <div className="flex flex-col gap-1 text-xs">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={ignorarRepetidas}
                  onCheckedChange={(v) => setIgnorarRepetidas(v === true)}
                />
                Ignorar as que já existem
              </label>
              {cfg.colunaData != null && (
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={ignorarAntigas}
                    onCheckedChange={(v) => setIgnorarAntigas(v === true)}
                  />
                  Ignorar datas antes de {st?.ultimaData || "—"}
                </label>
              )}
            </div>
            <Button
              onClick={() => setConfirmar(true)}
              disabled={!vaoImportar.length || !!importando || !repetidas}
              className="gap-1.5"
              title={!repetidas ? "Clique em Comparar com a planilha antes de importar" : undefined}
            >
              {importando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="h-4 w-4" />
              )}
              {importando
                ? `Importando ${importando.feito}/${importando.total}`
                : `Importar ${vaoImportar.length.toLocaleString("pt-BR")} linhas`}
            </Button>
          </section>

          {/* PRÉVIA EDITÁVEL */}
          <section className="surface overflow-hidden">
            <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
              <div>
                <h2 className="font-display text-sm font-semibold">
                  Prévia exatamente como vai para a planilha
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Clique numa célula para corrigir. Células em vermelho estão com formato inválido.
                  Desmarque uma linha para não importá-la.
                </p>
              </div>
              <div className="flex-1" />
              <label className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setPagina(0);
                  }}
                  placeholder="Buscar na prévia…"
                  className="h-8 w-56 pl-8 text-xs"
                />
              </label>
            </header>
            {colunasImportadas.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Ligue ao menos uma coluna acima.
              </div>
            ) : (
              <div className="max-h-[620px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="w-8 px-2 py-2" />
                      <th className="px-2 py-2">Situação</th>
                      {colunasImportadas.map(({ destino }) => (
                        <th key={destino} className="whitespace-nowrap px-2 py-2">
                          <span className="font-mono">{letra(destino)}</span> {alvo[destino]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis
                      .slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA)
                      .map(({ l, i }) => {
                        const s = statusLinhas[i];
                        const fora = excluidas.has(i);
                        return (
                          <tr
                            key={i}
                            className={cn("border-b border-border/60", fora && "opacity-40")}
                          >
                            <td className="px-2 py-1">
                              <Checkbox
                                checked={!fora}
                                onCheckedChange={(v) =>
                                  setExcluidas((set) => {
                                    const n = new Set(set);
                                    if (v === true) n.delete(i);
                                    else n.add(i);
                                    return n;
                                  })
                                }
                              />
                            </td>
                            <td className="whitespace-nowrap px-2 py-1">
                              <SituacaoBadge s={s} />
                            </td>
                            {colunasImportadas.map(({ destino }) => {
                              const valor = l[destino];
                              const ruim =
                                celulaInvalida(valor, destino, cfg) ||
                                (cfg.chave.includes(destino) && String(valor).trim() === "");
                              return (
                                <td key={destino} className="px-1 py-0.5">
                                  <input
                                    value={String(valor ?? "")}
                                    onChange={(e) => editar(i, destino, e.target.value)}
                                    className={cn(
                                      "w-full min-w-[80px] rounded border border-transparent bg-transparent px-1.5 py-1 outline-none focus:border-primary focus:bg-background",
                                      ruim && "border-destructive/60 bg-destructive/10",
                                      edicoes[i]?.[destino] !== undefined && "bg-warning/10",
                                    )}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
            <footer className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
              <span>
                {visiveis.length.toLocaleString("pt-BR")} linhas
                {Object.keys(edicoes).length > 0 && ` · ${Object.keys(edicoes).length} editadas`}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={paginaAtual === 0}
                  onClick={() => setPagina(paginaAtual - 1)}
                >
                  Anterior
                </Button>
                <span>
                  {paginaAtual + 1} / {paginas}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={paginaAtual >= paginas - 1}
                  onClick={() => setPagina(paginaAtual + 1)}
                >
                  Próxima
                </Button>
              </div>
            </footer>
          </section>
        </>
      )}

      <ConfirmarDialog
        open={confirmar}
        total={vaoImportar.length}
        aba={cfg.titulo}
        colunas={colunasImportadas.length}
        onClose={() => setConfirmar(false)}
        onConfirm={executarImportacao}
      />
    </div>
  );
}

function Info({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className={cn("truncate text-right font-medium", destaque && "font-bold text-primary")}>
        {valor}
      </span>
    </div>
  );
}

function Resumo({
  cor,
  icon,
  rotulo,
  valor,
  ativo,
  onClick,
}: {
  cor: string;
  icon: ReactNode;
  rotulo: string;
  valor: number;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition hover:bg-muted/50",
        ativo && "border-primary bg-primary/5",
      )}
    >
      <span className={cor}>{icon}</span>
      <span>
        <span className="block font-display text-lg font-bold leading-none tabular-nums">
          {valor.toLocaleString("pt-BR")}
        </span>
        <span className="text-[11px] text-muted-foreground">{rotulo}</span>
      </span>
    </button>
  );
}

function SituacaoBadge({ s }: { s: StatusLinha }) {
  const map: Record<StatusLinha, [string, string]> = {
    nova: ["Nova", "bg-success/15 text-success"],
    repetida: ["Já existe", "bg-info/15 text-info"],
    antiga: ["Data antiga", "bg-warning/15 text-warning"],
    problema: ["Com problema", "bg-destructive/15 text-destructive"],
  };
  const [t, c] = map[s];
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", c)}>{t}</span>;
}

function ConfirmarDialog({
  open,
  total,
  aba,
  colunas,
  onClose,
  onConfirm,
}: {
  open: boolean;
  total: number;
  aba: string;
  colunas: number;
  onClose: () => void;
  onConfirm: (autor: string) => void;
}) {
  const [autor, setNome] = useState(getAutor());
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importar {total.toLocaleString("pt-BR")} linhas?</DialogTitle>
          <DialogDescription>
            As linhas serão gravadas no fim da aba <strong>{aba}</strong> da planilha, em {colunas}{" "}
            colunas. Se algo sair errado, use "Desfazer" no card da aba.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Seu nome</Label>
          <Input value={autor} onChange={(e) => setNome(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!autor.trim()}
            onClick={() => onConfirm(autor.trim())}
            className="gap-1.5"
          >
            <CloudUpload className="h-4 w-4" /> Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
