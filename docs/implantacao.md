# Implantação — App de Roteiros QAgro

Passo a passo para colocar o sistema no ar pela primeira vez. Tempo estimado: 30 minutos.

## 1. Planilha Google

1. Em drive.google.com, crie uma planilha chamada **Roteiros QAgro — COPPETEC**.
2. **Extensões ▸ Apps Script**. No editor:
   - Apague o conteúdo de `Código.gs` e renomeie o arquivo para `Codigo`.
   - Crie os arquivos `Geo`, `Leitor` e `Regras` (botão **+ ▸ Script**).
   - Cole em cada um o conteúdo do arquivo de mesmo nome da pasta `apps-script/` deste repositório (`Codigo.gs`, `Geo.gs`, `Leitor.gs`, `Regras.gs`).
   - **Configurações do projeto** (engrenagem) ▸ marque *Mostrar arquivo de manifesto "appsscript.json"* ▸ volte ao editor e substitua o conteúdo de `appsscript.json` pelo de `apps-script/appsscript.json`.
   - Salve (Ctrl+S).
3. No editor, selecione a função `configurarPlanilha` e clique em **Executar**. Autorize o acesso quando pedido (conta do coordenador).
4. Volte à planilha e recarregue a página: aparece o menu **Roteiros** e as abas `roteiros`, `Usuarios`, `Config`, `Registros`, `Situacao`.
5. Na aba `Situacao`, abra **Formatar ▸ Formatação condicional** e confira que a regra não está marcada como inválida. Se estiver (planilha em localidade inglesa), troque `;` por `,` na fórmula.

## 2. Publicar o Web App

1. No editor do Apps Script: **Implantar ▸ Nova implantação ▸ tipo: App da Web**.
   - Descrição: `v1`
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
2. Copie a **URL do app da Web** (termina em `/exec`).
3. Teste: abra a URL no navegador — deve aparecer `{"ok":true,"servico":"roteiro-qagro"}`.

> **Ao alterar o código do Apps Script depois:** use **Implantar ▸ Gerenciar implantações ▸ ✏️ ▸ Versão: Nova versão ▸ Implantar**. Criar uma *nova implantação* muda a URL e todos os aparelhos param de sincronizar.

## 3. Primeiro roteiro e usuários

1. Siga [operacao-diaria.md](operacao-diaria.md), seção "Atualizar o roteiro", para colar a aba `roteiros`.
2. Cadastre os usuários na aba `Usuarios` (seção "Usuários" do mesmo documento).

## 4. Publicar o app (GitHub Pages)

1. Em `app/config.js`, troque `COLE_AQUI_A_URL_DO_APPS_SCRIPT` pela URL `/exec` do passo 2.
2. Aumente `VERSAO` (config.js) e `VERSAO_CACHE` (sw.js) se o app já tiver sido publicado antes.
3. Rode `npm test`, faça commit e `git push`.
4. Primeira vez: no GitHub, **Settings ▸ Pages ▸ Build and deployment ▸ Source: GitHub Actions**.
5. Acompanhe em **Actions**; ao terminar, o endereço do app aparece no job `publicar` (ex.: `https://<usuario>.github.io/roteiro-qagro/`).

## 5. Conferência final

Siga o roteiro de aceite da especificação (seção 10, "Manuais") num Android real antes de distribuir o link.
