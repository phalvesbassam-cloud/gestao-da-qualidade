// Organograma da Qualidade (Controle de Qualidade + Adequação).
// Os dados editados ficam na aba ORGANOGRAMA da planilha (via Apps Script) e as
// fotos novas numa pasta do Drive. Enquanto nada for salvo, vale o padrão abaixo.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrganograma, saveOrganograma } from "@/lib/sheets.functions";
import ademar from "@/assets/organograma/ademar.jpg";
import ana from "@/assets/organograma/ana.jpg";
import douglas from "@/assets/organograma/douglas.jpg";
import edmir from "@/assets/organograma/edmir.jpg";
import edson from "@/assets/organograma/edson.jpg";
import gildo from "@/assets/organograma/gildo.jpg";
import hayronn from "@/assets/organograma/hayronn.jpg";
import jacklane from "@/assets/organograma/jacklane.jpg";
import josec from "@/assets/organograma/josec.jpg";
import josem from "@/assets/organograma/josem.jpg";
import leonardo from "@/assets/organograma/leonardo.jpg";
import valdice from "@/assets/organograma/valdice.jpg";

export type Pessoa = {
  id: string;
  nome: string; // nome curto, em destaque
  nomeCompleto: string;
  cargo: string;
  email: string;
  foto: string; // "asset:<chave>", "drive:<fileId>" ou "" (iniciais)
  /** "lideranca" ou o id de uma área. */
  areaId: string;
  ordem: number;
};

export type Area = {
  id: string;
  nome: string;
  descricao: string;
  cor: string; // cor de destaque da área
};

export type OrgData = {
  versao: 2;
  titulo: string;
  pessoas: Pessoa[];
  areas: Area[];
  atualizadoEm?: string;
  atualizadoPor?: string;
};

export const LIDERANCA = "lideranca";

const ASSETS: Record<string, string> = {
  ademar,
  ana,
  douglas,
  edmir,
  edson,
  gildo,
  hayronn,
  jacklane,
  josec,
  josem,
  leonardo,
  valdice,
};

export function fotoUrl(foto: string): string {
  if (!foto) return "";
  if (foto.startsWith("asset:")) return ASSETS[foto.slice(6)] ?? "";
  if (foto.startsWith("drive:"))
    return `https://drive.google.com/thumbnail?id=${foto.slice(6)}&sz=w480`;
  return foto;
}

export function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

const INSPETOR = "Inspetor de Produto - Fornecedor";
const ASSIST_QUALIDADE = "Assistente da Qualidade";

function p(
  id: string,
  nome: string,
  nomeCompleto: string,
  cargo: string,
  areaId: string,
  ordem: number,
  foto = "",
  email = "",
): Pessoa {
  return { id, nome, nomeCompleto, cargo, areaId, ordem, foto, email };
}

export const ORG_PADRAO: OrgData = {
  versao: 2,
  titulo: "Qualidade de Fornecedores",
  areas: [
    {
      id: "controle-qualidade",
      nome: "Controle de Qualidade",
      descricao: "Inspeção de recebimento, análise e gestão dos indicadores de fornecedores",
      cor: "#E30613",
    },
    {
      id: "adequacao",
      nome: "Adequação",
      descricao: "Retrabalho, adequação e tratativa de materiais não conformes",
      cor: "#2563EB",
    },
  ],
  pessoas: [
    p(
      "edmir",
      "Edmir",
      "Edmir",
      "Gerente Produto Engenharia e Qualidade",
      LIDERANCA,
      0,
      "asset:edmir",
      "edmir.sassiloto@fraslemobility.com",
    ),
    p(
      "gildo",
      "Gildo",
      "Gildo",
      "Coordenador de Eng do Produto e Qualidade",
      LIDERANCA,
      1,
      "asset:gildo",
      "gildo.neto@fraslemobility.com",
    ),

    p(
      "hayronn",
      "Hayronn",
      "Hayronn Benicio",
      "Analista da Qualidade PL",
      "controle-qualidade",
      0,
      "asset:hayronn",
    ),
    p("pedro", "Pedro", "Pedro Soares", "Assistente Administrativo", "controle-qualidade", 1),
    p("ademar", "Ademar", "Ademar Ribas", INSPETOR, "controle-qualidade", 2, "asset:ademar"),
    p("ana", "Ana Keila", "Ana Keila", INSPETOR, "controle-qualidade", 3, "asset:ana"),
    p("douglas", "Douglas", "Douglas Lopes", INSPETOR, "controle-qualidade", 4, "asset:douglas"),
    p("edson", "Edson", "Edson", INSPETOR, "controle-qualidade", 5, "asset:edson"),
    p(
      "jacklane",
      "Jacklane",
      "Jacklane Freire",
      INSPETOR,
      "controle-qualidade",
      6,
      "asset:jacklane",
    ),
    p(
      "leonardo",
      "Leonardo",
      "Leonardo Wohlers",
      INSPETOR,
      "controle-qualidade",
      7,
      "asset:leonardo",
    ),

    p("valdice", "Valdice", "Valdice Gomes", ASSIST_QUALIDADE, "adequacao", 0, "asset:valdice"),
    p("josem", "José Machado", "José Machado", ASSIST_QUALIDADE, "adequacao", 1, "asset:josem"),
    p("josec", "José Carlos", "José Carlos", ASSIST_QUALIDADE, "adequacao", 2, "asset:josec"),
    p("leandro", "Leandro", "Leandro Froes", ASSIST_QUALIDADE, "adequacao", 3),
  ],
};

