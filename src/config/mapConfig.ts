import canonicalMapBase from '../data/mapa_canonico/mapa-base-canonica.json';

export const LEGACY_COORDINATE_WIDTH = 800;
export const LEGACY_COORDINATE_HEIGHT = 1280;

// Resolucao logica usada pelo mapa para projeção interna.
// Se trocar o arquivo base por outro com proporção diferente, ajuste estes valores manualmente.
export const MAP_PIXEL_WIDTH = 1527;
export const MAP_PIXEL_HEIGHT = 912;

// Superficie visual atual renderizada por cima da logica_nova.
export const OFFICIAL_MAP_SURFACE_URLS = ['/maps/mapa_geral.svg'] as const;
export const OFFICIAL_MAP_FOREGROUND_SURFACE_URLS = [] as const;
export const ROUTE_LOGICAL_VECTOR_SOURCE = 'logica_nova.svg';
export const ROUTE_LOGICAL_MASK_SOURCE = 'logica_nova.png';
export const ROUTE_LOGICAL_MASK_MODE = 'white-only';
export const ROUTE_LOGICAL_WHITE_THRESHOLD = 220;

export interface RouteLogicalPlacementConfig {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

type CanonicalRouteConfigCandidate = {
  route?: {
    alignment?: Partial<RouteLogicalPlacementConfig>;
  };
};

const sanitizeLogicalPlacementNumber = (
  value: unknown,
  fallback: number,
  options?: { min?: number },
) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (options?.min != null && parsed < options.min) return fallback;
  return parsed;
};

const rawRouteLogicalPlacement = (canonicalMapBase as CanonicalRouteConfigCandidate)?.route?.alignment;

// Ajuste manual da malha logica.
// `offsetX`: positivo empurra para a direita, negativo para a esquerda.
// `offsetY`: positivo empurra para baixo, negativo para cima.
// `scaleX`: aumenta/estica na horizontal.
// `scaleY`: aumenta/estica na vertical.
// Se quiser aumentar ou diminuir tudo proporcionalmente, use o mesmo valor em `scaleX` e `scaleY`.
export const ROUTE_LOGICAL_PLACEMENT: RouteLogicalPlacementConfig = {
  offsetX: sanitizeLogicalPlacementNumber(rawRouteLogicalPlacement?.offsetX, 0),
  offsetY: sanitizeLogicalPlacementNumber(rawRouteLogicalPlacement?.offsetY, 0),
  scaleX: sanitizeLogicalPlacementNumber(rawRouteLogicalPlacement?.scaleX, 1, { min: 0.05 }),
  scaleY: sanitizeLogicalPlacementNumber(rawRouteLogicalPlacement?.scaleY, 1, { min: 0.05 }),
};

// Quando ativo, a navegacao deixa de depender do navGraph gerado pela logica_nova.
// As rotas passam a ser livres entre origem e destino dentro da area do evento.
export const FREE_WALK_NAVIGATION_ENABLED = false;

export interface OfficialMapZoomProfile {
  zoomDeLonge: number;
  zoomDePerto: number;
  zoomInicialOffset: number;
}

// Delta de zoom relativo ao encaixe completo do mapa.
// Cada nivel de zoom muda a escala pela metade/dobro. Ex.: 1 = 2x, 2 = 4x, 10 = 1024x.
// `zoomDeLonge`: quantos niveis afastar a partir do encaixe.
// `zoomDePerto`: quantos niveis aproximar a partir do encaixe.
// `zoomInicialOffset`: quanto o mapa abre aproximado a partir do encaixe.
export const OFFICIAL_MAP_DESKTOP_ZOOM: OfficialMapZoomProfile = {
  zoomDeLonge: 0,
  zoomDePerto: 3.5,
  zoomInicialOffset: 8.8,
};

// Ajuste manual do zoom no mobile.
export const OFFICIAL_MAP_MOBILE_ZOOM: OfficialMapZoomProfile = {
  zoomDeLonge: 2.5,
  zoomDePerto: 5.5,
  zoomInicialOffset: 2.8,
};

// Quanto maior, mais area extra de arrasto ao redor do overlay.
export const OFFICIAL_MAP_DRAG_PADDING_RATIO = 0.07;
// 1 = trava forte nas bordas. Valores menores deixam o arrasto mais natural.
export const OFFICIAL_MAP_BOUNDS_VISCOSITY = 0.85;

export const POI_AUTO_VISIBLE_LIMIT = 20;

