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

test('rotuloTentativa', () => {
  assert.equal(l.rotuloTentativa(0, 3), '');
  assert.equal(l.rotuloTentativa(1, 3), '2ª tentativa');
  assert.equal(l.rotuloTentativa(2, 3), '3ª e última tentativa');
  assert.equal(l.rotuloTentativa(1, 2), '2ª e última tentativa');
  assert.equal(l.rotuloTentativa(undefined, 3), '');
  assert.equal(l.rotuloTentativa('x', 3), '');
});

test('diasDosBlocos e blocosDoDia usam os dias do período', () => {
  const blocos = [
    { equipe: 'A', dias: ['2026-10-13', '2026-10-12'] },
    { equipe: 'B', dias: ['2026-10-13', '2026-10-14'] },
  ];
  assert.deepEqual(simples(l.diasDosBlocos(blocos)), ['2026-10-12', '2026-10-13', '2026-10-14']);
  assert.deepEqual(simples(l.blocosDoDia(blocos, '2026-10-13')), blocos);
  assert.deepEqual(simples(l.blocosDoDia(blocos, '2026-10-15')), []);
});

test('bloco sem dias (servidor antigo) vale só a data do bloco', () => {
  const blocos = [{ equipe: 'A', data: '2026-10-12' }];
  assert.deepEqual(simples(l.diasDosBlocos(blocos)), ['2026-10-12']);
  assert.deepEqual(simples(l.blocosDoDia(blocos, '2026-10-12')), blocos);
  assert.deepEqual(simples(l.blocosDoDia(blocos, '2026-10-13')), []);
});

test('escaparHtml', () => {
  assert.equal(l.escaparHtml('<a href="x">&\''), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  assert.equal(l.escaparHtml(null), '');
});
