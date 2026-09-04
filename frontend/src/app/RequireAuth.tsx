import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getAccessToken, ensureSession } from "../shared/api";

/** 認証済みでなければ /login へ送る。判定はクライアントのみで行う（SSG のため）。 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = getAccessToken() !== null || (await ensureSession());
      if (cancelled) return;
      setAuthed(ok);
      setReady(true);
      if (!ok) {
        void router.replace({
          pathname: "/login",
          query: { from: router.asPath },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // router を依存に入れると asPath 変化で再実行されるため、マウント時のみ判定する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready || !authed) return <p className="loading">読み込み中…</p>;
  return <>{children}</>;
}
