import L from 'leaflet';
import {
  EVENT_BOUNDARY_IMAGE_POINTS,
  EVENT_LOCATION_REFERENCE_POINTS,
  MAP_CENTER,
  MAP_OVERLAY_EAST,
  MAP_OVERLAY_NORTH,
  MAP_OVERLAY_SOUTH,
  MAP_OVERLAY_WEST,
  MAP_PIXEL_HEIGHT,
  MAP_PIXEL_WIDTH,
  OFFICIAL_MAP_DRAG_PADDING_RATIO,
} from '../../../config/mapConfig';
import type { ImagePoint } from '../types';

export const MAP_WIDTH = MAP_PIXEL_WIDTH;
export const MAP_HEIGHT = MAP_PIXEL_HEIGHT;
export const MANUAL_GPS_OFFSET_STORAGE_KEY = 'gnostart.manualGpsOffset';

export type ManualGpsOffset = {
  x: number;
  y: number;
  latOffset: number;
  lngOffset: number;
};

const DEFAULT_MANUAL_GPS_OFFSET: ManualGpsOffset = {
  x: 0,
  y: 0,
  latOffset: 0,
  lngOffset: 0,
};

const sanitizeManualGpsOffset = (value: unknown): ManualGpsOffset => {
  if (!value || typeof value !== 'object') return DEFAULT_MANUAL_GPS_OFFSET;

  const candidate = value as Partial<ManualGpsOffset>;
  const pickNumber = (input: unknown) => (typeof input === 'number' && Number.isFinite(input) ? input : 0);

  return {
    x: pickNumber(candidate.x),
    y: pickNumber(candidate.y),
    latOffset: pickNumber(candidate.latOffset),
    lngOffset: pickNumber(candidate.lngOffset),
  };
};

export const readManualGpsOffset = (): ManualGpsOffset => {
  if (typeof window === 'undefined') return DEFAULT_MANUAL_GPS_OFFSET;

  try {
    const rawValue = window.localStorage.getItem(MANUAL_GPS_OFFSET_STORAGE_KEY);
    if (!rawValue) return DEFAULT_MANUAL_GPS_OFFSET;
    return sanitizeManualGpsOffset(JSON.parse(rawValue));
  } catch {
    return DEFAULT_MANUAL_GPS_OFFSET;
  }
};

export const writeManualGpsOffset = (value: Partial<ManualGpsOffset>) => {
  if (typeof window === 'undefined') return DEFAULT_MANUAL_GPS_OFFSET;

  const nextOffset = sanitizeManualGpsOffset({
    ...readManualGpsOffset(),
    ...value,
  });
  window.localStorage.setItem(MANUAL_GPS_OFFSET_STORAGE_KEY, JSON.stringify(nextOffset));
  return nextOffset;
};

export const clearManualGpsOffset = () => {
  if (typeof window === 'undefined') return DEFAULT_MANUAL_GPS_OFFSET;
  window.localStorage.removeItem(MANUAL_GPS_OFFSET_STORAGE_KEY);
  return DEFAULT_MANUAL_GPS_OFFSET;
};

export const mapOverlayBounds = new L.LatLngBounds(
  [MAP_OVERLAY_SOUTH, MAP_OVERLAY_WEST],
  [MAP_OVERLAY_NORTH, MAP_OVERLAY_EAST],
);
export const mapViewportBounds = mapOverlayBounds.pad(OFFICIAL_MAP_DRAG_PADDING_RATIO);

const LIVE_LOCATION_REFERENCE_NEIGHBOR_COUNT = 6;
const LIVE_LOCATION_REFERENCE_MIN_DISTANCE_PX = 18;

export const imageToLatLng = (x: number, y: number): [number, number] => {
  const latSpan = MAP_OVERLAY_NORTH - MAP_OVERLAY_SOUTH;
  const lngSpan = MAP_OVERLAY_EAST - MAP_OVERLAY_WEST;
  const lat = MAP_OVERLAY_NORTH - (y / MAP_HEIGHT) * latSpan;
  const lng = MAP_OVERLAY_WEST + (x / MAP_WIDTH) * lngSpan;
  return [lat, lng];
};

