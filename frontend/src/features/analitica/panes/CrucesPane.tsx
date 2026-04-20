import { Grid3x3, Plus, X } from "lucide-react";
import { Panel } from "../../../components/Panel";
import { useAnaliticaStore } from "../store";

// Cruces pane — scaffold B1: lista editable de variables de cruce, modo,
// significancia, alpha. B3 agrega semáforo avanzado, brechas, dimensiones.

export function CrucesPane() {
  const cruces = useAnaliticaStore((s) => s.config.cruces);
  const setCruces = useAnaliticaStore((s) => s.setCruces);

  function addVar() {
    setCruces({ cruces_vars: [...cruces.cruces_vars, ""] });
  }
  function removeVar(i: number) {
    setCruces({ cruces_vars: cruces.cruces_vars.filter((_, idx) => idx !== i) });
  }
  function updateVar(i: number, value: string) {
    setCruces({ cruces_vars: cruces.cruces_vars.map((v, idx) => (idx === i ? value : v)) });
  }

  return (
    <Panel
      eyebrow="Configuración"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Grid3x3 size={14} /> Cruces</span>}
      hint={<>Cada variable listada se cruza contra el resto del instrumento. Se pueden correr varias en una sola ejecución.</>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Variables a cruzar */}
        <div>
          <div className="pulso-section-eyebrow" style={{ marginBottom: 8 }}>Variables a cruzar</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {cruces.cruces_vars.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
                Aún no agregaste variables. Usa <strong>+ Agregar variable</strong> para empezar.
              </div>
            )}
            {cruces.cruces_vars.map((v, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="text"
                  value={v}
                  onChange={(e) => updateVar(i, e.target.value)}
                  placeholder="nombre de variable (ej. servicio, distrito, p3)"
                  style={{ flex: 1, fontSize: 13, fontFamily: "monospace" }}
                />
                <button
                  type="button"
                  className="pulso-icon pulso-icon-danger"
                  onClick={() => removeVar(i)}
                  title="Quitar variable"
                  aria-label="Quitar"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addVar}
              style={{ alignSelf: "flex-start", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4 }}
            >
              <Plus size={12} /> Agregar variable
            </button>
          </div>
        </div>

        {/* Modo */}
        <div>
          <div className="pulso-section-eyebrow" style={{ marginBottom: 6 }}>Modo</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["estandar", "dimensiones"] as const).map((m) => (
              <label
                key={m}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 12px", borderRadius: 6,
                  border: `1px solid ${cruces.modo === m ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                  background: cruces.modo === m ? "var(--pulso-primary-soft)" : "white",
                  cursor: "pointer", fontSize: 12, textTransform: "capitalize",
                }}
              >
                <input type="radio" checked={cruces.modo === m} onChange={() => setCruces({ modo: m })} style={{ margin: 0 }} />
                {m}
              </label>
            ))}
          </div>
        </div>

        {/* Significancia */}
        <div>
          <div className="pulso-section-eyebrow" style={{ marginBottom: 6 }}>Significancia estadística</div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={cruces.show_sig}
              onChange={(e) => setCruces({ show_sig: e.target.checked })}
            />
            <span>Mostrar indicadores de significancia (chi²)</span>
          </label>
          {cruces.show_sig && (
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {[0.01, 0.05, 0.1].map((a) => (
                <label
                  key={a}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", borderRadius: 999,
                    border: `1px solid ${cruces.alpha === a ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                    background: cruces.alpha === a ? "var(--pulso-primary-soft)" : "white",
                    cursor: "pointer", fontSize: 12,
                  }}
                >
                  <input type="radio" checked={cruces.alpha === a} onChange={() => setCruces({ alpha: a })} style={{ margin: 0 }} />
                  α = {a}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Incluir total */}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={cruces.incluir_total}
            onChange={(e) => setCruces({ incluir_total: e.target.checked })}
          />
          <span>Incluir columna/fila de total</span>
        </label>

        {/* B3: semáforo + brechas + dimensiones */}
      </div>
    </Panel>
  );
}
