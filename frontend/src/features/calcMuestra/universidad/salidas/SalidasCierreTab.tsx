/**
 * Pestaña "Cierre" (id salidas-guia) de la sección Salida. No es un checklist:
 * es la ficha ejecutiva auditable que se defiende ante el cliente. Arriba el
 * contexto llano; luego el camino completo del diseño como flujo horizontal
 * con las cifras finales del motor (N marco → n validado → aulas M1 →
 * reservas → entregables); una fila de cifras de defensa (n objetivo, margen
 * real, representatividad, aulas, profundidad de reserva) y la línea compacta
 * de reproducibilidad (método, semilla, firma del marco) que referencia a
 * Aulas → Sustento técnico. Visualmente la ficha lleva marco de "documento"
 * (barra de acento superior + sombra de panel) y la reproducibilidad se
 * presenta como sello tipográfico en mono (.cmv2-sal-ficha en salidas.css).
 * El pill de estado no certifica a ciegas: lee la salud del diseño
 * (shared/salud.ts) y distingue "diseño cerrado" / "con observaciones" /
 * "con riesgos"; las observaciones se listan al pie de la ficha.
 */
import { AlertTriangle, CheckCircle2, FileCheck2, ShieldAlert } from "lucide-react";
import type { CalcMuestraWorkspace } from "../../../../api/client";
import { calcEPreview } from "../../didactica/motorPreview";
import { fmtInt, fmtPct, fmtRatio, safeNumber } from "../../sharedCore";
import { classroomRowNumber, classroomRowText } from "../shared/format";
import { saludDesdeModel } from "../shared/salud";
import { CifraFila, CifraMotor, FlujoVertical, type FlujoEtapa } from "../ui";
import { classroomMethodLabel, classroomScore, type ClassroomLabModel } from "../aulas/aulasParts";
import { HistorialCorridas } from "./HistorialCorridas";
import "../../didactica/didactica.css";
import "./salidas.css";
import { profundidadReserva } from "../aulas/profundidadReservaModel";
import { rendimientoNeto } from "./rendimientoNetoModel";

