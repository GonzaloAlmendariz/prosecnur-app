// «Recorrido en el tiempo»: la duración estimada partida en un tramo por sección, proporcional a sus minutos, con
// marcas de minuto debajo. Las secciones pesadas resaltan; el resto alterna dos tonos para que los tramos vecinos se
// distingan. Cada tramo dice su sección y sus minutos al pasar el puntero o al enfocarlo, y abre la sección.

import { duracion, marcasDeMinutos, type FilaSeccion } from "./modeloResumen";

export function LineaTiempo({ filas, segundos, onAbrir }: {
  filas: readonly FilaSeccion[];
  segundos: number;
  onAbrir: (fila: FilaSeccion) => void;
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
                className={`pulso-xf-res-tramo${f.pesada ? " is-pesada" : i % 2 ? " is-par" : ""}`}
                title={texto}
                aria-label={`${texto}. Abrir en el Constructor`}
                onClick={() => onAbrir(f)}
                disabled={!f.name}
              >
                <span>{f.name || f.rotulo}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="pulso-xf-res-tiempo-marcas" aria-hidden="true">
        {marcas.map((m) => {
          const pos = Math.min(100, (m * 60 * 100) / segundos);
          return <span key={m} className={pos > 94 ? "is-final" : undefined} style={{ left: `${pos}%` }}>{m} min</span>;
        })}
      </div>
    </section>
  );
}
