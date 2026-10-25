import { useMemo } from "react";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { Alert } from "../../../../../components/Alert";
import { Switch } from "../../../../../components/Switch";
import type { MonitoreoActorUnit, MonitoreoSource, MonitoreoState } from "../../../../../api/client";
import type { MonitoreoCuotaPublico } from "../../../../../api/monitoreoCuotas";
import { usePanelDireccionable, type PanelDeclarado } from "../../../../../lib/navegacion/paneles";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { claveDeActor } from "../../../fuentes/rosterDeActores";
import { fmt } from "../formato";
import { corteCorto } from "../../../core/barraComun";
import { useElencoDeActores } from "../fuentes/useElencoDeActores";
import { canalesDeLaMatriz, celda, padronesPorPublico, servicioDe, type PadronDelPublico } from "./publicosModelo";
import { useEstadoDeCuotas } from "./useEstadoDeCuotas";
import "../avance/avance.css";
import "../control/casos/personas.css";
import "./insumos.css";
import { CabeceraDeTarjeta } from "../navegacion/rotuloDePestana";
import { MarcaDeLectura } from "../navegacion/MarcaDeLectura";

/** El padrón de un público es un panel direccionable: `panel=publico&foco=<público>`. */
export const PANEL_PADRON: PanelDeclarado = { id: "publico", label: "Padrón del público", clase: "inspector" };

function nombreDeFuente(fuente: MonitoreoSource) {
  return fuente.label || fuente.survey_title || fuente.id;
}

