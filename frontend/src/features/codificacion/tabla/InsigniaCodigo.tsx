import { CLASE_CHIP_CON_CONTROLES, ChipControl } from "../../../components/ChipConControles";
import { X } from "../../../vendor/lucide-react";
import { RotuloCodigo } from "./RotuloCodigo";
import type { CodigoTabla } from "./tablaCodificarModelo";
import "./tablaCodificar.css";

export type InsigniaCodigoProps = {
  codigo: CodigoTabla;
  /** La respuesta de la fila, para el nombre accesible del botón de quitar. */
  respuesta: string;
  onQuitar: () => void;
  /** Solo la fila activa deja sus botones en el orden de tabulación. */
  enfocable: boolean;
};

/** Un código ya asignado a la respuesta: número, nombre y el botón que lo quita. */
export function InsigniaCodigo({ codigo, respuesta, onQuitar, enfocable }: InsigniaCodigoProps) {
  return (
    <span className={`${CLASE_CHIP_CON_CONTROLES} pulso-ct-insignia`}>
      <RotuloCodigo codigo={codigo} />
      <ChipControl
        aria-label={`Quitar el código ${codigo.rotulo} de "${respuesta}"`}
        title="Quitar el código"
        tabIndex={enfocable ? 0 : -1}
        onClick={(evento) => {
          // Quitar un código no cambia la fila activa.
          evento.stopPropagation();
          onQuitar();
        }}
      >
        <X size={12} aria-hidden="true" />
      </ChipControl>
    </span>
  );
}
