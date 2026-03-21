import {
  FREE_WALK_NAVIGATION_ENABLED,
  MAP_OVERLAY_EAST,
  MAP_OVERLAY_NORTH,
  MAP_OVERLAY_SOUTH,
  MAP_OVERLAY_WEST,
  MAP_PIXEL_HEIGHT,
  MAP_PIXEL_WIDTH,
  OFFICIAL_MAP_SURFACE_URLS,
  ROUTE_LOGICAL_MASK_MODE,
  ROUTE_LOGICAL_MASK_SOURCE,
  ROUTE_LOGICAL_WHITE_THRESHOLD,
} from '../../../config/mapConfig';
import rawInitialPoisSeed from '../../../data/locaisEventoSocialSeed.json';
import type { MapBuildRegistration } from '../types';

const buildPoiLayoutSignature = (value: unknown) => {
  if (!Array.isArray(value)) return 'seed-empty';

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return 'invalid-poi';
      const poi = item as Record<string, unknown>;
      return [
        typeof poi.id === 'string' ? poi.id : 'sem-id',
        typeof poi.nome === 'string' ? poi.nome : 'sem-nome',
        typeof poi.x === 'number' ? poi.x : Number(poi.x ?? 0),
        typeof poi.y === 'number' ? poi.y : Number(poi.y ?? 0),
        typeof poi.tipo === 'string' ? poi.tipo : 'sem-tipo',
      ].join(':');
    })
    .join('|');
};

const CURRENT_POI_LAYOUT_SIGNATURE = buildPoiLayoutSignature(rawInitialPoisSeed);

export const CURRENT_MAP_BUILD_REGISTRATION: MapBuildRegistration = {
  mapPixelWidth: MAP_PIXEL_WIDTH,
  mapPixelHeight: MAP_PIXEL_HEIGHT,
  overlayWest: MAP_OVERLAY_WEST,
  overlayEast: MAP_OVERLAY_EAST,
  overlaySouth: MAP_OVERLAY_SOUTH,
  overlayNorth: MAP_OVERLAY_NORTH,
  primarySurfaceUrl: OFFICIAL_MAP_SURFACE_URLS[0] ?? 'unknown-map-surface',
  logicalMaskSource: ROUTE_LOGICAL_MASK_SOURCE,
  logicalMaskMode: ROUTE_LOGICAL_MASK_MODE,
  logicalWhiteThreshold: ROUTE_LOGICAL_WHITE_THRESHOLD,
  freeWalkNavigationEnabled: FREE_WALK_NAVIGATION_ENABLED,
  poiLayoutSignature: CURRENT_POI_LAYOUT_SIGNATURE,
};

const sanitizeNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

export const sanitizeMapBuildRegistration = (value: unknown): MapBuildRegistration | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  const mapPixelWidth = sanitizeNumber(candidate.mapPixelWidth);
  const mapPixelHeight = sanitizeNumber(candidate.mapPixelHeight);
  const overlayWest = sanitizeNumber(candidate.overlayWest);
  const overlayEast = sanitizeNumber(candidate.overlayEast);
  const overlaySouth = sanitizeNumber(candidate.overlaySouth);
  const overlayNorth = sanitizeNumber(candidate.overlayNorth);

  if (
    mapPixelWidth == null ||
    mapPixelHeight == null ||
    overlayWest == null ||
    overlayEast == null ||
    overlaySouth == null ||
    overlayNorth == null ||
    typeof candidate.primarySurfaceUrl !== 'string' ||
    typeof candidate.logicalMaskSource !== 'string' ||
    typeof candidate.logicalMaskMode !== 'string' ||
    sanitizeNumber(candidate.logicalWhiteThreshold) == null ||
    typeof candidate.freeWalkNavigationEnabled !== 'boolean' ||
    typeof candidate.poiLayoutSignature !== 'string' ||
    candidate.poiLayoutSignature.trim().length === 0
  ) {
    return null;
  }

  return {
    mapPixelWidth,
    mapPixelHeight,
    overlayWest,
    overlayEast,
    overlaySouth,
    overlayNorth,
    primarySurfaceUrl: candidate.primarySurfaceUrl,
    logicalMaskSource: candidate.logicalMaskSource,
    logicalMaskMode: candidate.logicalMaskMode,
    logicalWhiteThreshold: sanitizeNumber(candidate.logicalWhiteThreshold)!,
    freeWalkNavigationEnabled: candidate.freeWalkNavigationEnabled,
    poiLayoutSignature: candidate.poiLayoutSignature,
  };
};

export const formatMapBuildRegistration = (build: MapBuildRegistration | null | undefined) => {
  if (!build) return 'build sem registro';
  const routeModeLabel = build.freeWalkNavigationEnabled ? 'rota livre' : 'grafo local';
  return `${build.mapPixelWidth}x${build.mapPixelHeight} | ${build.primarySurfaceUrl} | ${build.logicalMaskSource}:${build.logicalMaskMode}@${build.logicalWhiteThreshold} | ${routeModeLabel}`;
};

export const isSameMapBuildRegistration = (
  left: MapBuildRegistration | null | undefined,
  right: MapBuildRegistration | null | undefined,
) => {
  if (!left || !right) return false;

  return (
    left.mapPixelWidth === right.mapPixelWidth &&
    left.mapPixelHeight === right.mapPixelHeight &&
    left.overlayWest === right.overlayWest &&
    left.overlayEast === right.overlayEast &&
    left.overlaySouth === right.overlaySouth &&
    left.overlayNorth === right.overlayNorth &&
    left.primarySurfaceUrl === right.primarySurfaceUrl &&
    left.logicalMaskSource === right.logicalMaskSource &&
    left.logicalMaskMode === right.logicalMaskMode &&
    left.logicalWhiteThreshold === right.logicalWhiteThreshold &&
    left.freeWalkNavigationEnabled === right.freeWalkNavigationEnabled &&
    left.poiLayoutSignature === right.poiLayoutSignature
  );
};

export const describeMapBuildRegistrationDifference = (
  importedBuild: MapBuildRegistration | null | undefined,
  currentBuild = CURRENT_MAP_BUILD_REGISTRATION,
) => {
  if (!importedBuild) {
    return `Arquivo sem assinatura da build. Revise os pins na build atual (${formatMapBuildRegistration(currentBuild)}).`;
  }

  if (isSameMapBuildRegistration(importedBuild, currentBuild)) {
    return null;
  }

  return `Arquivo de outra build: ${formatMapBuildRegistration(importedBuild)}. Build atual: ${formatMapBuildRegistration(currentBuild)}.`;
};
