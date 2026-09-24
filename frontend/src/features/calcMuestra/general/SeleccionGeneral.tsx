import { useEffect, useReducer } from "react";
import { Database, Loader2, Shuffle } from "lucide-react";

import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import {
  apiCalcMuestraGeneralSeleccionar,
  type CalcMuestraGeneralCorrida,
  type CalcMuestraGeneralMarco,
} from "../../../api/calcMuestraGeneral";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../../components/States";
import { ErrorDelMotor } from "./ErrorDelMotor";
import { FichaCorrida } from "./FichaCorrida";
import { TablaUnidades } from "./TablaUnidades";
import {
  MOTIVO_SIN_RESERVAS_PPS,
  SELECCION_INICIAL,
  TEXTO_COBERTURA_CENSAL,
  errorGeneralDesde,
  formatearEntero,
  modalidadDeTecnica,
  motivoSinSorteo,
  nuevaSemilla,
  opcionesMetodo,
  reservasValidas,
  seleccionReducer,
  semillaValida,
  type OpcionMetodo,
} from "./modelo";
import { useMuestraGeneralStore } from "./store";
import { useColumnasDelMarco } from "./useColumnasDelMarco";
import { guardarEstudioPendiente, useIrASeccionGeneral, useMuestraGeneral } from "./useMuestraGeneral";
import "./general.css";

/**
 * Muestra general › Selección (ADR 0090): sortea unidades del marco declarado
 * con semilla reproducible y publica π y peso base por unidad. Es la sección
 * entera: trae su propio panel porque la página no crece.
 */
export function SeleccionGeneral({
  componente,
  enActor = false,
}: {
  componente: CalcMuestraComponente | null;
  /**
   * Montada dentro de Acreditación › Selección, bajo el «Archivo del marco»
   * del actor: la sección (id, rol y scroll) es de quien la monta, y el vacío
   * no lleva a una sección Marco que ese modo no tiene.
   */
  enActor?: boolean;
}) {
  const general = useMuestraGeneral(componente?.id ?? null);
  return <SeleccionGeneralVista componente={componente} enActor={enActor} {...general} />;
}

