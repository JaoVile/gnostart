export const LEGACY_COORDINATE_WIDTH = 800;
export const LEGACY_COORDINATE_HEIGHT = 1280;

// Resolucao logica usada pelo mapa para projeção interna.
// Se trocar o arquivo base por outro com proporção diferente, ajuste estes valores manualmente.
export const MAP_PIXEL_WIDTH = 1527;
export const MAP_PIXEL_HEIGHT = 912;

// Ordem de preferencia do overlay oficial.
// SVG e a melhor opcao para manter nitidez; PNG fica como fallback de transicao.
export const OFFICIAL_MAP_SURFACE_URLS = ['/maps/mapa_oficial.svg', '/maps/mapa_oficial.png'] as const;

// Quando ativo, a navegacao deixa de depender do navGraph gerado pelo mapa-logica.
// As rotas passam a ser livres entre origem e destino dentro da area do evento.
export const FREE_WALK_NAVIGATION_ENABLED = true;

export interface OfficialMapZoomProfile {
  zoomDeLonge: number;
  zoomDePerto: number | null;
}

// Delta de zoom relativo ao encaixe completo do mapa.
// Cada nivel de zoom muda a escala pela metade/dobro. Ex.: 1 = 2x, 2 = 4x, 10 = 1024x.
// `zoomDeLonge`: quantos niveis afastar a partir do encaixe.
// `zoomDePerto`: quantos niveis aproximar a partir do encaixe. `null` remove o teto.
// O mapa sempre abre em `zoomDeLonge`.
export const OFFICIAL_MAP_DESKTOP_ZOOM: OfficialMapZoomProfile = {
  zoomDeLonge: 0,
  zoomDePerto: null,
};

// Ajuste manual do zoom no mobile.
export const OFFICIAL_MAP_MOBILE_ZOOM: OfficialMapZoomProfile = {
  zoomDeLonge: 3.5,
  zoomDePerto: null,
};

// Quanto maior, mais area extra de arrasto ao redor do overlay.
export const OFFICIAL_MAP_DRAG_PADDING_RATIO = 0.07;
// 1 = trava forte nas bordas. Valores menores deixam o arrasto mais natural.
export const OFFICIAL_MAP_BOUNDS_VISCOSITY = 0.85;

export const POI_PINS_MIN_ZOOM_DESKTOP_OFFSET = 3.4;
export const POI_PINS_MIN_ZOOM_MOBILE_OFFSET = 6.1;
export const POI_AUTO_VISIBLE_LIMIT = 20;

export type PoiPinScaleTier = 'medium' | 'medium-large' | 'large';

export interface PoiPreviewSizeLimits {
  width: number;
  minWidth: number;
  maxWidth: number;
}

const POI_PREVIEW_LIMITS_MOBILE: PoiPreviewSizeLimits = {
  width: 248,
  minWidth: 248,
  maxWidth: 248,
};

const POI_PREVIEW_LIMITS_DESKTOP: PoiPreviewSizeLimits = {
  width: 272,
  minWidth: 272,
  maxWidth: 272,
};

export interface OfficialMapResolvedZoomConfig {
  initialZoom: number;
  minZoom: number;
  maxZoom: number | null;
  fittedZoom: number;
}

// Quando `zoomDePerto` estiver sem teto (`null`), abrimos em uma visao naturalmente mais proxima.
const OFFICIAL_MAP_DEFAULT_OPEN_CLOSE_DELTA = 2.4;

const clampOfficialMapZoomProfile = (profile: OfficialMapZoomProfile): OfficialMapZoomProfile => {
  const zoomDeLonge = Math.abs(profile.zoomDeLonge);
  const zoomDePerto = profile.zoomDePerto == null ? null : Math.abs(profile.zoomDePerto);
  return { zoomDeLonge, zoomDePerto };
};

export const getOfficialMapZoomProfile = (isMobile: boolean): OfficialMapZoomProfile =>
  clampOfficialMapZoomProfile(isMobile ? OFFICIAL_MAP_MOBILE_ZOOM : OFFICIAL_MAP_DESKTOP_ZOOM);

