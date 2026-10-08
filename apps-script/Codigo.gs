/**
 * Cola entre o Web App e a planilha. Regras de negócio ficam em Regras.gs e Leitor.gs.
 * Implantação: docs/implantacao.md.
 */

var ABA = { ROTEIROS: 'roteiros', USUARIOS: 'Usuarios', CONFIG: 'Config', REGISTROS: 'Registros', SITUACAO: 'Situacao' };

function doPost(e) {
  try {
    var req;
    try {
      req = JSON.parse(e.postData.contents);
    } catch (x) {
      return _json(erroResposta('requisicao_invalida'));
    }
    return _json(atenderRequisicao(req, fontePlanilha()));
  } catch (x) {
    console.error(x && x.stack ? x.stack : x);
    return _json(erroResposta('falha_interna'));
  }
}

/** Verificação rápida de que o Web App está no ar (abrir a URL no navegador). */
function doGet() {
  return _json({ ok: true, servico: 'roteiro-qagro' });
}

function fontePlanilha() {
  var p = SpreadsheetApp.getActive();
  var tz = Session.getScriptTimeZone();
  var agora = new Date();
  return {
    lerConfig: function () { return _linhasSemCabecalho(p, ABA.CONFIG); },
    lerUsuarios: function () { return _linhasSemCabecalho(p, ABA.USUARIOS); },
    lerRoteiros: function () { return _aba(p, ABA.ROTEIROS).getDataRange().getValues(); },
    lerIdsRegistros: function () {
      var aba = _aba(p, ABA.REGISTROS);
      var n = aba.getLastRow() - 1;
      var ids = {};
      if (n > 0) aba.getRange(2, 1, n, 1).getValues().forEach(function (l) { ids[l[0]] = true; });
      return ids;
    },
    acrescentarRegistros: function (linhas) {
      var aba = _aba(p, ABA.REGISTROS);
      aba.getRange(aba.getLastRow() + 1, 1, linhas.length, COLUNAS_REGISTROS.length)
        .setValues(protegerParaPlanilha(linhas, COLUNAS_TEXTO_LIVRE_REGISTROS));
    },
    lerSituacao: function () { return _linhasSemCabecalho(p, ABA.SITUACAO); },
    gravarSituacao: function (linhas) {
      _reescrever(_aba(p, ABA.SITUACAO), protegerParaPlanilha(linhas, COLUNAS_TEXTO_LIVRE_SITUACAO), COLUNAS_SITUACAO.length);
    },
    comTrava: function (fn) {
      var trava = LockService.getScriptLock();
      trava.waitLock(30000);
      try { fn(); } finally { trava.releaseLock(); }
    },
    hojeIso: function () { return Utilities.formatDate(agora, tz, 'yyyy-MM-dd'); },
    agoraIso: function () { return Utilities.formatDate(agora, tz, "yyyy-MM-dd'T'HH:mm:ssXXX"); }
  };
}

// ---------- Menus ----------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Roteiros')
    .addItem('Verificar aba roteiros', 'verificarRoteiros')
    .addItem('Gerar código para linha selecionada', 'gerarCodigoLinhaSelecionada')
    .addSeparator()
    .addItem('Configurar planilha', 'configurarPlanilha')
    .addItem('Reconstruir Situacao', 'reconstruirSituacao')
    .addToUi();
}

/** Cria as abas que faltarem, cabeçalhos, valores padrão, formatos de texto e destaque da Situacao. */
function configurarPlanilha() {
  var p = SpreadsheetApp.getActive();
  _garantirAba(p, ABA.ROTEIROS, null);
  var usuarios = _garantirAba(p, ABA.USUARIOS, ['nome', 'codigo', 'papel', 'equipe', 'ativo']);
  usuarios.getRange('B:B').setNumberFormat('@');
  var config = _garantirAba(p, ABA.CONFIG, ['chave', 'valor']);
  if (config.getLastRow() < 2) {
    var chaves = Object.keys(CONFIG_PADRAO);
    config.getRange(2, 1, chaves.length, 2).setNumberFormat('@')
      .setValues(chaves.map(function (k) { return [k, CONFIG_PADRAO[k]]; }));
  }
  var registros = _garantirAba(p, ABA.REGISTROS, COLUNAS_REGISTROS);
  ['A:M', 'Q:U'].forEach(function (a) { registros.getRange(a).setNumberFormat('@'); });
  var situacao = _garantirAba(p, ABA.SITUACAO, COLUNAS_SITUACAO);
  ['A:G', 'L:N'].forEach(function (a) { situacao.getRange(a).setNumberFormat('@'); });
  var limite = 'IFERROR(VALUE(VLOOKUP("gps_limite_m";INDIRECT("Config!A:B");2;FALSE));200)';
  var regra = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=OR(AND(ISNUMBER($K2);$K2>' + limite + ');AND($L2<>"";$L2<>"S";$L2<>"NA"))')
    .setBackground('#FFE0B2')
    .setRanges([situacao.getRange('A2:O')])
    .build();
  situacao.setConditionalFormatRules([regra]);
  _avisar('Planilha configurada. Cole a aba roteiros e cadastre os usuários.');
}

