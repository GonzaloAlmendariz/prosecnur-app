import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Alert } from "../../../../../../components/Alert";
import type { MonitoreoInternalQueries } from "../../../../../../api/client";
import { useFocoMonitoreo } from "../../../../useMonitoreoDireccion";
import { fmt } from "../../formato";
import { fechaCorta } from "../../avance/graficosDeAvance";
import {
  conRespuestaPor,
  csvDePersonas,
  estadoPorPublico,
  filtrarPersonas,
  ORDEN_DE_ESTADOS,
  pagina,
  personasDe,
  ROTULO_DE_ESTADO,
  type EstadoDePersona,
} from "./personasModelo";
import { descargarCsv } from "./descargarCsv";
import "../../avance/avance.css";
import "./cruce.css";
import "./personas.css";

/** Estados que van como columna en «Estado por público»; los demás aparecen si hay. */
const COLUMNAS_FIJAS: readonly EstadoDePersona[] = ["efectiva", "sin-respuesta", "parcial", "rechazo"];

function Barras({ titulo, filas }: { titulo: string; filas: Array<{ rotulo: string; casos: number }> }) {
  const maximo = Math.max(1, ...filas.map((fila) => fila.casos));
  return (
    <section className="acr-cr-lista" aria-label={titulo}>
      <span className="acr-av-antetitulo">{titulo}</span>
      {filas.length ? (
        <ul>
          {filas.map((fila) => (
            <li key={fila.rotulo}>
              <span>{fila.rotulo}</span>
              <span className="acr-av-pista"><i style={{ width: `${(fila.casos / maximo) * 100}%` }} /></span>
              <b className="acr-av-num">{fmt(fila.casos)}</b>
            </li>
          ))}
        </ul>
      ) : <Alert kind="info">Nadie de este público respondió todavía.</Alert>}
    </section>
  );
}

/**
 * Control › Personas (ficha Ctl8): en qué está cada persona del padrón. A la
 * izquierda el estado por público, que filtra la tabla (`foco=<público>`), y
 * el canal y el cruce de quienes respondieron; a la derecha la tabla
 * paginada con buscador, estados y exportación.
 */
