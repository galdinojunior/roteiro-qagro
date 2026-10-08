/*
 * Fila de marcações e sincronização com o Apps Script.
 * Sincroniza ao abrir, ao voltar o sinal, ao voltar ao primeiro plano, em intervalo e pelo botão.
 * Depende de: CONFIG, Banco, atrasoTentativa (logica.js).
 */
var Sync = (function () {
  var TAMANHO_LOTE = 200;
  var TIMEOUT_MS = 30000;
  var emAndamento = null;
  var falhas = 0;
  var proximaTentativa = 0;
  var bloqueado = false;
  var temporizador = null;
  var agendado = false;
  var pendenteDeNovo = false;

  function emitir(nome, detalhe) {
    document.dispatchEvent(new CustomEvent(nome, { detail: detalhe }));
  }

  async function chamar(corpo) {
    var controle = new AbortController();
    var t = setTimeout(function () { controle.abort(); }, TIMEOUT_MS);
    try {
      var resp = await fetch(CONFIG.URL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // sem preflight CORS (Apps Script)
        body: JSON.stringify(corpo),
        redirect: 'follow',
        cache: 'no-store',
        signal: controle.signal
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return await resp.json();
    } finally {
      clearTimeout(t);
    }
  }

  async function aparelhoId() {
    var id = await Banco.ler('aparelho_id');
    if (!id) { id = crypto.randomUUID(); await Banco.gravar('aparelho_id', id); }
    return id;
  }

  async function aplicarResposta(r) {
    await Banco.gravarVarios([
      ['usuario', r.usuario], ['config', r.config], ['roteiro', r.roteiro], ['situacao', r.situacao],
      ['avisos', r.avisos || []], ['ultima_sinc', new Date().toISOString()],
      ['desvio_relogio_ms', Date.parse(r.servidor_em) - Date.now()], ['bloqueado', false]
    ]);
    bloqueado = false;
  }

  async function entrar(codigo) {
    var r = await chamar({ acao: 'entrar', codigo: codigo, aparelho_id: await aparelhoId(), versao_app: CONFIG.VERSAO });
    if (!r.ok) return r;
    await Banco.gravar('codigo', codigo);
    await aplicarResposta(r);
    return r;
  }

  async function guardarRejeitados(rejeitados, lote) {
    if (!rejeitados.length) return;
    var porId = {};
    lote.forEach(function (x) { porId[x.id_marcacao] = x; });
    var anteriores = (await Banco.ler('rejeitados')) || [];
    await Banco.gravar('rejeitados', anteriores.concat(rejeitados.map(function (x) {
      return { motivo: x.motivo, registro: porId[x.id_marcacao] || null };
    })));
  }

  async function executar(motivo) {
    var codigo = await Banco.ler('codigo');
    if (!codigo) return { ok: false, erro: 'sem_codigo' };
    if (bloqueado && motivo !== 'manual') return { ok: false, erro: 'usuario_inativo' };
    if (motivo !== 'manual' && Date.now() < proximaTentativa) return { ok: false, erro: 'aguardando' };
    if (!navigator.onLine) return { ok: false, erro: 'offline' };

    emitir('sync:inicio');
    try {
      var fila = await Banco.lerFila();
      var id = await aparelhoId();
      var r = null;
      var i = 0;
      do {
        var lote = fila.slice(i, i + TAMANHO_LOTE);
        i += TAMANHO_LOTE;
        r = await chamar({ acao: 'sincronizar', codigo: codigo, aparelho_id: id, versao_app: CONFIG.VERSAO, registros: lote });
        if (!r.ok) break;
        await Banco.removerDaFila(r.aceitos.concat(r.rejeitados.map(function (x) { return x.id_marcacao; })));
        await guardarRejeitados(r.rejeitados, lote);
      } while (i < fila.length);

      if (!r.ok) {
        if (r.erro === 'usuario_inativo' || r.erro === 'codigo_invalido') {
          bloqueado = true;
          await Banco.gravar('bloqueado', true);
        } else {
          falhas++;
          var cfg = await Banco.ler('config');
          proximaTentativa = Date.now() + atrasoTentativa(falhas, ((cfg && cfg.sync_intervalo_min) || 5) * 60000);
        }
      } else {
        await aplicarResposta(r);
        falhas = 0;
        proximaTentativa = 0;
      }
      emitir('sync:fim', r);
      return r;
    } catch (e) {
      falhas++;
      var cfg = await Banco.ler('config');
      proximaTentativa = Date.now() + atrasoTentativa(falhas, ((cfg && cfg.sync_intervalo_min) || 5) * 60000);
      var falha = { ok: false, erro: 'rede', mensagem: String((e && e.message) || e) };
      emitir('sync:fim', falha);
      return falha;
    }
  }

  function sincronizar(motivo) {
    if (emAndamento) { pendenteDeNovo = true; return emAndamento; }
    emAndamento = executar(motivo).finally(function () {
      emAndamento = null;
      if (pendenteDeNovo) {
        pendenteDeNovo = false;
        sincronizar('repeticao');
      }
    });
    return emAndamento;
  }

  async function reagendar() {
    clearInterval(temporizador);
    var cfg = await Banco.ler('config');
    var minutos = (cfg && cfg.sync_intervalo_min) || 5;
    temporizador = setInterval(function () {
      if (document.visibilityState === 'visible') sincronizar('intervalo');
    }, minutos * 60000);
  }

  function iniciarAgendamento() {
    if (agendado) return;
    agendado = true;
    window.addEventListener('online', function () { proximaTentativa = 0; sincronizar('online'); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') sincronizar('visivel');
    });
    reagendar();
  }

  async function marcar(registro) {
    await Banco.enfileirar(registro);
    emitir('fila:alterada');
    sincronizar('marcacao');
  }

  async function sair() {
    if ((await Banco.lerFila()).length) return false;
    await Banco.apagarTudo();
    return true;
  }

  async function carregarBloqueio() {
    bloqueado = !!(await Banco.ler('bloqueado'));
  }

  return {
    entrar: entrar, sincronizar: sincronizar, marcar: marcar, iniciarAgendamento: iniciarAgendamento,
    reagendar: reagendar, sair: sair, carregarBloqueio: carregarBloqueio,
    estaBloqueado: function () { return bloqueado; }
  };
})();
