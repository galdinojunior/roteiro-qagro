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
