# Registro de Decisões — App de Roteiros QAgro

Cada decisão importante do projeto, com contexto e motivo. Novas decisões são acrescentadas ao final; decisões substituídas são marcadas, não apagadas.

---

## D1 — Planilha Google como fonte de verdade
**Data:** 26/09/2026 · **Status:** aceita

**Contexto:** o coordenador precisa atualizar roteiros diariamente e ter controle total dos dados; todos os aparelhos são Android.
**Decisão:** Google Sheets guarda roteiros, usuários, configuração e histórico de marcações.
**Motivo:** gratuito, já familiar, serve ao mesmo tempo de banco de dados e de painel de controle; alterações sem código.
**Alternativas descartadas:** Firebase/Supabase (exigiriam painel à parte para o coordenador); servidor próprio (custo e manutenção).

## D2 — PWA própria em vez de AppSheet ou KoboToolbox/ODK
**Data:** 26/09/2026 · **Status:** aceita

**Decisão:** app web instalável (PWA) com Service Worker e IndexedDB.
**Motivo:** mantém o layout de roteiro já validado (encontro → pontos → término, copiar coordenada, abrir mapa), custo zero, controle total do comportamento offline.
**Alternativas descartadas:** AppSheet (offline robusto, porém visual engessado e licença paga para publicar); KoboToolbox/ODK (feitos para questionário, não para roteiro com status por ponto).

## D3 — Backend em Google Apps Script
**Data:** 26/09/2026 · **Status:** aceita

**Decisão:** Web App do Apps Script vinculado à planilha, endpoint único via POST `text/plain`.
**Motivo:** roda na conta Google do coordenador, sem servidor nem custo; acesso direto à planilha.
**Consequência:** CORS limitado — por isso POST com `Content-Type: text/plain` (sem preflight) e resposta JSON.

## D4 — Identificação por código curto por pessoa
**Data:** 26/09/2026 · **Status:** aceita

**Decisão:** código de 6 caracteres cadastrado na aba `Usuarios`, digitado uma vez no primeiro acesso.
**Motivo:** funciona em qualquer Android, sem conta Google; revogável pela planilha.
**Alternativas descartadas:** login Google (falhas no campo, exige conta); link com código embutido (encaminhamento pelo WhatsApp daria acesso a terceiros).

## D5 — Hospedagem no GitHub Pages
**Data:** 26/09/2026 · **Status:** aceita

**Decisão:** app estático publicado no GitHub Pages (HTTPS gratuito — requisito de Service Worker e GPS).
**Consequência:** no plano gratuito o repositório precisa ser **público**. Aceito porque o código não contém dados; dados só saem da planilha com código válido.
**Descartado:** servir o HTML pelo próprio Apps Script (HtmlService roda em iframe sandbox, sem suporte a Service Worker → sem offline).

## D6 — Papéis e visibilidade
**Data:** 26/09/2026 · **Status:** aceita

- **Entrevistador:** vê apenas os pontos da **própria dupla** (A1, A2, …).
- **Supervisor:** vê todas as duplas; pode marcar status.
- **Admin (coordenador):** como supervisor no app + controle total da planilha.

## D7 — Somente o formato S2 da aba `roteiros`
**Data:** 26/09/2026 · **Status:** aceita

**Contexto:** a S1 usava blocos por equipe (A/B/C) com trechos M1/M2/T1/T2; a partir da S2 os blocos são por dupla (`Equipe A1`…) com encontro próprio.
**Decisão:** o leitor suporta apenas o formato S2 em diante. A S1 fica fora do app.
**Estrutura:** 12 entrevistadores · 3 grupos (A/B/C) de 4 · 6 duplas de 2. O encontro é por dupla (pode diferir entre duplas do mesmo grupo); o **término** é comum ao grupo e passa a ser informado no Planejador por uma nova linha `Ponto de término` no bloco de cada dupla.

## D8 — Sincronização só com o app aberto
**Data:** 26/09/2026 · **Status:** aceita

