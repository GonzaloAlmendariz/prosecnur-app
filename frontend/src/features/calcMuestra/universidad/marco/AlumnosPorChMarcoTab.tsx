import { useEffect, useMemo, useState } from "react";
import { BarChart3, Check, RotateCcw } from "../../../../vendor/lucide-react";
import type { CalcMuestraAulasState, CalcMuestraWorkspace } from "../../../../api/client";
import {
  alumnosPorChValue,
  normalizeCalcMuestraAlumnosPorCh,
  normalizeCalcMuestraAlumnosPorChDecision,
  type CalcMuestraAlumnosPorChDecision,
  type CalcMuestraAlumnosPorChMethod,
} from "../../../../api/calcMuestraAlumnosPorCh";
import { fmtDec, fmtInt } from "../../sharedCore";
import { AvisoModulo } from "../shared/AvisoModulo";
import {
  ALUMNOS_POR_CH_METHODS,
  alumnosPorChDraftMatchesDecision,
  effectiveAlumnosPorChMethod,
  missingAlumnosPorChFaculties,
  normalizeAlumnosPorChOverrides,
} from "./alumnosPorChDecisionModel";
import {
  alumnosPorChDominio,
  AlumnosPorChTira,
  AlumnosPorChTiraLeyenda,
} from "./AlumnosPorChTira";
import "./alumnosPorCh.css";

function metric(value: number | null): string {
  return value === null ? "—" : fmtDec(value, 1);
}