export function SalidasCierreTab({
  model,
  workspace,
  modoTrabajo = null,
  onValidarDiseno,
}: {
  model: ClassroomLabModel;
  workspace: CalcMuestraWorkspace;
  /** `estimacion_preliminar` | `diseno_validado`. Decide con qué plantilla sale
   *  el reporte y, por tanto, cómo se titula ante el cliente. */
  modoTrabajo?: string | null;
  /** Sin esto el recorrido universitario no tiene forma de cerrar el diseño. */
  onValidarDiseno?: () => void;
}) {
  const {
    aulasScenario,
    selectedComp,
    selectedResultReady,
    frame,
    selection,
    selectionReady,
    replacementReady,
    m1Rows,
    reserveRows,
    extraReserveRows,
    reserveDepthRows,
    currentRepresentativityScore,
    targetForDisplay,
  } = model;

  const calculationReady = selectedResultReady;
  const marcoN = Math.max(safeNumber(selectedComp.marco.marco_validado), model.framePopulationCount);
  // Margen real: retrocálculo del motor si vino (0 incluido: con n ≥ N el
  // error muestral es nulo); si el motor no lo trae, la vista previa TS
  // etiquetada como preview (misma vía que Cálculo → Propuestas), anclada al
  // escenario nivel universidad (n y marco del mismo componente).
  const precisionRaw = selectedComp.resultado?.precision_alcanzada;
  const precisionMotor = precisionRaw == null ? Number.NaN : safeNumber(precisionRaw, Number.NaN);
  const nSeleccionado = safeNumber(selectedComp.resultado?.n_objetivo, 0);
  const precisionPreview = aulasScenario === "e1" && nSeleccionado > 0
    ? safeNumber(
        calcEPreview(
          nSeleccionado,
          safeNumber(selectedComp.marco.marco_validado),
          selectedComp.parametros.p,
          selectedComp.parametros.z,
          selectedComp.parametros.deff,
        ),
        Number.NaN,
      )
    : Number.NaN;
  const precisionEsMotor = Number.isFinite(precisionMotor);
  const precision = precisionEsMotor ? precisionMotor : precisionPreview;
  const precisionCensal = precision === 0 && nSeleccionado >= safeNumber(selectedComp.marco.marco_validado) && nSeleccionado > 0;
  const reservasTotal = reserveRows.length + extraReserveRows.length;

  // Profundidad mínima de reserva por celda (misma lectura que Aulas → Reemplazos).
  const depthRatios = reserveDepthRows.map((row) => classroomRowNumber(row, ["depth_ratio"]));
  const minDepth = depthRatios.length ? Math.min(...depthRatios) : Number.NaN;
  // El mismo objetivo declarado que en Reemplazos y Monitoreo: tres superficies
  // pintaban la misma cifra con umbrales propios, y la de cierre era la más
  // laxa —cualquier valor desde 1 salía verde, sin estado intermedio—.
  const profundidadMin = profundidadReserva(minDepth, model.config?.objective?.reserve_depth_target ?? null);
  const peorCelda = reserveDepthRows.find((row) => classroomRowNumber(row, ["depth_ratio"]) === minDepth);

  // Salud del diseño: veredicto derivado de las mismas cifras validadas que
  // muestra esta ficha. La procedencia de cada cifra no cambia; lo que cambia
  // es si el conjunto se puede defender tal cual.
  const observaciones = saludDesdeModel(model);
  // C5 · Lo que la muestra rinde DE VERDAD: el dimensionamiento suma elegibles
  // brutos y dos aulas del mismo estrato pueden compartir alumnos. Sin esto, la
  // ficha declaraba un diseño «cerrado» sin haber contrastado nunca el neto
  // contra el objetivo.
  const neto = rendimientoNeto(
    m1Rows,
    safeNumber(selectedComp.resultado?.n_objetivo, 0) || null,
    safeNumber(selectedComp.resultado?.n_operativo, 0) || null,
  );
  const validado = modoTrabajo === "diseno_validado";
  // No se cierra un diseño que todavía no existe: exige resultado acreditado.
  const puedeValidar = Boolean(selectedResultReady);
  const hayRiesgos = observaciones.some((obs) => obs.nivel === "danger");
  const disenoCompleto = calculationReady && selectionReady && replacementReady;
  const estadoFicha = !disenoCompleto
    ? "preparacion"
    : hayRiesgos
      ? "riesgos"
      : observaciones.length
        ? "observaciones"
        : "cerrado";
  const estadoFichaLabel = {
    preparacion: "en preparación",
    cerrado: "diseño cerrado",
    observaciones: "diseño con observaciones",
    riesgos: "diseño con riesgos",
  }[estadoFicha];

  const publication = workspace.publication_config ?? {};
  const sheetsConfigured = Boolean(publication.google_sheets_enabled || publication.spreadsheet_id || publication.spreadsheet_url);
  const workbookConfigured = publication.include_workbook !== false;
  const entregablesListos = (workbookConfigured || sheetsConfigured) && calculationReady && selectionReady;

  const etapas: FlujoEtapa[] = [
    {
      id: "marco",
      label: "N marco",
      valor: marcoN > 0 ? fmtInt(marcoN) : undefined,
      detalle: "población elegible validada",
      estado: marcoN > 0 ? "ready" : "pending",
    },
    {
      id: "n",
      label: "n validado",
      valor: calculationReady ? fmtInt(targetForDisplay) : undefined,
      detalle: "muestra objetivo de la calculadora",
      estado: calculationReady ? "ready" : marcoN > 0 ? "working" : "pending",
    },
    {
      id: "titulares",
      label: "Cursos-horario titulares M1",
      valor: m1Rows.length ? fmtInt(m1Rows.length) : undefined,
      detalle: selectionReady && selection
        ? classroomMethodLabel(String(selection.selector_engine_used ?? selection.selector_engine ?? ""))
        : "selección pendiente",
      estado: selectionReady ? "ready" : calculationReady ? "working" : "pending",
    },
    {
      id: "reservas",
      label: "Reservas",
      valor: reservasTotal ? fmtInt(reservasTotal) : undefined,
      detalle: extraReserveRows.length
        ? `cadenas Rn + ${fmtInt(extraReserveRows.length)} en bolsa extra`
        : "cadenas de reemplazo equivalente",
      estado: replacementReady ? "ready" : selectionReady ? "working" : "pending",
    },
    {
      id: "entregables",
      label: "Entregables",
      valor: entregablesListos ? (sheetsConfigured ? "Excel + Sheets" : "Excel") : undefined,
      detalle: entregablesListos ? "listos para exportar" : "configúralos en Entregables",
      estado: entregablesListos ? "ready" : selectionReady ? "working" : "pending",
    },
  ];

  return (
    <div
      className="cmv2-sal-stack"
      // Declarada para que el gate visual pueda auditarla.
      data-qa-geometry-group="calc-muestra/salidas-cierre"
      data-qa-geometry-contract="intrinsic"
    >
      <section className="cmv2-panel cmv2-sal-panel cmv2-sal-ficha" aria-label="Ficha ejecutiva del diseño muestral">
        <div className="cmv2-panel-head">
          <strong>Ficha ejecutiva</strong>
          <span
            className="cmv2-pill-soft cmv2-sal-estado"
            data-cerrado={estadoFicha === "cerrado" || undefined}
            data-salud={estadoFicha === "observaciones" || estadoFicha === "riesgos" ? estadoFicha : undefined}
          >
            {estadoFichaLabel}
          </span>
        </div>

        <FlujoVertical
          etapas={etapas}
          orientacion="horizontal"
          ariaLabel="Camino completo: del marco validado a los entregables"
        />

        <CifraFila>
          <CifraMotor
            label="n objetivo"
            value={calculationReady ? fmtInt(targetForDisplay) : "pendiente"}
            detalle="entrevistas a lograr"
            origen={calculationReady ? "motor" : undefined}
            hero
          />
          <CifraMotor
            label="Margen real alcanzado"
            value={Number.isFinite(precision) ? `±${fmtPct(precision)}` : "pendiente"}
            detalle={precisionCensal
              ? "el n cubre todo el marco del escenario elegido"
              : aulasScenario === "e2" && !precisionEsMotor
                ? "varía por facultad; consulta el detalle del motor"
                : "retrocálculo con el n final del escenario elegido"}
            origen={Number.isFinite(precision) ? (precisionEsMotor ? "motor" : "preview") : undefined}
          />
          <CifraMotor
            label="Representatividad"
            value={Number.isFinite(currentRepresentativityScore) ? classroomScore(currentRepresentativityScore) : "pendiente"}
            detalle="score global de la selección"
            origen={Number.isFinite(currentRepresentativityScore) ? "motor" : undefined}
          />
          <CifraMotor
            label="Cursos-horario titulares M1"
            value={m1Rows.length ? fmtInt(m1Rows.length) : "pendiente"}
            detalle={reservasTotal ? `con ${fmtInt(reservasTotal)} reservas` : "reservas pendientes"}
            origen={selectionReady ? "motor" : undefined}
          />
          <CifraMotor
            label="Profundidad de reserva"
            value={Number.isFinite(minDepth) ? fmtRatio(minDepth) : "pendiente"}
            detalle={profundidadMin
              ? profundidadMin.tono === "alerta"
                ? "hay celdas por debajo del objetivo"
                : `mínima por celda${peorCelda ? `: ${classroomRowText(peorCelda, ["stratum"])}` : ""}`
              : "requiere simular reemplazos"}
            origen={Number.isFinite(minDepth) ? "motor" : undefined}
            tono={profundidadMin?.tono}
          />
        </CifraFila>

        <div className="cmv2-sal-meta" aria-label="Reproducibilidad del sorteo">
          <span>
            <b>Método</b>
            {selection
              ? classroomMethodLabel(String(selection.selector_engine_used ?? selection.selector_engine ?? ""))
              : "pendiente"}
          </span>
          <span>
            <b>Semilla</b>
            {selection ? String(safeNumber(selection.seed, model.config.semilla)) : "pendiente"}
          </span>
          <span>
            <b>Firma del marco</b>
            {selection?.frame_hash
              ? String(selection.frame_hash).slice(0, 10)
              : frame?.frame_hash
                ? String(frame.frame_hash).slice(0, 10)
                : "pendiente"}
          </span>
          <em>Con estos datos el sorteo se reconstruye exacto; el detalle completo vive en Selección → Sustento técnico.</em>
        </div>

        {/*
          * El estudio nacía en `estimacion_preliminar` y el recorrido
          * universitario NO tenía dónde salir de ahí: la única acción vivía en
          * la sección «resultados» del recorrido general, a la que este modo
          * nunca llega. Efecto medido el 2026-08-21 sobre HSVG2026, con sus 190
          * aulas ya cerradas: su reporte se titulaba «Propuesta metodológica
          * preliminar» y usaba la plantilla preliminar, sin salida posible.
          */}
        {neto && !neto.sinDatos && (
          <div className="cmv2-sal-neto" data-cubre={neto.cubreObjetivo === false ? "no" : undefined}>
            <strong>Lo que la muestra rinde sin contar alumnos dos veces</strong>
            <p>
              Los {fmtInt(neto.bruto)} elegibles de los titulares son{" "}
              <b>{fmtInt(neto.neto)}</b> alumnos distintos:{" "}
              <b>{fmtInt(neto.repetidos)}</b> ({fmtPct(neto.fraccionRepetida)}) aparecen en
              más de un aula. Con la tasa media ({fmtPct(neto.tasaMedia)}) se esperan{" "}
              <b>{fmtInt(neto.efectivasEsperadas)}</b> encuestas efectivas.
            </p>
            {neto.objetivo != null && (
              <p>
                {neto.cubreObjetivo ? (
                  <>
                    Cubre la muestra objetivo de {fmtInt(neto.objetivo)} con{" "}
                    <b>{fmtInt(neto.margenSobreObjetivo ?? 0)}</b> de margen.
                    {neto.operativa != null && neto.efectivasEsperadas < neto.operativa ? (
                      <>
                        {" "}La sobremuestra operativa de {fmtInt(neto.operativa)} no se
                        alcanza, y es su función: existe para absorber esta pérdida.
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    <b>No alcanza la muestra objetivo</b> de {fmtInt(neto.objetivo)}: faltan{" "}
                    {fmtInt(Math.abs(neto.margenSobreObjetivo ?? 0))} efectivas. Hacen falta
                    más titulares, o aulas que compartan menos alumnos entre sí.
                  </>
                )}
              </p>
            )}
          </div>
        )}

        <div className="cmv2-sal-validar" data-validado={validado || undefined}>
          {validado ? (
            <>
              <CheckCircle2 size={15} aria-hidden="true" />
              <div>
                <strong>Diseño validado</strong>
                <span>
                  El reporte sale como diseño metodológico validado, con la ficha
                  y las tablas por estrato. Sigue siendo editable: recalcular no
                  revierte este estado.
                </span>
              </div>
            </>
          ) : (
            <>
              <FileCheck2 size={15} aria-hidden="true" />
              <div>
                <strong>El diseño figura como propuesta preliminar</strong>
                <span>
                  {puedeValidar
                    ? "Mientras siga así, el reporte se titula «Propuesta metodológica preliminar». Márcalo validado cuando el diseño esté cerrado para campo."
                    : "Cuando el cálculo y la selección estén acreditados podrás marcarlo como validado, y el reporte dejará de titularse preliminar."}
                </span>
                {observaciones.length > 0 && puedeValidar ? (
                  <em>
                    Quedan {fmtInt(observaciones.length)}{" "}
                    {observaciones.length === 1 ? "observación" : "observaciones"} de salud abajo:
                    validarlo no las resuelve ni las oculta.
                  </em>
                ) : null}
              </div>
              {onValidarDiseno && (
                <button
                  type="button"
                  className="cmv2-ghost"
                  onClick={onValidarDiseno}
                  disabled={!puedeValidar}
                  title={puedeValidar
                    ? "Marca el diseño como validado: el reporte pasa a la plantilla de diseño validado."
                    : "Falta acreditar el cálculo y la selección vigentes."}
                >
                  Marcar diseño validado
                </button>
              )}
            </>
          )}
        </div>

        {observaciones.length > 0 && (
          <ul className="cmv2-sal-observaciones" aria-label="Observaciones de salud del diseño">
            {observaciones.map((obs) => (
              <li key={obs.id} data-nivel={obs.nivel}>
                {obs.nivel === "danger" ? <ShieldAlert size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
                <div>
                  <strong>{obs.titulo}</strong>
                  <span>{obs.detalle} <em>{obs.accion}</em></span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <HistorialCorridas workspace={workspace} />
    </div>
  );
}
