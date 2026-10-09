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

function rotuloTentativa(visitas, max) {
  if (typeof visitas !== 'number' || !isFinite(visitas) || visitas <= 0) return '';
  var numero = visitas + 1;
  return numero + 'ª' + (numero === max ? ' e última tentativa' : ' tentativa');
}

function diasDosBlocos(blocos) {
  var dias = [];
  (blocos || []).forEach(function (bloco) {
    (bloco.dias || []).forEach(function (dia) {
      if (dias.indexOf(dia) < 0) dias.push(dia);
    });
  });
  return dias.sort();
}

function blocosDoDia(blocos, dia) {
  return (blocos || []).filter(function (bloco) { return (bloco.dias || []).indexOf(dia) >= 0; });
}

function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
