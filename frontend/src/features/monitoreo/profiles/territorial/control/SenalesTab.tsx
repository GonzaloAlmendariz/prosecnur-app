import { memo, useMemo, type ReactNode } from "react";
import { Activity } from "lucide-react";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { fmt } from "../rotulos";
import { construirSenales, type FilaDeSenales, type Histograma } from "./senalesModel";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { SiluetaDeDistrito } from "../avance/SiluetaDeDistrito";
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
          <RotuloDePestana />
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
          encabezado={<RotuloDePestana />}
          titulo="Distancia del GPS a la manzana"
          base={`${fmt(modelo.distancia.base)} casos con GPS cruzable`}
          criterio="En observación desde 150 m"
          mediana={modelo.distancia.mediana != null ? `Mediana ${fmt(Math.round(modelo.distancia.mediana))} m` : "Sin mediana"}
          histograma={modelo.distancia}
        />
        <PanelDeHistograma
          id="duracion"
          titulo="Duración del formulario"
          base={`${fmt(modelo.duracion.base)} casos con duración`}
          criterio="Se revisan las de menos de 5 min"
          mediana={modelo.duracion.mediana != null ? `Mediana ${modelo.duracion.mediana.toLocaleString("es-PE", { maximumFractionDigits: 1 })} min` : "Sin mediana"}
          histograma={modelo.duracion}
        />
      </div>
      <MatrizPorDistrito modelo={modelo} />
    </section>
  );
}

function PanelDeHistograma({
  id,
  encabezado = null,
  titulo,
  base,
  mediana,
  histograma,
  criterio,
}: {
  id: string;
  titulo: string;
  base: string;
  mediana: string;
  histograma: Histograma;
  /** El criterio de color, una sola vez en el subtítulo (sin leyenda: cada fila ya está rotulada). */
  criterio: string;
  encabezado?: ReactNode;
}) {
  const maximo = Math.max(1, ...histograma.tramos.map((tramo) => tramo.casos));
  return (
    <section className="mon-sen-panel" aria-labelledby={`mon-sen-${id}`}>
      <header className="mon-sen-cabecera">
        {encabezado}
        <h3 id={`mon-sen-${id}`}>{titulo}</h3>
        <span className="mon-sen-base">{base} · {mediana} · {criterio}</span>
      </header>
      <ol className="mon-sen-barras" data-qa-geometry-group={`territorial-senales-barras-${id}`} data-qa-geometry-contract="intrinsic">
        {histograma.tramos.map((tramo) => (
          <li key={tramo.desde} className={tramo.marca ? `is-${tramo.marca}` : ""}>
            <span className="mon-sen-rotulo">{tramo.rotulo}</span>
            <span className="mon-sen-barra" aria-hidden="true"><i style={{ width: `${(tramo.casos / maximo) * 100}%` }} /></span>
            <b>{fmt(tramo.casos)}</b>
          </li>
        ))}
      </ol>
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
                <th scope="row"><span className="mon-ter-con-silueta"><SiluetaDeDistrito distrito={fila.distrito} lado={30} />{fila.distrito}</span></th>
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
