import { BarChart2 } from "lucide-react";
import { Panel } from "../../../components/Panel";
import { useAnaliticaStore } from "../store";

// Frecuencias pane. B1: orden + mostrar_todo (scaffold mínimo).
// B2 agrega selección de secciones desde SeccionesEditor.
// B3 agrega chip-picker de variables numéricas.

export function FrecuenciasPane() {
  const frec = useAnaliticaStore((s) => s.config.frecuencias);
  const setFrec = useAnaliticaStore((s) => s.setFrecuencias);

  return (
    <Panel
      eyebrow="Configuración"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><BarChart2 size={14} /> Frecuencias</span>}
      hint="Tablas univariadas por variable, estilo SPSS, agrupadas por sección del instrumento."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                <input
                  type="radio"
                  checked={frec.orden === o}
                  onChange={() => setFrec({ orden: o })}
                  style={{ margin: 0 }}
                />
                {o === "desc" ? "Descendente (mayoría primero)" : o === "asc" ? "Ascendente" : "Original del instrumento"}
              </label>
            ))}
          </div>
        </div>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={frec.mostrar_todo}
            onChange={(e) => setFrec({ mostrar_todo: e.target.checked })}
          />
          <span>Mostrar todas las categorías declaradas (incluso las que nadie marcó)</span>
        </label>

        {/* B2: multiselect de secciones activas */}
        {/* B3: chip-picker de variables numéricas */}
      </div>
    </Panel>
  );
}
