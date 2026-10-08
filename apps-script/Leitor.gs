/** Leitor puro da aba "roteiros" no formato de equipes e períodos. */

var COLUNAS_ROTEIRO = ['data', 'equipe', 'roteiro', 'visitas', 'ordem', 'municipio', 'ponto', 'd', 'coordenada', 'obs'];

function normalizarTexto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function _doisDigitos(n) { return (n < 10 ? '0' : '') + n; }

function dataIso(valor) {
  if (Object.prototype.toString.call(valor) === '[object Date]') {
    if (isNaN(valor.getTime())) return null;
    var d = new Date(valor.getTime() + 12 * 3600 * 1000);
    return d.getFullYear() + '-' + _doisDigitos(d.getMonth() + 1) + '-' + _doisDigitos(d.getDate());
  }
  var m = String(valor === null || valor === undefined ? '' : valor).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? _dataValida(Number(m[3]), Number(m[2]), Number(m[1])) : null;
}

function _dataValida(ano, mes, dia) {
  var d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia ?
    ano + '-' + _doisDigitos(mes) + '-' + _doisDigitos(dia) : null;
}

function _somarDiasLeitor(iso, n) {
  var p = iso.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}

/** Converte a célula de período; nLinha é usado exclusivamente nos avisos. */
function lerPeriodo(valor, dataBloco, nLinha) {
  var fallback = function () {
    return { dias: [dataBloco], periodo: null, aviso: 'Linha ' + nLinha + ': período "' + String(valor).trim() + '" não reconhecido; usando só a data do bloco.' };
  };
  if (Object.prototype.toString.call(valor) === '[object Date]') {
    var data = dataIso(valor);
    return data ? { dias: [data], periodo: null, aviso: null } : fallback();
  }
  if (valor === null || valor === undefined || String(valor).trim() === '') return { dias: [dataBloco], periodo: null, aviso: null };
  var texto = String(valor).trim();
  var semHora = texto.replace(/\b\d{1,2}:\d{2}\s*h?\b/gi, '');
  var tokens = [];
  var re = /(\d{1,2})(?:\/(\d{1,2}))?/g;
  var m;
  while ((m = re.exec(semHora))) tokens.push({ dia: Number(m[1]), mes: m[2] ? Number(m[2]) : null, inicio: m.index, fim: re.lastIndex });
  if (!tokens.length) return fallback();
  var proximoMes = null;
  for (var i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].mes) proximoMes = tokens[i].mes;
    else tokens[i].mes = proximoMes;
    if (!tokens[i].mes) return fallback();
  }
  var anoBase = Number(dataBloco.slice(0, 4));
  var mesBase = Number(dataBloco.slice(5, 7));
  var dias = [];
  for (var j = 0; j < tokens.length; j++) {
    var t = tokens[j];
    var iso = _dataValida(anoBase + (t.mes < mesBase ? 1 : 0), t.mes, t.dia);
    if (!iso) return fallback();
    dias.push(iso);
  }
  var resultado = [];
  for (var k = 0; k < dias.length; k++) {
    resultado.push(dias[k]);
    if (k < dias.length - 1) {
      var entre = semHora.slice(tokens[k].fim, tokens[k + 1].inicio);
      if (/^\s*(a|ate|até|-|–)\s*$/i.test(entre)) {
        var cursor = dias[k];
        var quantidade = 0;
        while (cursor !== dias[k + 1] && quantidade++ < 31) { cursor = _somarDiasLeitor(cursor, 1); resultado.push(cursor); }
        if (cursor !== dias[k + 1] || quantidade >= 31) return fallback();
      }
    }
  }
  resultado = resultado.filter(function (d, indice) { return resultado.indexOf(d) === indice; }).sort();
  return { dias: resultado, periodo: texto, aviso: null };
}

function _texto(valor) { var s = valor === null || valor === undefined ? '' : String(valor).trim(); return s === '' || s === '-' ? null : s; }

function _acharCabecalho(linhas) {
  for (var i = 0; i < linhas.length; i++) {
    var nomes = linhas[i].map(normalizarTexto);
    if (nomes.indexOf('data') >= 0 && nomes.indexOf('visitas') >= 0 && nomes.indexOf('ponto') >= 0 && nomes.indexOf('coordenada') >= 0) {
      var col = {}; COLUNAS_ROTEIRO.forEach(function (c) { col[c] = nomes.indexOf(c); });
      return { linha: i, col: col };
    }
  }
  return null;
}