function gerarCodigoLinhaSelecionada() {
  var p = SpreadsheetApp.getActive();
  var aba = p.getActiveSheet();
  if (aba.getName() !== ABA.USUARIOS) return _avisar('Selecione uma linha na aba Usuarios.');
  var linha = aba.getActiveRange().getRow();
  if (linha < 2) return _avisar('Selecione a linha de um usuário (a partir da linha 2).');
  var celula = aba.getRange(linha, 2);
  if (String(celula.getValue()).trim()) return _avisar('Essa linha já tem código.');
  var existentes = {};
  _linhasSemCabecalho(p, ABA.USUARIOS).forEach(function (l) { existentes[String(l[1]).trim().toUpperCase()] = true; });
  celula.setNumberFormat('@').setValue(gerarCodigo(existentes));
}

/** Resumo por dia do que o app vai enxergar na aba roteiros, mais os avisos de leitura. */
function verificarRoteiros() {
  var p = SpreadsheetApp.getActive();
  var config = lerConfig(_linhasSemCabecalho(p, ABA.CONFIG));
  var leitura = lerRoteiros(_aba(p, ABA.ROTEIROS).getDataRange().getValues(), { tentativasMax: config.tentativas_max });
  var linhas = leitura.blocos.map(function (b) {
    return b.equipe + ' · ' + (b.periodo || b.data) + ' · ' + b.pontos.length + ' pontos · ' + b.esgotados + ' esgotados · término ' + (b.termino ? 'sim' : 'NÃO');
  });
  var avisos = leitura.avisos.slice(0, 20);
  _avisar((linhas.length ? linhas.join('\n') : 'Nenhum bloco de equipe encontrado.') + '\n\nTotal de esgotados: ' + leitura.esgotados +
    (avisos.length ? '\n\nAvisos (' + leitura.avisos.length + '):\n' + avisos.join('\n') : '\n\nSem avisos.'));
}

/** Recalcula a aba Situacao inteira a partir de Registros. */
function reconstruirSituacao() {
  var p = SpreadsheetApp.getActive();
  var trava = LockService.getScriptLock();
  trava.waitLock(30000);
  try {
    var registros = _linhasSemCabecalho(p, ABA.REGISTROS);
    registros.sort(function (a, b) { return String(a[1]).localeCompare(String(b[1])); });
    _reescrever(_aba(p, ABA.SITUACAO), protegerParaPlanilha(atualizarSituacao([], registros), COLUNAS_TEXTO_LIVRE_SITUACAO), COLUNAS_SITUACAO.length);
  } finally {
    trava.releaseLock();
  }
  _avisar('Situacao reconstruída a partir de ' + registros.length + ' registros.');
}

// ---------- Auxiliares ----------

function _aba(p, nome) {
  var aba = p.getSheetByName(nome);
  if (!aba) throw new Error('Aba "' + nome + '" não encontrada. Rode Roteiros ▸ Configurar planilha.');
  return aba;
}

function _linhasSemCabecalho(p, nome) {
  return _aba(p, nome).getDataRange().getValues().slice(1)
    .filter(function (l) { return l.some(function (c) { return c !== ''; }); });
}

function _reescrever(aba, linhas, ncol) {
  var n = aba.getLastRow();
  if (n > 1) aba.getRange(2, 1, n - 1, ncol).clearContent();
  if (linhas.length) aba.getRange(2, 1, linhas.length, ncol).setValues(linhas);
}

function _garantirAba(p, nome, cabecalho) {
  var aba = p.getSheetByName(nome) || p.insertSheet(nome);
  if (cabecalho && aba.getLastRow() === 0) {
    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold');
    aba.setFrozenRows(1);
  }
  return aba;
}

function _avisar(mensagem) {
  try {
    SpreadsheetApp.getUi().alert(mensagem);
  } catch (x) {
    console.log(mensagem); // executado pelo editor, sem interface
  }
}

function _json(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}
