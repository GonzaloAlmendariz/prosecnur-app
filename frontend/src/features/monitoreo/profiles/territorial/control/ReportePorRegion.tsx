import { fmt } from "../rotulos";
import type { FilaDeRegion } from "./coordinacionModelo";

/** 2h · Control › Equipo: el control de encuestadores agrupado por región. */
export function ReportePorRegion({ filas }: { filas: FilaDeRegion[] }) {
  if (!filas.length) return null;
  const conAlerta = filas.filter((f) => f.noCuadran > 0).length;
  return (
    <details className="mon-eq-region" open>
      <summary>
        Por región · {fmt(filas.length)} regiones{conAlerta ? `, ${fmt(conAlerta)} con UMP que no cuadran` : ""}
      </summary>
      <div className="mon-eq-tabla-marco" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="Control por región, con desplazamiento">
        <table className="mon-eq-tabla">
          <thead>
            <tr>
              <th scope="col">Región</th>
              <th scope="col" className="is-num">UMP</th>
              <th scope="col" className="is-num">Kobo</th>
              <th scope="col" className="is-num">Coordinación</th>
              <th scope="col" className="is-num">No cuadran</th>
              <th scope="col" className="is-num">Rendimiento</th>
              <th scope="col" className="is-num">Supervisión</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.region}>
                <th scope="row">{f.region}</th>
                <td className="is-num">{f.ump}</td>
                <td className="is-num">{f.kobo}</td>
                <td className="is-num">{f.declaradas}</td>
                <td className="is-num">{f.noCuadran ? <b className="mon-eq-no-cuadra">{fmt(f.noCuadran)}</b> : "0"}</td>
                <td className="is-num" title={f.tituloRendimiento}>{f.rendimiento}</td>
                <td className="is-num" title="Aprobadas / no aprobadas">{f.supervision}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
