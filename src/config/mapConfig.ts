export const LEGACY_COORDINATE_WIDTH = 800;
export const LEGACY_COORDINATE_HEIGHT = 1280;

export const MAP_PIXEL_WIDTH = 1527;
export const MAP_PIXEL_HEIGHT = 912;

// Coordenada original do evento. O padrão do build agora aponta para ela.
const EVENT_MAP_CENTER: [number, number] = [-8.282850901745611, -35.965868293929084];

// Coordenada enviada para o teste local com celular.
const TEST_MAP_CENTER: [number, number] = [-8.265862538576485, -35.9810204297831];
const USE_TEST_MAP_CENTER = (import.meta.env.VITE_USE_TEST_MAP_CENTER || 'false').trim().toLowerCase() === 'true';

export const MAP_CENTER: [number, number] = USE_TEST_MAP_CENTER ? TEST_MAP_CENTER : EVENT_MAP_CENTER;

// Ajuste final para o Armazém da Criatividade, mantendo enquadramento horizontal.
// Menor = overlay menor; maior = overlay maior.
const MAP_SPAN_LNG = 0.00092;
const MAP_ASPECT_RATIO = MAP_PIXEL_WIDTH / MAP_PIXEL_HEIGHT;
const latRadians = (MAP_CENTER[0] * Math.PI) / 180;
const MAP_SPAN_LAT = (MAP_SPAN_LNG * Math.cos(latRadians)) / MAP_ASPECT_RATIO;

// Controle fino do overlay visual (`public/maps/mapa-visual.png`).
// X: positivo move para a direita.
// Y: positivo move para baixo.
// SCALE: 1 = tamanho original do mapa lógico.
export const MAP_OVERLAY_OFFSET_X_RATIO = -0.16;
export const MAP_OVERLAY_OFFSET_Y_RATIO = -0.137;
export const MAP_OVERLAY_SCALE_X = 1.65;
export const MAP_OVERLAY_SCALE_Y = 1.65;

export const MAP_LNG_SPAN = MAP_SPAN_LNG;
export const MAP_LAT_SPAN = MAP_SPAN_LAT;

export const MAP_WEST = MAP_CENTER[1] - MAP_SPAN_LNG / 2;
export const MAP_EAST = MAP_CENTER[1] + MAP_SPAN_LNG / 2;
export const MAP_SOUTH = MAP_CENTER[0] - MAP_SPAN_LAT / 2;
export const MAP_NORTH = MAP_CENTER[0] + MAP_SPAN_LAT / 2;

const MAP_OVERLAY_CENTER_LNG = MAP_CENTER[1] + MAP_LNG_SPAN * MAP_OVERLAY_OFFSET_X_RATIO;
const MAP_OVERLAY_CENTER_LAT = MAP_CENTER[0] - MAP_LAT_SPAN * MAP_OVERLAY_OFFSET_Y_RATIO;
const MAP_OVERLAY_SPAN_LNG = MAP_LNG_SPAN * MAP_OVERLAY_SCALE_X;
const MAP_OVERLAY_SPAN_LAT = MAP_LAT_SPAN * MAP_OVERLAY_SCALE_Y;

export const MAP_OVERLAY_WEST = MAP_OVERLAY_CENTER_LNG - MAP_OVERLAY_SPAN_LNG / 2;
export const MAP_OVERLAY_EAST = MAP_OVERLAY_CENTER_LNG + MAP_OVERLAY_SPAN_LNG / 2;
export const MAP_OVERLAY_SOUTH = MAP_OVERLAY_CENTER_LAT - MAP_OVERLAY_SPAN_LAT / 2;
export const MAP_OVERLAY_NORTH = MAP_OVERLAY_CENTER_LAT + MAP_OVERLAY_SPAN_LAT / 2;

export const COORDINATE_SCALE_X = MAP_PIXEL_WIDTH / LEGACY_COORDINATE_WIDTH;
export const COORDINATE_SCALE_Y = MAP_PIXEL_HEIGHT / LEGACY_COORDINATE_HEIGHT;

export interface MapImagePoint {
  x: number;
  y: number;
}

const MAP_OVERLAY_SOURCE_WIDTH = 612;
const MAP_OVERLAY_SOURCE_HEIGHT = 408;

// Cerca da área útil do evento baseada no contorno do overlay visual.
// Esses pontos podem ser refinados no local caso a equipe queira um recorte ainda mais preciso.
const EVENT_BOUNDARY_SOURCE_POINTS: MapImagePoint[] = [
  { x: 15, y: 101 },
  { x: 272, y: 101 },
  { x: 272, y: 37 },
  { x: 544, y: 37 },
  { x: 544, y: 104 },
  { x: 594, y: 104 },
  { x: 594, y: 226 },
  { x: 607, y: 226 },
  { x: 607, y: 357 },
  { x: 576, y: 357 },
  { x: 576, y: 399 },
  { x: 336, y: 399 },
  { x: 186, y: 399 },
  { x: 180, y: 407 },
  { x: 17, y: 404 },
  { x: 9, y: 394 },
  { x: 9, y: 116 },
];

const scaleOverlaySourcePoint = (point: MapImagePoint): MapImagePoint => ({
  x: (point.x / MAP_OVERLAY_SOURCE_WIDTH) * MAP_PIXEL_WIDTH,
  y: (point.y / MAP_OVERLAY_SOURCE_HEIGHT) * MAP_PIXEL_HEIGHT,
});

export const EVENT_BOUNDARY_IMAGE_POINTS = EVENT_BOUNDARY_SOURCE_POINTS.map(scaleOverlaySourcePoint);
