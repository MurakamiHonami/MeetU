import Head from "next/head";
import { LandingView } from "../widgets/lp/LandingView";

export default function Lp() {
  return (
    <>
      <Head>
        <title>MeetU | 推し活グッズ交換のタグマッチング</title>
        <meta
          name="description"
          content="【譲】と【求】をタグで登録するだけ。一致したタグの件数で条件の合う相手と自動マッチ。3人以上の交換にも対応した、推し活グッズ交換サービスです。"
        />
      </Head>
      <LandingView />
    </>
  );
}
