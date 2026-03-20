const normalizeBooleanEnv = (value: string | undefined, fallback: boolean) => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized !== 'false';
};

export const ACCESS_GATE_STORAGE_KEY = 'gnostart.accessGateEnabled';
export const ACCESS_GATE_USERNAME = (import.meta.env.VITE_ACCESS_GATE_USERNAME || 'admin').trim();
export const ACCESS_GATE_PASSWORD = import.meta.env.VITE_ACCESS_GATE_PASSWORD || '654321';
export const REQUIRE_ACCESS_GATE = normalizeBooleanEnv(
  import.meta.env.VITE_REQUIRE_ACCESS_GATE || import.meta.env.VITE_REQUIRE_TEMP_LOGIN,
  true,
);
