# Equipes de 4, roteiros de vários dias, tentativas e logomarca — Especificação

- **Data:** 08/10/2026
- **Status:** aprovado pelo coordenador em 08/10/2026
- **Versão do app:** 1.1.0
- **Altera:** [2026-09-26-roteiro-qagro-design.md](2026-09-26-roteiro-qagro-design.md) (as seções afetadas são listadas na seção 9)

---

## 1. O que mudou na operação

1. **Equipes de 4.** Cada equipe (A, B, C) tem 2 carros com 2 entrevistadores cada. Os dois carros saem e chegam juntos nos mesmos pontos de encontro e de término, e seguem pelos dois lados da estrada. Todos os 4 veem **o mesmo roteiro**. O que antes eram as duplas A1 e A2 passa a ser uma só equipe, **A** (idem B e C).
2. **Roteiro de vários dias.** Um roteiro de ~50 pontos cobre um período de 2 ou 3 dias (por exemplo "12 e 13/10"). A mesma lista aparece em cada aba de dia do período, e o status marcado num dia vale nos outros.
3. **Tentativas.** A coluna `visitas` do Planejador é o número de visitas já feitas ao ponto. Ao chegar a **3** (valor configurável), o ponto esgotou as tentativas e **não é mais enviado ao app**.
4. **Logomarca** da Innovare Pesquisa no cabeçalho do app.

A equipe decide no campo quem visita cada ponto. Não há coluna de carro. O cartão mostra o nome de quem marcou, e, se dois carros marcam o mesmo ponto sem sinal, vale a marcação mais recente (regra já existente), sem perder nada.

## 2. Planejador / aba `roteiros`

### 2.1 Colunas (localizadas pelo nome do cabeçalho)

`data`, `equipe`, `roteiro`, `visitas`, `ordem`, `municipio`, `ponto`, `D`, `coordenada`, `obs`.

- `equipe`: letra da equipe (`A`, `B` ou `C`). Informativa; o leitor usa a letra do cabeçalho do bloco.
- `roteiro`: número do roteiro. **Ignorada** pelo app.
- `visitas`: número de visitas já feitas ao ponto (0, 1, 2…). Valor não numérico conta como 0.

### 2.2 Estrutura de um bloco

| Linha | Como é reconhecida | Conteúdo |
|---|---|---|
| Cabeçalho do bloco | coluna `ponto` casa `^Equipe\s+([A-Z])(\d)?$` (sem distinguir maiúsculas) | `data` = primeiro dia do roteiro; **coluna `ordem` = período** (texto, data ou vazio) |
| Encontro | `ponto` = `Ponto de encontro` | município, `coordenada`, endereço em `obs` |
| Término | `ponto` = `Ponto de término` (aceita sem acento) | idem |
| Ponto | `ponto` com um código (qualquer texto que não seja `-`, vazio, `Ponto de …` nem `Equipe …`) | ver 2.4 |
| Demais | — | ignoradas |

- A **equipe** do bloco é a letra do cabeçalho. Cabeçalhos antigos como `Equipe A1` valem como equipe `A` (o dígito é ignorado); isso preserva o Planejador das semanas anteriores.
- Um cabeçalho que começa com `Equipe` mas não casa o padrão gera um **aviso** (`Linha N: cabeçalho de bloco não reconhecido ("…"); bloco ignorado.`) e o bloco é ignorado.
- Pode haver **vários blocos por equipe e por data** (por exemplo, os antigos A1 e A2 do mesmo dia). Todos entram.
- Bloco **sem nenhum ponto visível** (vazio, ou só com pontos esgotados) é descartado.

### 2.3 Período (coluna `ordem` do cabeçalho)

Converte-se o texto do período em uma lista de dias (`AAAA-MM-DD`, ordenada, sem repetição). O ano vem da `data` do bloco; um mês anterior ao da `data` conta como o ano seguinte.

Regras, nesta ordem:

1. Se a célula for uma **data**, o período é só esse dia.
2. Se estiver **vazia**, o período é só a `data` do bloco.
3. Se for **texto**: remove-se qualquer horário (`9:00h`, `09:00`); extraem-se os números `dd` ou `dd/mm`. Número sem mês toma o mês do próximo número que tenha mês. Entre dois números consecutivos, se o texto que os separa for `a`, `até`, `-` ou `–`, é um **intervalo** (todos os dias entre os dois, inclusive, no máximo 31 dias); caso contrário é uma **lista**.
4. Se não houver número, ou alguma data for inexistente (ex.: `31/02`), ou o intervalo passar de 31 dias: o período vira só a `data` do bloco e entra um **aviso** (`Linha N: período "…" não reconhecido; usando só a data do bloco.`).

Exemplos (com `data` = primeiro dia):

| Texto | Dias |
|---|---|
| `12 e 13/10` | 12/10, 13/10 |
| `14, 15 e 16/10` | 14/10, 15/10, 16/10 |
| `29, 30/10 e 02/11` | 29/10, 30/10, 02/11 |
| `30/10 a 02/11` | 30/10, 31/10, 01/11, 02/11 |
| `28/09, seg, 9:00h` | 28/09 |
| `30/12 a 02/01` (data 30/12/2026) | 30/12, 31/12, 01/01/2027, 02/01/2027 |
| (célula de data) 08/09/2026 | 08/09 |
| `abc` | só a `data`, com aviso |

### 2.4 Pontos e tentativas

- Cada linha de ponto vira um ponto com: `chave`, `ordem`, `codigo`, `municipio`, `lat`, `lon`, `dup` (`D` > 0), `obs`, **`visitas`** (número).
- Se `visitas >= tentativas_max` (Config, padrão 3), o ponto é **esgotado**: não é enviado e conta em `esgotados`.
- **Chave do ponto:** `<data do bloco>|<equipe>|<codigo>`, por exemplo `2026-10-12|A|SV0985X`. A `data` é a do cabeçalho do bloco (não muda de um dia para outro do período, por isso o status acompanha o ponto).
- Ponto repetido (mesma chave) → o primeiro vale, e entra um aviso. A comparação vale entre **todos os blocos** da mesma equipe e data.
- Linha de ponto com `data` diferente da do bloco → ignorada com aviso (regra existente).

### 2.5 Saída do leitor

```
lerRoteiros(linhas, { tentativasMax: 3 }) → {
  blocos: [{ data, equipe, dias: [...], periodo: "12 e 13/10" | null,
             encontro, termino, esgotados: n, pontos: [...] }],
  avisos: [...],
  esgotados: n            // total, incluindo blocos descartados
}
```

`periodo` é o texto original do período quando a célula é texto; senão `null`. A ordem dos blocos é a da planilha.

## 3. Planilha Google

- **`Usuarios`:** a coluna `dupla` passa a ser a **equipe** (`A`, `B` ou `C`). Aceita-se também um valor antigo como `A1`, que vale como `A`. Para o entrevistador a equipe é obrigatória. (O nome do cabeçalho da coluna é só rótulo; o servidor lê pela posição.)
- **`Config`:** nova chave `tentativas_max` (padrão `3`).
- **`Registros` e `Situacao`:** a coluna `dupla` passa a se chamar `equipe` e guarda a letra. Linhas antigas (chaves com `A1`) ficam sem efeito, e podem ser apagadas.
- **Menu Roteiros ▸ Verificar aba roteiros:** uma linha por bloco — `<equipe> · <período ou data> · <n> pontos · <m> esgotados · término sim/NÃO` —, mais o total de esgotados e os avisos.

## 4. Servidor (Apps Script)

- `acharUsuario`: entrevistador exige equipe no formato `^[A-Z]\d?$` (após `trim` e maiúsculas); `usuario.equipe` = a letra. Resposta de `entrar`/`sincronizar`: `usuario: { nome, papel, equipe }`.
- Entrevistador **vê** os blocos da sua equipe e **grava** em chaves cuja equipe (2º segmento) é a sua. Supervisor e admin veem e gravam tudo.
- Janela de dias: um bloco é enviado se o **último dia** do período for ≥ hoje − `dias_passados`.
- `config` enviada ao app inclui `tentativas_max`.
- O restante do contrato (seção 5 da especificação original) não muda.