const projectLatLngToImageBase = (lat: number, lng: number): { x: number; y: number } => {
  const latSpan = MAP_OVERLAY_NORTH - MAP_OVERLAY_SOUTH;
  const lngSpan = MAP_OVERLAY_EAST - MAP_OVERLAY_WEST;
  const xRatio = (lng - MAP_OVERLAY_WEST) / lngSpan;
  const yRatio = (MAP_OVERLAY_NORTH - lat) / latSpan;

  return {
    x: xRatio * MAP_WIDTH,
    y: yRatio * MAP_HEIGHT,
  };
};

const liveLocationProjectionResiduals = EVENT_LOCATION_REFERENCE_POINTS.map((point) => {
  const projected = projectLatLngToImageBase(point.lat, point.lng);
  return {
    rawX: projected.x,
    rawY: projected.y,
    offsetX: point.x - projected.x,
    offsetY: point.y - projected.y,
  };
});

const getLiveLocationProjectionCorrection = (x: number, y: number) => {
  const nearestResiduals = [...liveLocationProjectionResiduals]
    .map((point) => ({
      ...point,
      distance: Math.hypot(point.rawX - x, point.rawY - y),
    }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, LIVE_LOCATION_REFERENCE_NEIGHBOR_COUNT);

  if (nearestResiduals.length === 0) {
    return { offsetX: 0, offsetY: 0 };
  }

  if (nearestResiduals[0].distance < 0.0001) {
    return {
      offsetX: nearestResiduals[0].offsetX,
      offsetY: nearestResiduals[0].offsetY,
    };
  }

  let weightedOffsetX = 0;
  let weightedOffsetY = 0;
  let totalWeight = 0;

  nearestResiduals.forEach((point) => {
    const normalizedDistance = Math.max(point.distance, LIVE_LOCATION_REFERENCE_MIN_DISTANCE_PX);
    const weight = 1 / (normalizedDistance * normalizedDistance);
    weightedOffsetX += point.offsetX * weight;
    weightedOffsetY += point.offsetY * weight;
    totalWeight += weight;
  });

  if (totalWeight <= Number.EPSILON) {
    return { offsetX: 0, offsetY: 0 };
  }

  return {
    offsetX: weightedOffsetX / totalWeight,
    offsetY: weightedOffsetY / totalWeight,
  };
};

const clampImagePointToMap = (point: { x: number; y: number }) => ({
  x: Math.max(0, Math.min(MAP_WIDTH, point.x)),
  y: Math.max(0, Math.min(MAP_HEIGHT, point.y)),
});

export const projectLatLngToImageOverlay = (lat: number, lng: number, clampToMap = true): { x: number; y: number } => {
  const basePoint = projectLatLngToImageBase(lat, lng);
  return clampToMap ? clampImagePointToMap(basePoint) : basePoint;
};

export const projectLatLngToImageGps = (lat: number, lng: number, clampToMap = true): { x: number; y: number } => {
  const manualOffset = readManualGpsOffset();
  const basePoint = projectLatLngToImageBase(lat + manualOffset.latOffset, lng + manualOffset.lngOffset);
  const correction = getLiveLocationProjectionCorrection(basePoint.x, basePoint.y);
  const x = basePoint.x + correction.offsetX + manualOffset.x;
  const y = basePoint.y + correction.offsetY + manualOffset.y;

  if (!clampToMap) {
    return { x, y };
  }

  return clampImagePointToMap({ x, y });
};

export const latLngToImageOverlay = (lat: number, lng: number) => projectLatLngToImageOverlay(lat, lng, true);
export const latLngToImageRaw = (lat: number, lng: number) => projectLatLngToImageGps(lat, lng, false);
export const eventBoundaryLatLngPoints = EVENT_BOUNDARY_IMAGE_POINTS.map((point) => imageToLatLng(point.x, point.y));

export const getImagePointDistance = (from: ImagePoint, to: ImagePoint) => Math.hypot(from.x - to.x, from.y - to.y);

export const isPointInsidePolygon = (point: ImagePoint, polygon: ImagePoint[]) => {
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

export const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getClosestPointOnSegment = (point: ImagePoint, segmentStart: ImagePoint, segmentEnd: ImagePoint) => {
  const deltaX = segmentEnd.x - segmentStart.x;
  const deltaY = segmentEnd.y - segmentStart.y;
  const segmentLengthSquared = deltaX ** 2 + deltaY ** 2;

  if (segmentLengthSquared <= Number.EPSILON) {
    return { x: segmentStart.x, y: segmentStart.y };
  }

  const projection =
    ((point.x - segmentStart.x) * deltaX + (point.y - segmentStart.y) * deltaY) / segmentLengthSquared;
  const t = clampNumber(projection, 0, 1);

  return {
    x: segmentStart.x + deltaX * t,
    y: segmentStart.y + deltaY * t,
  };
};

const getPointToSegmentDistance = (point: ImagePoint, segmentStart: ImagePoint, segmentEnd: ImagePoint) => {
  const projectedPoint = getClosestPointOnSegment(point, segmentStart, segmentEnd);
  return getImagePointDistance(point, projectedPoint);
};

export const getDistanceToPolygonEdges = (point: ImagePoint, polygon: ImagePoint[]) => {
  if (polygon.length === 0) return Infinity;

  let nearestDistance = Infinity;
  for (let currentIndex = 0; currentIndex < polygon.length; currentIndex += 1) {
    const nextIndex = (currentIndex + 1) % polygon.length;
    const distance = getPointToSegmentDistance(point, polygon[currentIndex], polygon[nextIndex]);
    if (distance < nearestDistance) nearestDistance = distance;
  }

  return nearestDistance;
};

export const getClosestPointOnPolygonEdges = (point: ImagePoint, polygon: ImagePoint[]) => {
  if (polygon.length === 0) return null;

  let nearestPoint: ImagePoint | null = null;
  let nearestDistance = Infinity;

  for (let currentIndex = 0; currentIndex < polygon.length; currentIndex += 1) {
    const nextIndex = (currentIndex + 1) % polygon.length;
    const projectedPoint = getClosestPointOnSegment(point, polygon[currentIndex], polygon[nextIndex]);
    const distance = getImagePointDistance(point, projectedPoint);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPoint = projectedPoint;
    }
  }

  return nearestPoint;
};

export const formatClockTimeLabel = (timestamp: number) =>
  new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp);

