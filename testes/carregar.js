// Carrega arquivos de escopo global (.gs do Apps Script e <script> do app) num contexto vm,
// imitando o ambiente real: funções e "var" de topo viram propriedades do contexto.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAIZ = path.join(__dirname, '..');

function carregar(...arquivos) {
  const contexto = vm.createContext({ console });
  for (const arquivo of arquivos) {
    const caminho = path.join(RAIZ, arquivo);
    vm.runInContext(fs.readFileSync(caminho, 'utf8'), contexto, { filename: caminho });
  }
  return contexto;
}

// Objetos criados dentro do contexto vm têm outro protótipo; normaliza para comparar.
function simples(valor) {
  return JSON.parse(JSON.stringify(valor));
}

module.exports = { carregar, simples, RAIZ };
