// Teste com a aba "roteiros" real do Planejador.xlsx. O arquivo de dados fica fora do Git
// (coordenadas de domicílios). Gere com: python ferramentas/extrair_fixture_real.py "<caminho do Planejador.xlsx>"
//
// O Planejador muda toda semana; por isso o teste confere regras que valem para qualquer versão
// dele (e não números de um retrato antigo): blocos bem formados, pontos únicos e em ordem,
// coordenadas legíveis e formato S1 ignorado.
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

test('dados reais do Planejador: blocos bem formados', { skip: !existe && 'rode ferramentas/extrair_fixture_real.py' }, () => {
  const g = carregar('apps-script/Geo.gs', 'apps-script/Leitor.gs');
  const { blocos, avisos } = simples(g.lerRoteiros(lerLinhas()));

  assert.ok(blocos.length > 0, 'nenhum bloco de dupla encontrado');
  assert.ok(blocos.every((b) => b.data >= '2026-09-14'), 'o formato S1 (antes de 14/09) deve ser ignorado');
  assert.ok(blocos.every((b) => /^[A-Z]\d$/.test(b.dupla) && b.grupo === b.dupla.charAt(0)));
  assert.ok(blocos.every((b) => b.pontos.length > 0), 'bloco sem pontos deveria ter sido descartado');
  assert.ok(blocos.every((b) => b.encontro && b.encontro.municipio), 'todo bloco precisa de ponto de encontro');

  const chaves = blocos.flatMap((b) => b.pontos.map((p) => p.chave));
  assert.equal(new Set(chaves).size, chaves.length, 'chaves de ponto repetidas');
  for (const b of blocos) {
    const ordens = b.pontos.map((p) => p.ordem).filter((o) => o !== null);
    assert.deepEqual(ordens, [...ordens].sort((x, y) => x - y), `pontos fora de ordem em ${b.data} ${b.dupla}`);
    assert.ok(b.pontos.every((p) => p.chave === `${b.data}|${b.dupla}|${p.codigo}`));
  }
  assert.deepEqual(avisos.filter((a) => a.includes('coordenada')), []);
});
