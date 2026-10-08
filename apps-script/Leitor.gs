/**
 * Leitor da aba "roteiros" (formato S2 em diante: blocos "Equipe A1", "Equipe A2", ...).
 * Função pura: recebe a matriz de valores (Range.getValues) e devolve blocos por dupla.
 * Depende de Geo.gs (lerCoordenada). Regras em docs/2026-09-26-roteiro-qagro-design.md, seção 4.1.
 */

var COLUNAS_ROTEIRO = ['data', 'equipe', 'visitas', 'ordem', 'municipio', 'ponto', 'd', 'coordenada', 'obs'];

function normalizarTexto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function _doisDigitos(n) {
  return (n < 10 ? '0' : '') + n;
}

/** Date (do Sheets) ou texto dd/mm/aaaa → 'AAAA-MM-DD'; null se inválido. */
function dataIso(valor) {
  if (Object.prototype.toString.call(valor) === '[object Date]') {
    if (isNaN(valor.getTime())) return null;
    // +12h: tolera diferença de fuso entre planilha e script sem mudar o dia
    var d = new Date(valor.getTime() + 12 * 3600 * 1000);
    return d.getFullYear() + '-' + _doisDigitos(d.getMonth() + 1) + '-' + _doisDigitos(d.getDate());
  }
  var m = String(valor === null || valor === undefined ? '' : valor).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + _doisDigitos(Number(m[2])) + '-' + _doisDigitos(Number(m[1]));
  return null;
}

function _texto(valor) {
  var s = valor === null || valor === undefined ? '' : String(valor).trim();
  return s === '' || s === '-' ? null : s;
}

function _acharCabecalho(linhas) {
  for (var i = 0; i < linhas.length; i++) {
    var nomes = linhas[i].map(normalizarTexto);
    if (nomes.indexOf('data') >= 0 && nomes.indexOf('visitas') >= 0 &&
        nomes.indexOf('ponto') >= 0 && nomes.indexOf('coordenada') >= 0) {
      var col = {};
      COLUNAS_ROTEIRO.forEach(function (c) { col[c] = nomes.indexOf(c); });
      return { linha: i, col: col };
    }
  }
  return null;
}

function lerRoteiros(linhas) {
  var avisos = [];
  var cab = _acharCabecalho(linhas);
  if (!cab) {
    return { blocos: [], avisos: ['Cabeçalho da aba roteiros não encontrado (colunas data, visitas, ponto, coordenada).'] };
  }
  var valor = function (linha, nome) { return cab.col[nome] >= 0 ? linha[cab.col[nome]] : null; };

  var lerLugar = function (linha, nLinha) {
    var bruto = valor(linha, 'coordenada');
    var coord = lerCoordenada(bruto);
    if (!coord && _texto(bruto)) avisos.push('Linha ' + nLinha + ': coordenada ilegível em ' + valor(linha, 'ponto') + '.');
    return {
      municipio: _texto(valor(linha, 'municipio')),
      lat: coord ? coord.lat : null,
      lon: coord ? coord.lon : null,
      endereco: _texto(valor(linha, 'obs'))
    };
  };

  var blocos = [];
  var vistos = {};
  var atual = null;

  for (var i = cab.linha + 1; i < linhas.length; i++) {
    var linha = linhas[i];
    var nLinha = i + 1;
    var bruto = valor(linha, 'ponto');
    var ponto = normalizarTexto(bruto);

    if (/^equipe\b/.test(ponto)) {
      atual = null;
      var m = String(bruto).trim().match(/^equipe\s+([a-z])(\d)$/i);
      if (!m) continue; // formato S1 ("Equipe A") ou outro: ignorado
      var data = dataIso(valor(linha, 'data'));
      var dupla = (m[1] + m[2]).toUpperCase();
      if (!data) { avisos.push('Linha ' + nLinha + ': bloco ' + dupla + ' sem data válida.'); continue; }
      if (vistos[data + '|' + dupla]) { avisos.push('Linha ' + nLinha + ': bloco ' + dupla + ' de ' + data + ' repetido; ignorado.'); continue; }
      vistos[data + '|' + dupla] = true;
      atual = { data: data, dupla: dupla, grupo: dupla.charAt(0), encontro: null, termino: null, pontos: [], _chaves: {}, _linha: nLinha };
      blocos.push(atual);
      continue;
    }
    if (!atual) continue;

    if (ponto === 'ponto de encontro') { atual.encontro = lerLugar(linha, nLinha); continue; }
    if (ponto === 'ponto de termino') { atual.termino = lerLugar(linha, nLinha); continue; }

    if (String(valor(linha, 'visitas')).trim() !== '1') continue;
    var codigo = _texto(bruto);
    if (!codigo) continue;

    var dataLinha = dataIso(valor(linha, 'data'));
    if (dataLinha && dataLinha !== atual.data) {
      avisos.push('Linha ' + nLinha + ': ponto ' + codigo + ' com data diferente do bloco ' + atual.dupla + '; ignorado.');
      continue;
    }
    var chave = atual.data + '|' + atual.dupla + '|' + codigo;
    if (atual._chaves[chave]) { avisos.push('Linha ' + nLinha + ': ponto ' + codigo + ' repetido no bloco ' + atual.dupla + '; ignorado.'); continue; }
    atual._chaves[chave] = true;

    var coord = lerCoordenada(valor(linha, 'coordenada'));
    if (!coord) avisos.push('Linha ' + nLinha + ': coordenada ilegível no ponto ' + codigo + '.');
    var brutoOrdem = valor(linha, 'ordem');
    var ordem = brutoOrdem === null || brutoOrdem === '' ? null : Number(brutoOrdem);

    atual.pontos.push({
      chave: chave,
      ordem: isFinite(ordem) ? ordem : null,
      codigo: codigo,
      municipio: _texto(valor(linha, 'municipio')),
      lat: coord ? coord.lat : null,
      lon: coord ? coord.lon : null,
      dup: Number(valor(linha, 'd')) > 0,
      obs: _texto(valor(linha, 'obs')),
      _pos: atual.pontos.length
    });
  }

  var saida = [];
  blocos.forEach(function (b) {
    if (!b.pontos.length) return; // semana ainda não preenchida
    if (!b.encontro) avisos.push('Bloco ' + b.dupla + ' de ' + b.data + ' (linha ' + b._linha + '): sem ponto de encontro.');
    b.pontos.sort(function (p, q) {
      if (p.ordem === null && q.ordem !== null) return 1;
      if (q.ordem === null && p.ordem !== null) return -1;
      return (p.ordem - q.ordem) || (p._pos - q._pos);
    });
    b.pontos.forEach(function (p) { delete p._pos; });
    delete b._chaves;
    delete b._linha;
    saida.push(b);
  });
  return { blocos: saida, avisos: avisos };
}
