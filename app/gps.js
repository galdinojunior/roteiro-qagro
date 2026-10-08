/*
 * GPS: mantém a posição "aquecida" enquanto o app está visível (reduz a espera sem internet)
 * e captura a posição no momento da marcação. Funciona offline (receptor de satélite).
 */
var Gps = (function () {
  var observador = null;
  var ultima = null;
  var negada = false;

  function suportado() {
    return 'geolocation' in navigator;
  }

  function converter(p) {
    return {
      lat: Number(p.coords.latitude.toFixed(6)),
      lon: Number(p.coords.longitude.toFixed(6)),
      precisao_m: Math.round(p.coords.accuracy),
      hora_gps: isoComFuso(new Date(p.timestamp)),
      instante: p.timestamp
    };
  }

  function mudarPermissao(valor) {
    if (negada === valor) return;
    negada = valor;
    document.dispatchEvent(new CustomEvent('gps:estado'));
  }

  function iniciar() {
    if (!suportado() || observador !== null) return;
    observador = navigator.geolocation.watchPosition(function (p) {
      var pos = converter(p);
      if (!ultima || pos.instante >= ultima.instante) ultima = pos;
      mudarPermissao(false);
    }, function (e) {
      if (e.code === e.PERMISSION_DENIED) mudarPermissao(true);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 });
  }

  function parar() {
    if (observador === null) return;
    navigator.geolocation.clearWatch(observador);
    observador = null;
  }

  function semInstante(pos) {
    return pos && { lat: pos.lat, lon: pos.lon, precisao_m: pos.precisao_m, hora_gps: pos.hora_gps };
  }

  function capturar(precisaoMax, timeoutS) {
    return new Promise(function (resolve) {
      if (!suportado()) { resolve({ posicao: null, erro: 'NAO_SUPORTADO' }); return; }
      var inicio = Date.now();
      if (ultima && inicio - ultima.instante <= 30000 && ultima.precisao_m <= precisaoMax) {
        resolve({ posicao: semInstante(ultima), erro: null });
        return;
      }
      var melhor = null;
      var encerrado = false;
      var id = null;
      var timer = null;
      function encerrar(erro) {
        if (encerrado) return;
        encerrado = true;
        clearTimeout(timer);
        if (id !== null) navigator.geolocation.clearWatch(id);
        resolve({ posicao: semInstante(melhor), erro: melhor ? null : erro });
      }
      timer = setTimeout(function () { encerrar('SEM_SINAL'); }, timeoutS * 1000);
      id = navigator.geolocation.watchPosition(function (p) {
        var pos = converter(p);
        if (pos.instante < inicio - 30000) return; // leitura antiga guardada pelo sistema
        ultima = pos;
        if (!melhor || pos.precisao_m < melhor.precisao_m) melhor = pos;
        mudarPermissao(false);
        if (pos.precisao_m <= precisaoMax) encerrar(null);
      }, function (e) {
        if (e.code === e.PERMISSION_DENIED) { mudarPermissao(true); encerrar('SEM_PERMISSAO'); }
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutS * 1000 });
    });
  }

  return { iniciar: iniciar, parar: parar, capturar: capturar, permissaoNegada: function () { return negada; } };
})();
