import {
  BY_EXTENSION,
  GET_EXPIRES_SEC,
  MAX_UPLOAD_BYTES,
  PUT_EXPIRES_SEC,
} from "../../domain/upload/UploadPolicy";
import { NotFoundError, ValidationError } from "../../domain/shared/DomainError";

interface UploadTicket {
  key: string;
  contentType: string;
  size: number;
}

/**
 * stream を先頭から読みながら宣言サイズ (`limit`) 超過をその場で検出し、
 * ArrayBuffer にまとめる。R2Bucket.put() はサイズ不明のストリーム
 * （TransformStream 等で加工した ReadableStream）を受け付けないため、
 * 実バイト数を検証したうえで長さ既知の ArrayBuffer に変換して渡す。
 * limit は MAX_UPLOAD_BYTES (5MB) 以下なので Worker 上でバッファしても問題ない。
 */
async function readWithLimit(stream: ReadableStream<Uint8Array>, limit: number) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new ValidationError("画像は 5MB 以内にしてください");
    }
    chunks.push(value);
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
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
    size: number,
  ): Promise<{
    uploadUrl: string;
    imageKey: string;
    contentType: string;
    maxBytes: number;
  }> {
    const token = crypto.randomUUID();
    const ticket: UploadTicket = { key, contentType, size };
    await this.kv.put(`upload:${token}`, JSON.stringify(ticket), {
      expirationTtl: PUT_EXPIRES_SEC,
    });

    return {
      uploadUrl: `${this.baseUrl}/api/uploads/put?token=${token}`,
      imageKey: key,
      contentType,
      maxBytes: MAX_UPLOAD_BYTES,
    };
  }

  async handlePut(
    token: string,
    body: ReadableStream | ArrayBuffer | null,
    contentLength: number | null,
  ): Promise<void> {
    const raw = await this.kv.get(`upload:${token}`);
    if (!raw) throw new NotFoundError("アップロードの有効期限が切れています");

    const ticket = JSON.parse(raw) as UploadTicket;
    if (!body) throw new ValidationError("画像データがありません");

    const limit = Math.min(ticket.size, MAX_UPLOAD_BYTES);
    if (contentLength !== null && contentLength > limit) {
      throw new ValidationError("画像は 5MB 以内にしてください");
    }

    let data: ArrayBuffer;
    if (body instanceof ArrayBuffer) {
      if (body.byteLength > limit) {
        throw new ValidationError("画像は 5MB 以内にしてください");
      }
      data = body;
    } else {
      data = (await readWithLimit(body, limit)).buffer;
    }

    await this.bucket.put(ticket.key, data, {
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
