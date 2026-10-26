import Link from "next/link";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import LoopRoundedIcon from "@mui/icons-material/LoopRounded";
import ManageSearchRoundedIcon from "@mui/icons-material/ManageSearchRounded";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import RouteRoundedIcon from "@mui/icons-material/RouteRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";

/** 未ログインの人が最初に見る紹介ページ。アプリ本体（要ログイン）とは別レイアウトで置く。 */

/** 「自分でやると大変なこと」を先に言語化してから、しくみの説明に入る */
const PAINS = [
  "【譲】【求】の投稿がタイムラインに流れて、条件の合う人を見つけられない",
  "見つけても、持っているグッズが噛み合わず交渉が振り出しに戻る",
  "1対1では成立しない組み合わせを、あきらめるしかない",
];

/** カードに乗せる条件。マッチの判定に実際に効くものだけを並べる */
const CONDITIONS = [
  {
    icon: StarRoundedIcon,
    tone: "icon-gold",
    title: "★の必須タグ",
    body: "★を付けたタグは、相手が必ず持っている必要があります。作品違い・キャラ違いのマッチを避けられます。",
  },
  {
    icon: CalendarMonthRoundedIcon,
    tone: "icon-pink",
    title: "受け渡しできる日程",
    body: "お互いが日程を登録している場合、重なる日が1つもない相手とはマッチしません。",
  },
  {
    icon: PlaceRoundedIcon,
    tone: "icon-teal",
    title: "拠点",
    body: "拠点を登録すると、受け渡しの移動距離が小さくなる組み合わせが優先して提案されます。",
  },
];

/**
 * サービスを支える3つのコア機能を1画面で見比べるための表。
 * 「しくみ / 使う人のメリット / ビジネス価値」の3行を全列で揃えて、横に読めるようにする。
 * ベクトル検索は ADR-005 のフェーズ2（未着手）なので、実装済みと混ぜずに status で区別する。
 */
const CORE = [
  {
    icon: RouteRoundedIcon,
    tone: "icon-pink",
    name: "マッチング最適化",
    tagline: "距離を組み込んだ交換の輪の探索",
    status: "提供中",
    how: "人を頂点、「渡せる関係」を辺とする有向グラフの閉路探索です。タグ条件を満たす相手だけを辺として残し、枝は拠点が近い順にたどります。見つかった輪は合計移動距離が小さい順に採用し、同じカードが複数の輪に重複しないよう先頭から排他的に選びます。3〜4人の輪に限った探索はNP完全なため、深さ・分岐・訪問数に上限を置いて打ち切ります。",
    merit:
      "相手探しも組み合わせ探しも不要です。1対1では諦めるしかなかった取引が成立し、受け渡しの移動も短く収まります。",
    biz: "同じ登録数から成立しうる組み合わせが増え、同時に「遠くて会えない」という離脱要因も下げられます。腎臓交換で研究されてきたバーター交換クリアリング問題として定式化してあるため、規模が拡大したときの打ち手（近似解法・厳密解法）まで設計済みです。",
  },
  {
    icon: PhotoCameraRoundedIcon,
    tone: "icon-teal",
    name: "画像からのタグ推定",
    tagline: "写真1枚からタグ候補を生成",
    status: "提供中",
    how: "グッズの写真をビジョンLLMに渡し、作品名・キャラ名・アイテム種別などをJSONで抽出します。カテゴリは既定の種類に制約し、結果は必ず候補として提示。ユーザーが確認・編集してから確定します。推定中もフォーム操作は止めません。",
    merit:
      "「作品名・キャラ名・グッズ種別」を毎回自分で言語化する負担がなくなります。タグの付け漏れも減ります。",
    biz: "タグの品質と網羅性がマッチ精度を直接左右するため、入力負担の軽減がそのまま成立の母数に効きます。登録フォームでの離脱も抑えられます。",
  },
  {
    icon: ManageSearchRoundedIcon,
    tone: "icon-gold",
    name: "タグのベクトル検索",
    tagline: "表記ゆれ・同義語を吸収する検索",
    status: "開発中",
    how: "カードではなく“タグ”をテキスト埋め込みします。検索は前方一致とベクトル近傍のハイブリッドにし、マッチングの判定そのものは離散的な数え上げのまま変えません。",
    merit:
      "「五条」で検索して「五条悟」のカードが出る、「アクスタ」と「アクリルスタンド」がつながる、といった取りこぼしがなくなります。",
    biz: "埋め込む対象がカードではなく語彙なので、カードが増えてもベクトル数と埋め込みコストは頭打ちになります。検索の取りこぼしが減ることは、そのまま出品の死蔵を減らすことにつながります。",
  },
];

