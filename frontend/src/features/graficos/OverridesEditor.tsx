import { Layers3 } from "lucide-react";
import { usePlanStore } from "./store";

// Editor de overrides reutilizables. Los overrides son "mini-presets"
// nombrados (ej. "compacto", "grande") que se aplican a gráficos
// específicos dentro de un slide — útiles cuando un mismo plan tiene
// algunos gráficos en grid denso (4×, 5×, 6×) que necesitan canvas más
// chico que los slides de 1 o 2 gráficos.
//
// Mirror del patrón `ovr_apiladas_compactas` / `ovr_pie_compacto` de los
// QMDs de GIZ. Fase 2B completa el editor; por ahora scaffold.

export function OverridesEditor() {
  const overrides = usePlanStore((s) => s.overridesReusables);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pulso-text)" }}>
          Overrides reutilizables
        </div>
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 3, lineHeight: 1.5 }}>
          Mini-presets nombrados (ej. <code>compacto</code>, <code>grande</code>) que se aplican a gráficos
          individuales dentro de un slide. Útil cuando un grid 4×/5×/6× necesita tamaños distintos que
          los slides estándar. Editor detallado en Fase 2B.
        </div>
      </div>

      <div
        style={{
          padding: "18px 14px",
          border: "1px dashed var(--pulso-border)",
          borderRadius: 8,
          background: "var(--pulso-surface)",
          textAlign: "center",
          color: "var(--pulso-text-soft)",
          fontSize: 12, lineHeight: 1.5,
        }}
      >
        <Layers3 size={22} style={{ marginBottom: 6, opacity: 0.6 }} />
        <div>
          <strong>Próximamente</strong>: lista nombrada de overrides con editor
          compartido con los presets. Se seleccionan desde el editor de cada slide.
        </div>
        <div style={{ marginTop: 6, fontSize: 11 }}>
          {overrides.length === 0
            ? "Ningún override reutilizable definido."
            : `${overrides.length} ${overrides.length === 1 ? "override reutilizable" : "overrides reutilizables"} en uso.`}
        </div>
      </div>
    </div>
  );
}
