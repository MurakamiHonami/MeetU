import '@cloudflare/vitest-pool-workers';

declare module '*.sql?raw' {
  const content: string;
  export default content;
}

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database;
    CACHE_KV: KVNamespace;
    UPLOADS_R2: R2Bucket;
    JWT_SECRET: string;
    LINE_LOGIN_CHANNEL_ID: string;
    LINE_CHANNEL_ACCESS_TOKEN: string;
    LINE_CHANNEL_SECRET: string;
  }
}
