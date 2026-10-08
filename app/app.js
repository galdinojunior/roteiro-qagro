/*
 * Telas e interação.
 * Depende de: CONFIG (config.js), distanciaMetros (geo.js), funções de logica.js, Banco, Gps, Sync.
 */
var Estado = {
  usuario: null, config: null, roteiro: null, situacao: [], fila: [], avisos: [], rejeitados: [],
  ultimaSinc: null, desvio: 0, dia: null, filtroGrupo: '', filtroDupla: '',
  sincronizando: false, erroSync: null, capturando: {}, swEsperando: null
};
var raiz = document.getElementById('app');
var temporizadoresObs = {};
var eventosProntos = false;

var MOTIVOS_REJEICAO = {
  ponto_fora_da_dupla: 'ponto de outra dupla',
  status_invalido: 'status que não existe mais',
  data_invalida: 'data inválida',
  tipo_invalido: 'tipo inválido',
  gps_invalido: 'GPS inválido',
  sem_id: 'sem identificação'
};

var esc = escaparHtml;

function hojeIso() {
  return isoComFuso(new Date()).slice(0, 10);
}

function horaCurta(iso) {
  var d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toTimeString().slice(0, 5);
}

function supervisao() {
  return !!Estado.usuario && Estado.usuario.papel !== 'entrevistador';
}

function unicos(lista) {
  return lista.filter(function (v, i) { return lista.indexOf(v) === i; }).sort();
}

// ---------- Estado ----------

async function carregarEstado() {
  var chaves = ['usuario', 'config', 'roteiro', 'situacao', 'avisos', 'rejeitados', 'ultima_sinc', 'desvio_relogio_ms'];
  var v = await Promise.all(chaves.map(function (c) { return Banco.ler(c); }));
  Estado.usuario = v[0];
  Estado.config = v[1];
  Estado.roteiro = v[2];
  Estado.situacao = v[3] || [];
  Estado.avisos = v[4] || [];
  Estado.rejeitados = v[5] || [];
  Estado.ultimaSinc = v[6];
  Estado.desvio = v[7] || 0;
  Estado.fila = await Banco.lerFila();
}

function mesclado() {
  return mesclarSituacao(Estado.situacao, Estado.fila);
}

function datasDisponiveis() {
  return Estado.roteiro ? unicos(Estado.roteiro.blocos.map(function (b) { return b.data; })) : [];
}

function blocosDoDia() {
  if (!Estado.roteiro) return [];
  return Estado.roteiro.blocos.filter(function (b) { return b.data === Estado.dia; });
}

function blocosVisiveis() {
  return blocosDoDia().filter(function (b) {
    return (!Estado.filtroGrupo || b.grupo === Estado.filtroGrupo) && (!Estado.filtroDupla || b.dupla === Estado.filtroDupla);
  });
}

function acharPonto(chave) {
  var blocos = Estado.roteiro ? Estado.roteiro.blocos : [];
  for (var i = 0; i < blocos.length; i++) {
    for (var j = 0; j < blocos[i].pontos.length; j++) {
      if (blocos[i].pontos[j].chave === chave) return blocos[i].pontos[j];
    }
  }
  return null;
}

// ---------- Desenho ----------

function desenhar() {
  if (!Estado.config) return;
  var foco = capturarFoco();
  var datas = datasDisponiveis();
  if (!Estado.dia || datas.indexOf(Estado.dia) < 0) Estado.dia = diaInicial(datas, hojeIso());
  var sit = mesclado();
  raiz.innerHTML = htmlTopo() + htmlAlertas() + htmlDias(datas) +
    (supervisao() ? htmlFiltros() + htmlResumoDuplas(sit) : '') + htmlConteudo(sit);
  restaurarFoco(foco);
}

