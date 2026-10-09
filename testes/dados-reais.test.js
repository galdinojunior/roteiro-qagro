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

// Deve ser igual ao padrão de tentativas_max na Config (3).
const TENTATIVAS_MAX = 3;
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

  assert.ok(blocos.length > 0, 'nenhum bloco de equipe encontrado');
  assert.ok(blocos.every((b) => /^[A-Z]$/.test(b.equipe)));
  assert.ok(blocos.every((b) => b.pontos.length > 0), 'bloco sem pontos deveria ter sido descartado');
  assert.ok(blocos.filter((b) => b.data >= '2026-09-28').every((b) => b.encontro && b.encontro.municipio), 'blocos recentes precisam de ponto de encontro');
  assert.ok(blocos.every((b) => b.dias.length && b.dias.join() === [...b.dias].sort().join()));

  const chaves = blocos.flatMap((b) => b.pontos.map((p) => p.chave));
  assert.equal(new Set(chaves).size, chaves.length, 'chaves de ponto repetidas');
  for (const b of blocos) {
    const ordens = b.pontos.map((p) => p.ordem).filter((o) => o !== null);
    assert.deepEqual(ordens, [...ordens].sort((x, y) => x - y), `pontos fora de ordem em ${b.data} ${b.equipe}`);
    assert.ok(b.pontos.every((p) => p.chave === `${b.data}|${b.equipe}|${p.codigo}` && p.visitas < TENTATIVAS_MAX));
  }
  assert.deepEqual(avisos.filter((a) => a.includes('coordenada')), []);
});
