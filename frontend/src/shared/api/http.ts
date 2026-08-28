export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export async function unwrap<T>(
  res: { ok: boolean; status: number; json(): Promise<unknown> },
): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { message?: string; error?: string }).message
      ?? (body as { error?: string }).error
      ?? `リクエストに失敗しました (${res.status})`;
    throw new ApiError(res.status, msg, (body as { code?: string }).code);
  }
  return body as T;
}

/** 署名付き URL へ直接 PUT（Authorization ヘッダ不要） */
export function putToStorage(url: string, file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.timeout = 60000;
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new ApiError(xhr.status, `画像を送れませんでした（HTTP ${xhr.status}）`));
    };
    xhr.onerror = () => reject(new ApiError(0, "画像の送信先に接続できませんでした"));
    xhr.ontimeout = () => reject(new ApiError(0, "画像の送信がタイムアウトしました"));
    xhr.send(file);
  });
}
