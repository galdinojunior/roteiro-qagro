/**
 * Geo — funções geográficas puras.
 * Este arquivo existe em duas cópias idênticas: apps-script/Geo.gs e app/geo.js
 * (o teste testes/geo.test.js garante que não divergem).
 */

/** Distância em metros entre dois pontos (fórmula de Haversine). */
function distanciaMetros(lat1, lon1, lat2, lon2) {
  var R = 6371008.8;
  var rad = Math.PI / 180;
  var dLat = (lat2 - lat1) * rad;
  var dLon = (lon2 - lon1) * rad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Converte "lat,lon" (espaços opcionais) em {lat, lon}; null se inválido. */
function lerCoordenada(texto) {
  if (texto === null || texto === undefined) return null;
  var m = String(texto).trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  var lat = parseFloat(m[1]);
  var lon = parseFloat(m[2]);
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat: lat, lon: lon };
}