export function AlumnosPorChMarcoTab({
  workspace,
  aulasState,
  onConfirmDecision,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  onConfirmDecision: (decision: CalcMuestraAlumnosPorChDecision) => void;
}) {
  const frameHash = aulasState?.frame?.frame_hash ?? "";
  const rawSnapshot = aulasState?.frame?.alumnos_por_ch ?? null;
  const normalizedSnapshot = useMemo(
    () => normalizeCalcMuestraAlumnosPorCh(rawSnapshot),
    [rawSnapshot],
  );
  const snapshot = normalizedSnapshot?.frame_hash === frameHash ? normalizedSnapshot : null;
  const decision = useMemo(
    () => normalizeCalcMuestraAlumnosPorChDecision(workspace.aulas_config?.alumnos_por_ch_decision),
    [workspace.aulas_config?.alumnos_por_ch_decision],
  );
  const [defaultMethod, setDefaultMethod] = useState<CalcMuestraAlumnosPorChMethod>(
    decision?.estadistico_default ?? "p25",
  );
  const [overrides, setOverrides] = useState<Record<string, CalcMuestraAlumnosPorChMethod>>(
    decision?.por_facultad ?? {},
  );

  useEffect(() => {
    setDefaultMethod(decision?.estadistico_default ?? "p25");
    setOverrides(decision?.por_facultad ?? {});
  }, [decision]);

  if (!snapshot) {
    return (
      <section
        className="cmv2-panel cmv2-alumnos-ch"
        aria-labelledby="cmv2-alumnos-ch-title"
        data-audit-ready="false"
        data-qa-geometry-group="calc-muestra/alumnos-por-ch"
        data-qa-geometry-contract="intrinsic"
      >
        <header className="cmv2-alumnos-ch-head">
          <span aria-hidden="true"><BarChart3 size={18} /></span>
          <div><small>Decisión del marco</small><h3 id="cmv2-alumnos-ch-title">Alumnos por CH</h3></div>
        </header>
        <AvisoModulo tone={rawSnapshot ? "warn" : "info"} role="status">
          {rawSnapshot
            ? "La distribución no acredita todas las unidades o pertenece a otro frame. Reconstruye el marco; no se aplicará ningún fallback en React."
            : "Reconstruye el marco para obtener media, P25 y mediana por facultad antes de elegir el valor de alumnos por CH."}
        </AvisoModulo>
      </section>
    );
  }

  const missing = missingAlumnosPorChFaculties(snapshot, defaultMethod, overrides);
  const current = alumnosPorChDraftMatchesDecision(
    snapshot,
    decision,
    defaultMethod,
    overrides,
  );
  const stale = Boolean(decision && decision.frame_hash !== snapshot.frame_hash);
  const rows = [
    ...snapshot.filas.filter((row) => row.row_kind === "total"),
    ...snapshot.filas.filter((row) => row.row_kind === "faculty"),
  ];
  // S4: una sola escala para las 18 filas. Sin dominio común, dos facultades
  // con distribuciones distintas dibujarían la misma tira.
  const dominioTira = alumnosPorChDominio(rows.map((row) => row.elegible.distribution));
  // El Total es la referencia contra la que se lee cada facultad.
  const referenciaTira = rows.find((row) => row.row_kind === "total")?.elegible.distribution.p50 ?? null;

  function setOverride(facultyKey: string, rawMethod: string) {
    setOverrides((previous) => {
      const next = { ...previous };
      if (!rawMethod) delete next[facultyKey];
      else next[facultyKey] = rawMethod as CalcMuestraAlumnosPorChMethod;
      return next;
    });
  }

  return (
    <div
      className="cmv2-alumnos-ch-stack"
      data-audit-ready={current ? "true" : "false"}
      data-surface-group="calc-muestra-marco"
      data-surface-contract="decision-alumnos-por-ch"
      data-qa-geometry-group="calc-muestra/alumnos-por-ch"
      data-qa-geometry-contract="intrinsic"
    >
      <section className="cmv2-panel cmv2-alumnos-ch">
        <header className="cmv2-alumnos-ch-head">
          <span aria-hidden="true"><BarChart3 size={18} /></span>
          <div>
            <small>Decisión del marco</small>
            <h3 id="cmv2-alumnos-ch-title">Alumnos por CH</h3>
            {/* S3: la tabla ya rotula «marco elegible» y «contraste», y la
                procedencia R vive en el aviso de estado. La intro solo
                parafraseaba lo que la propia superficie muestra. */}
            <p>El estadístico se elige viendo la distribución de la que sale.</p>
          </div>
        </header>

        <div className="cmv2-alumnos-ch-method" role="radiogroup" aria-label="Método global de alumnos por CH">
          {ALUMNOS_POR_CH_METHODS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={defaultMethod === item.id}
              data-active={defaultMethod === item.id || undefined}
              onClick={() => setDefaultMethod(item.id)}
            >
              <span>{item.label}{item.id === "p25" ? <em>Recomendado</em> : null}</span>
              <small>{item.detail}</small>
            </button>
          ))}
        </div>

        <AvisoModulo tone={stale ? "warn" : current ? "success" : "info"} role="status" compact>
          {stale
            ? "La decisión guardada firma otro frame. Revísala y confirma de nuevo para invalidar y recalcular los resultados dependientes."
            : current
              ? `Decisión confirmada para el frame ${snapshot.frame_hash.slice(0, 10)}.`
              : "La propuesta aún no está confirmada. P25 es la recomendación provisional por su lectura conservadora."}
        </AvisoModulo>

        <AlumnosPorChTiraLeyenda dominio={dominioTira} />

        <div className="cmv2-alumnos-ch-scroll" tabIndex={0} aria-label="Distribución y decisión por facultad">
          <table className="cmv2-alumnos-ch-table">
            <thead>
              <tr>
                <th scope="col">Facultad</th>
                <th scope="col">CH elegibles</th>
                <th scope="col">Distribución del marco elegible</th>
                <th scope="col">Todos los CH · contraste</th>
                <th scope="col">Método aplicado</th>
                <th scope="col">Valor elegido</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const selectedMethod = row.row_kind === "total"
                  ? defaultMethod
                  : effectiveAlumnosPorChMethod(row.faculty_key, defaultMethod, overrides);
                const selectedValue = alumnosPorChValue(row.elegible, selectedMethod);
                return (
                  <tr key={row.faculty_key} data-row-kind={row.row_kind}>
                    <th scope="row">{row.faculty_label}</th>
                    <td><strong>{fmtInt(row.elegible.n_ch)}</strong><small>{row.elegible.n_matriculas_elegibles == null ? "Sin dato completo" : `${fmtInt(row.elegible.n_matriculas_elegibles)} matrículas`}</small></td>
                    <td className="cmv2-alumnos-ch-dist" data-recommended="true">
                      <AlumnosPorChTira
                        label={row.faculty_label}
                        p25={row.elegible.distribution.p25}
                        p50={row.elegible.distribution.p50}
                        media={row.elegible.distribution.media}
                        dominio={dominioTira}
                        referencia={referenciaTira}
                      />
                    </td>
                    <td>
                      <strong>{fmtInt(row.contraste_total.n_ch)} CH</strong>
                      <small>
                        {metric(row.contraste_total.distribution.p25)} / {metric(row.contraste_total.distribution.p50)} / {metric(row.contraste_total.distribution.media)}
                      </small>
                    </td>
                    <td>
                      {row.row_kind === "total" ? (
                        <span>{ALUMNOS_POR_CH_METHODS.find((item) => item.id === defaultMethod)?.label}</span>
                      ) : (
                        <select
                          aria-label={`Método para ${row.faculty_label}`}
                          value={overrides[row.faculty_key] ?? ""}
                          onChange={(event) => setOverride(row.faculty_key, event.currentTarget.value)}
                        >
                          <option value="">Global · {ALUMNOS_POR_CH_METHODS.find((item) => item.id === defaultMethod)?.label}</option>
                          {ALUMNOS_POR_CH_METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="cmv2-alumnos-ch-selected"><strong>{metric(selectedValue)}</strong><small>{selectedMethod}</small></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="cmv2-alumnos-ch-confirm" role="region" aria-label="Confirmar decisión de alumnos por CH">
        <div>
          <strong>{current ? "Decisión vigente" : "Confirmación pendiente"}</strong>
          <span>
            {missing.length
              ? `Falta ${missing.join(", ")}: el estadístico elegido no tiene dato publicado.`
              : `${ALUMNOS_POR_CH_METHODS.find((item) => item.id === defaultMethod)?.label} global · ${Object.keys(overrides).length} overrides por facultad.`}
          </span>
        </div>
        <div className="cmv2-inline-actions">
          <button type="button" className="cmv2-ghost" onClick={() => { setDefaultMethod("p25"); setOverrides({}); }}>
            <RotateCcw size={13} aria-hidden="true" /> Restablecer P25
          </button>
          <button
            type="button"
            className="cmv2-primary"
            disabled={missing.length > 0 || current}
            onClick={() => onConfirmDecision({
              schema: "calc_muestra_alumnos_por_ch_decision_v1",
              frame_hash: snapshot.frame_hash,
              denominador: "elegible",
              estadistico_default: defaultMethod,
              por_facultad: normalizeAlumnosPorChOverrides(defaultMethod, overrides),
              confirmado_at: new Date().toISOString(),
            })}
          >
            <Check size={13} aria-hidden="true" /> Confirmar decisión
          </button>
        </div>
      </div>
    </div>
  );
}
