const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const sharp = require('sharp');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CANONICAL_MAP_CONFIG_PATH = path.resolve(
  PROJECT_ROOT,
  'src',
  'data',
  'mapa_canonico',
  'mapa-base-canonica.json',
);

const loadCanonicalMapConfig = () => {
  if (!fs.existsSync(CANONICAL_MAP_CONFIG_PATH)) return null;
  return JSON.parse(fs.readFileSync(CANONICAL_MAP_CONFIG_PATH, 'utf8'));
};

const CANONICAL_MAP_CONFIG = loadCanonicalMapConfig();
const CANONICAL_ROUTE_CONFIG = CANONICAL_MAP_CONFIG?.route ?? {};
const CANONICAL_ROUTE_ALIGNMENT = CANONICAL_ROUTE_CONFIG.alignment ?? {};
const DEFAULT_EVENT_BOUNDARY_IMAGE_POINTS = [
  { x: 559, y: 316 },
  { x: 636, y: 316 },
  { x: 646, y: 321 },
  { x: 698, y: 321 },
  { x: 740, y: 300 },
  { x: 827, y: 315 },
  { x: 918, y: 314 },
  { x: 921, y: 399 },
  { x: 748, y: 400 },
  { x: 697, y: 403 },
  { x: 647, y: 401 },
  { x: 634, y: 396 },
  { x: 560, y: 397 },
];
const OUTPUT_FILE = process.env.MAP_GRAPH_OUTPUT || CANONICAL_ROUTE_CONFIG.graphOutput || '../src/data/navGraph.json';
const GRID_SIZE = Number.parseInt(
  process.env.GRID_SIZE || String(CANONICAL_ROUTE_CONFIG.gridSize || '2'),
  10,
);
const COMPONENT_BRIDGE_MAX_DISTANCE = Number.parseFloat(
  process.env.COMPONENT_BRIDGE_MAX_DISTANCE ||
    String(CANONICAL_ROUTE_CONFIG.componentBridgeMaxDistance || '0'),
);
const COMPONENT_BRIDGE_MAX_SIZE = Number.parseInt(
  process.env.COMPONENT_BRIDGE_MAX_SIZE || String(CANONICAL_ROUTE_CONFIG.componentBridgeMaxSize || '0'),
  10,
);
const sanitizeAlignmentNumber = (rawValue, fallback, options = {}) => {
  const parsed = typeof rawValue === 'number' ? rawValue : Number.parseFloat(String(rawValue));
  if (!Number.isFinite(parsed)) return fallback;
  if (options.min != null && parsed < options.min) return fallback;
  return parsed;
};
const LOGICAL_ALIGNMENT_OFFSET_X = sanitizeAlignmentNumber(
  process.env.MAP_LOGIC_OFFSET_X ?? CANONICAL_ROUTE_ALIGNMENT.offsetX,
  0,
);
const LOGICAL_ALIGNMENT_OFFSET_Y = sanitizeAlignmentNumber(
  process.env.MAP_LOGIC_OFFSET_Y ?? CANONICAL_ROUTE_ALIGNMENT.offsetY,
  0,
);
const LOGICAL_ALIGNMENT_SCALE_X = sanitizeAlignmentNumber(
  process.env.MAP_LOGIC_SCALE_X ?? CANONICAL_ROUTE_ALIGNMENT.scaleX,
  1,
  { min: 0.05 },
);
const LOGICAL_ALIGNMENT_SCALE_Y = sanitizeAlignmentNumber(
  process.env.MAP_LOGIC_SCALE_Y ?? CANONICAL_ROUTE_ALIGNMENT.scaleY,
  1,
  { min: 0.05 },
);
const WALKABLE_MODE = (process.env.WALKABLE_MODE || CANONICAL_ROUTE_CONFIG.walkableMode || 'white-only')
  .trim()
  .toLowerCase();
const WHITE_THRESHOLD = Number.parseInt(
  process.env.WHITE_THRESHOLD || String(CANONICAL_ROUTE_CONFIG.whiteThreshold || '220'),
  10,
);
const ALPHA_THRESHOLD = Number.parseInt(
  process.env.ALPHA_THRESHOLD || String(CANONICAL_ROUTE_CONFIG.alphaThreshold || '1'),
  10,
);
const MAP_LOGIC_WIDTH = Number.parseInt(
  process.env.MAP_LOGIC_WIDTH || String(CANONICAL_ROUTE_CONFIG.mapLogicWidth || '1527'),
  10,
);
const MAP_LOGIC_HEIGHT = Number.parseInt(
  process.env.MAP_LOGIC_HEIGHT || String(CANONICAL_ROUTE_CONFIG.mapLogicHeight || '912'),
  10,
);
const SVG_DENSITY = Number.parseInt(
  process.env.MAP_LOGIC_DENSITY || String(CANONICAL_ROUTE_CONFIG.svgDensity || '288'),
  10,
);
const REFERENCE_MAP_SOURCE =
  process.env.MAP_REFERENCE_SOURCE || CANONICAL_ROUTE_CONFIG.referenceMapSource || '../src/assets/_originals/maps/mapa_geral.svg';
