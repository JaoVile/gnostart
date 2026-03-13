export const LEGACY_COORDINATE_WIDTH = 800;
export const LEGACY_COORDINATE_HEIGHT = 1280;

export const MAP_PIXEL_WIDTH = 1527;
export const MAP_PIXEL_HEIGHT = 912;

const MAP_BASE_CENTER: [number, number] = [-8.282769956514597, -35.96594654609873];

// Ajuste fino de posicionamento do overlay.
// LAT: positivo sobe (norte), negativo desce (sul)
// LNG: positivo vai para direita (leste), negativo vai para esquerda (oeste)
const MAP_OFFSET_LAT = 0.0002;
const MAP_OFFSET_LNG = 0.0017;

export const MAP_CENTER: [number, number] = [
  MAP_BASE_CENTER[0] + MAP_OFFSET_LAT,
  MAP_BASE_CENTER[1] + MAP_OFFSET_LNG,
];

// Ajuste final para o Armazem da Criatividade, mantendo enquadramento horizontal.
// Menor = overlay menor; maior = overlay maior.
const MAP_SPAN_LNG = 0.00092;
const MAP_ASPECT_RATIO = MAP_PIXEL_WIDTH / MAP_PIXEL_HEIGHT;
const latRadians = (MAP_CENTER[0] * Math.PI) / 180;
const MAP_SPAN_LAT = (MAP_SPAN_LNG * Math.cos(latRadians)) / MAP_ASPECT_RATIO;

export const MAP_WEST = MAP_CENTER[1] - MAP_SPAN_LNG / 2;
export const MAP_EAST = MAP_CENTER[1] + MAP_SPAN_LNG / 2;
export const MAP_SOUTH = MAP_CENTER[0] - MAP_SPAN_LAT / 2;
export const MAP_NORTH = MAP_CENTER[0] + MAP_SPAN_LAT / 2;

export const COORDINATE_SCALE_X = MAP_PIXEL_WIDTH / LEGACY_COORDINATE_WIDTH;
export const COORDINATE_SCALE_Y = MAP_PIXEL_HEIGHT / LEGACY_COORDINATE_HEIGHT;
