# App de Roteiros QAgro — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA offline para as duplas de campo consultarem o roteiro diário, marcarem status com GPS e sincronizarem com uma planilha Google via Apps Script.

**Architecture:** Regras de negócio em JavaScript puro (`apps-script/Geo.gs`, `Leitor.gs`, `Regras.gs`, `app/logica.js`) testadas em Node por meio de um carregador `vm` que imita o escopo global do Apps Script e dos `<script>` do navegador. `Codigo.gs` é só a cola com o Google Sheets (adaptador "fonte"); um adaptador em memória idêntico alimenta os testes e um servidor local de desenvolvimento. O app é HTML/CSS/JS sem build, com Service Worker, IndexedDB e Geolocation, publicado no GitHub Pages por GitHub Actions.

**Tech Stack:** Google Apps Script (V8), Google Sheets, JavaScript ES2019 (navegador Chrome Android), Node ≥ 22 (`node:test`, `node:vm`, `node:http`), Python 3 + openpyxl (apenas extração opcional de dados reais), GitHub Pages + Actions.

**Spec:** [2026-09-26-roteiro-qagro-design.md](2026-09-26-roteiro-qagro-design.md) · Decisões: [decisoes.md](decisoes.md)

## Global Constraints

- Idioma de código, UI, mensagens e documentação: **português do Brasil**.
- Sem dependências npm e sem etapa de build: `package.json` só tem scripts.
- Arquivos `.gs` e `app/*.js`: declarações de topo **somente** com `function` ou `var` (o carregador `vm` e o Apps Script só expõem essas como globais); `const`/`let` apenas dentro de funções.
- Ao comparar objetos vindos do contexto `vm` nos testes, passar por `simples()` (JSON) — objetos de outro *realm* falham no `deepStrictEqual`.
- Datas de marcação: ISO 8601 com fuso (`2026-09-14T10:32:05-03:00`); datas de roteiro: `AAAA-MM-DD`.
- Chave do ponto: `<AAAA-MM-DD>|<dupla>|<codigo>`.
- Status padrão (aba `Config`): `Feito;Ausente;Recusa;Não encontrado;Duplicidade`.
- Padrões de `Config`: `dias_passados=7`, `gps_limite_m=200`, `gps_precisao_max_m=100`, `gps_timeout_s=20`, `sync_intervalo_min=5`.
- Cores: `#EC6707` (laranja), `#3A3A3A`, `#595959`, `#9D9D9C`, `#E7E7E7`; fonte Calibri/Carlito; alvos de toque ≥ 44 px.
- **Nenhum dado real (coordenadas de domicílios) entra no Git** — o repositório será público. Dados reais só em `testes/fixtures/privado/` (ignorado).
- A marcação de status **nunca** é bloqueada por falta de GPS.
- Toda mudança em `app/` exige aumentar `VERSAO` em `app/config.js` e `VERSAO_CACHE` em `app/sw.js` para o mesmo número (o teste `testes/app.test.js` confere).
- Mensagens de commit terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Ajustes na especificação decididos durante o planejamento

Aplicados na especificação na Task 11 (e já refletidos neste plano):

1. **Testes carregam `.gs` via `vm`**, não por `module.exports` (seção 9 da spec).
2. **Orquestração do servidor em `Regras.gs`** (`atenderRequisicao(req, fonte)`), com `Codigo.gs` apenas como adaptador de planilha — permite testar o contrato inteiro em Node.
3. **`Situacao` separa status e observação**: marcações `tipo: status` só alteram status/GPS; `tipo: obs` só altera a observação; cada um com seu carimbo (`status_em`, `obs_em`). Evita que uma observação editada num aparelho apague o status marcado em outro. Colunas: `chave, data_roteiro, dupla, ponto, status, status_em, nome, lat, lon, precisao_m, dist_planejado_m, gps_ok, obs, obs_em, n_marcacoes`.
4. **IndexedDB com duas lojas** (`kv` e `fila`); o estado exibido é calculado por `mesclarSituacao(situacaoServidor, fila)` — não há loja `local`.
5. **GitHub Pages publica a pasta `app/` por GitHub Actions** (Pages "from branch" só serve `/` ou `/docs`).
6. Menu extra na planilha: **Roteiros ▸ Verificar aba roteiros** (resumo por dia + avisos logo após colar).

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `package.json` | scripts `test` e `servidor` |
| `.gitignore` | ignora `testes/fixtures/privado/`, `node_modules/` |
| `apps-script/Geo.gs` | `distanciaMetros`, `lerCoordenada` (idêntico a `app/geo.js`) |
| `apps-script/Leitor.gs` | `lerRoteiros(linhas)`, `dataIso`, `normalizarTexto` |
| `apps-script/Regras.gs` | config, usuários, filtro, validação, registros, situação, códigos, `atenderRequisicao` |
| `apps-script/Codigo.gs` | `doPost`/`doGet`, `fontePlanilha()`, menus, configuração da planilha |
| `apps-script/appsscript.json` | fuso, runtime V8, Web App |
| `app/index.html` | casca da página |
| `app/estilo.css` | visual |
| `app/config.js` | `CONFIG.URL_API`, `CONFIG.VERSAO` |
| `app/geo.js` | cópia de `Geo.gs` |
| `app/logica.js` | funções puras do app (mescla, GPS, formatação) |
| `app/armazenamento.js` | `Banco` (IndexedDB) |
| `app/gps.js` | `Gps` (aquecimento e captura) |
| `app/sincronizacao.js` | `Sync` (fila, chamadas, agendamento) |
| `app/app.js` | telas e eventos |
| `app/sw.js` | Service Worker |
| `app/manifest.webmanifest`, `app/icones/*.png` | instalação |
| `testes/carregar.js` | carregador `vm` + `simples()` |
| `testes/fonte-memoria.js` | adaptador de dados em memória |
| `testes/fixtures/roteiros_sintetico.js` | aba `roteiros` fictícia (S2) |
| `testes/servidor-local.js` | servidor de desenvolvimento (app + API simulada) |
| `testes/*.test.js` | testes |
| `ferramentas/extrair_fixture_real.py` | extrai dados reais para teste local opcional |
| `ferramentas/gerar-icones.js` | gera os PNGs dos ícones |
| `.github/workflows/pages.yml` | testes + publicação |
| `docs/implantacao.md`, `docs/operacao-diaria.md`, `docs/guia-entrevistador.md` | documentação operacional |

---

### Task 1: Base do projeto e módulo Geo

**Files:**
- Create: `package.json`, `.gitignore`, `testes/carregar.js`, `apps-script/Geo.gs`, `app/geo.js`
- Test: `testes/geo.test.js`

**Interfaces:**
- Produces: `carregar(...arquivos) → contexto` e `simples(x)` em `testes/carregar.js`; globais `distanciaMetros(lat1, lon1, lat2, lon2) → number` (metros, float) e `lerCoordenada(texto) → {lat, lon} | null`.

- [ ] **Step 1: Criar `package.json` e `.gitignore`**

`package.json`:
```json
{
  "name": "roteiro-qagro",
  "private": true,
  "version": "1.0.0",
  "description": "App de roteiros de campo QAgro (COPPETEC)",
  "scripts": {
    "test": "node --test \"testes/*.test.js\"",
    "servidor": "node testes/servidor-local.js"
  }
}
```

`.gitignore`:
```
node_modules/
testes/fixtures/privado/
*.log
```

- [ ] **Step 2: Criar o carregador `testes/carregar.js`**

```js
// Carrega arquivos de escopo global (.gs do Apps Script e <script> do app) num contexto vm,
// imitando o ambiente real: funções e "var" de topo viram propriedades do contexto.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAIZ = path.join(__dirname, '..');

function carregar(...arquivos) {
  const contexto = vm.createContext({ console });
  for (const arquivo of arquivos) {
    const caminho = path.join(RAIZ, arquivo);
    vm.runInContext(fs.readFileSync(caminho, 'utf8'), contexto, { filename: caminho });
  }
  return contexto;
}

// Objetos criados dentro do contexto vm têm outro protótipo; normaliza para comparar.
function simples(valor) {
  return JSON.parse(JSON.stringify(valor));
}

module.exports = { carregar, simples, RAIZ };
```

- [ ] **Step 3: Escrever o teste `testes/geo.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { carregar, simples, RAIZ } = require('./carregar');

const g = carregar('apps-script/Geo.gs');

test('distância entre pontos iguais é zero', () => {
  assert.equal(g.distanciaMetros(-20, -44, -20, -44), 0);
});

test('1 grau no equador ≈ 111.195 m', () => {
  assert.ok(Math.abs(g.distanciaMetros(0, 0, 0, 1) - 111195.08) < 1);
  assert.ok(Math.abs(g.distanciaMetros(0, 0, 1, 0) - 111195.08) < 1);
});

test('distância curta em MG ≈ 152 m', () => {
  const d = g.distanciaMetros(-20, -44, -20.001, -44.001);
  assert.ok(d > 150 && d < 155, `obtido ${d}`);
});

test('lerCoordenada aceita com e sem espaço', () => {
  assert.deepEqual(simples(g.lerCoordenada('-20.1, -44.2')), { lat: -20.1, lon: -44.2 });
  assert.deepEqual(simples(g.lerCoordenada('-20.1,-44.2')), { lat: -20.1, lon: -44.2 });
  assert.deepEqual(simples(g.lerCoordenada(' -20 , -44 ')), { lat: -20, lon: -44 });
});

test('lerCoordenada rejeita texto inválido ou fora da faixa', () => {
  assert.equal(g.lerCoordenada('abc'), null);
  assert.equal(g.lerCoordenada(''), null);
  assert.equal(g.lerCoordenada(null), null);
  assert.equal(g.lerCoordenada(undefined), null);
  assert.equal(g.lerCoordenada('95,10'), null);
  assert.equal(g.lerCoordenada('10,190'), null);
});

test('app/geo.js é cópia idêntica de apps-script/Geo.gs', () => {
  const gs = fs.readFileSync(path.join(RAIZ, 'apps-script/Geo.gs'), 'utf8');
  const js = fs.readFileSync(path.join(RAIZ, 'app/geo.js'), 'utf8');
  assert.equal(js, gs, 'copie apps-script/Geo.gs para app/geo.js');
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `ENOENT ... apps-script/Geo.gs`.

- [ ] **Step 5: Implementar `apps-script/Geo.gs`**

```js
/**
 * Geo — funções geográficas puras.
 * Este arquivo existe em duas cópias idênticas: apps-script/Geo.gs e app/geo.js
 * (o teste testes/geo.test.js garante que não divergem).
 */

/** Distância em metros entre dois pontos (fórmula de Haversine). */
function distanciaMetros(lat1, lon1, lat2, lon2) {
  var R = 6371008.8;
  var rad = Math.PI / 180;
  var dLat = (lat2 - lat1) * rad;
  var dLon = (lon2 - lon1) * rad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Converte "lat,lon" (espaços opcionais) em {lat, lon}; null se inválido. */
function lerCoordenada(texto) {
  if (texto === null || texto === undefined) return null;
  var m = String(texto).trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  var lat = parseFloat(m[1]);
  var lon = parseFloat(m[2]);
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat: lat, lon: lon };
}
```

- [ ] **Step 6: Copiar para o app**

Run: `cp apps-script/Geo.gs app/geo.js`

- [ ] **Step 7: Rodar e ver passar**

Run: `npm test`
Expected: PASS — 6 testes.

- [ ] **Step 8: Commit**

```bash
git add package.json .gitignore testes/carregar.js testes/geo.test.js apps-script/Geo.gs app/geo.js
git commit -m "Base do projeto e funcoes geograficas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Leitor da aba `roteiros`

**Files:**
- Create: `apps-script/Leitor.gs`, `testes/fixtures/roteiros_sintetico.js`
- Test: `testes/leitor.test.js`

**Interfaces:**
- Consumes: `lerCoordenada` (Task 1).
- Produces:
  - `lerRoteiros(linhas: any[][]) → { blocos: Bloco[], avisos: string[] }`
  - `Bloco = { data: 'AAAA-MM-DD', dupla: 'A1', grupo: 'A', encontro: Lugar|null, termino: Lugar|null, pontos: Ponto[] }`
  - `Lugar = { municipio: string|null, lat: number|null, lon: number|null, endereco: string|null }`
  - `Ponto = { chave, ordem: number|null, codigo, municipio: string|null, lat: number|null, lon: number|null, dup: boolean, obs: string|null }`
  - `dataIso(valor) → 'AAAA-MM-DD' | null`; `normalizarTexto(valor) → string` (minúsculas, sem acentos, aparado)
  - `linhasSinteticas(inicio?: Date) → any[][]` (Node) — blocos em `inicio` (A1, A2) e `inicio+1` (A1, data em texto), bloco-modelo vazio em `inicio+14`.

- [ ] **Step 1: Criar a fixture `testes/fixtures/roteiros_sintetico.js`**

```js
// Aba "roteiros" fictícia no formato S2 (blocos por dupla). Coordenadas inventadas.
// inicio: data do primeiro dia (padrão 14/09/2026). O servidor local usa a data de hoje.

function dia(inicio, deslocamento) {
  return new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + deslocamento);
}

function ddmmaaaa(d) {
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

function linhasSinteticas(inicio = new Date(2026, 8, 14)) {
  const d0 = dia(inicio, 0);
  const d1 = ddmmaaaa(dia(inicio, 1));
  const dFut = dia(inicio, 14);
  const cab = (d, eq, nome) => [d, eq, '-', d, null, nome, 'D', 'Coordenadas', 'OBS'];
  return [
    [0, null, null, null, null, null, null, null, null],
    ['data', 'equipe', 'visitas', 'ordem', 'municipio', 'ponto', 'D', 'coordenada', 'obs'],
    // Formato S1 (sem número de dupla): deve ser ignorado
    cab(d0, 'A', 'Equipe A'),
    [d0, 'A', '-', 0, 'Betim', 'Ponto de encontro', null, '-19.9, -44.1', 'Praça S1'],
    [d0, 'A', 1, 1, 'Betim', 'S1PONTO', 0, '-19.91,-44.11', null],
    // A1 no dia 0 — pontos fora de ordem, duplicidade e coordenada inválida
    cab(d0, 'A', 'Equipe A1'),
    [d0, 'A', '-', 0, 'Cidade Um', 'Ponto de encontro', null, '-20.000000, -44.000000', 'Praça Um - Centro'],
    [d0, 'A', 1, 2, 'Cidade Um', 'AA0002X', 1, '-20.001,-44.001', null],
    [d0, 'A', 1, 1, 'Cidade Um', 'AA0001X', 1, '-20.001, -44.001', null],
    [d0, 'A', 1, 3, 'Cidade Um', 'AA0003X', 0, 'sem coordenada', 'Casa amarela'],
    [d0, 'A', '-', 4, '-', '-', 0, '-', null],
    [d0, 'A', '-', 5, null, null, null, null, null],
    [d0, 'A', '-', null, null, null, null, null, null],
    // A2 no dia 0 — encontro diferente do A1 e com término
    cab(d0, 'A', 'Equipe A2'),
    [d0, 'A', '-', 0, 'Cidade Dois', 'Ponto de encontro', null, '-20.100000, -44.100000', 'Mercado Dois'],
    [d0, 'A', 1, 1, 'Cidade Dois', 'BB0001X', 0, '-20.101,-44.101', null],
    [d0, 'A', 1, 2, 'Cidade Dois', 'BB0002X', 0, '-20.102,-44.102', null],
    [d0, 'A', '-', 3, 'Cidade Um', 'Ponto de término', null, '-20.000000, -44.000000', 'Praça Um - Centro'],
    // A1 no dia 1 — data como texto
    cab(d1, 'A', 'Equipe A1'),
    [d1, 'A', '-', 0, 'Cidade Um', 'Ponto de encontro', null, '-20.000000, -44.000000', 'Praça Um - Centro'],
    [d1, 'A', 1, 1, 'Cidade Um', 'AA0001X', 0, '-20.001,-44.001', null],
    // B1 futuro — só linhas-modelo vazias (semana ainda não planejada)
    cab(dFut, 'B', 'Equipe B1'),
    [dFut, 'B', '-', 0, null, 'Ponto de encontro', null, null, null],
    [dFut, 'B', '-', 1, null, null, null, null, null],
  ];
}

module.exports = { linhasSinteticas };
```

- [ ] **Step 2: Escrever o teste `testes/leitor.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar, simples } = require('./carregar');
const { linhasSinteticas } = require('./fixtures/roteiros_sintetico');

const g = carregar('apps-script/Geo.gs', 'apps-script/Leitor.gs');
const ler = (linhas) => simples(g.lerRoteiros(linhas));

test('lê só blocos de dupla com pontos, na ordem da planilha', () => {
  const { blocos } = ler(linhasSinteticas());
  assert.deepEqual(blocos.map((b) => b.data + '|' + b.dupla), ['2026-09-14|A1', '2026-09-14|A2', '2026-09-15|A1']);
});

test('ordena pontos pela coluna ordem e monta chave e grupo', () => {
  const a1 = ler(linhasSinteticas()).blocos[0];
  assert.deepEqual(a1.pontos.map((p) => p.codigo), ['AA0001X', 'AA0002X', 'AA0003X']);
  assert.deepEqual(a1.pontos.map((p) => p.ordem), [1, 2, 3]);
  assert.equal(a1.pontos[0].chave, '2026-09-14|A1|AA0001X');
  assert.equal(a1.grupo, 'A');
});

test('ponto: coordenada com/sem espaço, duplicidade e observação', () => {
  const [p1, p2, p3] = ler(linhasSinteticas()).blocos[0].pontos;
  assert.deepEqual([p1.lat, p1.lon, p1.dup, p1.obs], [-20.001, -44.001, true, null]);
  assert.deepEqual([p2.lat, p2.lon, p2.dup], [-20.001, -44.001, true]);
  assert.deepEqual([p3.lat, p3.lon, p3.dup, p3.obs], [null, null, false, 'Casa amarela']);
  assert.equal(p1.municipio, 'Cidade Um');
});

test('encontro por dupla e término quando existe', () => {
  const [a1, a2] = ler(linhasSinteticas()).blocos;
  assert.deepEqual(a1.encontro, { municipio: 'Cidade Um', lat: -20, lon: -44, endereco: 'Praça Um - Centro' });
  assert.equal(a1.termino, null);
  assert.deepEqual(a2.encontro, { municipio: 'Cidade Dois', lat: -20.1, lon: -44.1, endereco: 'Mercado Dois' });
  assert.deepEqual(a2.termino, { municipio: 'Cidade Um', lat: -20, lon: -44, endereco: 'Praça Um - Centro' });
});

test('aceita data em texto dd/mm/aaaa', () => {
  const b = ler(linhasSinteticas()).blocos[2];
  assert.equal(b.data, '2026-09-15');
  assert.equal(b.pontos[0].chave, '2026-09-15|A1|AA0001X');
});

test('avisa coordenada ilegível com o número da linha (e nada mais)', () => {
  assert.deepEqual(ler(linhasSinteticas()).avisos, ['Linha 10: coordenada ilegível no ponto AA0003X.']);
});

test('sem cabeçalho: nenhum bloco e um aviso', () => {
  const r = ler([['x', 'y'], [1, 2]]);
  assert.deepEqual(r.blocos, []);
  assert.equal(r.avisos.length, 1);
});

test('dataIso', () => {
  assert.equal(g.dataIso(new Date(2026, 8, 14)), '2026-09-14');
  assert.equal(g.dataIso('5/9/2026'), '2026-09-05');
  assert.equal(g.dataIso('texto'), null);
  assert.equal(g.dataIso(null), null);
});

test('normalizarTexto', () => {
  assert.equal(g.normalizarTexto('  Ponto de TÉRMINO '), 'ponto de termino');
  assert.equal(g.normalizarTexto(null), '');
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `ENOENT ... apps-script/Leitor.gs`.

- [ ] **Step 4: Implementar `apps-script/Leitor.gs`**

```js
/**
 * Leitor da aba "roteiros" (formato S2 em diante: blocos "Equipe A1", "Equipe A2", ...).
 * Função pura: recebe a matriz de valores (Range.getValues) e devolve blocos por dupla.
 * Depende de Geo.gs (lerCoordenada). Regras em docs/2026-09-26-roteiro-qagro-design.md, seção 4.1.
 */

