import Head from "next/head";
import { LandingView } from "../widgets/lp/LandingView";

export default function Lp() {
  return (
    <>
      <Head>
        <title>MeetU | エンジニアの技術書交換・積読管理</title>
        <meta
          name="description"
          content="【譲】と【求】をタグで登録するだけ。一致したタグの件数で条件の合う相手と自動マッチ。3人以上の交換にも対応した、エンジニア向けの技術書交換・積読管理サービスです。"
        />
      </Head>
      <LandingView />
    </>
  );
}
