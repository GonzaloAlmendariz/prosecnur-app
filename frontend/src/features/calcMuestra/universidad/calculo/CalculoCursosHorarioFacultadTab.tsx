/**
 * Pestaña «Cursos-horario por facultad» de Cálculo (id calculo-cursos-horario).
 *
 * Cierra el puente entre la cuota calculada y el plan operativo de cursos-horario:
 *   a) el criterio de alumnos por CH es el MÍNIMO entre media y mediana de
 *      elegibles por curso-horario del marco depurado (aula_frame),
 *   b) lo muestra por facultad,
 *   c) deriva los CH necesarios = ceil(cuota / alumnos-por-CH),
 *   d) permite elegir la base de referencia: total de CH o CH del marco elegible,
 *   e) un stepper por facultad agrega 0/1/2 CH operativos (persistidos en el
 *      motor_recorrido: decisiones.aulasExtraPorFacultad),
 *   f) confirma el plan definitivo y lo entrega en tabla y gráfico; ese plan es
 *      la fuente que reutiliza el gráfico de Distribución (§5.4).
 */
import { useMemo, useState } from "react";
import { AlertTriangle, Check, Grid3X3, Minus, Plus, RotateCcw } from "lucide-react";
import type { CalcMuestraAulasState, CalcMuestraComponente } from "../../../../api/client";
import { EmptyState } from "../../../../components/States";
import { facultadesDesdeFrame, type FacultadDatos, type ResumenEstAula } from "../../dominio";
import { fmtDec, fmtInt, fmtPct, rowsFrom, safeNumber } from "../../sharedCore";
import { useMotorStore } from "../../store";
import { AvisoModulo } from "../shared/AvisoModulo";
import { UNIVERSITY_FACULTY_COMPONENT_ID, UNIVERSITY_TOTAL_COMPONENT_ID } from "../shared/constants";
import { classroomRowNumber, classroomRowText, compareUniversityFacultyLabels, normalizeUniversityLabel } from "../shared/format";
import { hasUsefulResult, universityDistributionRows } from "../shared/study";
import { MetodoEstAulaSelector } from "./MetodoEstAulaSelector";
import { METODOS_EST_AULA } from "./estAulaMetodo";
import { Stepper } from "./Stepper";
import {
  construirCursosHorarioModelo,
  cursosHorarioFinalMap,
  type CursosHorarioEntradaFacultad,
  type CursosHorarioFilaFacultad,
} from "./cursosHorarioModel";
import "./calculo.css";

const FACULTY_KEYS = ["faculty", "facultad", "unidad_academica", "escuela", "stratum", "unidad"];
const ELEGIBLES_KEYS = ["eligible_n", "elegibles", "n_elegibles", "students_n", "matriculados_poblacion", "enrolled_total", "total"];
const INCLUDED_KEYS = ["included", "incluida", "eligible", "elegible", "en_marco"];

function esIncluida(row: Record<string, unknown>): boolean {
  for (const key of INCLUDED_KEYS) {
    const value = row[key];
    if (value === undefined) continue;
    if (typeof value === "boolean") return value;
    const text = String(value).trim().toLowerCase();
    if (["true", "1", "sí", "si", "yes"].includes(text)) return true;
    if (["false", "0", "no"].includes(text)) return false;
  }
  return true; // sin bandera: el frame ya viene depurado, todo cuenta.
}

/** Mediana de una lista no vacía (ordena una copia). */
function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(orden.length / 2);
  return orden.length % 2 === 0 ? (orden[mitad - 1] + orden[mitad]) / 2 : orden[mitad];
}

type FrameFacultad = { total: number; elegible: number; medianaElegibles: number | null; mediaElegibles: number | null };

/** Agrega el marco de cursos-horario por facultad. El tamaño típico de CH
 *  (min media/mediana de elegibles por CH) se calcula SIEMPRE sobre el marco
 *  depurado (elegible), como en el método canónico (§2.2b): incluir los CH
 *  excluidos —muchos con 1-2 elegibles— colapsaría el divisor e inflaría las
 *  aulas. La base seleccionable solo cambia el inventario contra el que se
 *  contrasta el uso (total de CH vs. CH del marco), no el divisor. */
