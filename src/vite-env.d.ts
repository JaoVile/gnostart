/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_MAP_ID?: string;
  readonly VITE_ADMIN_API_KEY?: string;
  readonly VITE_REQUIRE_ACCESS_GATE?: string;
  readonly VITE_REQUIRE_TEMP_LOGIN?: string;
  readonly VITE_ACCESS_GATE_USERNAME?: string;
  readonly VITE_ACCESS_GATE_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
