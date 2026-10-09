# App de Roteiros QAgro — Especificação de Design

- **Data:** 26/09/2026
- **Status:** aprovado (design) — aguardando revisão da especificação
- **Projeto:** COPPETEC 2025033 — coleta QAgro em área rural
- **Decisões registradas em:** [decisoes.md](decisoes.md)

Atualizada em 08/10/2026 pela especificação [2026-10-08-equipes-periodos-logomarca-design.md](2026-10-08-equipes-periodos-logomarca-design.md) (versão 1.1.0).

---

## 1. Objetivo

Substituir os roteiros HTML estáticos enviados por WhatsApp por um aplicativo que:

1. Recebe o **roteiro atualizado diariamente** a partir de uma planilha que o coordenador controla.
2. **Funciona sem internet** no campo (área rural) — consulta do roteiro e marcação de status.
3. **Sincroniza automaticamente** as marcações quando houver sinal, centralizando tudo numa planilha Google e distribuindo o status entre os membros da equipe e os supervisores.
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
| Equipes | 3 — **A, B, C** — 4 pessoas cada |
| Carros por equipe | 2 — com 2 entrevistadores cada |
| Aparelhos | Android, navegador Chrome |
| Canal de distribuição | WhatsApp (link do app) |
| Conectividade | intermitente; dias inteiros sem sinal são possíveis |

Regras de campo:

- Cada **equipe** tem **um só roteiro** ordenado de pontos, que os 4 entrevistadores veem. Os dois carros saem e chegam juntos nos mesmos pontos de encontro e de término e seguem pelos dois lados da estrada.
- A equipe decide no campo **quem visita cada ponto**; não há coluna de carro. O cartão mostra o nome de quem marcou.
- Um roteiro de ~50 pontos cobre um **período de 2 ou 3 dias** (ex.: "12 e 13/10"): a mesma lista aparece em cada dia do período e o status marcado num dia vale nos outros.
- O ponto tem um número de **tentativas**: a coluna `visitas` do Planejador conta as visitas já feitas; ao chegar a `tentativas_max` (padrão 3) o ponto deixa de ser enviado ao app.
- Há um **ponto de encontro** no início e um **ponto de término** no fim, especificados no Planejador por equipe.

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
| `data` | Data do roteiro (no cabeçalho do bloco: **primeiro dia** do período) |
| `equipe` | Letra da equipe (A/B/C) — informativa; o leitor usa a letra do cabeçalho do bloco |
| `roteiro` | Número do roteiro — **ignorada** pelo app |
| `visitas` | Número de visitas **já feitas** ao ponto (0, 1, 2…); valor não numérico conta como 0 |
| `ordem` | Ordem do ponto no roteiro da equipe; **no cabeçalho do bloco**, o texto do **período** (ex.: `12 e 13/10`) |
| `municipio` | Município |
| `ponto` | Código do ponto (ex.: `SB1956U`), ou marcador de estrutura |
| `D` | `1` = possível duplicidade de coordenada |
| `coordenada` | `"lat,lon"` (espaço após vírgula opcional) |
| `obs` | Endereço (nas linhas de encontro/término) ou observação |

#### Regras de leitura

A leitura percorre as linhas em ordem e reconhece:

| Linha | Critério (coluna `ponto`, sem distinção de maiúsculas/acentos) | Efeito |
|---|---|---|
| Cabeçalho de bloco | casa `^Equipe\s+([A-Z])(\d)?$` | Abre bloco da equipe `A`…; `data` do bloco = coluna `data`; período = coluna `ordem` |
| Encontro | `Ponto de encontro` | Define encontro do bloco (município, coordenada, endereço=`obs`) |
| Término | `Ponto de término` (aceita também `Ponto de termino`) | Define término do bloco |
| Ponto | `ponto` com um código (qualquer texto que não seja `-`, vazio, `Ponto de …` nem `Equipe …`) | Adiciona ponto ao bloco, com o número de `visitas` |
| Demais | — | Ignoradas (linhas-modelo, `-`, vazias, cabeçalho da tabela) |

