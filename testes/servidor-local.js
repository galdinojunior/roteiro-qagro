// Servidor de desenvolvimento: serve app/ e simula o Apps Script em /api com dados fictícios em memória.
// Uso: npm run servidor  →  http://localhost:8080
// Códigos: ENTR01 (equipe A), ENTR02 (equipe B), SUPE01 (supervisor), INAT01 (inativo).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { carregar, RAIZ } = require('./carregar');
const { linhasSinteticas } = require('./fixtures/roteiros_sintetico');
const { criarFonteMemoria } = require('./fonte-memoria');

const PASTA_APP = path.join(RAIZ, 'app');
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.json': 'application/json',
};

function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function criarServidor() {
  const regras = carregar('apps-script/Geo.gs', 'apps-script/Leitor.gs', 'apps-script/Regras.gs');
  const agora = new Date();
  const fonte = criarFonteMemoria({
    roteiros: linhasSinteticas(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())),
    usuarios: [
      ['Entrevistador A', 'ENTR01', 'entrevistador', 'A', 'S'],
      ['Entrevistador B', 'ENTR02', 'entrevistador', 'B', 'S'],
      ['Supervisão', 'SUPE01', 'supervisor', '', 'S'],
      ['Inativo', 'INAT01', 'entrevistador', 'A', 'N'],
    ],
    hoje: hojeLocal,
    agora: () => new Date().toISOString(),
  });

  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/api') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (req.method !== 'POST') { res.writeHead(405).end(); return; }
      let corpo = '';
      req.on('data', (parte) => { corpo += parte; });
      req.on('end', () => {
        let resposta;
        try {
          resposta = regras.atenderRequisicao(JSON.parse(corpo), fonte);
        } catch (e) {
          resposta = regras.erroResposta('requisicao_invalida');
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(resposta));
      });
      return;
    }

    if (url.pathname === '/config.js') {
      const versao = /VERSAO:\s*'([^']+)'/.exec(fs.readFileSync(path.join(PASTA_APP, 'config.js'), 'utf8'))[1];
      res.writeHead(200, { 'Content-Type': TIPOS['.js'], 'Cache-Control': 'no-store' });
      res.end(`var CONFIG = { URL_API: '/api', VERSAO: '${versao}' };\n`);
      return;
    }

    const relativo = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const arquivo = path.join(PASTA_APP, relativo);
    if (!arquivo.startsWith(PASTA_APP + path.sep) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('não encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
    fs.createReadStream(arquivo).pipe(res);
  });
}

if (require.main === module) {
  const porta = Number(process.env.PORTA || 8080);
  criarServidor().listen(porta, () => {
    console.log(`http://localhost:${porta}  — códigos: ENTR01 (A), ENTR02 (B), SUPE01 (supervisor), INAT01 (inativo)`);
  });
}

module.exports = { criarServidor };
