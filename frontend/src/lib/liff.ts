import liff from "@line/liff";

let ready: Promise<void> | null = null;

/** LIFF の初期化とログイン確認。アプリ起動時に 1 回だけ走る。 */
export function initLiff(): Promise<void> {
  if (ready) return ready;

  ready = (async () => {
    const liffId = import.meta.env.VITE_LIFF_ID as string;
    if (!liffId) {
      throw new Error("VITE_LIFF_ID が未設定です（frontend/.env を確認してください）");
    }

    await liff.init({ liffId });

    // 外部ブラウザで開かれた場合もここでログインに飛ばす
    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: window.location.href });
      // リダイレクトするので、この Promise は解決させない
      await new Promise(() => {});
    }
  })();

  return ready;
}

export function closeApp() {
  if (liff.isInClient()) liff.closeWindow();
}

/** LINE のトーク画面に戻して、相手に送る文面を用意する */
export function shareText(text: string) {
  if (!liff.isApiAvailable("shareTargetPicker")) return Promise.resolve(false);
  return liff.shareTargetPicker([{ type: "text", text }]).then(() => true);
}

export { liff };