export type PoiPinScaleTier = 'medium' | 'medium-large' | 'large';
export type PoiPinSizeByTier = Record<PoiPinScaleTier, number>;

export interface PoiPinZoomProfile {
  revealZoomOffset: number;
  mediumLargeZoomOffset: number;
  largeZoomOffset: number;
}

export const POI_PIN_SIZES_DESKTOP: PoiPinSizeByTier = {
  medium: 35,
  'medium-large': 50,
  large: 65,
};

export const POI_PIN_SIZES_MOBILE: PoiPinSizeByTier = {
  medium: 35,
  'medium-large': 50,
  large: 65,
};

// Esses offsets precisam caber na janela real de zoom do mapa.
// Se passarem do maxZoom, alguns tamanhos nunca aparecem em uso.
export const POI_PIN_ZOOM_DESKTOP: PoiPinZoomProfile = {
  revealZoomOffset: 2.2,
  mediumLargeZoomOffset: 0.6,
  largeZoomOffset: 1.2,
};

export const POI_PIN_ZOOM_MOBILE: PoiPinZoomProfile = {
  revealZoomOffset: 5,
  mediumLargeZoomOffset: 0.8,
  largeZoomOffset: 1.6,
};

export interface PoiPreviewSizeLimits {
  width: number;
  minWidth: number;
  maxWidth: number;
  maxHeight: number;
  tier: PoiPinScaleTier;
  isMobile: boolean;
}

export interface OfficialMapResolvedZoomConfig {
  initialZoom: number;
  minZoom: number;
  maxZoom: number;
  fittedZoom: number;
}

const clampOfficialMapZoomProfile = (profile: OfficialMapZoomProfile): OfficialMapZoomProfile => {
  const zoomDeLonge = Math.abs(profile.zoomDeLonge);
  const zoomDePerto = Math.abs(profile.zoomDePerto);
  const zoomInicialOffset = Math.abs(profile.zoomInicialOffset);
  return { zoomDeLonge, zoomDePerto, zoomInicialOffset };
};

export const getOfficialMapZoomProfile = (isMobile: boolean): OfficialMapZoomProfile =>
  clampOfficialMapZoomProfile(isMobile ? OFFICIAL_MAP_MOBILE_ZOOM : OFFICIAL_MAP_DESKTOP_ZOOM);

export const resolveOfficialMapZoomConfig = (
  fittedZoom: number,
  isMobile: boolean,
): OfficialMapResolvedZoomConfig => {
  const profile = getOfficialMapZoomProfile(isMobile);
  const minZoom = fittedZoom - profile.zoomDeLonge;
  const maxZoom = fittedZoom + profile.zoomDePerto;
  const unclampedInitialZoom = fittedZoom + profile.zoomInicialOffset;
  const initialZoom = Math.max(minZoom, Math.min(unclampedInitialZoom, maxZoom));

  return {
    fittedZoom,
    initialZoom,
    minZoom,
    maxZoom,
  };
};

export const getPoiPinZoomProfile = (isMobile: boolean): PoiPinZoomProfile =>
  isMobile ? POI_PIN_ZOOM_MOBILE : POI_PIN_ZOOM_DESKTOP;

export const getPoiPinsMinZoom = (baseMinZoom: number, isMobile: boolean) =>
  baseMinZoom + getPoiPinZoomProfile(isMobile).revealZoomOffset;

export const shouldShowPoiPins = (zoomLevel: number, baseMinZoom: number, isMobile: boolean, isAdmin = false) =>
  isAdmin || zoomLevel >= getPoiPinsMinZoom(baseMinZoom, isMobile);

export const getPoiPinScaleTier = (
  zoomLevel: number,
  baseMinZoom: number,
  isMobile: boolean,
): PoiPinScaleTier => {
  const profile = getPoiPinZoomProfile(isMobile);
  const revealZoom = baseMinZoom + profile.revealZoomOffset;
  const mediumLargeThreshold = revealZoom + profile.mediumLargeZoomOffset;
  const largeThreshold = revealZoom + profile.largeZoomOffset;

  if (zoomLevel >= largeThreshold) return 'large';
  if (zoomLevel >= mediumLargeThreshold) return 'medium-large';
  return 'medium';
};

export const getPoiAutoVisibleLimit = () => POI_AUTO_VISIBLE_LIMIT;

export const getPoiPinSizes = (isMobile: boolean): PoiPinSizeByTier =>
  isMobile ? POI_PIN_SIZES_MOBILE : POI_PIN_SIZES_DESKTOP;

