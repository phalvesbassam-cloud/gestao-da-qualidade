# Biblioteca de Templates

Os seis modelos PowerPoint da aba **Templates** são gerados por código, a partir da identidade da
Fras-le Mobility (vermelho `#EC1C24`, grafite `#54565B`, branco).

| Arquivo | Para que serve |
| --- | --- |
| `src/lib/templates/construir.ts` | Desenho de todos os slides (layouts, capas, gráficos, tabelas) e dos slides com dados do sistema. Usado pelo script e pelo navegador. |
| `gerar-templates.mjs` | Monta os 6 `.pptx` (16:9, editáveis) em `public/templates/` e o catálogo `src/lib/templates-catalogo.ts`. |
| `validar-e-exportar.ps1` | Abre cada arquivo no Microsoft PowerPoint, confere slides/gráficos/tabelas e exporta as imagens de pré-visualização (`public/templates/<modelo>/slide-NN.jpg`). |
| `logos.ps1` | Gera as logos usadas nos slides (colorida e branca) a partir de `src/assets/frasle-logo.png`. |

## Atualizar os modelos

```bash
npm run templates
```

O comando gera os arquivos e, em seguida, abre o PowerPoint para validar e exportar as prévias
(precisa do PowerPoint instalado no Windows). Assim a prévia do site é sempre a imagem do próprio
arquivo que será baixado.

Para alterar textos, slides ou a ordem, edite a lista `MODELOS` em `src/lib/templates/construir.ts`.

## Modelo com dados do sistema

Na aba Templates, **Adicionar dados do sistema** liga o modo de seleção: a pessoa navega pelas abas,
clica em *Adicionar* nos cards e gráficos e conclui. O navegador monta o PowerPoint com o mesmo código
do modelo (`construirModelo`), inserindo os dados antes do plano de ação ou só entre capa e encerramento.
