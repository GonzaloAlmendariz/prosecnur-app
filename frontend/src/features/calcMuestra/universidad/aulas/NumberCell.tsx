import { safeNumber } from "../../sharedCore";

function toInputNumber(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? "" : String(value);
}

export function NumberCell({
  value,
  onChange,
  min = 0,
  step = 1,
  suffix,
}: {
  value: number | null | undefined;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="cmv2-number-cell">
      <input
        type="number"
        min={min}
        step={step}
        value={toInputNumber(value)}
        onChange={(e) => onChange(safeNumber(e.currentTarget.value, 0))}
      />
      {suffix && <span>{suffix}</span>}
    </label>
  );
}
