import { hc } from "hono/client";
import type { AppType } from "@meetu/backend";
import { authenticatedFetch } from "./auth";
import { API_BASE } from "./config";

export { API_BASE } from "./config";

export const client = hc<AppType>(API_BASE, { fetch: authenticatedFetch });
