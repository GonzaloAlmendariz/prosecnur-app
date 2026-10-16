import "./kit.css";

// Control segmentado (Siempre | Con condición, Lista | Mapa, Todas | Sección | Pregunta).
// Es un radiogroup: una opción activa, navegable con teclado por el navegador.

export type SegmentedOption<T extends string> = { value: T; label: string; count?: number | string };

export type SegmentedProps<T extends string> = {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  "aria-label": string;
  size?: "sm" | "md";
};

export function Segmented<T extends string>({ value, options, onChange, size = "md", ...rest }: SegmentedProps<T>) {
  return (
    <span role="radiogroup" aria-label={rest["aria-label"]} className={`xfk-seg xfk-seg--${size}`}>
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            className={on ? "xfk-seg__opt is-on" : "xfk-seg__opt"}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
            {opt.count != null ? <span className="xfk-seg__count">{opt.count}</span> : null}
          </button>
        );
      })}
    </span>
  );
}