function htmlTopo() {
  var u = Estado.usuario || {};
  var n = Estado.fila.length;
  var ultima = Estado.ultimaSinc ? new Date(Estado.ultimaSinc) : null;
  var recente = ultima && Date.now() - ultima.getTime() < 3600000;
  var cor = n > 0 ? 'laranja' : (recente ? 'verde' : 'cinza');
  var quando = !ultima ? 'nunca'
    : (isoComFuso(ultima).slice(0, 10) === hojeIso() ? horaCurta(Estado.ultimaSinc)
      : rotuloDia(isoComFuso(ultima).slice(0, 10)) + ' ' + horaCurta(Estado.ultimaSinc));
  var texto = Estado.sincronizando ? 'Sincronizando…'
    : (n ? n + (n === 1 ? ' pendente' : ' pendentes') : 'tudo enviado') + ' · últ. sinc. ' + quando;
  return '<header class="topo">' +
    '<div class="quem"><b>' + esc(u.nome) + '</b> · ' + (u.dupla ? 'Dupla ' + esc(u.dupla) : esc(u.papel)) + '</div>' +
    '<button class="sinc sinc-' + cor + '" data-acao="sincronizar"><span class="bola">●</span> ' + esc(texto) + '</button>' +
    '<details class="menu"><summary aria-label="Menu">⋮</summary><div class="menu-corpo">' +
    '<button data-acao="sair">Sair deste aparelho</button><p>Versão ' + esc(CONFIG.VERSAO) + '</p></div></details>' +
    '</header>';
}

