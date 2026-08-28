/** 空 = 同一オリジン（Vite プロキシ）。staging/production は .env で API URL を指定 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