var COLUNAS_ROTEIRO = ['data', 'equipe', 'visitas', 'ordem', 'municipio', 'ponto', 'd', 'coordenada', 'obs'];

function normalizarTexto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function _doisDigitos(n) {
  return (n < 10 ? '0' : '') + n;
}

/** Date (do Sheets) ou texto dd/mm/aaaa → 'AAAA-MM-DD'; null se inválido. */
function dataIso(valor) {
  if (Object.prototype.toString.call(valor) === '[object Date]') {
    if (isNaN(valor.getTime())) return null;
    // +12h: tolera diferença de fuso entre planilha e script sem mudar o dia
    var d = new Date(valor.getTime() + 12 * 3600 * 1000);
    return d.getFullYear() + '-' + _doisDigitos(d.getMonth() + 1) + '-' + _doisDigitos(d.getDate());
  }
  var m = String(valor === null || valor === undefined ? '' : valor).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + _doisDigitos(Number(m[2])) + '-' + _doisDigitos(Number(m[1]));
  return null;
}

function _texto(valor) {
  var s = valor === null || valor === undefined ? '' : String(valor).trim();
  return s === '' || s === '-' ? null : s;
}

function _acharCabecalho(linhas) {
  for (var i = 0; i < linhas.length; i++) {
    var nomes = linhas[i].map(normalizarTexto);
    if (nomes.indexOf('data') >= 0 && nomes.indexOf('visitas') >= 0 &&
        nomes.indexOf('ponto') >= 0 && nomes.indexOf('coordenada') >= 0) {
      var col = {};
      COLUNAS_ROTEIRO.forEach(function (c) { col[c] = nomes.indexOf(c); });
      return { linha: i, col: col };
    }
  }
  return null;
}

