# Operação diária — Coordenador

## Atualizar o roteiro (todo dia, ou quando o Planejador mudar)

1. No `Planejador.xlsx`, confira que cada bloco de equipe tem:
   - a linha de **cabeçalho** `Equipe A` (ou `Equipe B`, `Equipe C`) na coluna `ponto`, com a `data` do **primeiro dia** do roteiro e o **período** em texto na coluna `ordem` (ex.: `12 e 13/10`, `14, 15 e 16/10`, `30/10 a 02/11`). Se a célula `ordem` ficar vazia, o roteiro vale só o dia da `data`;
   - a linha **Ponto de encontro** logo após o cabeçalho (município, coordenada, endereço na coluna `obs`);
   - os pontos, cada um com o número de **`visitas`** já feitas (0, 1, 2…). O ponto com `visitas` igual ou maior que `tentativas_max` (padrão 3) **não é enviado ao app**;
   - a linha **Ponto de término** depois do último ponto (mesmo formato da linha de encontro).
   Cabeçalhos antigos como `Equipe A1` ainda funcionam e valem como equipe `A`. A coluna `roteiro` é ignorada pelo app.
2. Na aba `roteiros` do Planejador: **Ctrl+A** e depois **Ctrl+C**.
3. Na planilha Google, aba `roteiros`: clique em **A1** e cole **somente valores** (**Ctrl+Shift+V**). Não é preciso apagar antes se a colagem cobrir a aba toda; se a aba nova for menor que a anterior, apague as linhas que sobrarem.
4. Menu **Roteiros ▸ Verificar aba roteiros**. O resultado traz **uma linha por bloco**, no formato `<equipe> · <período ou data> · <n> pontos · <m> esgotados · término sim/NÃO`, mais o total de pontos esgotados e os **avisos** (coordenada ilegível, bloco sem encontro, período não reconhecido, cabeçalho não reconhecido, ponto repetido). Confira se cada equipe tem o período esperado e o término.
5. Pronto. Cada aparelho recebe o roteiro novo na próxima sincronização com sinal. Oriente as equipes a **abrirem o app com internet** (hotel, ponto de encontro) antes de ir a campo.

**O que o app mostra:** o título do bloco `Equipe A · 12 e 13/10`, com a mesma lista de pontos na aba de cada dia do período. O que foi marcado num dia continua marcado nos outros dias do período. Cada ponto que já teve visita mostra a etiqueta `2ª tentativa` ou `3ª e última tentativa`; o ponto com `visitas = 0` não mostra etiqueta.

## Usuários

Aba `Usuarios`, uma linha por pessoa:

| nome | codigo | papel | equipe | ativo |
|---|---|---|---|---|
| Ana | (gerado) | entrevistador | A | S |
| Bruno | (gerado) | entrevistador | A | S |
| Supervisão | (gerado) | supervisor | | S |

- **Equipe:** `A`, `B` ou `C`, obrigatória para entrevistador (ignorada para supervisor e admin). Os **quatro** entrevistadores de uma equipe recebem o mesmo roteiro. Um valor antigo como `A1` ainda vale como `A`. O nome do cabeçalho da coluna (`dupla` ou `equipe`) é só rótulo.
- **Código:** selecione uma célula da linha e use **Roteiros ▸ Gerar código para linha selecionada**. Envie o código individualmente à pessoa (não no grupo).
- **Trocar de equipe:** altere a coluna `equipe`; vale na próxima sincronização do aparelho.
- **Bloquear acesso:** `ativo = N`. O aparelho mostra "Acesso bloqueado" na próxima sincronização (as marcações já feitas continuam guardadas nele).
- **Códigos perdidos ou de quem saiu:** desative logo (`ativo = N`) — o endereço do Web App é público e o código é a única proteção.
- **Papéis:** `entrevistador` (vê só a própria equipe), `supervisor` (vê todas), `admin` (igual ao supervisor no app).

## Acompanhar o campo

- **Situacao:** último status de cada ponto. Linhas destacadas em laranja = marcadas a mais de `gps_limite_m` do ponto planejado ou sem GPS confiável.
- **Registros:** histórico completo (cada toque vira uma linha). Não edite nem apague linhas.
- Use **Dados ▸ Criar filtro** ou tabelas dinâmicas sobre essas abas à vontade (em outra aba, sem alterar as colunas).

## Configuração (aba `Config`)

