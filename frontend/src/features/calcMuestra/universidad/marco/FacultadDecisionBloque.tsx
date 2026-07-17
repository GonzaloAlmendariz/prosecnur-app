/**
 * Bloque de UNA facultad de la vista integrada facultad-primaria de
 * «Cursos-horario: criterios + radiografía» (reunión §4). Acordeón: colapsado
 * resume (elegibles, CH elegibles, mediana, estado de la decisión); expandido
 * muestra —EN ESTE ORDEN— la radiografía de la facultad (información) y, debajo,
 * la decisión de los criterios de curso-horario para ESA facultad (información →
 * decisión, no "todos los criterios y después toda la radiografía").
 *
 * Presentacional: reusa los modelos puros (tipoSesionModel, minElegiblesModel,
 * facultadDecisionModel) y los controles por-facultad existentes
 * (FacultadCategoriaToggles). La edición compila a `exceptions[excKey]` (op
 * "replace") y `minEligible.byFaculty[minKey]`; nada cambia el marco hasta
 * recalcular (la barra global de la pestaña).
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, Lightbulb } from "lucide-react";
import type {
  CalcMuestraAulasExploracion,
  CriterioSeleccion,
  CriterioVariable,
  CriteriosSeleccionMarco,
} from "../../../../api/client";
import { seleccionVariable } from "../../dominio";
import { fmtDec, fmtInt } from "../../sharedCore";
import { FacultadCategoriaToggles } from "../criterios/FacultadCategoriaToggles";
import { UNIVERSITY_SESSION_TYPE_SUGERENCIAS } from "../shared/constants";
import {
  aplicarSugerencia,
  filasPorFacultad,
  sugerenciaAplicada,
  sugerenciaParaFacultad,
  SESSION_TYPE_VARIABLE_ID,
} from "../criterios/tipoSesionModel";
import { minimoFacultad, minimoSugerido, presentesEsperados } from "../criterios/minElegiblesModel";
import { FacultadRadiografiaCard } from "./FacultadRadiografiaCard";
import { resumenDecisionFacultad, type FacultadBloque } from "./facultadDecisionModel";

/** Parseo de un input numérico opcional: vacío → null; inválido → null. */
function parseEntero(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(1, Math.round(n)) : null;
}

/**
 * Orden del EMBUDO por facultad (reunión §4): del filtro más GENERAL al más
 * PARTICULAR. El tipo de curso (session_type) es la decisión final —se decide
 * viendo su radiografía— así que va al fondo; la modalidad y la condición del
 * curso, que recortan grueso, van primero.
 */
const ORDEN_EMBUDO_CRITERIO: Record<string, number> = {
  modality: 0,
  condicion_curso: 1,
  course_level: 2,
  teacher_type: 3,
  session_type: 9,
};
function ordenEmbudo(id: string): number {
  return ORDEN_EMBUDO_CRITERIO[id] ?? 5;
}

