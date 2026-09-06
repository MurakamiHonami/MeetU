import { useNavigate } from "../../shared/lib/navigation";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import BookmarkRoundedIcon from "@mui/icons-material/BookmarkRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";

/** サービスの流れ。ホームで最初に伝えるのはこの3つだけに絞る */
const STEPS = [
  {
    icon: StyleRoundedIcon,
    tone: "icon-pink",
    title: "お取引カードを登録する",
    body: "【譲】・【求】のカード種別と、作品名・グループ名・グッズの種類などのタグを登録します。",
  },
  {
    icon: FavoriteRoundedIcon,
    tone: "icon-gold",
    title: "条件が合う相手と自動でマッチ",
    body: "マッチ内容を確認し、承認することでマッチングが成立します。3人以上の交換など、複雑な取引もサポートします。",
  },
  {
    icon: ChatRoundedIcon,
    tone: "icon-teal",
    title: "トークして取引する",
    body: "マッチが成立するとトークが開きます。受け渡し場所や日程はここで決めます。",
  },
];

/**
 * ホームは「このサービスで何ができるか」と最優先行動（カード登録）だけを置く。
 * 名前・評価実績はヘッダーのユーザーアイコン、新着カードは「探す」タブに移した。
 */
export function HomeView() {
  const navigate = useNavigate();

  return (
    <div className="page home-page">
      <section className="hero">
        <p className="hero-lead">グッズ交換をAIがアシストし、</p>
        <h1 className="hero-title">理想のお取引相手とマッチングする</h1>
        <p className="hero-body">
          お取引の条件をカードにして登録すると、MeetU が最適な相手を探してマッチングをアシスト。
        </p>
        <button className="hero-cta primary" onClick={() => navigate("/cards/new")}>
          <AddCircleRoundedIcon />
          お取引カードを登録する
        </button>
        <button className="hero-cta hero-cta-sub teal" onClick={() => navigate("/search")}>
          <SearchRoundedIcon />
          お取引カードを探す
        </button>
      </section>

      <section className="steps">
        <h2>使いかた</h2>
        <ol className="steplist">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="step">
                <span className={`step-icon ${step.tone}`}>
                  <Icon />
                </span>
                <div className="step-text">
                  <strong>
                    <span className="step-no">{i + 1}</span>
                    {step.title}
                  </strong>
                  <span>{step.body}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="panel trust">
        <strong>安心して取引するために</strong>
        <ul>
          <li>取引が終わったら、お互いを5段階で評価します。相手の評価はカードから確認できます。</li>
          <li>通報が重なったアカウントは自動で利用を停止します。</li>
          <li>拠点を登録すると、近い相手から優先してマッチします。</li>
        </ul>
      </section>

      <div className="quicklinks">
        <button className="quicklink" onClick={() => navigate("/cards/mine")}>
          <StyleRoundedIcon fontSize="small" />
          自分のカード
        </button>
        <button className="quicklink" onClick={() => navigate("/saved")}>
          <BookmarkRoundedIcon fontSize="small" />
          保存したカード
        </button>
      </div>
    </div>
  );
}