function frameCursosHorarioPorFacultad(aulasState: CalcMuestraAulasState | null): Map<string, FrameFacultad> {
  const filas = rowsFrom<Record<string, unknown>>(aulasState?.frame?.aula_frame);
  const acc = new Map<string, { total: number; elegible: number; tamanos: number[] }>();
  for (const fila of filas) {
    const facultad = classroomRowText(fila, FACULTY_KEYS);
    if (!facultad) continue;
    const clave = normalizeUniversityLabel(facultad);
    const bucket = acc.get(clave) ?? { total: 0, elegible: 0, tamanos: [] };
    bucket.total += 1;
    if (esIncluida(fila)) {
      bucket.elegible += 1;
      const tam = classroomRowNumber(fila, ELEGIBLES_KEYS);
      if (Number.isFinite(tam) && tam > 0) bucket.tamanos.push(tam);
    }
    acc.set(clave, bucket);
  }
  const salida = new Map<string, FrameFacultad>();
  for (const [clave, bucket] of acc) {
    salida.set(clave, {
      total: bucket.total,
      elegible: bucket.elegible,
      medianaElegibles: mediana(bucket.tamanos),
      mediaElegibles: bucket.tamanos.length
        ? Math.round((bucket.tamanos.reduce((s, v) => s + v, 0) / bucket.tamanos.length) * 10) / 10
        : null,
    });
  }
  return salida;
}

/** Valor de referencia de una fila según el método (positivo o null). */
function valorReferencia(fila: CursosHorarioFilaFacultad, metodo: ResumenEstAula): number | null {
  if (metodo === "mediana") return fila.refMediana;
  if (metodo === "media") return fila.refMedia;
  if (metodo === "li_bootstrap") return fila.refLo95;
  return fila.refMin;
}

/**
 * Celda de una columna de referencia. Resalta si su método es el activo; en la
 * columna LI 95% de una facultad chica muestra un badge que explica por qué el
 * bootstrap no es fiable (y por qué, si el método elegido es LI, esa facultad
 * cayó a mín(mediana, media) — visible en la columna «En uso»).
 */
function ReferenciaCelda({
  fila,
  metodo,
  activo,
}: {
  fila: CursosHorarioFilaFacultad;
  metodo: ResumenEstAula;
  activo: boolean;
}) {
  const valor = valorReferencia(fila, metodo);
  const esLi = metodo === "li_bootstrap";
  const badgeLi = esLi && !fila.li95Fiable;
  return (
    <td className="cmv2-ch-td-ref" data-enuso={activo || undefined}>
      {valor != null ? (
        fmtDec(valor, 1)
      ) : badgeLi ? (
        <span
          className="cmv2-ch-li-badge"
          title={`IC poco fiable — pocas aulas (${fila.nCh != null ? fmtInt(fila.nCh) : "<15"} CH). Esta facultad usa mín(mediana, media).`}
        >
          <AlertTriangle size={12} aria-hidden="true" />
          IC no fiable
        </span>
      ) : (
        "—"
      )}
    </td>
  );
}

