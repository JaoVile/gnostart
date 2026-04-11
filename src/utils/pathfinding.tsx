import rawGraph from '../data/navGraph.json';
import { MAP_PIXEL_HEIGHT, MAP_PIXEL_WIDTH } from '../config/mapConfig';

type GraphNode = {
  x: number;
  y: number;
  neighbors: string[];
};

type Graph = Record<string, GraphNode>;

export type GraphNodeCandidate = {
  id: string;
  x: number;
  y: number;
  distance: number;
};

const getGraphBounds = (source: Graph) => {
  const nodes = Object.values(source);
  if (nodes.length === 0) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };
  }

  return {
    minX: nodes.reduce((acc, node) => Math.min(acc, node.x), Number.POSITIVE_INFINITY),
    maxX: nodes.reduce((acc, node) => Math.max(acc, node.x), Number.NEGATIVE_INFINITY),
    minY: nodes.reduce((acc, node) => Math.min(acc, node.y), Number.POSITIVE_INFINITY),
    maxY: nodes.reduce((acc, node) => Math.max(acc, node.y), Number.NEGATIVE_INFINITY),
  };
};

const normalizeGraph = (source: Graph): Graph => {
  const bounds = getGraphBounds(source);
  const isWithinLogicalMapBounds =
    bounds.minX >= 0 &&
    bounds.minY >= 0 &&
    bounds.maxX <= MAP_PIXEL_WIDTH &&
    bounds.maxY <= MAP_PIXEL_HEIGHT;

  if (!isWithinLogicalMapBounds) {
    console.warn(
      [
        'navGraph fora da grade logica esperada.',
        `bounds=(${bounds.minX}, ${bounds.minY})-(${bounds.maxX}, ${bounds.maxY})`,
        `map=${MAP_PIXEL_WIDTH}x${MAP_PIXEL_HEIGHT}`,
      ].join(' '),
    );
  }

  return source;
};

const graph = normalizeGraph(rawGraph as unknown as Graph);

const buildGraphComponents = (source: Graph) => {
  const componentByNodeId: Record<string, number> = {};
  const componentSizes: number[] = [];
  const visited = new Set<string>();
  let componentIndex = 0;

  for (const startNodeId in source) {
    if (visited.has(startNodeId)) continue;

    const stack = [startNodeId];
    visited.add(startNodeId);
    let size = 0;

    while (stack.length > 0) {
      const currentNodeId = stack.pop()!;
      componentByNodeId[currentNodeId] = componentIndex;
      size += 1;

      for (const neighborId of source[currentNodeId].neighbors || []) {
        if (!source[neighborId] || visited.has(neighborId)) continue;
        visited.add(neighborId);
        stack.push(neighborId);
      }
    }

    componentSizes[componentIndex] = size;
    componentIndex += 1;
  }

  const primaryComponentId = componentSizes.reduce(
    (bestIndex, size, index, sizes) => (size > (sizes[bestIndex] ?? 0) ? index : bestIndex),
    0,
  );

  return {
    componentByNodeId,
    componentSizes,
    primaryComponentId,
  };
};

const graphComponents = buildGraphComponents(graph);

const isPrimaryRouteNode = (nodeId: string) => graphComponents.componentByNodeId[nodeId] === graphComponents.primaryComponentId;

const dedupePath = (path: number[][]) =>
  path.filter((point, index) => index === 0 || point[0] !== path[index - 1][0] || point[1] !== path[index - 1][1]);

const getGraphGridStep = (source: Graph) => {
  let step = Number.POSITIVE_INFINITY;

  for (const nodeId in source) {
    const node = source[nodeId];
    for (const neighborId of node.neighbors || []) {
      const neighbor = source[neighborId];
      if (!neighbor) continue;
      const deltaX = Math.abs(neighbor.x - node.x);
      const deltaY = Math.abs(neighbor.y - node.y);
      if (deltaX > 0) step = Math.min(step, deltaX);
      if (deltaY > 0) step = Math.min(step, deltaY);
    }
  }

  return Number.isFinite(step) && step > 0 ? step : 1;
};

const graphGridStep = getGraphGridStep(graph);
const ROUTE_NODE_LOCK_DISTANCE = Math.max(8, graphGridStep * 2);
const ROUTE_NODE_DISTANCE_TOLERANCE = Math.max(4, graphGridStep);

const getTraversalCost = (nodeA: string, nodeB: string): number => {
  const a = graph[nodeA];
  const b = graph[nodeB];
  if (!a || !b) return 1;
  return Math.hypot(a.x - b.x, a.y - b.y);
};

const heuristic = (nodeA: string, nodeB: string): number => {
  const a = graph[nodeA];
  const b = graph[nodeB];
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
};

const roundToGrid = (value: number) => Math.round(value / graphGridStep) * graphGridStep;

const isWalkableGraphPoint = (x: number, y: number) => Boolean(graph[`${roundToGrid(x)}_${roundToGrid(y)}`]);

