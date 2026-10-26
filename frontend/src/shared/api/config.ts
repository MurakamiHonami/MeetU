/**
 * API 先は全環境 NEXT_PUBLIC_API_BASE_URL で絶対 URL を指定する。
 * output: "export" では next.config の rewrites が出力されないため、
 * dev でもプロキシ（同一オリジン）には頼らない設計。
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
