import { Fragment } from "react";
import { tramosDelNombre } from "./generacionModelo";

/**
 * Nombre de un archivo en el contenedor y en la bandeja: entero, y si no cabe en la línea parte tras un `_`
 * (`<wbr>`), con la fecha y la extensión juntas al final. El texto es el mismo nombre: `<wbr>` no agrega nada.
 */
export function NombreArchivo({ nombre }: { nombre: string }) {
  const tramos = tramosDelNombre(nombre);
  return (
    <div className="pulso-entregable-nombre">
      {/* Los tramos se repiten ("10_", "11_"): su posición es su identidad. */}
      {tramos.map((tramo, i) => <Fragment key={`${i}-${tramo}`}>{i > 0 && <wbr />}{tramo}</Fragment>)}
    </div>
  );
}
