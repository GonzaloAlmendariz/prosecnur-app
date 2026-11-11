import type { ComponentProps } from "react";
import type { CargaMonitoreoHandoffStatus } from "../../../api/client";
import { AcreditacionBatchPanel } from "../AcreditacionBatchPanel";
import { CargaMonitoringDiscovery } from "../CargaMonitoringDiscovery";
import type { ProcessingSourcesProfile } from "../CargaSourcesModel";
import { ProcessingIntakePanel } from "../ProcessingIntakePanel";
import { FieldWorkHandoffCallout } from "./AvisoTrabajoDeCampo";

export type PanelMonitoreoCargaProps = {
  sessionId: ComponentProps<typeof ProcessingIntakePanel>["sessionId"];
  etiquetaRevisar: string;
  onDescubierto: ComponentProps<typeof CargaMonitoringDiscovery>["onDiscovered"];
  revisado: boolean;
  perfil: ProcessingSourcesProfile | null;
  sugerencias: ComponentProps<typeof ProcessingIntakePanel>["suggestions"];
  tokenDeLectura: number;
  onPlanGuardado: () => void;
  onPromovido: ComponentProps<typeof AcreditacionBatchPanel>["onPromoted"];
  mostrarTraspaso: boolean;
  traspaso: CargaMonitoreoHandoffStatus | null;
  fuenteSeleccionada: string | null;
  ocupado: boolean;
  onTraer: () => void;
  onSubirFormulario: (archivo: File) => void;
};

/** Origen Monitoreo: descubrimiento de fuentes, asignaciones de acreditación y traspaso de campo. */
export function PanelMonitoreoCarga({
  sessionId,
  etiquetaRevisar,
  onDescubierto,
  revisado,
  perfil,
  sugerencias,
  tokenDeLectura,
  onPlanGuardado,
  onPromovido,
  mostrarTraspaso,
  traspaso,
  fuenteSeleccionada,
  ocupado,
  onTraer,
  onSubirFormulario,
}: PanelMonitoreoCargaProps) {
  return (
    <>
      <CargaMonitoringDiscovery
        key={sessionId ?? "no-session"}
        reviewLabel={etiquetaRevisar}
        onDiscovered={onDescubierto}
      />
      {revisado && perfil === "multi_actor" ? (
        <>
          <ProcessingIntakePanel
            sessionId={sessionId}
            suggestions={sugerencias}
            onPlanSaved={onPlanGuardado}
          />
          <AcreditacionBatchPanel
            sessionId={sessionId}
            refreshToken={tokenDeLectura}
            onPromoted={onPromovido}
          />
        </>
      ) : null}
      {revisado && (perfil === "telefonico" || perfil === "territorial") && mostrarTraspaso && traspaso ? (
        <FieldWorkHandoffCallout
          status={traspaso}
          selectedSourceId={fuenteSeleccionada}
          busy={ocupado}
          onBring={onTraer}
          onUploadInstrument={onSubirFormulario}
        />
      ) : null}
    </>
  );
}