## 5. App

- **Dias:** as abas são a união dos `dias` de todos os blocos recebidos. A aba de um dia mostra todos os blocos cujo `dias` contém aquele dia. Em dois dias do mesmo período, aparece a mesma lista e o mesmo estado (o status vem da chave do ponto).
- **Título do bloco:** `Equipe A · <período>` (usa `periodo` se houver; senão o rótulo do dia), com a contagem de pontos e o resumo de status.
- **Cartão do ponto:** tentativa. `visitas = 0` sem aviso; `visitas = n > 0` mostra `<n+1>ª tentativa`; se `n + 1 = tentativas_max`, mostra `<n+1>ª e última tentativa`.
- **Topo:** `<nome> · Equipe A`. Supervisor/admin: o papel.
- **Supervisor/admin:** filtro **Equipe** (Todas, A, B, C) no lugar de Grupo e Dupla; a tabela-resumo tem uma linha por bloco.
- **Quem marcou:** o rodapé do cartão já mostra o nome (inalterado).
- **Logomarca** (`app/img/innovare-logo.png`, versão positiva horizontal, redimensionada, texto alternativo `Innovare Pesquisa — opinião + mercado`):
  - tela de entrada: grande, centralizada, acima do rótulo `QAGRO · COPPETEC`;
  - tela principal: faixa de marca no topo, rolando com a página, com a logomarca à esquerda e `QAgro · COPPETEC` à direita, **acima** da barra fixa de sincronização;
  - o logo entra no cache offline. O ícone do app na tela inicial **não muda**.

## 6. Compatibilidade e migração

- Versão `1.1.0` (`CONFIG.VERSAO` e `VERSAO_CACHE` iguais). Os celulares recebem o aviso "Nova versão disponível".
- **Passo do coordenador:** colar os `.gs` atualizados no Apps Script e **Implantar ▸ Gerenciar implantações ▸ Nova versão** (mesma implantação, mesma URL). Antes disso, os celulares já atualizados e o servidor antigo não combinam; o app mostra erro de sincronização, sem perder marcações.
- Marcações de teste com chaves antigas (`…|A1|…`) deixam de aparecer. O coordenador pode apagar as linhas de teste de `Registros` e `Situacao`.
- Marcações pendentes na fila de um celular com a chave antiga (`…|A1|…`) serão **recusadas** pelo servidor novo (`ponto_fora_da_dupla`). Como o app ainda não foi distribuído às equipes, o risco é só dos testes.

## 7. Segurança e privacidade

Sem mudança no modelo. A logomarca é pública por decisão do coordenador. O repositório continua sem dados reais.

## 8. Testes

- **Leitor:** período (todos os exemplos de 2.3, incluindo avisos e virada de ano); cabeçalho `Equipe A`, `Equipe A1`, inválido; vários blocos por equipe/data; `visitas` 0, 1, 2, 3, 4 e `-`; `tentativas_max` diferente; chave `data|A|codigo`; chave repetida entre blocos; bloco só com esgotados descartado; contagem de esgotados.
- **Regras:** `acharUsuario` com equipe `A`, `a`, `A1`, vazio e inválida; filtro por equipe e por último dia do período; gravação fora da equipe recusada; supervisor grava em qualquer equipe; `config.tentativas_max`.
- **App (lógica pura):** rótulo de tentativa; abas de dias a partir de `dias`; blocos do dia.
- **PWA:** versões iguais; logo no cache offline; verificação offline em Edge (`ferramentas/verificar-offline-edge.js`) adaptada.
- **Dados reais:** invariantes (blocos bem formados, chaves únicas, `dias` não vazio, nenhum ponto com `visitas ≥ 3`).

## 9. Seções da especificação original afetadas

Seções 2 (contexto operacional), 4.1, 4.2, 4.3, 4.4, 4.5, 5.2 (exemplo e `usuario`), 6.2 (telas), 9 (estrutura) e 10 (testes). As alterações são feitas no próprio documento original e registradas em `decisoes.md` (D16 a D18).