function lerRoteiros(linhas) {
  var avisos = [];
  var cab = _acharCabecalho(linhas);
  if (!cab) {
    return { blocos: [], avisos: ['Cabeçalho da aba roteiros não encontrado (colunas data, visitas, ponto, coordenada).'] };
  }
  var valor = function (linha, nome) { return cab.col[nome] >= 0 ? linha[cab.col[nome]] : null; };

  var lerLugar = function (linha, nLinha) {
    var bruto = valor(linha, 'coordenada');
    var coord = lerCoordenada(bruto);
    if (!coord && _texto(bruto)) avisos.push('Linha ' + nLinha + ': coordenada ilegível em ' + valor(linha, 'ponto') + '.');
    return {
      municipio: _texto(valor(linha, 'municipio')),
      lat: coord ? coord.lat : null,
      lon: coord ? coord.lon : null,
      endereco: _texto(valor(linha, 'obs'))
    };
  };

  var blocos = [];
  var vistos = {};
  var atual = null;

  for (var i = cab.linha + 1; i < linhas.length; i++) {
    var linha = linhas[i];
    var nLinha = i + 1;
    var bruto = valor(linha, 'ponto');
    var ponto = normalizarTexto(bruto);

    if (/^equipe\b/.test(ponto)) {
      atual = null;
      var m = String(bruto).trim().match(/^equipe\s+([a-z])(\d)$/i);
      if (!m) continue; // formato S1 ("Equipe A") ou outro: ignorado
      var data = dataIso(valor(linha, 'data'));
      var dupla = (m[1] + m[2]).toUpperCase();
      if (!data) { avisos.push('Linha ' + nLinha + ': bloco ' + dupla + ' sem data válida.'); continue; }
      if (vistos[data + '|' + dupla]) { avisos.push('Linha ' + nLinha + ': bloco ' + dupla + ' de ' + data + ' repetido; ignorado.'); continue; }
      vistos[data + '|' + dupla] = true;
      atual = { data: data, dupla: dupla, grupo: dupla.charAt(0), encontro: null, termino: null, pontos: [], _chaves: {}, _linha: nLinha };
      blocos.push(atual);
      continue;
    }
    if (!atual) continue;

    if (ponto === 'ponto de encontro') { atual.encontro = lerLugar(linha, nLinha); continue; }
    if (ponto === 'ponto de termino') { atual.termino = lerLugar(linha, nLinha); continue; }

    if (String(valor(linha, 'visitas')).trim() !== '1') continue;
    var codigo = _texto(bruto);
    if (!codigo) continue;

    var dataLinha = dataIso(valor(linha, 'data'));
    if (dataLinha && dataLinha !== atual.data) {
      avisos.push('Linha ' + nLinha + ': ponto ' + codigo + ' com data diferente do bloco ' + atual.dupla + '; ignorado.');
      continue;
    }
    var chave = atual.data + '|' + atual.dupla + '|' + codigo;
    if (atual._chaves[chave]) { avisos.push('Linha ' + nLinha + ': ponto ' + codigo + ' repetido no bloco ' + atual.dupla + '; ignorado.'); continue; }
    atual._chaves[chave] = true;

    var coord = lerCoordenada(valor(linha, 'coordenada'));
    if (!coord) avisos.push('Linha ' + nLinha + ': coordenada ilegível no ponto ' + codigo + '.');
    var brutoOrdem = valor(linha, 'ordem');
    var ordem = brutoOrdem === null || brutoOrdem === '' ? null : Number(brutoOrdem);

    atual.pontos.push({
      chave: chave,
      ordem: isFinite(ordem) ? ordem : null,
      codigo: codigo,
      municipio: _texto(valor(linha, 'municipio')),
      lat: coord ? coord.lat : null,
      lon: coord ? coord.lon : null,
      dup: Number(valor(linha, 'd')) > 0,
      obs: _texto(valor(linha, 'obs')),
      _pos: atual.pontos.length
    });
  }

  var saida = [];
  blocos.forEach(function (b) {
    if (!b.pontos.length) return; // semana ainda não preenchida
    if (!b.encontro) avisos.push('Bloco ' + b.dupla + ' de ' + b.data + ' (linha ' + b._linha + '): sem ponto de encontro.');
    b.pontos.sort(function (p, q) {
      if (p.ordem === null && q.ordem !== null) return 1;
      if (q.ordem === null && p.ordem !== null) return -1;
      return (p.ordem - q.ordem) || (p._pos - q._pos);
    });
    b.pontos.forEach(function (p) { delete p._pos; });
    delete b._chaves;
    delete b._linha;
    saida.push(b);
  });
  return { blocos: saida, avisos: avisos };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test`
Expected: PASS — todos os testes de `geo` e `leitor`.

- [ ] **Step 6: Commit**

```bash
git add apps-script/Leitor.gs testes/fixtures/roteiros_sintetico.js testes/leitor.test.js
git commit -m "Leitor da aba roteiros (formato S2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Teste opcional com os dados reais do Planejador

**Files:**
- Create: `ferramentas/extrair_fixture_real.py`
- Test: `testes/dados-reais.test.js`

**Interfaces:**
- Consumes: `lerRoteiros` (Task 2).
- Produces: `testes/fixtures/privado/roteiros_real.json` (fora do Git): matriz de linhas; datas como `{"$data": "AAAA-MM-DD"}`.

- [ ] **Step 1: Escrever o teste `testes/dados-reais.test.js`**

```js
// Teste com a aba "roteiros" real do Planejador.xlsx. O arquivo de dados fica fora do Git
// (coordenadas de domicílios). Gere com: python ferramentas/extrair_fixture_real.py
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { carregar, simples } = require('./carregar');

const ARQUIVO = path.join(__dirname, 'fixtures', 'privado', 'roteiros_real.json');
const existe = fs.existsSync(ARQUIVO);

function lerLinhas() {
  return JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')).map((linha) => linha.map((v) =>
    v && typeof v === 'object' && v.$data
      ? new Date(Number(v.$data.slice(0, 4)), Number(v.$data.slice(5, 7)) - 1, Number(v.$data.slice(8, 10)))
      : v));
}

test('dados reais da S2 (14 a 18/09/2026)', { skip: !existe && 'rode ferramentas/extrair_fixture_real.py' }, () => {
  const g = carregar('apps-script/Geo.gs', 'apps-script/Leitor.gs');
  const { blocos, avisos } = simples(g.lerRoteiros(lerLinhas()));
  const semana = blocos.filter((b) => b.data >= '2026-09-14' && b.data <= '2026-09-18');
  const bloco = (d, dupla) => blocos.find((b) => b.data === d && b.dupla === dupla);

  assert.equal(semana.length, 30);
  assert.equal(semana.reduce((s, b) => s + b.pontos.length, 0), 573);
  assert.ok(blocos.every((b) => b.data >= '2026-09-14'), 'a S1 deve ser ignorada');
  assert.equal(bloco('2026-09-14', 'A1').pontos.length, 20);
  assert.equal(bloco('2026-09-14', 'C2').pontos.length, 16);
  assert.equal(bloco('2026-09-14', 'A1').encontro.municipio, 'São Joaquim de Bicas');
  assert.equal(bloco('2026-09-14', 'A2').encontro.municipio, 'Mário Campos');
  assert.equal(bloco('2026-09-18', 'C1').encontro.municipio, 'Igarapé');
  assert.equal(bloco('2026-09-18', 'C2').encontro.municipio, 'Juatuba');
  assert.equal(bloco('2026-09-15', 'A1').pontos.filter((p) => p.dup).length, 5);
  assert.deepEqual(avisos.filter((a) => a.includes('coordenada')), []);
});
```

- [ ] **Step 2: Rodar — deve aparecer como SKIP**

Run: `npm test`
Expected: PASS com `# SKIP rode ferramentas/extrair_fixture_real.py`.

- [ ] **Step 3: Criar `ferramentas/extrair_fixture_real.py`**

```python
"""Extrai a aba 'roteiros' do Planejador.xlsx para testes/fixtures/privado/roteiros_real.json.

Uso:  python ferramentas/extrair_fixture_real.py <caminho_do_planejador>
   ou defina PLANEJADOR_XLSX

O arquivo gerado contém coordenadas de domicílios e fica FORA do Git (.gitignore).
O Planejador costuma estar aberto/sincronizando; por isso o script trabalha numa cópia.
"""
import datetime
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

import openpyxl

DESTINO = pathlib.Path(__file__).resolve().parent.parent / "testes" / "fixtures" / "privado" / "roteiros_real.json"


def copiar(origem: pathlib.Path, destino: pathlib.Path) -> None:
    try:
        shutil.copyfile(origem, destino)
    except PermissionError:
        # Arquivo bloqueado pelo Excel/OneDrive: o Copy-Item do PowerShell consegue ler.
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", f'Copy-Item -LiteralPath "{origem}" -Destination "{destino}" -Force'],
            check=True,
        )


def valor(v):
    if isinstance(v, datetime.datetime):
        return {"$data": v.date().isoformat()}
    if isinstance(v, datetime.date):
        return {"$data": v.isoformat()}
    return v


def main() -> None:
    origem_texto = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PLANEJADOR_XLSX")
    if not origem_texto:
        print("Uso: python ferramentas/extrair_fixture_real.py <caminho do Planejador.xlsx> ou defina PLANEJADOR_XLSX")
        raise SystemExit(2)
    origem = pathlib.Path(origem_texto)
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        copia = pathlib.Path(tmp) / "Planejador.xlsx"
        copiar(origem, copia)
        wb = openpyxl.load_workbook(copia, read_only=True, data_only=True)
        linhas = [[valor(v) for v in linha] for linha in wb["roteiros"].iter_rows(values_only=True)]
        wb.close()
    DESTINO.write_text(json.dumps(linhas, ensure_ascii=False), encoding="utf-8")
    print(f"{len(linhas)} linhas -> {DESTINO}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Extrair e rodar com dados reais**

Run: `python ferramentas/extrair_fixture_real.py && npm test`
Expected: `~4478 linhas -> ...roteiros_real.json`; teste `dados reais da S2` PASS (não mais SKIP).
Se algum número divergir, **não** ajuste o teste para passar: compare com a planilha e investigue o leitor.

- [ ] **Step 5: Conferir que o JSON não entra no Git**

Run: `git status --short`
Expected: aparecem só `ferramentas/extrair_fixture_real.py` e `testes/dados-reais.test.js` — nada em `testes/fixtures/privado/`.

- [ ] **Step 6: Commit**

```bash
git add ferramentas/extrair_fixture_real.py testes/dados-reais.test.js
git commit -m "Teste opcional do leitor com dados reais do Planejador

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Regras do servidor (puras) e adaptador em memória

**Files:**
- Create: `apps-script/Regras.gs`, `testes/fonte-memoria.js`
- Test: `testes/regras.test.js`

**Interfaces:**
- Consumes: `lerRoteiros`, `normalizarTexto` (Task 2).
- Produces (globais em `Regras.gs`):
  - `CONFIG_PADRAO`, `COLUNAS_REGISTROS` (21 colunas), `COLUNAS_SITUACAO` (15 colunas), `MENSAGENS_ERRO`
  - `lerConfig(linhas: [chave, valor][]) → { status: string[], status_sem_obs: string[], dias_passados, gps_limite_m, gps_precisao_max_m, gps_timeout_s, sync_intervalo_min }`
  - `acharUsuario(linhas: [nome, codigo, papel, dupla, ativo][], codigo) → { usuario: {nome, codigo, papel, dupla|null} } | { erro: 'codigo_invalido'|'usuario_inativo' }`
  - `filtrarBlocos(blocos, usuario, hojeIso, diasPassados) → Bloco[]`
  - `processarRegistros(registros, ctx) → { linhas: any[][], aceitos: string[], rejeitados: {id_marcacao, motivo}[] }` com `ctx = { usuario, config, idsExistentes: {id: true}, recebidoEm, aparelhoId, versaoApp }`
  - `atualizarSituacao(situacaoLinhas, registroLinhas) → any[][]` (ordenado por chave)
  - `situacaoParaApp(situacaoLinhas, blocos) → ItemSituacao[]` com `ItemSituacao = { chave, status, status_em, nome, precisao_m, dist_planejado_m, gps_ok, obs, obs_em }`
  - `gerarCodigo(existentes: {CODIGO: true}, aleatorio?: () => number) → string`
  - `erroResposta(codigo) → { ok: false, erro, mensagem }`
  - `atenderRequisicao(req, fonte) → resposta` (contrato da seção 5.2 da spec)
  - Interface **fonte**: `lerConfig()`, `lerUsuarios()`, `lerRoteiros()` → matrizes sem/ com cabeçalho conforme abaixo; `lerIdsRegistros() → {id: true}`; `acrescentarRegistros(linhas)`; `lerSituacao() → linhas sem cabeçalho`; `gravarSituacao(linhas)`; `comTrava(fn)`; `hojeIso() → 'AAAA-MM-DD'`; `agoraIso() → ISO com fuso`. `lerConfig`/`lerUsuarios`/`lerSituacao` devolvem linhas **sem** cabeçalho; `lerRoteiros` devolve a aba inteira.
- Produces (Node): `criarFonteMemoria({ roteiros, usuarios, config?, hoje, agora }) → fonte & { estado: { registros, situacao } }` — `hoje`/`agora` podem ser string ou função.

- [ ] **Step 1: Criar `testes/fonte-memoria.js`**

```js
// Fonte de dados em memória com a mesma interface de fontePlanilha() (apps-script/Codigo.gs).
// Usada nos testes de contrato e no servidor local de desenvolvimento.
function criarFonteMemoria({ roteiros, usuarios, config = [], hoje, agora }) {
  const estado = { registros: [], situacao: [] };
  const valor = (v) => (typeof v === 'function' ? v() : v);
  return {
    estado,
    lerConfig: () => config,
    lerUsuarios: () => usuarios,
    lerRoteiros: () => roteiros,
    lerIdsRegistros: () => Object.fromEntries(estado.registros.map((l) => [l[0], true])),
    acrescentarRegistros: (linhas) => { estado.registros.push(...linhas); },
    lerSituacao: () => estado.situacao,
    gravarSituacao: (linhas) => { estado.situacao = linhas; },
    comTrava: (fn) => fn(),
    hojeIso: () => valor(hoje),
    agoraIso: () => valor(agora),
  };
}

module.exports = { criarFonteMemoria };
```

- [ ] **Step 2: Escrever o teste `testes/regras.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar, simples } = require('./carregar');
const { linhasSinteticas } = require('./fixtures/roteiros_sintetico');
const { criarFonteMemoria } = require('./fonte-memoria');

const r = carregar('apps-script/Geo.gs', 'apps-script/Leitor.gs', 'apps-script/Regras.gs');

const USUARIOS = [
  ['Ana', 'ENTR01', 'entrevistador', 'A1', 'S'],
  ['Bruno', 'ENTR02', 'Entrevistador', 'a2', 's'],
  ['Sara', 'SUPE01', 'supervisor', '', 'S'],
  ['Ivo', 'INAT01', 'entrevistador', 'A1', 'N'],
  ['Sem Dupla', 'SEMD01', 'entrevistador', '', 'S'],
];
const col = (nome) => r.COLUNAS_REGISTROS.indexOf(nome);
const sit = (nome) => r.COLUNAS_SITUACAO.indexOf(nome);

function registro(extra) {
  return Object.assign({
    id_marcacao: 'id-1', tipo: 'status', marcado_em: '2026-09-14T10:00:00-03:00',
    chave: '2026-09-14|A1|AA0001X', status: 'Feito', obs: '',
    lat: -20.0011, lon: -44.0012, precisao_m: 8, hora_gps: '2026-09-14T09:59:58-03:00',
    dist_planejado_m: 15, gps_ok: 'S',
  }, extra);
}
function contexto(extra, codigo = 'ENTR01') {
  return Object.assign({
    usuario: r.acharUsuario(USUARIOS, codigo).usuario, config: r.lerConfig([]), idsExistentes: {},
    recebidoEm: '2026-09-14T10:05:00-03:00', aparelhoId: 'ap1', versaoApp: '1.0.0',
  }, extra);
}
function fonte() {
  return criarFonteMemoria({
    roteiros: linhasSinteticas(), usuarios: USUARIOS,
    hoje: '2026-09-14', agora: '2026-09-14T10:05:00-03:00',
  });
}

// --- configuração ---
test('lerConfig: padrões', () => {
  const c = simples(r.lerConfig([]));
  assert.deepEqual(c.status, ['Feito', 'Ausente', 'Recusa', 'Não encontrado', 'Duplicidade']);
  assert.deepEqual(c.status_sem_obs, ['Feito']);
  assert.equal(c.dias_passados, 7);
  assert.equal(c.gps_limite_m, 200);
  assert.equal(c.gps_precisao_max_m, 100);
  assert.equal(c.gps_timeout_s, 20);
  assert.equal(c.sync_intervalo_min, 5);
});

test('lerConfig: valores da planilha, vírgula decimal e vazios', () => {
  const c = simples(r.lerConfig([
    ['gps_limite_m', '150'], ['status', 'Feito; Recusa'], ['gps_precisao_max_m', '50,5'],
    ['desconhecida', 'x'], ['dias_passados', ''], ['sync_intervalo_min', 'abc'],
  ]));
  assert.equal(c.gps_limite_m, 150);
  assert.deepEqual(c.status, ['Feito', 'Recusa']);
  assert.equal(c.gps_precisao_max_m, 50.5);
  assert.equal(c.dias_passados, 7);
  assert.equal(c.sync_intervalo_min, 5);
});

// --- usuários ---
test('acharUsuario: entrevistador, maiúsculas/minúsculas e supervisor', () => {
  assert.deepEqual(simples(r.acharUsuario(USUARIOS, 'ENTR01')), { usuario: { nome: 'Ana', codigo: 'ENTR01', papel: 'entrevistador', dupla: 'A1' } });
  assert.deepEqual(simples(r.acharUsuario(USUARIOS, ' entr02 ')).usuario.dupla, 'A2');
  assert.deepEqual(simples(r.acharUsuario(USUARIOS, 'SUPE01')).usuario, { nome: 'Sara', codigo: 'SUPE01', papel: 'supervisor', dupla: null });
});

test('acharUsuario: erros', () => {
  assert.deepEqual(simples(r.acharUsuario(USUARIOS, 'INAT01')), { erro: 'usuario_inativo' });
  assert.deepEqual(simples(r.acharUsuario(USUARIOS, 'XXXX')), { erro: 'codigo_invalido' });
  assert.deepEqual(simples(r.acharUsuario(USUARIOS, 'SEMD01')), { erro: 'codigo_invalido' });
  assert.deepEqual(simples(r.acharUsuario(USUARIOS, '')), { erro: 'codigo_invalido' });
});

// --- filtro de roteiro ---
test('filtrarBlocos: entrevistador só vê a dupla; supervisor vê tudo; janela de dias', () => {
  const blocos = r.lerRoteiros(linhasSinteticas()).blocos;
  const ana = r.acharUsuario(USUARIOS, 'ENTR01').usuario;
  const sara = r.acharUsuario(USUARIOS, 'SUPE01').usuario;
  const ids = (lista) => simples(lista).map((b) => b.data + '|' + b.dupla);
  assert.deepEqual(ids(r.filtrarBlocos(blocos, ana, '2026-09-14', 7)), ['2026-09-14|A1', '2026-09-15|A1']);
  assert.equal(r.filtrarBlocos(blocos, sara, '2026-09-14', 7).length, 3);
  assert.deepEqual(ids(r.filtrarBlocos(blocos, sara, '2026-09-22', 7)), ['2026-09-15|A1']);
});

// --- registros ---
test('processarRegistros: aceita e monta a linha de Registros', () => {
  const res = simples(r.processarRegistros([registro()], contexto()));
  assert.deepEqual(res.aceitos, ['id-1']);
  assert.deepEqual(res.rejeitados, []);
  const l = res.linhas[0];
  assert.equal(l.length, r.COLUNAS_REGISTROS.length);
  assert.equal(l[col('id_marcacao')], 'id-1');
  assert.equal(l[col('recebido_em')], '2026-09-14T10:05:00-03:00');
  assert.equal(l[col('data_roteiro')], '2026-09-14');
  assert.equal(l[col('dupla')], 'A1');
  assert.equal(l[col('ponto')], 'AA0001X');
  assert.equal(l[col('nome')], 'Ana');
  assert.equal(l[col('codigo_usuario')], 'ENTR01');
  assert.equal(l[col('lat')], -20.0011);
  assert.equal(l[col('gps_ok')], 'S');
  assert.equal(l[col('aparelho_id')], 'ap1');
});

test('processarRegistros: id já gravado ou repetido no lote não duplica', () => {
  let res = simples(r.processarRegistros([registro()], contexto({ idsExistentes: { 'id-1': true } })));
  assert.deepEqual([res.linhas.length, res.aceitos], [0, ['id-1']]);
  res = simples(r.processarRegistros([registro(), registro()], contexto()));
  assert.deepEqual([res.linhas.length, res.aceitos], [1, ['id-1', 'id-1']]);
});

test('processarRegistros: rejeições com motivo', () => {
  const motivo = (extra) => simples(r.processarRegistros([registro(extra)], contexto())).rejeitados[0].motivo;
  assert.equal(motivo({ chave: '2026-09-14|A2|BB0001X' }), 'ponto_fora_da_dupla');
  assert.equal(motivo({ chave: 'sem-formato' }), 'ponto_fora_da_dupla');
  assert.equal(motivo({ status: 'Talvez' }), 'status_invalido');
  assert.equal(motivo({ tipo: 'x' }), 'tipo_invalido');
  assert.equal(motivo({ marcado_em: 'ontem' }), 'data_invalida');
  assert.equal(motivo({ gps_ok: 'X' }), 'gps_invalido');
  assert.equal(motivo({ id_marcacao: '' }), 'sem_id');
});

test('processarRegistros: supervisor marca qualquer dupla; números inválidos viram vazio', () => {
  const res = simples(r.processarRegistros([registro({ chave: '2026-09-14|A2|BB0001X', lat: 'abc' })], contexto({}, 'SUPE01')));
  assert.equal(res.linhas.length, 1);
  assert.equal(res.linhas[0][col('lat')], '');
});

test('processarRegistros: observação sem status é aceita com tipo obs', () => {
  const res = simples(r.processarRegistros([registro({ tipo: 'obs', status: '', obs: 'voltar', gps_ok: 'NA' })], contexto()));
  assert.deepEqual(res.aceitos, ['id-1']);
});

// --- situação ---
test('atualizarSituacao: status mais recente vence e contador soma', () => {
  const linhas = (regs) => r.processarRegistros(regs, contexto()).linhas;
  let s = r.atualizarSituacao([], linhas([registro()]));
  assert.equal(s.length, 1);
  assert.equal(s[0].length, r.COLUNAS_SITUACAO.length);
  assert.equal(s[0][sit('status')], 'Feito');
  assert.equal(s[0][sit('nome')], 'Ana');
  assert.equal(s[0][sit('dist_planejado_m')], 15);
  assert.equal(s[0][sit('n_marcacoes')], 1);

  s = r.atualizarSituacao(s, linhas([registro({ id_marcacao: 'id-0', status: 'Ausente', marcado_em: '2026-09-14T09:00:00-03:00' })]));
  assert.equal(s[0][sit('status')], 'Feito');
  assert.equal(s[0][sit('n_marcacoes')], 2);

  s = r.atualizarSituacao(s, linhas([registro({ id_marcacao: 'id-2', status: 'Recusa', marcado_em: '2026-09-14T11:00:00-03:00' })]));
  assert.equal(s[0][sit('status')], 'Recusa');
  assert.equal(s[0][sit('status_em')], '2026-09-14T11:00:00-03:00');
});

test('atualizarSituacao: observação não mexe no status/GPS e status não mexe na observação', () => {
  const linhas = (regs) => r.processarRegistros(regs, contexto()).linhas;
  let s = r.atualizarSituacao([], linhas([registro()]));
  s = r.atualizarSituacao(s, linhas([registro({ id_marcacao: 'o1', tipo: 'obs', status: '', obs: 'voltar às 15h', gps_ok: 'NA', lat: null, marcado_em: '2026-09-14T10:10:00-03:00' })]));
  assert.equal(s[0][sit('status')], 'Feito');
  assert.equal(s[0][sit('gps_ok')], 'S');
  assert.equal(s[0][sit('lat')], -20.0011);
  assert.equal(s[0][sit('obs')], 'voltar às 15h');
  assert.equal(s[0][sit('obs_em')], '2026-09-14T10:10:00-03:00');
  s = r.atualizarSituacao(s, linhas([registro({ id_marcacao: 's2', status: 'Ausente', obs: '', marcado_em: '2026-09-14T10:20:00-03:00' })]));
  assert.equal(s[0][sit('status')], 'Ausente');
  assert.equal(s[0][sit('obs')], 'voltar às 15h');
});

test('atualizarSituacao: status antigo chegando depois de uma observação nova ainda vale', () => {
  const linhas = (regs) => r.processarRegistros(regs, contexto()).linhas;
  let s = r.atualizarSituacao([], linhas([registro({ id_marcacao: 'o1', tipo: 'obs', status: '', obs: 'x', gps_ok: 'NA', marcado_em: '2026-09-14T10:05:00-03:00' })]));
  s = r.atualizarSituacao(s, linhas([registro({ marcado_em: '2026-09-14T10:00:00-03:00' })]));
  assert.equal(s[0][sit('status')], 'Feito');
  assert.equal(s[0][sit('obs')], 'x');
});

test('situacaoParaApp: só pontos dos blocos enviados, com números ou null', () => {
  const blocos = r.lerRoteiros(linhasSinteticas()).blocos;
  const linhas = r.processarRegistros([registro(), registro({ id_marcacao: 'b', chave: '2026-09-14|A2|BB0001X' })], contexto({}, 'SUPE01')).linhas;
  const s = r.atualizarSituacao([], linhas);
  const soA1 = r.filtrarBlocos(blocos, r.acharUsuario(USUARIOS, 'ENTR01').usuario, '2026-09-14', 7);
  const itens = simples(r.situacaoParaApp(s, soA1));
  assert.deepEqual(itens, [{
    chave: '2026-09-14|A1|AA0001X', status: 'Feito', status_em: '2026-09-14T10:00:00-03:00', nome: 'Sara',
    precisao_m: 8, dist_planejado_m: 15, gps_ok: 'S', obs: '', obs_em: '',
  }]);
});

// --- códigos ---
test('gerarCodigo: 6 caracteres sem ambíguos e sem repetir existentes', () => {
  let n = 0;
  const seq = () => (n++ < 6 ? 0 : 0.5);
  assert.equal(r.gerarCodigo({ 222222: true }, seq), 'HHHHHH');
  assert.match(r.gerarCodigo({}), /^[2-9A-HJKMNP-Z]{6}$/);
});

// --- contrato completo ---
test('atenderRequisicao: entrar como entrevistador', () => {
  const res = simples(r.atenderRequisicao({ acao: 'entrar', codigo: 'ENTR01' }, fonte()));
  assert.equal(res.ok, true);
  assert.equal(res.servidor_em, '2026-09-14T10:05:00-03:00');
  assert.deepEqual(res.usuario, { nome: 'Ana', papel: 'entrevistador', dupla: 'A1' });
  assert.deepEqual(res.roteiro.blocos.map((b) => b.dupla), ['A1', 'A1']);
  assert.deepEqual(res.situacao, []);
  assert.deepEqual(res.avisos, []);
  assert.equal(res.config.gps_limite_m, 200);
});

test('atenderRequisicao: supervisor vê tudo e recebe avisos', () => {
  const res = simples(r.atenderRequisicao({ acao: 'entrar', codigo: 'SUPE01' }, fonte()));
  assert.equal(res.roteiro.blocos.length, 3);
  assert.equal(res.avisos.length, 1);
});

test('atenderRequisicao: erros', () => {
  const f = fonte();
  const inativo = simples(r.atenderRequisicao({ acao: 'entrar', codigo: 'INAT01' }, f));
  assert.deepEqual([inativo.ok, inativo.erro], [false, 'usuario_inativo']);
  assert.ok(inativo.mensagem.length > 0);
  assert.equal(r.atenderRequisicao({ acao: 'x', codigo: 'ENTR01' }, f).erro, 'requisicao_invalida');
  assert.equal(r.atenderRequisicao(null, f).erro, 'requisicao_invalida');
});

test('atenderRequisicao: sincronizar grava, devolve situação e é idempotente', () => {
  const f = fonte();
  const req = { acao: 'sincronizar', codigo: 'ENTR01', aparelho_id: 'ap1', versao_app: '1.0.0', registros: [registro()] };
  let res = simples(r.atenderRequisicao(req, f));
  assert.deepEqual(res.aceitos, ['id-1']);
  assert.equal(f.estado.registros.length, 1);
  assert.equal(res.situacao.length, 1);
  assert.equal(res.situacao[0].status, 'Feito');
  res = simples(r.atenderRequisicao(req, f));
  assert.deepEqual(res.aceitos, ['id-1']);
  assert.equal(f.estado.registros.length, 1);
  const bruno = simples(r.atenderRequisicao({ acao: 'entrar', codigo: 'ENTR02' }, f));
  assert.deepEqual(bruno.situacao, []);
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `ENOENT ... apps-script/Regras.gs`.

- [ ] **Step 4: Implementar `apps-script/Regras.gs`**

```js
/**
 * Regras do servidor — funções puras, sem SpreadsheetApp (testadas em Node).
 * A leitura/escrita real das abas fica em Codigo.gs (fontePlanilha).
 * Depende de Leitor.gs (lerRoteiros, normalizarTexto).
 */

var CONFIG_PADRAO = {
  status: 'Feito;Ausente;Recusa;Não encontrado;Duplicidade',
  status_sem_obs: 'Feito',
  dias_passados: '7',
  gps_limite_m: '200',
  gps_precisao_max_m: '100',
  gps_timeout_s: '20',
  sync_intervalo_min: '5'
};

var COLUNAS_REGISTROS = ['id_marcacao', 'recebido_em', 'marcado_em', 'tipo', 'codigo_usuario', 'nome', 'papel',
  'data_roteiro', 'dupla', 'ponto', 'chave', 'status', 'obs', 'lat', 'lon', 'precisao_m', 'hora_gps',
  'dist_planejado_m', 'gps_ok', 'aparelho_id', 'versao_app'];

var COLUNAS_SITUACAO = ['chave', 'data_roteiro', 'dupla', 'ponto', 'status', 'status_em', 'nome', 'lat', 'lon',
  'precisao_m', 'dist_planejado_m', 'gps_ok', 'obs', 'obs_em', 'n_marcacoes'];

var PAPEIS = ['entrevistador', 'supervisor', 'admin'];
var GPS_VALIDOS = ['S', 'IMPRECISO', 'SEM_PERMISSAO', 'SEM_SINAL', 'NAO_SUPORTADO', 'NA'];
var ALFABETO_CODIGO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

var MENSAGENS_ERRO = {
  codigo_invalido: 'Código não reconhecido. Confira com o coordenador.',
  usuario_inativo: 'Acesso bloqueado — procure o coordenador.',
  requisicao_invalida: 'Requisição inválida.',
  falha_interna: 'Erro no servidor. Tente de novo mais tarde.'
};

function erroResposta(codigo) {
  return { ok: false, erro: codigo, mensagem: MENSAGENS_ERRO[codigo] || MENSAGENS_ERRO.falha_interna };
}

/** Linhas da aba Config (sem cabeçalho): [chave, valor]. Chaves ausentes/vazias usam o padrão. */
function lerConfig(linhas) {
  var bruto = {};
  Object.keys(CONFIG_PADRAO).forEach(function (k) { bruto[k] = CONFIG_PADRAO[k]; });
  (linhas || []).forEach(function (l) {
    var k = String(l[0] === null || l[0] === undefined ? '' : l[0]).trim();
    var v = l[1] === null || l[1] === undefined ? '' : String(l[1]).trim();
    if (k && v !== '' && CONFIG_PADRAO.hasOwnProperty(k)) bruto[k] = v;
  });
  var lista = function (k) { return bruto[k].split(';').map(function (x) { return x.trim(); }).filter(Boolean); };
  var numero = function (k) {
    var n = Number(String(bruto[k]).replace(',', '.'));
    return isFinite(n) && String(bruto[k]).trim() !== '' ? n : Number(CONFIG_PADRAO[k]);
  };
  return {
    status: lista('status'),
    status_sem_obs: lista('status_sem_obs'),
    dias_passados: numero('dias_passados'),
    gps_limite_m: numero('gps_limite_m'),
    gps_precisao_max_m: numero('gps_precisao_max_m'),
    gps_timeout_s: numero('gps_timeout_s'),
    sync_intervalo_min: numero('sync_intervalo_min')
  };
}

/** Linhas da aba Usuarios (sem cabeçalho): [nome, codigo, papel, dupla, ativo]. */
function acharUsuario(linhas, codigo) {
  var alvo = String(codigo === null || codigo === undefined ? '' : codigo).trim().toUpperCase();
  if (!alvo) return { erro: 'codigo_invalido' };
  for (var i = 0; i < linhas.length; i++) {
    var l = linhas[i];
    if (String(l[1] === null || l[1] === undefined ? '' : l[1]).trim().toUpperCase() !== alvo) continue;
    var papel = normalizarTexto(l[2]);
    if (PAPEIS.indexOf(papel) < 0) return { erro: 'codigo_invalido' };
    if (String(l[4] || '').trim().toUpperCase() !== 'S') return { erro: 'usuario_inativo' };
    var dupla = String(l[3] || '').trim().toUpperCase();
    if (papel === 'entrevistador' && !/^[A-Z]\d$/.test(dupla)) return { erro: 'codigo_invalido' };
    return { usuario: { nome: String(l[0] || '').trim(), codigo: alvo, papel: papel, dupla: papel === 'entrevistador' ? dupla : null } };
  }
  return { erro: 'codigo_invalido' };
}

function _somarDias(iso, n) {
  var p = iso.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}

function filtrarBlocos(blocos, usuario, hojeIso, diasPassados) {
  var inicio = _somarDias(hojeIso, -diasPassados);
  return blocos.filter(function (b) {
    return b.data >= inicio && (usuario.papel !== 'entrevistador' || b.dupla === usuario.dupla);
  });
}

function _podeMarcar(usuario, chave) {
  var partes = String(chave || '').split('|');
  if (partes.length !== 3 || !partes[2]) return false;
  return usuario.papel !== 'entrevistador' || partes[1] === usuario.dupla;
}

function _validarRegistro(r, usuario, config) {
  if (!r || typeof r.id_marcacao !== 'string' || !r.id_marcacao) return 'sem_id';
  if (r.tipo !== 'status' && r.tipo !== 'obs') return 'tipo_invalido';
  if (isNaN(Date.parse(r.marcado_em))) return 'data_invalida';
  if (!_podeMarcar(usuario, r.chave)) return 'ponto_fora_da_dupla';
  if (r.tipo === 'status' && config.status.indexOf(r.status) < 0) return 'status_invalido';
  if (GPS_VALIDOS.indexOf(r.gps_ok) < 0) return 'gps_invalido';
  return null;
}

function _numeroOuVazio(v) {
  return typeof v === 'number' && isFinite(v) ? v : '';
}

/** Valida marcações recebidas e monta as linhas novas de Registros (ordem de COLUNAS_REGISTROS). */
function processarRegistros(registros, ctx) {
  var u = ctx.usuario;
  var saida = { linhas: [], aceitos: [], rejeitados: [] };
  registros.forEach(function (r) {
    var id = r && r.id_marcacao;
    if (id && ctx.idsExistentes[id]) { saida.aceitos.push(id); return; }
    var motivo = _validarRegistro(r, u, ctx.config);
    if (motivo) { saida.rejeitados.push({ id_marcacao: String(id || ''), motivo: motivo }); return; }
    var partes = r.chave.split('|');
    saida.linhas.push([
      id, ctx.recebidoEm, String(r.marcado_em), r.tipo, u.codigo, u.nome, u.papel,
      partes[0], partes[1], partes[2], r.chave, String(r.status || ''), String(r.obs || '').slice(0, 1000),
      _numeroOuVazio(r.lat), _numeroOuVazio(r.lon), _numeroOuVazio(r.precisao_m),
      r.hora_gps ? String(r.hora_gps) : '', _numeroOuVazio(r.dist_planejado_m), r.gps_ok,
      ctx.aparelhoId || '', ctx.versaoApp || ''
    ]);
    ctx.idsExistentes[id] = true;
    saida.aceitos.push(id);
  });
  return saida;
}

/**
 * Aplica linhas de Registros sobre a Situacao (ordem de COLUNAS_SITUACAO).
 * tipo "status" só altera status/GPS (vence o marcado_em mais recente, em empate o que chegou depois);
 * tipo "obs" só altera a observação.
 */
function atualizarSituacao(situacao, registros) {
  var mapa = {};
  situacao.forEach(function (l) { mapa[l[0]] = l.slice(0, COLUNAS_SITUACAO.length); });
  registros.forEach(function (g) {
    var chave = g[10];
    var s = mapa[chave] || [chave, g[7], g[8], g[9], '', '', '', '', '', '', '', '', '', '', 0];
    var quando = Date.parse(g[2]);
    if (g[3] === 'status' && (!s[5] || quando >= Date.parse(s[5]))) {
      s[4] = g[11]; s[5] = g[2]; s[6] = g[5];
      s[7] = g[13]; s[8] = g[14]; s[9] = g[15]; s[10] = g[17]; s[11] = g[18];
    }
    if (g[3] === 'obs' && (!s[13] || quando >= Date.parse(s[13]))) {
      s[12] = g[12]; s[13] = g[2];
    }
    s[14] = (Number(s[14]) || 0) + 1;
    mapa[chave] = s;
  });
  return Object.keys(mapa).sort().map(function (k) { return mapa[k]; });
}

function situacaoParaApp(situacao, blocos) {
  var permitidas = {};
  blocos.forEach(function (b) { b.pontos.forEach(function (p) { permitidas[p.chave] = true; }); });
  var numero = function (v) { return typeof v === 'number' && isFinite(v) ? v : null; };
  var texto = function (v) { return v === null || v === undefined ? '' : String(v); };
  return situacao.filter(function (l) { return permitidas[l[0]]; }).map(function (l) {
    return {
      chave: l[0], status: texto(l[4]), status_em: texto(l[5]), nome: texto(l[6]),
      precisao_m: numero(l[9]), dist_planejado_m: numero(l[10]), gps_ok: texto(l[11]),
      obs: texto(l[12]), obs_em: texto(l[13])
    };
  });
}

function gerarCodigo(existentes, aleatorio) {
  var sorteio = aleatorio || Math.random;
  for (;;) {
    var codigo = '';
    for (var i = 0; i < 6; i++) codigo += ALFABETO_CODIGO.charAt(Math.floor(sorteio() * ALFABETO_CODIGO.length));
    if (!existentes[codigo]) return codigo;
  }
}

/** Atende "entrar" e "sincronizar" (contrato na seção 5.2 da especificação). */
function atenderRequisicao(req, fonte) {
  if (!req || (req.acao !== 'entrar' && req.acao !== 'sincronizar')) return erroResposta('requisicao_invalida');
  var config = lerConfig(fonte.lerConfig());
  var busca = acharUsuario(fonte.lerUsuarios(), req.codigo);
  if (busca.erro) return erroResposta(busca.erro);
  var usuario = busca.usuario;
  var agora = fonte.agoraIso();
  var resposta = {
    ok: true, servidor_em: agora,
    usuario: { nome: usuario.nome, papel: usuario.papel, dupla: usuario.dupla },
    config: config, aceitos: [], rejeitados: [], avisos: []
  };

  if (req.acao === 'sincronizar' && Array.isArray(req.registros) && req.registros.length) {
    fonte.comTrava(function () {
      var r = processarRegistros(req.registros.slice(0, 500), {
        usuario: usuario, config: config, idsExistentes: fonte.lerIdsRegistros(), recebidoEm: agora,
        aparelhoId: String(req.aparelho_id || ''), versaoApp: String(req.versao_app || '')
      });
      if (r.linhas.length) {
        fonte.acrescentarRegistros(r.linhas);
        fonte.gravarSituacao(atualizarSituacao(fonte.lerSituacao(), r.linhas));
      }
      resposta.aceitos = r.aceitos;
      resposta.rejeitados = r.rejeitados;
    });
  }

  var leitura = lerRoteiros(fonte.lerRoteiros());
  var blocos = filtrarBlocos(leitura.blocos, usuario, fonte.hojeIso(), config.dias_passados);
  resposta.roteiro = { gerado_em: agora, blocos: blocos };
  resposta.situacao = situacaoParaApp(fonte.lerSituacao(), blocos);
  if (usuario.papel !== 'entrevistador') resposta.avisos = leitura.avisos;
  return resposta;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test`
Expected: PASS — todos os testes (`dados-reais` PASS ou SKIP).

- [ ] **Step 6: Commit**

```bash
git add apps-script/Regras.gs testes/fonte-memoria.js testes/regras.test.js
git commit -m "Regras do servidor: usuarios, config, registros, situacao e contrato

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Cola com o Google Sheets (`Codigo.gs`)

**Files:**
- Create: `apps-script/Codigo.gs`, `apps-script/appsscript.json`

**Interfaces:**
- Consumes: tudo de `Regras.gs` e `Leitor.gs`.
- Produces: Web App (`doPost`, `doGet`); menu **Roteiros** com `configurarPlanilha`, `gerarCodigoLinhaSelecionada`, `verificarRoteiros`, `reconstruirSituacao`; `fontePlanilha()` implementando a interface *fonte* da Task 4.

Sem teste automatizado (depende do Google); a verificação é na Task 12. Toda a lógica testável já está em `Regras.gs`.

- [ ] **Step 1: Criar `apps-script/appsscript.json`**

```json
{
  "timeZone": "America/Sao_Paulo",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

- [ ] **Step 2: Criar `apps-script/Codigo.gs`**

```js
/**
 * Cola entre o Web App e a planilha. Regras de negócio ficam em Regras.gs e Leitor.gs.
 * Implantação: docs/implantacao.md.
 */

var ABA = { ROTEIROS: 'roteiros', USUARIOS: 'Usuarios', CONFIG: 'Config', REGISTROS: 'Registros', SITUACAO: 'Situacao' };

function doPost(e) {
  try {
    var req;
    try {
      req = JSON.parse(e.postData.contents);
    } catch (x) {
      return _json(erroResposta('requisicao_invalida'));
    }
    return _json(atenderRequisicao(req, fontePlanilha()));
  } catch (x) {
    console.error(x && x.stack ? x.stack : x);
    return _json(erroResposta('falha_interna'));
  }
}

/** Verificação rápida de que o Web App está no ar (abrir a URL no navegador). */
function doGet() {
  return _json({ ok: true, servico: 'roteiro-qagro' });
}

function fontePlanilha() {
  var p = SpreadsheetApp.getActive();
  var tz = Session.getScriptTimeZone();
  var agora = new Date();
  return {
    lerConfig: function () { return _linhasSemCabecalho(p, ABA.CONFIG); },
    lerUsuarios: function () { return _linhasSemCabecalho(p, ABA.USUARIOS); },
    lerRoteiros: function () { return _aba(p, ABA.ROTEIROS).getDataRange().getValues(); },
    lerIdsRegistros: function () {
      var aba = _aba(p, ABA.REGISTROS);
      var n = aba.getLastRow() - 1;
      var ids = {};
      if (n > 0) aba.getRange(2, 1, n, 1).getValues().forEach(function (l) { ids[l[0]] = true; });
      return ids;
    },
    acrescentarRegistros: function (linhas) {
      var aba = _aba(p, ABA.REGISTROS);
      aba.getRange(aba.getLastRow() + 1, 1, linhas.length, COLUNAS_REGISTROS.length).setValues(linhas);
    },
    lerSituacao: function () { return _linhasSemCabecalho(p, ABA.SITUACAO); },
    gravarSituacao: function (linhas) { _reescrever(_aba(p, ABA.SITUACAO), linhas, COLUNAS_SITUACAO.length); },
    comTrava: function (fn) {
      var trava = LockService.getScriptLock();
      trava.waitLock(30000);
      try { fn(); } finally { trava.releaseLock(); }
    },
    hojeIso: function () { return Utilities.formatDate(agora, tz, 'yyyy-MM-dd'); },
    agoraIso: function () { return Utilities.formatDate(agora, tz, "yyyy-MM-dd'T'HH:mm:ssXXX"); }
  };
}

// ---------- Menus ----------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Roteiros')
    .addItem('Verificar aba roteiros', 'verificarRoteiros')
    .addItem('Gerar código para linha selecionada', 'gerarCodigoLinhaSelecionada')
    .addSeparator()
    .addItem('Configurar planilha', 'configurarPlanilha')
    .addItem('Reconstruir Situacao', 'reconstruirSituacao')
    .addToUi();
}

/** Cria as abas que faltarem, cabeçalhos, valores padrão, formatos de texto e destaque da Situacao. */
function configurarPlanilha() {
  var p = SpreadsheetApp.getActive();
  _garantirAba(p, ABA.ROTEIROS, null);
  var usuarios = _garantirAba(p, ABA.USUARIOS, ['nome', 'codigo', 'papel', 'dupla', 'ativo']);
  usuarios.getRange('B:B').setNumberFormat('@');
  var config = _garantirAba(p, ABA.CONFIG, ['chave', 'valor']);
  if (config.getLastRow() < 2) {
    var chaves = Object.keys(CONFIG_PADRAO);
    config.getRange(2, 1, chaves.length, 2).setNumberFormat('@')
      .setValues(chaves.map(function (k) { return [k, CONFIG_PADRAO[k]]; }));
  }
  var registros = _garantirAba(p, ABA.REGISTROS, COLUNAS_REGISTROS);
  ['B:B', 'C:C', 'Q:Q'].forEach(function (a) { registros.getRange(a).setNumberFormat('@'); });
  var situacao = _garantirAba(p, ABA.SITUACAO, COLUNAS_SITUACAO);
  ['F:F', 'N:N'].forEach(function (a) { situacao.getRange(a).setNumberFormat('@'); });
  var limite = 'IFERROR(VALUE(VLOOKUP("gps_limite_m";INDIRECT("Config!A:B");2;FALSE));200)';
  var regra = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=OR(AND(ISNUMBER($K2);$K2>' + limite + ');AND($L2<>"";$L2<>"S";$L2<>"NA"))')
    .setBackground('#FFE0B2')
    .setRanges([situacao.getRange('A2:O')])
    .build();
  situacao.setConditionalFormatRules([regra]);
  _avisar('Planilha configurada. Cole a aba roteiros e cadastre os usuários.');
}

function gerarCodigoLinhaSelecionada() {
  var p = SpreadsheetApp.getActive();
  var aba = p.getActiveSheet();
  if (aba.getName() !== ABA.USUARIOS) return _avisar('Selecione uma linha na aba Usuarios.');
  var linha = aba.getActiveRange().getRow();
  if (linha < 2) return _avisar('Selecione a linha de um usuário (a partir da linha 2).');
  var celula = aba.getRange(linha, 2);
  if (String(celula.getValue()).trim()) return _avisar('Essa linha já tem código.');
  var existentes = {};
  _linhasSemCabecalho(p, ABA.USUARIOS).forEach(function (l) { existentes[String(l[1]).trim().toUpperCase()] = true; });
  celula.setNumberFormat('@').setValue(gerarCodigo(existentes));
}

/** Resumo por dia do que o app vai enxergar na aba roteiros, mais os avisos de leitura. */
function verificarRoteiros() {
  var p = SpreadsheetApp.getActive();
  var leitura = lerRoteiros(_aba(p, ABA.ROTEIROS).getDataRange().getValues());
  var porDia = {};
  leitura.blocos.forEach(function (b) {
    var d = porDia[b.data] || (porDia[b.data] = { duplas: [], pontos: 0, semTermino: 0 });
    d.duplas.push(b.dupla);
    d.pontos += b.pontos.length;
    if (!b.termino) d.semTermino++;
  });
  var linhas = Object.keys(porDia).sort().map(function (data) {
    var d = porDia[data];
    return data + ': ' + d.duplas.join(', ') + ' — ' + d.pontos + ' pontos' + (d.semTermino ? ' — ' + d.semTermino + ' sem término' : '');
  });
  var avisos = leitura.avisos.slice(0, 20);
  _avisar((linhas.length ? linhas.join('\n') : 'Nenhum bloco de dupla encontrado.') +
    (avisos.length ? '\n\nAvisos (' + leitura.avisos.length + '):\n' + avisos.join('\n') : '\n\nSem avisos.'));
}

/** Recalcula a aba Situacao inteira a partir de Registros. */
function reconstruirSituacao() {
  var p = SpreadsheetApp.getActive();
  var trava = LockService.getScriptLock();
  trava.waitLock(30000);
  try {
    var registros = _linhasSemCabecalho(p, ABA.REGISTROS);
    registros.sort(function (a, b) { return String(a[1]).localeCompare(String(b[1])); });
    _reescrever(_aba(p, ABA.SITUACAO), atualizarSituacao([], registros), COLUNAS_SITUACAO.length);
  } finally {
    trava.releaseLock();
  }
  _avisar('Situacao reconstruída a partir de ' + registros.length + ' registros.');
}

// ---------- Auxiliares ----------

function _aba(p, nome) {
  var aba = p.getSheetByName(nome);
  if (!aba) throw new Error('Aba "' + nome + '" não encontrada. Rode Roteiros ▸ Configurar planilha.');
  return aba;
}

function _linhasSemCabecalho(p, nome) {
  return _aba(p, nome).getDataRange().getValues().slice(1)
    .filter(function (l) { return l.some(function (c) { return c !== ''; }); });
}

function _reescrever(aba, linhas, ncol) {
  var n = aba.getLastRow();
  if (n > 1) aba.getRange(2, 1, n - 1, ncol).clearContent();
  if (linhas.length) aba.getRange(2, 1, linhas.length, ncol).setValues(linhas);
}

function _garantirAba(p, nome, cabecalho) {
  var aba = p.getSheetByName(nome) || p.insertSheet(nome);
  if (cabecalho && aba.getLastRow() === 0) {
    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold');
    aba.setFrozenRows(1);
  }
  return aba;
}

function _avisar(mensagem) {
  try {
    SpreadsheetApp.getUi().alert(mensagem);
  } catch (x) {
    console.log(mensagem); // executado pelo editor, sem interface
  }
}

function _json(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}
```

Nota para o executor: a fórmula de formatação condicional usa `;` como separador (planilha em pt-BR). Se a planilha estiver em localidade inglesa, a Task 12 detecta (a regra fica inválida) e troca por `,`.

- [ ] **Step 3: Conferir que os testes continuam passando**

Run: `npm test`
Expected: PASS (nenhum teste carrega `Codigo.gs`; ele não pode quebrar os demais).

- [ ] **Step 4: Commit**

```bash
git add apps-script/Codigo.gs apps-script/appsscript.json
git commit -m "Web App e menus da planilha (Apps Script)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Lógica pura do app (`app/logica.js`)

**Files:**
- Create: `app/logica.js`
- Test: `testes/logica.test.js`

**Interfaces:**
- Produces (globais):
  - `mesclarSituacao(servidor: ItemSituacao[], fila: Registro[]) → { [chave]: ItemSituacao & { pendente: boolean } }`
  - `Registro = { id_marcacao, tipo: 'status'|'obs', marcado_em, chave, status, obs, lat, lon, precisao_m, hora_gps, dist_planejado_m, gps_ok, nome }`
  - `classificarGps(posicao: {precisao_m}|null, erro: string|null, precisaoMax) → 'S'|'IMPRECISO'|'SEM_SINAL'|'SEM_PERMISSAO'|'NAO_SUPORTADO'`
  - `atrasoTentativa(falhas, maximoMs) → ms`
  - `resumoStatus(pontos, situacaoMapa, listaStatus) → { total, pendentes, porStatus: {status: n} }`
  - `formatarDistancia(m) → '14 m' | '1,5 km'`
  - `descreverGps(item, limiteM) → { texto, alerta }`
  - `isoComFuso(date) → 'AAAA-MM-DDTHH:MM:SS±HH:MM'`
  - `diaInicial(datas: string[], hojeIso) → string|null`
  - `rotuloDia(iso) → 'Seg 14/09'`
  - `escaparHtml(texto) → string`

- [ ] **Step 1: Escrever o teste `testes/logica.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar, simples } = require('./carregar');

const l = carregar('app/logica.js');

const servidor = [{
  chave: 'k', status: 'Feito', status_em: '2026-09-14T10:00:00-03:00', nome: 'Ana',
  precisao_m: 8, dist_planejado_m: 10, gps_ok: 'S', obs: 'a', obs_em: '2026-09-14T10:00:00-03:00',
}];
const reg = (extra) => Object.assign({
  id_marcacao: 'x', tipo: 'status', marcado_em: '2026-09-14T11:00:00-03:00', chave: 'k', status: 'Recusa',
  obs: '', precisao_m: 20, dist_planejado_m: 30, gps_ok: 'S', nome: 'Bia',
}, extra);

test('mesclarSituacao: só servidor', () => {
  const m = simples(l.mesclarSituacao(servidor, []));
  assert.equal(m.k.status, 'Feito');
  assert.equal(m.k.pendente, false);
});

test('mesclarSituacao: status da fila mais recente vence e fica pendente', () => {
  const m = simples(l.mesclarSituacao(servidor, [reg()]));
  assert.deepEqual([m.k.status, m.k.nome, m.k.dist_planejado_m, m.k.pendente, m.k.obs], ['Recusa', 'Bia', 30, true, 'a']);
});

test('mesclarSituacao: status da fila mais antigo não vence', () => {
  const m = simples(l.mesclarSituacao(servidor, [reg({ marcado_em: '2026-09-14T09:00:00-03:00' })]));
  assert.deepEqual([m.k.status, m.k.pendente], ['Feito', false]);
});

test('mesclarSituacao: observação da fila não mexe no status', () => {
  const m = simples(l.mesclarSituacao(servidor, [reg({ tipo: 'obs', status: '', obs: 'nova', gps_ok: 'NA' })]));
  assert.deepEqual([m.k.status, m.k.gps_ok, m.k.obs, m.k.pendente], ['Feito', 'S', 'nova', true]);
});

test('mesclarSituacao: ponto só na fila', () => {
  const m = simples(l.mesclarSituacao([], [reg({ chave: 'novo' })]));
  assert.deepEqual([m.novo.status, m.novo.pendente], ['Recusa', true]);
});

test('classificarGps', () => {
  assert.equal(l.classificarGps(null, 'SEM_PERMISSAO', 100), 'SEM_PERMISSAO');
  assert.equal(l.classificarGps(null, null, 100), 'SEM_SINAL');
  assert.equal(l.classificarGps({ precisao_m: 8 }, null, 100), 'S');
  assert.equal(l.classificarGps({ precisao_m: 150 }, null, 100), 'IMPRECISO');
});

test('atrasoTentativa: 30 s, dobra e respeita o máximo', () => {
  assert.deepEqual([0, 1, 2, 3, 10].map((n) => l.atrasoTentativa(n, 300000)), [0, 30000, 60000, 120000, 300000]);
});

test('resumoStatus', () => {
  const pontos = [{ chave: 'a' }, { chave: 'b' }, { chave: 'c' }];
  const r = simples(l.resumoStatus(pontos, { a: { status: 'Feito' }, b: { status: '' } }, ['Feito', 'Recusa']));
  assert.deepEqual(r, { total: 3, pendentes: 2, porStatus: { Feito: 1, Recusa: 0 } });
});

test('formatarDistancia', () => {
  assert.equal(l.formatarDistancia(14.4), '14 m');
  assert.equal(l.formatarDistancia(1500), '1,5 km');
});

test('descreverGps', () => {
  assert.deepEqual(simples(l.descreverGps({ gps_ok: 'S', precisao_m: 8, dist_planejado_m: 14 }, 200)), { texto: 'GPS ±8 m · a 14 m do ponto', alerta: false });
  assert.deepEqual(simples(l.descreverGps({ gps_ok: 'S', precisao_m: 8, dist_planejado_m: 640 }, 200)), { texto: 'GPS ±8 m · a 640 m do ponto', alerta: true });
  assert.deepEqual(simples(l.descreverGps({ gps_ok: 'IMPRECISO', precisao_m: 150, dist_planejado_m: null }, 200)), { texto: 'GPS impreciso ±150 m', alerta: true });
  assert.deepEqual(simples(l.descreverGps({ gps_ok: 'SEM_SINAL' }, 200)), { texto: 'sem GPS (sem sinal)', alerta: true });
  assert.deepEqual(simples(l.descreverGps({ gps_ok: 'NA' }, 200)), { texto: '', alerta: false });
});

test('isoComFuso: formato e ida e volta', () => {
  const d = new Date(2026, 8, 14, 10, 32, 5);
  const s = l.isoComFuso(d);
  assert.match(s, /^2026-09-14T10:32:05[+-]\d\d:\d\d$/);
  assert.equal(Date.parse(s), d.getTime());
});

test('diaInicial', () => {
  const datas = ['2026-09-14', '2026-09-15'];
  assert.equal(l.diaInicial(datas, '2026-09-15'), '2026-09-15');
  assert.equal(l.diaInicial(datas, '2026-09-13'), '2026-09-14');
  assert.equal(l.diaInicial(datas, '2026-09-20'), '2026-09-15');
  assert.equal(l.diaInicial([], '2026-09-20'), null);
});

test('rotuloDia', () => {
  assert.equal(l.rotuloDia('2026-09-14'), 'Seg 14/09');
  assert.equal(l.rotuloDia('2026-09-18'), 'Sex 18/09');
});

test('escaparHtml', () => {
  assert.equal(l.escaparHtml('<a href="x">&\''), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  assert.equal(l.escaparHtml(null), '');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `ENOENT ... app/logica.js`.

- [ ] **Step 3: Implementar `app/logica.js`**

```js
/* Lógica pura do app (sem DOM, sem IndexedDB). Testada em Node: testes/logica.test.js. */

/** Estado exibido por ponto: situação do servidor + marcações ainda na fila local. */
function mesclarSituacao(servidor, fila) {
  var mapa = {};
  (servidor || []).forEach(function (s) { mapa[s.chave] = Object.assign({}, s, { pendente: false }); });
  (fila || []).slice().sort(function (a, b) { return Date.parse(a.marcado_em) - Date.parse(b.marcado_em); })
    .forEach(function (r) {
      var s = mapa[r.chave] || { chave: r.chave, status: '', status_em: '', nome: '', precisao_m: null,
        dist_planejado_m: null, gps_ok: '', obs: '', obs_em: '', pendente: false };
      var quando = Date.parse(r.marcado_em);
      if (r.tipo === 'status' && (!s.status_em || quando >= Date.parse(s.status_em))) {
        s.status = r.status; s.status_em = r.marcado_em; s.nome = r.nome;
        s.precisao_m = r.precisao_m; s.dist_planejado_m = r.dist_planejado_m; s.gps_ok = r.gps_ok;
        s.pendente = true;
      }
      if (r.tipo === 'obs' && (!s.obs_em || quando >= Date.parse(s.obs_em))) {
        s.obs = r.obs; s.obs_em = r.marcado_em; s.pendente = true;
      }
      mapa[r.chave] = s;
    });
  return mapa;
}

function classificarGps(posicao, erro, precisaoMax) {
  if (!posicao) return erro || 'SEM_SINAL';
  return posicao.precisao_m <= precisaoMax ? 'S' : 'IMPRECISO';
}

/** Espera antes de nova tentativa de sincronização: 30 s, 1 min, 2 min... até o máximo. */
function atrasoTentativa(falhas, maximoMs) {
  if (falhas <= 0) return 0;
  return Math.min(30000 * Math.pow(2, falhas - 1), maximoMs);
}

function resumoStatus(pontos, situacao, listaStatus) {
  var r = { total: pontos.length, pendentes: 0, porStatus: {} };
  listaStatus.forEach(function (s) { r.porStatus[s] = 0; });
  pontos.forEach(function (p) {
    var s = situacao[p.chave];
    if (s && s.status && r.porStatus.hasOwnProperty(s.status)) r.porStatus[s.status]++;
    else r.pendentes++;
  });
  return r;
}

function formatarDistancia(m) {
  return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
}

var MOTIVOS_SEM_GPS = {
  SEM_SINAL: 'sem GPS (sem sinal)',
  SEM_PERMISSAO: 'sem GPS (localização bloqueada)',
  NAO_SUPORTADO: 'sem GPS (aparelho sem suporte)'
};

/** Texto do rodapé do cartão sobre o GPS da última marcação de status. */
function descreverGps(item, limiteM) {
  if (!item || !item.gps_ok || item.gps_ok === 'NA') return { texto: '', alerta: false };
  if (MOTIVOS_SEM_GPS[item.gps_ok]) return { texto: MOTIVOS_SEM_GPS[item.gps_ok], alerta: true };
  var impreciso = item.gps_ok === 'IMPRECISO';
  var partes = [(impreciso ? 'GPS impreciso ±' : 'GPS ±') + item.precisao_m + ' m'];
  var temDist = typeof item.dist_planejado_m === 'number';
  if (temDist) partes.push('a ' + formatarDistancia(item.dist_planejado_m) + ' do ponto');
  return { texto: partes.join(' · '), alerta: impreciso || (temDist && item.dist_planejado_m > limiteM) };
}

function _dois(n) {
  return (n < 10 ? '0' : '') + n;
}

/** Data/hora local com fuso, ex.: 2026-09-14T10:32:05-03:00 */
function isoComFuso(d) {
  var deslocamento = -d.getTimezoneOffset();
  var sinal = deslocamento >= 0 ? '+' : '-';
  var abs = Math.abs(deslocamento);
  return d.getFullYear() + '-' + _dois(d.getMonth() + 1) + '-' + _dois(d.getDate()) +
    'T' + _dois(d.getHours()) + ':' + _dois(d.getMinutes()) + ':' + _dois(d.getSeconds()) +
    sinal + _dois(Math.floor(abs / 60)) + ':' + _dois(abs % 60);
}

/** Dia aberto ao iniciar: hoje; senão o próximo com roteiro; senão o último. */
function diaInicial(datas, hojeIso) {
  if (!datas.length) return null;
  var ordenadas = datas.slice().sort();
  if (ordenadas.indexOf(hojeIso) >= 0) return hojeIso;
  for (var i = 0; i < ordenadas.length; i++) if (ordenadas[i] > hojeIso) return ordenadas[i];
  return ordenadas[ordenadas.length - 1];
}

var DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function rotuloDia(iso) {
  var p = iso.split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return DIAS_SEMANA[d.getUTCDay()] + ' ' + _dois(p[2]) + '/' + _dois(p[1]);
}

function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/logica.js testes/logica.test.js
git commit -m "Logica pura do app: mescla, GPS, formatacao

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Servidor local de desenvolvimento

**Files:**
- Create: `testes/servidor-local.js`
- Test: `testes/servidor-local.test.js`

**Interfaces:**
- Consumes: `atenderRequisicao`, `erroResposta` (Task 4), `criarFonteMemoria`, `linhasSinteticas`.
- Produces: `criarServidor() → http.Server` (Node). Rotas: `POST /api` (contrato da spec), `GET /config.js` (aponta `URL_API` para `/api`), arquivos estáticos de `app/`. Códigos de teste: `ENTR01` (A1), `ENTR02` (A2), `SUPE01` (supervisor), `INAT01` (inativo). Roteiro sintético começa **hoje**.

- [ ] **Step 1: Escrever o teste `testes/servidor-local.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { criarServidor } = require('./servidor-local');

let servidor;
let base;

test.before(async () => {
  servidor = criarServidor();
  await new Promise((ok) => servidor.listen(0, ok));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
test.after(() => servidor.close());

const api = (corpo) => fetch(`${base}/api`, {
  method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corpo),
}).then((r) => r.json());

test('API: entrar devolve só a dupla do entrevistador, começando hoje', async () => {
  const r = await api({ acao: 'entrar', codigo: 'ENTR01' });
  assert.equal(r.ok, true);
  assert.ok(r.roteiro.blocos.length >= 1);
  assert.ok(r.roteiro.blocos.every((b) => b.dupla === 'A1'));
  const hoje = new Date();
  const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  assert.equal(r.roteiro.blocos[0].data, iso);
});

test('API: corpo inválido vira requisicao_invalida', async () => {
  const r = await fetch(`${base}/api`, { method: 'POST', body: 'não é json' }).then((x) => x.json());
  assert.equal(r.erro, 'requisicao_invalida');
});

test('estáticos: página, config de desenvolvimento e bloqueio fora de app/', async () => {
  assert.equal((await fetch(`${base}/`)).status, 200);
  const cfg = await fetch(`${base}/config.js`).then((r) => r.text());
  assert.match(cfg, /URL_API: '\/api'/);
  assert.equal((await fetch(`${base}/%2e%2e/package.json`)).status, 404);
  assert.equal((await fetch(`${base}/nao-existe.js`)).status, 404);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module './servidor-local'`.

- [ ] **Step 3: Implementar `testes/servidor-local.js`**

```js
// Servidor de desenvolvimento: serve app/ e simula o Apps Script em /api com dados fictícios em memória.
// Uso: npm run servidor  →  http://localhost:8080
// Códigos: ENTR01 (dupla A1), ENTR02 (A2), SUPE01 (supervisor), INAT01 (inativo).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { carregar, RAIZ } = require('./carregar');
const { linhasSinteticas } = require('./fixtures/roteiros_sintetico');
const { criarFonteMemoria } = require('./fonte-memoria');

const PASTA_APP = path.join(RAIZ, 'app');
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.json': 'application/json',
};

function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function criarServidor() {
  const regras = carregar('apps-script/Geo.gs', 'apps-script/Leitor.gs', 'apps-script/Regras.gs');
  const agora = new Date();
  const fonte = criarFonteMemoria({
    roteiros: linhasSinteticas(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())),
    usuarios: [
      ['Entrevistador A1', 'ENTR01', 'entrevistador', 'A1', 'S'],
      ['Entrevistador A2', 'ENTR02', 'entrevistador', 'A2', 'S'],
      ['Supervisão', 'SUPE01', 'supervisor', '', 'S'],
      ['Inativo', 'INAT01', 'entrevistador', 'A1', 'N'],
    ],
    hoje: hojeLocal,
    agora: () => new Date().toISOString(),
  });

  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/api') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (req.method !== 'POST') { res.writeHead(405).end(); return; }
      let corpo = '';
      req.on('data', (parte) => { corpo += parte; });
      req.on('end', () => {
        let resposta;
        try {
          resposta = regras.atenderRequisicao(JSON.parse(corpo), fonte);
        } catch (e) {
          resposta = regras.erroResposta('requisicao_invalida');
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(resposta));
      });
      return;
    }

    if (url.pathname === '/config.js') {
      const versao = /VERSAO:\s*'([^']+)'/.exec(fs.readFileSync(path.join(PASTA_APP, 'config.js'), 'utf8'))[1];
      res.writeHead(200, { 'Content-Type': TIPOS['.js'], 'Cache-Control': 'no-store' });
      res.end(`var CONFIG = { URL_API: '/api', VERSAO: '${versao}' };\n`);
      return;
    }

    const relativo = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const arquivo = path.join(PASTA_APP, relativo);
    if (!arquivo.startsWith(PASTA_APP + path.sep) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('não encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
    fs.createReadStream(arquivo).pipe(res);
  });
}

if (require.main === module) {
  const porta = Number(process.env.PORTA || 8080);
  criarServidor().listen(porta, () => {
    console.log(`http://localhost:${porta}  — códigos: ENTR01 (A1), ENTR02 (A2), SUPE01 (supervisor), INAT01 (inativo)`);
  });
}

