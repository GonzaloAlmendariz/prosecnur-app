// «Recorrido en el tiempo»: la duración estimada partida en un tramo por sección, proporcional a sus minutos, con
// marcas de minuto debajo. Las secciones pesadas resaltan; el resto alterna dos tonos para que los tramos vecinos se
// distingan. Cada tramo dice su sección y sus minutos al pasar el puntero o al enfocarlo; el clic resalta su fila en
// la tabla de secciones y la trae a la vista, sin salir de «Resumen» (ítem 50).

import { stripMarkdown } from "../helpers/markdown";
import { duracion, marcasDeMinutos, rotuloMinutos, type FilaSeccion } from "./modeloResumen";

/** Un tramo más angosto que esta parte del total no lleva rótulo: «S2: …» montado sobre el vecino no se lee (S14). */
const ANCHO_CON_ROTULO = 0.06;

export function LineaTiempo({ filas, segundos, resaltada, onResaltar }: {
  filas: readonly FilaSeccion[];
  segundos: number;
  /** Id de la sección cuyo tramo está resaltado, o null. */
  resaltada: string | null;
  onResaltar: (fila: FilaSeccion) => void;
}) {
  const tramos = filas.filter((f) => f.segundos > 0);
  const marcas = marcasDeMinutos(segundos);
  if (tramos.length === 0 || segundos <= 0) return null;
  return (
    <section className="pulso-xf-res-tiempo" aria-labelledby="xf-res-tiempo-titulo" data-qa-geometry-member="">
      <header className="pulso-xf-res-tiempo-cabeza">
        <h3 id="xf-res-tiempo-titulo">Recorrido en el tiempo</h3>
        <span>Cada tramo es una sección, del inicio al final del cuestionario</span>
      </header>
      <ol className="pulso-xf-res-tiempo-barra" data-qa-geometry-group="xlsform/resumen-recorrido" data-qa-geometry-contract="intrinsic">
        {tramos.map((f, i) => {
          const texto = `${f.rotulo} · ${duracion(f.segundos)}`;
          return (
            <li key={f.id} style={{ flexGrow: f.segundos }} data-qa-geometry-member="">
              <button
                type="button"
                className={`pulso-xf-res-tramo${f.pesada ? " is-pesada" : i % 2 ? " is-par" : ""}${resaltada === f.id ? " is-resaltado" : ""}`}
                title={texto}
                aria-label={`${texto}. Ver su fila en la tabla de secciones`}
                aria-pressed={resaltada === f.id}
                onClick={() => onResaltar(f)}
              >
                {f.segundos / segundos >= ANCHO_CON_ROTULO ? <span>{stripMarkdown(f.rotulo) || f.name}</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="pulso-xf-res-tiempo-marcas" aria-hidden="true" data-qa-geometry-group="xlsform/resumen-eje" data-qa-geometry-contract="intrinsic">
        {marcas.map((m) => {
          const pos = Math.min(100, (m * 60 * 100) / segundos);
          return <span key={m} className={pos > 94 ? "is-final" : undefined} style={{ left: `${pos}%` }} data-qa-geometry-member="">{rotuloMinutos(m)}</span>;
        })}
      </div>
    </section>
  );
}