type PoiPreviewTierSize = {
  width: number;
  minWidth: number;
  maxWidth: number;
  maxHeight: number;
};

const POI_PREVIEW_SIZES_DESKTOP: Record<PoiPinScaleTier, PoiPreviewTierSize> = {
  medium: {
    width: 196,
    minWidth: 188,
    maxWidth: 210,
    maxHeight: 232,
  },
  'medium-large': {
    width: 212,
    minWidth: 196,
    maxWidth: 228,
    maxHeight: 258,
  },
  large: {
    width: 228,
    minWidth: 208,
    maxWidth: 246,
    maxHeight: 288,
  },
};

const POI_PREVIEW_SIZES_MOBILE: Record<PoiPinScaleTier, PoiPreviewTierSize> = {
  medium: {
    width: 188,
    minWidth: 180,
    maxWidth: 202,
    maxHeight: 222,
  },
  'medium-large': {
    width: 198,
    minWidth: 188,
    maxWidth: 214,
    maxHeight: 240,
  },
  large: {
    width: 210,
    minWidth: 196,
    maxWidth: 228,
    maxHeight: 264,
  },
};

export const getPoiPreviewSizeLimits = (
  isMobile: boolean,
  viewportWidth = 0,
  viewportHeight = 0,
  tier: PoiPinScaleTier = 'medium-large',
): PoiPreviewSizeLimits => {
  const tierPreset = (isMobile ? POI_PREVIEW_SIZES_MOBILE : POI_PREVIEW_SIZES_DESKTOP)[tier];
  const resolvedViewportWidth = viewportWidth > 0 ? viewportWidth : isMobile ? 390 : 1280;
  const resolvedViewportHeight = viewportHeight > 0 ? viewportHeight : isMobile ? 844 : 900;
  const horizontalPadding = isMobile ? 16 : 28;
  const verticalPadding = isMobile ? 188 : 180;
  const availableWidth = Math.max(196, Math.floor(resolvedViewportWidth - horizontalPadding));
  const availableHeight = Math.max(220, Math.floor(resolvedViewportHeight - verticalPadding));
  const width = Math.min(tierPreset.width, availableWidth);
  const maxWidth = Math.min(tierPreset.maxWidth, availableWidth);
  const minWidth = Math.min(maxWidth, Math.max(188, Math.min(tierPreset.minWidth, width)));
  const maxHeight = Math.min(tierPreset.maxHeight, availableHeight);

  return {
    width,
    minWidth,
    maxWidth,
    maxHeight,
    tier,
    isMobile,
  };
};

export interface MapImagePoint {
  x: number;
  y: number;
}

// Perimetro da area util em coordenadas do proprio mapa.
// Mantido so em x/y para delimitar o evento sem guardar a calibracao GPS antiga.
export const EVENT_BOUNDARY_IMAGE_POINTS: MapImagePoint[] = [
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

// Bounds finais congelados para preservar o encaixe visual atual
// sem depender da malha anterior de pontos GPS.
export const MAP_OVERLAY_WEST = -35.96826193743046;
export const MAP_OVERLAY_EAST = -35.96336851705193;
export const MAP_OVERLAY_SOUTH = -8.283983221871459;
export const MAP_OVERLAY_NORTH = -8.281855453885862;

export const MAP_OVERLAY_CENTER_LNG = (MAP_OVERLAY_WEST + MAP_OVERLAY_EAST) / 2;
export const MAP_OVERLAY_CENTER_LAT = (MAP_OVERLAY_SOUTH + MAP_OVERLAY_NORTH) / 2;
export const MAP_VIEW_CENTER: [number, number] = [MAP_OVERLAY_CENTER_LAT, MAP_OVERLAY_CENTER_LNG];
export const MAP_CENTER: [number, number] = MAP_VIEW_CENTER;

export const MAP_LNG_SPAN = MAP_OVERLAY_EAST - MAP_OVERLAY_WEST;
export const MAP_LAT_SPAN = MAP_OVERLAY_NORTH - MAP_OVERLAY_SOUTH;
export const MAP_WEST = MAP_OVERLAY_WEST;
export const MAP_EAST = MAP_OVERLAY_EAST;
export const MAP_SOUTH = MAP_OVERLAY_SOUTH;
export const MAP_NORTH = MAP_OVERLAY_NORTH;

export const COORDINATE_SCALE_X = MAP_PIXEL_WIDTH / LEGACY_COORDINATE_WIDTH;
export const COORDINATE_SCALE_Y = MAP_PIXEL_HEIGHT / LEGACY_COORDINATE_HEIGHT;
