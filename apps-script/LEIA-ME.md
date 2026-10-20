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

## 2. Gravação do QLD/QLDE e do Organograma (Apps Script)

1. Acesse https://script.google.com → **Novo projeto** (projeto separado do script que já existe).
2. Apague o conteúdo padrão, cole todo o arquivo `QualiHub.gs` desta pasta e salve.
3. **Implantar → Nova implantação** → tipo **App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
4. Autorize o acesso à planilha e ao Drive e copie a URL que termina em `/exec`.
5. Configure a URL:
   - `.env.local`: `QUALIHUB_SCRIPT_URL=https://script.google.com/macros/s/.../exec`
   - Netlify: variável `QUALIHUB_SCRIPT_URL`.

Na primeira gravação o script cria, se ainda não existirem, as colunas **Motivo**, **Finalizado em** e
**Finalizado por** na aba `QLD-QLDE`, e a aba `ORGANOGRAMA`. As fotos enviadas pelo organograma vão
para a pasta "QualiHub - Fotos do Organograma" no Drive.

Se alterar o código do script depois: **Implantar → Gerenciar implantações → editar → Nova versão**
(assim a URL continua a mesma).