const LOGICAL_MAP_VECTOR_SOURCE =
  process.env.MAP_LOGIC_VECTOR_SOURCE || CANONICAL_ROUTE_CONFIG.logicalVectorSource || 'logica_nova.svg';
const LOGICAL_MAP_MASK_SOURCE =
  process.env.MAP_LOGIC_MASK_SOURCE || CANONICAL_ROUTE_CONFIG.logicalMaskSource || 'logica_nova.png';
const EVENT_BOUNDARY_IMAGE_POINTS = Array.isArray(CANONICAL_MAP_CONFIG?.eventBoundaryImagePoints)
  ? CANONICAL_MAP_CONFIG.eventBoundaryImagePoints
  : DEFAULT_EVENT_BOUNDARY_IMAGE_POINTS;

const SVG_VIEWBOX_PATTERN = /viewBox\s*=\s*['"]([^'"]+)['"]/i;
const SVG_WIDTH_PATTERN = /\swidth\s*=\s*['"]([^'"]+)['"]/i;
const SVG_HEIGHT_PATTERN = /\sheight\s*=\s*['"]([^'"]+)['"]/i;

const resolveFromScriptsDir = (targetPath) =>
  path.isAbsolute(targetPath) ? targetPath : path.resolve(__dirname, targetPath);

const normalizeSvgViewBox = (value) => value.trim().split(/\s+/).join(' ');