const hasLineOfSight = (from: number[], to: number[]) => {
  const fromX = from[1];
  const fromY = from[0];
  const toX = to[1];
  const toY = to[0];
  const deltaX = toX - fromX;
  const deltaY = toY - fromY;
  const distance = Math.hypot(deltaX, deltaY);
  const steps = Math.max(1, Math.ceil(distance / graphGridStep));

  for (let stepIndex = 0; stepIndex <= steps; stepIndex += 1) {
    const t = stepIndex / steps;
    const sampleX = fromX + deltaX * t;
    const sampleY = fromY + deltaY * t;
    if (!isWalkableGraphPoint(sampleX, sampleY)) {
      return false;
    }
  }

  return true;
};

const smoothPath = (path: number[][]) => {
  if (path.length <= 2) return dedupePath(path);

  const simplifiedPath: number[][] = [path[0]];
  let anchorIndex = 0;

  while (anchorIndex < path.length - 1) {
    let nextIndex = anchorIndex + 1;

    while (nextIndex + 1 < path.length && hasLineOfSight(path[anchorIndex], path[nextIndex + 1])) {
      nextIndex += 1;
    }

    simplifiedPath.push(path[nextIndex]);
    anchorIndex = nextIndex;
  }

  return dedupePath(simplifiedPath);
};

export const getNodePosition = (nodeId: string): { x: number; y: number } | null => {
  const node = graph[nodeId];
  if (!node) return null;
  return { x: node.x, y: node.y };
};

export const findNearestNodes = (x: number, y: number, maxDistance = 50, limit = 12): GraphNodeCandidate[] => {
  const candidates: GraphNodeCandidate[] = [];
  for (const id in graph) {
    const node = graph[id];
    const dist = Math.hypot(node.x - x, node.y - y);

    if (dist <= maxDistance) {
      candidates.push({
        id,
        x: node.x,
        y: node.y,
        distance: dist,
      });
    }
  }

  candidates.sort((left, right) => left.distance - right.distance);
  return candidates.slice(0, Math.max(1, limit));
};

export const getNearestNodeCandidate = (x: number, y: number, maxDistance = 50): GraphNodeCandidate | null =>
  findNearestNodes(x, y, maxDistance, 1)[0] ?? null;

export const findNearestNode = (x: number, y: number, maxDistance = 50): string | null => {
  const nearestCandidate = getNearestNodeCandidate(x, y, maxDistance);
  return nearestCandidate?.id ?? null;
};

export const isRoutableNodeId = (nodeId: string | null | undefined): nodeId is string =>
  typeof nodeId === 'string' && Boolean(graph[nodeId]) && isPrimaryRouteNode(nodeId);

export const findNearestRoutableNodes = (
  x: number,
  y: number,
  maxDistance = Number.POSITIVE_INFINITY,
  limit = 12,
): GraphNodeCandidate[] => {
  const candidates: GraphNodeCandidate[] = [];

  for (const id in graph) {
    if (!isPrimaryRouteNode(id)) continue;

    const node = graph[id];
    const dist = Math.hypot(node.x - x, node.y - y);
    if (dist > maxDistance) continue;

    candidates.push({
      id,
      x: node.x,
      y: node.y,
      distance: dist,
    });
  }

  candidates.sort((left, right) => left.distance - right.distance);
  return candidates.slice(0, Math.max(1, limit));
};

export const getNearestRoutableNodeCandidate = (
  x: number,
  y: number,
  maxDistance = Number.POSITIVE_INFINITY,
): GraphNodeCandidate | null => findNearestRoutableNodes(x, y, maxDistance, 1)[0] ?? null;

export const findNearestRoutableNode = (
  x: number,
  y: number,
  maxDistance = Number.POSITIVE_INFINITY,
): string | null => getNearestRoutableNodeCandidate(x, y, maxDistance)?.id ?? null;

export const resolveRoutableNodeId = (
  x: number,
  y: number,
  preferredNodeId?: string | null,
  preferredNodeMaxDistance = 120,
  maxSnapDistance = 120,
): string | null => {
  const nearestCandidate = getNearestRoutableNodeCandidate(x, y, maxSnapDistance);

  if (!isRoutableNodeId(preferredNodeId)) {
    return nearestCandidate?.id ?? null;
  }

  const preferredNode = graph[preferredNodeId];
  const preferredDistance = Math.hypot(preferredNode.x - x, preferredNode.y - y);

  if (preferredDistance > preferredNodeMaxDistance) {
    return nearestCandidate?.id ?? null;
  }

  if (!nearestCandidate || nearestCandidate.id === preferredNodeId) {
    return preferredNodeId;
  }

  // Mantemos o no preferido apenas quando ele continua efetivamente preso
  // ao pin atual. Se existir um corredor claramente mais perto, priorizamos
  // o snap novo para evitar rotas herdando ancoras antigas.
  if (preferredDistance <= ROUTE_NODE_LOCK_DISTANCE) {
    return preferredNodeId;
  }

  if (preferredDistance <= nearestCandidate.distance + ROUTE_NODE_DISTANCE_TOLERANCE) {
    return preferredNodeId;
  }

  return nearestCandidate.id;
};

