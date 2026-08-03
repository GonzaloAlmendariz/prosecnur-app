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
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Lightbulb } from "lucide-react";
import type {
  CalcMuestraAulasCriteriosRadiografia,
  CalcMuestraAulasExploracion,
  CalcMuestraAulasExploracionFacultad,
  CriterioSeleccion,
  CriterioVariable,
  CriteriosSeleccionMarco,
  MonitoreoRow,
} from "../../../../api/client";
import { rangosFacultad, seleccionVariable } from "../../dominio";
import { aulasSupervivientesFacultad } from "../../dominio/criteriosImpacto";
import { fmtDec, fmtInt } from "../../sharedCore";
import { FacultadCategoriaToggles } from "../criterios/FacultadCategoriaToggles";
import { evidenciaPorCategoria } from "../criterios/evidenciaPorCategoria";
import { tasaAsistencia } from "../criterios/minElegiblesModel";
import { Switch } from "../criterios/Switch";
import { filasPorFacultad, SESSION_TYPE_VARIABLE_ID } from "../criterios/tipoSesionModel";
import { minimoFacultad, minimoSugerido, presentesEsperados } from "../criterios/minElegiblesModel";
import { AulasFinalesCard } from "./AulasFinalesCard";
import { FacultadRadiografiaCard } from "./FacultadRadiografiaCard";
import {
  CriterioFacultadRadiografia,
  type CriterioFacultadEvidence,
} from "./CriterioFacultadRadiografia";
import type { CriterioRadiografiaCard } from "./criteriosRadiografiaModel";
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
  fac,
  exploracion,
  criteriosRadiografia,
  radiografiaCard,
  criterioEvidence,
  onSel,
}: {
  variable: CriterioVariable;
  seleccion: CriteriosSeleccionMarco;
  excKey: string;
  facLabel: string;
  /** Radiografía de la facultad (para el detalle por tipo junto al criterio). */
  fac: CalcMuestraAulasExploracionFacultad;
  exploracion: CalcMuestraAulasExploracion | null;
  criteriosRadiografia: CalcMuestraAulasCriteriosRadiografia | null;
  radiografiaCard: CriterioRadiografiaCard | null;
  criterioEvidence: CriterioFacultadEvidence | null;
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
  // Colapsado por defecto cuando no hay decisión propia (el caso común): la
  // columna queda escaneable y solo se abre lo que se está decidiendo. Una
  // decisión propia arranca abierta para que el override quede a la vista.
  // F42 · Con una facultad a la vez el acordeón por criterio sobra: cada
  // criterio abre a ~954 px y plegarlos dejaba ocho cabeceras de 50 px que
  // esconden el switch junto a su gráfico —y son una sola pieza, no dos—.
  // Medido: ocho criterios cerrados por facultad.
  const [abierto, setAbierto] = useState(true);
  // Criterios con radiografía propia arriba (tabla de tipos o barra apilada de
  // condición): el toggle no repite la mini-barra de proporción —evita el %
  // doble e inconsistente entre la radiografía y el toggle— y un rótulo separa
  // la info (arriba) de la selección (abajo).
  const tieneRadiografia = Boolean(radiografiaCard && criterioEvidence) ||
    variable.id === SESSION_TYPE_VARIABLE_ID || variable.id === "condicion_curso";
  if (!fila) return null;
  return (
    <section
      className="cmv2-chfp-crit"
      data-qa-geometry-member
      data-decision={fila.decision}
      data-open={abierto || undefined}
      data-collapsible={!abierto || undefined}
      onClick={abierto ? undefined : () => setAbierto(true)}
    >
      <button
        type="button"
        className="cmv2-chfp-crit-head"
        aria-expanded={abierto}
        onClick={(e) => {
          e.stopPropagation();
          setAbierto((v) => !v);
        }}
      >
        <span className="cmv2-chfp-crit-head-label">
          <span className="cmv2-chfp-crit-chevron" aria-hidden="true">
            {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <strong>{variable.label}</strong>
        </span>
        {/* F114 · Decía «Sin restricción». Gonzalo: «no sé a qué te refieres con
            sin restricción». Nombraba la ausencia de algo en vez de lo que pasa
            con el marco — y lo que pasa es que entran todas las categorías. */}
        <span className="cmv2-chfp-crit-state" data-decision={fila.decision}>
          {propia ? "Criterio propio" : "Entran todas"}
        </span>
      </button>
      {abierto ? (
        <>
          {/* F98 · El bloque compacto de radiografía sale de aquí.
              Mostraba las mismas categorías que los conmutadores de abajo —cada
              etiqueta aparecía dos veces en el mismo criterio— con 482 nodos
              frente a 86. Gonzalo lo señaló tres veces: «los criterios con
              switcher de selección tienen que ser uno con los gráficos, son un
              todo», y el ADR 0057 lo fija: la categoría es la unidad y todo lo
              necesario para decidirla vive en su contenedor.
              No se retiró hasta que la tarjeta trajo **todo** lo que este bloque
              aportaba: matrículas y CH con dato (F95), la leyenda de las marcas
              (F96) y el contraste contra el total (F97). El inventario está en
              el doc del loop. */}
          {variable.id === SESSION_TYPE_VARIABLE_ID ? (
            <FacultadRadiografiaCard
              fac={fac}
              modo="tipos"
              criteriosRadiografia={criteriosRadiografia}
              facultadKey={excKey}
              contextoRadiografia="editable"
            />
          ) : variable.id === "condicion_curso" ? (
            <FacultadRadiografiaCard fac={fac} modo="condicion" />
          ) : null}
          {tieneRadiografia ? (
            <p className="cmv2-chfp-selecciona-nota">
              Marca {variable.id === "condicion_curso" ? "las condiciones" : "los tipos"} que entran al
              marco de esta facultad:
            </p>
          ) : null}
          <FacultadCategoriaToggles
            fila={fila}
            variable={variable}
            sel={sel}
            onSel={onSel}
            ariaLabel={`${variable.label} en ${facLabel}`}
            sinBarra={tieneRadiografia}
            evidencia={evidenciaPorCategoria(radiografiaCard, excKey, tasaAsistencia(seleccion))}
          />
        </>
      ) : null}
    </section>
  );
}

/** Control por-facultad del nivel/ciclo del curso (rango). */
function NivelFacultadCard({
  variable,
  seleccion,
  facKey,
  facLabel,
  fac,
  radiografiaCard,
  criterioEvidence,
  onRango,
}: {
  variable: CriterioVariable;
  seleccion: CriteriosSeleccionMarco;
  facKey: string;
  facLabel: string;
  /** Radiografía de la facultad (distribución por nivel, junto al criterio). */
  fac: CalcMuestraAulasExploracionFacultad;
  radiografiaCard: CriterioRadiografiaCard | null;
  criterioEvidence: CriterioFacultadEvidence | null;
  onRango: (facultad: string, rangos: Array<[number, number]>) => void;
}) {
  const valores = (variable.values ?? []).slice().sort((a, b) => a - b);
  const min = valores.length ? valores[0] : 0;
  const max = valores.length ? valores[valores.length - 1] : 0;
  const rangos = rangosFacultad(seleccion, facKey);
  const activo = rangos.length > 0;
  const [abierto, setAbierto] = useState(true);
  const desde = activo ? rangos[0][0] : min;
  const hasta = activo ? rangos[0][1] : max;
  return (
    <section
      className="cmv2-chfp-crit"
      data-qa-geometry-member
      data-decision={activo ? "propia" : "hereda"}
      data-open={abierto || undefined}
      data-collapsible={!abierto || undefined}
      onClick={abierto ? undefined : () => setAbierto(true)}
    >
      <button
        type="button"
        className="cmv2-chfp-crit-head"
        aria-expanded={abierto}
        onClick={(e) => {
          e.stopPropagation();
          setAbierto((v) => !v);
        }}
      >
        <span className="cmv2-chfp-crit-head-label">
          <span className="cmv2-chfp-crit-chevron" aria-hidden="true">
            {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <strong>{variable.label}</strong>
        </span>
        <span className="cmv2-chfp-crit-state" data-decision={activo ? "propia" : "hereda"}>
          {activo ? `Niveles ${desde}–${hasta}` : "Todos los niveles"}
        </span>
      </button>
      {abierto ? (
        <div className="cmv2-chfp-min">
          {radiografiaCard && criterioEvidence ? (
            <CriterioFacultadRadiografia
              card={radiografiaCard}
              facultyKey={facKey}
              facultyLabel={facLabel}
              evidence={criterioEvidence}
            />
          ) : (
            <FacultadRadiografiaCard fac={fac} modo="niveles" />
          )}
          <label className="cmv2-chfp-nivel-toggle">
            <Switch
              checked={activo}
              ariaLabel={`Limitar el nivel del curso en ${facLabel}`}
              onToggle={() => onRango(facKey, activo ? [] : [[desde, hasta]])}
            />
            <span>Limitar a un tramo de niveles (sin esto, la facultad admite todos)</span>
          </label>
          {activo && valores.length ? (
            <div className="cmv2-crit-range-inputs" data-active="true">
              <select
                className="cmv2-crit-range-select"
                value={desde}
                aria-label={`Nivel mínimo en ${facLabel}`}
                onChange={(e) => onRango(facKey, [[Number(e.target.value), hasta]])}
              >
                {valores.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <span className="cmv2-crit-range-dash">–</span>
              <select
                className="cmv2-crit-range-select"
                value={hasta}
                aria-label={`Nivel máximo en ${facLabel}`}
                onChange={(e) => onRango(facKey, [[desde, Number(e.target.value)]])}
              >
                {valores.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Control por-facultad del mínimo de elegibles (criterio 7). */
function MinFacultadCard({
  seleccion,
  minKey,
  fac,
  umbralGeneral,
  tasa,
  radiografiaCard,
  criterioEvidence,
  onMinimoFacultad,
}: {
  seleccion: CriteriosSeleccionMarco;
  minKey: string;
  fac: CalcMuestraAulasExploracionFacultad;
  umbralGeneral: number;
  tasa: number | null;
  radiografiaCard: CriterioRadiografiaCard | null;
  criterioEvidence: CriterioFacultadEvidence | null;
  onMinimoFacultad: (minKey: string, valor: number | null) => void;
}) {
  const propio = minimoFacultad(seleccion, minKey);
  const [abierto, setAbierto] = useState(true);
  const base = propio ?? umbralGeneral;
  const sugerido = minimoSugerido(base, tasa);
  const presentes = presentesEsperados(base, tasa);
  // Radiografía de elegibles por aula de la facultad (§8.3: el mínimo DEBE
  // variar por facultad; 15 en Arte/Gastronomía deja demasiadas aulas fuera).
  const mediana = fac.est_aula_mediana;
  const media = fac.est_aula_media;
  const tipos = fac.por_tipo_sesion ?? [];
  const mins = tipos.map((t) => t.elegibles_min).filter((n): n is number => n != null);
  const maxs = tipos.map((t) => t.elegibles_max).filter((n): n is number => n != null);
  const distMin = mins.length ? Math.min(...mins) : null;
  const distMax = maxs.length ? Math.max(...maxs) : null;
  const hayDist = mediana != null && distMin != null && distMax != null && distMax > distMin;
  // «Alto» = el mínimo supera la mediana: dejaría fuera a más de la mitad de
  // las aulas típicas de la facultad (señal de que conviene bajarlo).
  const minimoAlto = mediana != null && base > mediana;
  const pos = (v: number) => (hayDist ? Math.min(100, Math.max(0, ((v - distMin!) / (distMax! - distMin!)) * 100)) : 0);
  return (
    <section
      className="cmv2-chfp-crit"
      data-qa-geometry-member
      data-decision={propio != null ? "propia" : "hereda"}
      data-open={abierto || undefined}
      data-collapsible={!abierto || undefined}
      onClick={abierto ? undefined : () => setAbierto(true)}
    >
      <button
        type="button"
        className="cmv2-chfp-crit-head"
        aria-expanded={abierto}
        onClick={(e) => {
          e.stopPropagation();
          setAbierto((v) => !v);
        }}
      >
        <span className="cmv2-chfp-crit-head-label">
          <span className="cmv2-chfp-crit-chevron" aria-hidden="true">
            {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <strong>Mínimo de elegibles por curso-horario</strong>
        </span>
        <span className="cmv2-chfp-crit-state" data-decision={propio != null ? "propia" : "hereda"}>
          {propio != null ? `Propio: ≥ ${fmtInt(propio)}` : `Por defecto: ≥ ${fmtInt(umbralGeneral)}`}
        </span>
      </button>
      {abierto ? (
        <>
          {radiografiaCard && criterioEvidence ? (
            <CriterioFacultadRadiografia
              card={radiografiaCard}
              facultyKey={minKey}
              facultyLabel={fac.facultad}
              evidence={criterioEvidence}
            />
          ) : null}
          <div className="cmv2-chfp-min">
            <label className="cmv2-crit-num-field">
              <span>Mínimo propio de la facultad</span>
              <span className="cmv2-chfp-min-input-row">
                <input
                  type="number"
                  min={1}
                  value={propio ?? ""}
                  placeholder={fmtInt(umbralGeneral)}
                  aria-label="Mínimo de elegibles propio de la facultad"
                  onChange={(e) => onMinimoFacultad(minKey, parseEntero(e.target.value))}
                />
                <span className="cmv2-chfp-min-input-hint">
                  {propio != null ? "elegibles por aula" : "usa el mínimo general"}
                </span>
              </span>
            </label>
            {propio != null ? (
              <button
                type="button"
                className="cmv2-crit-tsf-heredar"
                onClick={() => onMinimoFacultad(minKey, null)}
              >
                Quitar el mínimo propio
              </button>
            ) : null}
          </div>
          {hayDist && !criterioEvidence ? (
            <div className="cmv2-chfp-min-radiografia" role="note" data-alerta={minimoAlto || undefined}>
              <div className="cmv2-chfp-min-escala" aria-hidden="true">
                <i className="cmv2-chfp-min-escala-mediana" style={{ left: `${pos(mediana!)}%` }} />
                <i className="cmv2-chfp-min-escala-corte" style={{ left: `${pos(base)}%` }} />
              </div>
              <p className="cmv2-chfp-min-dist">
                Elegibles por curso-horario aquí: mediana <strong>{fmtDec(mediana!, 0)}</strong>
                {media != null ? `, media ${fmtDec(media, 0)}` : ""} · rango {fmtInt(distMin!)}–{fmtInt(distMax!)}.
                {minimoAlto ? (
                  <span className="cmv2-chfp-min-alerta">
                    {" "}El mínimo {fmtInt(base)} supera la mediana: dejaría fuera a más de la mitad de las aulas de
                    esta facultad. En facultades chicas (arte, gastronomía) conviene bajarlo (§8.3).
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}
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

/** Evidencia local de un criterio cuyo control, por contrato, sigue siendo
 * transversal. No repite ni simula un override por facultad: nombra dónde se
 * decide y mantiene la radiografía de ESTA facultad junto al criterio. */
function CriterioTransversalFacultadCard({
  card,
  facKey,
  facLabel,
  criterioEvidence,
}: {
  card: CriterioRadiografiaCard;
  facKey: string;
  facLabel: string;
  criterioEvidence: CriterioFacultadEvidence;
}) {
  const [abierto, setAbierto] = useState(true);
  return (
    <section
      className="cmv2-chfp-crit"
      data-qa-geometry-member
      data-decision="transversal"
      data-open={abierto || undefined}
      data-collapsible={!abierto || undefined}
      onClick={abierto ? undefined : () => setAbierto(true)}
    >
      <button
        type="button"
        className="cmv2-chfp-crit-head"
        aria-expanded={abierto}
        onClick={(event) => {
          event.stopPropagation();
          setAbierto((value) => !value);
        }}
      >
        <span className="cmv2-chfp-crit-head-label">
          <span className="cmv2-chfp-crit-chevron" aria-hidden="true">
            {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <strong>{card.label}</strong>
        </span>
        <span className="cmv2-chfp-crit-state">Regla común</span>
      </button>
      {abierto ? (
        <>
          <CriterioFacultadRadiografia
            card={card}
            facultyKey={facKey}
            facultyLabel={facLabel}
            evidence={criterioEvidence}
          />
          <p className="cmv2-chfp-transversal-note">
            La evidencia es de {facLabel}; esta regla no admite un override por facultad en el contrato vigente.{" "}
            <a href="#cmv2-chfp-global-adjustments">Ajustar la regla común</a>
          </p>
        </>
      ) : null}
    </section>
  );
}

export function FacultadDecisionBloque({
  bloque,
  variablesToggle,
  rangeVariable,
  seleccion,
  exploracion,
  criteriosRadiografia,
  criterioCards,
  criterioEvidence,
  aulaFrame,
  umbralGeneral,
  tasa,
  defaultOpen,
  onToggleVariable,
  onRango,
  onMinimoFacultad,
  onToggleAula,
  onReactivarAulas,
  sinPlegado,
  slotApertura,
  slotCierre,
}: {
  bloque: FacultadBloque;
  /** Criterios de set decidibles por facultad (session/condition/teacher). */
  variablesToggle: CriterioVariable[];
  /** Variable de nivel del curso (kind range), decidible por facultad; null si el catálogo no la trae. */
  rangeVariable?: CriterioVariable | null;
  /** Borrador de la selección de criterios. */
  seleccion: CriteriosSeleccionMarco;
  exploracion: CalcMuestraAulasExploracion | null;
  criteriosRadiografia: CalcMuestraAulasCriteriosRadiografia | null;
  criterioCards: ReadonlyMap<string, CriterioRadiografiaCard>;
  criterioEvidence: CriterioFacultadEvidence | null;
  /** Lista individual de CH del último marco (para la selección manual final). */
  aulaFrame: MonitoreoRow[];
  umbralGeneral: number;
  tasa: number | null;
  defaultOpen?: boolean;
  onToggleVariable: (variableId: string, next: CriterioSeleccion) => void;
  onRango: (facultad: string, rangos: Array<[number, number]>) => void;
  onMinimoFacultad: (minKey: string, valor: number | null) => void;
  /** Enciende/apaga un curso-horario puntual (excluida=true lo saca del marco). */
  onToggleAula: (classroomId: string, excluida: boolean) => void;
  /** Reactiva todos los CH apagados de esta facultad (claves en text_key). */
  onReactivarAulas: (clavesTextKey: string[]) => void;
  /** F41 · Se muestra una sola facultad: nada que plegar. */
  sinPlegado?: boolean;
  /** ADR 0057 · Criterio que abre el embudo (matriculados / población). */
  slotApertura?: ReactNode;
  /** ADR 0057 · Criterios 7 y 8, penúltimos antes del mayor detalle. */
  slotCierre?: ReactNode;
}) {
  // F41 · Sin plegado, la facultad mostrada se ve entera. El acordeón sólo
  // sobrevive para usos que aún listan varias facultades a la vez.
  const [abierto, setAbierto] = useState(Boolean(defaultOpen) || Boolean(sinPlegado));
  const { fac, facLabel, excKey, minKey } = bloque;
  // El tipo de curso es la decisión MÁS PARTICULAR del embudo: se separa del
  // resto para renderizarse al final, tras la bisagra de «aulas candidatas».
  const sessionVar = variablesToggle.find((v) => v.id === SESSION_TYPE_VARIABLE_ID);
  // Lista final de cursos-horario supervivientes de la facultad (el criterio más
  // granular): sale del aula_frame del build, ya filtrado por facultad.
  const aulasFinales = useMemo(() => aulasSupervivientesFacultad(aulaFrame, facLabel), [aulaFrame, facLabel]);
  const generales = [...variablesToggle]
    .filter((v) => v.id !== SESSION_TYPE_VARIABLE_ID)
    .sort((a, b) => ordenEmbudo(a.id) - ordenEmbudo(b.id));
  const resumen = resumenDecisionFacultad(seleccion, variablesToggle, excKey, minKey);
  const estadoTexto =
    resumen.propias === 0
      ? "Sin ajustes propios"
      : `${resumen.propias} ${resumen.propias === 1 ? "criterio propio" : "criterios propios"}`;

  return (
    <article className="cmv2-chfp-bloque" data-open={abierto} data-decidido={resumen.propias > 0 || undefined}>
      {/* F41 · Sin plegado la cabecera es un rótulo, no un control: ofrecer un
          botón que no hace nada es peor que no ofrecerlo. */}
      {sinPlegado ? (
      <div className="cmv2-chfp-bloque-head" data-fijo="true">
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
          <em>matrículas elegibles</em>
        </span>
      </div>
      ) : (
      <button
        type="button"
        className="cmv2-chfp-bloque-head"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className="cmv2-chfp-bloque-chevron" aria-hidden="true">
          {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>        <span className="cmv2-chfp-bloque-title">
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
          <em>matrículas elegibles</em>
        </span>
      </button>
      )}

      {abierto ? (
        <div className="cmv2-chfp-bloque-body">
          <div className="cmv2-chfp-info" aria-label={`Radiografía de ${facLabel}`}>
            <span className="cmv2-chfp-section-eyebrow">Información de la facultad</span>
            <div className="cmv2-chfp-info-scroll">
              <FacultadRadiografiaCard fac={fac} modo="resumen" />
            </div>
          </div>
          <div
            className="cmv2-chfp-decision"
            aria-label={`Decisión de criterios para ${facLabel}`}
            data-qa-geometry-group="calc-muestra/decision-ch-facultad"
            data-qa-geometry-contract="intrinsic"
          >
            <span className="cmv2-chfp-section-eyebrow">Decisión para esta facultad</span>
            <p className="cmv2-chfp-decision-hint">
              Del filtro más general al más particular: cada criterio admite todo hasta que lo restrinjas aquí para
              esta facultad. Nada cambia el marco hasta recalcular.
            </p>
            {slotApertura}
            {/* F41 · Orden pedido por Gonzalo: el mínimo de matriculados abre la
                lista —es el primer criterio del embudo por facultad—, y
                Elegibles por CH y Composición bajan a penúltimos, justo antes
                del mayor detalle. Antes, matriculados quedaba enterrado en
                medio y el detalle uno-por-uno competía con criterios que
                todavía no se habían aplicado. */}
            {criterioEvidence && criterioCards.get("enrolled_total") ? (
              <CriterioTransversalFacultadCard
                card={criterioCards.get("enrolled_total")!}
                facKey={excKey}
                facLabel={facLabel}
                criterioEvidence={criterioEvidence}
              />
            ) : null}
            {/* Criterios generales (del más amplio al más fino) + el mínimo,
                que también recorta grueso: van antes de la bisagra. El nivel
                del curso (rango) se intercala tras la condición del curso. */}
            {generales.flatMap((variable) => {
              const card = (
                <CriterioFacultadCard
                  key={variable.id}
                  variable={variable}
                  seleccion={seleccion}
                  excKey={excKey}
                  facLabel={facLabel}
                  fac={fac}
                  exploracion={exploracion}
                  criteriosRadiografia={criteriosRadiografia}
                  radiografiaCard={criterioCards.get(variable.id) ?? null}
                  criterioEvidence={criterioEvidence}
                  onSel={(next) => onToggleVariable(variable.id, next)}
                />
              );
              if (variable.id === "condicion_curso" && rangeVariable) {
                return [
                  card,
                  <NivelFacultadCard
                    key={rangeVariable.id}
                    variable={rangeVariable}
                    seleccion={seleccion}
                    facKey={excKey}
                    facLabel={facLabel}
                    fac={fac}
                    radiografiaCard={criterioCards.get(rangeVariable.id) ?? null}
                    criterioEvidence={criterioEvidence}
                    onRango={onRango}
                  />,
                ];
              }
              return [card];
            })}
            {/* Bisagra del embudo: cuántas aulas quedan con los filtros
                generales, antes de la decisión más particular (el tipo). */}
            <p className="cmv2-chfp-bisagra" role="note">
              <strong>{fmtInt(fac.ch_elegibles)}</strong> de {fmtInt(fac.ch_total)} cursos-horario candidatos
              con estos criterios · ahora decide el <em>tipo de curso</em>
            </p>
            {sessionVar ? (
              <CriterioFacultadCard
                variable={sessionVar}
                seleccion={seleccion}
                excKey={excKey}
                facLabel={facLabel}
                fac={fac}
                exploracion={exploracion}
                criteriosRadiografia={criteriosRadiografia}
                radiografiaCard={criterioCards.get(sessionVar.id) ?? null}
                criterioEvidence={criterioEvidence}
                onSel={(next) => onToggleVariable(sessionVar.id, next)}
              />
            ) : null}
            {/* Criterio final y más granular: la lista de cursos-horario que
                sobreviven en esta facultad, todos activos por defecto. */}
            <MinFacultadCard
              seleccion={seleccion}
              minKey={minKey}
              fac={fac}
              umbralGeneral={umbralGeneral}
              tasa={tasa}
              radiografiaCard={criterioCards.get("minEligible") ?? null}
              criterioEvidence={criterioEvidence}
              onMinimoFacultad={onMinimoFacultad}
            />
            {criterioEvidence && criterioCards.get("composition") ? (
              <CriterioTransversalFacultadCard
                card={criterioCards.get("composition")!}
                facKey={excKey}
                facLabel={facLabel}
                criterioEvidence={criterioEvidence}
              />
            ) : null}
            {slotCierre}
            <AulasFinalesCard
              aulas={aulasFinales}
              seleccion={seleccion}
              facLabel={facLabel}
              onToggle={onToggleAula}
              onReactivarTodas={onReactivarAulas}
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}
