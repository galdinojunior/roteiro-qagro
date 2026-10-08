# App de Roteiros QAgro — Especificação de Design

- **Data:** 26/09/2026
- **Status:** aprovado (design) — aguardando revisão da especificação
- **Projeto:** COPPETEC 2025033 — coleta QAgro em área rural
- **Decisões registradas em:** [decisoes.md](decisoes.md)

---

## 1. Objetivo

Substituir os roteiros HTML estáticos enviados por WhatsApp por um aplicativo que:

1. Recebe o **roteiro atualizado diariamente** a partir de uma planilha que o coordenador controla.
2. **Funciona sem internet** no campo (área rural) — consulta do roteiro e marcação de status.
3. **Sincroniza automaticamente** as marcações quando houver sinal, centralizando tudo numa planilha Google e distribuindo o status entre os membros da dupla e os supervisores.
4. Registra **GPS automático** no momento de cada marcação de status, mesmo offline.

### Fora do escopo (nesta versão)

- Fotos.
- Tela de administração dentro do app (a administração é a própria planilha Google).
- Integração com a aba `ocorr` (resultados do questionário QAgro).
- Rastreamento contínuo de trajeto (GPS só no momento da marcação).

---

## 2. Contexto operacional

| Item | Valor |
|---|---|
| Entrevistadores | 12 |
| Grupos (equipes) | 3 — **A, B, C** — 4 pessoas cada |
| Duplas | 6 — **A1, A2, B1, B2, C1, C2** — 2 pessoas cada |
| Aparelhos | Android, navegador Chrome |
| Canal de distribuição | WhatsApp (link do app) |
| Conectividade | intermitente; dias inteiros sem sinal são possíveis |

Regras de campo:

- Cada **dupla** percorre seu próprio roteiro ordenado de pontos no dia.
- Cada dupla tem um **ponto de encontro** no início do dia (em geral o mesmo das duas duplas do grupo, mas **pode diferir** — ex.: 14/09 A1 em Cidade Um, A2 em Cidade Dois). O app sempre mostra o que está na planilha, por dupla.
- As 4 pessoas do grupo **sempre** se reencontram no **ponto de término** especificado no Planejador.

---

## 3. Arquitetura

```
 Planejador.xlsx (aba roteiros)          Coordenador
          │  copiar/colar valores              │ edita
          ▼                                    ▼
 ┌──────────────────── Planilha Google ─────────────────────┐
 │ roteiros │ Usuarios │ Config │ Registros │ Situacao       │
 └───────────────────────────▲──────────────────────────────┘
                             │ leitura/escrita
                  Google Apps Script (Web App)
                             ▲  HTTPS (JSON)
                             │  só quando há sinal
        ┌────────────────────┴─────────────────────┐
        │  PWA (GitHub Pages) instalada no Android  │
        │  Service Worker + IndexedDB + GPS         │
        └───────────────────────────────────────────┘
```

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| Planilha Google | Google Sheets | Fonte de verdade: roteiros, usuários, configuração, histórico |
| Backend | Google Apps Script publicado como Web App | Autenticar por código, ler/filtrar roteiro, receber marcações |
| App | PWA estática (HTML/CSS/JS puro, sem build) em GitHub Pages | Exibir roteiro offline, marcar status, capturar GPS, fila de sincronização |

Justificativa das escolhas: ver [decisoes.md](decisoes.md) (D1–D6).

---

## 4. Planilha Google

### 4.1 Aba `roteiros` (coordenador cola)

Cópia **integral** da aba `roteiros` do `Planejador.xlsx` (Ctrl+A → Ctrl+C → no Google Sheets, Ctrl+Shift+V "colar somente valores"). Não é preciso limpar linhas-modelo vazias.

Colunas (localizadas pelo **nome do cabeçalho**, não pela posição):