**Decisão:** sincronizar na abertura, no evento `online`, ao voltar ao primeiro plano, em intervalo configurável e por botão.
**Motivo:** *Background Sync*/*Periodic Background Sync* do Chrome dependem de heurísticas de engajamento e não têm garantia de execução — não servem de base para confiabilidade. A fila local persistente garante que nada se perde.

## D9 — Conflitos: vence a marcação mais recente, status e observação independentes
**Data:** 26/09/2026 · **Status:** aceita (revisada no planejamento)

**Decisão:** `Registros` é somente-acréscimo; reenvios são idempotentes pelo `id_marcacao` (UUID gerado no aparelho). Em `Situacao`, status e observação têm carimbos próprios (`status_em`, `obs_em`): marcações de status só mudam o status/GPS, marcações de observação só mudam a observação; em cada um vence o `marcado_em` mais recente.
**Motivo:** evita que uma observação editada num aparelho apague um status marcado em outro aparelho ainda não sincronizado.

## D10 — GPS automático na marcação de status, também offline
**Data:** 26/09/2026 · **Status:** aceita

**Decisão:** capturar latitude, longitude, precisão, hora do GPS e distância ao ponto planejado em cada marcação de status.
**Detalhes:** GPS mantido "aquecido" enquanto o app está visível (reduz tempo de *fix* sem internet); timeout configurável; **a marcação nunca é bloqueada** — ausência de GPS é registrada com motivo (`SEM_SINAL`, `SEM_PERMISSAO`, …). Distância acima de `gps_limite_m` (padrão 200 m) é destacada na planilha.
**Limite aceito:** sem rastreamento contínuo (navegador não coleta posição com o app fechado).

## D11 — Repositório próprio fora do SistemaFinanceiro
**Data:** 26/09/2026 · **Status:** aceita

**Decisão:** projeto em `C:\aTeste\COPPETEC\roteiro-app`, repositório Git independente.
**Motivo:** sem relação com o sistema financeiro; precisa de repositório próprio para o GitHub Pages.

## D12 — Regras testáveis fora do Google (carregador vm + fonte de dados)
**Data:** 26/09/2026 · **Status:** aceita

**Decisão:** toda regra do servidor fica em `.gs` de JavaScript puro, incluindo a orquestração `atenderRequisicao(req, fonte)`. `Codigo.gs` só implementa a interface *fonte* sobre a planilha. Os testes executam os `.gs` num contexto `vm` do Node com uma fonte em memória; o mesmo par alimenta o servidor local de desenvolvimento.
**Motivo:** o contrato inteiro é testado automaticamente sem conta Google; o app pode ser desenvolvido e testado offline.

## D13 — Publicação por GitHub Actions
**Data:** 26/09/2026 · **Status:** aceita

**Decisão:** o workflow `.github/workflows/pages.yml` roda os testes e publica somente a pasta `app/` no GitHub Pages a cada push na `main`.
**Motivo:** o GitHub Pages "a partir de branch" só serve a raiz ou `/docs`; publicar só `app/` também evita expor `apps-script/`, `testes/` e `docs/` como site (continuam visíveis no repositório público, mas não são dados sensíveis).

## D14 — Verificação offline em Edge headless
**Data:** 26/09/2026 · **Status:** aceita

**Contexto:** o navegador embutido do app Claude não registra Service Worker.
**Decisão:** a verificação automatizada do modo offline usa Edge headless controlado via CDP (`node ferramentas/verificar-offline-edge.js`); o aceite final continua sendo num Android real (Task 12).

## D15 — Proteção contra fórmulas na planilha
**Data:** 26/09/2026 · **Status:** aceita

**Decisão:** o adaptador da planilha (`Codigo.gs`) aplica apóstrofo inicial a textos vindos do app (observação e status) que começam com `=`, `+`, `-` ou `@`, em toda escrita em `Registros` e `Situacao`, inclusive reescritas; os dados de negócio armazenados e o app nunca veem esse apóstrofo. Colunas de texto são formatadas como texto simples; identificadores são validados por formato.
**Motivo:** evita que uma observação vire fórmula e vaze dados da planilha.
