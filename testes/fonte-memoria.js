// Fonte de dados em memória com a mesma interface de fontePlanilha() (apps-script/Codigo.gs).
// Usada nos testes de contrato e no servidor local de desenvolvimento.
function criarFonteMemoria({ roteiros, usuarios, config = [], hoje, agora }) {
  const estado = { registros: [], situacao: [] };
  const valor = (v) => (typeof v === 'function' ? v() : v);
  return {
    estado,
    lerConfig: () => config,
    lerUsuarios: () => usuarios,
    lerRoteiros: () => roteiros,
    lerIdsRegistros: () => Object.fromEntries(estado.registros.map((l) => [l[0], true])),
    acrescentarRegistros: (linhas) => { estado.registros.push(...linhas); },
    lerSituacao: () => estado.situacao,
    gravarSituacao: (linhas) => { estado.situacao = linhas; },
    comTrava: (fn) => fn(),
    hojeIso: () => valor(hoje),
    agoraIso: () => valor(agora),
  };
}

module.exports = { criarFonteMemoria };
