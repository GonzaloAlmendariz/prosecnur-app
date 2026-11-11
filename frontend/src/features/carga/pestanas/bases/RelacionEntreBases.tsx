// La relación entre las bases del estudio (Carga › Bases, R2): una línea con
// su botón "Cambiar", que abre `panel=relacion` con la decisión completa. Antes
// esa decisión ocupaba todo el alto útil a 1024x600 y la lista de bases quedaba
// fuera de la vista.

import type { ComponentProps } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { EstudioPayload } from "../../../../api/estudio";
import { EstadoChip } from "../../../../components/EstadoChip";
import { PulsoButton } from "../../../../components/PulsoButton";
import { Sideover } from "../../../../components/Sideover";
import { Database, GitMerge, Layers, Network, Split } from "../../../../vendor/lucide-react";
import { CargaTopologyDecision } from "../../CargaTopologyDecision";
import { CargaTopologyPlanBanner } from "../../CargaTopologyPlanBanner";
import { PANEL_RELACION } from "../../panelesCarga";
import type { MultiBaseStrategy } from "../../store";
import { searchConRelacion } from "./agregarBaseModel";
import { AccionesDelEstudio, type EstudioDeVariasBases } from "./AccionesDelEstudio";
import { textoDeRelacion } from "./basesModel";

type Decision = ComponentProps<typeof CargaTopologyDecision>;

export type RelacionDeBases = {
  topologia: Decision["resolution"];
  intencion: Decision["intent"];
  ocupado: boolean;
  onCambiarIntencion: Decision["onIntentChange"];
  /** Varias bases elegidas y el estudio todavía sin preparar para ellas. */
  porActivar: boolean;
  estrategiaPorActivar: MultiBaseStrategy | null;
  onActivarVariasBases: (estrategia: MultiBaseStrategy) => void | Promise<void>;
  /** El estudio de varias bases, con sus acciones; `null` con una base. */
  estudio: EstudioDeVariasBases | null;
  onEstudioCambiado: (payload: EstudioPayload) => Promise<void>;
  /** El estudio dejó de ser de varias bases. */
  onSinVariasBases: () => Promise<void>;
};

function IconoDeRelacion({ texto }: { texto: string }) {
  const Icono = texto === "Una base"
    ? Database
    : texto.startsWith("Bases separadas")
      ? Layers
      : texto === "Una base con varias fuentes"
        ? GitMerge
        : texto === "Bases independientes"
          ? Split
          : Network;
  return <Icono size={15} aria-hidden="true" />;
}

/** La línea de la relación, con "Cambiar". */
export function LineaDeRelacion({ relacion }: { relacion: RelacionDeBases }) {
  const location = useLocation();
  const navigate = useNavigate();
  const texto = textoDeRelacion(relacion.topologia, relacion.intencion);
  return (
    <div className="pulso-bases-relacion" role="group" aria-label="Relación entre las bases">
      <span className="pulso-bases-relacion-icono"><IconoDeRelacion texto={texto} /></span>
      <span className="pulso-bases-relacion-texto">{texto}</span>
      {relacion.porActivar ? (
        <EstadoChip label="Por activar" tone="warn" detail="El estudio todavía no está preparado para varias bases." />
      ) : null}
      <PulsoButton
        variant="ghost"
        size="sm"
        aria-haspopup="dialog"
        aria-label="Cambiar la relación entre las bases"
        data-plf-abrir="relacion"
        onClick={() => navigate({ pathname: location.pathname, search: searchConRelacion(location.search) }, { replace: true })}
      >
        Cambiar
      </PulsoButton>
    </div>
  );
}

/**
 * `panel=relacion`: la decisión completa, con su causa cuando está fijada.
 * Activar varias bases, volver a una o quitar todas cambia de pestaña
 * (`pestana=bases`), y eso cierra el panel: no hace falta cerrarlo aquí.
 */
export function PanelDeRelacion({ relacion }: { relacion: RelacionDeBases }) {
  return (
    <Sideover
      panel={PANEL_RELACION}
      alto="contenido"
      title="Relación entre las bases"
      icon={<Network size={16} aria-hidden="true" />}
      className="pulso-bases-relacion-panel"
    >
      <div className="pulso-bases-relacion-cuerpo">
        <CargaTopologyDecision
          resolution={relacion.topologia}
          intent={relacion.intencion}
          disabled={relacion.ocupado}
          onIntentChange={relacion.onCambiarIntencion}
        />
        {relacion.porActivar ? (
          <CargaTopologyPlanBanner
            strategy={relacion.estrategiaPorActivar}
            disabled={relacion.ocupado}
            onEnableMultiBase={relacion.onActivarVariasBases}
          />
        ) : null}
        {relacion.estudio ? (
          <AccionesDelEstudio
            estudio={relacion.estudio}
            ocupado={relacion.ocupado}
            onCambio={relacion.onEstudioCambiado}
            onSinVariasBases={relacion.onSinVariasBases}
          />
        ) : null}
      </div>
    </Sideover>
  );
}
