/** Panel de una regla (panel=regla, foco=id): explicación, diagrama y casos. Salió de `tabs/InstrumentoTab.tsx` (rebanada V1 de P6). */
import { AlertTriangle } from "../../../vendor/lucide-react";
import { EmptyState } from "../../../components/States";
import ReglaDrillPanel from "../components/ReglaDrillPanel";
import RuleDetailPanel from "../components/RuleDetailPanel";
import { ContextLens } from "../components/v2";
import { buildRuleDetailInput } from "./modeloInstrumento";
import type { Instrumento } from "./useInstrumento";

export default function DetalleDeRegla({ inst }: { inst: Instrumento }) {
  const { resultado, drill, reglaDirty, detailRuleId, closeDetail, onToggleReglaActiva, activeDisplayName, detailRow, detailTitle } = inst;
  return (
    <ContextLens
      open={!!detailRuleId}
      onClose={closeDetail}
      variant="wide"
      title={detailTitle ?? "Detalle de regla"}
      subtitle={detailRow?.seccion ?? undefined}
    >
      {detailRow ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Explicación de la validación + diagrama de flujo (nuevo). */}
          <RuleDetailPanel input={buildRuleDetailInput(detailRow)} />

          {/* Si la regla tiene casos, la tabla de drill vive debajo. En vista
              panorama (Instrumento) no se ignora reglas —esa acción vive en
              Limpieza—, así que ocultamos ese botón y el "Cerrar" interno
              (el ContextLens ya tiene su X en el header). */}
          {drill ? (
            <div
              style={{
                borderTop: "1px solid var(--pulso-border)",
                paddingTop: 18,
              }}
            >
              <ReglaDrillPanel
                regla={drill.regla}
                displayName={activeDisplayName ?? undefined}
                casos={drill.casos}
                uuidCol={drill.uuid_col}
                onToggleActiva={onToggleReglaActiva}
                onClose={closeDetail}
                invalidatedHint={
                  reglaDirty
                    ? "Cambios aplicados. Vuelve a ejecutar la auditoría para actualizar KPIs y heatmap con el plan corregido."
                    : undefined
                }
                surface="bubble"
                showToggleActiva={false}
                showClose={false}
              />
            </div>
          ) : null}
        </div>
      ) : (
        // C3: el panel abierto por enlace no queda en blanco; dice por qué.
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title={resultado ? "Esta regla no está en el resultado actual" : "Esta regla todavía no tiene resultado"}
          hint={resultado
            ? `No encontramos "${detailRuleId}" entre las reglas evaluadas de esta base.`
            : "Corre la auditoría para ver su explicación y sus casos."}
        />
      )}
    </ContextLens>
  );
}
