type Props = {
  value: number;
  max: number;
  requiredCount: number;
  onChange: (value: number) => void;
};

/**
 * 「◯件以上タグが一致したら通知」の設定。
 * 必須タグの数より小さくはできない（必須はどのみち全部一致する必要があるため）。
 */
export default function ThresholdSlider({ value, max, requiredCount, onChange }: Props) {
  const min = Math.max(1, requiredCount, 1);
  const upper = Math.max(min, max);
  const current = Math.min(Math.max(value, min), upper);

  if (max === 0) {
    return <p className="hint">タグを追加すると、通知の条件を設定できます。</p>;
  }

  return (
    <div className="threshold">
      <div className="threshold-head">
        <strong>{current}件以上</strong>
        <span>一致したら通知</span>
      </div>

      <input
        type="range"
        min={min}
        max={upper}
        step={1}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={upper === min}
      />

      <div className="threshold-scale">
        <span>ゆるい（通知が多い）</span>
        <span>厳しい（通知が少ない）</span>
      </div>

      <p className="hint">
        全{max}件のタグのうち {current} 件そろえば相手として扱います。
        {requiredCount > 0 && `（必須タグ ${requiredCount} 件は常に必要です）`}
      </p>
    </div>
  );
}
