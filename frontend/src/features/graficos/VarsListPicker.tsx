import { useVariables } from "./useVariables";

type Props = {
  value: string[] | null | undefined;
  onChange: (v: string[]) => void;
};

export default function VarsListPicker({ value, onChange }: Props) {
  const { variables, loading } = useVariables();
  const vals = Array.isArray(value) ? value : [];

  if (loading) return <span style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>cargando…</span>;

  const selected = new Set(vals);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, minHeight: 24 }}>
        {vals.length === 0 && <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>Ninguna variable seleccionada</span>}
        {vals.map((n) => (
          <span
            key={n}
            style={{
              background: "var(--pulso-primary-soft)",
              color: "var(--pulso-primary)",
              border: "1px solid var(--pulso-primary-border)",
              padding: "2px 6px", borderRadius: 4,
              fontSize: 11, fontFamily: "ui-monospace,monospace",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            {n}
            <button
              type="button"
              onClick={() => onChange(vals.filter((x) => x !== n))}
              aria-label={`Quitar ${n}`}
              style={{
                fontSize: 12, lineHeight: 1,
                border: "none", background: "transparent",
                cursor: "pointer", color: "var(--pulso-primary)",
                padding: 0,
              }}
            >×</button>
          </span>
        ))}
      </div>
      <select
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (v && !selected.has(v)) onChange([...vals, v]);
        }}
        style={{ fontSize: 12, padding: "3px 6px" }}
      >
        <option value="">+ Agregar variable…</option>
        {variables.filter((v) => !selected.has(v.name)).slice(0, 200).map((v) => (
          <option key={v.name} value={v.name} title={v.label}>
            {v.name} · {v.label.slice(0, 40)}{v.label.length > 40 ? "…" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