/** La sección con el estado ya rehidratado (separada para probarla sin efectos). */
export function SeleccionGeneralVista({
  componente,
  cargado,
  error: errorCarga,
  marco,
  corrida,
  enActor = false,
}: {
  componente: CalcMuestraComponente | null;
  enActor?: boolean;
  cargado: boolean;
  error: string | null;
  marco: CalcMuestraGeneralMarco | null;
  corrida: CalcMuestraGeneralCorrida | null;
}) {
  const componenteId = componente?.id ?? null;
  const irASeccion = useIrASeccionGeneral();
  const [estado, dispatch] = useReducer(seleccionReducer, SELECCION_INICIAL);

  // Al reabrir, el formulario muestra el método y la semilla de la corrida
  // vigente: volver a sortear sin tocar nada reproduce el mismo listado.
  useEffect(() => {
    if (corrida) dispatch({ tipo: "precargar", corrida });
  }, [corrida]);

  const opciones = opcionesMetodo(marco);
  const metodoActual = opciones.find((o) => o.id === estado.metodo);
  const metodo = metodoActual?.motivoDeshabilitado ? "mas" : estado.metodo;
  const esPps = metodo === "pps";
  const columnasOrden = useColumnasDelMarco(marco, metodo === "sistematico");
  const semilla = semillaValida(estado.semilla);
  const reservas = reservasValidas(estado.reservas);
  const tecnica = componente?.tecnica ?? "";
  const prevista = modalidadDeTecnica(componente?.tecnica);
  const esCenso = prevista === "censo";
  // El 409 del motor manda; antes de pedirlo, la técnica ya dice si se sortea.
  const motivoBloqueo = estado.bloqueo?.tecnica === tecnica
    ? estado.bloqueo.texto
    : prevista === "sin_sorteo" ? motivoSinSorteo(tecnica) : null;
  const puedeSortear = Boolean(componenteId && marco) && !motivoBloqueo && semilla != null
    && (esPps || esCenso || reservas != null) && !estado.sorteando;

  async function sortear() {
    if (!componenteId || !marco || semilla == null) return;
    dispatch({ tipo: "sorteando" });
    try {
      await guardarEstudioPendiente();
      const nueva = await apiCalcMuestraGeneralSeleccionar({
        componente_id: componenteId,
        metodo,
        semilla,
        orden_por: metodo === "sistematico" && estado.ordenPor ? estado.ordenPor : undefined,
        reservas_por_estrato: esPps || esCenso ? 0 : reservas ?? 0,
      });
      useMuestraGeneralStore.getState().setCorrida(componenteId, nueva);
      dispatch({ tipo: "sorteado", corrida: nueva });
    } catch (e) {
      dispatch({ tipo: "fallo", error: errorGeneralDesde(e), tecnica });
    }
  }

  return (
    <div
      {...(enActor
        ? { className: "cmg-seleccion cmg-seleccion--actor" }
        : { id: "cmv2-section-general-seleccion", className: "cmv2-tab-panel cmg-seleccion", role: "tabpanel", "aria-label": "Selección" })}
      data-audit-ready={cargado ? "true" : "false"}
      data-qa-geometry-group="calc-muestra/general-seleccion"
      data-qa-geometry-contract="intrinsic"
    >
      {!cargado ? (
        <LoadingBlock variant="inline" label="Leyendo el marco y el último sorteo…" />
      ) : errorCarga && !marco ? (
        <ErrorBlock label="No se pudo leer el estado del sorteo" detail={errorCarga} />
      ) : !componente || !marco ? (
        <section className="cmv2-panel" data-qa-geometry-member>
          {enActor ? (
            <EmptyState
              variant="inline"
              icon={<Database size={18} aria-hidden="true" />}
              title="Todavía no hay sorteo"
              hint="Declara arriba el archivo del marco de este actor para sortear."
            />
          ) : (
            <EmptyState
              icon={<Database size={20} aria-hidden="true" />}
              title="Falta declarar el marco"
              hint="El sorteo sale del archivo de unidades. Declara su archivo y sus columnas en Marco."
              cta={(
                <button type="button" className="cmv2-primary" onClick={() => irASeccion("marco")}>
                  Ir a Marco
                </button>
              )}
            />
          )}
        </section>
      ) : (
        <>
          <section className="cmv2-panel cmg-sorteo" aria-labelledby="cmg-sorteo-titulo" data-qa-geometry-member>
            <div className="cmv2-panel-head">
              <div>
                <span className="cmv2-eyebrow">Sorteo</span>
                <strong id="cmg-sorteo-titulo">{esCenso ? "Orden de contacto" : "Método, semilla y reservas"}</strong>
              </div>
            </div>

            {esCenso ? (
              <p className="cmg-nota cmg-censo">{TEXTO_COBERTURA_CENSAL}</p>
            ) : (
            <GlidingRadioGroup<OpcionMetodo, OpcionMetodo["id"]>
              value={metodo}
              options={opciones}
              getOptionValue={(o) => o.id}
              onValueChange={(id) => {
                if (!opciones.find((o) => o.id === id)?.motivoDeshabilitado) dispatch({ tipo: "metodo", metodo: id });
              }}
              getOptionProps={(o) => ({
                className: "cmv2-method cmg-metodo",
                disabled: Boolean(o.motivoDeshabilitado) || estado.sorteando,
                "aria-label": o.label,
                "aria-describedby": `cmg-metodo-${o.id}`,
              })}
              className="cmg-metodos"
              aria-label="Método de selección"
              data-qa-geometry-group="calc-muestra/general-metodos"
              data-qa-geometry-contract="equal"
            >
              {(o) => (
                <>
                  <strong>{o.label}</strong>
                  <small id={`cmg-metodo-${o.id}`}>{o.motivoDeshabilitado ?? o.detalle}</small>
                </>
              )}
            </GlidingRadioGroup>
            )}

            <div
              className="cmg-parametros"
              data-qa-geometry-group="calc-muestra/general-parametros-sorteo"
              data-qa-geometry-contract="equal"
            >
              <div className="cmg-campo" data-qa-geometry-member>
                <label htmlFor="cmg-semilla">Semilla</label>
                <div className="cmg-semilla">
                  <input
                    id="cmg-semilla"
                    inputMode="numeric"
                    value={estado.semilla}
                    onChange={(e) => dispatch({ tipo: "semilla", valor: e.currentTarget.value })}
                    aria-invalid={semilla == null}
                    aria-describedby="cmg-semilla-ayuda"
                    disabled={estado.sorteando}
                  />
                  <button
                    type="button"
                    className="cmv2-ghost"
                    onClick={() => dispatch({ tipo: "semilla", valor: String(nuevaSemilla()) })}
                    disabled={estado.sorteando}
                  >
                    <Shuffle size={14} aria-hidden="true" /> Nueva
                  </button>
                </div>
                <small id="cmg-semilla-ayuda">
                  {semilla == null
                    ? "Usa un entero entre 1 y 2147483646."
                    : "Misma semilla y mismo marco dan el mismo listado."}
                </small>
              </div>

              {!esCenso && (
              <div className="cmg-campo" data-qa-geometry-member>
                <label htmlFor="cmg-reservas">Reservas por estrato</label>
                <input
                  id="cmg-reservas"
                  type="number"
                  min={0}
                  max={10000}
                  step={1}
                  value={esPps ? "0" : estado.reservas}
                  onChange={(e) => dispatch({ tipo: "reservas", valor: e.currentTarget.value })}
                  disabled={esPps || estado.sorteando}
                  aria-invalid={!esPps && reservas == null}
                  aria-describedby="cmg-reservas-ayuda"
                />
                <small id="cmg-reservas-ayuda">
                  {esPps ? MOTIVO_SIN_RESERVAS_PPS : "Réplicas en orden aleatorio; se liberan por lotes completos."}
                </small>
              </div>
              )}

              {metodo === "sistematico" && !esCenso && (
                <div className="cmg-campo" data-qa-geometry-member>
                  <label htmlFor="cmg-orden">Ordenar por</label>
                  <select
                    id="cmg-orden"
                    value={estado.ordenPor}
                    onChange={(e) => dispatch({ tipo: "ordenPor", valor: e.currentTarget.value })}
                    disabled={estado.sorteando}
                    aria-describedby="cmg-orden-ayuda"
                  >
                    <option value="">Id ({marco.columnas.id})</option>
                    {columnasOrden
                      .filter((c) => c !== marco.columnas.id)
                      .map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <small id="cmg-orden-ayuda">El intervalo recorre el marco en este orden.</small>
                </div>
              )}
            </div>

            {estado.error && <ErrorDelMotor error={estado.error} label="No se pudo sortear" />}
            {motivoBloqueo && (
              <div id="cmg-sortear-motivo">
                <ErrorBlock label="Esta técnica no se sortea" detail={motivoBloqueo} />
              </div>
            )}

            <div className="cmv2-inline-actions cmg-sortear">
              <button
                type="button"
                className="cmv2-primary"
                onClick={() => void sortear()}
                disabled={!puedeSortear}
                aria-describedby={motivoBloqueo ? "cmg-sortear-motivo" : undefined}
              >
                {estado.sorteando
                  ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
                  : <Shuffle size={14} aria-hidden="true" />}
                {corrida ? "Sortear de nuevo" : "Sortear"}
              </button>
              <span className="cmg-nota">
                {esCenso
                  ? `Ordena al azar las ${formatearEntero(marco.N)} unidades del marco.`
                  : `Sortea el n a campo del componente sobre ${formatearEntero(marco.N)} unidades.`}
              </span>
            </div>
          </section>

          <FichaCorrida corrida={corrida} componente={componente} />
          {corrida && (corrida.unidades === null ? (
            <section className="cmv2-panel" data-qa-geometry-member>
              <LoadingBlock variant="inline" label="Cargando el listado de unidades…" />
            </section>
          ) : (
            <TablaUnidades
              unidades={corrida.unidades}
              filtro={estado.filtro}
              pagina={estado.pagina}
              onFiltro={(filtro) => dispatch({ tipo: "filtro", filtro })}
              onPagina={(pagina) => dispatch({ tipo: "pagina", pagina })}
            />
          ))}
        </>
      )}
    </div>
  );
}