export const resolveOfficialMapZoomConfig = (
  fittedZoom: number,
  isMobile: boolean,
): OfficialMapResolvedZoomConfig => {
  const profile = getOfficialMapZoomProfile(isMobile);
  const minZoom = fittedZoom - profile.zoomDeLonge;
  const maxZoom = profile.zoomDePerto == null ? null : fittedZoom + profile.zoomDePerto;
  const initialZoom = maxZoom ?? fittedZoom + OFFICIAL_MAP_DEFAULT_OPEN_CLOSE_DELTA;

  return {
    fittedZoom,
    initialZoom,
    minZoom,
    maxZoom,
  };
};

export const getPoiPinsMinZoom = (baseMinZoom: number, isMobile: boolean) =>
  baseMinZoom + (isMobile ? POI_PINS_MIN_ZOOM_MOBILE_OFFSET : POI_PINS_MIN_ZOOM_DESKTOP_OFFSET);

export const shouldShowPoiPins = (zoomLevel: number, baseMinZoom: number, isMobile: boolean, isAdmin = false) =>
  isAdmin || zoomLevel >= getPoiPinsMinZoom(baseMinZoom, isMobile);

export const getPoiPinScaleTier = (
  zoomLevel: number,
  baseMinZoom: number,
  isMobile: boolean,
): PoiPinScaleTier => {
  const revealZoom = getPoiPinsMinZoom(baseMinZoom, isMobile);
  const mediumLargeThreshold = revealZoom + (isMobile ? 1.2 : 1);
  const largeThreshold = revealZoom + (isMobile ? 2.4 : 2);

  if (zoomLevel >= largeThreshold) return 'large';
  if (zoomLevel >= mediumLargeThreshold) return 'medium-large';
  return 'medium';
};

export const getPoiAutoVisibleLimit = () => POI_AUTO_VISIBLE_LIMIT;

export const getPoiPreviewSizeLimits = (isMobile: boolean): PoiPreviewSizeLimits =>
  isMobile ? POI_PREVIEW_LIMITS_MOBILE : POI_PREVIEW_LIMITS_DESKTOP;

export interface MapImagePoint {
  x: number;
  y: number;
}

export interface MapCalibrationPoint extends MapImagePoint {
  lat: number;
  lng: number;
}

// Âncora validada a partir do ponto informado no Google Maps do evento.
const EVENT_MAP_CENTER: [number, number] = [-8.282803001403982, -35.9658650714576];

// Perimetro coletado em campo (mapa admin + GPS).
// Ordem horaria para manter o poligono sem cruzamento.
export const EVENT_BOUNDARY_CALIBRATION_POINTS: MapCalibrationPoint[] = [
  { lat: -8.282468122738935, lng: -35.96641170257004, x: 559, y: 316 },
  { lat: -8.282531429384667, lng: -35.966176369999275, x: 636, y: 316 },
  { lat: -8.28255969127679, lng: -35.966088405883006, x: 646, y: 321 },
  { lat: -8.28257777888669, lng: -35.9660118567795, x: 698, y: 321 },
  { lat: -8.28253268428496, lng: -35.965798628605825, x: 740, y: 300 },
  { lat: -8.282691808968636, lng: -35.96558978468366, x: 827, y: 315 },
  { lat: -8.2827836662755, lng: -35.965253721826556, x: 918, y: 314 },
  { lat: -8.282987793547347, lng: -35.96531216754084, x: 921, y: 399 },
  { lat: -8.282821938411262, lng: -35.965899215233065, x: 748, y: 400 },
  { lat: -8.28278465586574, lng: -35.96604956458492, x: 697, y: 403 },
  { lat: -8.28276091589006, lng: -35.966146667830145, x: 647, y: 401 },
  { lat: -8.282733784487526, lng: -35.96623577433752, x: 634, y: 396 },
  { lat: -8.28266708644836, lng: -35.966469964517174, x: 560, y: 397 },
];

