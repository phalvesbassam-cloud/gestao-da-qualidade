# Configuração das novidades do QualiHub

Duas configurações são necessárias, uma vez só. As duas são gratuitas.

## 1. QualiAI gratuito (Google Gemini)

1. Acesse https://aistudio.google.com/apikey com uma conta Google e clique em **Create API key**.
   Não precisa cadastrar cartão: o plano gratuito não cobra nada.
2. Coloque a chave nas variáveis de ambiente:
   - No computador (arquivo `.env.local`): `GEMINI_API_KEY=sua-chave`
   - No Netlify: *Site configuration → Environment variables → Add variable* → `GEMINI_API_KEY`.
3. (Opcional) `GEMINI_MODEL` escolhe o modelo. O padrão é `gemini-3.8-flash`, com reserva automática
   para outros modelos gratuitos (`gemini-flash-latest`, `gemini-3.5-flash`…) quando um estiver
   indisponível ou no limite.

A "Pesquisa Google" embutida do Gemini não tem cota gratuita, então o QualiAI pesquisa na web por
conta própria (DuckDuckGo) e lê as páginas encontradas ou os links enviados na pergunta — sem custo.

Obs.: no plano gratuito o Google pode usar as conversas para melhorar os modelos. Evite colar dados
pessoais ou sigilosos nas perguntas.

A variável `OPENAI_API_KEY` não é mais usada e pode ser removida.

## 2. Apps Script do sistema (gravações na planilha)

O arquivo `QualiHub.gs` é o **único** script da planilha: faz tudo o que o script antigo fazia
(auditoria, nota manual do IDF, evidências de RNC) e também QLD/QLDE, organograma e os campos
digitados na tela RDM.

**Se você já colou uma versão anterior deste script no projeto publicado** (é o caso hoje):
1. Abra o projeto do Apps Script publicado.
2. Apague o código, cole todo o `QualiHub.gs` desta pasta e salve.
3. **Implantar → Gerenciar implantações → lápis (editar) → Versão: Nova versão → Implantar.**
   A URL continua a mesma; não precisa mudar nada no site.

**Instalação do zero:** script.google.com → Novo projeto → cole o código → Implantar → Nova
implantação → App da Web (Executar como: Eu · Quem pode acessar: Qualquer pessoa) → copie a URL
`/exec` e configure em `QUALIHUB_SCRIPT_URL`.

## 3. Variáveis no Netlify

Em *Project configuration → Environment variables → Add a variable*:

| Key (nome)            | Value (valor)                         |
|-----------------------|---------------------------------------|
| `GEMINI_API_KEY`      | a chave do Gemini (começa com `AQ.` ou `AIza`) |
| `QUALIHUB_SCRIPT_URL` | a URL `/exec` do Apps Script          |

O campo **Key** é o nome (`GEMINI_API_KEY`); a chave em si vai no campo **Value**. Marque
"Contains secret values". Depois de salvar, faça um novo deploy (*Deploys → Trigger deploy*).
As variáveis só valem para a versão publicada que já tem estas telas (depois do merge no `main`).