module.exports = { criarServidor };
```

- [ ] **Step 4: Criar um `app/config.js` provisório para o teste de `/config.js`**

```js
/*
 * Configuração do app.
 * Ao publicar qualquer mudança em app/, aumente VERSAO aqui e VERSAO_CACHE em sw.js para o MESMO número.
 */
var CONFIG = {
  URL_API: 'COLE_AQUI_A_URL_DO_APPS_SCRIPT',
  VERSAO: '1.0.0'
};
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test`
Expected: PASS — o teste `estáticos` pode falhar em `GET /` com 404 porque `app/index.html` ainda não existe. **Se for o caso**, crie agora o `app/index.html` da Task 9, Step 1 (é o mesmo arquivo) e rode de novo. Expected final: PASS.

- [ ] **Step 6: Commit**

```bash
git add testes/servidor-local.js testes/servidor-local.test.js app/config.js app/index.html
git commit -m "Servidor local de desenvolvimento com API simulada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Armazenamento, GPS e sincronização no navegador

**Files:**
- Create: `app/armazenamento.js`, `app/gps.js`, `app/sincronizacao.js`

**Interfaces:**
- Consumes: `CONFIG` (config.js), `atrasoTentativa` (logica.js).
- Produces:
  - `Banco.abrir() → Promise<IDBDatabase>`; `Banco.ler(chave) → Promise<any|null>`; `Banco.gravar(chave, valor)`; `Banco.gravarVarios([[chave, valor], ...])`; `Banco.lerFila() → Promise<Registro[]>`; `Banco.enfileirar(registro)`; `Banco.removerDaFila(ids)`; `Banco.apagarTudo()`. Chaves `kv` usadas: `codigo`, `usuario`, `config`, `roteiro`, `situacao`, `avisos`, `rejeitados`, `ultima_sinc`, `desvio_relogio_ms`, `aparelho_id`, `bloqueado`.
  - `Gps.iniciar()`, `Gps.parar()`, `Gps.permissaoNegada() → boolean`, `Gps.capturar(precisaoMax, timeoutS) → Promise<{ posicao: {lat, lon, precisao_m, hora_gps}|null, erro: 'SEM_SINAL'|'SEM_PERMISSAO'|'NAO_SUPORTADO'|null }>`. Evento `gps:estado` em `document` quando a permissão muda.
  - `Sync.entrar(codigo) → Promise<resposta>` (lança em erro de rede); `Sync.sincronizar(motivo) → Promise<resultado>`; `Sync.marcar(registro)`; `Sync.iniciarAgendamento()`; `Sync.reagendar()`; `Sync.sair() → Promise<boolean>`; `Sync.estaBloqueado() → boolean`; `Sync.carregarBloqueio()`. Eventos em `document`: `sync:inicio`, `sync:fim` (`detail` = resultado), `fila:alterada`.