function PanelDelPadron({
  fila,
  llave,
  elegido,
  onCerrar,
}: {
  fila: PadronDelPublico;
  llave: readonly string[];
  elegido: boolean;
  onCerrar: () => void;
}) {
  return (
    <aside className="acr-av-panel acr-in-panel" aria-label={`Padrón de ${fila.publico}`} data-pulso-panel={elegido ? PANEL_PADRON.id : undefined}>
      <header className="acr-av-panel-cabecera">
        <h3><span className="acr-av-antetitulo">Padrón</span> {fila.publico}</h3>
        {elegido ? (
          <button type="button" className="acr-av-icono" onClick={onCerrar} aria-label="Cerrar el padrón">
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </header>
      <div className="acr-pub-panel-cuerpo">
        <section className="acr-pub-bloque" aria-label="Fuente del padrón">
          <span className="acr-av-antetitulo">Fuente del padrón</span>
          {fila.padrones.length ? fila.padrones.map((fuente) => (
            <dl key={fuente.id} className="acr-pr-datos">
              <div className="acr-pr-dato"><dt>Fuente</dt><dd>{nombreDeFuente(fuente)}</dd></div>
              <div className="acr-pr-dato"><dt>Servicio</dt><dd>{servicioDe(fuente)}</dd></div>
              <div className="acr-pr-dato"><dt>Personas</dt><dd className="acr-av-num">{fila.personas == null ? "—" : fmt(fila.personas)}</dd></div>
              <div className="acr-pr-dato"><dt>Última lectura</dt><dd>{fuente.last_sync_at ? corteCorto(fuente.last_sync_at) : "Sin leer"}</dd></div>
            </dl>
          )) : <Alert kind="warn">Este público no tiene padrón: sin él no hay contra qué medir su avance.</Alert>}
        </section>
        <section className="acr-pub-bloque" aria-label="Llave de cruce">
          <span className="acr-av-antetitulo">Llave de cruce</span>
          {llave.length ? (
            <ol className="acr-in-llave">
              {llave.map((columna, indice) => (
                <li key={columna}><span className="acr-av-tenue acr-av-num">{fmt(indice + 1)}</span><span className="acr-in-columna">{columna}</span></li>
              ))}
            </ol>
          ) : <Alert kind="info">El proyecto no declara columnas de llave; el motor las detecta.</Alert>}
        </section>
        <section className="acr-pub-bloque" aria-label="Variables para cuotas">
          <span className="acr-av-antetitulo">Variables para cuotas</span>
          {fila.variables.length ? (
            <ul className="acr-in-variables">
              {fila.variables.map((item) => (
                <li key={item.variable}>
                  <span>{item.variable}</span>
                  <span className="acr-av-tenue acr-av-num">{item.categorias == null ? "—" : `${fmt(item.categorias)} ${item.categorias === 1 ? "categoría" : "categorías"}`}</span>
                </li>
              ))}
            </ul>
          ) : <Alert kind="info">El padrón no trae variables con 2 a 150 categorías.</Alert>}
        </section>
        <section className="acr-pub-bloque" aria-label="Encuestas del público">
          <span className="acr-av-antetitulo">Encuestas y barrido</span>
          {[...fila.encuestas, ...fila.barridos].length ? (
            <ul className="acr-in-variables">
              {[...fila.encuestas, ...fila.barridos].map((fuente) => (
                <li key={fuente.id}>
                  <span>{nombreDeFuente(fuente)}</span>
                  <span className="acr-av-tenue">{servicioDe(fuente)}</span>
                </li>
              ))}
            </ul>
          ) : <Alert kind="info">Sin encuestas conectadas. Se conectan en Insumos › Fuentes.</Alert>}
        </section>
      </div>
    </aside>
  );
}

/**
 * Insumos › Públicos (ficha I1): quiénes responden y contra qué padrón. La
 * tabla edita el elenco con los mismos llamados de siempre (renombrar
 * arrastra las fuentes del público; luego se guarda el elenco), la matriz dice
 * por dónde entra cada público y el panel muestra su padrón.
 */
export function Publicos({
  sources,
  unidades,
  llave,
  onStateChange,
  cuotasDePrueba,
}: {
  sources: MonitoreoSource[];
  unidades?: MonitoreoActorUnit[];
  llave: readonly string[];
  onStateChange?: (state: MonitoreoState) => void;
  /** Solo para pruebas de render: evita la lectura del estado de cuotas. */
  cuotasDePrueba?: MonitoreoCuotaPublico[];
}) {
  const elenco = useElencoDeActores({ sources, unidades, onStateChange });
  const { estado, error: errorDeCuotas } = useEstadoDeCuotas();
  // Personas y variables vienen del estado de cuotas: hasta que llega no se
  // publica «0 personas», que no son del estudio (C5).
  const leyendoCuotas = !cuotasDePrueba && !estado && !errorDeCuotas;
  const cuotas = cuotasDePrueba ?? estado?.publicos ?? [];
  const panel = usePanelDireccionable(PANEL_PADRON);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const filas = useMemo(
    () => padronesPorPublico(elenco.borradores.map((fila) => fila.guardadoComo || fila.actor), sources, cuotas),
    [elenco.borradores, sources, cuotas],
  );
  const canales = canalesDeLaMatriz(filas);
  const elegida = panel.abierto && foco ? filas.find((fila) => claveDeActor(fila.publico) === claveDeActor(foco)) ?? null : null;
  const enPanel = elegida ?? filas[0] ?? null;
  const personas = filas.reduce((suma, fila) => suma + (fila.personas ?? 0), 0);
  const padrones = filas.filter((fila) => fila.padrones.length).length;

  return (
    <div className="acr-ps is-publicos" data-qa-geometry-group="acreditacion-insumos-publicos" data-qa-geometry-contract="intrinsic">
      <MarcaDeLectura leyendo={leyendoCuotas || Boolean(!cuotasDePrueba && estado?.preparando)} />
      <div className="acr-in-izquierda">
        <section className="acr-av-panel acr-ps-tabla" aria-label="Públicos del estudio">
          <CabeceraDeTarjeta primera>
            <h3>
              {`${fmt(filas.length)} ${filas.length === 1 ? "público" : "públicos"}`}
              <span className="acr-av-tenue">{leyendoCuotas ? "Leyendo las personas de cada padrón" : `${fmt(personas)} personas en ${fmt(padrones)} ${padrones === 1 ? "padrón" : "padrones"}`}</span>
            </h3>
            <span className="acr-in-acciones">
              <button type="button" className="acr-av-boton" onClick={() => elenco.agregar()} disabled={elenco.guardando}>
                <Plus size={14} aria-hidden="true" /> Agregar público
              </button>
              <button type="button" className="acr-av-boton is-primario" onClick={() => { void elenco.guardar(); }} disabled={!elenco.puedeGuardar}>
                {elenco.guardando ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Guardar
              </button>
            </span>
          </CabeceraDeTarjeta>
          {elenco.error ? <div className="acr-ct-cuerpo"><Alert kind="error">{elenco.error}</Alert></div> : null}
          <div className="acr-pr-cola-marco" data-qa-geometry-capacity="owned">
            <table className="acr-pub-tabla">
              <thead>
                <tr>
                  <th scope="col">Público</th>
                  <th scope="col">Padrón</th>
                  <th scope="col" className="is-num">Personas</th>
                  <th scope="col">Encuestas y canal</th>
                  <th scope="col">Teléfono</th>
                  <th scope="col" className="is-num">Variables</th>
                  <th scope="col"><span className="acr-in-oculto">Quitar</span></th>
                </tr>
              </thead>
              <tbody>
                {elenco.borradores.map((borrador, indice) => {
                  const fila = filas[indice];
                  const repetido = elenco.duplicados.has(borrador.key);
                  const renombrado = Boolean(borrador.guardadoComo) && claveDeActor(borrador.actor) !== claveDeActor(borrador.guardadoComo);
                  const fuentes = fila ? fila.padrones.length + fila.encuestas.length + fila.barridos.length : 0;
                  const activa = enPanel != null && fila === enPanel;
                  return (
                    <tr key={borrador.key} className={activa ? "is-activa" : undefined}>
                      <th scope="row">
                        <input
                          className="acr-in-nombre"
                          value={borrador.actor}
                          onChange={(event) => elenco.editar(borrador.key, { actor: event.currentTarget.value })}
                          onFocus={() => fila && escribirFoco(fila.publico, { panel: PANEL_PADRON.id })}
                          aria-label={`Nombre del público ${indice + 1}`}
                          aria-invalid={repetido}
                          disabled={elenco.guardando}
                        />
                        {repetido ? <Alert kind="warn">Ya hay otro público con este nombre.</Alert> : null}
                        {renombrado ? <Alert kind="info">{`Al guardar, «${borrador.guardadoComo}» pasa a llamarse así en ${fuentes === 1 ? "su única fuente" : `sus ${fmt(fuentes)} fuentes`}.`}</Alert> : null}
                      </th>
                      <td>{fila?.padrones.length ? fila.padrones.map(nombreDeFuente).join(", ") : <span className="acr-av-chip is-falta">Sin padrón</span>}</td>
                      <td className="is-num">{fila?.personas == null ? "—" : fmt(fila.personas)}</td>
                      <td>
                        <span className="acr-in-canales">
                          <b className="acr-av-num">{fmt(fila?.encuestas.length ?? 0)}</b>
                          {(fila?.canales ?? []).map((canal) => <span key={canal} className="acr-av-chip">{canal}</span>)}
                          {fila?.barridos.length ? <span className="acr-av-chip is-avance">Barrido</span> : null}
                        </span>
                      </td>
                      <td>
                        <Switch
                          checked={borrador.phone}
                          onToggle={() => elenco.editar(borrador.key, { phone: !borrador.phone })}
                          ariaLabel={`Canal telefónico de ${borrador.actor || "este público"}`}
                          disabled={elenco.guardando}
                          className="acr-in-switch"
                        />
                      </td>
                      <td className="is-num">{fila ? fmt(fila.variables.length) : "—"}</td>
                      <td>
                        <button
                          type="button"
                          className="acr-av-icono"
                          onClick={() => elenco.quitar(borrador.key)}
                          disabled={elenco.guardando}
                          aria-label={`Quitar ${borrador.actor || "este público"}`}
                          title={fuentes ? "Quitarlo del elenco no borra sus fuentes; vuelve a aparecer mientras las tenga." : "Quitar del elenco"}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!elenco.borradores.length ? <div className="acr-pr-cola-vacia" data-vacio><Alert kind="info">El estudio todavía no declara sus públicos. Agrega el primero.</Alert></div> : null}
          </div>
        </section>
        <section className="acr-av-panel acr-in-matriz-panel" aria-label="Por dónde entra cada público">
          <header className="acr-av-panel-cabecera"><h3>Por dónde entra cada público</h3></header>
          {canales.length ? (
            <div className="acr-in-matriz-marco">
              <table className="acr-in-matriz">
                <thead>
                  <tr>
                    <th scope="col"><span className="acr-in-oculto">Público</span></th>
                    {canales.map((canal) => <th key={canal} scope="col">{canal}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila) => (
                    <tr key={fila.publico}>
                      <th scope="row">{fila.publico}</th>
                      {canales.map((canal) => {
                        const valor = celda(fila, canal);
                        return (
                          <td key={canal}>
                            {valor.fuentes ? (
                              <span className="acr-in-celda" title={valor.servicios.join(", ")}>{`${fmt(valor.fuentes)} ${valor.fuentes === 1 ? "fuente" : "fuentes"}`}</span>
                            ) : <span className="acr-in-celda is-vacia" aria-label="Sin fuente" />}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="acr-ct-cuerpo"><Alert kind="info">Ningún público tiene encuestas conectadas todavía.</Alert></div>}
        </section>
      </div>
      {enPanel ? (
        <PanelDelPadron fila={enPanel} llave={llave} elegido={Boolean(elegida)} onCerrar={() => escribirFoco(null, { panel: null })} />
      ) : null}
    </div>
  );
}
