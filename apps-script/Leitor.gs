/** Lê, valida e normaliza a aba "roteiros" no formato de equipes e períodos. */

var COLUNAS_ROTEIRO = [
  'data', 'equipe', 'roteiro', 'visitas', 'ordem', 'municipio', 'ponto', 'd', 'coordenada', 'obs'
];

/** Normaliza texto para comparação; recebe qualquer valor e devolve texto minúsculo sem acentos. */
function normalizarTexto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

/** Formata um número com dois algarismos e devolve o texto correspondente. */
function _doisDigitos(n) {
  return (n < 10 ? '0' : '') + n;
}

/** Converte data de planilha ou texto dd/mm/aaaa em AAAA-MM-DD; devolve null se inválida. */
function dataIso(valor) {
  if (Object.prototype.toString.call(valor) === '[object Date]') {
    if (isNaN(valor.getTime())) return null;
    var data = new Date(valor.getTime() + 12 * 3600 * 1000);
    return data.getFullYear() + '-' + _doisDigitos(data.getMonth() + 1) + '-' + _doisDigitos(data.getDate());
  }
  var texto = String(valor === null || valor === undefined ? '' : valor).trim();
  var partes = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!partes) return null;
  return _dataValida(Number(partes[3]), Number(partes[2]), Number(partes[1]));
}

/** Valida componentes de uma data e devolve AAAA-MM-DD; devolve null para calendário impossível. */
function _dataValida(ano, mes, dia) {
  var data = new Date(Date.UTC(ano, mes - 1, dia));
  var valida = data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1;
  valida = valida && data.getUTCDate() === dia;
  if (!valida) return null;
  return ano + '-' + _doisDigitos(mes) + '-' + _doisDigitos(dia);
}

/** Soma dias a uma ISO; fica duplicada de Regras.gs para que Leitor.gs funcione isoladamente. */
function _somarDiasLeitor(iso, n) {
  var partes = iso.split('-').map(Number);
  return new Date(Date.UTC(partes[0], partes[1] - 1, partes[2] + n)).toISOString().slice(0, 10);
}

/** Lê uma célula de período; recebe valor, data do bloco e linha, e devolve dias, texto e possível aviso. */
function lerPeriodo(valor, dataBloco, nLinha) {
  var texto = valor === null || valor === undefined ? '' : String(valor).trim();
  var fallback = function () {
    return {
      dias: [dataBloco],
      periodo: texto || null,
      aviso: 'Linha ' + nLinha + ': período "' + texto + '" não reconhecido; usando só a data do bloco.'
    };
  };
  if (Object.prototype.toString.call(valor) === '[object Date]') {
    var data = dataIso(valor);
    return data ? { dias: [data], periodo: null, aviso: null } : fallback();
  }
  if (!texto) return { dias: [dataBloco], periodo: null, aviso: null };
  var semHora = texto.replace(/\b\d{1,2}:\d{2}\s*h?\b/gi, '');
  semHora = semHora.replace(/\/(\d{4})\b/g, '');
  var tokens = [];
  var re = /(\d{1,2})(?:\/(\d{1,2}))?/g;
  var achado;
  while ((achado = re.exec(semHora))) {
    tokens.push({
      dia: Number(achado[1]),
      mes: achado[2] ? Number(achado[2]) : null,
      inicio: achado.index,
      fim: re.lastIndex
    });
  }
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
    var token = tokens[j];
    var ano = anoBase + (token.mes < mesBase ? 1 : 0);
    var iso = _dataValida(ano, token.mes, token.dia);
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
        while (cursor !== dias[k + 1] && quantidade++ < 31) {
          cursor = _somarDiasLeitor(cursor, 1);
          resultado.push(cursor);
        }
        if (cursor !== dias[k + 1] || quantidade >= 31) return fallback();
      }
    }
  }
  resultado = resultado.filter(function (dia, indice) {
    return resultado.indexOf(dia) === indice;
  }).sort();
  return { dias: resultado, periodo: texto, aviso: null };
}

/** Converte célula opcional em texto útil; recebe valor e devolve null para vazio ou hífen. */
function _texto(valor) {
  var texto = valor === null || valor === undefined ? '' : String(valor).trim();
  return texto === '' || texto === '-' ? null : texto;
}

/** Localiza o cabeçalho pelo nome das colunas; recebe linhas e devolve índices ou null. */
function _acharCabecalho(linhas) {
  for (var i = 0; i < linhas.length; i++) {
    var nomes = linhas[i].map(normalizarTexto);
    var completo = nomes.indexOf('data') >= 0 && nomes.indexOf('visitas') >= 0;
    completo = completo && nomes.indexOf('ponto') >= 0 && nomes.indexOf('coordenada') >= 0;
    if (completo) {
      var colunas = {};
      COLUNAS_ROTEIRO.forEach(function (coluna) {
        colunas[coluna] = nomes.indexOf(coluna);
      });
      return { linha: i, col: colunas };
    }
  }
  return null;
}

/** Compara dois pontos por ordem e posição original; recebe pontos e devolve a ordem de classificação. */
function _compararPontos(p, q) {
  if (p.ordem === null && q.ordem !== null) return 1;
  if (q.ordem === null && p.ordem !== null) return -1;
  return (p.ordem - q.ordem) || (p._pos - q._pos);
}

