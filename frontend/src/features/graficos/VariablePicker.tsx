import { useMemo, useState } from "react";
import { useVariables, parseVarRef, formatVarRef } from "./useVariables";

type Props = {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder?: string;
  filter?: (tipo: string) => boolean;
  allowEmpty?: boolean;
};

// VariablePicker multi-base (v0.2+).
//
// Si el estudio tiene 1 sola base (`multi=false`), el UI es el mismo de
// siempre: un dropdown con todas las variables y un input de búsqueda.
// El `value` se guarda sin prefijo ("sexo", "p5").
//
// Si hay >1 base (`multi=true`), aparece un dropdown adicional "Fuente"
// arriba. El `value` se guarda con prefijo ("docentes$sexo"). Al cambiar
// la fuente, el dropdown de variables se re-filtra.
//
// Si el value ya viene prefijado (de un plan guardado en una sesión
// anterior), se respeta la fuente — incluso en single-base (se asume que
// el analista lo guardó conscientemente así).

export default function VariablePicker({
  value, onChange, placeholder = "Selecciona variable…", filter, allowEmpty = false,
}: Props) {
  const { sources, multi, loading, error } = useVariables();
  const [query, setQuery] = useState("");

  // Parsear el value actual a (source, name).
  const parsed = useMemo(() => parseVarRef(value), [value]);

  // Fuente activa: la del value si tiene prefijo, o la primera disponible.
  const activeSource = parsed.source ?? (sources[0]?.name ?? null);

  if (loading) return <span style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>cargando variables…</span>;
  if (error) {
    const isSessionLost = error.includes("E_NO_SESSION");
    return (
      <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
        {isSessionLost ? "Sesión no disponible" : `⚠ ${error}`}
      </span>
    );
  }

  // Variables de la fuente activa (con filtro de tipo + búsqueda).
  const source = sources.find((s) => s.name === activeSource) ?? sources[0];
  const allVars = source?.variables ?? [];
  let filtered = allVars;
  if (filter) filtered = filtered.filter((v) => filter(v.tipo));
  const q = query.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((v) =>
      v.name.toLowerCase().includes(q) || v.label.toLowerCase().includes(q),
    );
  }
  filtered = filtered.slice(0, 200);

  function handleSourceChange(newSource: string) {
    // Al cambiar de fuente, si hay una variable seleccionada, la
    // preservamos SI existe en la nueva fuente; sino la limpiamos.
    const target = sources.find((s) => s.name === newSource);
    if (!target) return;
    if (parsed.name && target.variables.some((v) => v.name === parsed.name)) {
      onChange(formatVarRef(newSource, parsed.name, multi));
    } else {
      onChange(allowEmpty ? null : "");
    }
  }

  function handleVarChange(newName: string) {
    if (!newName) {
      onChange(allowEmpty ? null : "");
      return;
    }
    onChange(formatVarRef(activeSource, newName, multi));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {multi && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label
            style={{
              fontSize: 10, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: 0.4, color: "var(--pulso-text-soft)",
              minWidth: 48,
            }}
          >
            Fuente
          </label>
          <select
            value={activeSource ?? ""}
            onChange={(e) => handleSourceChange(e.target.value)}
            style={{
              fontSize: 12, padding: "3px 6px", flex: 1,
              border: "1px solid var(--pulso-border)", borderRadius: 4,
              background: "var(--pulso-primary-soft)",
              color: "var(--pulso-primary)",
              fontWeight: 600,
            }}
          >
            {sources.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} ({s.variables.length})
              </option>
            ))}
          </select>
        </div>
      )}
      <div style={{ display: "flex", gap: 4 }}>
        <select
          value={parsed.name}
          onChange={(e) => handleVarChange(e.target.value)}
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
      {allVars.length === 0 && (
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
          Sin variables. ¿Ya preparaste en Fase 4?
        </span>
      )}
    </div>
  );
}
