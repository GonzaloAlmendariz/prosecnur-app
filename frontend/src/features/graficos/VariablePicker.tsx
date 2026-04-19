import { useMemo, useState } from "react";
import { useVariables } from "./useVariables";

type Props = {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder?: string;
  filter?: (tipo: string) => boolean;
  allowEmpty?: boolean;
};

export default function VariablePicker({ value, onChange, placeholder = "Selecciona variable…", filter, allowEmpty = false }: Props) {
  const { variables, loading, error } = useVariables();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let vs = variables;
    if (filter) vs = vs.filter((v) => filter(v.tipo));
    const q = query.trim().toLowerCase();
    if (q) vs = vs.filter((v) => v.name.toLowerCase().includes(q) || v.label.toLowerCase().includes(q));
    return vs.slice(0, 200);
  }, [variables, filter, query]);

  if (loading) return <span style={{ fontSize: 12, color: "#888" }}>cargando variables…</span>;
  if (error) return <span style={{ fontSize: 12, color: "#c00" }}>⚠ {error}</span>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 4 }}>
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          style={{ fontSize: 13, padding: "3px 6px", flex: 1, minWidth: 140 }}
        >
          <option value="">{allowEmpty ? "— (ninguna) —" : placeholder}</option>
          {filtered.map((v) => (
            <option key={v.name} value={v.name} title={v.label}>
              {v.name} {v.label && v.label !== v.name ? `· ${v.label.slice(0, 40)}${v.label.length > 40 ? "…" : ""}` : ""}
            </option>
          ))}
        </select>
        <input
          placeholder="Buscar…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ fontSize: 12, padding: "2px 4px", width: 80 }}
        />
      </div>
      {variables.length === 0 && (
        <span style={{ fontSize: 11, color: "#888" }}>
          Sin variables. ¿Ya preparaste en Fase 4?
        </span>
      )}
    </div>
  );
}
