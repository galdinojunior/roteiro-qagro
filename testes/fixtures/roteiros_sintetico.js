// Aba "roteiros" fictícia no formato S2 (blocos por dupla). Coordenadas inventadas.
// inicio: data do primeiro dia (padrão 14/09/2026). O servidor local usa a data de hoje.

function dia(inicio, deslocamento) {
  return new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + deslocamento);
}

function ddmmaaaa(d) {
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

function linhasSinteticas(inicio = new Date(2026, 8, 14)) {
  const d0 = dia(inicio, 0);
  const d1 = ddmmaaaa(dia(inicio, 1));
  const dFut = dia(inicio, 14);
  const cab = (d, eq, nome) => [d, eq, '-', d, null, nome, 'D', 'Coordenadas', 'OBS'];
  return [
    [0, null, null, null, null, null, null, null, null],
    ['data', 'equipe', 'visitas', 'ordem', 'municipio', 'ponto', 'D', 'coordenada', 'obs'],
    // Formato S1 (sem número de dupla): deve ser ignorado
    cab(d0, 'A', 'Equipe A'),
    [d0, 'A', '-', 0, 'Betim', 'Ponto de encontro', null, '-19.9, -44.1', 'Praça S1'],
    [d0, 'A', 1, 1, 'Betim', 'S1PONTO', 0, '-19.91,-44.11', null],
    // A1 no dia 0 — pontos fora de ordem, duplicidade e coordenada inválida
    cab(d0, 'A', 'Equipe A1'),
    [d0, 'A', '-', 0, 'Cidade Um', 'Ponto de encontro', null, '-20.000000, -44.000000', 'Praça Um - Centro'],
    [d0, 'A', 1, 2, 'Cidade Um', 'AA0002X', 1, '-20.001,-44.001', null],
    [d0, 'A', 1, 1, 'Cidade Um', 'AA0001X', 1, '-20.001, -44.001', null],
    [d0, 'A', 1, 3, 'Cidade Um', 'AA0003X', 0, 'sem coordenada', 'Casa amarela'],
    [d0, 'A', '-', 4, '-', '-', 0, '-', null],
    [d0, 'A', '-', 5, null, null, null, null, null],
    [d0, 'A', '-', null, null, null, null, null, null],
    // A2 no dia 0 — encontro diferente do A1 e com término
    cab(d0, 'A', 'Equipe A2'),
    [d0, 'A', '-', 0, 'Cidade Dois', 'Ponto de encontro', null, '-20.100000, -44.100000', 'Mercado Dois'],
    [d0, 'A', 1, 1, 'Cidade Dois', 'BB0001X', 0, '-20.101,-44.101', null],
    [d0, 'A', 1, 2, 'Cidade Dois', 'BB0002X', 0, '-20.102,-44.102', null],
    [d0, 'A', '-', 3, 'Cidade Um', 'Ponto de término', null, '-20.000000, -44.000000', 'Praça Um - Centro'],
    // A1 no dia 1 — data como texto
    cab(d1, 'A', 'Equipe A1'),
    [d1, 'A', '-', 0, 'Cidade Um', 'Ponto de encontro', null, '-20.000000, -44.000000', 'Praça Um - Centro'],
    [d1, 'A', 1, 1, 'Cidade Um', 'AA0001X', 0, '-20.001,-44.001', null],
    // B1 futuro — só linhas-modelo vazias (semana ainda não planejada)
    cab(dFut, 'B', 'Equipe B1'),
    [dFut, 'B', '-', 0, null, 'Ponto de encontro', null, null, null],
    [dFut, 'B', '-', 1, null, null, null, null, null],
  ];
}

module.exports = { linhasSinteticas };
