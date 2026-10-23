import { memo, useMemo } from "react";
import { Activity } from "lucide-react";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { fmt } from "../rotulos";
import { construirSenales, type FilaDeSenales, type Histograma } from "./senalesModel";
import "./senales.css";

/**
 * Control › Señales (territorial.md §3.7): la distancia del GPS a la manzana y
 * la duración del formulario, en tramos con su base y su mediana, y las
 * señales por distrito.
 */
function SenalesTabImpl({ reports }: { reports: MonitoreoTerritorialDashboard | null }) {
  const modelo = useMemo(() => construirSenales(reports), [reports]);

  if (!modelo.disponible) {
    return (
      <section className="mon-sen mon-sen--vacio" data-audit-ready="vacio:sin-respuestas" aria-label="Señales">
        <div className="mon-sen-panel mon-sen-vacio">
          <Activity size={20} aria-hidden="true" />
          <strong>Sin respuestas en el corte</strong>
          <span>Las señales de GPS y duración aparecen cuando la fuente de Kobo trae respuestas de la fase activa.</span>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mon-sen"
      aria-label="Señales"
      data-audit-ready="monitoreo-territorial-control-senales"
      data-qa-geometry-group="territorial-senales"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="mon-sen-histogramas" data-qa-geometry-member="histogramas" data-qa-geometry-group="territorial-senales-histogramas" data-qa-geometry-contract="equal">
        <PanelDeHistograma
          id="distancia"
          titulo="Distancia del GPS a la manzana"
          base={`${fmt(modelo.distancia.base)} casos con GPS cruzable`}
          mediana={modelo.distancia.mediana != null ? `Mediana ${fmt(Math.round(modelo.distancia.mediana))} m` : "Sin mediana"}
          histograma={modelo.distancia}
          leyenda={[["is-revision", "150 a 300 m: en observación"], ["is-lejos", "Más de 300 m: en observación"]]}
        />
        <PanelDeHistograma
          id="duracion"
          titulo="Duración del formulario"
          base={`${fmt(modelo.duracion.base)} casos con duración`}
          mediana={modelo.duracion.mediana != null ? `Mediana ${modelo.duracion.mediana.toLocaleString("es-PE", { maximumFractionDigits: 1 })} min` : "Sin mediana"}
          histograma={modelo.duracion}
          leyenda={[["is-muy-corta", "Menos de 2 min: se revisa"], ["is-corta", "2 a 5 min: se revisa"], ["is-neutra", "5 min o más: sin alerta, también las largas"]]}
        />
      </div>
      <MatrizPorDistrito modelo={modelo} />
    </section>
  );
}

function PanelDeHistograma({
  id,
  titulo,
  base,
  mediana,
  histograma,
  leyenda,
}: {
  id: string;
  titulo: string;
  base: string;
  mediana: string;
  histograma: Histograma;
  leyenda: Array<[string, string]>;
}) {
  const maximo = Math.max(1, ...histograma.tramos.map((tramo) => tramo.casos));
  return (
    <section className="mon-sen-panel" aria-labelledby={`mon-sen-${id}`}>
      <header className="mon-sen-cabecera">
        <h3 id={`mon-sen-${id}`}>{titulo}</h3>
        <span className="mon-sen-base">{base} · {mediana}</span>
      </header>
      <ol className="mon-sen-barras">
        {histograma.tramos.map((tramo) => (
          <li key={tramo.desde} className={tramo.marca ? `is-${tramo.marca}` : ""}>
            <span className="mon-sen-rotulo">{tramo.rotulo}</span>
            <span className="mon-sen-barra" aria-hidden="true"><i style={{ width: `${(tramo.casos / maximo) * 100}%` }} /></span>
            <b>{fmt(tramo.casos)}</b>
          </li>
        ))}
      </ol>
      <footer className="mon-sen-leyenda">
        {leyenda.map(([clase, rotulo]) => <span key={clase} className={clase}>{rotulo}</span>)}
      </footer>
    </section>
  );
}

const COLUMNAS: Array<[keyof FilaDeSenales, string]> = [
  ["casos", "Casos"],
  ["enManzana", "En su manzana"],
  ["hasta150", "Hasta 150 m"],
  ["de150a300", "150 a 300 m"],
  ["mas300", "Más de 300 m"],
  ["sinGps", "Sin GPS"],
  ["sinCruce", "GPS sin cruce"],
  ["corta", "2 a 5 min"],
  ["muyCorta", "Menos de 2 min"],
];

function MatrizPorDistrito({ modelo }: { modelo: ReturnType<typeof construirSenales> }) {
  const columnas = COLUMNAS.filter(([clave]) => clave !== "sinCruce" || modelo.total.sinCruce > 0);
  return (
    <section className="mon-sen-panel mon-sen-matriz" aria-labelledby="mon-sen-matriz" data-qa-geometry-member="matriz">
      <header className="mon-sen-cabecera">
        <h3 id="mon-sen-matriz">Señales por distrito</h3>
        <span className="mon-sen-base">
          Base: {fmt(modelo.total.casos)} casos del corte con distrito
          {modelo.sinDistrito ? `; ${fmt(modelo.sinDistrito)} sin distrito quedan fuera` : ""}
        </span>
      </header>
      <div className="mon-sen-tabla-marco" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="Señales por distrito, con desplazamiento">
        <table className="mon-sen-tabla">
          <thead>
            <tr>
              <th scope="col">Distrito</th>
              {columnas.map(([clave, rotulo]) => <th key={clave} scope="col" className="is-num">{rotulo}</th>)}
            </tr>
          </thead>
          <tbody>
            {modelo.distritos.map((fila) => (
              <tr key={fila.distrito}>
                <th scope="row">{fila.distrito}</th>
                {columnas.map(([clave]) => <td key={clave} className="is-num">{fmt(fila[clave])}</td>)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {columnas.map(([clave]) => <td key={clave} className="is-num">{fmt(modelo.total[clave])}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export const SenalesTab = memo(SenalesTabImpl);
