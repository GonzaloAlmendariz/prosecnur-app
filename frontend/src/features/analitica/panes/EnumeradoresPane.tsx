import { Users } from "lucide-react";
import { Panel } from "../../../components/Panel";
import { useAnaliticaStore } from "../store";

// Enumeradores pane — scaffold B1 con los inputs básicos. B3 agrega
// tabla editable de modalidad_reglas + dropdowns con columnas reales.

export function EnumeradoresPane() {
  const enumer = useAnaliticaStore((s) => s.config.enumeradores);
  const setEnumer = useAnaliticaStore((s) => s.setEnumeradores);

  return (
    <Panel
      eyebrow="Configuración"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Users size={14} /> Reporte de enumeradores</span>}
      hint="PDF con producción por enumerador, opcionalmente desagregada por corte (sexo, turno, distrito, etc.)."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div className="pulso-section-eyebrow" style={{ marginBottom: 6 }}>Columna que identifica al enumerador</div>
          <input
            type="text"
            value={enumer.col_enumerador}
            onChange={(e) => setEnumer({ col_enumerador: e.target.value })}
            placeholder="ej. Enumerator_name"
            style={{ width: "100%", fontSize: 13, fontFamily: "monospace" }}
          />
        </div>

        <div>
          <div className="pulso-section-eyebrow" style={{ marginBottom: 6 }}>Título del reporte</div>
          <input
            type="text"
            value={enumer.titulo}
            onChange={(e) => setEnumer({ titulo: e.target.value })}
            style={{ width: "100%", fontSize: 13 }}
          />
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="pulso-section-eyebrow">Mínimo de encuestas</span>
            <input
              type="number"
              value={enumer.min_encuestas}
              onChange={(e) => setEnumer({ min_encuestas: Number(e.target.value) || 0 })}
              min={0}
              style={{ width: 120, fontSize: 13 }}
            />
          </label>

          <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="pulso-section-eyebrow">Ordenar por</span>
            <select
              value={enumer.ordenar_por}
              onChange={(e) => setEnumer({ ordenar_por: e.target.value as "total" | "nombre" })}
              style={{ fontSize: 13, padding: "4px 8px" }}
            >
              <option value="total">Producción total</option>
              <option value="nombre">Nombre</option>
            </select>
          </label>
        </div>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={enumer.mostrar_vacias}
            onChange={(e) => setEnumer({ mostrar_vacias: e.target.checked })}
          />
          <span>Mostrar modalidades sin encuestas</span>
        </label>

        {/* B3: tabla modalidad_reglas + dropdowns para col_modalidad y cols_corte */}
      </div>
    </Panel>
  );
}