const parseSvgDimension = (value) => {
  const normalized = value.trim().replace(/px$/i, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const readSvgMetrics = (inputPath) => {
  const content = fs.readFileSync(inputPath, 'utf8');
  const viewBoxMatch = content.match(SVG_VIEWBOX_PATTERN);
  const widthMatch = content.match(SVG_WIDTH_PATTERN);
  const heightMatch = content.match(SVG_HEIGHT_PATTERN);

  return {
    viewBox: viewBoxMatch ? normalizeSvgViewBox(viewBoxMatch[1]) : null,
    width: widthMatch ? parseSvgDimension(widthMatch[1]) : null,
    height: heightMatch ? parseSvgDimension(heightMatch[1]) : null,
  };
};

const formatSvgMetrics = (metrics) =>
  `viewBox=${metrics.viewBox || 'n/d'} width=${metrics.width ?? 'n/d'} height=${metrics.height ?? 'n/d'}`;

const areNumbersEquivalent = (left, right, tolerance = 0.01) => {
  if (left == null || right == null) return true;
  return Math.abs(left - right) <= tolerance;
};

const assertOfficialSvgAlignment = (inputPath) => {
  const officialPath = REFERENCE_MAP_SOURCE ? resolveFromScriptsDir(REFERENCE_MAP_SOURCE) : null;
  if (!officialPath || !fs.existsSync(officialPath)) {
    if (officialPath) {
      console.warn(`Mapa de referencia nao encontrado para validacao: ${officialPath}`);
    }
    return;
  }

  const logicalMetrics = readSvgMetrics(inputPath);
  const officialMetrics = readSvgMetrics(officialPath);
  const sameViewBox =
    logicalMetrics.viewBox != null &&
    officialMetrics.viewBox != null &&
    logicalMetrics.viewBox === officialMetrics.viewBox;
  const sameWidth = areNumbersEquivalent(logicalMetrics.width, officialMetrics.width);
  const sameHeight = areNumbersEquivalent(logicalMetrics.height, officialMetrics.height);

  if (!sameViewBox || !sameWidth || !sameHeight) {
    throw new Error(
      [
        `\`${path.basename(LOGICAL_MAP_VECTOR_SOURCE)}\` precisa ter o mesmo encaixe do mapa de referencia.`,
        `Logico: ${formatSvgMetrics(logicalMetrics)}.`,
        `Oficial: ${formatSvgMetrics(officialMetrics)}.`,
      ].join(' '),
    );
  }

  console.log(
    `SVG logico alinhado com o mapa de referencia (${path.basename(officialPath)}): ${formatSvgMetrics(logicalMetrics)}`,
  );
};

const assertMaskAlignment = async (vectorPath, maskPath) => {
  if (!fs.existsSync(maskPath)) {
    console.warn(`Mascara raster nao encontrada em ${maskPath}. O grafo sera rasterizado direto do SVG.`);
    return false;
  }

  const vectorMetrics = readSvgMetrics(vectorPath);
  const maskMetadata = await sharp(maskPath).metadata();
  const vectorAspect =
    vectorMetrics.width != null && vectorMetrics.height != null ? vectorMetrics.width / vectorMetrics.height : null;
  const maskAspect =
    maskMetadata.width != null && maskMetadata.height != null ? maskMetadata.width / maskMetadata.height : null;

  if (vectorAspect != null && maskAspect != null && Math.abs(vectorAspect - maskAspect) > 0.001) {
    throw new Error(
      [
        `\`${path.basename(maskPath)}\` nao bate com a proporcao da logica vetorial.`,
        `SVG=${vectorMetrics.width}x${vectorMetrics.height}.`,
        `PNG=${maskMetadata.width}x${maskMetadata.height}.`,
      ].join(' '),
    );
  }

  console.log(
    `Mascara raster alinhada com o SVG logico: ${path.basename(maskPath)} (${maskMetadata.width}x${maskMetadata.height})`,
  );
  return true;
};

const resolveLogicalVectorPath = () => resolveFromScriptsDir(LOGICAL_MAP_VECTOR_SOURCE);
const resolveLogicalMaskPath = () => resolveFromScriptsDir(LOGICAL_MAP_MASK_SOURCE);

const validateVectorInputExtension = (inputPath) => {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext !== '.svg') {
    throw new Error(
      `Formato ${ext || '(sem extensao)'} nao suportado. O grafo oficial so pode ser validado pelo ${path.basename(LOGICAL_MAP_VECTOR_SOURCE)}.`,
    );
  }
};

const isWalkablePixel = (rgba) => {
  if (rgba.a <= ALPHA_THRESHOLD) return false;
  return Math.min(rgba.r, rgba.g, rgba.b) >= WHITE_THRESHOLD;
};

const buildGraphComponents = (graph) => {
  const componentByNodeId = new Map();
  const components = [];
  const visited = new Set();

  for (const startNodeId of Object.keys(graph)) {
    if (visited.has(startNodeId)) continue;

    const stack = [startNodeId];
    const nodes = [];
    visited.add(startNodeId);

    while (stack.length > 0) {
      const nodeId = stack.pop();
      nodes.push(nodeId);
      componentByNodeId.set(nodeId, components.length);

      for (const neighborId of graph[nodeId].neighbors || []) {
        if (!graph[neighborId] || visited.has(neighborId)) continue;
        visited.add(neighborId);
        stack.push(neighborId);
      }
    }

    components.push(nodes);
  }

  let primaryComponentId = 0;
  for (let index = 1; index < components.length; index += 1) {
    if (components[index].length > components[primaryComponentId].length) {
      primaryComponentId = index;
    }
  }

  return {
    componentByNodeId,
    components,
    primaryComponentId,
  };
};

const connectNearbyGraphIslands = (graph) => {
  if (
    !Number.isFinite(COMPONENT_BRIDGE_MAX_DISTANCE) ||
    COMPONENT_BRIDGE_MAX_DISTANCE <= 0 ||
    !Number.isFinite(COMPONENT_BRIDGE_MAX_SIZE) ||
    COMPONENT_BRIDGE_MAX_SIZE <= 0
  ) {
    return [];
  }

  const { componentByNodeId, components, primaryComponentId } = buildGraphComponents(graph);
  const primaryNodes = components[primaryComponentId].map((nodeId) => ({
    id: nodeId,
    x: graph[nodeId].x,
    y: graph[nodeId].y,
  }));
  const bridges = [];

  for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
    if (componentIndex === primaryComponentId) continue;

    const componentNodes = components[componentIndex];
    if (componentNodes.length > COMPONENT_BRIDGE_MAX_SIZE) continue;

    let bestBridge = null;

    for (const nodeId of componentNodes) {
      const node = graph[nodeId];

      for (const primaryNode of primaryNodes) {
        const distance = Math.hypot(primaryNode.x - node.x, primaryNode.y - node.y);
        if (!bestBridge || distance < bestBridge.distance) {
          bestBridge = {
            fromId: nodeId,
            toId: primaryNode.id,
            distance,
            componentSize: componentNodes.length,
          };
        }
      }
    }

    if (!bestBridge || bestBridge.distance > COMPONENT_BRIDGE_MAX_DISTANCE) {
      continue;
    }

    if (!graph[bestBridge.fromId].neighbors.includes(bestBridge.toId)) {
      graph[bestBridge.fromId].neighbors.push(bestBridge.toId);
    }
    if (!graph[bestBridge.toId].neighbors.includes(bestBridge.fromId)) {
      graph[bestBridge.toId].neighbors.push(bestBridge.fromId);
    }

    bridges.push(bestBridge);
  }

  return bridges;
};