const STEPS = [
  {
    icon: StyleRoundedIcon,
    tone: "icon-pink",
    title: "お取引カードを登録する",
    body: "【譲】【求】のカード種別と、作品名・キャラ名・グッズの種類などのタグを登録します。写真からタグ候補を出すこともできます。",
  },
  {
    icon: FavoriteRoundedIcon,
    tone: "icon-gold",
    title: "条件が合う相手と自動でマッチ",
    body: "条件を満たす相手が見つかると通知が届きます。1対1だけでなく、3〜4人の交換の輪も提案されます。",
  },
  {
    icon: ChatRoundedIcon,
    tone: "icon-teal",
    title: "トークして取引する",
    body: "マッチが成立するとトークが開きます。受け渡しの場所や日程はここで決めます。",
  },
];

const SAFETY = [
  {
    icon: StarRoundedIcon,
    title: "取引後の相互評価",
    body: "取引が終わったら、お互いを5段階で評価します。相手の評価はカードから確認できます。",
  },
  {
    icon: ShieldRoundedIcon,
    title: "通報でアカウント停止",
    body: "通報が重なったアカウントは自動で利用を停止します。",
  },
  {
    icon: PlaceRoundedIcon,
    title: "拠点は距離の計算に使う",
    body: "登録した拠点は、近い相手を優先するための距離計算に使います。地図から半径を指定して探すこともできます。",
  },
];

const FAQ = [
  {
    q: "登録に必要なものは？",
    a: "メールアドレスとパスワード、または X アカウントで登録できます。",
  },
  {
    q: "使いたいタグが無いときは？",
    a: "既存のタグから選ぶほかに、その場で新しいタグを作れます。",
  },
  {
    q: "マッチした相手とすぐ取引しないといけない？",
    a: "いいえ。マッチ内容を確認して承認した場合だけ成立します。承認しなければトークも開きません。",
  },
  {
    q: "3人以上の交換はどう成立する？",
    a: "全員が承認したときに成立します。誰が誰に何を渡すかは、成立前に一覧で確認できます。",
  },
  {
    q: "拠点を登録しないと使えない？",
    a: "使えます。ただし距離が計算できないぶん、移動距離を優先した提案の中では順位が下がります。",
  },
];

/** ヘッダーとフッターの両方に同じ導線を置く。押し先は会員登録とログインの2つだけに絞る */
function CtaButtons({ variant }: { variant?: "compact" }) {
  return (
    <div className={`lp-cta${variant === "compact" ? " lp-cta-compact" : ""}`}>
      <Link href="/signup" className="lp-btn lp-btn-pink">
        今すぐはじめる
        <ArrowForwardRoundedIcon fontSize="small" />
      </Link>
      <Link href="/login" className="lp-btn lp-btn-plain">
        ログイン
      </Link>
    </div>
  );
}