/** Lê as linhas da aba roteiros; recebe matriz e opções e devolve blocos, avisos e esgotados. */
function lerRoteiros(linhas, opcoes) {
  var avisos = [];
  var cabecalho = _acharCabecalho(linhas);
  var esgotadosTotal = 0;
  if (!cabecalho) {
    return {
      blocos: [],
      avisos: ['Cabeçalho da aba roteiros não encontrado (colunas data, visitas, ponto, coordenada).'],
      esgotados: 0
    };
  }
  var max = Number(opcoes && opcoes.tentativasMax);
  if (!isFinite(max) || max < 1) max = 3;
  var valor = function (linha, nome) {
    return cabecalho.col[nome] >= 0 ? linha[cabecalho.col[nome]] : null;
  };
  var lerLugar = function (linha, nLinha) {
    var bruto = valor(linha, 'coordenada');
    var coordenada = lerCoordenada(bruto);
    if (!coordenada && _texto(bruto)) {
      avisos.push('Linha ' + nLinha + ': coordenada ilegível em ' + valor(linha, 'ponto') + '.');
    }
    return {
      municipio: _texto(valor(linha, 'municipio')),
      lat: coordenada ? coordenada.lat : null,
      lon: coordenada ? coordenada.lon : null,
      endereco: _texto(valor(linha, 'obs'))
    };
  };
  var blocos = [];
  var chaves = {};
  var atual = null;
  for (var i = cabecalho.linha + 1; i < linhas.length; i++) {
    var linha = linhas[i];
    var nLinha = i + 1;
    var bruto = valor(linha, 'ponto');
    var pontoNormalizado = normalizarTexto(bruto);
    if (/^equipe(\s|$)/.test(pontoNormalizado)) {
      atual = null;
      var grupo = String(bruto).trim().match(/^equipe\s+([a-z])(\d)?$/i);
      if (!grupo) {
        avisos.push('Linha ' + nLinha + ': cabeçalho de bloco não reconhecido ("' + String(bruto).trim() + '"); bloco ignorado.');
        continue;
      }
      var data = dataIso(valor(linha, 'data'));
      var equipe = grupo[1].toUpperCase();
      if (!data) {
        avisos.push('Linha ' + nLinha + ': bloco ' + equipe + ' sem data válida.');
        continue;
      }
      var periodo = lerPeriodo(valor(linha, 'ordem'), data, nLinha);
      if (periodo.aviso) avisos.push(periodo.aviso);
      atual = {
        data: data,
        equipe: equipe,
        dias: periodo.dias,
        periodo: periodo.periodo,
        encontro: null,
        termino: null,
        esgotados: 0,
        pontos: [],
        _linha: nLinha,
        _pos: 0
      };
      blocos.push(atual);
      continue;
    }
    if (!atual) continue;
    if (pontoNormalizado === 'ponto de encontro') {
      atual.encontro = lerLugar(linha, nLinha);
      continue;
    }
    if (pontoNormalizado === 'ponto de termino') {
      atual.termino = lerLugar(linha, nLinha);
      continue;
    }
    if (/^ponto de\b/.test(pontoNormalizado)) continue;
    var codigo = _texto(bruto);
    if (!codigo) continue;
    var dataLinha = dataIso(valor(linha, 'data'));
    if (dataLinha && dataLinha !== atual.data) {
      avisos.push('Linha ' + nLinha + ': ponto ' + codigo + ' com data diferente do bloco ' + atual.equipe + '; ignorado.');
      continue;
    }
    var chave = atual.data + '|' + atual.equipe + '|' + codigo;
    if (chaves[chave]) {
      avisos.push('Linha ' + nLinha + ': ponto ' + codigo + ' repetido na equipe ' + atual.equipe + '; ignorado.');
      continue;
    }
    chaves[chave] = true;
    var visitas = Number(valor(linha, 'visitas'));
    if (!isFinite(visitas)) visitas = 0;
    if (visitas >= max) {
      atual.esgotados++;
      esgotadosTotal++;
      continue;
    }
    var coordenadaBruta = valor(linha, 'coordenada');
    var coordenada = lerCoordenada(coordenadaBruta);
    if (!coordenada && _texto(coordenadaBruta)) {
      avisos.push('Linha ' + nLinha + ': coordenada ilegível no ponto ' + codigo + '.');
    }
    var ordemBruta = valor(linha, 'ordem');
    var ordem = ordemBruta === null || ordemBruta === '' ? null : Number(ordemBruta);
    var ponto = {
      chave: chave,
      ordem: isFinite(ordem) ? ordem : null,
      codigo: codigo,
      municipio: _texto(valor(linha, 'municipio')),
      lat: coordenada ? coordenada.lat : null,
      lon: coordenada ? coordenada.lon : null,
      dup: Number(valor(linha, 'd')) > 0,
      obs: _texto(valor(linha, 'obs')),
      visitas: visitas,
      _pos: atual._pos++
    };
    atual.pontos.push(ponto);
  }
  var saida = [];
  blocos.forEach(function (bloco) {
    if (!bloco.pontos.length) return;
    if (!bloco.encontro) {
      avisos.push('Bloco ' + bloco.equipe + ' de ' + bloco.data + ' (linha ' + bloco._linha + '): sem ponto de encontro.');
    }
    bloco.pontos.sort(_compararPontos);
    bloco.pontos.forEach(function (ponto) {
      delete ponto._pos;
    });
    delete bloco._linha;
    delete bloco._pos;
    saida.push(bloco);
  });
  return { blocos: saida, avisos: avisos, esgotados: esgotadosTotal };
}