| chave | o que faz |
|---|---|
| `status` | botões de status, separados por `;` na ordem de exibição (o primeiro é tratado como "concluído", em verde) |
| `status_sem_obs` | status em que a observação é opcional |
| `dias_passados` | quantos dias para trás o app mantém (conta a partir do **último dia** do período do bloco) |
| `gps_limite_m` | distância (m) a partir da qual a marcação é destacada |
| `gps_precisao_max_m` | precisão (m) acima da qual o GPS é considerado impreciso |
| `gps_timeout_s` | quanto o app espera pelo GPS ao marcar |
| `sync_intervalo_min` | intervalo da sincronização automática com o app aberto |
| `tentativas_max` | visitas a partir das quais o ponto está esgotado e some do app (padrão `3`); também define qual é a "última tentativa" no cartão |

> A aba `Config` já existente não tem a linha `tentativas_max`. Para mudar o limite, acrescente uma linha `tentativas_max` com o número; sem ela o valor é 3.

> Se remover um status que já foi usado, marcações antigas continuam na planilha, mas aparelhos com marcações pendentes daquele status terão essas marcações **recusadas** (o aviso aparece só no telefone, no topo). Também não mude a equipe de uma pessoa enquanto o telefone dela tiver marcações pendentes — avise a pessoa antes de ela tocar em "ok".

## Problemas comuns

| Situação | O que fazer |
|---|---|
| Aparelho não recebe o roteiro novo | Pedir para abrir o app com internet e tocar no indicador de sincronização |
| Ponto some do app | Confira a coluna `visitas` dele no Planejador: ao chegar a `tentativas_max` (padrão 3) o ponto esgotou as tentativas e deixa de ser enviado. O **Verificar aba roteiros** mostra quantos pontos esgotaram em cada bloco |
| Equipe sem roteiro no dia | Rode **Roteiros ▸ Verificar aba roteiros**: veja se o bloco da equipe aparece, se o texto do período (coluna `ordem` do cabeçalho) foi reconhecido e inclui o dia, e se a letra da equipe em `Usuarios` confere. Período não reconhecido vale só o dia da `data` (com aviso). Bloco só com pontos esgotados é descartado |
| Situacao parece errada | **Roteiros ▸ Reconstruir Situacao** (recalcula a partir de Registros) |
| App mostra "relógio errado" | Ativar data e hora automáticas no Android |
| Pessoa trocou de celular | Instala de novo pelo link e entra com o mesmo código; se o celular antigo tinha marcações pendentes, sincronize-o antes |

## Migração para a versão 1.1.0 (única vez)

Passos do coordenador para passar da versão 1.0.0 (duplas) para a 1.1.0 (equipes, períodos e tentativas):

1. No editor do Apps Script, cole o conteúdo atualizado de `Codigo.gs`, `Leitor.gs` e `Regras.gs` (o `Geo.gs` não mudou) e salve.
2. **Implantar ▸ Gerenciar implantações ▸ ✏️ ▸ Versão: Nova versão ▸ Implantar**. É a mesma implantação e a **mesma URL**; não crie uma *nova implantação*.
3. **Roteiros ▸ Configurar planilha** **não** precisa rodar de novo. Se quiser, renomeie a célula de cabeçalho `dupla` para `equipe` em `Usuarios`, `Registros` e `Situacao` (é só rótulo).
4. Em `Usuarios`, coloque `A`, `B` ou `C` na coluna da equipe de cada entrevistador (`A1` ainda funciona e vale `A`).
5. Cole de novo a aba `roteiros` do Planejador e rode **Roteiros ▸ Verificar aba roteiros**.
6. Apague as linhas de teste de `Registros` e `Situacao` que têm chaves com `A1` (`…|A1|…`): ficam sem efeito na versão nova.
7. Os celulares mostram "Nova versão disponível — toque para atualizar". **Ordem:** atualize o Apps Script (passos 1 e 2) **antes** de publicar o app (o `git push` na `main`), ou junto com ele. Na pequena folga, um celular já na 1.1.0 falando com o servidor antigo mostra "Nenhum roteiro publicado ainda" (sem erro e sem perda de dados); um celular de supervisor ainda na 1.0.0 com o servidor novo pode não conseguir desenhar a tela até atualizar ("Nova versão disponível").

## Publicar uma nova versão do app

1. Altere os arquivos em `app/`.
2. Aumente **juntos** `VERSAO` em `app/config.js` e `VERSAO_CACHE` em `app/sw.js` (ex.: `1.1.1` e `roteiro-v1.1.1`).
3. `npm test` → commit → `git push`. O GitHub Actions publica sozinho.
4. Nos aparelhos aparece "Nova versão disponível — toque para atualizar".
