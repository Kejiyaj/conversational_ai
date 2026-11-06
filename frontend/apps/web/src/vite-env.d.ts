/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Token endpoint of the local stand-in identity provider (spec 008). */
  readonly VITE_OIDC_TOKEN_URL?: string;
}
