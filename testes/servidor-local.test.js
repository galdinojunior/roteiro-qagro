const test = require('node:test');
const assert = require('node:assert/strict');
const { criarServidor } = require('./servidor-local');

let servidor;
let base;

test.before(async () => {
  servidor = criarServidor();
  await new Promise((ok) => servidor.listen(0, ok));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
test.after(() => servidor.close());

const api = (corpo) => fetch(`${base}/api`, {
  method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corpo),
}).then((r) => r.json());

test('API: entrar devolve só a equipe do entrevistador, começando hoje', async () => {
  const r = await api({ acao: 'entrar', codigo: 'ENTR01' });
  assert.equal(r.ok, true);
  assert.ok(r.roteiro.blocos.length >= 1);
  assert.ok(r.roteiro.blocos.every((b) => b.equipe === 'A'));
  const hoje = new Date();
  const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  assert.equal(r.roteiro.blocos[0].data, iso);
});

test('API: corpo inválido vira requisicao_invalida', async () => {
  const r = await fetch(`${base}/api`, { method: 'POST', body: 'não é json' }).then((x) => x.json());
  assert.equal(r.erro, 'requisicao_invalida');
});

test('estáticos: página, config de desenvolvimento e bloqueio fora de app/', async () => {
  assert.equal((await fetch(`${base}/`)).status, 200);
  const cfg = await fetch(`${base}/config.js`).then((r) => r.text());
  assert.match(cfg, /URL_API: '\/api'/);
  assert.equal((await fetch(`${base}/%2e%2e/package.json`)).status, 404);
  assert.equal((await fetch(`${base}/nao-existe.js`)).status, 404);
});
