export const LEGACY_COORDINATE_WIDTH = 800;
export const LEGACY_COORDINATE_HEIGHT = 1280;

export const MAP_PIXEL_WIDTH = 1527;
export const MAP_PIXEL_HEIGHT = 912;

// Coordenada de referencia informada para o Patio do Porto Digital (Caruaru).
export const MAP_CENTER: [number, number] = [-8.282850901745611, -35.965868293929084];

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