Verificação no navegador na Task 9 (dependem da interface).

- [ ] **Step 1: Criar `app/armazenamento.js`**

```js
/*
 * Persistência local em IndexedDB.
 * Lojas: "kv" (sessão, roteiro, situação e estado diverso) e "fila" (marcações ainda não aceitas pelo servidor).
 */
var Banco = (function () {
  var NOME = 'roteiro-qagro';
  var VERSAO = 1;
  var conexao = null;

  function abrir() {
    if (conexao) return Promise.resolve(conexao);
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(NOME, VERSAO);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('fila')) db.createObjectStore('fila', { keyPath: 'id_marcacao' });
      };
      req.onsuccess = function () { conexao = req.result; resolve(conexao); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function pedido(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function concluir(tx) {
    return new Promise(function (resolve, reject) {
      tx.oncomplete = function () { resolve(); };
      tx.onerror = tx.onabort = function () { reject(tx.error); };
    });
  }

  async function ler(chave) {
    var db = await abrir();
    var valor = await pedido(db.transaction('kv').objectStore('kv').get(chave));
    return valor === undefined ? null : valor;
  }

  async function gravarVarios(pares) {
    var db = await abrir();
    var tx = db.transaction('kv', 'readwrite');
    pares.forEach(function (par) { tx.objectStore('kv').put(par[1], par[0]); });
    return concluir(tx);
  }

  function gravar(chave, valor) {
    return gravarVarios([[chave, valor]]);
  }

  async function lerFila() {
    var db = await abrir();
    return pedido(db.transaction('fila').objectStore('fila').getAll());
  }

  async function enfileirar(registro) {
    var db = await abrir();
    var tx = db.transaction('fila', 'readwrite');
    tx.objectStore('fila').put(registro);
    return concluir(tx);
  }

  async function removerDaFila(ids) {
    if (!ids.length) return;
    var db = await abrir();
    var tx = db.transaction('fila', 'readwrite');
    ids.forEach(function (id) { tx.objectStore('fila').delete(id); });
    return concluir(tx);
  }

  async function apagarTudo() {
    var db = await abrir();
    var tx = db.transaction(['kv', 'fila'], 'readwrite');
    tx.objectStore('kv').clear();
    tx.objectStore('fila').clear();
    return concluir(tx);
  }

  return { abrir: abrir, ler: ler, gravar: gravar, gravarVarios: gravarVarios, lerFila: lerFila,
    enfileirar: enfileirar, removerDaFila: removerDaFila, apagarTudo: apagarTudo };
})();
```

- [ ] **Step 2: Criar `app/gps.js`**

```js
/*
 * GPS: mantém a posição "aquecida" enquanto o app está visível (reduz a espera sem internet)
 * e captura a posição no momento da marcação. Funciona offline (receptor de satélite).
 */
var Gps = (function () {
  var observador = null;
  var ultima = null;
  var negada = false;

  function suportado() {
    return 'geolocation' in navigator;
  }

  function converter(p) {
    return {
      lat: Number(p.coords.latitude.toFixed(6)),
      lon: Number(p.coords.longitude.toFixed(6)),
      precisao_m: Math.round(p.coords.accuracy),
      hora_gps: isoComFuso(new Date(p.timestamp)),
      instante: p.timestamp
    };
  }

  function mudarPermissao(valor) {
    if (negada === valor) return;
    negada = valor;
    document.dispatchEvent(new CustomEvent('gps:estado'));
  }

  function iniciar() {
    if (!suportado() || observador !== null) return;
    observador = navigator.geolocation.watchPosition(function (p) {
      var pos = converter(p);
      if (!ultima || pos.instante >= ultima.instante) ultima = pos;
      mudarPermissao(false);
    }, function (e) {
      if (e.code === e.PERMISSION_DENIED) mudarPermissao(true);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 });
  }

  function parar() {
    if (observador === null) return;
    navigator.geolocation.clearWatch(observador);
    observador = null;
  }

  function semInstante(pos) {
    return pos && { lat: pos.lat, lon: pos.lon, precisao_m: pos.precisao_m, hora_gps: pos.hora_gps };
  }

  function capturar(precisaoMax, timeoutS) {
    return new Promise(function (resolve) {
      if (!suportado()) { resolve({ posicao: null, erro: 'NAO_SUPORTADO' }); return; }
      var inicio = Date.now();
      if (ultima && inicio - ultima.instante <= 30000 && ultima.precisao_m <= precisaoMax) {
        resolve({ posicao: semInstante(ultima), erro: null });
        return;
      }
      var melhor = null;
      var encerrado = false;
      var id = null;
      var timer = null;
      function encerrar(erro) {
        if (encerrado) return;
        encerrado = true;
        clearTimeout(timer);
        if (id !== null) navigator.geolocation.clearWatch(id);
        resolve({ posicao: semInstante(melhor), erro: melhor ? null : erro });
      }
      timer = setTimeout(function () { encerrar('SEM_SINAL'); }, timeoutS * 1000);
      id = navigator.geolocation.watchPosition(function (p) {
        var pos = converter(p);
        if (pos.instante < inicio - 30000) return; // leitura antiga guardada pelo sistema
        ultima = pos;
        if (!melhor || pos.precisao_m < melhor.precisao_m) melhor = pos;
        mudarPermissao(false);
        if (pos.precisao_m <= precisaoMax) encerrar(null);
      }, function (e) {
        if (e.code === e.PERMISSION_DENIED) { mudarPermissao(true); encerrar('SEM_PERMISSAO'); }
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutS * 1000 });
    });
  }

  return { iniciar: iniciar, parar: parar, capturar: capturar, permissaoNegada: function () { return negada; } };
})();
```

