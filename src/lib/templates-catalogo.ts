// Arquivo gerado por scripts/templates/gerar-templates.mjs — não edite à mão.
export type TemplateSlide = { tipo: string; titulo: string; imagem: string };
export type TemplateModelo = {
  id: string;
  numero: string;
  nome: string;
  titulo: string;
  categoria: string;
  descricao: string;
  usos: string[];
  arquivo: string;
  nomeDownload: string;
  tamanho: number;
  slides: TemplateSlide[];
};

export const TEMPLATES: TemplateModelo[] = [
  {
    "id": "01-executivo",
    "numero": "01",
    "nome": "Executivo",
    "titulo": "Apresentação Executiva",
    "categoria": "Gestão",
    "descricao": "Reuniões gerenciais, resultados para a diretoria e tomada de decisão.",
    "usos": [
      "Reuniões de diretoria",
      "Resultados mensais",
      "Pontos para decisão"
    ],
    "arquivo": "/templates/01-executivo.pptx",
    "nomeDownload": "Fras-le Mobility - Modelo 01 - Executivo.pptx",
    "tamanho": 813479,
    "slides": [
      {
        "tipo": "capa",
        "titulo": "Capa",
        "imagem": "/templates/01-executivo/slide-01.jpg"
      },
      {
        "tipo": "sumario",
        "titulo": "Pauta",
        "imagem": "/templates/01-executivo/slide-02.jpg"
      },
      {
        "tipo": "divisoria",
        "titulo": "Resultados do período",
        "imagem": "/templates/01-executivo/slide-03.jpg"
      },
      {
        "tipo": "kpis",
        "titulo": "Resultados em destaque",
        "imagem": "/templates/01-executivo/slide-04.jpg"
      },
      {
        "tipo": "grafico",
        "titulo": "Evolução mensal versus meta",
        "imagem": "/templates/01-executivo/slide-05.jpg"
      },
      {
        "tipo": "tabela",
        "titulo": "Resumo por área",
        "imagem": "/templates/01-executivo/slide-06.jpg"
      },
      {
        "tipo": "textoImagem",
        "titulo": "Contexto e cenário",
        "imagem": "/templates/01-executivo/slide-07.jpg"
      },
      {
        "tipo": "imagemDestaque",
        "titulo": "Entrega em destaque",
        "imagem": "/templates/01-executivo/slide-08.jpg"
      },
      {
        "tipo": "antesDepois",
        "titulo": "Antes e depois",
        "imagem": "/templates/01-executivo/slide-09.jpg"
      },
      {
        "tipo": "decisoes",
        "titulo": "Pontos para decisão",
        "imagem": "/templates/01-executivo/slide-10.jpg"
      },
      {
        "tipo": "fluxograma",
        "titulo": "Fluxo de aprovação",
        "imagem": "/templates/01-executivo/slide-11.jpg"
      },
      {
        "tipo": "cronograma",
        "titulo": "Próximos passos",
        "imagem": "/templates/01-executivo/slide-12.jpg"
      },
      {
        "tipo": "planoAcao",
        "titulo": "Plano de ação",
        "imagem": "/templates/01-executivo/slide-13.jpg"
      },
      {
        "tipo": "encerramento",
        "titulo": "Encerramento",
        "imagem": "/templates/01-executivo/slide-14.jpg"
      }
    ]
  },
  {
    "id": "02-indicadores",
    "numero": "02",
    "nome": "Indicadores e Resultados",
    "titulo": "Indicadores e Resultados",
    "categoria": "Indicadores",
    "descricao": "KPIs, gráficos, tabelas, comparativos, metas e evolução mensal.",
    "usos": [
      "Reunião de resultados",
      "Painel de KPIs",
      "Análise de tendência"
    ],
    "arquivo": "/templates/02-indicadores.pptx",
    "nomeDownload": "Fras-le Mobility - Modelo 02 - Indicadores e Resultados.pptx",
    "tamanho": 890856,
    "slides": [
      {
        "tipo": "capa",
        "titulo": "Capa",
        "imagem": "/templates/02-indicadores/slide-01.jpg"
      },
      {
        "tipo": "sumario",
        "titulo": "Sumário",
        "imagem": "/templates/02-indicadores/slide-02.jpg"
      },
      {
        "tipo": "kpis",
        "titulo": "Painel de indicadores",
        "imagem": "/templates/02-indicadores/slide-03.jpg"
      },
      {
        "tipo": "divisoria",
        "titulo": "Evolução dos indicadores",
        "imagem": "/templates/02-indicadores/slide-04.jpg"
      },
      {
        "tipo": "grafico",
        "titulo": "Evolução mensal",
        "imagem": "/templates/02-indicadores/slide-05.jpg"
      },
      {
        "tipo": "grafico",
        "titulo": "Tendência de indicadores",
        "imagem": "/templates/02-indicadores/slide-06.jpg"
      },
      {
        "tipo": "grafico",
        "titulo": "Estratificação (Pareto)",
        "imagem": "/templates/02-indicadores/slide-07.jpg"
      },
      {
        "tipo": "tabela",
        "titulo": "Quadro de indicadores",
        "imagem": "/templates/02-indicadores/slide-08.jpg"
      },
      {
        "tipo": "antesDepois",
        "titulo": "Comparativo entre períodos",
        "imagem": "/templates/02-indicadores/slide-09.jpg"
      },
      {
        "tipo": "textoImagem",
        "titulo": "Análise dos desvios",
        "imagem": "/templates/02-indicadores/slide-10.jpg"
      },
      {
        "tipo": "fluxograma",
        "titulo": "Fluxo de apuração",
        "imagem": "/templates/02-indicadores/slide-11.jpg"
      },
      {
        "tipo": "cronograma",
        "titulo": "Cronograma de recuperação",
        "imagem": "/templates/02-indicadores/slide-12.jpg"
      },
      {
        "tipo": "planoAcao",
        "titulo": "Plano de ação",
        "imagem": "/templates/02-indicadores/slide-13.jpg"
      },
      {
        "tipo": "encerramento",
        "titulo": "Encerramento",
        "imagem": "/templates/02-indicadores/slide-14.jpg"
      }
    ]
  },
  {
    "id": "03-engenharia",
    "numero": "03",
    "nome": "Engenharia e Projetos",
    "titulo": "Engenharia e Projetos",
    "categoria": "Engenharia",
    "descricao": "Desenvolvimento de projetos, melhorias, validações, cronogramas e apresentações técnicas.",
    "usos": [
      "Gate de projeto",
      "Validação de produto",
      "Apresentação técnica"
    ],
    "arquivo": "/templates/03-engenharia.pptx",
    "nomeDownload": "Fras-le Mobility - Modelo 03 - Engenharia e Projetos.pptx",
    "tamanho": 881258,
    "slides": [
      {
        "tipo": "capa",
        "titulo": "Capa",
        "imagem": "/templates/03-engenharia/slide-01.jpg"
      },
      {
        "tipo": "sumario",
        "titulo": "Sumário",
        "imagem": "/templates/03-engenharia/slide-02.jpg"
      },
      {
        "tipo": "divisoria",
        "titulo": "Escopo do projeto",
        "imagem": "/templates/03-engenharia/slide-03.jpg"
      },
      {
        "tipo": "textoImagem",
        "titulo": "Escopo e objetivo",
        "imagem": "/templates/03-engenharia/slide-04.jpg"
      },
      {
        "tipo": "especificacao",
        "titulo": "Especificação técnica",
        "imagem": "/templates/03-engenharia/slide-05.jpg"
      },
      {
        "tipo": "imagemDestaque",
        "titulo": "Protótipo / solução proposta",
        "imagem": "/templates/03-engenharia/slide-06.jpg"
      },
      {
        "tipo": "antesDepois",
        "titulo": "Melhoria implementada",
        "imagem": "/templates/03-engenharia/slide-07.jpg"
      },
      {
        "tipo": "kpis",
        "titulo": "Status do projeto",
        "imagem": "/templates/03-engenharia/slide-08.jpg"
      },
      {
        "tipo": "grafico",
        "titulo": "Resultados de validação",
        "imagem": "/templates/03-engenharia/slide-09.jpg"
      },
      {
        "tipo": "tabela",
        "titulo": "Plano de validação",
        "imagem": "/templates/03-engenharia/slide-10.jpg"
      },
      {
        "tipo": "cronograma",
        "titulo": "Cronograma do projeto",
        "imagem": "/templates/03-engenharia/slide-11.jpg"
      },
      {
        "tipo": "fluxograma",
        "titulo": "Fluxo de desenvolvimento",
        "imagem": "/templates/03-engenharia/slide-12.jpg"
      },
      {
        "tipo": "planoAcao",
        "titulo": "Plano de ação",
        "imagem": "/templates/03-engenharia/slide-13.jpg"
      },
      {
        "tipo": "encerramento",
        "titulo": "Encerramento",
        "imagem": "/templates/03-engenharia/slide-14.jpg"
      }
    ]
  },
  {
    "id": "04-qualidade",
    "numero": "04",
    "nome": "Gestão da Qualidade",
    "titulo": "Gestão da Qualidade",
    "categoria": "Qualidade",
    "descricao": "Auditorias, não conformidades, análise de falhas, causa raiz, planos de ação e indicadores da qualidade.",
    "usos": [
      "Análise de não conformidade",
      "Auditorias",
      "8D / causa raiz"
    ],
    "arquivo": "/templates/04-qualidade.pptx",
    "nomeDownload": "Fras-le Mobility - Modelo 04 - Gestão da Qualidade.pptx",
    "tamanho": 830630,
    "slides": [
      {
        "tipo": "capa",
        "titulo": "Capa",
        "imagem": "/templates/04-qualidade/slide-01.jpg"
      },
      {
        "tipo": "sumario",
        "titulo": "Sumário",
        "imagem": "/templates/04-qualidade/slide-02.jpg"
      },
      {
        "tipo": "kpis",
        "titulo": "Indicadores da qualidade",
        "imagem": "/templates/04-qualidade/slide-03.jpg"
      },
      {
        "tipo": "divisoria",
        "titulo": "Descrição do problema",
        "imagem": "/templates/04-qualidade/slide-04.jpg"
      },
      {
        "tipo": "textoImagem",
        "titulo": "Descrição da não conformidade",
        "imagem": "/templates/04-qualidade/slide-05.jpg"
      },
      {
        "tipo": "imagemDestaque",
        "titulo": "Evidência da falha",
        "imagem": "/templates/04-qualidade/slide-06.jpg"
      },
      {
        "tipo": "grafico",
        "titulo": "Pareto dos defeitos",
        "imagem": "/templates/04-qualidade/slide-07.jpg"
      },
      {
        "tipo": "ishikawa",
        "titulo": "Análise de causa (Ishikawa)",
        "imagem": "/templates/04-qualidade/slide-08.jpg"
      },
      {
        "tipo": "cincoPorques",
        "titulo": "5 Porquês",
        "imagem": "/templates/04-qualidade/slide-09.jpg"
      },
      {
        "tipo": "antesDepois",
        "titulo": "Contenção e correção",
        "imagem": "/templates/04-qualidade/slide-10.jpg"
      },
      {
        "tipo": "tabela",
        "titulo": "Checklist de auditoria",
        "imagem": "/templates/04-qualidade/slide-11.jpg"
      },
      {
        "tipo": "fluxograma",
        "titulo": "Fluxo de tratamento de NC",
        "imagem": "/templates/04-qualidade/slide-12.jpg"
      },
      {
        "tipo": "planoAcao",
        "titulo": "Plano de ação",
        "imagem": "/templates/04-qualidade/slide-13.jpg"
      },
      {
        "tipo": "cronograma",
        "titulo": "Cronograma das ações",
        "imagem": "/templates/04-qualidade/slide-14.jpg"
      },
      {
        "tipo": "encerramento",
        "titulo": "Encerramento",
        "imagem": "/templates/04-qualidade/slide-15.jpg"
      }
    ]
  },
  {
    "id": "05-processos",
    "numero": "05",
    "nome": "Processos Industriais",
    "titulo": "Processos Industriais",
    "categoria": "Processos",
    "descricao": "Fluxogramas, procedimentos, etapas operacionais, produtividade e melhorias de processos.",
    "usos": [
      "Mapeamento de processo",
      "Kaizen / melhoria",
      "Procedimento operacional"
    ],
    "arquivo": "/templates/05-processos.pptx",
    "nomeDownload": "Fras-le Mobility - Modelo 05 - Processos Industriais.pptx",
    "tamanho": 819112,
    "slides": [
      {
        "tipo": "capa",
        "titulo": "Capa",
        "imagem": "/templates/05-processos/slide-01.jpg"
      },
      {
        "tipo": "sumario",
        "titulo": "Sumário",
        "imagem": "/templates/05-processos/slide-02.jpg"
      },
      {
        "tipo": "divisoria",
        "titulo": "Visão do processo",
        "imagem": "/templates/05-processos/slide-03.jpg"
      },
      {
        "tipo": "sipoc",
        "titulo": "SIPOC do processo",
        "imagem": "/templates/05-processos/slide-04.jpg"
      },
      {
        "tipo": "fluxograma",
        "titulo": "Fluxograma do processo",
        "imagem": "/templates/05-processos/slide-05.jpg"
      },
      {
        "tipo": "textoImagem",
        "titulo": "Etapa operacional",
        "imagem": "/templates/05-processos/slide-06.jpg"
      },
      {
        "tipo": "tabela",
        "titulo": "Procedimento passo a passo",
        "imagem": "/templates/05-processos/slide-07.jpg"
      },
      {
        "tipo": "kpis",
        "titulo": "Produtividade do processo",
        "imagem": "/templates/05-processos/slide-08.jpg"
      },
      {
        "tipo": "grafico",
        "titulo": "Evolução da produtividade",
        "imagem": "/templates/05-processos/slide-09.jpg"
      },
      {
        "tipo": "antesDepois",
        "titulo": "Melhoria de processo",
        "imagem": "/templates/05-processos/slide-10.jpg"
      },
      {
        "tipo": "imagemDestaque",
        "titulo": "Posto de trabalho padronizado",
        "imagem": "/templates/05-processos/slide-11.jpg"
      },
      {
        "tipo": "cronograma",
        "titulo": "Cronograma de implantação",
        "imagem": "/templates/05-processos/slide-12.jpg"
      },
      {
        "tipo": "planoAcao",
        "titulo": "Plano de ação",
        "imagem": "/templates/05-processos/slide-13.jpg"
      },
      {
        "tipo": "encerramento",
        "titulo": "Encerramento",
        "imagem": "/templates/05-processos/slide-14.jpg"
      }
    ]
  },
  {
    "id": "06-institucional",
    "numero": "06",
    "nome": "Apresentação Institucional",
    "titulo": "Apresentação Institucional",
    "categoria": "Institucional",
    "descricao": "Apresentação de setores, equipes, estruturas, atividades, resultados e projetos da empresa.",
    "usos": [
      "Apresentação de setor",
      "Integração de novos colaboradores",
      "Visitas e clientes"
    ],
    "arquivo": "/templates/06-institucional.pptx",
    "nomeDownload": "Fras-le Mobility - Modelo 06 - Apresentação Institucional.pptx",
    "tamanho": 814505,
    "slides": [
      {
        "tipo": "capa",
        "titulo": "Capa",
        "imagem": "/templates/06-institucional/slide-01.jpg"
      },
      {
        "tipo": "sumario",
        "titulo": "Sumário",
        "imagem": "/templates/06-institucional/slide-02.jpg"
      },
      {
        "tipo": "divisoria",
        "titulo": "Quem somos",
        "imagem": "/templates/06-institucional/slide-03.jpg"
      },
      {
        "tipo": "missaoVisao",
        "titulo": "Missão, visão e valores",
        "imagem": "/templates/06-institucional/slide-04.jpg"
      },
      {
        "tipo": "textoImagem",
        "titulo": "Sobre o setor",
        "imagem": "/templates/06-institucional/slide-05.jpg"
      },
      {
        "tipo": "organograma",
        "titulo": "Estrutura e equipe",
        "imagem": "/templates/06-institucional/slide-06.jpg"
      },
      {
        "tipo": "tabela",
        "titulo": "Atividades da área",
        "imagem": "/templates/06-institucional/slide-07.jpg"
      },
      {
        "tipo": "fluxograma",
        "titulo": "Como trabalhamos",
        "imagem": "/templates/06-institucional/slide-08.jpg"
      },
      {
        "tipo": "kpis",
        "titulo": "Nossos resultados",
        "imagem": "/templates/06-institucional/slide-09.jpg"
      },
      {
        "tipo": "grafico",
        "titulo": "Distribuição das atividades",
        "imagem": "/templates/06-institucional/slide-10.jpg"
      },
      {
        "tipo": "imagemDestaque",
        "titulo": "Projeto em destaque",
        "imagem": "/templates/06-institucional/slide-11.jpg"
      },
      {
        "tipo": "antesDepois",
        "titulo": "Nossa evolução",
        "imagem": "/templates/06-institucional/slide-12.jpg"
      },
      {
        "tipo": "cronograma",
        "titulo": "Projetos e próximos passos",
        "imagem": "/templates/06-institucional/slide-13.jpg"
      },
      {
        "tipo": "planoAcao",
        "titulo": "Plano de ação da área",
        "imagem": "/templates/06-institucional/slide-14.jpg"
      },
      {
        "tipo": "encerramento",
        "titulo": "Encerramento",
        "imagem": "/templates/06-institucional/slide-15.jpg"
      }
    ]
  }
];
