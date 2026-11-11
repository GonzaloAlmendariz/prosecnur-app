import type { ComponentProps } from "react";
import { CargaSourcesPlan } from "../CargaSourcesPlan";
import type { EstudioPayload } from "../../../api/client";
import { FuentesUnaBase, type FuentesUnaBaseProps } from "./FuentesUnaBase";
import { FuentesVariasBases, type FuentesVariasBasesProps } from "./FuentesVariasBases";
import { OrigenesDeCarga } from "./OrigenesDeCarga";
import { PanelMonitoreoCarga, type PanelMonitoreoCargaProps } from "./PanelMonitoreoCarga";
import { PlatformImportPanel } from "./PanelPlataforma";
import type { SourceMode } from "./cargaPaginaModelo";

type Plan = ComponentProps<typeof CargaSourcesPlan>;

export type PestanaFuentesProps = {
  varias: boolean;
  estudio: EstudioPayload | null;
  estrategia: Plan["strategy"];
  /** La topología resuelta no es de varias bases. */
  unica: boolean;
  plannedInputCount: number;
  materializedInputCount: number;
  ocupado: boolean;
  onPlannedInputCountChange: Plan["onPlannedInputCountChange"];
  origen: { modo: SourceMode; modos: SourceMode[]; onModo: (modo: SourceMode) => void };
  plataforma: ComponentProps<typeof PlatformImportPanel>;
  monitoreo: PanelMonitoreoCargaProps;
  variasBases: Omit<
    FuentesVariasBasesProps,
    "estudio" | "estrategia" | "modo" | "plannedInputCount" | "ocupado" | "selectorOrigen" | "panelPlataforma" | "panelMonitoreo"
  >;
  unaBase: Omit<
    FuentesUnaBaseProps,
    "modo" | "estrategia" | "unica" | "plannedInputCount" | "ocupado" | "selectorOrigen" | "panelPlataforma" | "panelMonitoreo"
  >;
};

/** Fuentes: de dónde entran las bases. Con varias bases lista las del estudio; con una, sube o importa. */
export function PestanaFuentes({
  varias,
  estudio,
  estrategia,
  unica,
  plannedInputCount,
  materializedInputCount,
  ocupado,
  onPlannedInputCountChange,
  origen,
  plataforma,
  monitoreo,
  variasBases,
  unaBase,
}: PestanaFuentesProps) {
  const selectorOrigen = <OrigenesDeCarga modo={origen.modo} modos={origen.modos} onModo={origen.onModo} />;
  const panelPlataforma = <PlatformImportPanel {...plataforma} />;
  const panelMonitoreo = <PanelMonitoreoCarga {...monitoreo} />;
  return (
    <div className="pulso-carga-surface pulso-carga-sources" data-carga-surface="sources" data-qa-geometry-group="carga/fuentes" data-qa-geometry-contract="intrinsic">
      <CargaSourcesPlan
        strategy={estrategia}
        single={unica}
        plannedInputCount={plannedInputCount}
        materializedInputCount={materializedInputCount}
        disabled={ocupado}
        onPlannedInputCountChange={onPlannedInputCountChange}
      />
      {varias && estudio ? (
        <FuentesVariasBases
          {...variasBases}
          estudio={estudio}
          estrategia={estrategia}
          modo={origen.modo}
          plannedInputCount={plannedInputCount}
          ocupado={ocupado}
          selectorOrigen={selectorOrigen}
          panelPlataforma={panelPlataforma}
          panelMonitoreo={panelMonitoreo}
        />
      ) : varias ? null : (
        <FuentesUnaBase
          {...unaBase}
          modo={origen.modo}
          estrategia={estrategia}
          unica={unica}
          plannedInputCount={plannedInputCount}
          ocupado={ocupado}
          selectorOrigen={selectorOrigen}
          panelPlataforma={panelPlataforma}
          panelMonitoreo={panelMonitoreo}
        />
      )}
    </div>
  );
}
