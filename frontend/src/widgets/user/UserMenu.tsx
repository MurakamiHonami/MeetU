import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import TagInput, { type PickedTag } from "../TagInput";
import { signOut } from "../../features/auth/api";
import { userApi } from "../../features/user/api";
import type { Owner } from "../../entities/user/model";
import { currentPosition } from "../../shared/lib/device";

type Me = Owner & { cardCount: number };

/** 表示名の1文字目。画像未設定のアバターに出す */
function initialOf(name: string): string {
  return [...name][0] ?? "?";
}

/**
 * ヘッダー右上のユーザーアイコン。
 * タップでプロフィール・自己紹介・好きな作品・拠点・ログアウトをまとめたモーダルを開く。
 * ホームから名前や評価実績を外し、ユーザー情報の導線をこの1か所に集約している。
 */
export function UserMenu() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    userApi
      .me()
      .then((res) => {
        if (alive) setMe(res.user as Me);
      })
      .catch(() => {
        // ヘッダーのアイコンは補助的な導線なので、取得失敗は画面に出さない
      });
    return () => {
      alive = false;
    };
  }, []);

  // モーダルを開いている間は背面をスクロールさせず、Esc で閉じられるようにする
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!me) return <span className="apphead-avatar apphead-avatar-empty" aria-hidden="true" />;

  return (
    <>
      <button
        type="button"
        className="apphead-avatar"
        onClick={() => setOpen(true)}
        aria-label={`${me.displayName} のメニュー`}
      >
        {me.pictureUrl ? (
          <img src={me.pictureUrl} alt="" />
        ) : (
          <span aria-hidden="true">{initialOf(me.displayName)}</span>
        )}
      </button>

      {open && (
        <UserMenuModal
          me={me}
          onChange={setMe}
          onClose={() => setOpen(false)}
          onLoggedOut={() => {
            setOpen(false);
            void router.replace("/login");
          }}
        />
      )}
    </>
  );
}

type ModalProps = {
  me: Me;
  onChange: (me: Me) => void;
  onClose: () => void;
  onLoggedOut: () => void;
};

function UserMenuModal({ me, onChange, onClose, onLoggedOut }: ModalProps) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [editingFav, setEditingFav] = useState(false);
  const [favorites, setFavorites] = useState<PickedTag[]>(
    (me.favorites ?? []).map((f) => ({ name: f.name })),
  );
  const [savingFav, setSavingFav] = useState(false);
  const [savingHome, setSavingHome] = useState(false);

  // TODO: 自己紹介文はバックエンド未対応（users テーブルへの bio カラム追加が必要）。
  // 現状は画面内だけで保持し、閉じると消える。保存導線の文言でその旨を明示している。
  const [editingBio, setEditingBio] = useState(false);
  const [bio, setBio] = useState("");
  const [bioDraft, setBioDraft] = useState("");

  const hasFavorites = (me.favorites?.length ?? 0) > 0;

  async function saveFavorites() {
    setSavingFav(true);
    setError("");
    try {
      const res = await userApi.updateFavorites(favorites.map((f) => ({ name: f.name })));
      onChange({ ...me, favorites: res.user.favorites });
      setEditingFav(false);
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
      const res = await userApi.updateHome(point);
      onChange({ ...me, homeLocation: res.user.homeLocation });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingHome(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    try {
      await signOut();
      onLoggedOut();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal panel usermenu" role="dialog" aria-modal="true" aria-label="マイページ">
        <div className="usermenu-head">
          {me.pictureUrl ? (
            <img src={me.pictureUrl} alt="" className="avatar" />
          ) : (
            <span className="avatar avatar-initial" aria-hidden="true">
              {initialOf(me.displayName)}
            </span>
          )}
          <div className="usermenu-id">
            <strong>{me.displayName}</strong>
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
          <button
            type="button"
            className="link usermenu-close"
            onClick={onClose}
            aria-label="閉じる"
          >
            <CloseRoundedIcon />
          </button>
        </div>

        <section className="usermenu-section">
          <div className="fav-head">
            <strong>自己紹介</strong>
            {!editingBio && (
              <button
                className="link"
                onClick={() => {
                  setBioDraft(bio);
                  setEditingBio(true);
                }}
              >
                {bio ? "編集" : "書く"}
              </button>
            )}
          </div>

          {editingBio ? (
            <>
              <textarea
                className="input"
                rows={4}
                maxLength={500}
                value={bioDraft}
                placeholder="好きな作品や、取引で大事にしていることを書いておきましょう。"
                onChange={(e) => setBioDraft(e.target.value)}
              />
              <div className="actions">
                <button
                  className="primary"
                  onClick={() => {
                    setBio(bioDraft.trim());
                    setEditingBio(false);
                  }}
                >
                  保存する
                </button>
                <button onClick={() => setEditingBio(false)}>やめる</button>
              </div>
              <p className="hint">※ 自己紹介文のサーバー保存は準備中です。</p>
            </>
          ) : bio ? (
            <p className="usermenu-bio">{bio}</p>
          ) : (
            <p className="hint">
              自己紹介があると、どんな人か伝わって取引を申し込まれやすくなります。
            </p>
          )}
        </section>

        <section className="usermenu-section">
          <div className="fav-head">
            <strong>好きな作品</strong>
            {!editingFav && (
              <button className="link" onClick={() => setEditingFav(true)}>
                {hasFavorites ? "編集" : "登録する"}
              </button>
            )}
          </div>

          {editingFav ? (
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
                <button onClick={() => setEditingFav(false)}>やめる</button>
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
            <p className="hint">登録すると、「探す」の新着カードが好みに近い順に並びます。</p>
          )}
        </section>

        <section className="usermenu-section">
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
              <PlaceRoundedIcon fontSize="small" /> {savingHome ? "設定中…" : "現在地を拠点にする"}
            </button>
          )}
          <p className="hint">条件が合う相手が複数いるとき、拠点が近い人から順にマッチします。</p>
        </section>

        {error && <p className="error">{error}</p>}

        <button type="button" className="usermenu-logout" disabled={busy} onClick={handleLogout}>
          <LogoutRoundedIcon fontSize="small" /> {busy ? "ログアウト中…" : "ログアウト"}
        </button>
      </div>
    </div>
  );
}