/** 輪の1本。who →(距離) who を並べて、辺ごとの移動距離を見せる */
function CycleCase({
  name,
  hops,
  total,
  best,
}: {
  name: string;
  hops: { from: string; to: string; km: number }[];
  total: number;
  best?: boolean;
}) {
  return (
    <article className={`lp-case${best ? " lp-case-best" : ""}`}>
      <header className="lp-case-head">
        <strong>{name}</strong>
        {best ? (
          <span className="lp-case-badge">これを提案</span>
        ) : (
          <span className="lp-case-badge lp-case-badge-off">見送り</span>
        )}
      </header>
      <ol className="lp-cycle-steps">
        {hops.map((hop) => (
          <li key={`${hop.from}-${hop.to}`}>
            <span className={`lp-cycle-who${hop.from === "あなた" ? " lp-cycle-me" : ""}`}>
              {hop.from}
            </span>
            <span className="lp-hop">
              <ArrowForwardRoundedIcon fontSize="small" />
              {hop.km}km
            </span>
            <span className={`lp-cycle-who${hop.to === "あなた" ? " lp-cycle-me" : ""}`}>
              {hop.to}
            </span>
          </li>
        ))}
      </ol>
      <p className="lp-case-total">
        合計移動距離 <strong>{total}km</strong>
      </p>
    </article>
  );
}

