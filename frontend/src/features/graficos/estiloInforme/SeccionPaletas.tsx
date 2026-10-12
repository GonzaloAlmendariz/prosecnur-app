// C51: colores por etiqueta de respuesta, por lista del instrumento. Reusa `PaletasEditor` (sugeridas, listas idénticas,
// vaciar por lista) con todo su comportamiento; esta sección le da procedencia y lo deja crecer dentro del único dueño
// de desplazamiento de la pestaña (la hoja de estilos anula aquí sus desplazamientos internos: C4, No Scroll Jail).

import { useId } from "react";
import { PaletasEditor } from "../PaletasEditor";
import { SelloProcedencia } from "../estilo/SelloProcedencia";
import { CabeceraSeccion } from "./CabeceraSeccion";
import "./paletasArreglo.css";

export function SeccionPaletas({ listasConColor }: { listasConColor: number }) {
  const tituloId = useId();
  const propio = listasConColor > 0;
  return (
    <section className="pulso-f6-informe-seccion" aria-labelledby={tituloId} data-qa-geometry-member data-seccion="paletas">
      <CabeceraSeccion
        id={tituloId}
        titulo="Paletas"
        modificado={propio}
        extra={(
          <>
            <SelloProcedencia procedencia={propio ? "propio" : "recetario"} />
            {propio ? (
              <span className="pulso-f6-informe-conteo">
                {listasConColor} lista{listasConColor === 1 ? "" : "s"} con colores propios
              </span>
            ) : null}
          </>
        )}
      />
      <p className="pulso-f6-informe-ayuda">
        Una lista sin colores usa la paleta del recetario. Para devolver una lista al recetario, vacía su paleta.
      </p>
      <div className="pulso-f6-informe-incrustado pulso-f6-informe-paletas">
        <PaletasEditor />
      </div>
    </section>
  );
}
