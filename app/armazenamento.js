/*
 * Persistência local em IndexedDB.
 * Lojas: "kv" (sessão, roteiro, situação e estado diverso) e "fila" (marcações ainda não aceitas pelo servidor).
 */
var Banco = (function () {
  var NOME = 'roteiro-qagro';
  var VERSAO = 1;
  var conexao = null;

  function abrir() {
    if (conexao) return Promise.resolve(conexao);
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(NOME, VERSAO);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('fila')) db.createObjectStore('fila', { keyPath: 'id_marcacao' });
      };
      req.onsuccess = function () { conexao = req.result; resolve(conexao); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function pedido(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function concluir(tx) {
    return new Promise(function (resolve, reject) {
      tx.oncomplete = function () { resolve(); };
      tx.onerror = tx.onabort = function () { reject(tx.error); };
    });
  }

  async function ler(chave) {
    var db = await abrir();
    var valor = await pedido(db.transaction('kv').objectStore('kv').get(chave));
    return valor === undefined ? null : valor;
  }

  async function gravarVarios(pares) {
    var db = await abrir();
    var tx = db.transaction('kv', 'readwrite');
    pares.forEach(function (par) { tx.objectStore('kv').put(par[1], par[0]); });
    return concluir(tx);
  }

  function gravar(chave, valor) {
    return gravarVarios([[chave, valor]]);
  }

  async function lerFila() {
    var db = await abrir();
    return pedido(db.transaction('fila').objectStore('fila').getAll());
  }

  async function enfileirar(registro) {
    var db = await abrir();
    var tx = db.transaction('fila', 'readwrite');
    tx.objectStore('fila').put(registro);
    return concluir(tx);
  }

  async function removerDaFila(ids) {
    if (!ids.length) return;
    var db = await abrir();
    var tx = db.transaction('fila', 'readwrite');
    ids.forEach(function (id) { tx.objectStore('fila').delete(id); });
    return concluir(tx);
  }

  async function apagarTudo() {
    var db = await abrir();
    var tx = db.transaction(['kv', 'fila'], 'readwrite');
    tx.objectStore('kv').clear();
    tx.objectStore('fila').clear();
    return concluir(tx);
  }

  return { abrir: abrir, ler: ler, gravar: gravar, gravarVarios: gravarVarios, lerFila: lerFila,
    enfileirar: enfileirar, removerDaFila: removerDaFila, apagarTudo: apagarTudo };
})();
