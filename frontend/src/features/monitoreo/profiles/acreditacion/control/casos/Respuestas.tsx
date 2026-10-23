import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Alert } from "../../../../../../components/Alert";
import type { MonitoreoInternalQueries } from "../../../../../../api/client";
import { fmt } from "../../formato";
import { fechaCorta } from "../../avance/graficosDeAvance";
import { pagina } from "./personasModelo";
import { conteoDeFaceta, csvDeRespuestas, FACETAS, filtrarRespuestas, respuestasDe, type Seleccion } from "./respuestasModelo";
import { descargarCsv } from "./descargarCsv";
import "../../avance/avance.css";
import "./cruce.css";
import "./personas.css";

/**
 * Control › Respuestas (ficha Ctl9): qué llegó de cada plataforma. Facetas
 * con su conteo a la izquierda; la tabla, la más reciente primero, con
 * buscador, páginas y exportación.
 */
export function Respuestas({ consultas }: { consultas: MonitoreoInternalQueries }) {
  const respuestas = useMemo(() => respuestasDe(consultas.cases), [consultas.cases]);
  const [seleccion, setSeleccion] = useState<Seleccion>({});
  const [busqueda, setBusqueda] = useState("");
  const [numero, setNumero] = useState(1);
  const filtradas = useMemo(() => filtrarRespuestas(respuestas, seleccion, busqueda), [respuestas, seleccion, busqueda]);
  const vista = pagina(filtradas, numero);
  const cuentan = respuestas.filter((respuesta) => respuesta.cuenta).length;

  if (!respuestas.length) {
    return (
      <div className="acr-cr is-vacio" data-vacio>
        <Alert kind="info">El corte todavía no trae respuestas de las plataformas.</Alert>
      </div>
    );
  }

  return (
    <div className="acr-ps is-respuestas" data-qa-geometry-group="acreditacion-control-respuestas" data-qa-geometry-contract="intrinsic">
      <nav className="acr-av-panel acr-pr-filtros" aria-label="Facetas de las respuestas">
        <div className="acr-pr-filtros-cuerpo">
          <p className="acr-rs-total">
            <b className="acr-av-num">{fmt(respuestas.length)}</b>
            <span className="acr-av-tenue">{`respuestas; ${fmt(cuentan)} cuentan en el avance`}</span>
          </p>
          {FACETAS.map(({ id, rotulo }) => (
            <section key={id} className="acr-pr-grupo">
              <h3 className="acr-av-antetitulo">{rotulo}</h3>
              <ul>
                {conteoDeFaceta(respuestas, id, seleccion).map(({ valor, casos }) => {
                  const activa = seleccion[id] === valor;
                  return (
                    <li key={valor}>
                      <button
                        type="button"
                        className={activa ? "is-activo" : undefined}
                        aria-pressed={activa}
                        onClick={() => { setSeleccion((previa) => ({ ...previa, [id]: activa ? undefined : valor })); setNumero(1); }}
                      >
                        <span>{valor}</span>
                        <b className="acr-av-num">{fmt(casos)}</b>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </nav>
      <section className="acr-av-panel acr-ps-tabla" aria-label="Respuestas recibidas">
        <header className="acr-av-panel-cabecera acr-ps-filtros">
          <label className="acr-pr-buscador">
            <Search size={14} aria-hidden="true" />
            <input type="search" value={busqueda} onChange={(event) => { setBusqueda(event.target.value); setNumero(1); }} placeholder="Respuesta, público o encuesta" aria-label="Buscar respuestas" />
          </label>
          <span className="acr-av-tenue acr-ps-chips">Las más recientes primero</span>
          <button type="button" className="acr-av-boton" onClick={() => descargarCsv(csvDeRespuestas(filtradas), "respuestas-recibidas.csv")} disabled={!filtradas.length}>
            <Download size={14} aria-hidden="true" /> Exportar CSV
          </button>
        </header>
        <div className="acr-pr-cola-marco" data-qa-geometry-capacity="owned">
          {vista.filas.length ? (
            <table className="acr-pub-tabla">
              <thead>
                <tr>
                  <th scope="col">Respuesta</th>
                  <th scope="col" className="is-num">Recibida</th>
                  <th scope="col">Público</th>
                  <th scope="col">Canal</th>
                  <th scope="col">Encuesta</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Cruce</th>
                  <th scope="col">Avance</th>
                </tr>
              </thead>
              <tbody>
                {vista.filas.map((respuesta) => (
                  <tr key={respuesta.clave}>
                    <th scope="row" className="acr-av-num">{respuesta.id}</th>
                    <td className="is-num">{respuesta.recibida ? fechaCorta(respuesta.recibida) : "—"}</td>
                    <td>{respuesta.publico}</td>
                    <td>{respuesta.canal}</td>
                    <td>{respuesta.encuesta || "—"}</td>
                    <td>{respuesta.estado}</td>
                    <td>{respuesta.cruce}</td>
                    <td><span className={`acr-av-chip${respuesta.cuenta ? " is-cumple" : ""}`}>{respuesta.cuenta ? "Cuenta" : "No cuenta"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="acr-pr-cola-vacia" data-vacio><Alert kind="info">Ninguna respuesta coincide con estos filtros.</Alert></div>}
        </div>
        <footer className="acr-ps-pie">
          <span className="acr-av-tenue">{`${fmt(filtradas.length)} ${filtradas.length === 1 ? "respuesta" : "respuestas"}`}</span>
          <span className="acr-ps-paginas">
            <button type="button" className="acr-av-boton" disabled={vista.actual <= 1} onClick={() => setNumero(vista.actual - 1)}>Anterior</button>
            <span className="acr-av-num">{`Página ${fmt(vista.actual)} de ${fmt(vista.paginas)}`}</span>
            <button type="button" className="acr-av-boton" disabled={vista.actual >= vista.paginas} onClick={() => setNumero(vista.actual + 1)}>Siguiente</button>
          </span>
        </footer>
      </section>
    </div>
  );
}