// Pontos extras de calibracao podem ficar dentro da area do evento.
// Eles ajudam a reduzir desvio local sem alterar o perimetro visual.
export const EVENT_INTERNAL_CALIBRATION_POINTS: MapCalibrationPoint[] = [
  { lat: -8.282567769461545, lng: -35.96598758484116, x: 715, y: 321 },
  { lat: -8.282824519987601, lng: -35.96595667311194, x: 752, y: 404 },
  { lat: -8.282769, lng: -35.966056, x: 725, y: 394 },
  { lat: -8.282738841499189, lng: -35.96615685083374, x: 694, y: 395 },
  { lat: -8.282678796399541, lng: -35.96617100762566, x: 684, y: 374 },
  { lat: -8.282676638406517, lng: -35.9656931475008, x: 787, y: 335 },
  { lat: -8.282578863667579, lng: -35.96576414983407, x: 764, y: 313 },
  { lat: -8.282708173070038, lng: -35.9657570463876, x: 787, y: 357 },
];

export const EVENT_LOCATION_REFERENCE_POINTS: MapCalibrationPoint[] = [
  ...EVENT_BOUNDARY_CALIBRATION_POINTS,
  ...EVENT_INTERNAL_CALIBRATION_POINTS,
];

export const EVENT_BOUNDARY_IMAGE_POINTS: MapImagePoint[] = EVENT_BOUNDARY_CALIBRATION_POINTS.map(({ x, y }) => ({ x, y }));

type LinearFit = {
  slope: number;
  intercept: number;
};

type CalibratedOverlayBounds = {
  west: number;
  east: number;
  south: number;
  north: number;
};

const fitLinearRegression = (samples: Array<{ input: number; output: number }>): LinearFit | null => {
  if (samples.length < 2) return null;

  let sumInput = 0;
  let sumOutput = 0;
  let sumInputSquared = 0;
  let sumInputOutput = 0;

  samples.forEach(({ input, output }) => {
    sumInput += input;
    sumOutput += output;
    sumInputSquared += input * input;
    sumInputOutput += input * output;
  });

  const denominator = samples.length * sumInputSquared - sumInput * sumInput;
  if (Math.abs(denominator) < Number.EPSILON) return null;

  const slope = (samples.length * sumInputOutput - sumInput * sumOutput) / denominator;
  const intercept = (sumOutput - slope * sumInput) / samples.length;

  return { slope, intercept };
};

const buildCalibratedOverlayBounds = (
  points: MapCalibrationPoint[],
  fallbackCenter: [number, number],
): CalibratedOverlayBounds => {
  const fallbackSpanLng = 0.00092;
  const fallbackAspectRatio = MAP_PIXEL_WIDTH / MAP_PIXEL_HEIGHT;
  const fallbackLatRadians = (fallbackCenter[0] * Math.PI) / 180;
  const fallbackSpanLat = (fallbackSpanLng * Math.cos(fallbackLatRadians)) / fallbackAspectRatio;
  const fallbackBounds = {
    west: fallbackCenter[1] - fallbackSpanLng / 2,
    east: fallbackCenter[1] + fallbackSpanLng / 2,
    south: fallbackCenter[0] - fallbackSpanLat / 2,
    north: fallbackCenter[0] + fallbackSpanLat / 2,
  };

  const lngFit = fitLinearRegression(points.map((point) => ({ input: point.x, output: point.lng })));
  const latFit = fitLinearRegression(points.map((point) => ({ input: point.y, output: point.lat })));

  if (!lngFit || !latFit) {
    return fallbackBounds;
  }

  return {
    west: lngFit.intercept,
    east: lngFit.slope * MAP_PIXEL_WIDTH + lngFit.intercept,
    north: latFit.intercept,
    south: latFit.slope * MAP_PIXEL_HEIGHT + latFit.intercept,
  };
};

const calibratedOverlayBounds = buildCalibratedOverlayBounds(EVENT_LOCATION_REFERENCE_POINTS, EVENT_MAP_CENTER);

export const MAP_OVERLAY_WEST = calibratedOverlayBounds.west;
export const MAP_OVERLAY_EAST = calibratedOverlayBounds.east;
export const MAP_OVERLAY_SOUTH = calibratedOverlayBounds.south;
export const MAP_OVERLAY_NORTH = calibratedOverlayBounds.north;

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