| Cabeçalho | Uso |
|---|---|
| `data` | Data do roteiro |
| `equipe` | Letra do grupo (A/B/C) — conferência |
| `visitas` | `1` = linha de ponto a visitar; `-` = linha estrutural |
| `ordem` | Ordem do ponto no roteiro da dupla |
| `municipio` | Município |
| `ponto` | Código do ponto (ex.: `SB1956U`), ou marcador de estrutura |
| `D` | `1` = possível duplicidade de coordenada |
| `coordenada` | `"lat,lon"` (espaço após vírgula opcional) |
| `obs` | Endereço (nas linhas de encontro/término) ou observação |

#### Regras de leitura (formato S2 em diante)

A leitura percorre as linhas em ordem e reconhece:

| Linha | Critério (coluna `ponto`, sem distinção de maiúsculas/acentos) | Efeito |
|---|---|---|
| Cabeçalho de bloco | casa `^Equipe\s+([A-Z])(\d)$` | Abre bloco da dupla `A1`…; `data` do bloco = coluna `data` |
| Encontro | `Ponto de encontro` | Define encontro do bloco (município, coordenada, endereço=`obs`) |
| Término | `Ponto de término` (aceita também `Ponto de termino`) | Define término do bloco |
| Ponto | `visitas = 1` e `ponto` não vazio e diferente de `-` | Adiciona ponto ao bloco |
| Demais | — | Ignoradas (linhas-modelo, `-`, vazias, cabeçalho da tabela) |

- Pontos são ordenados pela coluna `ordem` (empate: ordem de aparição).
- Bloco sem nenhum ponto é **descartado** (semanas futuras ainda não preenchidas).
- Bloco sem linha de término: término = `null` → app mostra "Término: a definir".
- Datas aceitas: valor de data do Sheets ou texto `dd/mm/aaaa`.
- Linhas de ponto com coordenada ilegível: ponto é mantido, coordenada = `null`, e o problema é listado em `avisos` (ver 5.3).
- **Formato S1 não é suportado** (decisão D7).

#### Mudança no Planejador.xlsx (única alteração no processo atual)

Dentro do bloco de cada dupla, **após o último ponto**, incluir uma linha no mesmo formato da linha de encontro:

| data | equipe | visitas | ordem | municipio | ponto | D | coordenada | obs |
|---|---|---|---|---|---|---|---|---|
| 14/09/2026 | A | - | 21 | Cidade Um | **Ponto de término** | | -20.000000, -44.000000 | Praça Um - Centro |

#### Identificação de um ponto

`chave = <data AAAA-MM-DD>|<dupla>|<codigo>` — ex.: `2026-09-14|A1|SB1956U`.
O mesmo código pode reaparecer em outro dia (revisita); por isso a data compõe a chave.

### 4.2 Aba `Usuarios` (coordenador edita)

