import type { ComponentProps, ReactNode } from "react";
import type { EstudioPayload } from "../../../api/client";
import { BaseSavPanel } from "../BaseSavPanel";
import { BasesPanel } from "../BasesPanel";
import { BasesDelEstudio } from "../fuentes/BasesDelEstudio";
import { NuevaBaseArchivos } from "../fuentes/NuevaBaseArchivos";
import type { MultiBaseStrategy } from "../store";
import type { SourceMode } from "./cargaPaginaModelo";

export type FuentesVariasBasesProps = {
  estudio: EstudioPayload;
  estrategia: MultiBaseStrategy;
  modo: SourceMode;
  plannedInputCount: number;
  ocupado: boolean;
  tieneFormulario: boolean;
  selectorOrigen: ReactNode;
  panelPlataforma: ReactNode;
  panelMonitoreo: ReactNode;
  onEstudioCambiado: (payload: EstudioPayload) => Promise<void>;
  onOrigen: ComponentProps<typeof BasesDelEstudio>["onOrigen"];
  onDestinoFuente: ComponentProps<typeof BasesDelEstudio>["onDestinoFuente"];
  vistaPreviaFuente: ComponentProps<typeof BasesDelEstudio>["vistaPreviaFuente"];
  onConfirmarFuente: () => void;
  onDescartarVistaPrevia: () => void;
  abrirAgregarBase: boolean;
  onAgregarBaseAbierto: () => void;
  onDegradada: () => Promise<void>;
  onBaseSavRegistrada: () => void;
};

/** Fuentes con varias bases: lista de bases del estudio y alta de bases nuevas. */
export function FuentesVariasBases({
  estudio,
  estrategia,
  modo,
  plannedInputCount,
  ocupado,
  tieneFormulario,
  selectorOrigen,
  panelPlataforma,
  panelMonitoreo,
  onEstudioCambiado,
  onOrigen,
  onDestinoFuente,
  vistaPreviaFuente,
  onConfirmarFuente,
  onDescartarVistaPrevia,
  abrirAgregarBase,
  onAgregarBaseAbierto,
  onDegradada,
  onBaseSavRegistrada,
}: FuentesVariasBasesProps) {
  const separadas = estrategia === "separate";
  return (
    <>
      {/* Propuesta F (Gonzalo, 2026-10-11): con "Bases separadas", Fuentes es la lista de bases, sin número fijo;
          "Agregar base" pregunta el origen y cada import entra como una base nueva. */}
      {separadas ? (
        <BasesDelEstudio
          estudio={estudio}
          onCambio={onEstudioCambiado}
          onOrigen={onOrigen}
          onDestinoFuente={onDestinoFuente}
          vistaPreviaFuente={vistaPreviaFuente}
          onConfirmarFuente={onConfirmarFuente}
          onDescartarVistaPrevia={onDescartarVistaPrevia}
          ocupado={ocupado}
          renderCatalogo={() => panelPlataforma}
          renderOrigen={(o) => (o === "surveymonkey" || o === "kobo" ? panelPlataforma : o === "monitoreo" ? panelMonitoreo : o === "sav" ? (
            <BaseSavPanel embebido disabled={ocupado} onRegistrada={onBaseSavRegistrada} />
          ) : (
            <NuevaBaseArchivos estudio={estudio} onCambio={onEstudioCambiado} />
          ))}
        />
      ) : (
        <>
          {selectorOrigen}
          {modo === "monitoring" ? panelMonitoreo : null}
          {(modo === "files" || modo === "platform") ? (
            <BasesPanel
              estudio={estudio}
              plannedInputCount={plannedInputCount}
              onChanged={onEstudioCambiado}
              hasSessionXlsform={tieneFormulario}
              autoOpenAdd={abrirAgregarBase}
              onAutoOpenConsumed={onAgregarBaseAbierto}
              initialStrategy={estrategia}
              onDowngraded={onDegradada}
            />
          ) : null}
        </>
      )}
      {/* Una base .sav sin XLSForm (series de años anteriores) entra en cualquier estudio. Con "Bases separadas"
          es un origen más de "Agregar base" (B2); en el resto de estrategias conserva su panel. */}
      {!separadas ? (
        <BaseSavPanel disabled={ocupado} onRegistrada={onBaseSavRegistrada} />
      ) : null}
    </>
  );
}
