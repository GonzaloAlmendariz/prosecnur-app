// La colección de bases (Carga › Bases): una tarjeta por base, del mismo tamaño
// todas (C2), con las hijas de grupo repetido dentro de su madre. Sin bases, el
// vacío ocupa la caja de la colección y ofrece "Agregar base".

import type { ReactNode } from "react";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { Database } from "../../../../vendor/lucide-react";
import type { ColeccionDeBases as Coleccion } from "./basesModel";
import { TarjetaDeBase } from "./TarjetaDeBase";

export function ColeccionDeBases({
  coleccion,
  enfocada,
  onEnfocar,
  accionVacia,
}: {
  coleccion: Coleccion;
  enfocada: string | null;
  onEnfocar: (nombre: string) => void;
  /** El botón del vacío ("Agregar base"); sin él, el vacío solo lo dice. */
  accionVacia: ReactNode;
}) {
  if (coleccion.bases.length === 0) {
    return (
      <div className="pulso-bases-sin-bases">
        <EstadoVacio
          tamano="normal"
          icono={<Database size={20} />}
          titulo="Todavía no hay bases"
          accion={accionVacia}
        />
      </div>
    );
  }
  return (
    <div
      className="pulso-bases-coleccion"
      role="list"
      aria-label="Bases del estudio"
      data-qa-geometry-group="carga/bases"
      data-qa-geometry-contract="equal"
      data-bases={coleccion.bases.length}
    >
      {coleccion.bases.map((base) => (
        <div role="listitem" key={base.nombre} className="pulso-bases-celda">
          <TarjetaDeBase base={base} enfocada={enfocada} onEnfocar={onEnfocar} />
        </div>
      ))}
    </div>
  );
}