(`gps.js` usa `isoComFuso` de `logica.js`; a ordem dos `<script>` no `index.html` garante que `logica.js` vem antes.)

- [ ] **Step 3: Criar `app/sincronizacao.js`**

```js
/*
 * Fila de marcações e sincronização com o Apps Script.
 * Sincroniza ao abrir, ao voltar o sinal, ao voltar ao primeiro plano, em intervalo e pelo botão.
 * Depende de: CONFIG, Banco, atrasoTentativa (logica.js).
 */
var Sync = (function () {
  var TAMANHO_LOTE = 200;
  var TIMEOUT_MS = 30000;
  var emAndamento = null;
  var falhas = 0;
  var proximaTentativa = 0;
  var bloqueado = false;
  var temporizador = null;
  var agendado = false;

  function emitir(nome, detalhe) {
    document.dispatchEvent(new CustomEvent(nome, { detail: detalhe }));
  }

  async function chamar(corpo) {
    var controle = new AbortController();
    var t = setTimeout(function () { controle.abort(); }, TIMEOUT_MS);
    try {
      var resp = await fetch(CONFIG.URL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // sem preflight CORS (Apps Script)
        body: JSON.stringify(corpo),
        redirect: 'follow',
        cache: 'no-store',
        signal: controle.signal
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return await resp.json();
    } finally {
      clearTimeout(t);
    }
  }

  async function aparelhoId() {
    var id = await Banco.ler('aparelho_id');
    if (!id) { id = crypto.randomUUID(); await Banco.gravar('aparelho_id', id); }
    return id;
  }

  async function aplicarResposta(r) {
    await Banco.gravarVarios([
      ['usuario', r.usuario], ['config', r.config], ['roteiro', r.roteiro], ['situacao', r.situacao],
      ['avisos', r.avisos || []], ['ultima_sinc', new Date().toISOString()],
      ['desvio_relogio_ms', Date.parse(r.servidor_em) - Date.now()], ['bloqueado', false]
    ]);
    bloqueado = false;
  }

  async function entrar(codigo) {
    var r = await chamar({ acao: 'entrar', codigo: codigo, aparelho_id: await aparelhoId(), versao_app: CONFIG.VERSAO });
    if (!r.ok) return r;
    await Banco.gravar('codigo', codigo);
    await aplicarResposta(r);
    return r;
  }

  async function guardarRejeitados(rejeitados, lote) {
    if (!rejeitados.length) return;
    var porId = {};
    lote.forEach(function (x) { porId[x.id_marcacao] = x; });
    var anteriores = (await Banco.ler('rejeitados')) || [];
    await Banco.gravar('rejeitados', anteriores.concat(rejeitados.map(function (x) {
      return { motivo: x.motivo, registro: porId[x.id_marcacao] || null };
    })));
  }

  async function executar(motivo) {
    var codigo = await Banco.ler('codigo');
    if (!codigo) return { ok: false, erro: 'sem_codigo' };
    if (bloqueado && motivo !== 'manual') return { ok: false, erro: 'usuario_inativo' };
    if (motivo !== 'manual' && Date.now() < proximaTentativa) return { ok: false, erro: 'aguardando' };
    if (!navigator.onLine) return { ok: false, erro: 'offline' };

    emitir('sync:inicio');
    try {
      var fila = await Banco.lerFila();
      var id = await aparelhoId();
      var r = null;
      var i = 0;
      do {
        var lote = fila.slice(i, i + TAMANHO_LOTE);
        i += TAMANHO_LOTE;
        r = await chamar({ acao: 'sincronizar', codigo: codigo, aparelho_id: id, versao_app: CONFIG.VERSAO, registros: lote });
        if (!r.ok) break;
        await Banco.removerDaFila(r.aceitos.concat(r.rejeitados.map(function (x) { return x.id_marcacao; })));
        await guardarRejeitados(r.rejeitados, lote);
      } while (i < fila.length);

      if (!r.ok) {
        if (r.erro === 'usuario_inativo' || r.erro === 'codigo_invalido') {
          bloqueado = true;
          await Banco.gravar('bloqueado', true);
        }
      } else {
        await aplicarResposta(r);
        falhas = 0;
        proximaTentativa = 0;
      }
      emitir('sync:fim', r);
      return r;
    } catch (e) {
      falhas++;
      var cfg = await Banco.ler('config');
      proximaTentativa = Date.now() + atrasoTentativa(falhas, ((cfg && cfg.sync_intervalo_min) || 5) * 60000);
      var falha = { ok: false, erro: 'rede', mensagem: String((e && e.message) || e) };
      emitir('sync:fim', falha);
      return falha;
    }
  }

  function sincronizar(motivo) {
    if (emAndamento) return emAndamento;
    emAndamento = executar(motivo).finally(function () { emAndamento = null; });
    return emAndamento;
  }

  async function reagendar() {
    clearInterval(temporizador);
    var cfg = await Banco.ler('config');
    var minutos = (cfg && cfg.sync_intervalo_min) || 5;
    temporizador = setInterval(function () {
      if (document.visibilityState === 'visible') sincronizar('intervalo');
    }, minutos * 60000);
  }

  function iniciarAgendamento() {
    if (agendado) return;
    agendado = true;
    window.addEventListener('online', function () { proximaTentativa = 0; sincronizar('online'); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') sincronizar('visivel');
    });
    reagendar();
  }

  async function marcar(registro) {
    await Banco.enfileirar(registro);
    emitir('fila:alterada');
    sincronizar('marcacao');
  }

  async function sair() {
    if ((await Banco.lerFila()).length) return false;
    await Banco.apagarTudo();
    return true;
  }

  async function carregarBloqueio() {
    bloqueado = !!(await Banco.ler('bloqueado'));
  }

  return {
    entrar: entrar, sincronizar: sincronizar, marcar: marcar, iniciarAgendamento: iniciarAgendamento,
    reagendar: reagendar, sair: sair, carregarBloqueio: carregarBloqueio,
    estaBloqueado: function () { return bloqueado; }
  };
})();
```

- [ ] **Step 4: Conferir sintaxe**

Run: `node --check app/armazenamento.js && node --check app/gps.js && node --check app/sincronizacao.js && npm test`
Expected: sem erros de sintaxe; testes PASS.

- [ ] **Step 5: Commit**

```bash
git add app/armazenamento.js app/gps.js app/sincronizacao.js
git commit -m "Armazenamento local, GPS e sincronizacao do app

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Telas do app

**Files:**
- Create: `app/index.html`, `app/estilo.css`, `app/app.js`
- Modify: `app/config.js` (sem mudança de conteúdo; só confirmar que existe)

**Interfaces:**
- Consumes: `CONFIG`, `distanciaMetros`, todas as funções de `logica.js`, `Banco`, `Gps`, `Sync`.
- Produces: interface completa (entrada por código, topo com indicador, alertas, dias, filtros de supervisor, blocos, cartões, marcação com GPS, observação com salvamento automático, menu Sair). `registrarServiceWorker()` já presente, usado na Task 10.

- [ ] **Step 1: Criar `app/index.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#EC6707">
<title>Roteiros QAgro</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icones/icone-192.png">
<link rel="stylesheet" href="estilo.css">
</head>
<body>
<div id="app"><p class="carregando">Carregando…</p></div>
<script src="config.js"></script>
<script src="geo.js"></script>
<script src="logica.js"></script>
<script src="armazenamento.js"></script>
<script src="gps.js"></script>
<script src="sincronizacao.js"></script>
<script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Criar `app/estilo.css`**

```css
:root{--cor:#EC6707;--esc:#3A3A3A;--med:#595959;--cla:#9D9D9C;--fio:#E7E7E7;--ok:#2E7D32;--erro:#C62828;--fundo:#fff}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:Calibri,Carlito,"Segoe UI",Roboto,sans-serif;color:var(--med);background:var(--fundo);font-size:16px}
#app{max-width:760px;margin:0 auto;padding:0 12px 48px}
button{font-family:inherit;font-size:inherit;cursor:pointer}
.carregando,.vazio{color:var(--cla);font-style:italic;padding:24px 0;text-align:center}

.topo{position:sticky;top:0;z-index:10;background:var(--fundo);display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:2px solid var(--cor)}
.quem{flex:1;min-width:0;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.quem b{color:var(--esc)}
.sinc{border:1px solid var(--fio);background:#fff;border-radius:18px;padding:8px 12px;font-size:13px;min-height:44px;white-space:nowrap;color:var(--med)}
.sinc-verde .bola{color:var(--ok)}
.sinc-laranja{border-color:var(--cor)}
.sinc-laranja .bola{color:var(--cor)}
.sinc-cinza .bola{color:var(--cla)}
.menu{position:relative}
.menu summary{list-style:none;font-size:24px;line-height:1;padding:8px 10px;cursor:pointer;color:var(--esc)}
.menu summary::-webkit-details-marker{display:none}
.menu-corpo{position:absolute;right:0;top:44px;background:#fff;border:1px solid var(--fio);border-radius:6px;padding:10px;box-shadow:0 4px 16px rgba(0,0,0,.12);min-width:220px}
.menu-corpo button{width:100%;min-height:44px;padding:10px;border:1px solid var(--fio);background:#fff;border-radius:4px;text-align:left;color:var(--esc)}
.menu-corpo p{margin:8px 0 0;font-size:12px;color:var(--cla)}

.alertas{margin:10px 0;display:flex;flex-direction:column;gap:6px}
.alerta{border-radius:4px;padding:10px 12px;font-size:14px;line-height:1.35;border:1px solid}
.alerta.erro{background:#FDECEA;border-color:#F5C2C0;color:var(--erro)}
.alerta.aviso{background:#FFF4E5;border-color:#FFD8A8;color:#8A4B00}
.alerta.info{background:var(--cor);border-color:var(--cor);color:#fff;font-weight:700;text-align:center;width:100%;min-height:44px}
.alerta button{margin-left:6px;padding:4px 10px;border:1px solid currentColor;background:transparent;color:inherit;border-radius:3px}
.alerta ul{margin:6px 0 0;padding-left:18px}

.dias{display:flex;gap:6px;overflow-x:auto;padding:10px 0;border-bottom:1px solid var(--fio)}
.dia{flex:0 0 auto;padding:9px 12px;border:1px solid var(--fio);background:#fff;border-radius:3px;font-size:14px;color:var(--med);min-height:44px}
.dia.ativo,.fb.ativo{background:var(--cor);border-color:var(--cor);color:#fff;font-weight:700}
.filtro{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:10px 0}
.fr{font-size:11px;color:var(--cla);text-transform:uppercase;letter-spacing:.08em;font-weight:700;min-width:48px}
.fb{padding:7px 12px;border:1px solid var(--fio);background:#fff;border-radius:3px;font-size:14px;min-height:44px;color:var(--med)}
.resumo-duplas{overflow-x:auto;margin:10px 0}
.resumo-duplas table{border-collapse:collapse;font-size:13px;width:100%}
.resumo-duplas th,.resumo-duplas td{border-bottom:1px solid var(--fio);padding:6px 8px;text-align:right;white-space:nowrap}
.resumo-duplas th:first-child,.resumo-duplas td:first-child{text-align:left;font-weight:700;color:var(--esc)}

.bloco{margin:18px 0 30px}
.bloco h1{font-size:19px;color:var(--esc);margin:0 0 2px}
.sub{font-size:13px;color:var(--cla);font-style:italic;margin-bottom:10px}
.lugar{border-left:3px solid var(--cor);padding:8px 0 8px 12px;margin:12px 0}
.lugar-tit{color:var(--cor);font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.lugar-nome{color:var(--esc);font-weight:700;font-size:16px;margin-top:2px}
.lugar-end{font-size:14px;margin:2px 0 6px;line-height:1.35}

.card{border-bottom:1px solid var(--fio);padding:14px 0 14px 10px;border-left:4px solid transparent}
.card.st-ok{border-left-color:var(--ok)}
.card.st-outro{border-left-color:var(--cor)}
.l1{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ord{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;border:1.5px solid var(--cor);color:var(--cor);font-weight:700;font-size:13px;border-radius:3px}
.cod{font-weight:700;color:var(--esc);font-size:17px;letter-spacing:.02em}
.mun{font-size:14px}
.tag{font-size:11px;color:var(--cor);border:1px solid var(--cor);border-radius:3px;padding:1px 6px;text-transform:uppercase;letter-spacing:.04em}
.obsplan{font-size:14px;margin-top:4px;font-style:italic}
.coordrow{display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap}
.coord{font-family:Consolas,monospace;font-size:14px;background:#F6F6F6;padding:6px 8px;border-radius:3px;-webkit-user-select:all;user-select:all}
.btn{display:inline-flex;align-items:center;min-height:44px;padding:6px 14px;border:1px solid var(--fio);background:#fff;border-radius:3px;font-size:14px;color:var(--med);text-decoration:none}
.btn.ok{background:var(--ok);border-color:var(--ok);color:#fff}
.semcoord{font-size:13px;color:var(--erro);margin-top:6px}
.status{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.stb{min-height:44px;padding:8px 12px;border:1px solid var(--fio);background:#fff;border-radius:4px;font-size:14px;color:var(--med)}
.stb.ativo{background:var(--cor);border-color:var(--cor);color:#fff;font-weight:700}
.card.st-ok .stb.ativo{background:var(--ok);border-color:var(--ok)}
.stb:disabled{opacity:.5}
.obslivre{display:block;width:100%;margin-top:8px;font-family:inherit;font-size:15px;padding:8px;border:1px solid var(--fio);border-radius:4px;resize:vertical;color:var(--esc)}
.rodape{font-size:13px;color:var(--cla);margin-top:6px}
.rodape.alerta-gps{color:#8A4B00}
.pend{color:var(--cor);font-weight:700}

.entrada{padding:40px 4px}
.etq{color:var(--cor);font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase}
.entrada h1{color:var(--esc);font-size:24px;margin:4px 0 12px}
.entrada form{display:flex;gap:8px;margin:18px 0}
.entrada input{flex:1;min-width:0;font-size:22px;letter-spacing:.2em;text-transform:uppercase;padding:10px;border:2px solid var(--fio);border-radius:4px;font-family:Consolas,monospace}
.primario{background:var(--cor);color:#fff;border:0;border-radius:4px;padding:0 20px;font-weight:700;min-height:48px}
.primario:disabled{opacity:.6}
.nota{font-size:14px;line-height:1.4}
.erro-entrada{color:var(--erro);font-weight:700}
```

- [ ] **Step 3: Criar `app/app.js`**

