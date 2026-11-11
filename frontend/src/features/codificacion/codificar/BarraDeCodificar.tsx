import type { ReactNode } from "react";
import { PulsoButton } from "../../../components/PulsoButton";
import { SaveStatusIndicator } from "../../../components/SaveStatusIndicator";
import { rotuloDeAtajo } from "../../../lib/teclado";
import { Undo2 } from "../../../vendor/lucide-react";
import type { AvanceRespuestas } from "../avanceRespuestas";
import { ConmutadorVista } from "../tabla/ConmutadorVista";
import type { VistaCodificar } from "../tabla/vistaCodificarStore";
import { CifrasDeCodificar } from "./CifrasDeCodificar";
import type { CifraDeCasos } from "./modeloDeCodificar";
import type { EstadoDeGuardado } from "./useGruposDeCodificacion";

export type BarraDeCodificarProps = {
  avance: AvanceRespuestas;
  casos: readonly CifraDeCasos[];
  guardado: EstadoDeGuardado;
  /** Lo último que se puede deshacer; `null` sin pasos. */
  ultimoPaso: string | null;
  onDeshacer: () => void;
  vista: VistaCodificar;
  onVista: (vista: VistaCodificar) => void;
  /** Controles propios de un texto abierto: "Módulo sugerido" y "Palabras". */
  children?: ReactNode;
};

/**
 * La cabecera de la mesa, en una fila: a la izquierda las cifras de la pregunta, a la derecha el estado
 * del guardado, deshacer, los controles del texto abierto y el conmutador de vista. Es la misma para
 * tarjetas y para tabla.
 */
export function BarraDeCodificar({ avance, casos, guardado, ultimoPaso, onDeshacer, vista, onVista, children }: BarraDeCodificarProps) {
  const deshacer = ultimoPaso ? `Deshacer: ${ultimoPaso}` : "Deshacer";
  return (
    <div className="pulso-cc-barra">
      <CifrasDeCodificar avance={avance} casos={casos} />
      <div className="pulso-cc-barra-acciones">
        <SaveStatusIndicator state={guardado} variant="badge" />
        <PulsoButton
          variant="icon"
          tone="framed"
          size="sm"
          disabled={!ultimoPaso}
          onClick={onDeshacer}
          aria-label={deshacer}
          title={rotuloDeAtajo(deshacer, "Z")}
        >
          <Undo2 aria-hidden="true" />
        </PulsoButton>
        {children}
        <ConmutadorVista vista={vista} onElegir={onVista} />
      </div>
    </div>
  );
}
