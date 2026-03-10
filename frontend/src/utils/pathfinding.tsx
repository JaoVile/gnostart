import rawGraph from '../data/navGraph.json';
import { COORDINATE_SCALE_X, COORDINATE_SCALE_Y } from '../config/mapConfig';

type GraphNode = {
  x: number;
  y: number;
  neighbors: string[];
};

type Graph = Record<string, GraphNode>;

const scaleGraph = (source: Graph): Graph => {
  const result: Graph = {};

  Object.entries(source).forEach(([id, node]) => {
    result[id] = {
      x: Math.round(node.x * COORDINATE_SCALE_X),
      y: Math.round(node.y * COORDINATE_SCALE_Y),
      neighbors: node.neighbors,
    };
  });

  return result;
};

const graph = scaleGraph(rawGraph as unknown as Graph);

const heuristic = (nodeA: string, nodeB: string): number => {
  const a = graph[nodeA];
  const b = graph[nodeB];
  if (!a || !b) return 0;
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
};

export const findNearestNode = (x: number, y: number, maxDistance = 50): string | null => {
  let nearestId: string | null = null;
  let minDist = Infinity;

  for (const id in graph) {
    const node = graph[id];
    const dist = Math.hypot(node.x - x, node.y - y);

    if (dist < maxDistance && dist < minDist) {
      minDist = dist;
      nearestId = id;
    }
  }

  return nearestId;
};

export const findPath = (startId: string, endId: string) => {
  if (!graph[startId] || !graph[endId]) {
    console.error('Nos de origem ou destino invalidos.');
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
      const tentativeGScore = (gScore[current] ?? Infinity) + 1;

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

const reconstructPath = (cameFrom: Record<string, string>, current: string) => {
  const path: number[][] = [];
  let temp = current;

  while (temp) {
    const node = graph[temp];
    path.push([node.y, node.x]);
    temp = cameFrom[temp];
  }

  return path.reverse();
};
