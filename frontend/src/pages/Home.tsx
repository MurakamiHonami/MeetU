import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import BookmarkRoundedIcon from "@mui/icons-material/BookmarkRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";
import SwipeDeck from "../components/SwipeDeck";
import TagInput, { type PickedTag } from "../components/TagInput";
import { api, type Card, type Owner } from "../lib/api";
import { currentPosition } from "../lib/device";

type Me = Owner & { cardCount: number; favorites?: { tagId: string; name: string }[] };

export default function Home() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [savingHome, setSavingHome] = useState(false);
  const [favorites, setFavorites] = useState<PickedTag[]>([]);
  const [savingFav, setSavingFav] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const loadFeed = useCallback(async () => {
    setLoadingFeed(true);
    try {
      const res = await api.feed();
      setCards(res.cards);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    api
      .me()
      .then((res) => {
        const user = res.user as Me;
        setMe(user);
        setFavorites((user.favorites ?? []).map((f) => ({ name: f.name })));
        // 好み未設定なら設定パネルを開いておく
        setSettingsOpen((user.favorites?.length ?? 0) === 0);
      })
      .catch((e) => setError(e.message));
    void loadFeed();
  }, [loadFeed]);

  async function saveFavorites() {
    setSavingFav(true);
    setError("");
    try {
      const res = await api.updateFavorites(favorites.map((f) => ({ name: f.name })));
      setMe((prev) => (prev ? { ...prev, favorites: res.user.favorites } : prev));
      setEditing(false);
      setSettingsOpen(false);
      await loadFeed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingFav(false);
    }
  }

  async function saveHome(point: { lat: number; lon: number } | null) {
    setSavingHome(true);
    setError("");
    try {
      const res = await api.updateHome(point);
      setMe((prev) => (prev ? { ...prev, homeLocation: res.user.homeLocation } : prev));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingHome(false);
    }
  }

  function swipe(card: Card, action: "save" | "skip") {
    const call = action === "save" ? api.saveCard : api.skipCard;
    setCards((prev) => prev.filter((c) => c.cardId !== card.cardId));
    call(card.cardId).catch((e) => setError((e as Error).message));
  }

  if (error && !me) return <p className="error">{error}</p>;
  if (!me) return <p className="loading">読み込み中…</p>;

  const hasFavorites = (me.favorites?.length ?? 0) > 0;

  return (
    <div className="page home-page">
      <section className="profile profile-compact">
        {me.pictureUrl && <img src={me.pictureUrl} alt="" className="avatar avatar-sm" />}
        <div>
          <h2>{me.displayName}</h2>
          <p className="profile-meta">
            {me.isNew ? (
              <span className="tagline tagline-new">まだ評価がありません</span>
            ) : (
              <span className="tagline">
                ★{me.ratingAvg}（{me.ratingCount}件）・取引{me.tradeCount}回
              </span>
            )}
          </p>
        </div>
      </section>

      {/* スワイプをホームの主役に */}
      <section className="home-feed">
        <h2>新着をチェック</h2>
        <p className="hint deck-help">
          右にスワイプで保存、左でスキップ。
          {hasFavorites ? "好みに近い順に並んでいます。" : "好きな作品を登録すると並び順が変わります。"}
        </p>

        {loadingFeed ? (
          <p className="loading">新着を読み込み中…</p>
        ) : (
          <SwipeDeck
            cards={cards}
            onSave={(c) => swipe(c, "save")}
            onSkip={(c) => swipe(c, "skip")}
            onOpen={(c) => navigate(`/cards/${c.cardId}`)}
          />
        )}
      </section>

      <button
        type="button"
        className="home-settings-toggle"
        onClick={() => setSettingsOpen((v) => !v)}
        aria-expanded={settingsOpen}
      >
        <span>プロフィール・好みの設定</span>
        <ExpandMoreRoundedIcon className={settingsOpen ? "is-open" : ""} />
      </button>

      {settingsOpen && (
        <div className="home-settings">
          <section className="panel">
            <div className="fav-head">
              <strong>好きな作品</strong>
              {!editing && (
                <button className="link" onClick={() => setEditing(true)}>
                  {hasFavorites ? "編集" : "登録する"}
                </button>
              )}
            </div>

            {editing ? (
              <>
                <TagInput
                  value={favorites}
                  onChange={setFavorites}
                  required={[]}
                  onRequiredChange={() => {}}
                  max={20}
                />
                <div className="actions">
                  <button className="primary" disabled={savingFav} onClick={saveFavorites}>
                    {savingFav ? "保存中…" : "保存する"}
                  </button>
                  <button onClick={() => setEditing(false)}>やめる</button>
                </div>
              </>
            ) : hasFavorites ? (
              <div className="chips chips-sm">
                {me.favorites!.map((f) => (
                  <span key={f.tagId} className="chip">
                    {f.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="hint">好きな作品を登録すると、新着カードが好みに近い順に並びます。</p>
            )}
          </section>

          <section className="panel">
            <div className="fav-head">
              <strong>拠点</strong>
              {me.homeLocation && (
                <button className="link" disabled={savingHome} onClick={() => saveHome(null)}>
                  外す
                </button>
              )}
            </div>
            {me.homeLocation ? (
              <p className="card-detail">
                <PlaceRoundedIcon fontSize="inherit" /> 設定済み
                <span className="hint">
                  {me.homeLocation.lat.toFixed(3)}, {me.homeLocation.lon.toFixed(3)}
                </span>
              </p>
            ) : (
              <button
                className="teal"
                disabled={savingHome}
                onClick={() =>
                  currentPosition()
                    .then(saveHome)
                    .catch((e) => setError((e as Error).message))
                }
              >
                <PlaceRoundedIcon fontSize="small" />{" "}
                {savingHome ? "設定中…" : "現在地を拠点にする"}
              </button>
            )}
            <p className="hint">条件が合う相手が複数いるとき、拠点が近い人から順にマッチします。</p>
          </section>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="menu">
        <button className="menu-item primary" onClick={() => navigate("/cards/new")}>
          <span className="menu-icon">
            <AddCircleRoundedIcon />
          </span>
          <span className="menu-text">
            <strong>カードを登録する</strong>
            <span>【譲】【求】【同行者求】をタグで登録</span>
          </span>
        </button>

        <button className="menu-item" onClick={() => navigate("/nearby")}>
          <span className="menu-icon icon-teal">
            <MapRoundedIcon />
          </span>
          <span className="menu-text">
            <strong>近くのカードを探す</strong>
            <span>地図でその場で交換できる相手を見つける</span>
          </span>
        </button>

        <button className="menu-item" onClick={() => navigate("/saved")}>
          <span className="menu-icon icon-pink">
            <BookmarkRoundedIcon />
          </span>
          <span className="menu-text">
            <strong>保存したカード</strong>
            <span>スワイプで保存したカードを見る</span>
          </span>
        </button>

        <button className="menu-item" onClick={() => navigate("/matches")}>
          <span className="menu-icon icon-gold">
            <FavoriteRoundedIcon />
          </span>
          <span className="menu-text">
            <strong>マッチ一覧</strong>
            <span>条件が一致した相手を確認する</span>
          </span>
        </button>

        <button className="menu-item" onClick={() => navigate("/cards/mine")}>
          <span className="menu-icon icon-teal">
            <StyleRoundedIcon />
          </span>
          <span className="menu-text">
            <strong>自分のカード</strong>
            <span>{me.cardCount}件 登録済み</span>
          </span>
        </button>
      </div>
    </div>
  );
}
