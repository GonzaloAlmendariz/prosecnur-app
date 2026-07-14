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
import { useMemo } from "react";
import { Check, Grid3X3, RotateCcw } from "lucide-react";
import type { CalcMuestraAulasState, CalcMuestraComponente } from "../../../../api/client";
import { EmptyState } from "../../../../components/States";
import { fmtDec, fmtInt, fmtPct, rowsFrom, safeNumber } from "../../sharedCore";
import { useMotorStore } from "../../motor/store";
import { UNIVERSITY_FACULTY_COMPONENT_ID } from "../shared/constants";
import { classroomRowNumber, classroomRowText, compareUniversityFacultyLabels, normalizeUniversityLabel } from "../shared/format";
import { hasUsefulResult, universityDistributionRows } from "../shared/study";
import { Stepper } from "./Stepper";
import {
  construirCursosHorarioModelo,
  cursosHorarioFinalMap,
  type CursosHorarioEntradaFacultad,
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

/** Agrega el marco de cursos-horario por facultad (conteos y tamaños de CH). */
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

export function CalculoCursosHorarioFacultadTab({
  componentes,
  aulasState,
}: {
  componentes: [CalcMuestraComponente, CalcMuestraComponente];
  aulasState: CalcMuestraAulasState | null;
}) {
  const base = useMotorStore((s) => s.decisiones.cursosHorarioBase);
  const setBase = useMotorStore((s) => s.setCursosHorarioBase);
  const extraPorFacultad = useMotorStore((s) => s.decisiones.aulasExtraPorFacultad);
  const setExtra = useMotorStore((s) => s.setAulaExtraFacultad);
  const confirmado = useMotorStore((s) => s.decisiones.cursosHorarioConfirmado);
  const confirmar = useMotorStore((s) => s.confirmarCursosHorario);

  const cuotasComp =
    componentes.find(
      (comp) => comp.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID && (comp.resultado?.distribucion_estratos ?? []).length,
    ) ??
    componentes.find((comp) => (comp.resultado?.distribucion_estratos ?? []).length) ??
    null;
  const calculado = componentes.some(hasUsefulResult);

  const frameFacultades = useMemo(() => frameCursosHorarioPorFacultad(aulasState), [aulasState]);

  const modelo = useMemo(() => {
    const cuotas = cuotasComp ? universityDistributionRows(cuotasComp) : [];
    const entradas: CursosHorarioEntradaFacultad[] = cuotas.map((row) => {
      const frame = frameFacultades.get(normalizeUniversityLabel(row.facultad));
      return {
        facultad: row.facultad,
        cuota: safeNumber(row.n, 0),
        estAulaMediana: frame?.medianaElegibles ?? null,
        estAulaMedia: frame?.mediaElegibles ?? null,
        chMarcoElegible: frame?.elegible ?? null,
        chTotal: frame?.total ?? null,
        extra: safeNumber(extraPorFacultad[row.facultad], 0),
      };
    });
    entradas.sort((a, b) => compareUniversityFacultyLabels(a.facultad, b.facultad));
    return construirCursosHorarioModelo(entradas, base);
  }, [base, cuotasComp, extraPorFacultad, frameFacultades]);

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

  return (
    <div className="cmv2-calc-stack">
      <section className="cmv2-panel cmv2-ch-panel">
        <div className="cmv2-panel-head">
          <strong>Cursos-horario por facultad</strong>
          <div className="cmv2-panel-head-actions">
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
        <p className="cmv2-calc-diseno-nota">
          <Grid3X3 size={13} aria-hidden="true" />
          Alumnos por curso-horario = <strong>mínimo entre la media y la mediana</strong> de elegibles por CH del marco.
          CH necesarios = ⌈cuota ÷ alumnos-por-CH⌉. La base seleccionada ({base === "total" ? "total de CH" : "CH del marco elegible"})
          es el inventario contra el que se contrasta el uso.
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

        <div className="cmv2-table-wrap">
          <table className="cmv2-table cmv2-table--university cmv2-ch-tabla">
            <thead>
              <tr>
                <th>Facultad</th>
                <th>Alumnos/CH</th>
                <th>Cuota</th>
                <th>CH necesarios</th>
                <th>{base === "total" ? "CH totales" : "CH elegibles"}</th>
                <th>Extra</th>
                <th>CH definitivos</th>
              </tr>
            </thead>
            <tbody>
              {modelo.filas.map((fila) => (
                <tr key={fila.facultad} data-incompleta={fila.alumnosPorCH == null || undefined}>
                  <td><strong>{fila.facultad}</strong></td>
                  <td>{fila.alumnosPorCH != null ? fmtDec(fila.alumnosPorCH, 1) : "—"}</td>
                  <td>{fmtInt(fila.cuota)}</td>
                  <td>{fila.chNecesarios != null ? fmtInt(fila.chNecesarios) : "—"}</td>
                  <td>{fila.chBase != null ? fmtInt(fila.chBase) : "—"}</td>
                  <td>
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

      <div className="cmv2-calc-confirm-bar" role="region" aria-label="Confirmar plan de cursos-horario">
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