export function normalizarOrg(raw: unknown): OrgData {
  const o = raw as Partial<OrgData> | null;
  if (!o || !Array.isArray(o.pessoas) || !Array.isArray(o.areas)) return ORG_PADRAO;
  return {
    versao: 2,
    titulo: String(o.titulo ?? ORG_PADRAO.titulo),
    areas: o.areas.map((a) => ({
      id: String(a.id),
      nome: String(a.nome ?? ""),
      descricao: String(a.descricao ?? ""),
      cor: String(a.cor ?? "#E30613"),
    })),
    pessoas: o.pessoas.map((x) => ({
      id: String(x.id),
      nome: String(x.nome ?? ""),
      nomeCompleto: String(x.nomeCompleto ?? x.nome ?? ""),
      cargo: String(x.cargo ?? ""),
      email: String(x.email ?? ""),
      foto: String(x.foto ?? ""),
      areaId: String(x.areaId ?? LIDERANCA),
      ordem: Number(x.ordem) || 0,
    })),
    atualizadoEm: o.atualizadoEm,
    atualizadoPor: o.atualizadoPor,
  };
}

export function pessoasDa(org: OrgData, areaId: string) {
  return org.pessoas.filter((x) => x.areaId === areaId).sort((a, b) => a.ordem - b.ordem);
}

/** Agrupa as pessoas de uma área por cargo, na ordem em que os cargos aparecem. */
export function gruposPorCargo(pessoas: Pessoa[]) {
  const grupos: { cargo: string; pessoas: Pessoa[] }[] = [];
  for (const pessoa of pessoas) {
    const g = grupos.find((x) => x.cargo === pessoa.cargo);
    if (g) g.pessoas.push(pessoa);
    else grupos.push({ cargo: pessoa.cargo, pessoas: [pessoa] });
  }
  return grupos;
}

// Enquanto o Apps Script de gravação não estiver publicado, as edições ficam
// guardadas neste navegador (só quem editou vê) e o aviso explica o porquê.
const LOCAL_KEY = "qf-organograma-local";

function lerLocal(): OrgData | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? normalizarOrg(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export type OrgOrigem = "planilha" | "local" | "padrao";

export function useOrganograma() {
  const fetchOrg = useServerFn(getOrganograma);
  return useQuery({
    queryKey: ["organograma"],
    queryFn: async (): Promise<{ org: OrgData; salvo: boolean; origem: OrgOrigem }> => {
      const { json } = await fetchOrg();
      if (json) {
        try {
          return { org: normalizarOrg(JSON.parse(json)), salvo: true, origem: "planilha" };
        } catch {
          /* cai para o local/padrão */
        }
      }
      const local = lerLocal();
      if (local) return { org: local, salvo: true, origem: "local" };
      return { org: ORG_PADRAO, salvo: false, origem: "padrao" };
    },
    staleTime: 60_000,
  });
}

export function useSaveOrganograma() {
  const save = useServerFn(saveOrganograma);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { org: OrgData; autor: string }) => {
      try {
        const res = await save({ data: { json: JSON.stringify(v.org), autor: v.autor } });
        try {
          localStorage.removeItem(LOCAL_KEY);
        } catch {
          /* sem armazenamento */
        }
        return { atualizadoEm: res.atualizadoEm, origem: "planilha" as OrgOrigem };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (!msg.includes("não configurada")) throw e;
        const atualizadoEm = new Date().toISOString();
        localStorage.setItem(
          LOCAL_KEY,
          JSON.stringify({ ...v.org, atualizadoEm, atualizadoPor: v.autor }),
        );
        return { atualizadoEm, origem: "local" as OrgOrigem };
      }
    },
    onSuccess: (res, v) => {
      qc.setQueryData(["organograma"], {
        org: { ...v.org, atualizadoEm: res.atualizadoEm, atualizadoPor: v.autor },
        salvo: true,
        origem: res.origem,
      });
    },
  });
}

/** Reduz a foto para 480px (JPEG) antes do envio. */
export function redimensionarFoto(file: File, max = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
      img.onload = () => {
        const s = Math.min(img.width, img.height);
        const sx = (img.width - s) / 2;
        const sy = img.height > img.width ? (img.height - s) / 4 : 0;
        const canvas = document.createElement("canvas");
        canvas.width = max;
        canvas.height = max;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, sx, sy, s, s, 0, 0, max, max);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** Nome de quem está editando (lembrado neste navegador). */
export function getAutor() {
  try {
    return localStorage.getItem("qf-autor") ?? "";
  } catch {
    return "";
  }
}
export function setAutor(nome: string) {
  try {
    localStorage.setItem("qf-autor", nome);
  } catch {
    /* sem armazenamento local */
  }
}
