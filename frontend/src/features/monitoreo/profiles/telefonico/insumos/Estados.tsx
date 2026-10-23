import { useMemo } from "react";
import { AlertTriangle, Loader2, Save } from "../../../../../vendor/lucide-react";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { ACREDITACION_ORDEN_FAMILIAS, acreditacionEtiquetaDeFamilia } from "../../../estados/familiasDeLlamada";
import type { AcreditacionFamiliaLlamada } from "../../../estados/familiasDeLlamada";
import { useDeclaracionDeEstados } from "../../../estados/useDeclaracionDeEstados";
import { FAMILIAS_DEL_CLIENTE } from "../control/familiasDelCliente";
import { casosDeCola } from "../control/insistenciaModel";
import { filasDeBloque } from "../navegacion/bloques";
import { entradasDeEstatus, filasDeEstados, intentosDeLaCola, sinReglaDelMotor } from "./estadosModel";
import "../control/controlTelefonico.css";
import "./insumosTelefonico.css";

const ETIQUETA_DEL_MOTOR = Object.fromEntries(FAMILIAS_DEL_CLIENTE.map((familia) => [familia.id, familia.etiqueta]));

function n(valor: number) {
  return valor.toLocaleString("es-PE");
}

/** `status_from_rules` vive en el perfil pero no en su tipo del frontend. */
function reglasEncendidas(state: MonitoreoState | null | undefined) {
  const perfil = state?.config?.monitoreo_profile as unknown as Record<string, unknown> | undefined;
  return perfil?.status_from_rules === true;
}

/**
 * Insumos › Estados: el vocabulario de status de la hoja del equipo. Se edita
 * lo mismo que hoy —la familia y el color que guarda el definidor— y al lado,
 * en lectura, la familia con la que el motor cuenta cada status (P18: son dos
 * vocabularios y no se reconcilian aquí). A la derecha, si el proyecto cuenta
 * con sus reglas, los intentos que registra la hoja para la cola y la nota de
 * que el modo no declara casos agotados.
 */
