import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { AppShell } from "../app/AppShell";
import { RequireAuth } from "../app/RequireAuth";
import "../styles.css";

/** 認証不要なページ。これ以外は RequireAuth で保護する。 */
const PUBLIC_PAGES = ["/login", "/signup", "/lp"];

export default function App({ Component, pageProps }: AppProps) {
  const { pathname } = useRouter();
  const isPublic = PUBLIC_PAGES.includes(pathname);

  const page = <Component {...pageProps} />;

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#e43d81" />
        <title>MeetU</title>
      </Head>
      <AppShell>{isPublic ? page : <RequireAuth>{page}</RequireAuth>}</AppShell>
    </>
  );
}