- A **equipe** do bloco é a letra do cabeçalho. Cabeçalhos antigos como `Equipe A1` valem como equipe `A` (o dígito é ignorado). Cabeçalho que começa com `Equipe` mas não casa o padrão gera aviso e o bloco é ignorado.
- Pode haver **vários blocos por equipe e por data**; todos entram.
- Pontos são ordenados pela coluna `ordem` (empate: ordem de aparição).
- **Período:** o texto da coluna `ordem` do cabeçalho (`12 e 13/10`, `14, 15 e 16/10`, `30/10 a 02/11`…) vira a lista de dias do bloco; célula de data ou vazia vale só a `data` do bloco; texto não reconhecido gera aviso e vale só a `data`. As regras completas e os exemplos estão na seção 2.3 da [especificação de 08/10/2026](2026-10-08-equipes-periodos-logomarca-design.md).
- **Tentativas:** ponto com `visitas ≥ tentativas_max` (Config, padrão 3) é **esgotado**: não é enviado ao app e é contado em `esgotados` (ver seção 2.4 da especificação de 08/10/2026).
- Bloco sem nenhum ponto visível (vazio, ou só com pontos esgotados) é **descartado** (semanas futuras ainda não preenchidas).
- Bloco sem linha de término: término = `null` → app mostra "Término: a definir".
- Datas aceitas: valor de data do Sheets ou texto `dd/mm/aaaa`.
- Linhas de ponto com coordenada ilegível: ponto é mantido, coordenada = `null`, e o problema é listado em `avisos` (ver 5.3).
- **Formato S1 não é suportado** (decisão D7).

#### Mudança no Planejador.xlsx (única alteração no processo atual)

Dentro do bloco de cada equipe, **após o último ponto**, incluir uma linha no mesmo formato da linha de encontro:

| data | equipe | visitas | ordem | municipio | ponto | D | coordenada | obs |
|---|---|---|---|---|---|---|---|---|
| 14/10/2026 | A | - | 21 | Cidade Um | **Ponto de término** | | -20.000000, -44.000000 | Praça Um - Centro |

#### Identificação de um ponto

`chave = <data do bloco AAAA-MM-DD>|<equipe>|<codigo>` — ex.: `2026-10-12|A|SB1956U`.
A `data` é a do cabeçalho do bloco e não muda de um dia para outro do período; por isso o status marcado num dia vale nos outros. O mesmo código pode reaparecer em outro roteiro (revisita); por isso a data compõe a chave. Ponto repetido (mesma chave) em qualquer bloco da mesma equipe e data: vale o primeiro, com aviso.

### 4.2 Aba `Usuarios` (coordenador edita)