| Coluna | Exemplo | Regras |
|---|---|---|
| `nome` | Rafael | Exibido no app e gravado nos registros |
| `codigo` | `K7M2QX` | 6 caracteres, alfabeto sem ambíguos (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`); único |
| `papel` | `entrevistador` \| `supervisor` \| `admin` | |
| `dupla` | `A1` | Obrigatório para entrevistador; ignorado para supervisor/admin |
| `ativo` | `S` \| `N` | `N` bloqueia o acesso na próxima sincronização |

Um menu da planilha (`Roteiros ▸ Gerar código para linha selecionada`) preenche códigos novos.

### 4.3 Aba `Config` (coordenador edita)

Formato chave/valor:

| chave | valor padrão | Significado |
|---|---|---|
| `status` | `Feito;Ausente;Recusa;Não encontrado;Duplicidade` | Botões de status, na ordem |
| `status_sem_obs` | `Feito` | Status em que a observação não é sugerida |
| `dias_passados` | `7` | Quantos dias anteriores a hoje são enviados ao app |
| `gps_limite_m` | `200` | Distância a partir da qual a marcação é destacada em `Situacao` |
| `gps_precisao_max_m` | `100` | Acima disso o GPS é considerado impreciso |
| `gps_timeout_s` | `20` | Espera máxima por uma posição na marcação |
| `sync_intervalo_min` | `5` | Intervalo de sincronização automática com o app aberto |

### 4.4 Aba `Registros` (sistema — somente acréscimo)

Uma linha por marcação recebida. **Nunca é editada nem apagada pelo sistema.**

| Coluna | Descrição |
|---|---|
| `id_marcacao` | UUID gerado no aparelho — garante que reenvio não duplica |
| `recebido_em` | Data/hora do servidor ao gravar |
| `marcado_em` | Data/hora do aparelho no momento da marcação |
| `tipo` | `status` ou `obs` |
| `codigo_usuario`, `nome`, `papel` | Quem marcou |
| `data_roteiro`, `dupla`, `ponto`, `chave` | Qual ponto |
| `status`, `obs` | Estado do ponto após a marcação |
| `lat`, `lon`, `precisao_m`, `hora_gps` | Posição capturada (vazio se não houver) |
| `dist_planejado_m` | Distância até a coordenada planejada do ponto |
| `gps_ok` | `S`, `IMPRECISO`, `SEM_PERMISSAO`, `SEM_SINAL`, `NAO_SUPORTADO` ou `NA` (tipo `obs`) |
| `aparelho_id`, `versao_app` | Diagnóstico |

### 4.5 Aba `Situacao` (sistema — uma linha por ponto marcado)

Colunas: `chave`, `data_roteiro`, `dupla`, `ponto`, `status`, `status_em`, `nome`, `lat`, `lon`, `precisao_m`, `dist_planejado_m`, `gps_ok`, `obs`, `obs_em`, `n_marcacoes`.

Mantida por *upsert* pela `chave`, com status e observação independentes:

- Marcação `tipo: status` altera `status`, `status_em`, `nome` e as colunas de GPS — se `marcado_em ≥ status_em` atual.
- Marcação `tipo: obs` altera `obs` e `obs_em` — se `marcado_em ≥ obs_em` atual.
- `n_marcacoes` soma todas.

Assim, uma observação editada num aparelho nunca apaga um status marcado em outro (e vice-versa).

Formatação condicional: `dist_planejado_m > gps_limite_m` ou `gps_ok` diferente de `S`/`NA` → linha destacada.

Um menu `Roteiros ▸ Reconstruir Situacao` recalcula a aba inteira a partir de `Registros` (recuperação). O menu `Roteiros ▸ Verificar aba roteiros` mostra o resumo por dia e os avisos de leitura logo após colar.

---

## 5. Backend — Apps Script

### 5.1 Publicação

- Apps Script **vinculado à planilha** (Extensões ▸ Apps Script).
- Implantação como **App da Web**: *Executar como: eu* · *Quem pode acessar: qualquer pessoa*.
- A URL `/exec` resultante é configurada no app (`config.js`).
- Função `configurarPlanilha()` cria as abas `Usuarios`, `Config`, `Registros`, `Situacao` com cabeçalhos e valores padrão, se não existirem.

### 5.2 Contrato

Endpoint único `POST <url>/exec`, corpo JSON enviado com `Content-Type: text/plain` (evita *preflight* CORS, que o Apps Script não atende).

**Requisição**

```json
{
  "acao": "sincronizar",
  "codigo": "K7M2QX",
  "aparelho_id": "uuid",
  "versao_app": "1.0.0",
  "registros": [
    {
      "id_marcacao": "uuid", "tipo": "status", "marcado_em": "2026-09-14T10:32:05-03:00",
      "chave": "2026-09-14|A1|AA0001X", "status": "Feito", "obs": "",
      "lat": -20.00102, "lon": -44.00098, "precisao_m": 8, "hora_gps": "2026-09-14T10:32:03-03:00",
      "dist_planejado_m": 14, "gps_ok": "S"
    }
  ]
}
```

`acao = "entrar"` é igual, sem `registros` — usada na primeira abertura.

**Resposta (sucesso)**

```json
{
  "ok": true,
  "servidor_em": "2026-09-14T10:40:00-03:00",
  "usuario": { "nome": "Rafael", "papel": "entrevistador", "dupla": "A1" },
  "config": { "status": ["Feito","Ausente","Recusa","Não encontrado","Duplicidade"], "...": "..." },
  "aceitos": ["uuid", "..."],
  "rejeitados": [{ "id_marcacao": "uuid", "motivo": "ponto_fora_da_dupla" }],
  "roteiro": {
    "gerado_em": "2026-09-14T10:40:00-03:00",
    "blocos": [
      {
        "data": "2026-09-14", "dupla": "A1", "grupo": "A",
        "encontro": { "municipio": "Cidade Um", "lat": -20.0, "lon": -44.0, "endereco": "Praça Um - Centro" },
        "termino":  { "municipio": "Cidade Dois", "lat": -20.1, "lon": -44.1, "endereco": "Mercado Dois" },
        "pontos": [
          { "chave": "2026-09-14|A1|AA0001X", "ordem": 1, "codigo": "AA0001X",
            "municipio": "Cidade Um", "lat": -20.001, "lon": -44.001, "dup": false, "obs": null }
        ]
      }
    ]
  },
  "situacao": [
    { "chave": "2026-09-14|A1|AA0001X", "status": "Feito", "obs": "", "marcado_em": "...", "nome": "Rafael" }
  ],
  "avisos": []
}
```

**Resposta (erro):** `{ "ok": false, "erro": "codigo_invalido" | "usuario_inativo" | "requisicao_invalida" | "falha_interna", "mensagem": "..." }`.

### 5.3 Regras do servidor

- **Autorização por código** em toda requisição. Entrevistador recebe apenas blocos da sua `dupla`; supervisor/admin recebem todos.
- **Janela de dias:** blocos com `data ≥ hoje − dias_passados`, incluindo todos os futuros já publicados.
- **Gravação:** sob `LockService` (evita escrita concorrente). Para cada registro: ignora se `id_marcacao` já existe (conta como aceito); rejeita se a `chave` não pertencer à dupla do entrevistador; senão acrescenta em `Registros` e faz *upsert* em `Situacao`.
- A marcação que o servidor já tinha aceito é sempre devolvida em `aceitos` — o app só remove da fila o que estiver em `aceitos` ou `rejeitados`.
- `avisos`: problemas de leitura da aba `roteiros` (coordenada ilegível, bloco sem encontro) — mostrados só a supervisor/admin.
- Ordem das operações numa sincronização: **gravar registros → ler situação → ler roteiro**, para que a resposta já reflita o que acabou de ser enviado.

---

## 6. App (PWA)

### 6.1 Distribuição e primeiro acesso

1. Coordenador envia o link (GitHub Pages) pelo WhatsApp.
2. Entrevistador abre no **Chrome** → "Instalar app" / "Adicionar à tela inicial".
3. Primeira abertura (**exige sinal**): tela pede o **código** e explica o uso da localização → `acao: entrar` → app baixa roteiro e pede permissão de localização.
4. Daí em diante abre direto no roteiro, com ou sem sinal. O código fica salvo no aparelho; "Sair" (menu) apaga dados locais **somente se a fila estiver vazia** (caso contrário, avisa e bloqueia).

### 6.2 Telas

**Topo fixo:** nome · dupla · indicador de sincronização `● 3 pendentes · últ. sinc. 07:42` (verde = sem pendências e sincronizado há < 1h; laranja = pendências; cinza = nunca sincronizou hoje) · botão **Sincronizar**.

**Seletor de dia:** abas com os dias disponíveis; abre no dia de hoje (ou o próximo dia com roteiro).

**Conteúdo do dia (entrevistador):**

1. Cartão **Encontro** — município, endereço, coordenada (copiar · abrir no mapa).
2. Cartões dos **pontos**, na ordem — nº de ordem, código, município, coordenada (copiar · abrir no mapa via `geo:`), aviso "possível duplicidade" quando `dup`, botões de **status** (vindos de `Config`), campo **observação**, e linha de rodapé com o resultado da última marcação: `Feito · 10:32 · Rafael · GPS ±8 m a 14 m do ponto` ou ícone de alerta (`sem GPS`, `GPS impreciso`, `a 640 m do ponto`).
3. Cartão **Término** — igual ao encontro, ou "Término: a definir".
4. Resumo do dia: contagem por status.

**Supervisor/admin:** mesmo layout, com filtros **Grupo** (A/B/C/todos) e **Dupla**, e um painel-resumo por dupla (pontos · feitos · pendentes). Supervisor também pode marcar status (registrado com o nome dele).

Identidade visual: a dos roteiros atuais (laranja `#EC6707`, cinzas `#3A3A3A/#595959/#9D9D9C/#E7E7E7`, Calibri/Carlito), otimizada para toque (alvos ≥ 44 px).

### 6.3 Armazenamento local

- **IndexedDB** (wrapper mínimo próprio, `app/armazenamento.js`) com duas lojas: `kv` (código, usuário, config, roteiro, situação do servidor, avisos, recusas, última sincronização) e `fila` (marcações pendentes). O estado exibido em cada cartão é calculado por `mesclarSituacao(situacaoServidor, fila)`.
- `navigator.storage.persist()` solicitado no primeiro acesso para evitar que o Chrome apague os dados por falta de espaço.
- **Service Worker** com cache versionado do *app shell* (HTML, CSS, JS, ícones, manifesto). Estratégia *cache-first* para o shell; chamadas ao Apps Script **nunca** passam por cache.
- Atualização do app: nova versão do Service Worker é instalada em segundo plano e ativada na próxima abertura (aviso "Nova versão disponível — toque para atualizar").

### 6.4 Marcação

Ao tocar num status:

1. Gera `id_marcacao` (UUID) e `marcado_em` (relógio do aparelho, com fuso).
2. Captura GPS (seção 7), no máximo `gps_timeout_s`.
3. Calcula `dist_planejado_m` (Haversine) se houver posição e coordenada planejada.
4. Grava na fila (uma transação) — a marcação aparece de imediato no cartão.
5. Dispara sincronização se houver sinal.

Tocar no status já selecionado **gera nova marcação** (nova tentativa de GPS); não desmarca.

Observação: salva ao sair do campo ou após 1,5 s sem digitar; gera marcação `tipo: obs` (sem nova captura de GPS; `gps_ok = NA`), levando o status atual do ponto.

### 6.5 Sincronização

Gatilhos: abertura do app · evento `online` · app volta ao primeiro plano · a cada `sync_intervalo_min` com o app aberto · botão **Sincronizar**.

Algoritmo:

1. Se já houver sincronização em andamento, não inicia outra.
2. Envia **toda a fila** (lotes de até 200) com `acao: sincronizar`.
3. Remove da fila os ids em `aceitos`/`rejeitados`; rejeitados vão para uma lista visível ("1 marcação recusada pelo servidor") com o motivo.
4. Substitui `roteiro` e `situacao` locais pela resposta.
5. **Mescla para exibição:** por chave, vale o registro com maior `marcado_em` entre `situacao` do servidor e o que ainda está na `fila` local.
6. Falha de rede/timeout (30 s): mantém tudo, tenta de novo no próximo gatilho, com espera crescente (30 s, 1 min, 2 min, até o intervalo configurado).
7. `usuario_inativo`/`codigo_invalido`: para de sincronizar, mantém a fila e mostra "Acesso bloqueado — procure o coordenador".

*Background Sync* e *Periodic Background Sync* **não** são usados (comportamento não confiável; ver D8): a sincronização acontece com o app aberto.

---

## 7. GPS

- API `navigator.geolocation` (exige HTTPS — atendido pelo GitHub Pages). Funciona **sem internet**: usa o receptor de satélite do aparelho.
- **Aquecimento:** enquanto o app está visível, `watchPosition({ enableHighAccuracy: true })` mantém a última posição. Ao ir para segundo plano (`visibilitychange`), o acompanhamento é encerrado para poupar bateria; retoma ao voltar.
- **Na marcação:**
  - Se a última posição tiver ≤ 30 s e precisão ≤ `gps_precisao_max_m` → usa imediatamente.
  - Senão aguarda uma nova leitura até `gps_timeout_s`; aceita a melhor obtida nesse intervalo.
- **Classificação `gps_ok`:** `S` (precisão ≤ limite) · `IMPRECISO` (posição obtida, precisão pior que o limite) · `SEM_SINAL` (timeout sem posição) · `SEM_PERMISSAO` (usuário negou) · `NAO_SUPORTADO`.
- **A marcação nunca é bloqueada** pela falta de GPS; o cartão exibe o alerta correspondente.
- Se a permissão estiver negada, o topo mostra aviso permanente com instrução para reativar (Configurações do Chrome ▸ Localização).
- Limitação conhecida: sem internet, o primeiro *fix* de um GPS "frio" pode levar de 30 s a alguns minutos — mitigado pelo aquecimento com o app aberto. Recomendação operacional: abrir o app ao chegar à área e manter carregador veicular/power bank.

---

## 8. Segurança e privacidade

- As coordenadas são de **domicílios**: dado pessoal indireto (LGPD). Ficam só na planilha (conta Google do coordenador) e nos aparelhos autorizados.
- O código-fonte do app é público (GitHub Pages gratuito exige repositório público — D5); ele **não contém dados**, apenas a URL do Apps Script. Sem código de usuário válido, o backend não devolve nada.
- Entrevistador só recebe os pontos da própria dupla; o servidor recusa marcações fora dela.
- Desativar um usuário (`ativo = N`) corta o acesso na próxima sincronização daquele aparelho. Dados já baixados permanecem no aparelho até "Sair" — limitação aceita.
- Códigos de 6 caracteres (≈ 10⁹ combinações) são suficientes para o porte; não há tentativa de login ilimitada relevante porque cada chamada ao Apps Script é lenta (~1 s).
- Nenhum dado pessoal vai em URL (tudo no corpo do POST).

---

## 9. Estrutura do repositório

```
roteiro-app/
├── README.md
├── package.json                  scripts: test, servidor (sem dependências)
├── .github/workflows/pages.yml   testes + publicação da pasta app/ no GitHub Pages
├── docs/                         especificação, decisões, plano, implantação, operação, guia
├── apps-script/
│   ├── Codigo.gs                 doPost/doGet, fontePlanilha(), menus
│   ├── Regras.gs                 regras puras + atenderRequisicao(req, fonte)
│   ├── Leitor.gs                 leitura da aba roteiros
│   ├── Geo.gs                    Haversine e coordenadas
│   └── appsscript.json
├── app/                          publicado no GitHub Pages
│   ├── index.html, estilo.css, config.js
│   ├── geo.js (cópia de Geo.gs), logica.js
│   ├── armazenamento.js, gps.js, sincronizacao.js, app.js
│   ├── sw.js, manifest.webmanifest, icones/
├── ferramentas/                  extrair_fixture_real.py, gerar-icones.js
└── testes/
    ├── carregar.js               executa .gs/.js num contexto vm (escopo global, como no Apps Script)
    ├── fonte-memoria.js           mesma interface de fontePlanilha(), em memória
    ├── servidor-local.js          app + API simulada para desenvolvimento
    ├── fixtures/roteiros_sintetico.js
    ├── fixtures/privado/         dados reais (fora do Git)
    └── *.test.js
```

`Geo.gs`, `Leitor.gs`, `Regras.gs` e `app/logica.js` são JavaScript puro, sem APIs do Google ou do navegador; os testes os executam num contexto `vm` do Node, que reproduz o escopo global do Apps Script. `Codigo.gs` só traduz entre a planilha e a interface *fonte* usada por `atenderRequisicao`.

---

## 10. Testes

### Automatizados (`node --test testes/`)

- **Leitor**, com a fixture real da S2:
  - 30 blocos (5 dias × 6 duplas), contagem de pontos por bloco igual à da planilha.
  - Encontro correto por dupla, incluindo exceções (14/09 A1 ≠ A2; 18/09 C1 ≠ C2).
  - Linhas-modelo vazias de 28/09 em diante → nenhum bloco.
  - Com linha `Ponto de término` inserida → `termino` preenchido; sem ela → `null`.
  - `D = 1` → `dup: true`; coordenada com e sem espaço; coordenada inválida → aviso.
  - Datas como `Date` e como texto `dd/mm/aaaa`.
- **Geo:** Haversine com pares conhecidos (tolerância de 1 m).
- **Mescla de situação** (função pura em `logica.js`): local mais novo vence servidor e vice-versa.
- **Contrato do servidor** (`atenderRequisicao` com fonte em memória) e servidor local via HTTP.
- **Coerência do PWA:** versões iguais em config.js/sw.js; todo arquivo usado pelo index.html está no cache offline.

### Manuais (roteiro de aceite no Android)

1. Instalar pelo link, entrar com código, conceder localização.
2. Ativar **modo avião**, fechar e reabrir o app → roteiro aparece.
3. Marcar 3 pontos em modo avião → indicador "3 pendentes"; cartões mostram GPS.
4. Negar permissão de localização em outro aparelho → marcação salva com `SEM_PERMISSAO`.
5. Desativar modo avião → sincroniza sozinho; conferir `Registros` (3 linhas) e `Situacao`.
6. No aparelho do colega de dupla, sincronizar → vê os 3 status.
7. Forçar reenvio (reabrir com a mesma fila) → `Registros` sem duplicatas.
8. Colar nova versão da aba `roteiros` com um ponto a mais → aparece após sincronizar.
9. Supervisor vê todas as duplas; entrevistador A1 não vê A2.
10. `ativo = N` → aparelho mostra "Acesso bloqueado" e mantém a fila.

---

## 11. Critérios de aceite

- Roteiro da semana disponível offline em todos os aparelhos após uma sincronização.
- Nenhuma marcação feita offline se perde, nem é duplicada, após reconexão.
- Cada marcação de status tem GPS ou um motivo explícito para não ter.
- Coordenador atualiza o roteiro apenas colando a aba `roteiros`, sem tocar em código.
- Todos os testes automatizados passando; roteiro de aceite manual concluído.

---

## 12. Riscos

| Risco | Mitigação |
|---|---|
| Relógio do aparelho errado distorce "mais recente" | `recebido_em` registrado; desempate; aviso no app se diferença com `servidor_em` > 10 min |
| Chrome apagar dados locais | `storage.persist()`; fila também exibida para o usuário; "Sair" bloqueado com pendências |
| Cotas do Apps Script (execução ≤ 6 min, ~20 mil chamadas/dia) | 12 aparelhos × sync a cada 5 min ≈ 1.500 chamadas/dia — folga ampla |
| Crescimento de `Registros` deixando a checagem de duplicidade lenta | Índice de `id_marcacao` mantido em `CacheService`/propriedade; arquivar aba por semana se passar de ~50 mil linhas |
| Colagem da aba `roteiros` com formato alterado | Leitura por nome de cabeçalho; `avisos` exibidos ao supervisor |
| GPS frio sem internet | Aquecimento com app aberto; timeout sem bloquear a marcação |
