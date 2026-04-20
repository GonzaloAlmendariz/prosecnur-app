import { useEffect, useState } from "react";
import { BarChart2, X } from "lucide-react";
import { apiAnaliticaVariables, VariableInstrumento } from "../../../api/client";
import { Panel } from "../../../components/Panel";
import { useAnaliticaStore } from "../store";

// Frecuencias — orden + mostrar_todo + selección de secciones activas +
// chip-picker de variables numéricas.

export function FrecuenciasPane() {
  const frec = useAnaliticaStore((s) => s.config.frecuencias);
  const secciones = useAnaliticaStore((s) => s.config.secciones);
  const numericasGlobal = useAnaliticaStore((s) => s.config.numericas);
  const setFrec = useAnaliticaStore((s) => s.setFrecuencias);

  const [variables, setVariables] = useState<VariableInstrumento[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await apiAnaliticaVariables();
        setVariables(r.variables);
      } catch {/* no-op */}
    })();
  }, []);

  const seccionesVisibles = secciones.filter((s) => !s.oculto);
  const selected = new Set(frec.secciones_activas);
  const todasActivas = frec.secciones_activas.length === 0;

  function toggleSeccion(id: string) {
    // Empty array = "todas activas". Al clickear una, convertimos a lista
    // explícita que contiene las otras (menos esa) si estaba "todas".
    if (todasActivas) {
      setFrec({ secciones_activas: seccionesVisibles.filter((s) => s.id !== id).map((s) => s.id) });
      return;
    }
    const next = selected.has(id)
      ? frec.secciones_activas.filter((x) => x !== id)
      : [...frec.secciones_activas, id];
    // Si quedan todas → colapsar a "todas" (vacío).
    const allIds = seccionesVisibles.map((s) => s.id);
    const allSelected = allIds.every((x) => next.includes(x));
    setFrec({ secciones_activas: allSelected ? [] : next });
  }

  function resetTodas() {
    setFrec({ secciones_activas: [] });
  }

  // Numéricas: override local o el global del store.
  const numericas = frec.numericas_override ?? numericasGlobal;
  function addNumerica(v: string) {
    if (!v || numericas.includes(v)) return;
    setFrec({ numericas_override: [...numericas, v] });
  }
  function removeNumerica(v: string) {
    setFrec({ numericas_override: numericas.filter((x) => x !== v) });
  }

  return (
    <Panel
      eyebrow="Configuración"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><BarChart2 size={14} /> Frecuencias</span>}
      hint="Tablas univariadas por variable, estilo SPSS, agrupadas por sección del instrumento."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Orden */}
        <div>
          <div className="pulso-section-eyebrow" style={{ marginBottom: 6 }}>Orden de respuestas dentro de cada tabla</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["desc", "asc", "original"] as const).map((o) => (
              <label
                key={o}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 10px", borderRadius: 6,
                  border: `1px solid ${frec.orden === o ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                  background: frec.orden === o ? "var(--pulso-primary-soft)" : "white",
                  cursor: "pointer", fontSize: 12,
                }}
              >
                <input type="radio" checked={frec.orden === o} onChange={() => setFrec({ orden: o })} style={{ margin: 0 }} />
                {o === "desc" ? "Descendente (mayoría primero)" : o === "asc" ? "Ascendente" : "Original del instrumento"}
              </label>
            ))}
          </div>
        </div>

        {/* Mostrar todo */}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={frec.mostrar_todo}
            onChange={(e) => setFrec({ mostrar_todo: e.target.checked })}
          />
          <span>Mostrar todas las categorías declaradas (incluso las que nadie marcó)</span>
        </label>

        {/* Secciones activas */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
            <div className="pulso-section-eyebrow">Secciones a incluir</div>
            {!todasActivas && (
              <button type="button" onClick={resetTodas} style={{ fontSize: 11, padding: "2px 8px" }}>
                Todas
              </button>
            )}
          </div>
          {seccionesVisibles.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
              Sin secciones definidas. Configura secciones en el paso <strong>1 · Preparar</strong>.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {seccionesVisibles.map((s) => {
                const active = todasActivas || selected.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSeccion(s.id)}
                    style={{
                      fontSize: 11, padding: "4px 10px", borderRadius: 999,
                      border: `1px solid ${active ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                      background: active ? "var(--pulso-primary-soft)" : "white",
                      color: active ? "var(--pulso-primary)" : "var(--pulso-text)",
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}
                    title={`${s.variables.length} variables`}
                  >
                    {s.nombre}
                    <span style={{ marginLeft: 6, opacity: 0.6 }}>{s.variables.length}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Numéricas override */}
        <div>
          <div className="pulso-section-eyebrow" style={{ marginBottom: 6 }}>Variables numéricas (resumen en vez de tabla)</div>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginBottom: 6, lineHeight: 1.4 }}>
            Las variables marcadas acá se muestran con estadísticos (media, sd, percentiles) en vez de frecuencias.
          </div>
          <NumericasEditor
            numericas={numericas}
            variables={variables}
            onAdd={addNumerica}
            onRemove={removeNumerica}
          />
        </div>
      </div>
    </Panel>
  );
}

function NumericasEditor({
  numericas, variables, onAdd, onRemove,
}: {
  numericas: string[];
  variables: VariableInstrumento[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}) {
  const [input, setInput] = useState("");
  const lowered = input.toLowerCase().trim();
  const suggestions = lowered
    ? variables
        .filter((v) => !numericas.includes(v.name))
        .filter((v) => v.name.toLowerCase().includes(lowered) || v.label.toLowerCase().includes(lowered))
        .slice(0, 8)
    : [];

  function pick(name: string) {
    onAdd(name);
    setInput("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {numericas.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {numericas.map((v) => (
            <span
              key={v}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 4px 2px 8px", borderRadius: 999,
                background: "var(--pulso-primary-soft)",
                border: "1px solid var(--pulso-primary)",
                fontSize: 11, fontFamily: "monospace", color: "var(--pulso-primary)",
              }}
            >
              {v}
              <button
                type="button"
                onClick={() => onRemove(v)}
                className="pulso-icon"
                aria-label={`Quitar ${v}`}
                title="Quitar"
                style={{ minWidth: 16, minHeight: 16 }}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div style={{ position: "relative", maxWidth: 420 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              e.preventDefault();
              pick(input.trim());
            }
          }}
          placeholder="Buscar variable (p.ej. edad, ingresos)…"
          style={{ width: "100%", fontSize: 13, fontFamily: "monospace", padding: "6px 10px" }}
        />
        {suggestions.length > 0 && (
          <div
            style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
              background: "white", border: "1px solid var(--pulso-border)",
              borderRadius: 6, marginTop: 2, padding: 4,
              maxHeight: 220, overflowY: "auto",
              scrollbarWidth: "thin", scrollbarColor: "var(--pulso-border) transparent",
              boxShadow: "var(--pulso-shadow-low)",
            }}
          >
            {suggestions.map((v) => (
              <button
                key={v.name}
                type="button"
                onClick={() => pick(v.name)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "4px 8px", border: "none", background: "transparent",
                  cursor: "pointer", borderRadius: 4, fontSize: 12,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--pulso-surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <code style={{ fontFamily: "monospace", fontWeight: 700, marginRight: 8 }}>{v.name}</code>
                <span style={{ color: "var(--pulso-text-soft)" }}>{v.label.slice(0, 60)}</span>
                <span style={{ marginLeft: 6, fontSize: 9, color: "var(--pulso-text-soft)" }}>{v.tipo}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