function lerRoteiros(linhas, opcoes) {
  var avisos = []; var cab = _acharCabecalho(linhas); var esgotadosTotal = 0;
  if (!cab) return { blocos: [], avisos: ['Cabeçalho da aba roteiros não encontrado (colunas data, visitas, ponto, coordenada).'], esgotados: 0 };
  var max = Number(opcoes && opcoes.tentativasMax); if (!isFinite(max) || max < 1) max = 3;
  var valor = function (linha, nome) { return cab.col[nome] >= 0 ? linha[cab.col[nome]] : null; };
  var lerLugar = function (linha, nLinha) {
    var bruto = valor(linha, 'coordenada'); var coord = lerCoordenada(bruto);
    if (!coord && _texto(bruto)) avisos.push('Linha ' + nLinha + ': coordenada ilegível em ' + valor(linha, 'ponto') + '.');
    return { municipio: _texto(valor(linha, 'municipio')), lat: coord ? coord.lat : null, lon: coord ? coord.lon : null, endereco: _texto(valor(linha, 'obs')) };
  };
  var blocos = []; var chaves = {}; var atual = null;
  for (var i = cab.linha + 1; i < linhas.length; i++) {
    var linha = linhas[i]; var nLinha = i + 1; var bruto = valor(linha, 'ponto'); var ponto = normalizarTexto(bruto);
    if (/^equipe\b/.test(ponto)) {
      atual = null;
      var m = String(bruto).trim().match(/^equipe\s+([a-z])(\d)?$/i);
      if (!m) { avisos.push('Linha ' + nLinha + ': cabeçalho de bloco não reconhecido ("' + String(bruto).trim() + '"); bloco ignorado.'); continue; }
      var data = dataIso(valor(linha, 'data')); var equipe = m[1].toUpperCase();
      if (!data) { avisos.push('Linha ' + nLinha + ': bloco ' + equipe + ' sem data válida.'); continue; }
      var periodo = lerPeriodo(valor(linha, 'ordem'), data, nLinha); if (periodo.aviso) avisos.push(periodo.aviso);
      atual = { data: data, equipe: equipe, dias: periodo.dias, periodo: periodo.periodo, encontro: null, termino: null, esgotados: 0, pontos: [], _linha: nLinha, _pos: 0 };
      blocos.push(atual); continue;
    }
    if (!atual) continue;
    if (ponto === 'ponto de encontro') { atual.encontro = lerLugar(linha, nLinha); continue; }
    if (ponto === 'ponto de termino') { atual.termino = lerLugar(linha, nLinha); continue; }
    var codigo = _texto(bruto); if (!codigo) continue;
    var dataLinha = dataIso(valor(linha, 'data'));
    if (dataLinha && dataLinha !== atual.data) { avisos.push('Linha ' + nLinha + ': ponto ' + codigo + ' com data diferente do bloco ' + atual.equipe + '; ignorado.'); continue; }
    var chave = atual.data + '|' + atual.equipe + '|' + codigo;
    if (chaves[chave]) { avisos.push('Linha ' + nLinha + ': ponto ' + codigo + ' repetido na equipe ' + atual.equipe + '; ignorado.'); continue; }
    chaves[chave] = true;
    var visitas = Number(valor(linha, 'visitas')); if (!isFinite(visitas)) visitas = 0;
    if (visitas >= max) { atual.esgotados++; esgotadosTotal++; continue; }
    var coordBruta = valor(linha, 'coordenada'); var coord = lerCoordenada(coordBruta);
    if (!coord && _texto(coordBruta)) avisos.push('Linha ' + nLinha + ': coordenada ilegível no ponto ' + codigo + '.');
    var ordemBruta = valor(linha, 'ordem'); var ordem = ordemBruta === null || ordemBruta === '' ? null : Number(ordemBruta);
    atual.pontos.push({ chave: chave, ordem: isFinite(ordem) ? ordem : null, codigo: codigo, municipio: _texto(valor(linha, 'municipio')), lat: coord ? coord.lat : null, lon: coord ? coord.lon : null, dup: Number(valor(linha, 'd')) > 0, obs: _texto(valor(linha, 'obs')), visitas: visitas, _pos: atual._pos++ });
  }
  var saida = [];
  blocos.forEach(function (b) {
    if (!b.pontos.length) return;
    if (!b.encontro) avisos.push('Bloco ' + b.equipe + ' de ' + b.data + ' (linha ' + b._linha + '): sem ponto de encontro.');
    b.pontos.sort(function (p, q) { if (p.ordem === null && q.ordem !== null) return 1; if (q.ordem === null && p.ordem !== null) return -1; return (p.ordem - q.ordem) || (p._pos - q._pos); });
    b.pontos.forEach(function (p) { delete p._pos; }); delete b._linha; delete b._pos; saida.push(b);
  });
  return { blocos: saida, avisos: avisos, esgotados: esgotadosTotal };
}