/** Control por-facultad de UN criterio de set (session/condition/teacher). */
function CriterioFacultadCard({
  variable,
  seleccion,
  excKey,
  facLabel,
  exploracion,
  onSel,
}: {
  variable: CriterioVariable;
  seleccion: CriteriosSeleccionMarco;
  excKey: string;
  facLabel: string;
  exploracion: CalcMuestraAulasExploracion | null;
  onSel: (next: CriterioSeleccion) => void;
}) {
  const sel = seleccionVariable(seleccion, variable.id);
  const fila = filasPorFacultad({
    variable,
    sel,
    facultades: [{ key: excKey, label: facLabel }],
    exploracion,
  })[0];
  const propia = fila?.decision === "propia";
  // Colapsado por defecto cuando hereda el global (el caso común): la columna
  // queda escaneable y solo se abre lo que se está decidiendo. Una decisión
  // propia arranca abierta para que el override quede a la vista.
  const [abierto, setAbierto] = useState(propia);
  // Sugerencia por facultad (reunión §4 + verificación empírica): solo para el
  // tipo de sesión, matcheando por nombre de facultad. NUNCA auto-aplicada — el
  // académico decide con el botón «Usar» (regla de control explícito).
  const sug =
    variable.id === SESSION_TYPE_VARIABLE_ID
      ? sugerenciaParaFacultad(variable, facLabel, UNIVERSITY_SESSION_TYPE_SUGERENCIAS)
      : null;
  const sugAlDia = sug ? sugerenciaAplicada(variable, sel, excKey, sug) : false;
  if (!fila) return null;
  return (
    <section className="cmv2-chfp-crit" data-decision={fila.decision} data-open={abierto || undefined}>
      <button
        type="button"
        className="cmv2-chfp-crit-head"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className="cmv2-chfp-crit-head-label">
          <span className="cmv2-chfp-crit-chevron" aria-hidden="true">
            {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <strong>{variable.label}</strong>
        </span>
        <span className="cmv2-chfp-crit-state" data-decision={fila.decision}>
          {propia ? "Decisión propia" : "Hereda el global"}
        </span>
      </button>
      {sug ? (
        <div className="cmv2-chfp-crit-sug" role="note">
          <Lightbulb size={13} aria-hidden="true" />
          <span className="cmv2-chfp-crit-sug-copy" title={sug.porque}>
            Sugerido: {sug.modo === "solo" ? "solo " : "incluir "}
            {sug.labels.join(", ").toLocaleLowerCase("es")}
          </span>
          <button
            type="button"
            className="cmv2-crit-sug-btn"
            disabled={sugAlDia}
            title={sug.porque}
            onClick={() => onSel(aplicarSugerencia(variable, sel, excKey, sug))}
          >
            {sugAlDia ? "Al día" : "Usar"}
          </button>
        </div>
      ) : null}
      {abierto ? (
        <FacultadCategoriaToggles
          fila={fila}
          variable={variable}
          sel={sel}
          onSel={onSel}
          ariaLabel={`${variable.label} en ${facLabel}`}
        />
      ) : null}
    </section>
  );
}

/** Control por-facultad del mínimo de elegibles (criterio 7). */
function MinFacultadCard({
  seleccion,
  minKey,
  umbralGeneral,
  tasa,
  onMinimoFacultad,
}: {
  seleccion: CriteriosSeleccionMarco;
  minKey: string;
  umbralGeneral: number;
  tasa: number | null;
  onMinimoFacultad: (minKey: string, valor: number | null) => void;
}) {
  const propio = minimoFacultad(seleccion, minKey);
  const [abierto, setAbierto] = useState(propio != null);
  const base = propio ?? umbralGeneral;
  const sugerido = minimoSugerido(base, tasa);
  const presentes = presentesEsperados(base, tasa);
  return (
    <section className="cmv2-chfp-crit" data-decision={propio != null ? "propia" : "hereda"} data-open={abierto || undefined}>
      <button
        type="button"
        className="cmv2-chfp-crit-head"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className="cmv2-chfp-crit-head-label">
          <span className="cmv2-chfp-crit-chevron" aria-hidden="true">
            {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <strong>Mínimo de elegibles por aula</strong>
        </span>
        <span className="cmv2-chfp-crit-state" data-decision={propio != null ? "propia" : "hereda"}>
          {propio != null ? `Propio: ≥ ${fmtInt(propio)}` : `Hereda el general (≥ ${fmtInt(umbralGeneral)})`}
        </span>
      </button>
      {abierto ? (
        <>
          <div className="cmv2-chfp-min">
            <label className="cmv2-crit-num-field">
              <span>Mínimo propio de la facultad</span>
              <input
                type="number"
                min={1}
                value={propio ?? ""}
                placeholder={`${fmtInt(umbralGeneral)} (general)`}
                aria-label="Mínimo de elegibles propio de la facultad"
                onChange={(e) => onMinimoFacultad(minKey, parseEntero(e.target.value))}
              />
            </label>
            {propio != null ? (
              <button
                type="button"
                className="cmv2-crit-tsf-heredar"
                onClick={() => onMinimoFacultad(minKey, null)}
              >
                Volver a heredar el general
              </button>
            ) : null}
          </div>
          {tasa != null && sugerido != null ? (
            <p className="cmv2-chfp-min-sug" role="note">
              <Lightbulb size={13} aria-hidden="true" />
              Con asistencia del {Math.round(tasa * 100)}%, un mínimo de {fmtInt(base)} encuentra ~
              {fmtInt(presentes ?? 0)} presentes; para encontrar {fmtInt(base)} matriculados hay que exigir{" "}
              <strong>{fmtInt(sugerido)}</strong>. La sugerencia no se aplica sola.
              {sugerido !== base ? (
                <button
                  type="button"
                  className="cmv2-crit-sug-btn"
                  onClick={() => onMinimoFacultad(minKey, sugerido)}
                >
                  Usar sugerido ({fmtInt(sugerido)})
                </button>
              ) : null}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function FacultadDecisionBloque({
  bloque,
  variablesToggle,
  seleccion,
  exploracion,
  umbralGeneral,
  tasa,
  defaultOpen,
  onToggleVariable,
  onMinimoFacultad,
}: {
  bloque: FacultadBloque;
  /** Criterios de set decidibles por facultad (session/condition/teacher). */
  variablesToggle: CriterioVariable[];
  /** Borrador de la selección de criterios. */
  seleccion: CriteriosSeleccionMarco;
  exploracion: CalcMuestraAulasExploracion | null;
  umbralGeneral: number;
  tasa: number | null;
  defaultOpen?: boolean;
  onToggleVariable: (variableId: string, next: CriterioSeleccion) => void;
  onMinimoFacultad: (minKey: string, valor: number | null) => void;
}) {
  const [abierto, setAbierto] = useState(Boolean(defaultOpen));
  const { fac, facLabel, excKey, minKey } = bloque;
  // El tipo de curso es la decisión MÁS PARTICULAR del embudo: se separa del
  // resto para renderizarse al final, tras la bisagra de «aulas candidatas».
  const sessionVar = variablesToggle.find((v) => v.id === SESSION_TYPE_VARIABLE_ID);
  const generales = [...variablesToggle]
    .filter((v) => v.id !== SESSION_TYPE_VARIABLE_ID)
    .sort((a, b) => ordenEmbudo(a.id) - ordenEmbudo(b.id));
  const resumen = resumenDecisionFacultad(seleccion, variablesToggle, excKey, minKey);
  const estadoTexto =
    resumen.propias === 0
      ? "Hereda el global"
      : `${resumen.propias} ${resumen.propias === 1 ? "criterio propio" : "criterios propios"}`;

  return (
    <article className="cmv2-chfp-bloque" data-open={abierto} data-decidido={resumen.propias > 0 || undefined}>
      <button
        type="button"
        className="cmv2-chfp-bloque-head"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className="cmv2-chfp-bloque-chevron" aria-hidden="true">
          {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className="cmv2-chfp-bloque-title">
          <span className="cmv2-chfp-bloque-nombre">{facLabel}</span>
          <span className="cmv2-chfp-bloque-meta">
            {fmtInt(fac.ch_elegibles)} de {fmtInt(fac.ch_total)} CH elegibles
            {fac.est_aula_mediana != null ? ` · mediana ${fmtDec(fac.est_aula_mediana, 0)} por aula` : ""}
          </span>
        </span>
        <span className="cmv2-chfp-bloque-estado" data-decidido={resumen.propias > 0 || undefined}>
          {estadoTexto}
        </span>
        <span className="cmv2-chfp-bloque-hero">
          {fmtInt(fac.elegibles_total)}
          <em>elegibles</em>
        </span>
      </button>

      {abierto ? (
        <div className="cmv2-chfp-bloque-body">
          <div className="cmv2-chfp-info" aria-label={`Radiografía de ${facLabel}`}>
            <span className="cmv2-chfp-section-eyebrow">Información de la facultad</span>
            <div className="cmv2-chfp-info-scroll">
              <FacultadRadiografiaCard fac={fac} />
            </div>
          </div>
          <div className="cmv2-chfp-decision" aria-label={`Decisión de criterios para ${facLabel}`}>
            <span className="cmv2-chfp-section-eyebrow">Decisión para esta facultad</span>
            <p className="cmv2-chfp-decision-hint">
              Cada criterio hereda el global de arriba salvo que decidas propio aquí. Nada cambia el marco hasta
              recalcular.
            </p>
            {/* Criterios generales (del más amplio al más fino) + el mínimo,
                que también recorta grueso: van antes de la bisagra. */}
            {generales.map((variable) => (
              <CriterioFacultadCard
                key={variable.id}
                variable={variable}
                seleccion={seleccion}
                excKey={excKey}
                facLabel={facLabel}
                exploracion={exploracion}
                onSel={(next) => onToggleVariable(variable.id, next)}
              />
            ))}
            <MinFacultadCard
              seleccion={seleccion}
              minKey={minKey}
              umbralGeneral={umbralGeneral}
              tasa={tasa}
              onMinimoFacultad={onMinimoFacultad}
            />
            {/* Bisagra del embudo: cuántas aulas quedan con los filtros
                generales, antes de la decisión más particular (el tipo). */}
            <p className="cmv2-chfp-bisagra" role="note">
              <strong>{fmtInt(fac.ch_elegibles)}</strong> de {fmtInt(fac.ch_total)} aulas candidatas
              con estos criterios · ahora decide el <em>tipo de curso</em>
            </p>
            {sessionVar ? (
              <CriterioFacultadCard
                variable={sessionVar}
                seleccion={seleccion}
                excKey={excKey}
                facLabel={facLabel}
                exploracion={exploracion}
                onSel={(next) => onToggleVariable(sessionVar.id, next)}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
