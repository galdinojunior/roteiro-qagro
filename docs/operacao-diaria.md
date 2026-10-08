# Operação diária — Coordenador

## Atualizar o roteiro (todo dia, ou quando o Planejador mudar)

1. No `Planejador.xlsx`, confira que cada bloco de dupla (`Equipe A1`, `Equipe A2`, …) tem:
   - a linha **Ponto de encontro** logo após o cabeçalho do bloco;
   - os pontos com `visitas = 1`;
   - a linha **Ponto de término** depois do último ponto (mesmo formato da linha de encontro: município, coordenada, endereço na coluna `obs`).
2. Na aba `roteiros` do Planejador: **Ctrl+A** e depois **Ctrl+C**.
3. Na planilha Google, aba `roteiros`: clique em **A1** e cole **somente valores** (**Ctrl+Shift+V**). Não é preciso apagar antes se a colagem cobrir a aba toda; se a aba nova for menor que a anterior, apague as linhas que sobrarem.
4. Menu **Roteiros ▸ Verificar aba roteiros**: confira os dias, as duplas, a quantidade de pontos e os avisos (coordenada ilegível, bloco sem encontro, dias "sem término").
5. Pronto. Cada aparelho recebe o roteiro novo na próxima sincronização com sinal. Oriente as equipes a **abrirem o app com internet** (hotel, ponto de encontro) antes de ir a campo.

## Usuários

Aba `Usuarios`, uma linha por pessoa:

| nome | codigo | papel | dupla | ativo |
|---|---|---|---|---|
| Rafael | (gerado) | entrevistador | A1 | S |
| Supervisão | (gerado) | supervisor | | S |

- **Código:** selecione uma célula da linha e use **Roteiros ▸ Gerar código para linha selecionada**. Envie o código individualmente à pessoa (não no grupo).
- **Trocar de dupla:** altere a coluna `dupla`; vale na próxima sincronização do aparelho.
- **Bloquear acesso:** `ativo = N`. O aparelho mostra "Acesso bloqueado" na próxima sincronização (as marcações já feitas continuam guardadas nele).
- **Códigos perdidos ou de quem saiu:** desative logo (`ativo = N`) — o endereço do Web App é público e o código é a única proteção.
- **Papéis:** `entrevistador` (vê só a própria dupla), `supervisor` (vê todas), `admin` (igual ao supervisor no app).

## Acompanhar o campo

- **Situacao:** último status de cada ponto. Linhas destacadas em laranja = marcadas a mais de `gps_limite_m` do ponto planejado ou sem GPS confiável.
- **Registros:** histórico completo (cada toque vira uma linha). Não edite nem apague linhas.
- Use **Dados ▸ Criar filtro** ou tabelas dinâmicas sobre essas abas à vontade (em outra aba, sem alterar as colunas).

## Configuração (aba `Config`)

| chave | o que faz |
|---|---|
| `status` | botões de status, separados por `;` na ordem de exibição (o primeiro é tratado como "concluído", em verde) |
| `status_sem_obs` | status em que a observação é opcional |
| `dias_passados` | quantos dias para trás o app mantém |
| `gps_limite_m` | distância (m) a partir da qual a marcação é destacada |
| `gps_precisao_max_m` | precisão (m) acima da qual o GPS é considerado impreciso |
| `gps_timeout_s` | quanto o app espera pelo GPS ao marcar |
| `sync_intervalo_min` | intervalo da sincronização automática com o app aberto |

> Se remover um status que já foi usado, marcações antigas continuam na planilha, mas aparelhos com marcações pendentes daquele status terão essas marcações **recusadas** (o aviso aparece só no telefone, no topo). Também não mude a dupla de uma pessoa enquanto o telefone dela tiver marcações pendentes — avise a pessoa antes de ela tocar em "ok".

## Problemas comuns

| Situação | O que fazer |
|---|---|
| Aparelho não recebe o roteiro novo | Pedir para abrir o app com internet e tocar no indicador de sincronização |
| Situacao parece errada | **Roteiros ▸ Reconstruir Situacao** (recalcula a partir de Registros) |
| App mostra "relógio errado" | Ativar data e hora automáticas no Android |
| Pessoa trocou de celular | Instala de novo pelo link e entra com o mesmo código; se o celular antigo tinha marcações pendentes, sincronize-o antes |

## Publicar uma nova versão do app

1. Altere os arquivos em `app/`.
2. Aumente **juntos** `VERSAO` em `app/config.js` e `VERSAO_CACHE` em `app/sw.js` (ex.: `1.0.1` e `roteiro-v1.0.1`).
3. `npm test` → commit → `git push`. O GitHub Actions publica sozinho.
4. Nos aparelhos aparece "Nova versão disponível — toque para atualizar".
