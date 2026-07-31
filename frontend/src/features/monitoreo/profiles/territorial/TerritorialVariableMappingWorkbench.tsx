import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Save, Table2 } from "lucide-react";
import {
  apiMonitoreoTerritorialConfig,
  apiMonitoreoTerritorialMapeo,
  type MonitoreoTerritorialColumna,
  type MonitoreoTerritorialMapeo,
} from "../../../../api/monitoreo";
import type { MonitoreoTerritorialConfig } from "../../../../api/client";
import "./mapeoDeVariables.css";

/**
 * Mapeo manual de las variables de interés territoriales.
 *
 * Decisión 7 del goal visual. La app necesita siempre las mismas variables,
 * pero el instrumento puede escribirlas distinto o ponerlas en otro orden, y
 * hasta ahora dependía de una autodetección que **falla en silencio**: cae a un
 * nombre de columna que la base no tiene y todas las filas salen «S/D», o peor,
 * casa por subcadena con una columna real que no es la variable buscada.
 *
 * Por eso esta pestaña va primera en Modelo: es lo que hay que resolver antes
 * de creerle una cifra al resto del módulo.
 */

export type TerritorialVariableMappingWorkbenchProps = {
  onError?: (message: string) => void;
  /** Se llama tras guardar: el resto del perfil lee del estado, no de aquí. */
  onReload?: () => void;
};

const SIN_ASIGNAR = "";

function pctCobertura(valor: number | null | undefined) {
  if (valor == null || !Number.isFinite(valor)) return "";
  return `${Math.round(valor * 100)} %`;
}

function columnaPorNombre(columnas: MonitoreoTerritorialColumna[], nombre: string) {
  if (!nombre) return null;
  return columnas.find((columna) => columna.nombre === nombre) ?? null;
}

