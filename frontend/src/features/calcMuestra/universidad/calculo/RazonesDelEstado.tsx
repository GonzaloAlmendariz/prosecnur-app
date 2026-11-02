import type { CalcMuestraDistribucionI19State } from "../../../../api/calcMuestraDistribucionI19";

type EstadoNoListo = Exclude<CalcMuestraDistribucionI19State, { kind: "ready" }>;

/**
 * El estado nombra una decisión de Marco que falta confirmar: «Alumnos por CH».
 * El aviso decía dónde ir y no llevaba (Gonzalo, 2026-11-01): con esa razón del
 * motor —y sólo con ella— la lista de razones termina en el enlace.
 */
export function pideConfirmarAlumnosPorCh(state: EstadoNoListo): boolean {
  return state.kind === "invalid" && (state.backend_reasons ?? []).some((reason) => reason.code === "source_frame_hash_missing");
}

/**
 * Las razones del estado, una por línea, y al final el enlace a Marco › Alumnos
 * por CH cuando la razón es esa decisión sin confirmar.
 */
export function RazonesDelEstado({ state, onIrAAlumnosPorCh }: { state: EstadoNoListo; onIrAAlumnosPorCh?: () => void }) {
  return (
    <>
      <ul className="cmv2-dist-state-reasons" aria-label="Razones del estado" data-qa-geometry-member>
        {state.reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
      {onIrAAlumnosPorCh && pideConfirmarAlumnosPorCh(state) ? (
        <button type="button" className="cmv2-ghost" data-qa-geometry-member onClick={onIrAAlumnosPorCh}>
          Ir a Alumnos por CH
        </button>
      ) : null}
    </>
  );
}
