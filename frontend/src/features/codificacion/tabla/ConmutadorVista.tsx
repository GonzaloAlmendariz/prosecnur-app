import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { LayoutGrid, Table } from "../../../vendor/lucide-react";
import type { VistaCodificar } from "./vistaCodificarStore";
import "./tablaCodificar.css";

const VISTAS = [
  { id: "tarjetas", rotulo: "Tarjetas", Icono: LayoutGrid },
  { id: "tabla", rotulo: "Tabla", Icono: Table },
] as const satisfies readonly { id: VistaCodificar; rotulo: string; Icono: typeof LayoutGrid }[];

export type ConmutadorVistaProps = {
  vista: VistaCodificar;
  onElegir: (vista: VistaCodificar) => void;
};

/** Elige cómo se mira la misma pregunta: en tarjetas o en tabla. */
export function ConmutadorVista({ vista, onElegir }: ConmutadorVistaProps) {
  return (
    <GlidingRadioGroup
      value={vista}
      options={VISTAS}
      getOptionValue={(opcion) => opcion.id}
      onValueChange={onElegir}
      className="pulso-ct-vista"
      aria-label="Vista de las respuestas"
    >
      {(opcion) => (
        <>
          <opcion.Icono size={13} aria-hidden="true" />
          <span>{opcion.rotulo}</span>
        </>
      )}
    </GlidingRadioGroup>
  );
}
