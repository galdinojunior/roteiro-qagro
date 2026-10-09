// Aba "roteiros" fictícia no formato de equipes. Coordenadas e lugares inventados.

function dia(inicio, deslocamento) {
  return new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + deslocamento);
}

function periodoDeDoisDias(d0, d1) {
  const d0Dia = String(d0.getDate()).padStart(2, '0');
  const d1Dia = String(d1.getDate()).padStart(2, '0');
  const d0Mes = String(d0.getMonth() + 1).padStart(2, '0');
  const d1Mes = String(d1.getMonth() + 1).padStart(2, '0');
  if (d0.getMonth() === d1.getMonth()) return d0Dia + ' e ' + d1Dia + '/' + d1Mes;
  return d0Dia + '/' + d0Mes + ' a ' + d1Dia + '/' + d1Mes;
}

function linhasSinteticas(inicio = new Date(2026, 9, 12)) {
  const d0 = dia(inicio, 0);
  const d1 = dia(inicio, 1);
  const d2 = dia(inicio, 2);
  const futuro = dia(inicio, 14);
  const cab = (d, equipe, periodo, nome) => [d, equipe, 99, '-', periodo, null, nome, null, null, null];
  return [
    [0, null, null, null, null, null, null, null, null, null],
    ['data', 'equipe', 'roteiro', 'visitas', 'ordem', 'municipio', 'ponto', 'D', 'coordenada', 'obs'],
    cab(d0, 'A', periodoDeDoisDias(d0, d1), 'Equipe A'),
    [d0, 'A', 99, '-', 0, 'Cidade Alfa', 'Ponto de encontro', null, '-20.000,-44.000', 'Praça Alfa'],
    [d0, 'A', 99, 1, 2, 'Cidade Alfa', 'AA0002X', 1, '-20.002,-44.002', null],
    [d0, 'A', 99, 0, 1, 'Cidade Alfa', 'AA0001X', 0, '-20.001,-44.001', null],
    [d0, 'A', 99, 2, 3, 'Cidade Alfa', 'AA0003X', 0, 'sem coordenada', 'Casa amarela'],
    [d0, 'A', 99, 3, 4, 'Cidade Alfa', 'AAESGOT', 0, '-20.004,-44.004', null],
    [d0, 'A', 99, '-', 5, 'Cidade Alfa', 'AAHIFEN', 0, '-20.005,-44.005', null],
    [d0, 'A', 99, '-', 6, 'Cidade Alfa', 'Ponto de término', null, '-20.000,-44.000', 'Praça Alfa'],
    cab(d0, 'B', '', 'Equipe B'),
    [d0, 'B', 99, '-', 0, 'Cidade Beta', 'Ponto de encontro', null, '-20.010,-44.010', 'Praça Beta'],
    [d0, 'B', 99, 1, 1, 'Cidade Beta', 'BB0001X', 0, '-20.011,-44.011', null],
    cab(d1, 'A', '', 'Equipe A1'),
    [d1, 'A', 99, '-', 0, 'Cidade Alfa', 'Ponto de encontro', null, '-20.000,-44.000', 'Praça Alfa'],
    [d1, 'A', 99, 0, 1, 'Cidade Alfa', 'A10001X', 0, '-20.001,-44.001', null],
    cab(d2, 'X', '', 'Equipe XYZ'),
    [d2, 'X', 99, 0, 1, 'Cidade X', 'IGNORADO', 0, '-20.020,-44.020', null],
    cab(d0, 'A', '', 'Equipe A'),
    [d0, 'A', 99, 0, 1, 'Cidade Alfa', 'AA0001X', 0, '-20.001,-44.001', null],
    cab(futuro, 'C', '', 'Equipe C'),
    [futuro, 'C', 99, '-', 0, null, 'Ponto de encontro', null, null, null],
    [futuro, 'C', 99, 4, 1, 'Cidade C', 'CESGOT', 0, '-20.030,-44.030', null],
  ];
}

module.exports = { linhasSinteticas };
