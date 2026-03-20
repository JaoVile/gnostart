import {
  buildApiUrl,
  clearBackendTemporarilyUnavailable,
  getBackendTemporarilyUnavailableMessage,
  isBackendTemporarilyUnavailable,
  markBackendTemporarilyUnavailable,
} from './apiBase';

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

export type AgendaPoiLinksDto = Record<string, string>;

interface MapBootstrapResponse {
  map: {
    id: string;
    nome: string;
    eventName: string;
  };
  pois: MapPoiDto[];
  agendaPoiLinks?: AgendaPoiLinksDto;
}

interface AgendaPoiLinksResponse {
  links: AgendaPoiLinksDto;
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

const MAP_ID = import.meta.env.VITE_MAP_ID || 'default_map';
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || '';
const BOOTSTRAP_REQUEST_DEDUPE_MS = 600;
let bootstrapRequestPromise: Promise<MapBootstrapResponse> | null = null;

const buildHeaders = (contentType?: string): Headers => {
  const headers = new Headers();
  if (contentType) headers.set('Content-Type', contentType);
  if (ADMIN_API_KEY) headers.set('x-admin-key', ADMIN_API_KEY);
  return headers;
};

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  if (isBackendTemporarilyUnavailable()) {
    throw new Error(getBackendTemporarilyUnavailableMessage());
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    const message = 'Nao foi possivel alcancar o backend do mapa agora. O app vai seguir com a base local.';
    markBackendTemporarilyUnavailable(message);
    throw new Error(message);
  }

  if (!response.ok) {
    const responseText = await response.text();
    const message = responseText || `Erro ${response.status} ao acessar ${url}`;
    if (response.status >= 500) {
      markBackendTemporarilyUnavailable(
        'O backend do mapa respondeu com falha temporaria. O app vai seguir com a base local por alguns segundos.',
      );
    }
    throw new Error(message);
  }

  clearBackendTemporarilyUnavailable();
  return (await response.json()) as T;
};

export const fetchMapBootstrap = () => {
  if (!bootstrapRequestPromise) {
    bootstrapRequestPromise = requestJson<MapBootstrapResponse>(
      buildApiUrl(`/api/v1/map/bootstrap?mapId=${encodeURIComponent(MAP_ID)}&includeGraph=false`),
    ).finally(() => {
      globalThis.setTimeout(() => {
        bootstrapRequestPromise = null;
      }, BOOTSTRAP_REQUEST_DEDUPE_MS);
    });
  }

  return bootstrapRequestPromise;
};

export const saveAgendaPoiLinks = (links: AgendaPoiLinksDto) =>
  requestJson<AgendaPoiLinksResponse>(buildApiUrl('/api/v1/map/agenda-links'), {
    method: 'PUT',
    headers: buildHeaders('application/json'),
    body: JSON.stringify({ links }),
  });

export const createPoi = (payload: UpsertPoiPayload) =>
  requestJson<MapPoiDto>(buildApiUrl('/api/v1/pois'), {
    method: 'POST',
    headers: buildHeaders('application/json'),
    body: JSON.stringify(payload),
  });

export const updatePoi = (id: string, payload: Omit<UpsertPoiPayload, 'id'>) =>
  requestJson<MapPoiDto>(buildApiUrl(`/api/v1/pois/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: buildHeaders('application/json'),
    body: JSON.stringify(payload),
  });

export const deletePoi = async (id: string) => {
  const response = await fetch(buildApiUrl(`/api/v1/pois/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: buildHeaders(),
  });
  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(responseText || `Erro ${response.status} ao deletar o POI ${id}`);
  }
};

export const trackPoiAccess = async (id: string, source = 'front-map') => {
  await fetch(buildApiUrl(`/api/v1/pois/${encodeURIComponent(id)}/access`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source }),
  });
};