const isPointInsidePolygon = (point, polygon) => {
  let isInside = false;

  for (
    let currentIndex = 0, previousIndex = polygon.length - 1;
    currentIndex < polygon.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const currentPoint = polygon[currentIndex];
    const previousPoint = polygon[previousIndex];

    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          ((previousPoint.y - currentPoint.y) || Number.EPSILON) +
          currentPoint.x;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
};

const ensureNormalizedDimensions = () => {
  if (
    !Number.isFinite(MAP_LOGIC_WIDTH) ||
    MAP_LOGIC_WIDTH <= 0 ||
    !Number.isFinite(MAP_LOGIC_HEIGHT) ||
    MAP_LOGIC_HEIGHT <= 0
  ) {
    throw new Error('MAP_LOGIC_WIDTH e MAP_LOGIC_HEIGHT precisam ser inteiros positivos.');
  }
};

const createNormalizedRasterBuffer = async (inputPath, isSvgSource) => {
  ensureNormalizedDimensions();

  const scaledWidth = Math.max(1, Math.round(MAP_LOGIC_WIDTH * LOGICAL_ALIGNMENT_SCALE_X));
  const scaledHeight = Math.max(1, Math.round(MAP_LOGIC_HEIGHT * LOGICAL_ALIGNMENT_SCALE_Y));
  const alignedOffsetX = Math.round(LOGICAL_ALIGNMENT_OFFSET_X);
  const alignedOffsetY = Math.round(LOGICAL_ALIGNMENT_OFFSET_Y);

  const transformedBuffer = await sharp(inputPath, isSvgSource ? { density: SVG_DENSITY } : undefined)
    .resize(scaledWidth, scaledHeight, { fit: 'fill' })
    .ensureAlpha()
    .png()
    .toBuffer();

  const sourceLeft = Math.max(0, -alignedOffsetX);
  const sourceTop = Math.max(0, -alignedOffsetY);
  const destinationLeft = Math.max(0, alignedOffsetX);
  const destinationTop = Math.max(0, alignedOffsetY);
  const visibleWidth = Math.min(scaledWidth - sourceLeft, MAP_LOGIC_WIDTH - destinationLeft);
  const visibleHeight = Math.min(scaledHeight - sourceTop, MAP_LOGIC_HEIGHT - destinationTop);

  if (visibleWidth <= 0 || visibleHeight <= 0) {
    throw new Error(
      [
        'O alinhamento da logica_nova deixou a malha totalmente fora da area util.',
        `offsetX=${LOGICAL_ALIGNMENT_OFFSET_X}`,
        `offsetY=${LOGICAL_ALIGNMENT_OFFSET_Y}`,
        `scaleX=${LOGICAL_ALIGNMENT_SCALE_X}`,
        `scaleY=${LOGICAL_ALIGNMENT_SCALE_Y}`,
      ].join(' '),
    );
  }

  const croppedTransformedBuffer = await sharp(transformedBuffer)
    .extract({
      left: sourceLeft,
      top: sourceTop,
      width: visibleWidth,
      height: visibleHeight,
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: MAP_LOGIC_WIDTH,
      height: MAP_LOGIC_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([
      {
        input: croppedTransformedBuffer,
        left: destinationLeft,
        top: destinationTop,
      },
    ])
    .flatten({ background: '#000000' })
    .png()
    .toBuffer();
};

const loadNormalizedImage = async (maskPath, vectorPath) => {
  const useRasterMask = fs.existsSync(maskPath);
  const inputPath = useRasterMask ? maskPath : vectorPath;
  const rasterBuffer = await createNormalizedRasterBuffer(inputPath, !useRasterMask);
  const image = await Jimp.read(rasterBuffer);

  return {
    image,
    sourceLabel: useRasterMask ? path.basename(maskPath) : path.basename(vectorPath),
  };
};

async function generateGraph() {
  const vectorPath = resolveLogicalVectorPath();
  const maskPath = resolveLogicalMaskPath();
  const outputPath = resolveFromScriptsDir(OUTPUT_FILE);

  if (!Number.isFinite(GRID_SIZE) || GRID_SIZE <= 0) {
    throw new Error('GRID_SIZE precisa ser um inteiro positivo.');
  }

  validateVectorInputExtension(vectorPath);

  if (!fs.existsSync(vectorPath)) {
    throw new Error(`Arquivo de entrada nao encontrado: ${vectorPath}`);
  }

  assertOfficialSvgAlignment(vectorPath);
  await assertMaskAlignment(vectorPath, maskPath);

  const { image: logicalImage, sourceLabel } = await loadNormalizedImage(maskPath, vectorPath);
  const width = logicalImage.bitmap.width;
  const height = logicalImage.bitmap.height;

  console.log(`Lendo logica_nova: ${vectorPath}`);
  console.log(
    [
      `Mascara navegavel: ${sourceLabel}`,
      `Modo caminhavel: ${WALKABLE_MODE}`,
      `andar somente em branco>=${WHITE_THRESHOLD}`,
      `ignorar preto/escuro e qualquer cor intermediaria`,
      `grid: ${GRID_SIZE}px`,
      `alinhamento: offsetX=${LOGICAL_ALIGNMENT_OFFSET_X}, offsetY=${LOGICAL_ALIGNMENT_OFFSET_Y}, scaleX=${LOGICAL_ALIGNMENT_SCALE_X}, scaleY=${LOGICAL_ALIGNMENT_SCALE_Y}`,
    ].join(' | '),
  );
  console.log(`Dimensoes da imagem normalizada: ${width}x${height}`);

  const graph = {};
  const nodes = [];

  for (let y = 0; y < height; y += GRID_SIZE) {
    for (let x = 0; x < width; x += GRID_SIZE) {
      if (!isPointInsidePolygon({ x, y }, EVENT_BOUNDARY_IMAGE_POINTS)) continue;
      const pixelColor = logicalImage.getPixelColor(x, y);
      const rgba = Jimp.intToRGBA(pixelColor);
      if (!isWalkablePixel(rgba)) continue;

      const id = `${x}_${y}`;
      graph[id] = { x, y, neighbors: [] };
      nodes.push({ id, x, y });
    }
  }

  console.log(`Nos caminhaveis: ${nodes.length}`);
  console.log('Criando conexoes...');

  nodes.forEach((node) => {
    const { x, y, id } = node;
    const candidates = [
      { id: `${x + GRID_SIZE}_${y}`, dx: GRID_SIZE, dy: 0 },
      { id: `${x - GRID_SIZE}_${y}`, dx: -GRID_SIZE, dy: 0 },
      { id: `${x}_${y + GRID_SIZE}`, dx: 0, dy: GRID_SIZE },
      { id: `${x}_${y - GRID_SIZE}`, dx: 0, dy: -GRID_SIZE },
      { id: `${x + GRID_SIZE}_${y + GRID_SIZE}`, dx: GRID_SIZE, dy: GRID_SIZE },
      { id: `${x + GRID_SIZE}_${y - GRID_SIZE}`, dx: GRID_SIZE, dy: -GRID_SIZE },
      { id: `${x - GRID_SIZE}_${y + GRID_SIZE}`, dx: -GRID_SIZE, dy: GRID_SIZE },
      { id: `${x - GRID_SIZE}_${y - GRID_SIZE}`, dx: -GRID_SIZE, dy: -GRID_SIZE },
    ];

    candidates.forEach(({ id: neighborId, dx, dy }) => {
      if (graph[neighborId]) {
        const isDiagonal = dx !== 0 && dy !== 0;
        if (isDiagonal) {
          const horizontalNeighborId = `${x + dx}_${y}`;
          const verticalNeighborId = `${x}_${y + dy}`;
          if (!graph[horizontalNeighborId] || !graph[verticalNeighborId]) {
            return;
          }
        }
        graph[id].neighbors.push(neighborId);
      }
    });
  });

  const islandBridges = connectNearbyGraphIslands(graph);
  if (islandBridges.length > 0) {
    console.log(
      [
        `Microilhas conectadas: ${islandBridges.length}`,
        ...islandBridges.map(
          (bridge) =>
            `${bridge.fromId}->${bridge.toId} (${bridge.distance.toFixed(2)}px, componente=${bridge.componentSize})`,
        ),
      ].join(' | '),
    );
  }

  fs.writeFileSync(outputPath, JSON.stringify(graph));
  console.log(`Grafo salvo em: ${outputPath}`);
}

generateGraph().catch((error) => {
  console.error('Erro ao gerar navGraph:', error.message);
  process.exitCode = 1;
});
