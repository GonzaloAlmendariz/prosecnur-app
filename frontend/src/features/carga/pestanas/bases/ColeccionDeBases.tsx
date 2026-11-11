// La colección de bases (Carga › Bases, prototipo "carga-bases"): una fila por
// base a todo el ancho, con las hijas de grupo repetido dentro de su madre, y
// debajo los orígenes para agregar otra. Sin bases, los orígenes son la
// pantalla y el vacío lo dice dentro de la misma caja.

import type { ReactNode } from "react";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { Database } from "../../../../vendor/lucide-react";
import type { ColeccionDeBases as Coleccion } from "./basesModel";
import { TarjetaDeBase } from "./TarjetaDeBase";

export function ColeccionDeBases({
  coleccion,
  enfocada,
  onEnfocar,
  origenes,
}: {
  coleccion: Coleccion;
  enfocada: string | null;
  onEnfocar: (nombre: string) => void;
  /** "Agregar una base desde", con los orígenes que ofrece la relación. */
  origenes: ReactNode;
}) {
  if (coleccion.bases.length === 0) {
    return (
      <div className="pulso-bases-sin-bases">
        {origenes}
        <div className="pulso-bases-sin-bases-centro">
          <EstadoVacio
            tamano="normal"
            icono={<Database size={20} />}
            titulo="El estudio todavía no tiene bases"
            descripcion="Elige de dónde viene la primera."
          />
        </div>
      </div>
    );
  }
  return (
    <div className="pulso-bases-lista">
      <div
        className="pulso-bases-coleccion"
        role="list"
        aria-label="Bases del estudio"
        data-qa-geometry-group="carga/bases"
        data-qa-geometry-contract="intrinsic"
        data-bases={coleccion.bases.length}
      >
        {coleccion.bases.map((base) => (
          <div role="listitem" key={base.nombre} className="pulso-bases-celda">
            <TarjetaDeBase base={base} enfocada={enfocada} onEnfocar={onEnfocar} />
          </div>
        ))}
      </div>
      {origenes}
    </div>
  );
}
