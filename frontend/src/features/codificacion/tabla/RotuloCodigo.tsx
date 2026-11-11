import type { CSSProperties } from "react";
import type { CodigoTabla } from "./tablaCodificarModelo";
import "./tablaCodificar.css";

/** El color del grupo como propiedad CSS: la hoja lo mezcla con la superficie (mismo patrón que las tarjetas). */
function acento(color: string): CSSProperties {
  return { "--cv2-chip-accent": color } as CSSProperties;
}

/** Un código: su número en una ficha del color del grupo y su nombre al lado. */
export function RotuloCodigo({ codigo }: { codigo: CodigoTabla }) {
  return (
    <span className="pulso-ct-rotulo" title={codigo.rotulo}>
      {codigo.numero ? (
        <span className="pulso-ct-numero" style={acento(codigo.acento)}>
          {codigo.numero}
        </span>
      ) : null}
      <span className="pulso-ct-nombre">{codigo.nombre}</span>
    </span>
  );
}
