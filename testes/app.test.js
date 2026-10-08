const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ } = require('./carregar');

const APP = path.join(RAIZ, 'app');
const ler = (arq) => fs.readFileSync(path.join(APP, arq), 'utf8');
const arquivosSw = () => JSON.parse(/const ARQUIVOS = (\[[\s\S]*?\]);/.exec(ler('sw.js'))[1]);

test('versão do config.js e do cache do Service Worker coincidem', () => {
  const versao = /VERSAO:\s*'([^']+)'/.exec(ler('config.js'))[1];
  const cache = /const VERSAO_CACHE = '([^']+)'/.exec(ler('sw.js'))[1];
  assert.equal(cache, 'roteiro-v' + versao, 'aumente VERSAO em config.js e VERSAO_CACHE em sw.js juntos');
});

test('todo arquivo do cache offline existe', () => {
  for (const arq of arquivosSw()) {
    if (arq === './') continue;
    assert.ok(fs.existsSync(path.join(APP, arq)), `faltando app/${arq}`);
  }
});

test('todo script e estilo do index.html está no cache offline', () => {
  const html = ler('index.html');
  const usados = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const cache = arquivosSw();
  for (const u of usados) assert.ok(cache.includes(u), `${u} não está em ARQUIVOS (sw.js)`);
});

test('manifesto válido com ícones PNG existentes', () => {
  const m = JSON.parse(ler('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  for (const icone of m.icons) {
    const buf = fs.readFileSync(path.join(APP, icone.src));
    assert.deepEqual([...buf.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${icone.src} não é PNG`);
  }
});