export function TerritorialVariableMappingWorkbench({
  onError,
  onReload,
}: TerritorialVariableMappingWorkbenchProps) {
  const [mapeo, setMapeo] = useState<MonitoreoTerritorialMapeo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [edicion, setEdicion] = useState<Record<string, string>>({});

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const payload = await apiMonitoreoTerritorialMapeo();
      setMapeo(payload);
      setEdicion({});
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "No se pudo leer el mapeo de variables.");
    } finally {
      setCargando(false);
    }
  }, [onError]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const columnas = mapeo?.columnas ?? [];
  const variables = mapeo?.variables ?? [];

  const valorDe = useCallback(
    (campo: string, apuntaA: string) => (campo in edicion ? edicion[campo] : apuntaA),
    [edicion],
  );

  const pendientesDeGuardar = useMemo(
    () => variables.filter((variable) => campoCambiado(variable.campo, variable.apunta_a, edicion)).length,
    [edicion, variables],
  );

  const guardar = useCallback(async () => {
    const patch: Record<string, string> = {};
    for (const variable of variables) {
      if (campoCambiado(variable.campo, variable.apunta_a, edicion)) patch[variable.campo] = edicion[variable.campo];
    }
    if (!Object.keys(patch).length) return;
    setGuardando(true);
    try {
      await apiMonitoreoTerritorialConfig(patch as Partial<MonitoreoTerritorialConfig>);
      await cargar();
      onReload?.();
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "No se pudo guardar el mapeo.");
    } finally {
      setGuardando(false);
    }
  }, [cargar, edicion, onError, onReload, variables]);

  const aviso = mapeo?.aviso ?? null;
  const sinBase = !cargando && !columnas.length;

  // El aviso del backend responde «¿existe la columna?». Una que existe y
  // viene vacía en todas las filas pasa ese filtro y no sirve igual, así que
  // la resumimos aquí en vez de ensanchar el contrato de la API.
  const vacias = useMemo(
    () =>
      variables.filter((variable) => {
        const columna = columnaPorNombre(columnas, valorDe(variable.campo, variable.apunta_a));
        return columna != null && columna.no_vacios === 0;
      }).length,
    [columnas, valorDe, variables],
  );

  return (
    <div className="mon-stage mon-stage--modelo">
      <div className="mon-territorial-panel mapeo-var">
        <section className="mapeo-var__command" aria-label="Mapeo de variables de interés">
          <div className="mapeo-var__title">
            {/* Sin título propio: el chrome del módulo ya rotula la pestaña
                «Variables», y repetirlo aquí gasta la línea que sí explica. */}
            <p>
              A qué columna de la base responde cada variable que el módulo necesita. El instrumento
              puede escribirlas distinto; aquí se asignan a mano.
            </p>
          </div>
          <div className="mapeo-var__actions">
            <button type="button" className="pulso-button" onClick={() => { void cargar(); }} disabled={cargando || guardando}>
              {cargando ? <Loader2 size={15} className="pulso-spin" /> : <RefreshCw size={15} />}
              Releer la base
            </button>
            <button
              type="button"
              className="pulso-button is-primary"
              onClick={() => { void guardar(); }}
              disabled={guardando || cargando || !pendientesDeGuardar}
            >
              {guardando ? <Loader2 size={15} className="pulso-spin" /> : <Save size={15} />}
              {pendientesDeGuardar ? `Guardar ${pendientesDeGuardar}` : "Guardar"}
            </button>
          </div>
        </section>

        {aviso && !sinBase ? (
          <p className={`mapeo-var__aviso ${aviso.ok && !vacias ? "is-ready" : "is-warning"}`} role="status">
            {aviso.ok && !vacias ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {aviso.ok
              ? "Las doce variables apuntan a columnas que la base tiene."
              : aviso.mensaje}
            {vacias
              ? ` ${vacias} más apunta${vacias === 1 ? "" : "n"} a una columna vacía en todas las filas.`
              : ""}
          </p>
        ) : null}

        <div className="mapeo-var__list" aria-label="Variables y su columna">
          {/* Tres estados, y el de carga NO es «nada»: una captura a 1024x600
              pilló la pista en blanco mientras el fetch volvía. El marco tiene
              que medir lo mismo antes y después de que lleguen los datos. */}
          {cargando && !variables.length ? (
            <div className="mapeo-var__grid" aria-hidden="true">
              {Array.from({ length: 12 }, (_, indice) => (
                <article key={indice} className="mapeo-var__item is-loading" />
              ))}
            </div>
          ) : sinBase ? (
            <div className="mapeo-var__empty">
              <span className="mapeo-var__empty-icon"><Table2 size={18} /></span>
              <strong>Todavía no hay base que mapear</strong>
              <p>Sincroniza el formulario en Fuente para que aparezcan sus columnas aquí.</p>
            </div>
          ) : (
            <div
              className="mapeo-var__grid"
              data-qa-geometry-group="territorial-mapeo-variables"
              data-qa-geometry-contract="equal"
            >
              {variables.map((variable) => {
                const valor = valorDe(variable.campo, variable.apunta_a);
                const columna = columnaPorNombre(columnas, valor);
                const cambiada = campoCambiado(variable.campo, variable.apunta_a, edicion);
                // El estado que se pinta es el del valor EN PANTALLA, no el
                // guardado: si acabas de elegir una columna real, la fila deja
                // de acusar pendiente aunque el patch no haya salido todavía.
                // Una columna que existe pero viene vacía en todas las filas
                // mapea sin error y no sirve para nada: cuenta como pendiente.
                const vacia = Boolean(columna) && columna!.no_vacios === 0;
                const resuelta = valor ? Boolean(columna) && !vacia : false;
                return (
                  <article
                    key={variable.campo}
                    className={`mapeo-var__item ${resuelta ? "is-ready" : "is-warning"} ${cambiada ? "is-dirty" : ""}`}
                  >
                    <header>
                      <strong>{variable.etiqueta}</strong>
                      <code>{variable.campo}</code>
                    </header>
                    <label className="mapeo-var__field">
                      <span className="mapeo-var__field-label">Columna de la base</span>
                      <select
                        value={columna || !valor ? valor : SIN_ASIGNAR}
                        onChange={(event) => setEdicion((previo) => ({ ...previo, [variable.campo]: event.target.value }))}
                      >
                        <option value={SIN_ASIGNAR}>Sin asignar</option>
                        {/* Un valor guardado que la base no tiene se ofrece igual
                            en la lista: quitarlo del select lo borraría sin que
                            nadie lo decidiera. */}
                        {valor && !columna ? <option value={valor}>{valor} (no está en la base)</option> : null}
                        {columnas.map((disponible) => (
                          <option key={disponible.nombre} value={disponible.nombre}>
                            {disponible.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="mapeo-var__hint">
                      {vacia
                        ? "La columna existe pero viene vacía en todas las filas."
                        : columna
                        ? `${pctCobertura(columna.cobertura)} con dato${columna.ejemplo ? ` · p. ej. ${columna.ejemplo}` : ""}`
                        : valor
                          ? "Apunta a una columna que la base no tiene: saldrá S/D en todas las filas."
                          : "Sin columna asignada."}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function campoCambiado(campo: string, apuntaA: string, edicion: Record<string, string>) {
  return campo in edicion && edicion[campo] !== apuntaA;
}

export default TerritorialVariableMappingWorkbench;