export const mapGeolocationErrorMessage = (error: GeolocationPositionError) => {
  if (error.code === error.PERMISSION_DENIED) {
    return 'A permissao de localizacao foi negada. Libere o GPS no navegador para usar a origem automatica.';
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'Nao conseguimos ler sua posicao agora. Confira o GPS do celular e tente novamente.';
  }

  if (error.code === error.TIMEOUT) {
    return 'O GPS demorou mais do que o esperado para responder. Tente novamente em um local aberto.';
  }

  return 'Nao foi possivel iniciar a localizacao em tempo real.';
};

export const isGeolocationSecureContext = () => {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
};

export const getGeolocationSecureContextMessage = () =>
  'A localizacao em tempo real exige conexao segura. Abra o mapa pelo dominio oficial com HTTPS para usar o GPS.';

const toRadians = (value: number) => (value * Math.PI) / 180;

export const getLatLngDistanceMeters = (from: [number, number], to: [number, number]) => {
  const earthRadius = 6371000;
  const [fromLat, fromLng] = from;
  const [toLat, toLng] = to;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const haversine = sinLat ** 2 + Math.cos(lat1) * Math.cos(lat2) * sinLng ** 2;
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadius * centralAngle;
};

const MAP_OVERLAY_WIDTH_METERS = getLatLngDistanceMeters(
  [MAP_CENTER[0], MAP_OVERLAY_WEST],
  [MAP_CENTER[0], MAP_OVERLAY_EAST],
);
const MAP_OVERLAY_HEIGHT_METERS = getLatLngDistanceMeters(
  [MAP_OVERLAY_SOUTH, MAP_CENTER[1]],
  [MAP_OVERLAY_NORTH, MAP_CENTER[1]],
);
const MAP_METERS_PER_IMAGE_PIXEL =
  ((MAP_OVERLAY_WIDTH_METERS / MAP_WIDTH) + (MAP_OVERLAY_HEIGHT_METERS / MAP_HEIGHT)) / 2;

export const metersToImagePixels = (meters: number) => meters / MAP_METERS_PER_IMAGE_PIXEL;