export function Estados({
  reports,
  state,
  onStateChange,
  onIrA,
}: {
  reports: MonitoreoAcreditacionReports;
  state: MonitoreoState | null | undefined;
  onStateChange?: (state: MonitoreoState) => void;
  onIrA: (seccion: string, pestana: string) => void;
}) {
  const entradas = useMemo(() => entradasDeEstatus(reports), [reports]);
  const declaracion = useDeclaracionDeEstados({ entradas, config: state?.config, onStateChange });
  const reglas = state?.config?.operational_model?.state_rules;
  const filas = useMemo(() => filasDeEstados(declaracion.detectados, reglas ?? []), [declaracion.detectados, reglas]);
  const sinRegla = sinReglaDelMotor(filas);
  const intentos = useMemo(() => intentosDeLaCola(casosDeCola(filasDeBloque(reports, ["cola_insistencia"]))), [reports]);
  const enCola = intentos.reduce((suma, tramo) => suma + tramo.casos, 0);
  const maximo = Math.max(1, ...filas.map((fila) => fila.value));
  const maximoIntentos = Math.max(1, ...intentos.map((tramo) => tramo.casos));
  const encendidas = reglasEncendidas(state);

  if (!entradas.length) {
    return (
      <section className="mon-ctl-panel mon-insumos-vacio" aria-label="Estados">
        <span className="mon-ctl-antetitulo">Estados</span>
        <strong>Sin status que leer</strong>
        <p>Conecta la hoja de barrido en Insumos, Fuentes, o actualiza el corte.</p>
        <button type="button" className="mon-insumos-boton" onClick={() => onIrA("insumos", "fuentes")}>Ir a Fuentes</button>
      </section>
    );
  }

  return (
    <div className="mon-insumos mon-estados" data-qa-geometry-group="telefonico-insumos-estados" data-qa-geometry-contract="intrinsic">
      <section className="mon-ctl-panel mon-estados-vocabulario" aria-label="Vocabulario de Status">
        <header className="mon-insumos-cabecera">
          <strong>Vocabulario de Status</strong>
          <span>
            {declaracion.sinConfirmar
              ? `${n(declaracion.sinConfirmar)} de ${n(filas.length)} sin confirmar`
              : `${n(filas.length)} confirmados`}
          </span>
          <button
            type="button"
            className="mon-insumos-boton is-primario"
            disabled={!declaracion.sucio || declaracion.guardando || !declaracion.puedeGuardar}
            onClick={() => { void declaracion.guardar(); }}
          >
            {declaracion.guardando ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
            <span>{declaracion.guardando ? "Guardando…" : "Confirmar estados"}</span>
          </button>
        </header>
        {declaracion.error ? <p className="mon-insumos-error"><AlertTriangle size={14} /> {declaracion.error}</p> : null}
        <div className="mon-ctl-tabla-marco mon-estados-marco">
          <table className="mon-ctl-tabla mon-estados-tabla">
            <thead>
              <tr>
                <th scope="col">Valor del cliente</th>
                <th scope="col" className="is-num">Casos</th>
                <th scope="col">Familia en los gráficos</th>
                <th scope="col">Cómo lo cuenta el motor</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => {
                const familia = declaracion.familiaDe(fila.crudo, fila.familia);
                return (
                  <tr key={fila.crudo} className={fila.conRegla || fila.motor === "sin-llamar" ? undefined : "is-sin-regla"}>
                    <th scope="row">
                      {/* Tal cual lo escribió el cliente, erratas incluidas: es la llave del cruce. */}
                      <b>{fila.crudo}</b>
                      <small>{fila.confirmado ? "Confirmado" : "Detectado"}</small>
                    </th>
                    <td className="is-num">
                      <div className="mon-estados-casos">
                        <i aria-hidden="true"><i style={{ width: `${Math.max(2, (fila.value / maximo) * 100)}%` }} /></i>
                        <span>{n(fila.value)}</span>
                      </div>
                    </td>
                    <td>
                      <select
                        className="mon-estados-familia"
                        value={familia}
                        onChange={(event) => {
                          // El valor se lee antes de actualizar el borrador.
                          const elegida = event.currentTarget.value as AcreditacionFamiliaLlamada;
                          declaracion.asignar(fila.crudo, elegida);
                        }}
                        aria-label={`Familia de ${fila.crudo}`}
                        style={{ borderLeftColor: declaracion.colorDe(familia) }}
                      >
                        {ACREDITACION_ORDEN_FAMILIAS.map((opcion) => (
                          <option key={opcion} value={opcion}>{acreditacionEtiquetaDeFamilia(opcion)}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {fila.conRegla || fila.motor === "sin-llamar" ? (
                        <span className={`mon-estados-motor${fila.difiere ? " is-difiere" : ""}`} title={fila.difiere ? "La familia en los gráficos no corresponde a la regla del proyecto." : undefined}>
                          {ETIQUETA_DEL_MOTOR[fila.motor]}
                          {fila.difiere ? <em>difiere</em> : null}
                        </span>
                      ) : (
                        <span className="mon-ctl-sin-regla">sin regla</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mon-insumos-lateral" data-qa-geometry-group="telefonico-insumos-estados-lateral" data-qa-geometry-contract="intrinsic">
        <section className="mon-ctl-panel mon-insumos-tarjeta" aria-label="Status por reglas">
          <span className="mon-ctl-antetitulo">Status por reglas</span>
          <div className="mon-insumos-fila">
            <strong>Contar con el vocabulario del proyecto</strong>
            <span className={`mon-insumos-estado${encendidas ? " is-encendido" : ""}`}>{encendidas ? "Encendido" : "Apagado"}</span>
          </div>
          <p>{encendidas ? "El motor cuenta cada status con su regla." : "Las cifras usan el vocabulario fijo del motor; se enciende por proyecto."}</p>
          {sinRegla.valores ? (
            <div className="mon-insumos-aviso">
              <strong>{n(sinRegla.valores)} {sinRegla.valores === 1 ? "valor" : "valores"} sin regla, {n(sinRegla.casos)} {sinRegla.casos === 1 ? "caso" : "casos"}</strong>
              <p>{sinRegla.nombres.join(", ")}.</p>
            </div>
          ) : null}
        </section>

        <section className="mon-ctl-panel mon-insumos-tarjeta" aria-label="Intentos que registra la hoja">
          <span className="mon-ctl-antetitulo">Intentos que registra la hoja</span>
          {enCola ? (
            <>
              <p>{n(enCola)} casos en la cola de insistencia, según su columna Intentos, que es el total acumulado.</p>
              <ul className="mon-insumos-barras">
                {intentos.map((tramo) => (
                  <li key={tramo.etiqueta}>
                    <span>{tramo.etiqueta}</span>
                    <i aria-hidden="true"><i style={{ width: `${tramo.casos ? Math.max(2, (tramo.casos / maximoIntentos) * 100) : 0}%` }} /></i>
                    <strong className="is-num">{n(tramo.casos)}</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>El corte no trae la cola de insistencia; actualiza para leer los intentos.</p>
          )}
        </section>

        <section className="mon-ctl-panel mon-insumos-tarjeta" aria-label="Color de cada familia">
          <span className="mon-ctl-antetitulo">Color de cada familia</span>
          <div className="mon-estados-colores">
            {ACREDITACION_ORDEN_FAMILIAS.map((familia) => (
              <label key={familia}>
                <input
                  type="color"
                  value={declaracion.colorDe(familia)}
                  onChange={(event) => {
                    const elegido = event.currentTarget.value;
                    declaracion.colorear(familia, elegido);
                  }}
                  aria-label={`Color de ${acreditacionEtiquetaDeFamilia(familia)}`}
                />
                <span>{acreditacionEtiquetaDeFamilia(familia)}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="mon-insumos-nota" aria-label="Sin regla de agotado">
          <strong>Sin regla de agotado</strong>
          <p>El supervisor decide cuándo dejar de insistir mirando intentos, status y observación. El modo no declara casos agotados.</p>
        </section>
      </div>
    </div>
  );
}