```js
/*
 * Telas e interação.
 * Depende de: CONFIG (config.js), distanciaMetros (geo.js), funções de logica.js, Banco, Gps, Sync.
 */
var Estado = {
  usuario: null, config: null, roteiro: null, situacao: [], fila: [], avisos: [], rejeitados: [],
  ultimaSinc: null, desvio: 0, dia: null, filtroGrupo: '', filtroDupla: '',
  sincronizando: false, erroSync: null, capturando: {}, swEsperando: null
};
var raiz = document.getElementById('app');
var temporizadoresObs = {};
var eventosProntos = false;

var MOTIVOS_REJEICAO = {
  ponto_fora_da_dupla: 'ponto de outra dupla',
  status_invalido: 'status que não existe mais',
  data_invalida: 'data inválida',
  tipo_invalido: 'tipo inválido',
  gps_invalido: 'GPS inválido',
  sem_id: 'sem identificação'
};

var esc = escaparHtml;

function hojeIso() {
  return isoComFuso(new Date()).slice(0, 10);
}

function horaCurta(iso) {
  var d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toTimeString().slice(0, 5);
}

function supervisao() {
  return !!Estado.usuario && Estado.usuario.papel !== 'entrevistador';
}

function unicos(lista) {
  return lista.filter(function (v, i) { return lista.indexOf(v) === i; }).sort();
}

// ---------- Estado ----------

async function carregarEstado() {
  var chaves = ['usuario', 'config', 'roteiro', 'situacao', 'avisos', 'rejeitados', 'ultima_sinc', 'desvio_relogio_ms'];
  var v = await Promise.all(chaves.map(function (c) { return Banco.ler(c); }));
  Estado.usuario = v[0];
  Estado.config = v[1];
  Estado.roteiro = v[2];
  Estado.situacao = v[3] || [];
  Estado.avisos = v[4] || [];
  Estado.rejeitados = v[5] || [];
  Estado.ultimaSinc = v[6];
  Estado.desvio = v[7] || 0;
  Estado.fila = await Banco.lerFila();
}

function mesclado() {
  return mesclarSituacao(Estado.situacao, Estado.fila);
}

function datasDisponiveis() {
  return Estado.roteiro ? unicos(Estado.roteiro.blocos.map(function (b) { return b.data; })) : [];
}

function blocosDoDia() {
  if (!Estado.roteiro) return [];
  return Estado.roteiro.blocos.filter(function (b) { return b.data === Estado.dia; });
}

function blocosVisiveis() {
  return blocosDoDia().filter(function (b) {
    return (!Estado.filtroGrupo || b.grupo === Estado.filtroGrupo) && (!Estado.filtroDupla || b.dupla === Estado.filtroDupla);
  });
}

function acharPonto(chave) {
  var blocos = Estado.roteiro ? Estado.roteiro.blocos : [];
  for (var i = 0; i < blocos.length; i++) {
    for (var j = 0; j < blocos[i].pontos.length; j++) {
      if (blocos[i].pontos[j].chave === chave) return blocos[i].pontos[j];
    }
  }
  return null;
}

// ---------- Desenho ----------

function desenhar() {
  if (!Estado.config) return;
  var foco = capturarFoco();
  var datas = datasDisponiveis();
  if (!Estado.dia || datas.indexOf(Estado.dia) < 0) Estado.dia = diaInicial(datas, hojeIso());
  var sit = mesclado();
  raiz.innerHTML = htmlTopo() + htmlAlertas() + htmlDias(datas) +
    (supervisao() ? htmlFiltros() + htmlResumoDuplas(sit) : '') + htmlConteudo(sit);
  restaurarFoco(foco);
}

function htmlTopo() {
  var u = Estado.usuario || {};
  var n = Estado.fila.length;
  var ultima = Estado.ultimaSinc ? new Date(Estado.ultimaSinc) : null;
  var recente = ultima && Date.now() - ultima.getTime() < 3600000;
  var cor = n > 0 ? 'laranja' : (recente ? 'verde' : 'cinza');
  var quando = !ultima ? 'nunca'
    : (isoComFuso(ultima).slice(0, 10) === hojeIso() ? horaCurta(Estado.ultimaSinc)
      : rotuloDia(isoComFuso(ultima).slice(0, 10)) + ' ' + horaCurta(Estado.ultimaSinc));
  var texto = Estado.sincronizando ? 'Sincronizando…'
    : (n ? n + (n === 1 ? ' pendente' : ' pendentes') : 'tudo enviado') + ' · últ. sinc. ' + quando;
  return '<header class="topo">' +
    '<div class="quem"><b>' + esc(u.nome) + '</b> · ' + (u.dupla ? 'Dupla ' + esc(u.dupla) : esc(u.papel)) + '</div>' +
    '<button class="sinc sinc-' + cor + '" data-acao="sincronizar"><span class="bola">●</span> ' + esc(texto) + '</button>' +
    '<details class="menu"><summary aria-label="Menu">⋮</summary><div class="menu-corpo">' +
    '<button data-acao="sair">Sair deste aparelho</button><p>Versão ' + esc(CONFIG.VERSAO) + '</p></div></details>' +
    '</header>';
}

function htmlAlertas() {
  var a = [];
  var n = Estado.fila.length;
  if (Estado.swEsperando) a.push('<button class="alerta info" data-acao="atualizar-app">Nova versão disponível — toque para atualizar</button>');
  if (CONFIG.URL_API.indexOf('COLE_AQUI') === 0) a.push('<div class="alerta erro">App sem endereço do servidor (config.js).</div>');
  if (Sync.estaBloqueado()) a.push('<div class="alerta erro">Acesso bloqueado — procure o coordenador. As marcações continuam guardadas neste celular.</div>');
  if (Gps.permissaoNegada()) a.push('<div class="alerta erro">Localização bloqueada. No Chrome: ⋮ ▸ Configurações ▸ Configurações do site ▸ Localização ▸ permitir para este app.</div>');
  if (Math.abs(Estado.desvio) > 600000) a.push('<div class="alerta aviso">O relógio deste celular está errado. Ative “Data e hora automáticas” nas configurações do Android.</div>');
  if (n && (!navigator.onLine || (Estado.erroSync && Estado.erroSync.erro === 'rede'))) {
    a.push('<div class="alerta aviso">Sem conexão. ' + n + (n === 1 ? ' marcação guardada' : ' marcações guardadas') + ' neste celular; o envio é automático quando houver sinal.</div>');
  }
  if (Estado.rejeitados.length) {
    var motivos = unicos(Estado.rejeitados.map(function (x) { return MOTIVOS_REJEICAO[x.motivo] || x.motivo; }));
    a.push('<div class="alerta erro">' + Estado.rejeitados.length + ' marcação(ões) recusada(s) pelo servidor (' + esc(motivos.join(', ')) +
      '). Avise o coordenador. <button data-acao="limpar-rejeitados">ok</button></div>');
  }
  if (supervisao() && Estado.avisos.length) {
    a.push('<details class="alerta aviso"><summary>' + Estado.avisos.length + ' aviso(s) na aba roteiros</summary><ul>' +
      Estado.avisos.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>');
  }
  return a.length ? '<div class="alertas">' + a.join('') + '</div>' : '';
}

function htmlDias(datas) {
  if (!datas.length) return '<p class="vazio">Nenhum roteiro publicado ainda. Sincronize quando houver sinal.</p>';
  var hoje = hojeIso();
  return '<nav class="dias">' + datas.map(function (d) {
    return '<button class="dia' + (d === Estado.dia ? ' ativo' : '') + '" data-acao="dia" data-dia="' + d + '">' +
      (d === hoje ? 'Hoje · ' : '') + rotuloDia(d) + '</button>';
  }).join('') + '</nav>';
}

function htmlFiltros() {
  var duplas = unicos(blocosDoDia().map(function (b) { return b.dupla; }));
  var grupos = unicos(duplas.map(function (d) { return d.charAt(0); }));
  var botao = function (acao, valor, rotulo, ativo) {
    return '<button class="fb' + (ativo ? ' ativo' : '') + '" data-acao="' + acao + '" data-valor="' + esc(valor) + '">' + esc(rotulo) + '</button>';
  };
  return '<div class="filtro"><span class="fr">Grupo</span>' + botao('grupo', '', 'Todos', !Estado.filtroGrupo) +
    grupos.map(function (g) { return botao('grupo', g, g, Estado.filtroGrupo === g); }).join('') + '</div>' +
    '<div class="filtro"><span class="fr">Dupla</span>' + botao('dupla', '', 'Todas', !Estado.filtroDupla) +
    duplas.filter(function (d) { return !Estado.filtroGrupo || d.charAt(0) === Estado.filtroGrupo; })
      .map(function (d) { return botao('dupla', d, d, Estado.filtroDupla === d); }).join('') + '</div>';
}

function htmlResumoDuplas(sit) {
  var blocos = blocosVisiveis();
  if (!blocos.length) return '';
  var lista = Estado.config.status;
  var linhas = blocos.map(function (b) {
    var r = resumoStatus(b.pontos, sit, lista);
    return '<tr><td>' + esc(b.dupla) + '</td><td>' + r.total + '</td>' +
      lista.map(function (s) { return '<td>' + r.porStatus[s] + '</td>'; }).join('') + '<td>' + r.pendentes + '</td></tr>';
  });
  return '<div class="resumo-duplas"><table><thead><tr><th>Dupla</th><th>Pontos</th>' +
    lista.map(function (s) { return '<th>' + esc(s) + '</th>'; }).join('') + '<th>Pendentes</th></tr></thead><tbody>' +
    linhas.join('') + '</tbody></table></div>';
}

function htmlConteudo(sit) {
  var blocos = blocosVisiveis();
  if (!Estado.dia) return '';
  if (!blocos.length) return '<p class="vazio">Sem roteiro para este dia' + (supervisao() ? ' com esses filtros' : '') + '.</p>';
  return '<main>' + blocos.map(function (b) { return htmlBloco(b, sit); }).join('') + '</main>';
}

function htmlBloco(b, sit) {
  var r = resumoStatus(b.pontos, sit, Estado.config.status);
  var resumo = Estado.config.status.filter(function (s) { return r.porStatus[s]; })
    .map(function (s) { return r.porStatus[s] + ' ' + s; })
    .concat(r.pendentes ? [r.pendentes + (r.pendentes === 1 ? ' pendente' : ' pendentes')] : []).join(' · ');
  return '<section class="bloco"><h1>Dupla ' + esc(b.dupla) + ' · ' + rotuloDia(b.data) + '</h1>' +
    '<div class="sub">' + b.pontos.length + ' pontos · ' + esc(resumo) + '</div>' +
    htmlLugar('Encontro', b.encontro) +
    b.pontos.map(function (p) { return htmlPonto(p, sit[p.chave]); }).join('') +
    htmlLugar('Término', b.termino) + '</section>';
}

function htmlLugar(titulo, l) {
  if (!l) return '<div class="lugar"><div class="lugar-tit">' + titulo + '</div><div class="lugar-nome">' + titulo + ': a definir</div></div>';
  return '<div class="lugar"><div class="lugar-tit">' + titulo + '</div>' +
    '<div class="lugar-nome">' + esc(l.municipio || '') + '</div>' +
    (l.endereco ? '<div class="lugar-end">' + esc(l.endereco) + '</div>' : '') + htmlCoord(l.lat, l.lon) + '</div>';
}

function htmlCoord(lat, lon) {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return '<div class="semcoord">sem coordenada</div>';
  var txt = lat + ', ' + lon;
  return '<div class="coordrow"><code class="coord">' + txt + '</code>' +
    '<button class="btn" data-acao="copiar" data-texto="' + txt + '">copiar</button>' +
    '<a class="btn" href="geo:' + lat + ',' + lon + '?q=' + lat + ',' + lon + '">mapa</a></div>';
}

function htmlPonto(p, s) {
  var lista = Estado.config.status;
  var ativo = s && s.status ? s.status : '';
  var indice = ativo ? lista.indexOf(ativo) : -1;
  var capturando = !!Estado.capturando[p.chave];
  var semObs = Estado.config.status_sem_obs.indexOf(ativo) >= 0;
  var rodape = '';
  if (capturando) {
    rodape = '<div class="rodape">Capturando GPS…</div>';
  } else if (ativo) {
    var g = descreverGps(s, Estado.config.gps_limite_m);
    rodape = '<div class="rodape' + (g.alerta ? ' alerta-gps' : '') + '">' + esc(ativo) + ' · ' + horaCurta(s.status_em) +
      (s.nome ? ' · ' + esc(s.nome) : '') + (g.texto ? ' · ' + (g.alerta ? '⚠ ' : '') + esc(g.texto) : '') +
      (s.pendente ? ' · <span class="pend">não enviado</span>' : '') + '</div>';
  } else if (s && s.pendente) {
    rodape = '<div class="rodape"><span class="pend">observação não enviada</span></div>';
  }
  var ordem = p.ordem === null ? '–' : String(p.ordem).padStart(2, '0');
  return '<div class="card' + (indice === 0 ? ' st-ok' : (indice > 0 ? ' st-outro' : '')) + '">' +
    '<div class="l1"><span class="ord">' + ordem + '</span><span class="cod">' + esc(p.codigo) + '</span>' +
    '<span class="mun">' + esc(p.municipio || '') + '</span>' + (p.dup ? '<span class="tag">possível duplicidade</span>' : '') + '</div>' +
    (p.obs ? '<div class="obsplan">' + esc(p.obs) + '</div>' : '') + htmlCoord(p.lat, p.lon) +
    '<div class="status">' + lista.map(function (nome) {
      return '<button class="stb' + (ativo === nome ? ' ativo' : '') + '" data-acao="marcar" data-chave="' + esc(p.chave) +
        '" data-status="' + esc(nome) + '"' + (capturando ? ' disabled' : '') + '>' + esc(nome) + '</button>';
    }).join('') + '</div>' +
    '<textarea class="obslivre" rows="2" data-chave="' + esc(p.chave) + '" placeholder="' +
    (semObs ? 'Observação (opcional)' : 'Observação — ex.: agendou retorno às 15h') + '">' + esc(s ? s.obs || '' : '') + '</textarea>' +
    rodape + '</div>';
}

// Mantém o texto e o cursor da observação em edição quando a tela é redesenhada.
function capturarFoco() {
  var a = document.activeElement;
  if (!a || !a.matches || !a.matches('textarea.obslivre')) return null;
  return { chave: a.dataset.chave, valor: a.value, inicio: a.selectionStart, fim: a.selectionEnd };
}

function restaurarFoco(foco) {
  if (!foco) return;
  var t = raiz.querySelector('textarea.obslivre[data-chave="' + CSS.escape(foco.chave) + '"]');
  if (!t) return;
  t.value = foco.valor;
  t.focus({ preventScroll: true });
  t.setSelectionRange(foco.inicio, foco.fim);
}

// ---------- Ações ----------

async function marcar(chave, status) {
  var ponto = acharPonto(chave);
  if (!ponto || Estado.capturando[chave]) return;
  var marcadoEm = isoComFuso(new Date());
  var cfg = Estado.config;
  Estado.capturando[chave] = true;
  desenhar();
  try {
    var r = await Gps.capturar(cfg.gps_precisao_max_m, cfg.gps_timeout_s);
    var pos = r.posicao;
    var dist = pos && ponto.lat !== null ? Math.round(distanciaMetros(pos.lat, pos.lon, ponto.lat, ponto.lon)) : null;
    await Sync.marcar({
      id_marcacao: crypto.randomUUID(), tipo: 'status', marcado_em: marcadoEm, chave: chave, status: status,
      obs: obsAtual(chave), lat: pos ? pos.lat : null, lon: pos ? pos.lon : null,
      precisao_m: pos ? pos.precisao_m : null, hora_gps: pos ? pos.hora_gps : null, dist_planejado_m: dist,
      gps_ok: classificarGps(pos, r.erro, cfg.gps_precisao_max_m), nome: Estado.usuario.nome
    });
    Estado.fila = await Banco.lerFila();
  } finally {
    delete Estado.capturando[chave];
    desenhar();
  }
}

function obsAtual(chave) {
  var t = raiz.querySelector('textarea.obslivre[data-chave="' + CSS.escape(chave) + '"]');
  if (t) return t.value;
  var s = mesclado()[chave];
  return s ? s.obs || '' : '';
}

function agendarObs(t) {
  var chave = t.dataset.chave;
  clearTimeout(temporizadoresObs[chave]);
  temporizadoresObs[chave] = setTimeout(function () { salvarObs(chave, t.value); }, 1500);
}

function salvarObsAgora(t) {
  clearTimeout(temporizadoresObs[t.dataset.chave]);
  salvarObs(t.dataset.chave, t.value);
}

async function salvarObs(chave, texto) {
  delete temporizadoresObs[chave];
  var atual = mesclado()[chave];
  if ((atual ? atual.obs || '' : '') === texto) return;
  await Sync.marcar({
    id_marcacao: crypto.randomUUID(), tipo: 'obs', marcado_em: isoComFuso(new Date()), chave: chave,
    status: atual ? atual.status || '' : '', obs: texto, lat: null, lon: null, precisao_m: null,
    hora_gps: null, dist_planejado_m: null, gps_ok: 'NA', nome: Estado.usuario.nome
  });
}

function mostrarCopiado(botao) {
  var original = botao.textContent;
  botao.textContent = 'copiado';
  botao.classList.add('ok');
  setTimeout(function () { botao.textContent = original; botao.classList.remove('ok'); }, 1400);
}

function copiar(botao, texto) {
  var ta = document.createElement('textarea');
  ta.value = texto;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-999px';
  document.body.appendChild(ta);
  ta.select();
  var ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  document.body.removeChild(ta);
  if (ok) { mostrarCopiado(botao); return; }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(texto).then(function () { mostrarCopiado(botao); })
      .catch(function () { botao.textContent = 'segure na coordenada'; });
  }
}

async function sair() {
  if (!confirm('Sair deste aparelho? O roteiro salvo será apagado.')) return;
  if (!(await Sync.sair())) {
    alert('Há marcações ainda não enviadas. Sincronize com sinal antes de sair.');
    return;
  }
  location.reload();
}

async function aoClicar(e) {
  var el = e.target.closest('[data-acao]');
  if (!el) return;
  var acao = el.dataset.acao;
  if (acao === 'sincronizar') Sync.sincronizar('manual');
  else if (acao === 'dia') { Estado.dia = el.dataset.dia; desenhar(); window.scrollTo(0, 0); }
  else if (acao === 'grupo') { Estado.filtroGrupo = el.dataset.valor; Estado.filtroDupla = ''; desenhar(); }
  else if (acao === 'dupla') { Estado.filtroDupla = el.dataset.valor; desenhar(); }
  else if (acao === 'marcar') marcar(el.dataset.chave, el.dataset.status);
  else if (acao === 'copiar') copiar(el, el.dataset.texto);
  else if (acao === 'limpar-rejeitados') { await Banco.gravar('rejeitados', []); Estado.rejeitados = []; desenhar(); }
  else if (acao === 'atualizar-app' && Estado.swEsperando) Estado.swEsperando.postMessage('ATUALIZAR');
  else if (acao === 'sair') sair();
}

function prepararEventos() {
  if (eventosProntos) return;
  eventosProntos = true;
  raiz.addEventListener('click', aoClicar);
  raiz.addEventListener('input', function (e) { if (e.target.matches('textarea.obslivre')) agendarObs(e.target); });
  raiz.addEventListener('change', function (e) { if (e.target.matches('textarea.obslivre')) salvarObsAgora(e.target); });
  document.addEventListener('sync:inicio', function () { Estado.sincronizando = true; desenhar(); });
  document.addEventListener('sync:fim', async function (e) {
    await carregarEstado();
    Estado.sincronizando = false;
    Estado.erroSync = e.detail && !e.detail.ok ? e.detail : null;
    desenhar();
    Sync.reagendar();
  });
  document.addEventListener('fila:alterada', async function () { Estado.fila = await Banco.lerFila(); desenhar(); });
  document.addEventListener('gps:estado', desenhar);
  window.addEventListener('online', desenhar);
  window.addEventListener('offline', desenhar);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') Gps.iniciar(); else Gps.parar();
  });
}

// ---------- Entrada e início ----------

function telaEntrada(mensagem) {
  raiz.innerHTML = '<div class="entrada"><div class="etq">QAgro · COPPETEC</div><h1>Roteiros de campo</h1>' +
    '<p>Digite o código de acesso que você recebeu do coordenador. É preciso ter internet só neste primeiro acesso.</p>' +
    '<form id="form-entrada"><input id="codigo" autocomplete="off" autocapitalize="characters" maxlength="12" placeholder="Código" required>' +
    '<button class="primario" type="submit">Entrar</button></form>' +
    '<p class="nota">Em seguida o app vai pedir acesso à <b>localização</b>. Ela é registrada só quando você marca o status de um ponto, para confirmar a visita. Toque em <b>Permitir</b>.</p>' +
    (mensagem ? '<p class="erro-entrada">' + esc(mensagem) + '</p>' : '') + '</div>';
  document.getElementById('form-entrada').addEventListener('submit', async function (e) {
    e.preventDefault();
    var botao = this.querySelector('button');
    botao.disabled = true;
    botao.textContent = 'Entrando…';
    var codigo = document.getElementById('codigo').value.trim().toUpperCase();
    try {
      var r = await Sync.entrar(codigo);
      if (!r.ok) { telaEntrada(r.mensagem || 'Código não aceito.'); return; }
    } catch (x) {
      telaEntrada('Sem conexão com o servidor. Tente de novo onde houver sinal.');
      return;
    }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
    abrirPrincipal();
  });
}

async function abrirPrincipal() {
  await carregarEstado();
  prepararEventos();
  Gps.iniciar();
  Sync.iniciarAgendamento();
  desenhar();
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(function (reg) {
    var avisar = function (w) { Estado.swEsperando = w; desenhar(); };
    if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting);
    reg.addEventListener('updatefound', function () {
      var w = reg.installing;
      w.addEventListener('statechange', function () {
        if (w.state === 'installed' && navigator.serviceWorker.controller) avisar(w);
      });
    });
  });
  var recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (recarregou) return;
    recarregou = true;
    location.reload();
  });
}

async function iniciar() {
  registrarServiceWorker();
  try {
    await Banco.abrir();
  } catch (e) {
    raiz.innerHTML = '<p class="alerta erro">Este navegador bloqueou o armazenamento local. Use o Chrome, fora da aba anônima.</p>';
    return;
  }
  await Sync.carregarBloqueio();
  if (!(await Banco.ler('codigo'))) { telaEntrada(); return; }
  await abrirPrincipal();
  Sync.sincronizar('abertura');
}

iniciar();
```

- [ ] **Step 4: Conferir sintaxe e testes**

Run: `node --check app/app.js && npm test`
Expected: sem erros; PASS.

- [ ] **Step 5: Verificar no navegador com o servidor local**

Run (em segundo plano): `npm run servidor`
Abrir `http://localhost:8080` no navegador embutido (preview) e conferir:
1. Tela de entrada → código `ENTR01` → roteiro de hoje com "Dupla A1", Encontro, 3 pontos (AA0001X, AA0002X, AA0003X — este com "sem coordenada"), Término "a definir".
2. Aba do dia seguinte existe (A1 com 1 ponto).
3. Tocar "Feito" num ponto → "Capturando GPS…" → rodapé com status e motivo do GPS (no navegador de teste costuma ser `sem GPS (localização bloqueada)` ou `(sem sinal)` — esperado); indicador mostra pendente e logo "tudo enviado".
4. Digitar observação → após ~2 s sincroniza; recarregar a página → observação e status permanecem.
5. Menu ⋮ ▸ Sair → volta à entrada; entrar com `SUPE01` → filtros Grupo/Dupla, tabela-resumo, aviso "1 aviso(s) na aba roteiros"; o status marcado pela A1 aparece.
6. Entrar com `INAT01` → mensagem "Acesso bloqueado — procure o coordenador."
7. Console sem erros (`read_console_messages` com `onlyErrors`). Testar também largura de celular (`resize_window` preset `mobile`) e voltar a `desktop`.

- [ ] **Step 6: Commit**

