/**
 * Banda de cierre de la mesa de limpieza: estado, recalcular y "Cerrar y
 * generar base", seguida de los archivos del cierre, el efecto de las
 * decisiones y la promoción de la base. Salió de `tabs/LimpiezaTab.tsx`.
 */
import { Check, Loader2, RefreshCcw } from "../../../vendor/lucide-react";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import PromocionBase from "../components/PromocionBase";
import ImpactoDecisiones from "../components/ImpactoDecisiones";
import type { MesaDeLimpieza } from "./useMesaDeLimpieza";
import { DecisionStorageBar, type DecisionCounts, type DecisionKind } from "../components/v2";
import { Panel } from "../../../components/Panel";
import { EstadoChip } from "../../../components/EstadoChip";
import { formatDateTime } from "./modeloLimpieza";
import { primaryButtonStyle, secondaryButtonStyle } from "./estilosLimpieza";

// =============================================================================
// Zona 1 — StatusBar (sticky, compacto)
// =============================================================================
export function StatusBar({
  auditReady,
  canFinalize,
  finalizedAt,
  refreshBusy,
  finalizeBusy,
  decisionCounts,
  activeFilterKind,
  onFilterKind,
  onRefresh,
  onFinalize,
}: {
  auditReady: boolean;
  canFinalize: boolean;
  finalizedAt?: string;
  refreshBusy: boolean;
  finalizeBusy: boolean;
  decisionCounts: DecisionCounts;
  activeFilterKind: DecisionKind | null;
  onFilterKind: (k: DecisionKind | null) => void;
  onRefresh: () => void;
  onFinalize: () => void;
}) {
  const total =
    decisionCounts.ignore +
    decisionCounts.exclude +
    decisionCounts.change +
    decisionCounts.pending;

  const statusLabel = !auditReady
    ? "Sin auditoría"
    : canFinalize
      ? "Listo para cerrar"
      : decisionCounts.pending > 0
        ? `${decisionCounts.pending} caso${decisionCounts.pending === 1 ? "" : "s"} pendiente${decisionCounts.pending === 1 ? "" : "s"}`
        : "En preparación";

  const statusTone: "neutral" | "success" | "warn" = !auditReady
    ? "warn"
    : canFinalize
      ? "success"
      : "neutral";

  return (
    <Panel
      className="pulso-limpieza-estado"
      aria-labelledby="pulso-limpieza-estado-titulo"
      title={<span id="pulso-limpieza-estado-titulo">Limpieza y transformación</span>}
      hint={finalizedAt ? `Último cierre: ${formatDateTime(finalizedAt)}` : "Decisiones sobre los hallazgos detectados"}
      actions={
        <>
          <EstadoChip tone={statusTone} label={statusLabel} />
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshBusy}
            style={secondaryButtonStyle}
          >
            {refreshBusy ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCcw size={13} />}
            Recalcular
          </button>
          <button
            type="button"
            onClick={onFinalize}
            disabled={!canFinalize || finalizeBusy}
            className="pulso-primary"
            style={primaryButtonStyle}
          >
            <Check size={13} />
            Cerrar y generar base
          </button>
        </>
      }
    >
      {/* La barra de decisiones estilo almacenamiento. Sólo si hay cola. */}
      {total > 0 ? (
        <DecisionStorageBar
          counts={decisionCounts}
          activeKind={activeFilterKind}
          onSelectKind={(k) =>
            activeFilterKind === k ? onFilterKind(null) : onFilterKind(k)
          }
          showLegend
          showTotals
          height={14}
        />
      ) : null}
    </Panel>
  );
}

/** La banda de cierre y, debajo, lo que produjo el cierre: archivos, efecto de las decisiones y promoción. */
export default function CierreDeBase({ mesa, auditReady }: { mesa: MesaDeLimpieza; auditReady: boolean }) {
  const { artifacts, cierre } = mesa;
  return (
    <>
      <StatusBar
        auditReady={auditReady}
        canFinalize={mesa.canFinalize}
        finalizedAt={artifacts?.finalized_at}
        refreshBusy={mesa.refreshBusy}
        finalizeBusy={mesa.finalizeBusy}
        decisionCounts={mesa.decisionCounts}
        activeFilterKind={mesa.activeFilterKind}
        onFilterKind={mesa.setActiveFilterKind}
        onRefresh={() => void mesa.loadLimpieza({ quiet: true })}
        onFinalize={() => void mesa.handleFinalize()}
      />

      {/* Los archivos del cierre (o su fallo), en bloque bajo la banda de "Cerrar y generar base". Fuera de la
          banda: ella es sticky y con tres archivos taparía media pantalla a 1024x600. */}
      <ContenedorEntregable estado={cierre.estado} forma="bloque" onCerrar={cierre.cerrar} />

      <ImpactoDecisiones impacto={mesa.impacto} />

      <PromocionBase
        promocion={artifacts?.promocion}
        busy={mesa.revertBusy}
        onRevertir={() => void mesa.handleRevertirPromocion()}
      />
    </>
  );
}