export const getLiveLocationBoundaryGraceMeters = (
  accuracyMeters: number,
  minMeters: number,
  maxMeters: number,
  accuracyFactor: number,
) =>
  clampNumber(
    Math.max(minMeters, accuracyMeters * accuracyFactor),
    minMeters,
    maxMeters,
  );

export const getPathDistanceMeters = (positions: [number, number][]) => {
  if (positions.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < positions.length; i += 1) {
    total += getLatLngDistanceMeters(positions[i - 1], positions[i]);
  }
  return total;
};

export const formatDistanceLabel = (meters: number) => {
  if (!Number.isFinite(meters) || meters <= 0) return '0 m';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
  const rounded = Math.max(5, Math.round(meters / 5) * 5);
  return `${rounded} m`;
};

export const isLiveLocationAccuracyReliable = (accuracyMeters: number, maxAccuracyMeters: number) =>
  Number.isFinite(accuracyMeters) && accuracyMeters <= maxAccuracyMeters;

export const formatWalkingTimeLabel = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0.45) return '< 1 min';
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded >= 60) {
    const hours = Math.floor(rounded / 60);
    const restMinutes = rounded % 60;
    return restMinutes > 0 ? `${hours}h ${restMinutes}min` : `${hours}h`;
  }
  return `${rounded} min`;
};

export const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2;

export const getAdaptiveAnimationDuration = (
  distanceMeters: number,
  minDurationMs: number,
  maxDurationMs: number,
  msPerMeter: number,
) => {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return minDurationMs;
  return Math.min(maxDurationMs, Math.max(minDurationMs, distanceMeters * msPerMeter));
};

export const getPointAlongPath = (positions: [number, number][], progress: number): [number, number] => {
  if (positions.length === 0) return [MAP_CENTER[0], MAP_CENTER[1]];
  if (positions.length === 1) return positions[0];

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const segmentDistances: number[] = [];
  let totalDistance = 0;
  for (let i = 1; i < positions.length; i += 1) {
    const distance = getLatLngDistanceMeters(positions[i - 1], positions[i]);
    segmentDistances.push(distance);
    totalDistance += distance;
  }

  if (totalDistance <= 0) return positions[positions.length - 1];

  const targetDistance = totalDistance * clampedProgress;
  let coveredDistance = 0;

  for (let i = 1; i < positions.length; i += 1) {
    const segmentDistance = segmentDistances[i - 1];
    if (coveredDistance + segmentDistance >= targetDistance) {
      const ratio = segmentDistance > 0 ? (targetDistance - coveredDistance) / segmentDistance : 0;
      const [startLat, startLng] = positions[i - 1];
      const [endLat, endLng] = positions[i];
      return [startLat + (endLat - startLat) * ratio, startLng + (endLng - startLng) * ratio];
    }
    coveredDistance += segmentDistance;
  }

  return positions[positions.length - 1];
};

export const getPathSliceUntilProgress = (positions: [number, number][], progress: number): [number, number][] => {
  if (positions.length === 0) return [];
  if (positions.length === 1) return positions;

  const clampedProgress = Math.max(0, Math.min(1, progress));
  if (clampedProgress <= 0) return [positions[0]];
  if (clampedProgress >= 1) return positions;

  const segmentDistances: number[] = [];
  let totalDistance = 0;
  for (let i = 1; i < positions.length; i += 1) {
    const distance = getLatLngDistanceMeters(positions[i - 1], positions[i]);
    segmentDistances.push(distance);
    totalDistance += distance;
  }

  if (totalDistance <= 0) return positions;

  const targetDistance = totalDistance * clampedProgress;
  let coveredDistance = 0;
  const revealedPath: [number, number][] = [positions[0]];

  for (let i = 1; i < positions.length; i += 1) {
    const segmentDistance = segmentDistances[i - 1];
    if (coveredDistance + segmentDistance >= targetDistance) {
      const ratio = segmentDistance > 0 ? (targetDistance - coveredDistance) / segmentDistance : 0;
      const [startLat, startLng] = positions[i - 1];
      const [endLat, endLng] = positions[i];
      revealedPath.push([startLat + (endLat - startLat) * ratio, startLng + (endLng - startLng) * ratio]);
      return revealedPath;
    }

    revealedPath.push(positions[i]);
    coveredDistance += segmentDistance;
  }

  return positions;
};