function htmlAlertas() {
  var a = [];
  var n = Estado.fila.length;
  if (Estado.swEsperando) a.push('<button class="alerta info" data-acao="atualizar-app">Nova versão disponível — toque para atualizar</button>');
  if (CONFIG.URL_API.indexOf('COLE_AQUI') === 0) a.push('<div class="alerta erro">App sem endereço do servidor (config.js).</div>');
  if (Sync.estaBloqueado()) a.push('<div class="alerta erro">Acesso bloqueado — procure o coordenador. As marcações continuam guardadas neste celular.</div>');
  if (Gps.permissaoNegada()) a.push('<div class="alerta erro">Localização bloqueada. No Chrome: ⋮ ▸ Configurações ▸ Configurações do site ▸ Localização ▸ permitir para este app.</div>');
  if (Math.abs(Estado.desvio) > 600000) a.push('<div class="alerta aviso">O relógio deste celular está errado. Ative “Data e hora automáticas” nas configurações do Android.</div>');
  if (n && (!navigator.onLine || (Estado.erroSync && (Estado.erroSync.erro === 'rede' || Estado.erroSync.erro === 'falha_interna')))) {
    var semConexao = Estado.erroSync && Estado.erroSync.erro === 'falha_interna' ? 'Servidor indisponível.' : 'Sem conexão.';
    a.push('<div class="alerta aviso">' + semConexao + ' ' + n + (n === 1 ? ' marcação guardada' : ' marcações guardadas') + ' neste celular; o envio é automático quando houver sinal.</div>');
  }
  if (Estado.rejeitados.length) {
    var motivos = unicos(Estado.rejeitados.map(function (x) { return MOTIVOS_REJEICAO[x.motivo] || x.motivo; }));
    a.push('<div class="alerta erro">' + Estado.rejeitados.length + ' marcação(ões) recusada(s) pelo servidor (' + esc(motivos.join(', ')) +
      '). Avise o coordenador. <button data-acao="limpar-rejeitados">ok</button></div>');
  }
  if (supervisao() && Estado.avisos.length) {
    a.push('<details class="alerta aviso"><summary>' + Estado.avisos.length + ' aviso(s) na aba roteiros</summary><ul>' +
      Estado.avisos.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>');
  }
  return a.length ? '<div class="alertas">' + a.join('') + '</div>' : '';
}

function htmlDias(datas) {
  if (!datas.length) return '<p class="vazio">Nenhum roteiro publicado ainda. Sincronize quando houver sinal.</p>';
  var hoje = hojeIso();
  return '<nav class="dias">' + datas.map(function (d) {
    return '<button class="dia' + (d === Estado.dia ? ' ativo' : '') + '" data-acao="dia" data-dia="' + d + '">' +
      (d === hoje ? 'Hoje · ' : '') + rotuloDia(d) + '</button>';
  }).join('') + '</nav>';
}

function htmlFiltros() {
  var duplas = unicos(blocosDoDia().map(function (b) { return b.dupla; }));
  var grupos = unicos(duplas.map(function (d) { return d.charAt(0); }));
  var botao = function (acao, valor, rotulo, ativo) {
    return '<button class="fb' + (ativo ? ' ativo' : '') + '" data-acao="' + acao + '" data-valor="' + esc(valor) + '">' + esc(rotulo) + '</button>';
  };
  return '<div class="filtro"><span class="fr">Grupo</span>' + botao('grupo', '', 'Todos', !Estado.filtroGrupo) +
    grupos.map(function (g) { return botao('grupo', g, g, Estado.filtroGrupo === g); }).join('') + '</div>' +
    '<div class="filtro"><span class="fr">Dupla</span>' + botao('dupla', '', 'Todas', !Estado.filtroDupla) +
    duplas.filter(function (d) { return !Estado.filtroGrupo || d.charAt(0) === Estado.filtroGrupo; })
      .map(function (d) { return botao('dupla', d, d, Estado.filtroDupla === d); }).join('') + '</div>';
}

function htmlResumoDuplas(sit) {
  var blocos = blocosVisiveis();
  if (!blocos.length) return '';
  var lista = Estado.config.status;
  var linhas = blocos.map(function (b) {
    var r = resumoStatus(b.pontos, sit, lista);
    return '<tr><td>' + esc(b.dupla) + '</td><td>' + r.total + '</td>' +
      lista.map(function (s) { return '<td>' + r.porStatus[s] + '</td>'; }).join('') + '<td>' + r.pendentes + '</td></tr>';
  });
  return '<div class="resumo-duplas"><table><thead><tr><th>Dupla</th><th>Pontos</th>' +
    lista.map(function (s) { return '<th>' + esc(s) + '</th>'; }).join('') + '<th>Pendentes</th></tr></thead><tbody>' +
    linhas.join('') + '</tbody></table></div>';
}

function htmlConteudo(sit) {
  var blocos = blocosVisiveis();
  if (!Estado.dia) return '';
  if (!blocos.length) return '<p class="vazio">Sem roteiro para este dia' + (supervisao() ? ' com esses filtros' : '') + '.</p>';
  return '<main>' + blocos.map(function (b) { return htmlBloco(b, sit); }).join('') + '</main>';
}

function htmlBloco(b, sit) {
  var r = resumoStatus(b.pontos, sit, Estado.config.status);
  var resumo = Estado.config.status.filter(function (s) { return r.porStatus[s]; })
    .map(function (s) { return r.porStatus[s] + ' ' + s; })
    .concat(r.pendentes ? [r.pendentes + (r.pendentes === 1 ? ' pendente' : ' pendentes')] : []).join(' · ');
  return '<section class="bloco"><h1>Dupla ' + esc(b.dupla) + ' · ' + rotuloDia(b.data) + '</h1>' +
    '<div class="sub">' + b.pontos.length + ' pontos · ' + esc(resumo) + '</div>' +
    htmlLugar('Encontro', b.encontro) +
    b.pontos.map(function (p) { return htmlPonto(p, sit[p.chave]); }).join('') +
    htmlLugar('Término', b.termino) + '</section>';
}

function htmlLugar(titulo, l) {
  if (!l) return '<div class="lugar"><div class="lugar-tit">' + titulo + '</div><div class="lugar-nome">' + titulo + ': a definir</div></div>';
  return '<div class="lugar"><div class="lugar-tit">' + titulo + '</div>' +
    '<div class="lugar-nome">' + esc(l.municipio || '') + '</div>' +
    (l.endereco ? '<div class="lugar-end">' + esc(l.endereco) + '</div>' : '') + htmlCoord(l.lat, l.lon) + '</div>';
}

function htmlCoord(lat, lon) {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return '<div class="semcoord">sem coordenada</div>';
  var txt = lat + ', ' + lon;
  return '<div class="coordrow"><code class="coord">' + txt + '</code>' +
    '<button class="btn" data-acao="copiar" data-texto="' + txt + '">copiar</button>' +
    '<a class="btn" href="geo:' + lat + ',' + lon + '?q=' + lat + ',' + lon + '">mapa</a></div>';
}

function htmlPonto(p, s) {
  var lista = Estado.config.status;
  var ativo = s && s.status ? s.status : '';
  var indice = ativo ? lista.indexOf(ativo) : -1;
  var capturando = !!Estado.capturando[p.chave];
  var semObs = Estado.config.status_sem_obs.indexOf(ativo) >= 0;
  var rodape = '';
  if (capturando) {
    rodape = '<div class="rodape">Capturando GPS…</div>';
  } else if (ativo) {
    var g = descreverGps(s, Estado.config.gps_limite_m);
    rodape = '<div class="rodape' + (g.alerta ? ' alerta-gps' : '') + '">' + esc(ativo) + ' · ' + horaCurta(s.status_em) +
      (s.nome ? ' · ' + esc(s.nome) : '') + (g.texto ? ' · ' + (g.alerta ? '⚠ ' : '') + esc(g.texto) : '') +
      (s.pendente ? ' · <span class="pend">não enviado</span>' : '') + '</div>';
  } else if (s && s.pendente) {
    rodape = '<div class="rodape"><span class="pend">observação não enviada</span></div>';
  }
  var ordem = p.ordem === null ? '–' : String(p.ordem).padStart(2, '0');
  return '<div class="card' + (indice === 0 ? ' st-ok' : (indice > 0 ? ' st-outro' : '')) + '">' +
    '<div class="l1"><span class="ord">' + ordem + '</span><span class="cod">' + esc(p.codigo) + '</span>' +
    '<span class="mun">' + esc(p.municipio || '') + '</span>' + (p.dup ? '<span class="tag">possível duplicidade</span>' : '') + '</div>' +
    (p.obs ? '<div class="obsplan">' + esc(p.obs) + '</div>' : '') + htmlCoord(p.lat, p.lon) +
    '<div class="status">' + lista.map(function (nome) {
      return '<button class="stb' + (ativo === nome ? ' ativo' : '') + '" data-acao="marcar" data-chave="' + esc(p.chave) +
        '" data-status="' + esc(nome) + '"' + (capturando ? ' disabled' : '') + '>' + esc(nome) + '</button>';
    }).join('') + '</div>' +
    '<textarea class="obslivre" rows="2" data-chave="' + esc(p.chave) + '" placeholder="' +
    (semObs ? 'Observação (opcional)' : 'Observação — ex.: agendou retorno às 15h') + '">' + esc(s ? s.obs || '' : '') + '</textarea>' +
    rodape + '</div>';
}

// Mantém o texto e o cursor da observação em edição quando a tela é redesenhada.
function capturarFoco() {
  var a = document.activeElement;
  if (!a || !a.matches || !a.matches('textarea.obslivre')) return null;
  return { chave: a.dataset.chave, valor: a.value, inicio: a.selectionStart, fim: a.selectionEnd };
}

function restaurarFoco(foco) {
  if (!foco) return;
  var t = raiz.querySelector('textarea.obslivre[data-chave="' + CSS.escape(foco.chave) + '"]');
  if (!t) return;
  t.value = foco.valor;
  t.focus({ preventScroll: true });
  t.setSelectionRange(foco.inicio, foco.fim);
}

// ---------- Ações ----------

async function marcar(chave, status) {
  var ponto = acharPonto(chave);
  if (!ponto || Estado.capturando[chave]) return;
  var marcadoEm = isoComFuso(new Date());
  var cfg = Estado.config;
  Estado.capturando[chave] = true;
  desenhar();
  try {
    var r = await Gps.capturar(cfg.gps_precisao_max_m, cfg.gps_timeout_s);
    var pos = r.posicao;
    var dist = pos && ponto.lat !== null ? Math.round(distanciaMetros(pos.lat, pos.lon, ponto.lat, ponto.lon)) : null;
    await Sync.marcar({
      id_marcacao: crypto.randomUUID(), tipo: 'status', marcado_em: marcadoEm, chave: chave, status: status,
      obs: obsAtual(chave), lat: pos ? pos.lat : null, lon: pos ? pos.lon : null,
      precisao_m: pos ? pos.precisao_m : null, hora_gps: pos ? pos.hora_gps : null, dist_planejado_m: dist,
      gps_ok: classificarGps(pos, r.erro, cfg.gps_precisao_max_m), nome: Estado.usuario.nome
    });
    Estado.fila = await Banco.lerFila();
  } finally {
    delete Estado.capturando[chave];
    desenhar();
  }
}

function obsAtual(chave) {
  var t = raiz.querySelector('textarea.obslivre[data-chave="' + CSS.escape(chave) + '"]');
  if (t) return t.value;
  var s = mesclado()[chave];
  return s ? s.obs || '' : '';
}

function agendarObs(t) {
  var chave = t.dataset.chave;
  clearTimeout(temporizadoresObs[chave]);
  temporizadoresObs[chave] = setTimeout(function () { salvarObs(chave, t.value); }, 1500);
}

function salvarObsAgora(t) {
  clearTimeout(temporizadoresObs[t.dataset.chave]);
  salvarObs(t.dataset.chave, t.value);
}

function salvarObsPendentes() {
  Object.keys(temporizadoresObs).forEach(function (chave) {
    clearTimeout(temporizadoresObs[chave]);
    var t = raiz.querySelector('textarea.obslivre[data-chave="' + CSS.escape(chave) + '"]');
    if (t) salvarObs(chave, t.value); else delete temporizadoresObs[chave];
  });
}

async function salvarObs(chave, texto) {
  delete temporizadoresObs[chave];
  var atual = mesclado()[chave];
  if ((atual ? atual.obs || '' : '') === texto) return;
  await Sync.marcar({
    id_marcacao: crypto.randomUUID(), tipo: 'obs', marcado_em: isoComFuso(new Date()), chave: chave,
    status: atual ? atual.status || '' : '', obs: texto, lat: null, lon: null, precisao_m: null,
    hora_gps: null, dist_planejado_m: null, gps_ok: 'NA', nome: Estado.usuario.nome
  });
}

function mostrarCopiado(botao) {
  var original = botao.textContent;
  botao.textContent = 'copiado';
  botao.classList.add('ok');
  setTimeout(function () { botao.textContent = original; botao.classList.remove('ok'); }, 1400);
}

function copiar(botao, texto) {
  var ta = document.createElement('textarea');
  ta.value = texto;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-999px';
  document.body.appendChild(ta);
  ta.select();
  var ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  document.body.removeChild(ta);
  if (ok) { mostrarCopiado(botao); return; }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(texto).then(function () { mostrarCopiado(botao); })
      .catch(function () { botao.textContent = 'segure na coordenada'; });
  }
}

