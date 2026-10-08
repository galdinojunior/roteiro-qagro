// Gera os ícones do app (PNG) sem dependências: fundo laranja com um marcador de mapa branco.
// Uso: node ferramentas/gerar-icones.js
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const LARANJA = [0xec, 0x67, 0x07];
const BRANCO = [0xff, 0xff, 0xff];

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function bloco(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

function png(tamanho, pixel) {
  const linhas = [];
  for (let y = 0; y < tamanho; y++) {
    const linha = Buffer.alloc(1 + tamanho * 3);
    for (let x = 0; x < tamanho; x++) {
      const [r, g, b] = pixel(x / tamanho, y / tamanho);
      linha[1 + x * 3] = r; linha[2 + x * 3] = g; linha[3 + x * 3] = b;
    }
    linhas.push(linha);
  }
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(tamanho, 0);
  cabecalho.writeUInt32BE(tamanho, 4);
  cabecalho[8] = 8; // bits por canal
  cabecalho[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloco('IHDR', cabecalho),
    bloco('IDAT', zlib.deflateSync(Buffer.concat(linhas))),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

// Marcador dentro da zona segura (80% central) exigida por ícones "maskable".
function marcador(u, v) {
  const cx = 0.5, cy = 0.42, raio = 0.2, furo = 0.08, ponta = 0.78;
  const d = Math.hypot(u - cx, v - cy);
  if (d <= furo) return LARANJA;
  if (d <= raio) return BRANCO;
  if (v >= cy && v <= ponta && Math.abs(u - cx) <= raio * (ponta - v) / (ponta - cy)) return BRANCO;
  return LARANJA;
}

const pasta = path.join(__dirname, '..', 'app', 'icones');
fs.mkdirSync(pasta, { recursive: true });
for (const tamanho of [192, 512]) {
  fs.writeFileSync(path.join(pasta, `icone-${tamanho}.png`), png(tamanho, marcador));
  console.log(`app/icones/icone-${tamanho}.png`);
}
