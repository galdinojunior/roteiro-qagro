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

// Índices de status e observação nas linhas de Registros.
var COLUNAS_TEXTO_LIVRE_REGISTROS = [11, 12];
// Índices de status e observação nas linhas de Situacao.
var COLUNAS_TEXTO_LIVRE_SITUACAO = [4, 12];

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
  if (!r || typeof r.id_marcacao !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(r.id_marcacao)) return 'sem_id';
  if (r.tipo !== 'status' && r.tipo !== 'obs') return 'tipo_invalido';
  if (isNaN(Date.parse(r.marcado_em))) return 'data_invalida';
  if (!_podeMarcar(usuario, r.chave)) return 'ponto_fora_da_dupla';
  if (r.tipo === 'status' && config.status.indexOf(r.status) < 0) return 'status_invalido';
  if (r.tipo === 'obs' && r.status !== '' && config.status.indexOf(r.status) < 0) return 'status_invalido';
  if (r.hora_gps !== '' && r.hora_gps !== null && r.hora_gps !== undefined && isNaN(Date.parse(r.hora_gps))) return 'data_invalida';
  if (GPS_VALIDOS.indexOf(r.gps_ok) < 0) return 'gps_invalido';
  return null;
}

function _numeroOuVazio(v) {
  return typeof v === 'number' && isFinite(v) ? v : '';
}

function _textoSeguroPlanilha(texto) {
  if (typeof texto !== 'string') return texto;
  return /^[=+\-@]/.test(texto) ? "'" + texto : texto;
}

/** Aplicada por Codigo.gs ao escrever na planilha, sem alterar os dados de negócio. */
function protegerParaPlanilha(linhas, indices) {
  return linhas.map(function (linha) {
    var protegida = linha.slice();
    indices.forEach(function (indice) { protegida[indice] = _textoSeguroPlanilha(protegida[indice]); });
    return protegida;
  });
}

function _identificadorSeguro(valor) {
  return String(valor || '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 64);
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
      _identificadorSeguro(ctx.aparelhoId), _identificadorSeguro(ctx.versaoApp)
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
