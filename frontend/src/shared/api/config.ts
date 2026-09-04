/** 空 = 同一オリジン（next dev の rewrites）。staging/production は .env で API URL を指定 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
