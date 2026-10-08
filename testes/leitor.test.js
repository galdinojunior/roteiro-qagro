const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar, simples } = require('./carregar');
const { linhasSinteticas } = require('./fixtures/roteiros_sintetico');

const g = carregar('apps-script/Geo.gs', 'apps-script/Leitor.gs');
const ler = (linhas, opcoes) => simples(g.lerRoteiros(linhas, opcoes));

test('lê equipes, períodos, tentativas e chaves na ordem da planilha', () => {
  const r = ler(linhasSinteticas());
  assert.deepEqual(r.blocos.map((b) => b.data + '|' + b.equipe), ['2026-10-12|A', '2026-10-12|B', '2026-10-13|A']);
  const a = r.blocos[0];
  assert.deepEqual(a.dias, ['2026-10-12', '2026-10-13']);
  assert.equal(a.periodo, '12 e 13/10');
  assert.deepEqual(a.pontos.map((p) => [p.codigo, p.ordem, p.visitas]), [['AA0001X', 1, 0], ['AA0002X', 2, 1], ['AA0003X', 3, 2], ['AAHIFEN', 5, 0]]);
  assert.equal(a.pontos[0].chave, '2026-10-12|A|AA0001X');
  assert.equal(r.esgotados, 2);
  assert.equal(a.esgotados, 1);
  assert.ok(r.avisos.some((aviso) => aviso.includes('coordenada ilegível no ponto AA0003X')));
  assert.deepEqual(a.encontro, { municipio: 'Cidade Alfa', lat: -20, lon: -44, endereco: 'Praça Alfa' });
  assert.ok(a.termino);
});

test('aceita cabeçalho Equipe A1, rejeita cabeçalho inválido e chave repetida entre blocos', () => {
  const r = ler(linhasSinteticas());
  assert.equal(r.blocos[2].equipe, 'A');
  assert.ok(r.avisos.includes('Linha 17: cabeçalho de bloco não reconhecido ("Equipe XYZ"); bloco ignorado.'));
  assert.ok(r.avisos.some((a) => a.includes('AA0001X') && a.includes('repetido')));
});

test('períodos seguem literalmente a tabela da especificação', () => {
  const data = '2026-10-12';
  const casos = [
    ['12 e 13/10', ['2026-10-12', '2026-10-13']], ['14, 15 e 16/10', ['2026-10-14', '2026-10-15', '2026-10-16']],
    ['29, 30/10 e 02/11', ['2026-10-29', '2026-10-30', '2026-11-02']], ['30/10 a 02/11', ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']],
    ['28/09, seg, 9:00h', ['2026-09-28']], ['30/12 a 02/01', ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']],
  ];
  for (const [texto, dias] of casos) assert.deepEqual(simples(g.lerPeriodo(texto, texto.startsWith('28/') ? '2026-09-28' : (texto.startsWith('30/12') ? '2026-12-30' : data), 7).dias), dias, texto);
  assert.deepEqual(simples(g.lerPeriodo(new Date(2026, 8, 8), data, 7)), { dias: ['2026-09-08'], periodo: null, aviso: null });
  for (const texto of ['abc', '31/02']) {
    const r = simples(g.lerPeriodo(texto, data, 7));
    assert.deepEqual(r.dias, [data]);
    assert.ok(r.aviso.includes('Linha 7: período "' + texto + '" não reconhecido; usando só a data do bloco.'));
  }
});

test('tentativas_max diferente esgota visitas iguais ao limite e bloco só esgotado é descartado', () => {
  const r = ler(linhasSinteticas(), { tentativasMax: 2 });
  assert.ok(!r.blocos[0].pontos.some((p) => p.codigo === 'AA0003X'));
  assert.equal(r.esgotados, 3);
  assert.equal(r.blocos.some((b) => b.equipe === 'C'), false);
});

test('sem cabeçalho, dataIso e normalização', () => {
  assert.equal(ler([['x']]).blocos.length, 0);
  assert.equal(g.dataIso('5/9/2026'), '2026-09-05');
  assert.equal(g.normalizarTexto('  Ponto de TÉRMINO '), 'ponto de termino');
});
