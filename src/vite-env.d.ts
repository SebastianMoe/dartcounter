/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
    /** Optional PocketBase URL; defaults to the page origin */
    readonly VITE_PB_URL?: string;
}
