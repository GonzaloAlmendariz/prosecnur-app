/**
 * Banda de cierre de la mesa de limpieza: estado, recalcular y "Cerrar y
 * generar base", seguida de los archivos del cierre, el efecto de las
 * decisiones y la promoción de la base. Salió de `tabs/LimpiezaTab.tsx`.
 */
import type { ReactNode } from "react";
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
// Zona 1: StatusBar (sticky, compacto)
// =============================================================================
// Montaje de transición (rebanada V2 de P6): la misma banda va en Hallazgos y
// en Cierre. En Hallazgos filtra la cola por tipo de decisión y no cierra; en
// Cierre cierra la base y la barra solo informa, porque la cola no está ahí.
// Sin `onFilterKind` la barra no se pulsa; sin `onFinalize` no hay botón de cierre.
export function StatusBar({
  titulo = "Decisiones",
  pistaSinCierre = null,
  accionListo,
  pegajosa = true,
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
  titulo?: string;
  /** La pista cuando todavía no hubo cierre; `null` la quita (el título ya lo dice). */
  pistaSinCierre?: string | null;
  /** Se muestra junto al estado cuando la base está lista para cerrar (en Hallazgos, "Ir a Cierre"). */
  accionListo?: ReactNode;
  /**
   * En Cierre la banda se pega bajo el encabezado porque lleva "Cerrar y generar base". En Hallazgos
   * no: casi siempre hay un hallazgo abierto y la banda pegada tapaba el encabezado del editor
   * (176 px a 1440x1000, QA dentro de la app de V2).
   */
  pegajosa?: boolean;
  auditReady: boolean;
  canFinalize: boolean;
  finalizedAt?: string;
  refreshBusy: boolean;
  finalizeBusy: boolean;
  decisionCounts: DecisionCounts;
  activeFilterKind: DecisionKind | null;
  onFilterKind?: (k: DecisionKind | null) => void;
  onRefresh: () => void;
  onFinalize?: () => void;
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
      data-pegajosa={pegajosa ? undefined : "no"}
      aria-labelledby="pulso-limpieza-estado-titulo"
      title={<span id="pulso-limpieza-estado-titulo">{titulo}</span>}
      hint={finalizedAt ? `Último cierre: ${formatDateTime(finalizedAt)}` : pistaSinCierre ?? undefined}
      actions={
        <>
          <EstadoChip tone={statusTone} label={statusLabel} />
          {auditReady && canFinalize && accionListo}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshBusy}
            style={secondaryButtonStyle}
          >
            {refreshBusy ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCcw size={13} />}
            Recalcular
          </button>
          {onFinalize && (
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
          )}
        </>
      }
    >
      {/* La barra de decisiones estilo almacenamiento. Sólo si hay cola. */}
      {total > 0 ? (
        <DecisionStorageBar
          counts={decisionCounts}
          activeKind={activeFilterKind}
          onSelectKind={onFilterKind
            ? (k) => (activeFilterKind === k ? onFilterKind(null) : onFilterKind(k))
            : undefined}
          showLegend
          showTotals
          height={14}
        />
      ) : null}
    </Panel>
  );
}

/**
 * La banda de cierre y, debajo, lo que produjo el cierre: archivos, efecto de
 * las decisiones y promoción. Va en la pestaña Cierre; la barra de decisiones
 * no filtra porque la cola vive en Hallazgos.
 */
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
        activeFilterKind={null}
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
