import {
  buildApiUrl,
  clearBackendTemporarilyUnavailable,
  getBackendTemporarilyUnavailableMessage,
  isBackendTemporarilyUnavailable,
  markBackendTemporarilyUnavailable,
} from './apiBase';

export interface LocationContextRequest {
  lat: number;
  lng: number;
  accuracyMeters?: number;
  destination?: {
    lat: number;
    lng: number;
    label?: string;
    placeId?: string;
  };
}

export interface LocationContextResponse {
  provider: {
    googleConfigured: boolean;
    googleUsed: boolean;
  };
  reverseGeocode: {
    formattedAddress: string | null;
    placeId: string | null;
    types: string[];
  } | null;
  venue: {
    label: string | null;
    placeId: string | null;
    formattedAddress: string | null;
    distanceMeters: number | null;
    isWithinRadius: boolean | null;
    radiusMeters: number;
  } | null;
  externalRoute: {
    distanceMeters: number | null;
    durationSeconds: number | null;
    encodedPolyline: string | null;
    travelMode: 'WALK';
    destinationLabel: string | null;
  } | null;
  warnings: string[];
}

export const fetchLocationContext = async (payload: LocationContextRequest): Promise<LocationContextResponse> => {
  if (isBackendTemporarilyUnavailable()) {
    throw new Error(getBackendTemporarilyUnavailableMessage());
  }

  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/v1/location/context'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    const message = 'Nao foi possivel validar sua localizacao no backend agora. O GPS interno continua funcionando.';
    markBackendTemporarilyUnavailable(message);
    throw new Error(message);
  }

  if (!response.ok) {
    const responseText = await response.text();
    const message = responseText || `Erro ${response.status} ao consultar o contexto de localizacao.`;
    if (response.status >= 500) {
      markBackendTemporarilyUnavailable(
        'A validacao externa da localizacao ficou temporariamente indisponivel. O GPS interno continua funcionando.',
      );
    }
    throw new Error(message);
  }

  clearBackendTemporarilyUnavailable();
  return (await response.json()) as LocationContextResponse;
};
