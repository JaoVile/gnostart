// src/data/mockData.ts

// Exemplo simples de grafo para evento social (arquivo de apoio/local).
export const nodes = {
  entrada_principal: { x: 390, y: 1160, vizinhos: ['credenciamento'] },
  credenciamento: { x: 390, y: 1020, vizinhos: ['entrada_principal', 'corredor_central'] },
  corredor_central: { x: 390, y: 760, vizinhos: ['credenciamento', 'palco_principal', 'area_alimentacao'] },
  palco_principal: { x: 390, y: 620, vizinhos: ['corredor_central', 'lounge_convivio'] },
  lounge_convivio: { x: 250, y: 730, vizinhos: ['palco_principal'] },
  area_alimentacao: { x: 390, y: 360, vizinhos: ['corredor_central'] },
};

// Exemplo de pontos do evento.
export const eventPoints = [
  {
    id: 'palco_principal',
    nome: 'Palco Principal',
    nodeId: 'palco_principal',
    tipo: 'atividade',
  },
  {
    id: 'recepcao_credenciamento',
    nome: 'Recepcao e Credenciamento',
    nodeId: 'credenciamento',
    tipo: 'servico',
  },
  {
    id: 'area_alimentacao',
    nome: 'Area de Alimentacao',
    nodeId: 'area_alimentacao',
    tipo: 'servico',
  },
];
