import { useEffect } from "react";
import { Check, Grid3X3, RotateCcw } from "../../../../vendor/lucide-react";
import type { CalcMuestraComponente } from "../../../../api/client";
import { EmptyState } from "../../../../components/States";
import { fmtDec, fmtInt } from "../../sharedCore";
import { useMotorStore } from "../../store";
import { AvisoModulo } from "../shared/AvisoModulo";
import { UNIVERSITY_FACULTY_COMPONENT_ID, UNIVERSITY_TOTAL_COMPONENT_ID } from "../shared/constants";
import type { UniversityAulasScenario } from "../shared/study";
import {
  cursosHorarioDesdeResultado,
  estadoPlanCursosHorario,
  planCursosHorarioPublicado,
} from "./cursosHorarioResultadoModel";
import "./calculo.css";

export function CalculoCursosHorarioFacultadTab({
  componentes,
  escenario,
  onEscenario,
  marcoDesactualizado = false,
}: {
  componentes: [CalcMuestraComponente, CalcMuestraComponente];
  escenario: UniversityAulasScenario;
  onEscenario: (escenario: UniversityAulasScenario) => void;
  marcoDesactualizado?: boolean;
}) {
  const actorId = escenario === "e2"
    ? UNIVERSITY_FACULTY_COMPONENT_ID
    : UNIVERSITY_TOTAL_COMPONENT_ID;
  const componente = componentes.find((item) => item.actor_id === actorId);
  const model = cursosHorarioDesdeResultado(componente?.resultado);
  const confirmado = useMotorStore((state) => state.decisiones.cursosHorarioConfirmado);
  const guardado = useMotorStore((state) => state.decisiones.cursosHorarioFinal);
  const confirmar = useMotorStore((state) => state.confirmarCursosHorario);

  const actual = model ? planCursosHorarioPublicado(model) : {};
  const estado = model
    ? estadoPlanCursosHorario({ confirmado, marcoDesactualizado, actual, guardado })
    : { vigente: false, puedeConfirmar: false };
  useEffect(() => {
    if (confirmado && !estado.vigente) confirmar(null);
  }, [confirmado, confirmar, estado.vigente]);

  if (!model) {
    return (
      <div className="cmv2-calc-stack">
        <EmptyState
          icon={<Grid3X3 size={20} />}
          title="El plan acreditado aparece al recalcular la muestra"
          hint="Confirma Alumnos por CH en Marco y ejecuta la propuesta. Esta vista no reconstruye estadísticas ni aulas en React."
        />
      </div>
    );
  }

  return (
    <div
      className="cmv2-calc-stack"
      data-marco-stale={marcoDesactualizado || undefined}
      data-surface-group="calc-muestra-calculo"
      data-surface-contract="resultado-r-alumnos-por-ch"
      data-qa-geometry-group="calc-muestra/calculo-cursos-horario"
      data-qa-geometry-contract="intrinsic"
    >
      {marcoDesactualizado && (
        <AvisoModulo tone="warn" role="status">
          El marco cambió después del cálculo. Reconfirma Alumnos por CH y recalcula antes de publicar este plan.
        </AvisoModulo>
      )}
      <section className="cmv2-panel cmv2-ch-panel">
        <div className="cmv2-panel-head">
          <div>
            <strong>Cursos-horario publicados por R</strong>
            <p className="cmv2-calc-diseno-nota">
              La decisión firmada usa {model.decision.estadistico_default} sobre el marco elegible.
              Titulares, reservas y total son cifras del resultado; esta pestaña solo las proyecta.
            </p>
          </div>
          <div className="cmv2-segment" role="radiogroup" aria-label="Propuesta que dimensiona las aulas">
            <button type="button" role="radio" aria-checked={escenario !== "e2"} data-active={escenario !== "e2" || undefined} onClick={() => onEscenario("e1")}>P1 · Universidad</button>
            <button type="button" role="radio" aria-checked={escenario === "e2"} data-active={escenario === "e2" || undefined} onClick={() => onEscenario("e2")}>P2 · Facultades</button>
          </div>
        </div>

        <div className="cmv2-ch-kpis">
          <div className="cmv2-ch-kpi"><span>{fmtInt(model.aulasBaseTotal)}</span><small>CH titulares</small></div>
          <div className="cmv2-ch-kpi"><span>{fmtInt(model.aulasExtraTotal)}</span><small>CH de reserva</small></div>
          <div className="cmv2-ch-kpi cmv2-ch-kpi--hero"><span>{fmtInt(model.aulasTotal)}</span><small>CH a coordinar</small></div>
        </div>

        <div className="cmv2-table-wrap cmv2-ch-tabla-wrap" tabIndex={0} aria-label="Resultado de cursos-horario por facultad">
          <table className="cmv2-table cmv2-table--university cmv2-ch-tabla">
            <thead><tr><th>Facultad</th><th>Cuota</th><th>Método R</th><th>Alumnos por CH</th><th>Titulares</th><th>Reservas</th><th>A coordinar</th></tr></thead>
            <tbody>
              {model.filas.map((fila) => (
                <tr key={fila.estrato}>
                  <td><strong>{fila.estrato}</strong></td>
                  <td>{fmtInt(fila.cuota)}</td>
                  <td>{fila.estadistico_usado}</td>
                  <td>{fmtDec(fila.alumnos_por_ch!.valor, 1)}</td>
                  <td>{fmtInt(fila.aulas_base)}</td>
                  <td>{fmtInt(fila.aulas_reemplazo)}</td>
                  <td className="cmv2-ch-tabla-final"><strong>{fmtInt(fila.aulas_total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <small className="cmv2-calc-diseno-nota">Frame firmado: {model.decision.frame_hash.slice(0, 12)} · confirmación {model.decision.confirmado_at}</small>
      </section>

      <div className="cmv2-calc-confirm-bar cmv2-calc-confirm-bar--flujo" role="region" aria-label="Confirmar plan de cursos-horario">
        <div className="cmv2-calc-confirm-copy">
          <strong>{estado.vigente ? "Plan de cursos-horario confirmado" : "Plan publicado pendiente de confirmación"}</strong>
          <span>{fmtInt(model.aulasTotal)} cursos-horario a coordinar según el resultado vigente.</span>
        </div>
        <div className="cmv2-inline-actions">
          {estado.vigente && <button type="button" className="cmv2-ghost" onClick={() => confirmar(null)}><RotateCcw size={13} aria-hidden="true" /> Reabrir</button>}
          <button type="button" className="cmv2-primary" disabled={!estado.puedeConfirmar} onClick={() => confirmar(actual)}><Check size={13} aria-hidden="true" /> Confirmar plan</button>
        </div>
      </div>
    </div>
  );
}
