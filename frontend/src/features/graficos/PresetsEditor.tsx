import { Sliders } from "lucide-react";
import { usePlanStore } from "./store";

// Editor de presets globales tipo-de-graficador. En Fase 2B se completa
// con un tab por cada tipo de preset (base, barras_apiladas, multi_apiladas,
// barras_agrupadas, pie, donut, radar_tabla, numerico, media_rango), cada
// uno con los ~30-50 args agrupados en colapsables (Textos / Colores /
// Canvas / Leyenda / Avanzado). Por ahora dejamos el scaffold visible.

export function PresetsEditor() {
  const presets = usePlanStore((s) => s.presets);
  const nPresets = Object.keys(presets).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pulso-text)" }}>
          Presets de estilo por tipo de graficador
        </div>
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 3, lineHeight: 1.5 }}>
          Los presets definen tamaños de fuente, colores de texto, dimensiones de canvas,
          posición de leyendas y otros detalles visuales que se aplican a <strong>todos</strong>
          los gráficos de un tipo (ej. todas las barras apiladas). El editor detallado entra en
          Fase 2B.
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
        <Sliders size={22} style={{ marginBottom: 6, opacity: 0.6 }} />
        <div>
          <strong>Próximamente</strong>: tabs por tipo (<code>base</code>, <code>barras_apiladas</code>,
          <code>multi_apiladas</code>, <code>pie</code>, <code>donut</code>, <code>radar_tabla</code>, …)
          con editor de ~30-50 args cada uno.
        </div>
        <div style={{ marginTop: 6, fontSize: 11 }}>
          {nPresets === 0
            ? "Por ahora, los gráficos usan los defaults de prosecnur."
            : `${nPresets} ${nPresets === 1 ? "preset configurado" : "presets configurados"} (vía import JSON o PresetsModal).`}
        </div>
      </div>
    </div>
  );
}
