const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar, simples } = require('./carregar');
const { linhasSinteticas } = require('./fixtures/roteiros_sintetico');
const { criarFonteMemoria } = require('./fonte-memoria');

const r = carregar('apps-script/Geo.gs', 'apps-script/Leitor.gs', 'apps-script/Regras.gs');

const USUARIOS = [
  ['Ana', 'ENTR01', 'entrevistador', 'A', 'S'],
  ['Bruno', 'ENTR02', 'Entrevistador', 'b', 's'],
  ['Sara', 'SUPE01', 'supervisor', '', 'S'],
  ['Ivo', 'INAT01', 'entrevistador', 'A', 'N'],
  ['Sem Equipe', 'SEMD01', 'entrevistador', '', 'S'],
];
const col = (nome) => r.COLUNAS_REGISTROS.indexOf(nome);
const sit = (nome) => r.COLUNAS_SITUACAO.indexOf(nome);

function registro(extra) {
  return Object.assign({
    id_marcacao: 'id-1', tipo: 'status', marcado_em: '2026-09-14T10:00:00-03:00',
    chave: '2026-10-12|A|AA0001X', status: 'Feito', obs: '',
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
  assert.equal(c.tentativas_max, 3);
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
  assert.equal(simples(r.lerConfig([['tentativas_max', '2']])).tentativas_max, 2);
  assert.equal(simples(r.lerConfig([['tentativas_max', '0']])).tentativas_max, 3);
  assert.equal(simples(r.lerConfig([['tentativas_max', '2,5']])).tentativas_max, 3);
});

// --- usuários ---
test('acharUsuario: entrevistador, maiúsculas/minúsculas e supervisor', () => {
  assert.deepEqual(simples(r.acharUsuario(USUARIOS, 'ENTR01')), { usuario: { nome: 'Ana', codigo: 'ENTR01', papel: 'entrevistador', equipe: 'A' } });
  assert.deepEqual(simples(r.acharUsuario(USUARIOS, ' entr02 ')).usuario.equipe, 'B');
  assert.deepEqual(simples(r.acharUsuario(USUARIOS, 'SUPE01')).usuario, { nome: 'Sara', codigo: 'SUPE01', papel: 'supervisor', equipe: null });
});

test('acharUsuario: aceita A1 e espaços, mas rejeita equipes inválidas de entrevistador', () => {
  const usuarios = USUARIOS.concat([
    ['Legado', 'A1COD', 'entrevistador', 'A1', 'S'],
    ['Com espaços', 'ESP01', 'entrevistador', ' a1 ', 'S'],
    ['Duas letras', 'ABC01', 'entrevistador', 'AB', 'S'],
    ['Só número', 'NUM01', 'entrevistador', '1', 'S'],
  ]);
  assert.equal(simples(r.acharUsuario(usuarios, 'A1COD')).usuario.equipe, 'A');
  assert.equal(simples(r.acharUsuario(usuarios, 'ESP01')).usuario.equipe, 'A');
  assert.deepEqual(simples(r.acharUsuario(usuarios, 'ABC01')), { erro: 'codigo_invalido' });
  assert.deepEqual(simples(r.acharUsuario(usuarios, 'NUM01')), { erro: 'codigo_invalido' });
});

test('acharUsuario: erros', () => {
  assert.deepEqual(simples(r.acharUsuario(USUARIOS, 'INAT01')), { erro: 'usuario_inativo' });
  assert.deepEqual(simples(r.acharUsuario(USUARIOS, 'XXXX')), { erro: 'codigo_invalido' });
  assert.deepEqual(simples(r.acharUsuario(USUARIOS, 'SEMD01')), { erro: 'codigo_invalido' });
  assert.deepEqual(simples(r.acharUsuario(USUARIOS, '')), { erro: 'codigo_invalido' });
});

// --- filtro de roteiro ---
test('filtrarBlocos: entrevistador só vê a equipe; usa o último dia do período', () => {
  const blocos = r.lerRoteiros(linhasSinteticas()).blocos;
  const ana = r.acharUsuario(USUARIOS, 'ENTR01').usuario;
  const sara = r.acharUsuario(USUARIOS, 'SUPE01').usuario;
  const ids = (lista) => simples(lista).map((b) => b.data + '|' + b.equipe);
  assert.deepEqual(ids(r.filtrarBlocos(blocos, ana, '2026-10-12', 0)), ['2026-10-12|A', '2026-10-13|A']);
  assert.equal(r.filtrarBlocos(blocos, sara, '2026-09-14', 7).length, 3);
  assert.deepEqual(ids(r.filtrarBlocos(blocos, sara, '2026-10-20', 7)), ['2026-10-12|A', '2026-10-13|A']);
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
  assert.equal(l[col('data_roteiro')], '2026-10-12');
  assert.equal(l[col('equipe')], 'A');
  assert.equal(l[col('ponto')], 'AA0001X');
  assert.equal(l[col('nome')], 'Ana');
  assert.equal(l[col('codigo_usuario')], 'ENTR01');
  assert.equal(l[col('lat')], -20.0011);
  assert.equal(l[col('gps_ok')], 'S');
  assert.equal(l[col('aparelho_id')], 'ap1');
});

test('processarRegistros: mantém textos de fórmulas e limpa identificadores', () => {
  let res = simples(r.processarRegistros([registro({ tipo: 'obs', status: '', obs: '=1+1', gps_ok: 'NA' })], contexto({ aparelhoId: '=x<>' })));
  assert.equal(res.linhas[0][col('obs')], '=1+1');
  assert.equal(res.linhas[0][col('aparelho_id')], 'x');
  res = simples(r.processarRegistros([registro({ id_marcacao: 'id-2', tipo: 'obs', status: '', obs: '1/2', gps_ok: 'NA' })], contexto()));
  assert.equal(res.linhas[0][col('obs')], '1/2');
});

test('protegerParaPlanilha: protege fórmulas sem alterar a entrada', () => {
  const linhas = [['a', '=1+1', '+x', '-y', '@z', 'ok', 5]];
  assert.deepEqual(simples(r.protegerParaPlanilha(linhas, [1, 2, 3, 4, 5, 6])),
    [['a', "'=1+1", "'+x", "'-y", "'@z", 'ok', 5]]);
  assert.deepEqual(linhas, [['a', '=1+1', '+x', '-y', '@z', 'ok', 5]]);
});

test('colunas de texto livre: índices correspondem a status e obs', () => {
  assert.equal(r.COLUNAS_REGISTROS[11], 'status');
  assert.equal(r.COLUNAS_REGISTROS[12], 'obs');
  assert.equal(r.COLUNAS_SITUACAO[4], 'status');
  assert.equal(r.COLUNAS_SITUACAO[12], 'obs');
});

test('processarRegistros: id já gravado ou repetido no lote não duplica', () => {
  let res = simples(r.processarRegistros([registro()], contexto({ idsExistentes: { 'id-1': true } })));
  assert.deepEqual([res.linhas.length, res.aceitos], [0, ['id-1']]);
  res = simples(r.processarRegistros([registro(), registro()], contexto()));
  assert.deepEqual([res.linhas.length, res.aceitos], [1, ['id-1', 'id-1']]);
});

test('processarRegistros: rejeições com motivo', () => {
  const motivo = (extra) => simples(r.processarRegistros([registro(extra)], contexto())).rejeitados[0].motivo;
  assert.equal(motivo({ chave: '2026-10-12|B|BB0001X' }), 'ponto_fora_da_dupla');
  assert.equal(motivo({ chave: 'sem-formato' }), 'ponto_fora_da_dupla');
  assert.equal(motivo({ status: 'Talvez' }), 'status_invalido');
  assert.equal(motivo({ tipo: 'x' }), 'tipo_invalido');
  assert.equal(motivo({ marcado_em: 'ontem' }), 'data_invalida');
  assert.equal(motivo({ gps_ok: 'X' }), 'gps_invalido');
  assert.equal(motivo({ id_marcacao: '' }), 'sem_id');
  assert.equal(motivo({ id_marcacao: '=HYPERLINK("x")' }), 'sem_id');
  assert.equal(motivo({ tipo: 'obs', status: 'Talvez', gps_ok: 'NA' }), 'status_invalido');
});

test('processarRegistros: supervisor marca qualquer equipe; números inválidos viram vazio', () => {
  const res = simples(r.processarRegistros([registro({ chave: '2026-10-12|B|BB0001X', lat: 'abc' })], contexto({}, 'SUPE01')));
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
  const linhas = r.processarRegistros([registro(), registro({ id_marcacao: 'b', chave: '2026-10-12|B|BB0001X' })], contexto({}, 'SUPE01')).linhas;
  const s = r.atualizarSituacao([], linhas);
  const soA1 = r.filtrarBlocos(blocos, r.acharUsuario(USUARIOS, 'ENTR01').usuario, '2026-09-14', 7);
  const itens = simples(r.situacaoParaApp(s, soA1));
  assert.deepEqual(itens, [{
    chave: '2026-10-12|A|AA0001X', status: 'Feito', status_em: '2026-09-14T10:00:00-03:00', nome: 'Sara',
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
  assert.deepEqual(res.usuario, { nome: 'Ana', papel: 'entrevistador', equipe: 'A' });
  assert.deepEqual(res.roteiro.blocos.map((b) => b.equipe), ['A', 'A']);
  assert.deepEqual(res.situacao, []);
  assert.deepEqual(res.avisos, []);
  assert.equal(res.config.gps_limite_m, 200);
  assert.equal(res.config.tentativas_max, 3);
});

test('atenderRequisicao: supervisor vê tudo e recebe avisos', () => {
  const res = simples(r.atenderRequisicao({ acao: 'entrar', codigo: 'SUPE01' }, fonte()));
  assert.equal(res.roteiro.blocos.length, 3);
  assert.deepEqual(res.avisos, [
    'Linha 7: coordenada ilegível no ponto AA0003X.',
    'Linha 17: cabeçalho de bloco não reconhecido ("Equipe XYZ"); bloco ignorado.',
    'Linha 20: ponto AA0001X repetido na equipe A; ignorado.',
  ]);
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

test('atenderRequisicao: observação de fórmula permanece limpa nos dados de negócio', () => {
  const f = fonte();
  const req = {
    acao: 'sincronizar', codigo: 'ENTR01', aparelho_id: 'ap1', versao_app: '1.0.0',
    registros: [registro({ tipo: 'obs', status: '', obs: '=1+1', gps_ok: 'NA' })]
  };
  const res = simples(r.atenderRequisicao(req, f));
  assert.equal(res.situacao[0].obs, '=1+1');
  assert.equal(f.estado.registros[0][col('obs')], '=1+1');
});
