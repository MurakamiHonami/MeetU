import { BY_EXTENSION, GET_EXPIRES_SEC, PUT_EXPIRES_SEC } from "../../domain/upload/UploadPolicy";

interface UploadTicket {
  key: string;
  contentType: string;
}

/**
 * R2 への画像アップロード・閲覧。
 * ブラウザからの直接 PUT を Worker 経由で受け、KV トークンで認可する。
 */
export class R2UploadService {
  constructor(
    private bucket: R2Bucket,
    private kv: KVNamespace,
    private baseUrl: string,
  ) {}

  async createUploadTicket(
    key: string,
    contentType: string,
  ): Promise<{
    uploadUrl: string;
    imageKey: string;
    contentType: string;
    maxBytes: number;
  }> {
    const token = crypto.randomUUID();
    const ticket: UploadTicket = { key, contentType };
    await this.kv.put(`upload:${token}`, JSON.stringify(ticket), {
      expirationTtl: PUT_EXPIRES_SEC,
    });

    return {
      uploadUrl: `${this.baseUrl}/api/uploads/put?token=${token}`,
      imageKey: key,
      contentType,
      maxBytes: 5 * 1024 * 1024,
    };
  }

  async handlePut(token: string, body: ReadableStream | ArrayBuffer | null): Promise<void> {
    const raw = await this.kv.get(`upload:${token}`);
    if (!raw) throw new Error("アップロードの有効期限が切れています");

    const ticket = JSON.parse(raw) as UploadTicket;
    if (!body) throw new Error("画像データがありません");

    await this.bucket.put(ticket.key, body, {
      httpMetadata: { contentType: ticket.contentType },
    });
    await this.kv.delete(`upload:${token}`);
  }

  async createViewUrl(key: string): Promise<string | null> {
    try {
      const obj = await this.bucket.head(key);
      if (!obj) return null;

      const token = crypto.randomUUID();
      await this.kv.put(`view:${token}`, key, { expirationTtl: GET_EXPIRES_SEC });
      return `${this.baseUrl}/api/uploads/view?token=${token}`;
    } catch {
      return null;
    }
  }

  async handleView(token: string): Promise<{ body: ReadableStream; contentType: string } | null> {
    const key = await this.kv.get(`view:${token}`);
    if (!key) return null;

    const obj = await this.bucket.get(key);
    if (!obj) return null;

    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    const contentType =
      obj.httpMetadata?.contentType ?? BY_EXTENSION[ext] ?? "application/octet-stream";
    return { body: obj.body, contentType };
  }
}
