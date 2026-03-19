/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_MAP_ID?: string;
  readonly VITE_ADMIN_API_KEY?: string;
  readonly VITE_REQUIRE_TEMP_LOGIN?: string;
  readonly VITE_MAP_OVERLAY_URL?: string;
  readonly VITE_USE_TEST_MAP_CENTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
