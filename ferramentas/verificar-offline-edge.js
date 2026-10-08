// Verificação ponta a ponta do modo offline em Edge headless via CDP (docs/decisoes.md, D14).
// Uso (na raiz do repositório): node ferramentas/verificar-offline-edge.js
// Sobe o servidor local na porta 8090, entra como ENTR01, derruba o servidor, marca um ponto offline
// com GPS emulado, volta o servidor, sincroniza e testa o aviso de nova versão (restaura config.js e sw.js ao final).
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarServidor } = require(path.resolve('testes/servidor-local.js'));

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORTA = 8090;
const ORIGEM = `http://localhost:${PORTA}`;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

let servidor = null;
function subir() { servidor = criarServidor(); return new Promise((ok) => servidor.listen(PORTA, ok)); }
function derrubar() { return new Promise((ok) => { servidor.closeAllConnections?.(); servidor.close(() => ok()); }); }

async function main() {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-roteiro-'));
  const edge = spawn(EDGE, ['--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${perfil}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  const arquivosOriginais = { sw: fs.readFileSync('app/sw.js', 'utf8'), cfg: fs.readFileSync('app/config.js', 'utf8') };
  try {
    await subir();
    let alvos;
    for (let i = 0; i < 40; i++) { try { alvos = await (await fetch('http://127.0.0.1:9333/json/list')).json(); if (alvos.some((t) => t.type === 'page')) break; } catch {} await espera(250); }
    const ws = new WebSocket(alvos.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((ok) => ws.addEventListener('open', ok));
    let seq = 0; const pend = new Map();
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
    const cdp = (method, params = {}) => new Promise((ok) => { const id = ++seq; pend.set(id, ok); ws.send(JSON.stringify({ id, method, params })); });
    const avaliar = async (expr) => { const r = await cdp('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true }); return r.result?.result?.value ?? r.result?.exceptionDetails?.text; };
    const ir = async () => { await cdp('Page.navigate', { url: ORIGEM }); await espera(2500); };

    await cdp('Page.enable'); await cdp('Runtime.enable');
    await cdp('Browser.grantPermissions', { origin: ORIGEM, permissions: ['geolocation'] });
    await cdp('Emulation.setGeolocationOverride', { latitude: -20.001, longitude: -44.001, accuracy: 10 });

    await ir();
    log('1a entrada:', await avaliar(`document.getElementById('codigo').value='ENTR01'; document.getElementById('form-entrada').requestSubmit(); await new Promise(r=>setTimeout(r,2500)); return document.querySelector('.bloco h1')?.textContent`));
    await ir();
    log('1b SW controla a página:', await avaliar(`return !!navigator.serviceWorker.controller + ' caches=' + (await caches.keys()).join(',')`));

    await derrubar();
    log('2  servidor derrubado');
    await ir();
    log('2  abre offline:', await avaliar(`return document.querySelector('.bloco h1')?.textContent + ' | pontos=' + document.querySelectorAll('.card').length`));

    log('3  marca offline:', await avaliar(`document.querySelector('[data-acao="marcar"][data-status="Feito"]').click(); await new Promise(r=>setTimeout(r,4000)); return document.querySelector('.sinc').textContent + ' || ' + document.querySelector('.rodape').textContent + ' || alerta: ' + (document.querySelector('.alertas')?.textContent||'')`));

    await subir();
    log('4  servidor de volta; sincroniza:', await avaliar(`document.querySelector('.sinc').click(); await new Promise(r=>setTimeout(r,3000)); return document.querySelector('.sinc').textContent + ' || ' + document.querySelector('.rodape').textContent`));

    fs.writeFileSync('app/sw.js', arquivosOriginais.sw.replace("roteiro-v1.0.0", 'roteiro-v1.0.1'));
    fs.writeFileSync('app/config.js', arquivosOriginais.cfg.replace("VERSAO: '1.0.0'", "VERSAO: '1.0.1'"));
    await ir(); await espera(3000); await ir();
    log('5  aviso de nova versão:', await avaliar(`return document.querySelector('[data-acao="atualizar-app"]')?.textContent || 'SEM AVISO'`));
    await avaliar(`document.querySelector('[data-acao="atualizar-app"]')?.click(); return 1`);
    await espera(3500);
    log('5  versão após atualizar:', await avaliar(`return document.querySelector('.menu-corpo p')?.textContent`));
    ws.close();
  } finally {
    fs.writeFileSync('app/sw.js', arquivosOriginais.sw);
    fs.writeFileSync('app/config.js', arquivosOriginais.cfg);
    try { await derrubar(); } catch {}
    edge.kill();
  }
}
main().then(() => process.exit(0), (e) => { console.error('FALHA', e); process.exit(1); });
