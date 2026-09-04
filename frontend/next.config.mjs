import { config as loadEnv } from "dotenv";

// APP_ENV=staging|production で .env.staging / .env.production を読む。
// 未指定（ローカル dev）は Next 既定の .env / .env.local に任せる。
const appEnv = process.env.APP_ENV;
if (appEnv) {
  loadEnv({ path: `.env.${appEnv}` });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静的書き出し（SSG）。全ページ認証必須のため中身は CSR で描画し、
  // 未知の動的パスは wrangler の not_found_handling: single-page-application が index.html へ回す。
  output: "export",
  distDir: "out",
  reactStrictMode: true,
  images: { unoptimized: true },
  // /cards/xxx を /cards/xxx/index.html として出力し、静的配信と相性を良くする
  trailingSlash: true,
  // API 先は全環境 NEXT_PUBLIC_API_BASE_URL で指定する。
  // （output: "export" では rewrites が出力されないため、dev だけプロキシに頼る構成は取らない）
};

export default nextConfig;