async function sair() {
  if (!confirm('Sair deste aparelho? O roteiro salvo será apagado.')) return;
  if (!(await Sync.sair())) {
    alert('Há marcações ainda não enviadas. Sincronize com sinal antes de sair.');
    return;
  }
  location.reload();
}

async function aoClicar(e) {
  var el = e.target.closest('[data-acao]');
  if (!el) return;
  var acao = el.dataset.acao;
  if (acao === 'sincronizar') Sync.sincronizar('manual');
  else if (acao === 'dia') { Estado.dia = el.dataset.dia; desenhar(); window.scrollTo(0, 0); }
  else if (acao === 'grupo') { Estado.filtroGrupo = el.dataset.valor; Estado.filtroDupla = ''; desenhar(); }
  else if (acao === 'dupla') { Estado.filtroDupla = el.dataset.valor; desenhar(); }
  else if (acao === 'marcar') marcar(el.dataset.chave, el.dataset.status);
  else if (acao === 'copiar') copiar(el, el.dataset.texto);
  else if (acao === 'limpar-rejeitados') { await Banco.gravar('rejeitados', []); Estado.rejeitados = []; desenhar(); }
  else if (acao === 'atualizar-app' && Estado.swEsperando) Estado.swEsperando.postMessage('ATUALIZAR');
  else if (acao === 'sair') sair();
}