```bash
git add app/index.html app/estilo.css app/app.js
git commit -m "Telas do app: roteiro, marcacao com GPS, observacao e supervisao

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: PWA — Service Worker, manifesto e ícones

**Files:**
- Create: `app/sw.js`, `app/manifest.webmanifest`, `ferramentas/gerar-icones.js`, `app/icones/icone-192.png`, `app/icones/icone-512.png`
- Test: `testes/app.test.js`

**Interfaces:**
- Consumes: `registrarServiceWorker()` (Task 9) — envia a mensagem `'ATUALIZAR'` ao worker em espera.
- Produces: `VERSAO_CACHE = 'roteiro-v<VERSAO>'`; lista `ARQUIVOS` (JSON com aspas duplas) com tudo que o app precisa offline.

- [ ] **Step 1: Escrever o teste `testes/app.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ } = require('./carregar');

const APP = path.join(RAIZ, 'app');
const ler = (arq) => fs.readFileSync(path.join(APP, arq), 'utf8');
const arquivosSw = () => JSON.parse(/const ARQUIVOS = (\[[\s\S]*?\]);/.exec(ler('sw.js'))[1]);

test('versão do config.js e do cache do Service Worker coincidem', () => {
  const versao = /VERSAO:\s*'([^']+)'/.exec(ler('config.js'))[1];
  const cache = /const VERSAO_CACHE = '([^']+)'/.exec(ler('sw.js'))[1];
  assert.equal(cache, 'roteiro-v' + versao, 'aumente VERSAO em config.js e VERSAO_CACHE em sw.js juntos');
});

test('todo arquivo do cache offline existe', () => {
  for (const arq of arquivosSw()) {
    if (arq === './') continue;
    assert.ok(fs.existsSync(path.join(APP, arq)), `faltando app/${arq}`);
  }
});

test('todo script e estilo do index.html está no cache offline', () => {
  const html = ler('index.html');
  const usados = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const cache = arquivosSw();
  for (const u of usados) assert.ok(cache.includes(u), `${u} não está em ARQUIVOS (sw.js)`);
});

test('manifesto válido com ícones PNG existentes', () => {
  const m = JSON.parse(ler('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  for (const icone of m.icons) {
    const buf = fs.readFileSync(path.join(APP, icone.src));
    assert.deepEqual([...buf.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${icone.src} não é PNG`);
  }
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `ENOENT ... app/sw.js`.

- [ ] **Step 3: Criar `ferramentas/gerar-icones.js` e gerar os PNGs**

```js
// Gera os ícones do app (PNG) sem dependências: fundo laranja com um marcador de mapa branco.
// Uso: node ferramentas/gerar-icones.js
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const LARANJA = [0xec, 0x67, 0x07];
const BRANCO = [0xff, 0xff, 0xff];

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function bloco(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

function png(tamanho, pixel) {
  const linhas = [];
  for (let y = 0; y < tamanho; y++) {
    const linha = Buffer.alloc(1 + tamanho * 3);
    for (let x = 0; x < tamanho; x++) {
      const [r, g, b] = pixel(x / tamanho, y / tamanho);
      linha[1 + x * 3] = r; linha[2 + x * 3] = g; linha[3 + x * 3] = b;
    }
    linhas.push(linha);
  }
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(tamanho, 0);
  cabecalho.writeUInt32BE(tamanho, 4);
  cabecalho[8] = 8; // bits por canal
  cabecalho[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloco('IHDR', cabecalho),
    bloco('IDAT', zlib.deflateSync(Buffer.concat(linhas))),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

// Marcador dentro da zona segura (80% central) exigida por ícones "maskable".
function marcador(u, v) {
  const cx = 0.5, cy = 0.42, raio = 0.2, furo = 0.08, ponta = 0.78;
  const d = Math.hypot(u - cx, v - cy);
  if (d <= furo) return LARANJA;
  if (d <= raio) return BRANCO;
  if (v >= cy && v <= ponta && Math.abs(u - cx) <= raio * (ponta - v) / (ponta - cy)) return BRANCO;
  return LARANJA;
}

const pasta = path.join(__dirname, '..', 'app', 'icones');
fs.mkdirSync(pasta, { recursive: true });
for (const tamanho of [192, 512]) {
  fs.writeFileSync(path.join(pasta, `icone-${tamanho}.png`), png(tamanho, marcador));
  console.log(`app/icones/icone-${tamanho}.png`);
}
```

Run: `node ferramentas/gerar-icones.js`
Expected: cria `app/icones/icone-192.png` e `app/icones/icone-512.png`. Abrir um deles com a ferramenta Read e conferir o desenho (quadrado laranja com marcador branco).

- [ ] **Step 4: Criar `app/manifest.webmanifest`**

```json
{
  "name": "Roteiros QAgro",
  "short_name": "Roteiros",
  "description": "Roteiros de campo QAgro — COPPETEC",
  "lang": "pt-BR",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#EC6707",
  "icons": [
    { "src": "icones/icone-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "icones/icone-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 5: Criar `app/sw.js`**

```js
/*
 * Service Worker: guarda o app no aparelho para abrir sem internet.
 * Chamadas ao Apps Script (outra origem) NUNCA passam pelo cache.
 * Ao publicar mudança em app/, aumente VERSAO_CACHE junto com VERSAO em config.js.
 */
const VERSAO_CACHE = 'roteiro-v1.0.0';
const ARQUIVOS = [
  "./",
  "index.html",
  "estilo.css",
  "config.js",
  "geo.js",
  "logica.js",
  "armazenamento.js",
  "gps.js",
  "sincronizacao.js",
  "app.js",
  "manifest.webmanifest",
  "icones/icone-192.png",
  "icones/icone-512.png"
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO_CACHE).then((cache) => cache.addAll(ARQUIVOS)));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO_CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// A nova versão só assume quando o usuário toca em "atualizar" (evita trocar o app no meio do trabalho).
self.addEventListener('message', (evento) => {
  if (evento.data === 'ATUALIZAR') self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);
  if (evento.request.method !== 'GET' || url.origin !== self.location.origin) return;
  evento.respondWith(
    caches.match(evento.request, { ignoreSearch: true })
      .then((resposta) => resposta || fetch(evento.request))
  );
});
```

- [ ] **Step 6: Rodar os testes**

Run: `npm test`
Expected: PASS — incluindo os 4 testes de `app.test.js`.

- [ ] **Step 7: Verificar offline no navegador**

Com `npm run servidor` rodando, no navegador embutido:
1. Abrir `http://localhost:8080`, entrar com `ENTR01`, recarregar uma vez (o Service Worker passa a controlar a página).
2. Parar o servidor (`preview_stop` ou encerrar o processo) e recarregar → o app abre com o roteiro salvo.
3. Marcar um ponto → indicador "1 pendente", alerta "Sem conexão…".
4. Subir o servidor de novo e acionar "Sincronizar" → "tudo enviado". (O servidor local recomeça vazio; o registro chega de novo porque ainda estava na fila — confirma que nada se perde.)
5. Alterar `VERSAO` para `1.0.1` em `config.js` **e** `VERSAO_CACHE` para `roteiro-v1.0.1` em `sw.js`, recarregar → aparece "Nova versão disponível — toque para atualizar" → tocar → recarrega na nova versão (menu ⋮ mostra 1.0.1). **Reverter as duas versões para 1.0.0** antes do commit.

- [ ] **Step 8: Commit**

```bash
git add app/sw.js app/manifest.webmanifest app/icones ferramentas/gerar-icones.js testes/app.test.js
git commit -m "PWA: service worker, manifesto e icones

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Documentação operacional e ajustes na especificação

**Files:**
- Create: `docs/implantacao.md`, `docs/operacao-diaria.md`, `docs/guia-entrevistador.md`, `.github/workflows/pages.yml`
- Modify: `docs/2026-09-26-roteiro-qagro-design.md` (seções 4.5, 6.3, 9), `docs/decisoes.md` (D9 atualizada, D12–D13), `README.md`

**Interfaces:**
- Consumes: nomes de menus, abas, colunas e códigos definidos nas Tasks 4–10.

- [ ] **Step 1: Criar `.github/workflows/pages.yml`**

```yaml
name: Testes e publicação do app

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  testes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm test

  publicar:
    needs: testes
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.publicacao.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: app
      - id: publicacao
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Criar `docs/implantacao.md`**

````markdown
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
````

- [ ] **Step 3: Criar `docs/operacao-diaria.md`**

````markdown
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

> Se remover um status que já foi usado, marcações antigas continuam na planilha, mas aparelhos com marcações pendentes daquele status terão essas marcações **recusadas** (aparece um aviso no app).

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
````

- [ ] **Step 4: Criar `docs/guia-entrevistador.md`**

````markdown
# Guia rápido — Entrevistador

*(Texto pensado para enviar no WhatsApp.)*

**1. Instalar (uma vez, com internet)**
- Abra o link do app **no Chrome**.
- Toque em **⋮ ▸ Instalar app** (ou "Adicionar à tela inicial").
- Abra pelo ícone laranja na tela inicial.

**2. Entrar**
- Digite o **código** que o coordenador mandou para você e toque em **Entrar**.
- Quando pedir **localização**, toque em **Permitir**.

**3. Todo dia**
- **Abra o app com internet antes de sair** (hotel, ponto de encontro) para receber o roteiro atualizado.
- No campo funciona **sem sinal**: veja o encontro, os pontos na ordem e o ponto de término.
- **copiar** copia a coordenada; **mapa** abre no aplicativo de mapas.

**4. Marcar cada ponto**
- Toque no status (Feito, Ausente, Recusa…). O app registra a hora e a **localização** na hora.
- Escreva a observação quando não for "Feito" (ex.: "agendou retorno às 15h").
- Errou? Toque no status certo — vale a última marcação.

**5. Envio**
- O envio é automático quando houver sinal. No topo: **laranja** = há marcações guardadas esperando sinal; **verde** = tudo enviado.
- Para forçar, toque no indicador do topo.
- **Não desinstale o app nem limpe os dados do Chrome** com marcações pendentes.

**Dicas**
- Deixe o app aberto ao chegar na área: o GPS "aquece" e a marcação fica mais rápida.
- Leve carregador ou power bank.
````

- [ ] **Step 5: Atualizar a especificação com os ajustes do planejamento**

Em `docs/2026-09-26-roteiro-qagro-design.md`:

(a) Substituir a seção **4.5** inteira por:

```markdown
### 4.5 Aba `Situacao` (sistema — uma linha por ponto marcado)

Colunas: `chave`, `data_roteiro`, `dupla`, `ponto`, `status`, `status_em`, `nome`, `lat`, `lon`, `precisao_m`, `dist_planejado_m`, `gps_ok`, `obs`, `obs_em`, `n_marcacoes`.

Mantida por *upsert* pela `chave`, com status e observação independentes:

- Marcação `tipo: status` altera `status`, `status_em`, `nome` e as colunas de GPS — se `marcado_em ≥ status_em` atual.
- Marcação `tipo: obs` altera `obs` e `obs_em` — se `marcado_em ≥ obs_em` atual.
- `n_marcacoes` soma todas.

Assim, uma observação editada num aparelho nunca apaga um status marcado em outro (e vice-versa).

Formatação condicional: `dist_planejado_m > gps_limite_m` ou `gps_ok` diferente de `S`/`NA` → linha destacada.

Um menu `Roteiros ▸ Reconstruir Situacao` recalcula a aba inteira a partir de `Registros` (recuperação). O menu `Roteiros ▸ Verificar aba roteiros` mostra o resumo por dia e os avisos de leitura logo após colar.
```

(b) Na seção **6.3**, trocar o primeiro item por:

```markdown
- **IndexedDB** (wrapper mínimo próprio, `app/armazenamento.js`) com duas lojas: `kv` (código, usuário, config, roteiro, situação do servidor, avisos, recusas, última sincronização) e `fila` (marcações pendentes). O estado exibido em cada cartão é calculado por `mesclarSituacao(situacaoServidor, fila)`.
```

e, na seção **6.4**, trocar o item 4 por `4. Grava na fila (uma transação) — a marcação aparece de imediato no cartão.`

(c) Na seção **9**, trocar a árvore e o parágrafo seguinte por:

````markdown
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
    ├── fonte-memoria.js          mesma interface de fontePlanilha(), em memória
    ├── servidor-local.js         app + API simulada para desenvolvimento
    ├── fixtures/roteiros_sintetico.js
    ├── fixtures/privado/         dados reais (fora do Git)
    └── *.test.js
```

`Geo.gs`, `Leitor.gs`, `Regras.gs` e `app/logica.js` são JavaScript puro, sem APIs do Google ou do navegador; os testes os executam num contexto `vm` do Node, que reproduz o escopo global do Apps Script. `Codigo.gs` só traduz entre a planilha e a interface *fonte* usada por `atenderRequisicao`.
````

(d) Na seção **10**, trocar a linha "Mescla de situação (função pura em `sincronizacao.js`)" por "Mescla de situação (função pura em `logica.js`)" e acrescentar ao fim dos automatizados: `- **Contrato do servidor** (`atenderRequisicao` com fonte em memória) e servidor local via HTTP.` e `- **Coerência do PWA:** versões iguais em config.js/sw.js; todo arquivo usado pelo index.html está no cache offline.`

- [ ] **Step 6: Atualizar `docs/decisoes.md`**

Substituir o bloco da **D9** por:

```markdown
## D9 — Conflitos: vence a marcação mais recente, status e observação independentes
**Data:** 26/09/2026 · **Status:** aceita (revisada no planejamento)

**Decisão:** `Registros` é somente-acréscimo; reenvios são idempotentes pelo `id_marcacao` (UUID gerado no aparelho). Em `Situacao`, status e observação têm carimbos próprios (`status_em`, `obs_em`): marcações de status só mudam o status/GPS, marcações de observação só mudam a observação; em cada um vence o `marcado_em` mais recente.
**Motivo:** evita que uma observação editada num aparelho apague um status marcado em outro aparelho ainda não sincronizado.
```

E acrescentar ao final:

```markdown
## D12 — Regras testáveis fora do Google (carregador vm + fonte de dados)
**Data:** 26/09/2026 · **Status:** aceita

**Decisão:** toda regra do servidor fica em `.gs` de JavaScript puro, incluindo a orquestração `atenderRequisicao(req, fonte)`. `Codigo.gs` só implementa a interface *fonte* sobre a planilha. Os testes executam os `.gs` num contexto `vm` do Node com uma fonte em memória; o mesmo par alimenta o servidor local de desenvolvimento.
**Motivo:** o contrato inteiro é testado automaticamente sem conta Google; o app pode ser desenvolvido e testado offline.

## D13 — Publicação por GitHub Actions
**Data:** 26/09/2026 · **Status:** aceita

**Decisão:** o workflow `.github/workflows/pages.yml` roda os testes e publica somente a pasta `app/` no GitHub Pages a cada push na `main`.
**Motivo:** o GitHub Pages "a partir de branch" só serve a raiz ou `/docs`; publicar só `app/` também evita expor `apps-script/`, `testes/` e `docs/` como site (continuam visíveis no repositório público, mas não são dados sensíveis).
```

- [ ] **Step 7: Atualizar `README.md`**

Substituir o conteúdo por:

````markdown
# App de Roteiros QAgro — COPPETEC

Aplicativo web instalável (PWA) para as duplas de campo da pesquisa QAgro consultarem o roteiro do dia **sem internet**, marcarem o status de cada ponto com **GPS automático** e sincronizarem tudo com uma **planilha Google** quando houver sinal.

- **Coordenador:** cola a aba `roteiros` do `Planejador.xlsx` na planilha Google; gerencia usuários e configuração na própria planilha.
- **Entrevistador:** instala o app pelo link do WhatsApp, entra com seu código, vê só a própria dupla.
- **Supervisor:** vê e acompanha todas as duplas.

## Documentação

| Documento | Para quem |
|---|---|
| [docs/guia-entrevistador.md](docs/guia-entrevistador.md) | Entrevistadores (enviar no WhatsApp) |
| [docs/operacao-diaria.md](docs/operacao-diaria.md) | Coordenador: roteiro, usuários, acompanhamento |
| [docs/implantacao.md](docs/implantacao.md) | Implantação inicial (planilha, Apps Script, GitHub Pages) |
| [docs/2026-09-26-roteiro-qagro-design.md](docs/2026-09-26-roteiro-qagro-design.md) | Especificação |
| [docs/decisoes.md](docs/decisoes.md) | Registro de decisões |
| [docs/2026-09-26-plano-implementacao.md](docs/2026-09-26-plano-implementacao.md) | Plano de implementação |

## Desenvolvimento

Requer Node 22+. Sem dependências.

```bash
npm test            # testes automatizados
npm run servidor    # app + API simulada em http://localhost:8080
```

Códigos do servidor local: `ENTR01` (dupla A1), `ENTR02` (A2), `SUPE01` (supervisor), `INAT01` (inativo).

Teste opcional com dados reais (ficam fora do Git): `python ferramentas/extrair_fixture_real.py && npm test`.
````

- [ ] **Step 8: Conferir e commitar**

Run: `npm test`
Expected: PASS.

```bash
git add .github docs README.md
git commit -m "Documentacao operacional, workflow de publicacao e ajustes na especificacao

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Implantação real e aceite (com o coordenador)

Esta task depende de ações do usuário em contas Google e GitHub. **Cada passo externo precisa de confirmação explícita do usuário no chat antes de ser feito** (publicar repositório, criar implantação).

**Files:**
- Modify: `app/config.js` (URL real), `docs/decisoes.md` (registrar URL/data de implantação em nova decisão se algo mudar)

- [ ] **Step 1: Planilha e Apps Script (usuário)**

Guiar o usuário por `docs/implantacao.md` seções 1 e 2. Receber dele a URL `/exec`.
Verificar: abrir a URL no navegador embutido → `{"ok":true,"servico":"roteiro-qagro"}`.

- [ ] **Step 2: Primeira carga (usuário)**

Usuário cola a aba `roteiros` (com as linhas **Ponto de término** já incluídas no Planejador), cadastra ao menos um entrevistador e um supervisor e roda **Roteiros ▸ Verificar aba roteiros**. Conferir com ele o resumo (para a S2: 30 blocos / 573 pontos nos dias 14–18/09, se esses dias ainda estiverem na planilha).

- [ ] **Step 3: Testar o contrato real por linha de comando**

```bash
curl -sL -H "Content-Type: text/plain" -d '{"acao":"entrar","codigo":"<CODIGO_SUPERVISOR>"}' "<URL_EXEC>" | head -c 600
```

Expected: JSON com `"ok":true`, `"usuario"` e `"roteiro"`. (O código é do próprio coordenador, digitado por ele no chat para este teste.)

- [ ] **Step 4: Configurar a URL no app**

Em `app/config.js`: `URL_API: '<URL_EXEC>'`. Rodar `npm test`. Commit: `Configurar URL do Apps Script`.

- [ ] **Step 5: Repositório no GitHub (confirmar com o usuário antes — repositório público)**

Após o "sim" do usuário:

```bash
gh repo create roteiro-qagro --public --source . --push --description "App de roteiros de campo QAgro (COPPETEC)"
gh api -X POST "repos/{owner}/roteiro-qagro/pages" -f build_type=workflow
gh run watch
```

Expected: workflow verde; URL `https://<owner>.github.io/roteiro-qagro/`.

- [ ] **Step 6: Aceite no Android (usuário, guiado)**

Executar com o usuário o roteiro de aceite manual da especificação (seção 10, itens 1–10) e registrar o resultado de cada item. Qualquer falha volta como correção com teste antes de distribuir o link.

- [ ] **Step 7: Encerramento**

Atualizar `README.md` com o endereço publicado e a data de implantação; commit e push. Enviar ao usuário o texto de `docs/guia-entrevistador.md` pronto para o WhatsApp, com o link real.
