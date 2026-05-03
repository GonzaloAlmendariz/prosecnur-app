import { useVariables, parseVarRef, formatVarRef } from "./useVariables";

type Props = {
  value: string[] | null | undefined;
  onChange: (v: string[]) => void;
};

export default function VarsListPicker({ value, onChange }: Props) {
  const { variables, multi, loading } = useVariables();
  const vals = Array.isArray(value) ? value : [];

  if (loading) return <span style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>cargando…</span>;

  const selected = new Set(vals);

  function labelForRef(ref: string) {
    const parsed = parseVarRef(ref);
    const hit = variables.find((v) => {
      if (multi) return v.source === parsed.source && v.name === parsed.name;
      return v.name === parsed.name;
    });
    if (!hit) return ref;
    return multi ? `${hit.source}$${hit.name}` : hit.name;
  }

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
            {labelForRef(n)}
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
        {variables.map((v) => {
          const ref = formatVarRef(v.source, v.name, multi);
          return { ...v, ref };
        }).filter((v) => !selected.has(v.ref)).slice(0, 200).map((v) => (
          <option key={`${v.source}:${v.name}`} value={v.ref} title={v.label}>
            {multi ? `${v.source}$` : ""}{v.name} · {v.label.slice(0, 40)}{v.label.length > 40 ? "…" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
