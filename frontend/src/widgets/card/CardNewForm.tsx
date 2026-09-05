import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useQueryParam } from "../../shared/lib/navigation";
import CardItem from "../CardItem";
import TagInput, { type PickedTag } from "../TagInput";
import ThresholdSlider from "../ThresholdSlider";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import { cardApi } from "../../features/card/api";
import { tagApi } from "../../features/tag/api";
import { TYPE_LABEL, type Card, type CardType } from "../../entities/card/model";
import type { Group } from "../../entities/group/model";
import type { GeoPoint } from "../../entities/user/geo";
import { currentPosition, shrinkImage } from "../../shared/lib/device";

const TYPE_HELP: Record<CardType, string> = {
  GIVE: "持っているグッズを譲ります。【求】のカードとマッチします。",
  WANT: "探しているグッズを登録します。【譲】のカードとマッチします。",
  COMPANION: "イベントの同行者を募集します。同じ【同行者求】とマッチします。",
};

const COUNTERPART: Record<CardType, CardType> = {
  GIVE: "WANT",
  WANT: "GIVE",
  COMPANION: "COMPANION",
};

type Result = {
  card: Card;
  newMatches: { matchId: string; matchCount: number; matchedTags: string[]; card: Card }[];
  newGroups: Group[];
};

export function CardNewForm() {
  const navigate = useNavigate();
  const respondTo = useQueryParam("respondTo");
  const [type, setType] = useState<CardType>("WANT");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<PickedTag[]>([]);
  const [required, setRequired] = useState<string[]>([]);
  const [minMatch, setMinMatch] = useState(2);
  const [dates, setDates] = useState<string[]>([]);
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inferring, setInferring] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  // 進行中のタグ推定。写真を差し替えたら打ち切る
  const inferAbort = useRef<AbortController | null>(null);

  // 画面を離れたら推定を止める（結果を捨てるだけでなく通信も切る）
  useEffect(() => () => inferAbort.current?.abort(), []);

  const threshold = useMemo(
    () => Math.min(Math.max(minMatch, required.length, 1), Math.max(tags.length, 1)),
    [minMatch, required.length, tags.length],
  );

  useEffect(() => {
    if (!respondTo) return;
    let alive = true;
    cardApi
      .card(respondTo)
      .then(({ card }) => {
        if (!alive) return;
        const counterpart = COUNTERPART[card.type];
        setType(counterpart);
        setTags(card.tags.map((t) => ({ name: t.name })));
        setRequired(card.requiredTags);
        setMinMatch(Math.min(card.minMatchCount, card.tags.length));
        if (card.dates?.length) setDates([...card.dates]);
        const lead =
          counterpart === "GIVE" ? "譲ります: " : counterpart === "WANT" ? "求めます: " : "同行: ";
        setTitle(`${lead}${card.title}`.slice(0, 60));
      })
      .catch((e) => setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [respondTo]);

  async function inferTagsFromPhoto(file: File) {
    // 写真を差し替えたら前の推定は用済み。打ち切って結果も捨てる
    inferAbort.current?.abort();
    const ac = new AbortController();
    inferAbort.current = ac;
    const isCurrent = () => inferAbort.current === ac;

    setError("");
    setInferring(true);
    try {
      const shrunk = await shrinkImage(file);
      if (!isCurrent()) return;

      // プレビューは「最後に選んだ写真」を映すだけなので、応答を待たずに出す
      const preview = URL.createObjectURL(shrunk);
      setPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return preview;
      });

      const { tags: inferred, titleHint } = await tagApi.inferTagsFromImage(shrunk, ac.signal);
      if (!isCurrent()) return;

      // 推定を待つ間にユーザーが足したタグを消さないよう、常に最新の状態から合成する
      setTags((prev) => {
        const existing = new Set(prev.map((t) => t.name));
        const merged = [...prev];
        for (const t of inferred) {
          if (merged.length >= 10) break;
          if (existing.has(t.name)) continue;
          existing.add(t.name);
          merged.push({ name: t.name, category: t.category });
        }
        return merged;
      });
      setTitle((prev) => (prev.trim() || !titleHint ? prev : titleHint.slice(0, 60)));
    } catch (e) {
      // 差し替えで打ち切った分のエラーは表に出さない
      if (!isCurrent() || ac.signal.aborted) return;
      setError((e as Error).message);
    } finally {
      // 古い推定が新しい推定の表示を消してしまわないようにする
      if (isCurrent()) setInferring(false);
    }
  }

  async function submit() {
    setError("");
    if (!title.trim()) return setError("タイトルを入力してください");
    if (tags.length === 0) return setError("タグを 1 つ以上追加してください");
    if (type === "COMPANION" && dates.length === 0) {
      return setError("同行者募集は日程を 1 日以上選んでください");
    }

    setSaving(true);
    try {
      const res = await cardApi.createCard({
        type,
        title: title.trim(),
        note: note.trim() || undefined,
        tags,
        requiredTags: required.map((name) => ({ name })),
        minMatchCount: threshold,
        dates: dates.length ? dates : undefined,
        location: location ? { ...location, name: placeName.trim() || undefined } : null,
      });
      setResult(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="page">
        <h2>登録しました</h2>
        <CardItem card={result.card} />

        {result.newMatches.length > 0 ? (
          <>
            <h3>条件に一致するカードが {result.newMatches.length} 件見つかりました</h3>
            {result.newMatches.map((m) => (
              <CardItem
                key={m.matchId}
                card={{ ...m.card, matchedTags: m.matchedTags, matchCount: m.matchCount }}
                onClick={() => navigate(`/matches/${m.matchId}`)}
              />
            ))}
          </>
        ) : (
          <p className="hint">
            いまは一致するカードがありません。新しく条件に合うカードが登録されたら
            マッチ成立時に通知が届きます。
          </p>
        )}

        {result.newGroups?.length > 0 && (
          <>
            <h3>{result.newGroups.length}件の「交換の輪」が見つかりました</h3>
            <p className="hint">
              1 対 1 では成立しない組み合わせでも、3 人以上で持ち回れば全員の希望が揃います。
            </p>
            {result.newGroups.map((g) => (
              <article
                key={g.groupId}
                className="card card-clickable"
                onClick={() => navigate(`/groups/${g.groupId}`)}
              >
                <div className="card-head">
                  <span className="badge badge-COMPANION">{g.length}人</span>
                  <h3>{g.iReceive?.title ?? "交換の輪"}</h3>
                </div>
                <p className="hint">
                  {g.iGive?.title} を渡して {g.iReceive?.title} を受け取ります
                </p>
              </article>
            ))}
          </>
        )}

        <div className="actions">
          <button className="primary" onClick={() => navigate("/matches")}>
            マッチ一覧へ
          </button>
          <button onClick={() => navigate("/")}>ホームへ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h2>カードを登録</h2>
      {respondTo && (
        <p className="notice">
          相手のカード条件に合わせて入力をプリセットしました。内容を確認して登録してください。
        </p>
      )}

      <label className="field">
        <span>種類</span>
        <div className="typeswitch">
          {(Object.keys(TYPE_LABEL) as CardType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={type === t ? "active" : ""}
              onClick={() => setType(t)}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <p className="hint">{TYPE_HELP[type]}</p>
      </label>

      <label className="field">
        <span>タイトル</span>
        <input
          className="input"
          value={title}
          maxLength={60}
          placeholder={
            type === "GIVE" ? "天馬司のアクスタ譲ります" : "天馬司のアクスタ探しています"
          }
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <div className="field">
        <span>写真からタグ推測（任意）</span>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void inferTagsFromPhoto(file);
          }}
        />
        <div className="photo-infer">
          {photoPreview ? (
            <img src={photoPreview} alt="アップロードした写真" className="photo-infer-preview" />
          ) : (
            <div className="photo-infer-placeholder">グッズの写真</div>
          )}
          {/* 推定中でも押せる。差し替えたら前の推定は打ち切られる */}
          <button type="button" className="teal" onClick={() => photoInputRef.current?.click()}>
            <PhotoCameraRoundedIcon fontSize="small" />
            {photoPreview ? "写真を撮り直す" : "写真からタグを推測"}
          </button>
        </div>
        <p className="hint">
          写真を選ぶと Workers AI
          が作品名・キャラ・アイテム種別などのタグ候補を提案します。読み取りを待たずに入力を続けられます。
        </p>
      </div>

      <div className="field">
        <span>
          条件タグ
          {inferring && (
            <span className="infer-badge" role="status">
              AIが写真を読み取り中…
            </span>
          )}
        </span>
        <TagInput
          value={tags}
          onChange={setTags}
          required={required}
          onRequiredChange={setRequired}
        />
      </div>

      <div className="field">
        <span>通知の条件</span>
        <ThresholdSlider
          value={threshold}
          max={tags.length}
          requiredCount={required.length}
          onChange={setMinMatch}
        />
      </div>

      <div className="field">
        <span>日程{type === "COMPANION" ? "（必須）" : "（任意）"}</span>
        {dates.map((date, index) => (
          <div key={index} className="daterow">
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => {
                const next = [...dates];
                next[index] = e.target.value;
                setDates(next);
              }}
            />
            <button type="button" onClick={() => setDates(dates.filter((_, i) => i !== index))}>
              削除
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setDates([...dates, ""])}>
          日程を追加
        </button>
      </div>

      <div className="field">
        <span>受け渡し場所（任意）</span>
        {location ? (
          <div className="place-set">
            <p className="card-detail">
              <PlaceRoundedIcon fontSize="inherit" /> 現在地を設定しました
              <span className="hint">
                {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
              </span>
            </p>
            <input
              className="input"
              value={placeName}
              maxLength={60}
              placeholder="場所の名前（例: 東京ビッグサイト 東7ホール）"
              onChange={(e) => setPlaceName(e.target.value)}
            />
            <button type="button" onClick={() => setLocation(null)}>
              位置情報を外す
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="teal"
            disabled={locating}
            onClick={() => {
              setLocating(true);
              setError("");
              currentPosition()
                .then(setLocation)
                .catch((e) => setError((e as Error).message))
                .finally(() => setLocating(false));
            }}
          >
            <PlaceRoundedIcon fontSize="small" /> {locating ? "取得中…" : "現在地を設定する"}
          </button>
        )}
        <p className="hint">
          設定すると地図から見つけてもらえます。イベント会場でその場で交換したいときに便利です。
        </p>
      </div>

      <label className="field">
        <span>ひとこと（任意）</span>
        <textarea
          className="input"
          rows={3}
          maxLength={500}
          value={note}
          placeholder="郵送のみ / 手渡し希望 / 交換できるものリスト など"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button className="primary" disabled={saving} onClick={submit}>
          {saving ? "登録中…" : "登録する"}
        </button>
        <button onClick={() => navigate(-1)}>キャンセル</button>
      </div>
    </div>
  );
}
