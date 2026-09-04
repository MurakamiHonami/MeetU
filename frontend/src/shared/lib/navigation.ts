import { useRouter } from "next/router";
import { useCallback } from "react";

/**
 * react-router の useNavigate と同じ呼び心地を next/router の上に用意する。
 * - navigate("/path")            → push
 * - navigate("/path", {replace}) → replace
 * - navigate(-1)                 → back
 *
 * widgets 層がルーター実装に直接依存しないための境界でもある。
 */
export function useNavigate() {
  const router = useRouter();

  return useCallback(
    (to: string | number, options?: { replace?: boolean }) => {
      if (typeof to === "number") {
        // react-router は任意の delta を取るが、実際の利用は -1（戻る）のみ
        if (to === -1) router.back();
        return;
      }
      if (options?.replace) void router.replace(to);
      else void router.push(to);
    },
    [router],
  );
}

/** 動的ルートのパラメータを取り出す。hydration 前は空文字を返す。 */
export function useRouteParam(name: string): { value: string; ready: boolean } {
  const router = useRouter();
  const raw = router.query[name];
  return {
    value: typeof raw === "string" ? raw : "",
    ready: router.isReady,
  };
}

/** クエリ文字列の単一値を取り出す（react-router の useSearchParams 相当の最小版）。 */
export function useQueryParam(name: string): string | null {
  const router = useRouter();
  const raw = router.query[name];
  return typeof raw === "string" ? raw : null;
}
