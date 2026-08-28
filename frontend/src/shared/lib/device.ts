/**
 * 端末まわりの処理。
 * 現在地はブラウザ標準の navigator.geolocation を使う。
 */

import type { GeoPoint } from "../../entities/user/geo";

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 30000,
};

export function currentPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("この端末では位置情報を取得できません"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => {
        const messages: Record<number, string> = {
          1: "位置情報の利用が許可されていません。端末の設定を確認してください。",
          2: "現在地を取得できませんでした。電波状況を確認してください。",
          3: "現在地の取得がタイムアウトしました。",
        };
        reject(new Error(messages[err.code] ?? "現在地を取得できませんでした"));
      },
      GEO_OPTIONS,
    );
  });
}

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export function shrinkImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      if (scale === 1 && file.size < 1024 * 1024) {
        resolve(file);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(new File([blob], "photo.jpg", { type: "image/jpeg" }));
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export function mapLink(point: { lat: number; lon: number }) {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lon}`;
}
