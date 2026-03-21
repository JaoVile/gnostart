const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CANONICAL_MAP_CONFIG_PATH = path.resolve(
  PROJECT_ROOT,
  'src',
  'data',
  'mapa_canonico',
  'mapa-base-canonica.json',
);
const CANONICAL_PINS_REFERENCE_PATH = path.resolve(
  PROJECT_ROOT,
  'src',
  'data',
  'mapa_canonico',
  'pins-canonicos.txt',
);
const GRAPH_PATH = path.resolve(PROJECT_ROOT, 'src', 'data', 'navGraph.json');
const POI_SEED_OUTPUT_PATH = path.resolve(PROJECT_ROOT, 'src', 'data', 'locaisEventoSocialSeed.json');
const EXPECTED_PIN_COUNT = 20;

const VALID_POI_TYPES = new Set(['atividade', 'servico', 'banheiro', 'entrada']);

const readJsonFile = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const sanitizePin = (value) => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.nome !== 'string' ||
    !VALID_POI_TYPES.has(candidate.tipo) ||
    !isFiniteNumber(candidate.x) ||
    !isFiniteNumber(candidate.y) ||
    typeof candidate.imagemUrl !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id.trim(),
    nome: candidate.nome.trim(),
    tipo: candidate.tipo,
    x: Math.round(candidate.x),
    y: Math.round(candidate.y),
    imagemUrl: candidate.imagemUrl.trim(),
  };
};

const buildGraphComponents = (graph) => {
  const componentByNodeId = new Map();
  const componentSizes = [];
  const visited = new Set();
  let componentIndex = 0;

  for (const startNodeId of Object.keys(graph)) {
    if (visited.has(startNodeId)) continue;

    const stack = [startNodeId];
    visited.add(startNodeId);
    let size = 0;

    while (stack.length > 0) {
      const nodeId = stack.pop();
      componentByNodeId.set(nodeId, componentIndex);
      size += 1;

      for (const neighborId of graph[nodeId].neighbors || []) {
        if (!graph[neighborId] || visited.has(neighborId)) continue;
        visited.add(neighborId);
        stack.push(neighborId);
      }
    }

    componentSizes[componentIndex] = size;
    componentIndex += 1;
  }

  let primaryComponentId = 0;
  for (let index = 1; index < componentSizes.length; index += 1) {
    if ((componentSizes[index] ?? 0) > (componentSizes[primaryComponentId] ?? 0)) {
      primaryComponentId = index;
    }
  }

  return {
    componentByNodeId,
    primaryComponentId,
  };
};

const findNearestPrimaryNode = (nodes, x, y) => {
  let bestNode = null;

  for (const node of nodes) {
    const distance = Math.hypot(node.x - x, node.y - y);
    if (!bestNode || distance < bestNode.distance) {
      bestNode = {
        id: node.id,
        x: node.x,
        y: node.y,
        distance,
      };
    }
  }

  return bestNode;
};

const canonicalConfig = readJsonFile(CANONICAL_MAP_CONFIG_PATH);
const graph = readJsonFile(GRAPH_PATH);

if (!Array.isArray(canonicalConfig.pins)) {
  throw new Error(`Arquivo canonico invalido: ${CANONICAL_MAP_CONFIG_PATH}`);
}

const pins = canonicalConfig.pins.map(sanitizePin).filter(Boolean);
if (pins.length !== EXPECTED_PIN_COUNT) {
  throw new Error(
    `Mapa canonico invalido: esperado ${EXPECTED_PIN_COUNT} pins em ${CANONICAL_MAP_CONFIG_PATH}, encontrado ${pins.length}.`,
  );
}

const duplicateIds = pins.filter((pin, index) => pins.findIndex((candidate) => candidate.id === pin.id) !== index);
if (duplicateIds.length > 0) {
  throw new Error(`Mapa canonico invalido: ids duplicados detectados (${duplicateIds.map((pin) => pin.id).join(', ')}).`);
}

const { componentByNodeId, primaryComponentId } = buildGraphComponents(graph);
const primaryNodes = Object.entries(graph)
  .filter(([nodeId]) => componentByNodeId.get(nodeId) === primaryComponentId)
  .map(([id, node]) => ({ id, x: node.x, y: node.y }));

if (primaryNodes.length === 0) {
  throw new Error(`navGraph invalido em ${GRAPH_PATH}: malha principal vazia.`);
}

const seedOutput = pins.map((pin) => {
  const nearestNode = findNearestPrimaryNode(primaryNodes, pin.x, pin.y);
  if (!nearestNode) {
    throw new Error(`Nao foi possivel resolver nodeId para ${pin.nome}.`);
  }

  return {
    ...pin,
    nodeId: nearestNode.id,
  };
});

const referenceLines = pins.map((pin) => {
  const fileName = pin.imagemUrl.replace(/^fotopins\//, '');
  return `${pin.nome}/x: ${pin.x} | y: ${pin.y}/${fileName}`;
});

fs.writeFileSync(POI_SEED_OUTPUT_PATH, `${JSON.stringify(seedOutput, null, 2)}\n`);
fs.writeFileSync(CANONICAL_PINS_REFERENCE_PATH, `${referenceLines.join('\n')}\n`);

const maxSnapDistance = seedOutput.reduce((best, pin) => {
  const [nodeX, nodeY] = pin.nodeId.split('_').map(Number);
  const distance = Math.hypot(nodeX - pin.x, nodeY - pin.y);
  return Math.max(best, distance);
}, 0);

console.log(
  [
    `Mapa canonico sincronizado: ${seedOutput.length} pins.`,
    `Seed salvo em ${path.relative(PROJECT_ROOT, POI_SEED_OUTPUT_PATH)}.`,
    `Referencia salva em ${path.relative(PROJECT_ROOT, CANONICAL_PINS_REFERENCE_PATH)}.`,
    `Maior distancia ate o corredor branco: ${maxSnapDistance.toFixed(2)}px.`,
  ].join(' '),
);