export const findPath = (startId: string, endId: string) => {
  if (!graph[startId] || !graph[endId]) {
    console.error('Nós de origem ou destino inválidos para o traçado da rota.');
    return null;
  }

  const openSet = new Set<string>([startId]);
  const cameFrom: Record<string, string> = {};
  const gScore: Record<string, number> = { [startId]: 0 };
  const fScore: Record<string, number> = { [startId]: heuristic(startId, endId) };

  const getLowestF = () => {
    let lowestNode: string | null = null;
    let lowestVal = Infinity;

    openSet.forEach((node) => {
      const score = fScore[node] ?? Infinity;
      if (score < lowestVal) {
        lowestVal = score;
        lowestNode = node;
      }
    });

    return lowestNode;
  };

  while (openSet.size > 0) {
    const current = getLowestF();

    if (!current) break;
    if (current === endId) {
      return reconstructPath(cameFrom, current);
    }

    openSet.delete(current);

    const neighbors = graph[current].neighbors || [];
    for (const neighbor of neighbors) {
      const tentativeGScore = (gScore[current] ?? Infinity) + getTraversalCost(current, neighbor);

      if (tentativeGScore < (gScore[neighbor] ?? Infinity)) {
        cameFrom[neighbor] = current;
        gScore[neighbor] = tentativeGScore;
        fScore[neighbor] = tentativeGScore + heuristic(neighbor, endId);

        if (!openSet.has(neighbor)) {
          openSet.add(neighbor);
        }
      }
    }
  }

  return null;
};

export const findPathBetweenPoints = (
  start: { x: number; y: number },
  end: { x: number; y: number },
  options?: {
    preferredStartNodeId?: string | null;
    preferredEndNodeId?: string | null;
    preferredNodeMaxDistance?: number;
    nodeSnapMaxDistance?: number;
  },
) => {
  const preferredNodeMaxDistance = options?.preferredNodeMaxDistance ?? 120;
  const nodeSnapMaxDistance = options?.nodeSnapMaxDistance ?? preferredNodeMaxDistance;
  const startNodeId = resolveRoutableNodeId(
    start.x,
    start.y,
    options?.preferredStartNodeId,
    preferredNodeMaxDistance,
    nodeSnapMaxDistance,
  );
  const endNodeId = resolveRoutableNodeId(
    end.x,
    end.y,
    options?.preferredEndNodeId,
    preferredNodeMaxDistance,
    nodeSnapMaxDistance,
  );

  if (!startNodeId || !endNodeId) {
    return {
      startNodeId,
      endNodeId,
      path: null as number[][] | null,
    };
  }

  // Estende a rota para comecar/terminar exatamente no pino solicitado,
  // em vez de parar no no de corredor mais proximo (que pode estar a
  // varios pixels de distancia, deixando a linha desenhada curta).
  const startPoint: number[] = [start.y, start.x];
  const endPoint: number[] = [end.y, end.x];

  const attachEndpoints = (nodePath: number[][] | null): number[][] | null => {
    if (!nodePath || nodePath.length === 0) return nodePath;
    const extended = [...nodePath];
    const firstNode = extended[0];
    if (firstNode[0] !== startPoint[0] || firstNode[1] !== startPoint[1]) {
      extended.unshift(startPoint);
    }
    const lastNode = extended[extended.length - 1];
    if (lastNode[0] !== endPoint[0] || lastNode[1] !== endPoint[1]) {
      extended.push(endPoint);
    }
    return dedupePath(extended);
  };

  if (startNodeId === endNodeId) {
    const node = graph[startNodeId];
    return {
      startNodeId,
      endNodeId,
      path: attachEndpoints([[node.y, node.x]]),
    };
  }

  return {
    startNodeId,
    endNodeId,
    path: attachEndpoints(findPath(startNodeId, endNodeId)),
  };
};

export const buildDirectPath = (
  start: { x: number; y: number },
  end: { x: number; y: number },
): number[][] => {
  const startPoint: number[] = [Math.round(start.y), Math.round(start.x)];
  const endPoint: number[] = [Math.round(end.y), Math.round(end.x)];

  if (startPoint[0] === endPoint[0] && startPoint[1] === endPoint[1]) {
    return [startPoint];
  }

  return [startPoint, endPoint];
};

export const centerPathToCorridors = (path: number[][]): number[][] => {
  if (path.length <= 2) return dedupePath(path);

  // A tentativa de "centralizar" a rota dentro do corredor estava empurrando
  // varios trechos para fora da area livre da logica_nova. Aqui a rota permanece
  // exatamente na malha caminhavel e so suavizamos quando existe linha de
  // visao entre os pontos.
  return smoothPath(path);
};

const reconstructPath = (cameFrom: Record<string, string>, current: string) => {
  const path: number[][] = [];
  let temp = current;

  while (temp) {
    const node = graph[temp];
    path.push([node.y, node.x]);
    temp = cameFrom[temp];
  }

  return smoothPath(path.reverse());
};
