import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CardItem from "../CardItem";
import TagInput, { type PickedTag } from "../TagInput";
import ThresholdSlider from "../ThresholdSlider";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import { cardApi } from "../../features/card/api";
import { TYPE_LABEL, type Card, type CardType } from "../../entities/card/model";
import type { Group } from "../../entities/group/model";
import type { GeoPoint } from "../../entities/user/geo";
import { currentPosition } from "../../shared/lib/device";

const TYPE_HELP: Record<CardType, string> = {
  GIVE: "持っているグッズを譲ります。【求】のカードとマッチします。",
  WANT: "探しているグッズを登録します。【譲】のカードとマッチします。",
  COMPANION: "イベントの同行者を募集します。同じ【同行者求】とマッチします。",
};

type Result = {
  card: Card;
  newMatches: { matchId: string; matchCount: number; matchedTags: string[]; card: Card }[];
  newGroups: Group[];
};

export function CardNewForm() {
  const navigate = useNavigate();
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
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const threshold = useMemo(
    () => Math.min(Math.max(minMatch, required.length, 1), Math.max(tags.length, 1)),
    [minMatch, required.length, tags.length],
  );

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
          placeholder={type === "GIVE" ? "天馬司のアクスタ譲ります" : "天馬司のアクスタ探しています"}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <div className="field">
        <span>条件タグ</span>
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
            <PlaceRoundedIcon fontSize="small" />{" "}
            {locating ? "取得中…" : "現在地を設定する"}
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
