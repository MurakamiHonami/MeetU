import "@cloudflare/vitest-pool-workers/types";

declare module "*.sql?raw" {
  const content: string;
  export default content;
}

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      CACHE_KV: KVNamespace;
      UPLOADS_R2: R2Bucket;
      JWT_SECRET: string;
      GEMINI_API_KEY?: string;
      LINE_LOGIN_CHANNEL_ID: string;
      LINE_CHANNEL_ACCESS_TOKEN: string;
      LINE_CHANNEL_SECRET: string;
    }
  }
}

declare module "cloudflare:workers" {
  interface Env {
    DB: D1Database;
    CACHE_KV: KVNamespace;
    UPLOADS_R2: R2Bucket;
    JWT_SECRET: string;
    GEMINI_API_KEY?: string;
    LINE_LOGIN_CHANNEL_ID: string;
    LINE_CHANNEL_ACCESS_TOKEN: string;
    LINE_CHANNEL_SECRET: string;
  }
}
