type PoiType = 'atividade' | 'servico' | 'banheiro' | 'entrada';

export interface MapPoiDto {
  id: string;
  x: number;
  y: number;
  nome: string;
  tipo: PoiType;
  descricao?: string;
  imagemUrl?: string;
  contato?: string;
  corDestaque?: string;
  selo?: string;
  nodeId?: string;
}

interface MapBootstrapResponse {
  map: {
    id: string;
    nome: string;
    eventName: string;
    overlayUrl: string;
  };
  pois: MapPoiDto[];
}

export interface UpsertPoiPayload {
  id?: string;
  nome: string;
  tipo: PoiType;
  x: number;
  y: number;
  descricao?: string;
  imagemUrl?: string;
  contato?: string;
  corDestaque?: string;
  selo?: string;
  nodeId?: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3333').replace(/\/+$/, '');
const MAP_ID = import.meta.env.VITE_MAP_ID || 'default_map';
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || '';

const buildHeaders = (contentType?: string): Headers => {
  const headers = new Headers();
  if (contentType) headers.set('Content-Type', contentType);
  if (ADMIN_API_KEY) headers.set('x-admin-key', ADMIN_API_KEY);
  return headers;
};

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(responseText || `Erro ${response.status} ao acessar ${url}`);
  }
  return (await response.json()) as T;
};

export const fetchMapBootstrap = () =>
  requestJson<MapBootstrapResponse>(
    `${API_BASE_URL}/api/v1/map/bootstrap?mapId=${encodeURIComponent(MAP_ID)}&includeGraph=false`,
  );

export const createPoi = (payload: UpsertPoiPayload) =>
  requestJson<MapPoiDto>(`${API_BASE_URL}/api/v1/pois`, {
    method: 'POST',
    headers: buildHeaders('application/json'),
    body: JSON.stringify(payload),
  });

export const updatePoi = (id: string, payload: Omit<UpsertPoiPayload, 'id'>) =>
  requestJson<MapPoiDto>(`${API_BASE_URL}/api/v1/pois/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: buildHeaders('application/json'),
    body: JSON.stringify(payload),
  });

export const deletePoi = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/pois/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: buildHeaders(),
  });
  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(responseText || `Erro ${response.status} ao deletar o POI ${id}`);
  }
};

export const trackPoiAccess = async (id: string, source = 'front-map') => {
  await fetch(`${API_BASE_URL}/api/v1/pois/${encodeURIComponent(id)}/access`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source }),
  });
};