export function Personas({ consultas }: { consultas: MonitoreoInternalQueries }) {
  const casos = consultas.case_rollup?.length ? consultas.case_rollup : consultas.cases;
  const personas = useMemo(() => personasDe(casos), [casos]);
  const filas = useMemo(() => estadoPorPublico(personas), [personas]);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const publico = foco && filas.some((fila) => fila.publico === foco) ? foco : null;
  const [estado, setEstado] = useState<EstadoDePersona | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [numero, setNumero] = useState(1);
  const delPublico = useMemo(() => (publico ? personas.filter((persona) => persona.publico === publico) : personas), [personas, publico]);
  const filtradas = useMemo(() => filtrarPersonas(personas, { publico, estado, busqueda }), [personas, publico, estado, busqueda]);
  const vista = pagina(filtradas, numero);
  const columnas = ORDEN_DE_ESTADOS.filter((clave) => COLUMNAS_FIJAS.includes(clave) || filas[0]?.porEstado[clave]);
  const elegir = (valor: string | null) => {
    escribirFoco(valor);
    setNumero(1);
  };

  if (!personas.length) {
    return (
      <div className="acr-cr is-vacio" data-vacio>
        <Alert kind="info">El corte todavía no trae el cruce del padrón persona por persona.</Alert>
      </div>
    );
  }

  return (
    <div className="acr-ps" data-qa-geometry-group="acreditacion-control-personas" data-qa-geometry-contract="intrinsic">
      <div className="acr-ps-izquierda">
        <section className="acr-av-panel" aria-label="Estado por público">
          <header className="acr-av-panel-cabecera"><h3>Estado por público</h3></header>
          <table className="acr-pub-tabla acr-ps-estados">
            <thead>
              <tr>
                <th scope="col">Público</th>
                {columnas.map((clave) => <th key={clave} scope="col" className="is-num">{ROTULO_DE_ESTADO[clave]}</th>)}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => {
                const activa = fila.publico === publico;
                return (
                  <tr key={fila.publico ?? "todos"} className={activa ? "is-activa" : undefined}>
                    <th scope="row">
                      <button type="button" className="acr-pub-nombre" aria-pressed={activa} onClick={() => elegir(fila.publico)}>
                        {fila.publico ?? "Todos los públicos"}
                      </button>
                      <span className="acr-av-apilada acr-ps-barra" role="img" aria-label={columnas.map((clave) => `${ROTULO_DE_ESTADO[clave]}: ${fmt(fila.porEstado[clave])}`).join("; ")}>
                        {ORDEN_DE_ESTADOS.map((clave) => (fila.porEstado[clave] ? <span key={clave} className={`is-${clave}`} style={{ flexGrow: fila.porEstado[clave] }} /> : null))}
                      </span>
                    </th>
                    {columnas.map((clave) => <td key={clave} className="is-num">{fmt(fila.porEstado[clave])}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <section className="acr-av-panel acr-ps-respondieron" aria-label="Quienes respondieron">
          <header className="acr-av-panel-cabecera">
            <h3>Quienes respondieron <span className="acr-av-tenue">{publico ?? "Todos los públicos"}</span></h3>
          </header>
          <div className="acr-cr-listas">
            <Barras titulo="Por canal" filas={conRespuestaPor(delPublico, "canal")} />
            <Barras titulo="Cómo cruzó" filas={conRespuestaPor(delPublico, "comoCruzo")} />
          </div>
        </section>
      </div>

      <section className="acr-av-panel acr-ps-tabla" aria-label="Personas del padrón">
        <header className="acr-av-panel-cabecera acr-ps-filtros">
          <label className="acr-pr-buscador">
            <Search size={14} aria-hidden="true" />
            <input type="search" value={busqueda} onChange={(event) => { setBusqueda(event.target.value); setNumero(1); }} placeholder="Llave, canal o cruce" aria-label="Buscar personas" />
          </label>
          <div className="acr-ps-chips" role="group" aria-label="Estado">
            <button type="button" className={`acr-av-chip${estado == null ? " is-activo" : ""}`} aria-pressed={estado == null} onClick={() => { setEstado(null); setNumero(1); }}>Todos</button>
            {columnas.map((clave) => (
              <button key={clave} type="button" className={`acr-av-chip${estado === clave ? " is-activo" : ""}`} aria-pressed={estado === clave} onClick={() => { setEstado(clave); setNumero(1); }}>
                {ROTULO_DE_ESTADO[clave]}
              </button>
            ))}
          </div>
          <button type="button" className="acr-av-boton" onClick={() => descargarCsv(csvDePersonas(filtradas), "personas-del-padron.csv")} disabled={!filtradas.length}>
            <Download size={14} aria-hidden="true" /> Exportar CSV
          </button>
        </header>
        <div className="acr-pr-cola-marco" data-qa-geometry-capacity="owned">
          {vista.filas.length ? (
            <table className="acr-pub-tabla">
              <thead>
                <tr>
                  <th scope="col">Llave</th>
                  <th scope="col">Público</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Canal</th>
                  <th scope="col">Cómo cruzó</th>
                  <th scope="col" className="is-num">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {vista.filas.map((persona) => (
                  <tr key={persona.clave}>
                    <th scope="row" className="acr-av-num">{persona.llave}</th>
                    <td>{persona.publico}</td>
                    <td><span className="acr-ps-estado"><i className={`acr-av-punto is-${persona.estado}`} aria-hidden="true" />{ROTULO_DE_ESTADO[persona.estado]}</span></td>
                    <td>{persona.canal || "—"}</td>
                    <td>{persona.comoCruzo || "—"}</td>
                    <td className="is-num">{persona.fecha ? fechaCorta(persona.fecha) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="acr-pr-cola-vacia" data-vacio><Alert kind="info">Nadie coincide con estos filtros.</Alert></div>}
        </div>
        <footer className="acr-ps-pie">
          <span className="acr-av-tenue">{`${fmt(filtradas.length)} ${filtradas.length === 1 ? "persona" : "personas"}`}</span>
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
