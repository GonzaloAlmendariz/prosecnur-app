import type { ReactNode } from "react";
import { pctConEspacio } from "../../../core/formatoComun";
import type { CuotasFaltante } from "./cuotasFaltanteModel";
import "../control/controlTelefonico.css";
import "./entregasTelefonico.css";

function n(valor: number | null) {
  return valor == null ? "—" : valor.toLocaleString("es-PE");
}

/**
 * Avance › Entregas: a la izquierda, lo que recibe el cliente (el avance por
 * cuota con las cifras de este corte, como lo lleva su PDF); a la derecha, las
 * salidas de siempre (`MonitoreoOutputsWorkbench`): el PDF del cliente, el de
 * producción para el equipo y la publicación en las hojas del cliente e
 * interna, con su revisión antes de aplicar. Esta vista no publica ni genera
 * nada por su cuenta.
 */
export function Entregas({
  modelo,
  corte,
  salidas,
}: {
  modelo: CuotasFaltante | null;
  /** «27/07/2026 09:04», o vacío sin corte. */
  corte: string;
  salidas: ReactNode;
}) {
  const segmento = modelo?.segmento || "Categoría";
  return (
    <div className="mon-entregas" data-qa-geometry-group="telefonico-avance-entregas" data-qa-geometry-contract="intrinsic">
      <section className="mon-ctl-panel mon-entregas-cliente" aria-label="Para el cliente: avance por cuota" data-qa-geometry-capacity="owned">
        <header className="mon-entregas-cabecera">
          <strong>Para el cliente: avance por cuota</strong>
          <span>Así lo lleva su PDF, con las cifras de este corte</span>
        </header>
        <div className="mon-entregas-mesa">
          <article className="mon-entregas-hoja" aria-label="Vista del PDF del cliente">
            <header>
              <strong>Monitoreo telefónico</strong>
              <span>{corte ? `Corte del ${corte}` : "Sin corte"}</span>
            </header>
            <h3>Avance por {segmento.toLocaleLowerCase("es")}</h3>
            {modelo && modelo.filas.length ? (
              <table className="mon-entregas-tabla">
                <thead>
                  <tr>
                    <th scope="col">{segmento}</th>
                    <th scope="col" className="is-num">Meta</th>
                    <th scope="col" className="is-num">Efectivas</th>
                    <th scope="col" className="is-num">Faltan</th>
                    <th scope="col" className="is-num">Avance</th>
                  </tr>
                </thead>
                <tbody>
                  {modelo.filas.map((fila) => (
                    <tr key={fila.clave}>
                      <th scope="row">{fila.nombre}</th>
                      <td className="is-num">{n(fila.meta)}</td>
                      <td className="is-num"><b>{n(fila.efectivas)}</b></td>
                      <td className="is-num">{n(fila.faltan)}</td>
                      <td className="is-num">{pctConEspacio(fila.pct)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    <td className="is-num">{n(modelo.total.meta)}</td>
                    <td className="is-num">{n(modelo.total.efectivas)}</td>
                    <td className="is-num">{n(modelo.total.faltan)}</td>
                    <td className="is-num">{pctConEspacio(modelo.total.pct)}</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p className="mon-entregas-sin-datos">El corte no trae cuotas para mostrar.</p>
            )}
            <footer>
              El PDF del cliente lleva además el avance ejecutivo y el ritmo diario. Efectivas: envíos de Kobo que pasan
              el filtro de efectiva, uno por CodPulso.
            </footer>
          </article>
        </div>
        <p className="mon-entregas-pie">El cliente no abre la app: recibe el PDF y su hoja. La fecha de la última publicación queda en el proyecto.</p>
      </section>

      <div className="mon-entregas-salidas" aria-label="Salidas del corte">
        {salidas}
      </div>
    </div>
  );
}
