const normalizeApiBaseUrl = (value: string | undefined) => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || trimmed === '/') return '';

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '');
  }

  return `/${trimmed.replace(/^\/+/, '').replace(/\/+$/, '')}`;
};

const isLoopbackApiBaseUrl = (value: string) => {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1';
  } catch {
    return false;
  }
};

const configuredApiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

export const API_BASE_URL =
  !import.meta.env.DEV && isLoopbackApiBaseUrl(configuredApiBaseUrl) ? '' : configuredApiBaseUrl;

export const buildApiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

const BACKEND_UNAVAILABLE_COOLDOWN_MS = 20000;
const BACKEND_UNAVAILABLE_DEFAULT_MESSAGE =
  'Backend temporariamente indisponivel. O app vai continuar com a base local por alguns segundos.';

let backendUnavailableUntil = 0;
let backendUnavailableMessage = BACKEND_UNAVAILABLE_DEFAULT_MESSAGE;

export const markBackendTemporarilyUnavailable = (message?: string) => {
  backendUnavailableUntil = Date.now() + BACKEND_UNAVAILABLE_COOLDOWN_MS;
  backendUnavailableMessage = message?.trim() || BACKEND_UNAVAILABLE_DEFAULT_MESSAGE;
};

export const clearBackendTemporarilyUnavailable = () => {
  backendUnavailableUntil = 0;
  backendUnavailableMessage = BACKEND_UNAVAILABLE_DEFAULT_MESSAGE;
};

export const isBackendTemporarilyUnavailable = () => Date.now() < backendUnavailableUntil;

export const getBackendTemporarilyUnavailableMessage = () => backendUnavailableMessage;
