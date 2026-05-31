// Domínio Gestão da Qualidade de Fornecedores

export type DesfechoReprovacao =
  | "Aprovado depois"
  | "Reprovou novamente"
  | "Sem nova entrada"
  | "Não analisado";

export type IDFRow = {
  processo: string;
  divisao: string;
  codigoItem: string;
  quantidade: number;
  dataRecebimento: string; // dd/MM/yyyy
  horaRecebimento: string;
  dataInicioInsp: string;
  horaInicioInsp: string;
  dataFimInsp: string;
  horaFimInsp: string;
  status: string; // Aprovado | Aprovação condicional | Reprovado | ...
  tipoProblema: string;
  problema: string;
  descricaoProblema: string;
  descricaoItem: string;
  fornecedor: string;
  criticidade: string;
  nivel: string;
  codigoFornecedor: string;
  inspetorInicio: string;
  inspetorFinal: string;
  atencao: string;
  lote: string;

  // calculados
  notaNC: number;            // nota NC efetiva (auto OU override manual)
  notaNCBase: number;        // idem (mantido p/ compatibilidade)
  notaNCAuto: number;        // nota calculada automaticamente
  notaOverride: boolean;     // true se foi editada manualmente
  overrideMotivo?: string;
  overrideObservacao?: string;
  overrideAutor?: string;
  overrideAt?: string;
  recorrencia: number;
  irPoints: number;

  // desfecho pós-reprovação
  desfecho?: DesfechoReprovacao;
  desfechoData?: string;
  desfechoProcesso?: string;

  dataReferencia: Date | null;
};

export type AlertaRow = {
  numero: string;
  dataCriacao: string;
  item: string;
  qtde: number;
  lote: string;
  nf: string;
  invoice: string;
  divisao: string;
  fornecedor: string;
  codigoFornecedor: string;
  inspetor: string;
  problema: string;
  observacao: string;
  statusEnvio: string;
  finalizado: boolean;
  dataReferencia: Date | null;
};

export type RNCRow = {
  rnc: string;
  data: string;
  item: string;
  lote: string;
  divisao: string;
  cliente: string;
  assunto: string;
  prazoAnalise: string;
  resultadoAnalise: string;
  statusAnalise: string;
  prazoAcoes: string;
  descrAcao: string;
  acaoConcluida: string;
  statusAcoes: string;
  verEficacia: string;
  dataConclusao: string;
  encerramento: string;
  statusRNC: string;
  dataReferencia: Date | null;
};

export type FornecedorScore = {
  fornecedor: string;
  totalInsp: number;
  aprovados: number;
  condicionais: number;
  reprovados: number;
  pontosNC: number;
  idfPct: number;
  classificacao: "A" | "B" | "C" | "D";
  status: "verde" | "azul" | "amarelo" | "vermelho";
  alertas: number;
  rncs: number;
  ir: number;            // total de pontos IR
  irPct: number;         // % IR (tabela)
  recorrencias: number;  // nº de ocorrências classificadas como recorrência
};

export type DashboardData = {
  idf: IDFRow[];
  alerta: AlertaRow[];
  rnc: RNCRow[];
  fornecedores: FornecedorScore[];
  divisoes: string[];
  fetchedAt: string;
};