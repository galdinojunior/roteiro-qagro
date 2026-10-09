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

> *Revisada pela D16:* a unidade de visibilidade passou a ser a **equipe** (A, B, C); as duplas A1 e A2 deixaram de existir.

## D7 — Somente o formato S2 da aba `roteiros`
**Data:** 26/09/2026 · **Status:** aceita

**Contexto:** a S1 usava blocos por equipe (A/B/C) com trechos M1/M2/T1/T2; a partir da S2 os blocos são por dupla (`Equipe A1`…) com encontro próprio.
**Decisão:** o leitor suporta apenas o formato S2 em diante. A S1 fica fora do app.
**Estrutura:** 12 entrevistadores · 3 grupos (A/B/C) de 4 · 6 duplas de 2. O encontro é por dupla (pode diferir entre duplas do mesmo grupo); o **término** é comum ao grupo e passa a ser informado no Planejador por uma nova linha `Ponto de término` no bloco de cada dupla.

> *Revisada pelas D16 e D17:* os blocos passaram a ser por **equipe** (`Equipe A`; o antigo `Equipe A1` vale `A`), o roteiro cobre um período de vários dias e a coluna `visitas` passou a contar visitas já feitas (não mais `1` = a visitar). O restante do formato S2 (encontro, término, leitura por nome de cabeçalho) continua valendo.

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

## D16 — Equipes de 4 com um roteiro compartilhado
**Data:** 08/10/2026 · **Status:** aceita

**Contexto:** na operação real cada equipe (A, B, C) tem 2 carros com 2 entrevistadores cada; os carros saem e chegam juntos nos mesmos pontos de encontro e de término e seguem pelos dois lados da estrada.
**Decisão:** as duplas A1 e A2 viram uma só equipe, **A** (idem B e C). Os 4 entrevistadores veem o mesmo roteiro; o entrevistador vê os blocos da sua equipe e grava só em chaves da sua equipe. A chave do ponto passa a ser `data|equipe|codigo` (ex.: `2026-10-12|A|AA0001X`). Em `Usuarios`, `Registros` e `Situacao` a coluna `dupla` passa a guardar a **equipe**; valor antigo como `A1` vale `A`.
**Motivo:** a equipe decide no campo quem visita cada ponto, então não há coluna de carro. O cartão mostra o nome de quem marcou e, se dois carros marcam o mesmo ponto sem sinal, vale a marcação mais recente (regra da D9), sem perder nada.
**Consequência:** marcações de teste com chaves antigas (`…|A1|…`) deixam de aparecer; pendentes com chave antiga são recusadas pelo servidor novo (motivo `ponto_fora_da_dupla`, nome mantido por compatibilidade). **Ordem de publicação:** atualizar o Apps Script antes de publicar o app (ou junto); na folga, celular na 1.1.0 com servidor antigo mostra "Nenhum roteiro publicado ainda" (sem erro nem perda), e supervisor ainda na 1.0.0 com servidor novo pode não desenhar a tela até atualizar.

## D17 — Roteiros de vários dias e tentativas por ponto
**Data:** 08/10/2026 · **Status:** aceita

**Contexto:** um roteiro de ~50 pontos cobre 2 ou 3 dias, e um ponto que não foi concluído é revisitado até um limite de tentativas.
**Decisão:** o **período** vem como texto na coluna `ordem` da linha de cabeçalho do bloco (ex.: `12 e 13/10`) e vira a lista de dias do bloco. A mesma lista aparece na aba de cada dia do período e o status marcado num dia vale nos outros (a chave usa a `data` do cabeçalho, que não muda). A coluna `visitas` é o número de visitas **já feitas**; ao chegar a `tentativas_max` (Config, padrão 3) o ponto não é mais enviado ao app. O cartão mostra a etiqueta `2ª tentativa` ou `3ª e última tentativa`.
**Motivo:** reproduz a rotina do Planejador sem exigir colunas novas; o limite de tentativas é configurável na planilha, sem número 3 fixo no código.
**Consequência:** período não reconhecido gera aviso e vale só a data do bloco; a janela de dias do servidor usa o **último dia** do período.

## D18 — Logomarca da Innovare no cabeçalho
**Data:** 08/10/2026 · **Status:** aceita

**Decisão:** a versão positiva horizontal da logomarca do kit da marca, redimensionada para 720 px de largura (`app/img/innovare-logo.png`), aparece grande na tela de entrada e numa faixa de marca no topo da tela principal, acima da barra de sincronização. O ícone do app na tela inicial **não muda** (continua o pino de mapa). O logo entra no cache offline.
**Motivo:** identificação da marca nos aparelhos da equipe.
**Privacidade:** a logomarca é pública por decisão do coordenador; o repositório continua sem dados reais.
