import { useEffect, useRef, useState } from "react";
import { api, type Tag } from "../lib/api";

export type PickedTag = { name: string; category?: string };

type Props = {
  value: PickedTag[];
  onChange: (tags: PickedTag[]) => void;
  required: string[];
  onRequiredChange: (names: string[]) => void;
  max?: number;
};

/**
 * 条件をタグで入力する。既存タグはサジェストから選び、無ければその場で作れる。
 * 各タグは「必須」に切り替えられる（必須タグは相手が必ず持っている必要がある）。
 */
export default function TagInput({
  value,
  onChange,
  required,
  onRequiredChange,
  max = 10,
}: Props) {
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    const query = text.trim();
    if (!query) {
      setSuggestions([]);
      setCanCreate(false);
      return;
    }

    // 打つたびに投げると無駄なので少し待つ
    timer.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.suggestTags(query);
        const picked = new Set(value.map((t) => t.name));
        setSuggestions(res.tags.filter((t) => !picked.has(t.name)));
        setCanCreate(Boolean(res.createCandidate));
      } catch {
        setSuggestions([]);
        setCanCreate(true);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer.current);
  }, [text, value]);

  const full = value.length >= max;

  function add(name: string, category?: string) {
    const trimmed = name.trim();
    if (!trimmed || full) return;
    if (value.some((t) => t.name === trimmed)) {
      setText("");
      return;
    }
    onChange([...value, { name: trimmed, category }]);
    setText("");
    setSuggestions([]);
    setCanCreate(false);
  }

  function remove(name: string) {
    onChange(value.filter((t) => t.name !== name));
    onRequiredChange(required.filter((n) => n !== name));
  }

  function toggleRequired(name: string) {
    onRequiredChange(
      required.includes(name) ? required.filter((n) => n !== name) : [...required, name],
    );
  }

  return (
    <div className="taginput">
      <div className="chips">
        {value.map((tag) => {
          const isRequired = required.includes(tag.name);
          return (
            <span key={tag.name} className={`chip ${isRequired ? "chip-required" : ""}`}>
              <button
                type="button"
                className="chip-star"
                onClick={() => toggleRequired(tag.name)}
                title={isRequired ? "必須をやめる" : "必須にする"}
              >
                {isRequired ? "★" : "☆"}
              </button>
              {tag.name}
              <button type="button" className="chip-x" onClick={() => remove(tag.name)}>
                ×
              </button>
            </span>
          );
        })}
        {value.length === 0 && <span className="hint">まだタグがありません</span>}
      </div>

      <input
        className="input"
        value={text}
        disabled={full}
        placeholder={full ? `タグは${max}個までです` : "作品名・キャラ名・エリアなど"}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (suggestions[0]) add(suggestions[0].name, suggestions[0].category);
          else if (text.trim()) add(text);
        }}
      />

      {(suggestions.length > 0 || canCreate || loading) && (
        <ul className="suggest">
          {loading && <li className="suggest-loading">検索中…</li>}
          {suggestions.map((tag) => (
            <li key={tag.tagId}>
              <button type="button" onClick={() => add(tag.name, tag.category)}>
                <span>{tag.name}</span>
                <span className="suggest-count">{tag.useCount ?? 0}件</span>
              </button>
            </li>
          ))}
          {canCreate && (
            <li>
              <button type="button" className="suggest-new" onClick={() => add(text)}>
                「{text.trim()}」を新しく作る
              </button>
            </li>
          )}
        </ul>
      )}

      <p className="hint">
        ★ を押すと必須タグになります（相手が必ず持っている必要があります）
      </p>
    </div>
  );
}