export function LandingView() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <span className="lp-nav-brand">
          <span className="lp-nav-logo">
            <img src="/logo.png" alt="" />
          </span>
          MeetU
        </span>
        <CtaButtons variant="compact" />
      </header>

      <section className="lp-hero">
        <div className="lp-hero-text">
          <p className="lp-eyebrow">推し活のグッズ交換に</p>
          <h1 className="lp-title">
            【譲】と【求】を、
            <br />
            タグでつなぐ。
          </h1>
          <p className="lp-lead">
            作品名・キャラ名・グッズの種類をタグで登録するだけ。条件が合う相手と、いちばん近い受け渡しの組み合わせを
            MeetU が探します。
          </p>
          <CtaButtons />
        </div>

        {/* マッチの考え方を一目で見せる。文章より先にこの図を読ませたい */}
        <div className="lp-demo">
          <div className="lp-demo-card lp-demo-want">
            <span className="lp-demo-label">【求】</span>
            <div className="chips chips-sm">
              <span className="chip lp-chip-hit">プロセカ</span>
              <span className="chip lp-chip-hit">天馬司</span>
              <span className="chip">アクスタ</span>
            </div>
          </div>
          <div className="lp-demo-card lp-demo-give">
            <span className="lp-demo-label">【譲】</span>
            <div className="chips chips-sm">
              <span className="chip lp-chip-hit">プロセカ</span>
              <span className="chip lp-chip-hit">天馬司</span>
              <span className="chip">缶バッジ</span>
            </div>
          </div>
          <p className="lp-demo-result">
            タグが噛み合う相手が<strong>候補に残る</strong>
          </p>
          <p className="lp-demo-next">
            ここから先が MeetU の仕事。誰と誰を組ませると全員が近くで受け渡せるかを探します。
          </p>
        </div>
      </section>

      <section className="lp-section lp-pains">
        <h2>こんなところで止まっていませんか</h2>
        <ul className="lp-painlist">
          {PAINS.map((pain) => (
            <li key={pain}>{pain}</li>
          ))}
        </ul>
        <p className="lp-pains-turn">相手探しと組み合わせ探しは、MeetU が引き受けます。</p>
      </section>

      <section className="lp-section">
        <h2>カードに付ける条件</h2>
        <p className="lp-section-lead">
          条件はすべて<strong>タグ</strong>
          で登録します。既存のタグから選ぶことも、その場で新しく作ることもできます。
        </p>
        <div className="lp-grid">
          {CONDITIONS.map((cond) => {
            const Icon = cond.icon;
            return (
              <article key={cond.title} className="lp-card">
                <span className={`step-icon ${cond.tone}`}>
                  <Icon />
                </span>
                <strong>{cond.title}</strong>
                <p>{cond.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* 他サービスと一番違うところなので、単独のセクションで図と一緒に見せる */}
      <section className="lp-section">
        <h2>1対1で無理でも、輪になれば成立する</h2>
        <div className="lp-cycle">
          <div className="lp-cycle-text">
            <span className="step-icon icon-teal">
              <LoopRoundedIcon />
            </span>
            <p>
              あなたが欲しいものを持っている人が、あなたの譲りたいものを欲しがっているとは限りません。MeetU
              は3〜4人をまたぐ交換の輪も探します。
            </p>
            <p>
              輪は1通りとは限りません。見つかった候補は<strong>合計移動距離が短い順</strong>
              に並べ、同じカードが複数の輪に重複しないように選びます。
            </p>
            <p>
              成立前に「誰が誰に何を渡すか」を一覧で確認でき、全員が承認したときだけ成立します。
            </p>
          </div>
          <div className="lp-cycle-cases">
            <p className="lp-figcap">例：同じ3人で2通りの輪が見つかったとき</p>
            <CycleCase
              name="候補A"
              best
              hops={[
                { from: "あなた", to: "Bさん", km: 4 },
                { from: "Bさん", to: "Cさん", km: 3 },
                { from: "Cさん", to: "あなた", km: 5 },
              ]}
              total={12}
            />
            <CycleCase
              name="候補B"
              hops={[
                { from: "あなた", to: "Cさん", km: 15 },
                { from: "Cさん", to: "Bさん", km: 11 },
                { from: "Bさん", to: "あなた", km: 12 },
              ]}
              total={38}
            />
            <p className="lp-fignote">
              タグ条件はどちらも満たしています。分けるのは受け渡しの移動距離です。
            </p>
          </div>
        </div>
      </section>

      {/* 画像タグ推定とベクトル検索は「タグを育てる1本の流れ」なので、分けずに1枚の図で見せる */}
      <section className="lp-section">
        <h2>写真がタグになり、タグが検索を賢くする</h2>
        <p className="lp-section-lead">
          マッチングの精度はタグの質でほぼ決まります。だから MeetU は
          <strong>タグを集めるところ</strong>と<strong>言葉のゆれを吸収するところ</strong>
          の両方に手を入れています。
        </p>

        <div className="lp-flow">
          <article className="lp-flow-step">
            <header className="lp-flow-head">
              <span className="lp-flow-no">1</span>
              <span className="step-icon icon-pink">
                <PhotoCameraRoundedIcon />
              </span>
              <strong>写真 → タグ候補</strong>
            </header>
            <div className="lp-flow-fig">
              <span className="lp-flow-photo">グッズの写真</span>
              <span className="lp-flow-down">
                <ArrowForwardRoundedIcon fontSize="small" />
                ビジョンLLM
              </span>
              <div className="chips chips-sm">
                <span className="chip">プロセカ</span>
                <span className="chip">天馬司</span>
                <span className="chip">アクスタ</span>
              </div>
              <span className="lp-flow-tick">ユーザーが確認・編集して確定</span>
            </div>
            <p>
              作品名・キャラ名・アイテム種別などをJSONで抽出します。カテゴリは既定の種類に制約し、結果は必ず
              <strong>候補</strong>として提示。自動では確定しません。
            </p>
          </article>

          <span className="lp-flow-arrow" aria-hidden="true">
            <ArrowForwardRoundedIcon />
          </span>

          <article className="lp-flow-step lp-flow-next">
            <header className="lp-flow-head">
              <span className="lp-flow-no">2</span>
              <span className="step-icon icon-gold">
                <ManageSearchRoundedIcon />
              </span>
              <strong>タグ → ベクトル</strong>
              <span className="lp-core-status lp-core-status-next lp-flow-status">開発中</span>
            </header>
            <div className="lp-flow-fig">
              <ul className="lp-synonyms">
                <li>
                  <span className="chip">五条</span>
                  <ArrowForwardRoundedIcon fontSize="small" />
                  <span className="chip lp-chip-hit">五条悟</span>
                </li>
                <li>
                  <span className="chip">アクスタ</span>
                  <ArrowForwardRoundedIcon fontSize="small" />
                  <span className="chip lp-chip-hit">アクリルスタンド</span>
                </li>
              </ul>
              <span className="lp-flow-tick">前方一致 ＋ ベクトル近傍のハイブリッド</span>
            </div>
            <p>
              埋め込むのはカードではなく<strong>タグそのもの</strong>
              です。語彙は収束するので、カードが増えてもベクトル数は頭打ちになります。
            </p>
          </article>

          <span className="lp-flow-arrow" aria-hidden="true">
            <ArrowForwardRoundedIcon />
          </span>

          <article className="lp-flow-step">
            <header className="lp-flow-head">
              <span className="lp-flow-no">3</span>
              <span className="step-icon icon-teal">
                <RouteRoundedIcon />
              </span>
              <strong>タグ → マッチング</strong>
            </header>
            <div className="lp-flow-fig">
              <span className="lp-flow-photo">条件を満たす相手だけが残る</span>
              <span className="lp-flow-down">
                <ArrowForwardRoundedIcon fontSize="small" />
                輪の探索と距離の最適化
              </span>
              <span className="lp-flow-tick">合計移動距離が最小の組み合わせを提案</span>
            </div>
            <p>
              ベクトルは<strong>名寄せにだけ</strong>
              使います。成立の判定は「タグが噛み合うかどうか」という離散的な条件のままなので、なぜマッチしたかを常に説明できます。
            </p>
          </article>
        </div>
      </section>

      {/* コア機能は縦に並べず、1画面で横に見比べられる形にする */}
      <section className="lp-section lp-core-section">
        <h2>サービスを支える3つのコア機能</h2>
        <p className="lp-section-lead">
          タグを「集める」「揃える」「組み合わせる」の3方向から支えています。
        </p>
        <div className="lp-core">
          {CORE.map((core) => {
            const Icon = core.icon;
            const upcoming = core.status === "開発中";
            return (
              <article key={core.name} className={`lp-core-col${upcoming ? " lp-core-next" : ""}`}>
                <header className="lp-core-head">
                  <span className={`step-icon ${core.tone}`}>
                    <Icon />
                  </span>
                  <span className={`lp-core-status${upcoming ? " lp-core-status-next" : ""}`}>
                    {core.status}
                  </span>
                  <strong>{core.name}</strong>
                  <span className="lp-core-tagline">{core.tagline}</span>
                </header>
                <dl className="lp-core-rows">
                  <div>
                    <dt>しくみ</dt>
                    <dd>{core.how}</dd>
                  </div>
                  <div>
                    <dt>使う人のメリット</dt>
                    <dd>{core.merit}</dd>
                  </div>
                  <div className="lp-core-biz">
                    <dt>ビジネス価値</dt>
                    <dd>{core.biz}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
        <p className="lp-core-note">
          「開発中」は設計を確定済みで実装前の機能です（ADR-005 フェーズ2）。
        </p>
      </section>

      <section className="lp-section">
        <h2>使いかた</h2>
        <ol className="lp-steplist">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="lp-step">
                <span className={`step-icon ${step.tone}`}>
                  <Icon />
                </span>
                <div className="lp-step-text">
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

      <section className="lp-section">
        <h2>安心して取引するために</h2>
        <div className="lp-grid">
          {SAFETY.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="lp-card lp-card-teal">
                <span className="step-icon icon-teal">
                  <Icon />
                </span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="lp-section">
        <h2>よくある質問</h2>
        <div className="lp-faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lp-final">
        <h2>推しのグッズを、次の人へ。</h2>
        <p>カードを1枚登録するところから始まります。</p>
        <CtaButtons />
      </section>

      <footer className="lp-foot">
        <span className="lp-foot-brand">MeetU</span>
        <nav>
          <Link href="/login">ログイン</Link>
          <Link href="/signup">会員登録</Link>
        </nav>
      </footer>
    </div>
  );
}