| Coluna | Exemplo | Regras |
|---|---|---|
| `nome` | Ana | Exibido no app e gravado nos registros |
| `codigo` | `K7M2QX` | 6 caracteres, alfabeto sem ambíguos (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`); único |
| `papel` | `entrevistador` \| `supervisor` \| `admin` | |
| `equipe` | `A` | `A`, `B` ou `C`; obrigatório para entrevistador; ignorado para supervisor/admin. Valor antigo como `A1` vale como `A`. O nome do cabeçalho da coluna é só rótulo: o servidor lê pela posição |
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
| `tentativas_max` | `3` | Número de visitas a partir do qual o ponto está esgotado e deixa de ser enviado ao app |

### 4.4 Aba `Registros` (sistema — somente acréscimo)

Uma linha por marcação recebida. **Nunca é editada nem apagada pelo sistema.**

| Coluna | Descrição |
|---|---|
| `id_marcacao` | UUID gerado no aparelho — garante que reenvio não duplica |
| `recebido_em` | Data/hora do servidor ao gravar |
| `marcado_em` | Data/hora do aparelho no momento da marcação |
| `tipo` | `status` ou `obs` |
| `codigo_usuario`, `nome`, `papel` | Quem marcou |
| `data_roteiro`, `equipe`, `ponto`, `chave` | Qual ponto (`equipe` guarda a letra) |
| `status`, `obs` | Estado do ponto após a marcação |
| `lat`, `lon`, `precisao_m`, `hora_gps` | Posição capturada (vazio se não houver) |
| `dist_planejado_m` | Distância até a coordenada planejada do ponto |
| `gps_ok` | `S`, `IMPRECISO`, `SEM_PERMISSAO`, `SEM_SINAL`, `NAO_SUPORTADO` ou `NA` (tipo `obs`) |
| `aparelho_id`, `versao_app` | Diagnóstico |

### 4.5 Aba `Situacao` (sistema — uma linha por ponto marcado)

Colunas: `chave`, `data_roteiro`, `equipe`, `ponto`, `status`, `status_em`, `nome`, `lat`, `lon`, `precisao_m`, `dist_planejado_m`, `gps_ok`, `obs`, `obs_em`, `n_marcacoes`.

Mantida por *upsert* pela `chave`, com status e observação independentes:

- Marcação `tipo: status` altera `status`, `status_em`, `nome` e as colunas de GPS — se `marcado_em ≥ status_em` atual.
- Marcação `tipo: obs` altera `obs` e `obs_em` — se `marcado_em ≥ obs_em` atual.
- `n_marcacoes` soma todas.

Assim, uma observação editada num aparelho nunca apaga um status marcado em outro (e vice-versa).

Formatação condicional: `dist_planejado_m > gps_limite_m` ou `gps_ok` diferente de `S`/`NA` → linha destacada.

Um menu `Roteiros ▸ Reconstruir Situacao` recalcula a aba inteira a partir de `Registros` (recuperação). O menu `Roteiros ▸ Verificar aba roteiros` mostra uma linha por bloco (`<equipe> · <período ou data> · <n> pontos · <m> esgotados · término sim/NÃO`), o total de esgotados e os avisos de leitura logo após colar.

Linhas antigas de `Registros` e `Situacao` com chaves da versão anterior (`…|A1|…`) ficam sem efeito e podem ser apagadas.

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
  "versao_app": "1.1.0",
  "registros": [
    {
      "id_marcacao": "uuid", "tipo": "status", "marcado_em": "2026-10-12T10:32:05-03:00",
      "chave": "2026-10-12|A|AA0001X", "status": "Feito", "obs": "",
      "lat": -20.00102, "lon": -44.00098, "precisao_m": 8, "hora_gps": "2026-10-12T10:32:03-03:00",
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
  "servidor_em": "2026-10-12T10:40:00-03:00",
  "usuario": { "nome": "Ana", "papel": "entrevistador", "equipe": "A" },
  "config": { "status": ["Feito","Ausente","Recusa","Não encontrado","Duplicidade"], "tentativas_max": 3, "...": "..." },
  "aceitos": ["uuid", "..."],
  "rejeitados": [{ "id_marcacao": "uuid", "motivo": "ponto_fora_da_dupla" }],
  "roteiro": {
    "gerado_em": "2026-10-12T10:40:00-03:00",
    "blocos": [
      {
        "data": "2026-10-12", "equipe": "A",
        "dias": ["2026-10-12", "2026-10-13"], "periodo": "12 e 13/10",
        "encontro": { "municipio": "Cidade Um", "lat": -20.0, "lon": -44.0, "endereco": "Praça Um - Centro" },
        "termino":  { "municipio": "Cidade Dois", "lat": -20.1, "lon": -44.1, "endereco": "Mercado Dois" },
        "esgotados": 0,
        "pontos": [
          { "chave": "2026-10-12|A|AA0001X", "ordem": 1, "codigo": "AA0001X",
            "municipio": "Cidade Um", "lat": -20.001, "lon": -44.001, "dup": false, "obs": null, "visitas": 1 }
        ]
      }
    ]
  },
  "situacao": [
    { "chave": "2026-10-12|A|AA0001X", "status": "Feito", "obs": "", "marcado_em": "...", "nome": "Ana" }
  ],
  "avisos": []
}
```

**Resposta (erro):** `{ "ok": false, "erro": "codigo_invalido" | "usuario_inativo" | "requisicao_invalida" | "falha_interna", "mensagem": "..." }`.

### 5.3 Regras do servidor

- **Autorização por código** em toda requisição. Entrevistador recebe apenas blocos da sua `equipe` (a letra, após `trim` e maiúsculas; formato `^[A-Z]\d?$`); supervisor/admin recebem todos.
- **Janela de dias:** um bloco é enviado se o **último dia** do período for `≥ hoje − dias_passados`, incluindo todos os futuros já publicados.
- **Gravação:** sob `LockService` (evita escrita concorrente). Para cada registro: ignora se `id_marcacao` já existe (conta como aceito); rejeita (`ponto_fora_da_dupla`, motivo mantido por compatibilidade) se a equipe da `chave` (2º segmento) não for a do entrevistador; senão acrescenta em `Registros` e faz *upsert* em `Situacao`.
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

**Faixa de marca (rola com a página):** logomarca da Innovare Pesquisa (`app/img/innovare-logo.png`, versão positiva horizontal, texto alternativo `Innovare Pesquisa — opinião + mercado`) à esquerda e `QAgro · COPPETEC` à direita, **acima** da barra fixa. Na tela de entrada a logomarca aparece grande e centralizada, acima do rótulo `QAGRO · COPPETEC`. O logo entra no cache offline; o ícone do app na tela inicial não muda.

**Topo fixo:** nome · `Equipe A` (supervisor/admin: o papel) · indicador de sincronização `● 3 pendentes · últ. sinc. 07:42` (verde = sem pendências e sincronizado há < 1h; laranja = pendências; cinza = nunca sincronizou hoje) · botão **Sincronizar**.

**Seletor de dia:** abas com os dias disponíveis — a união dos `dias` de todos os blocos recebidos; abre no dia de hoje (ou o próximo dia com roteiro). A aba de um dia mostra todos os blocos cujo `dias` contém aquele dia; em dois dias do mesmo período aparece a mesma lista e o mesmo estado (o status vem da chave do ponto).

**Conteúdo do dia (entrevistador):**

1. Título do bloco `Equipe A · <período>` (usa `periodo` se houver; senão o rótulo do dia), com a contagem de pontos e o resumo de status.
2. Cartão **Encontro** — município, endereço, coordenada (copiar · abrir no mapa).
3. Cartões dos **pontos**, na ordem — nº de ordem, código, município, coordenada (copiar · abrir no mapa via `geo:`), aviso "possível duplicidade" quando `dup`, **etiqueta de tentativa** (`visitas = 0`: sem etiqueta; `visitas = n > 0`: `<n+1>ª tentativa`; se `n + 1 = tentativas_max`: `<n+1>ª e última tentativa`), botões de **status** (vindos de `Config`), campo **observação**, e linha de rodapé com o resultado da última marcação: `Feito · 10:32 · Ana · GPS ±8 m a 14 m do ponto` ou ícone de alerta (`sem GPS`, `GPS impreciso`, `a 640 m do ponto`).
4. Cartão **Término** — igual ao encontro, ou "Término: a definir".
5. Resumo do dia: contagem por status.

**Supervisor/admin:** mesmo layout, com filtro **Equipe** (Todas, A, B, C) e um painel-resumo com uma linha por bloco (pontos · feitos · pendentes). Supervisor também pode marcar status (registrado com o nome dele).

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
- Entrevistador só recebe os pontos da própria equipe; o servidor recusa marcações fora dela.
- A logomarca da Innovare Pesquisa é pública por decisão do coordenador (D18).
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
├── docs/                         especificação (e a de 2026-10-08-equipes-periodos-logomarca-design.md), decisões, plano, implantação, operação, guia
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
│   └── img/innovare-logo.png      logomarca (cabeçalho e tela de entrada)
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

- **Leitor** (fixture sintética; a fixture real, quando presente, só confere invariantes: blocos bem formados, chaves únicas, `dias` não vazio, nenhum ponto com `visitas ≥ 3`):
  - Período: todos os exemplos da seção 2.3 da especificação de 08/10/2026, incluindo avisos e virada de ano.
  - Cabeçalho `Equipe A`, `Equipe A1` (vale `A`) e inválido (aviso, bloco ignorado).
  - Vários blocos por equipe e data; chave `data|equipe|codigo`; chave repetida entre blocos.
  - `visitas` 0, 1, 2, 3, 4 e `-`; `tentativas_max` diferente; bloco só com esgotados descartado; contagem de `esgotados`.
  - Com linha `Ponto de término` inserida → `termino` preenchido; sem ela → `null`.
  - `D = 1` → `dup: true`; coordenada com e sem espaço; coordenada inválida → aviso.
  - Datas como `Date` e como texto `dd/mm/aaaa`.
- **Regras:** `acharUsuario` com equipe `A`, `a`, `A1`, vazio e inválida; filtro por equipe e por último dia do período; gravação fora da equipe recusada; supervisor grava em qualquer equipe; `config.tentativas_max`.
- **Geo:** Haversine com pares conhecidos (tolerância de 1 m).
- **Mescla de situação** (função pura em `logica.js`): local mais novo vence servidor e vice-versa.
- **App (lógica pura):** rótulo de tentativa; abas de dias a partir de `dias`; blocos do dia.
- **Contrato do servidor** (`atenderRequisicao` com fonte em memória) e servidor local via HTTP.
- **Coerência do PWA:** versões iguais em config.js/sw.js; todo arquivo usado pelo index.html (inclusive o logo) está no cache offline.

### Manuais (roteiro de aceite no Android)

1. Instalar pelo link, entrar com código, conceder localização.
2. Ativar **modo avião**, fechar e reabrir o app → roteiro aparece.
3. Marcar 3 pontos em modo avião → indicador "3 pendentes"; cartões mostram GPS.
4. Negar permissão de localização em outro aparelho → marcação salva com `SEM_PERMISSAO`.
5. Desativar modo avião → sincroniza sozinho; conferir `Registros` (3 linhas) e `Situacao`.
6. No aparelho de outro membro da equipe, sincronizar → vê os 3 status.
7. Forçar reenvio (reabrir com a mesma fila) → `Registros` sem duplicatas.
8. Colar nova versão da aba `roteiros` com um ponto a mais → aparece após sincronizar.
9. Supervisor vê todas as equipes; entrevistador da equipe A não vê a B.
10. Roteiro de 2 dias: a mesma lista aparece nas duas abas e o status marcado num dia vale no outro.
11. `ativo = N` → aparelho mostra "Acesso bloqueado" e mantém a fila.

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