function prepararEventos() {
  if (eventosProntos) return;
  eventosProntos = true;
  raiz.addEventListener('click', aoClicar);
  raiz.addEventListener('input', function (e) { if (e.target.matches('textarea.obslivre')) agendarObs(e.target); });
  raiz.addEventListener('change', function (e) { if (e.target.matches('textarea.obslivre')) salvarObsAgora(e.target); });
  document.addEventListener('sync:inicio', function () { Estado.sincronizando = true; desenhar(); });
  document.addEventListener('sync:fim', async function (e) {
    await carregarEstado();
    Estado.sincronizando = false;
    Estado.erroSync = e.detail && !e.detail.ok ? e.detail : null;
    desenhar();
    Sync.reagendar();
  });
  document.addEventListener('fila:alterada', async function () { Estado.fila = await Banco.lerFila(); desenhar(); });
  document.addEventListener('gps:estado', desenhar);
  window.addEventListener('online', desenhar);
  window.addEventListener('offline', desenhar);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') Gps.iniciar(); else { salvarObsPendentes(); Gps.parar(); }
  });
  window.addEventListener('pagehide', salvarObsPendentes);
}

// ---------- Entrada e início ----------

function telaEntrada(mensagem) {
  raiz.innerHTML = '<div class="entrada"><div class="etq">QAgro · COPPETEC</div><h1>Roteiros de campo</h1>' +
    '<p>Digite o código de acesso que você recebeu do coordenador. É preciso ter internet só neste primeiro acesso.</p>' +
    '<form id="form-entrada"><input id="codigo" autocomplete="off" autocapitalize="characters" maxlength="12" placeholder="Código" required>' +
    '<button class="primario" type="submit">Entrar</button></form>' +
    '<p class="nota">Em seguida o app vai pedir acesso à <b>localização</b>. Ela é registrada só quando você marca o status de um ponto, para confirmar a visita. Toque em <b>Permitir</b>.</p>' +
    (mensagem ? '<p class="erro-entrada">' + esc(mensagem) + '</p>' : '') + '</div>';
  document.getElementById('form-entrada').addEventListener('submit', async function (e) {
    e.preventDefault();
    var botao = this.querySelector('button');
    botao.disabled = true;
    botao.textContent = 'Entrando…';
    var codigo = document.getElementById('codigo').value.trim().toUpperCase();
    try {
      var r = await Sync.entrar(codigo);
      if (!r.ok) { telaEntrada(r.mensagem || 'Código não aceito.'); return; }
    } catch (x) {
      telaEntrada('Sem conexão com o servidor. Tente de novo onde houver sinal.');
      return;
    }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
    abrirPrincipal();
  });
}

async function abrirPrincipal() {
  await carregarEstado();
  prepararEventos();
  Gps.iniciar();
  Sync.iniciarAgendamento();
  desenhar();
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(function (reg) {
    var avisar = function (w) { Estado.swEsperando = w; desenhar(); };
    if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting);
    reg.addEventListener('updatefound', function () {
      var w = reg.installing;
      w.addEventListener('statechange', function () {
        if (w.state === 'installed' && navigator.serviceWorker.controller) avisar(w);
      });
    });
  });
  var recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (recarregou) return;
    recarregou = true;
    location.reload();
  });
}

async function iniciar() {
  registrarServiceWorker();
  try {
    await Banco.abrir();
  } catch (e) {
    raiz.innerHTML = '<p class="alerta erro">Este navegador bloqueou o armazenamento local. Use o Chrome, fora da aba anônima.</p>';
    return;
  }
  await Sync.carregarBloqueio();
  if (!(await Banco.ler('codigo'))) { telaEntrada(); return; }
  await abrirPrincipal();
  Sync.sincronizar('abertura');
}

iniciar();
