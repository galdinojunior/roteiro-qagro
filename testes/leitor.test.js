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
