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
  assert.deepEqual(a.pontos[0], {
    chave: '2026-10-12|A|AA0001X', ordem: 1, codigo: 'AA0001X', municipio: 'Cidade Alfa',
    lat: -20.001, lon: -44.001, dup: false, obs: null, visitas: 0,
  });
  assert.deepEqual(a.pontos[1], {
    chave: '2026-10-12|A|AA0002X', ordem: 2, codigo: 'AA0002X', municipio: 'Cidade Alfa',
    lat: -20.002, lon: -44.002, dup: true, obs: null, visitas: 1,
  });
  assert.deepEqual(a.pontos[2], {
    chave: '2026-10-12|A|AA0003X', ordem: 3, codigo: 'AA0003X', municipio: 'Cidade Alfa',
    lat: null, lon: null, dup: false, obs: 'Casa amarela', visitas: 2,
  });
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

test('ignora outros lugares e trata EQUIPE9 como código de ponto', () => {
  const linhas = linhasSinteticas();
  linhas.splice(4, 0, [linhas[3][0], 'A', 99, 0, 1, 'Cidade Alfa', 'Ponto de apoio', null, 'inválida', null]);
  linhas.splice(5, 0, [linhas[3][0], 'A', 99, 0, 7, 'Cidade Alfa', 'EQUIPE9', null, '-20.007,-44.007', null]);
  const r = ler(linhas);
  assert.ok(r.blocos[0].pontos.some((p) => p.codigo === 'EQUIPE9'));
  assert.ok(!r.blocos[0].pontos.some((p) => p.codigo === 'Ponto de apoio'));
  assert.ok(!r.avisos.some((aviso) => aviso.includes('Ponto de apoio')));
});

test('períodos seguem literalmente a tabela da especificação', () => {
  const data = '2026-10-12';
  const casos = [
    ['12 e 13/10', data, ['2026-10-12', '2026-10-13']],
    ['14, 15 e 16/10', data, ['2026-10-14', '2026-10-15', '2026-10-16']],
    ['29, 30/10 e 02/11', data, ['2026-10-29', '2026-10-30', '2026-11-02']],
    ['30/10 a 02/11', data, ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']],
    ['28/09, seg, 9:00h', '2026-09-28', ['2026-09-28']],
    ['30/12 a 02/01', '2026-12-30', ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']],
    ['12 e 13/10/2026', data, ['2026-10-12', '2026-10-13']],
  ];
  for (const [texto, dataBloco, dias] of casos) {
    assert.deepEqual(simples(g.lerPeriodo(texto, dataBloco, 7).dias), dias, texto);
  }
  assert.deepEqual(simples(g.lerPeriodo(new Date(2026, 8, 8), data, 7)), { dias: ['2026-09-08'], periodo: null, aviso: null });
  for (const texto of ['abc', '31/02']) {
    const r = simples(g.lerPeriodo(texto, data, 7));
    assert.deepEqual(r.dias, [data]);
    assert.equal(r.periodo, texto);
    assert.ok(r.aviso.includes('Linha 7: período "' + texto + '" não reconhecido; usando só a data do bloco.'));
  }
  assert.equal(g.lerPeriodo('01/10 a 31/10', data, 7).dias.length, 31);
  assert.equal(g.lerPeriodo('01/10 a 31/10', data, 7).aviso, null);
  const longo = simples(g.lerPeriodo('01/10 a 01/11', data, 7));
  assert.deepEqual(longo.dias, [data]);
  assert.ok(longo.aviso.includes('não reconhecido'));
  assert.deepEqual(simples(g.lerPeriodo('01/10 a 15/11', data, 7)), {
    dias: [data], periodo: '01/10 a 15/11',
    aviso: 'Linha 7: período "01/10 a 15/11" não reconhecido; usando só a data do bloco.',
  });
});

test('período sintético acompanha datas de início, inclusive viradas de mês e ano', () => {
  for (const inicio of [new Date(2026, 9, 31), new Date(2026, 11, 30)]) {
    const bloco = ler(linhasSinteticas(inicio)).blocos[0];
    const d0 = inicio.toISOString().slice(0, 10);
    const d1 = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 1).toISOString().slice(0, 10);
    assert.deepEqual(bloco.dias, [d0, d1]);
  }
});

test('aceita dois blocos da mesma equipe e data quando ambos têm pontos distintos', () => {
  const linhas = linhasSinteticas().slice(0, 17);
  linhas.push(
    [new Date(2026, 9, 12), 'A', 99, '-', '', null, 'Equipe A', null, null, null],
    [new Date(2026, 9, 12), 'A', 99, 0, 1, 'Cidade Alfa', 'AAOUTRO', 0, '-20.050,-44.050', null],
  );
  const r = ler(linhas);
  assert.deepEqual(r.blocos.filter((b) => b.data === '2026-10-12' && b.equipe === 'A').map((b) => b.pontos[0].codigo),
    ['AA0001X', 'AAOUTRO']);
});

test('lerRoteiros trata período vazio e período Date', () => {
  const vazio = linhasSinteticas().slice(0, 10);
  vazio[2][4] = '';
  assert.deepEqual(ler(vazio).blocos[0].dias, ['2026-10-12']);
  const comData = linhasSinteticas().slice(0, 10);
  comData[2][4] = new Date(2026, 9, 15);
  assert.deepEqual(ler(comData).blocos[0].dias, ['2026-10-15']);
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
  assert.equal(g.dataIso('31/02/2026'), null);
  assert.equal(g.dataIso(null), null);
  assert.equal(g.normalizarTexto('  Ponto de TÉRMINO '), 'ponto de termino');
});