export function CalculoCursosHorarioFacultadTab({
  componentes,
  aulasState,
  marcoDesactualizado = false,
}: {
  componentes: [CalcMuestraComponente, CalcMuestraComponente];
  aulasState: CalcMuestraAulasState | null;
  /** true si los criterios cambiaron desde que se construyó el marco: el # de CH
   *  (y el # de aulas) puede estar stale hasta reconstruir en Marco → Criterios. */
  marcoDesactualizado?: boolean;
}) {
  const base = useMotorStore((s) => s.decisiones.cursosHorarioBase);
  const setBase = useMotorStore((s) => s.setCursosHorarioBase);
  const extraPorFacultad = useMotorStore((s) => s.decisiones.aulasExtraPorFacultad);
  const setExtra = useMotorStore((s) => s.setAulaExtraFacultad);
  const confirmado = useMotorStore((s) => s.decisiones.cursosHorarioConfirmado);
  const confirmar = useMotorStore((s) => s.confirmarCursosHorario);
  // Método GLOBAL del divisor de estudiantes-por-aula (vive en el perfil).
  const resumen = useMotorStore((s) => s.perfil.resumenEstAula);
  const setResumen = useMotorStore((s) => s.setResumenEstAula);

  // Propuesta cuyas cuotas dimensionan las aulas: P1 (total universidad,
  // conglomerado) o P2 (por facultad, estratificado). Cada una da su propio
  // plan de aulas; el usuario elige cuál llevar a campo.
  const [propuesta, setPropuesta] = useState<1 | 2>(1);
  const withDistribucion = (comp: CalcMuestraComponente | undefined) =>
    comp && (comp.resultado?.distribucion_estratos ?? []).length ? comp : null;
  const compTotal = componentes.find((c) => c.actor_id === UNIVERSITY_TOTAL_COMPONENT_ID) ?? componentes[0];
  const compFacultad = componentes.find((c) => c.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID) ?? componentes[1];
  const cuotasComp =
    (propuesta === 1 ? withDistribucion(compTotal) : withDistribucion(compFacultad)) ??
    withDistribucion(compFacultad) ??
    withDistribucion(compTotal) ??
    null;
  const calculado = componentes.some(hasUsefulResult);

  const frameFacultades = useMemo(() => frameCursosHorarioPorFacultad(aulasState), [aulasState]);
  // Agregado del backend R por facultad: el IC 95% del bootstrap (est_aula_lo95)
  // solo puede venir de aquí. También trae mediana/media, que se prefieren para
  // que las referencias y la cota inferior salgan del MISMO cálculo. Frames sin
  // perfil: mapa vacío → se cae a la mediana/media recomputadas del aula_frame y
  // el LI 95% queda no disponible.
  const facultadesR = useMemo(() => {
    const mapa = new Map<string, FacultadDatos>();
    for (const f of facultadesDesdeFrame(aulasState?.frame ?? null)) {
      mapa.set(normalizeUniversityLabel(f.nombre), f);
    }
    return mapa;
  }, [aulasState]);

  const modelo = useMemo(() => {
    const cuotas = cuotasComp ? universityDistributionRows(cuotasComp) : [];
    // El divisor de aulas es la SOBREMUESTRA por facultad (n × factor), no la
    // cuota neta (método canónico §2.3: aulas = ⌈sobremuestra / est_aula⌉). El
    // factor es el que aplicó el motor: n_operativo / n_objetivo del resultado.
    const nObj = safeNumber(cuotasComp?.resultado?.n_objetivo, 0);
    const nOper = safeNumber(cuotasComp?.resultado?.n_operativo, 0);
    const factorSobremuestra = nObj > 0 && nOper > 0 ? nOper / nObj : 1;
    const entradas: CursosHorarioEntradaFacultad[] = cuotas.map((row) => {
      const clave = normalizeUniversityLabel(row.facultad);
      const frame = frameFacultades.get(clave);
      const rem = facultadesR.get(clave) ?? null;
      const cuota = safeNumber(row.n, 0);
      return {
        facultad: row.facultad,
        cuota,
        sobremuestra: Math.round(cuota * factorSobremuestra),
        estAulaMediana: rem?.estAulaMediana ?? frame?.medianaElegibles ?? null,
        estAulaMedia: rem?.estAulaMedia ?? frame?.mediaElegibles ?? null,
        estAulaLo95: rem?.estAulaLo95 ?? null,
        estAulaNCh: rem?.estAulaNCh ?? frame?.elegible ?? null,
        chMarcoElegible: frame?.elegible ?? null,
        chTotal: frame?.total ?? null,
        extra: safeNumber(extraPorFacultad[row.facultad], 0),
      };
    });
    entradas.sort((a, b) => compareUniversityFacultyLabels(a.facultad, b.facultad));
    return construirCursosHorarioModelo(entradas, base, resumen);
  }, [base, cuotasComp, extraPorFacultad, frameFacultades, facultadesR, resumen]);

  if (!calculado || !cuotasComp) {
    return (
      <div className="cmv2-calc-stack">
        <EmptyState
          icon={<Grid3X3 size={20} />}
          title="El plan de cursos-horario aparece con la muestra calculada"
          hint="Ejecuta Calcular muestra en Propuestas: con las cuotas por facultad se derivan los cursos-horario necesarios."
        />
      </div>
    );
  }

  const maxFinal = Math.max(1, ...modelo.filas.map((f) => f.chFinal ?? 0));
  const planIgualConfirmado = confirmado;

  // Bulk de la columna Extra: aplica un delta de CH extra a TODAS las facultades
  // visibles del modelo. El store (setAulaExtraFacultad) ya limita a [0, 2], así
  // que basta iterar y sumar/restar; el clamp se respeta por facultad.
  const aplicarExtraBulk = (delta: number) => {
    for (const fila of modelo.filas) {
      setExtra(fila.facultad, safeNumber(extraPorFacultad[fila.facultad], 0) + delta);
    }
  };
  const extraBulkPuedeBajar = modelo.filas.some((f) => safeNumber(extraPorFacultad[f.facultad], 0) > 0);
  const extraBulkPuedeSubir = modelo.filas.some((f) => safeNumber(extraPorFacultad[f.facultad], 0) < 2);

  return (
    <div className="cmv2-calc-stack" data-marco-stale={marcoDesactualizado || undefined}>
      {marcoDesactualizado && (
        <AvisoModulo tone="warn" role="status">
          Los criterios cambiaron desde que se construyó el marco: el número de
          cursos-horario elegibles —y con él el de aulas— puede haber cambiado.
          Recalcula el marco en <strong>Marco → Criterios</strong> para números al día.
        </AvisoModulo>
      )}
      <section className="cmv2-panel cmv2-ch-panel">
        <div className="cmv2-panel-head">
          <strong>Cursos-horario por facultad</strong>
          <div className="cmv2-panel-head-actions">
            <div className="cmv2-segment" role="radiogroup" aria-label="Propuesta que dimensiona las aulas">
              <button type="button" role="radio" aria-checked={propuesta === 1} data-active={propuesta === 1 || undefined} onClick={() => setPropuesta(1)}>
                Propuesta 1
              </button>
              <button type="button" role="radio" aria-checked={propuesta === 2} data-active={propuesta === 2 || undefined} onClick={() => setPropuesta(2)}>
                Propuesta 2
              </button>
            </div>
            <div className="cmv2-segment" role="radiogroup" aria-label="Base de cálculo de cursos-horario">
              <button type="button" role="radio" aria-checked={base === "elegible"} data-active={base === "elegible" || undefined} onClick={() => setBase("elegible")}>
                CH del marco elegible
              </button>
              <button type="button" role="radio" aria-checked={base === "total"} data-active={base === "total" || undefined} onClick={() => setBase("total")}>
                Total de CH
              </button>
            </div>
          </div>
        </div>
        <MetodoEstAulaSelector value={resumen} onChange={setResumen} />

        <p className="cmv2-calc-diseno-nota">
          <Grid3X3 size={13} aria-hidden="true" />
          Alumnos por curso-horario = el valor del <strong>método elegido</strong> de elegibles por CH del marco depurado
          (siempre sobre el marco elegible). CH necesarios = ⌈<strong>sobremuestra</strong> ÷ alumnos-por-CH⌉ — la
          sobremuestra (no la cuota neta) cubre no-respuesta y ausencias. Un divisor más chico ⇒ más aulas. La base seleccionada
          ({base === "total" ? "total de CH" : "CH del marco elegible"}) es solo el inventario contra el que se contrasta el uso.
        </p>

        <div className="cmv2-ch-kpis">
          <div className="cmv2-ch-kpi"><span>{fmtInt(modelo.totalCuota)}</span><small>encuestas objetivo</small></div>
          <div className="cmv2-ch-kpi"><span>{fmtInt(modelo.totalNecesarios)}</span><small>CH necesarios</small></div>
          <div className="cmv2-ch-kpi"><span>+{fmtInt(modelo.totalExtra)}</span><small>CH extra operativos</small></div>
          <div className="cmv2-ch-kpi cmv2-ch-kpi--hero"><span>{fmtInt(modelo.totalFinal)}</span><small>CH definitivos</small></div>
          {modelo.totalBase != null && (
            <div className="cmv2-ch-kpi"><span>{fmtInt(modelo.totalBase)}</span><small>{base === "total" ? "CH en la base" : "CH elegibles"}</small></div>
          )}
        </div>

        <div className="cmv2-table-wrap cmv2-ch-tabla-wrap">
          <table className="cmv2-table cmv2-table--university cmv2-ch-tabla">
            <thead>
              <tr>
                <th>Facultad</th>
                {METODOS_EST_AULA.map((metodo) => (
                  <th
                    key={metodo.id}
                    className="cmv2-ch-th-ref"
                    data-enuso={metodo.id === resumen || undefined}
                    title={metodo.ayuda}
                  >
                    {metodo.columna}
                  </th>
                ))}
                <th className="cmv2-ch-th-enuso" title="Divisor efectivamente aplicado (el del método elegido)">En uso</th>
                <th>Cuota</th>
                <th>Sobremuestra</th>
                <th className="cmv2-ch-th-enuso" title="Aulas resultantes = ⌈sobremuestra ÷ divisor en uso⌉">CH necesarios</th>
                <th>{base === "total" ? "CH totales" : "CH elegibles"}</th>
                <th className="cmv2-ch-th-extra-cell">
                  <div className="cmv2-ch-th-extra">
                    <span>Extra</span>
                    <div className="cmv2-stepper cmv2-ch-th-bulk" role="group" aria-label="Aplicar CH extra a todas las facultades">
                      <button
                        type="button"
                        className="cmv2-stepper-btn"
                        aria-label="Quitar un curso-horario extra a todas las facultades"
                        disabled={!extraBulkPuedeBajar}
                        onClick={() => aplicarExtraBulk(-1)}
                      >
                        <Minus size={13} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="cmv2-stepper-btn"
                        aria-label="Añadir un curso-horario extra a todas las facultades"
                        disabled={!extraBulkPuedeSubir}
                        onClick={() => aplicarExtraBulk(1)}
                      >
                        <Plus size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </th>
                <th>CH definitivos</th>
              </tr>
            </thead>
            <tbody>
              {modelo.filas.map((fila) => (
                <tr key={fila.facultad} data-incompleta={fila.alumnosPorCH == null || undefined}>
                  <td><strong>{fila.facultad}</strong></td>
                  {METODOS_EST_AULA.map((metodo) => (
                    <ReferenciaCelda key={metodo.id} fila={fila} metodo={metodo.id} activo={metodo.id === resumen} />
                  ))}
                  <td className="cmv2-ch-td-enuso">
                    <strong>{fila.alumnosPorCH != null ? fmtDec(fila.alumnosPorCH, 1) : "—"}</strong>
                  </td>
                  <td>{fmtInt(fila.cuota)}</td>
                  <td>{fmtInt(fila.sobremuestra)}</td>
                  <td className="cmv2-ch-td-enuso"><strong>{fila.chNecesarios != null ? fmtInt(fila.chNecesarios) : "—"}</strong></td>
                  <td>{fila.chBase != null ? fmtInt(fila.chBase) : "—"}</td>
                  <td className="cmv2-ch-td-extra">
                    <Stepper
                      value={safeNumber(extraPorFacultad[fila.facultad], 0)}
                      onChange={(v) => setExtra(fila.facultad, v)}
                      ariaLabel={`Cursos-horario extra para ${fila.facultad}`}
                    />
                  </td>
                  <td className="cmv2-ch-tabla-final"><strong>{fila.chFinal != null ? fmtInt(fila.chFinal) : "—"}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cmv2-panel cmv2-ch-panel">
        <div className="cmv2-panel-head">
          <strong>Cursos-horario definitivos por facultad</strong>
          {modelo.totalBase != null && (
            <span className="cmv2-pill-soft">uso del marco: {fmtPct(modelo.totalBase > 0 ? modelo.totalFinal / modelo.totalBase : null)}</span>
          )}
        </div>
        <div className="cmv2-ch-chart" role="table" aria-label="Cursos-horario definitivos por facultad">
          {modelo.filas.map((fila) => {
            const necesarios = fila.chNecesarios ?? 0;
            const extra = fila.extra;
            const final = fila.chFinal ?? 0;
            return (
              <div key={fila.facultad} className="cmv2-ch-chart-fila" role="row">
                <span className="cmv2-ch-chart-nombre" role="rowheader">{fila.facultad}</span>
                <span className="cmv2-ch-chart-pista" aria-hidden="true">
                  <span className="cmv2-ch-chart-barra cmv2-ch-chart-barra--nec" style={{ width: `${(necesarios / maxFinal) * 100}%` }} />
                  {extra > 0 && <span className="cmv2-ch-chart-barra cmv2-ch-chart-barra--extra" style={{ width: `${(extra / maxFinal) * 100}%` }} />}
                </span>
                <span className="cmv2-ch-chart-valor" role="cell">{fmtInt(final)}</span>
              </div>
            );
          })}
        </div>
        <div className="cmv2-ch-leyenda" aria-hidden="true">
          <span><i className="cmv2-ch-dot cmv2-ch-dot--nec" /> CH necesarios</span>
          <span><i className="cmv2-ch-dot cmv2-ch-dot--extra" /> CH extra operativos</span>
        </div>
      </section>

      <div className="cmv2-calc-confirm-bar cmv2-calc-confirm-bar--flujo" role="region" aria-label="Confirmar plan de cursos-horario">
        <div className="cmv2-calc-confirm-copy">
          <strong>{planIgualConfirmado ? "Plan de cursos-horario confirmado" : "Plan de cursos-horario sin confirmar"}</strong>
          <span>
            {fmtInt(modelo.totalFinal)} cursos-horario definitivos ({fmtInt(modelo.totalNecesarios)} necesarios + {fmtInt(modelo.totalExtra)} extra).
            {modelo.completo ? "" : " Falta medida de alumnos por CH en alguna facultad."}
          </span>
        </div>
        <div className="cmv2-inline-actions">
          {planIgualConfirmado && (
            <button type="button" className="cmv2-ghost" onClick={() => confirmar(null)}>
              <RotateCcw size={13} aria-hidden="true" /> Reabrir
            </button>
          )}
          <button
            type="button"
            className="cmv2-primary"
            disabled={!modelo.completo || planIgualConfirmado}
            onClick={() => confirmar(cursosHorarioFinalMap(modelo))}
          >
            <Check size={13} aria-hidden="true" /> Confirmar plan
          </button>
        </div>
      </div>
    </div>
  );
}
