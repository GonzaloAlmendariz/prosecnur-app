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
  currentFrameHash,
  escenario,
  onEscenario,
  marcoDesactualizado = false,
}: {
  componentes: [CalcMuestraComponente, CalcMuestraComponente];
  currentFrameHash: string | null | undefined;
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

  const frameHashVigente = typeof currentFrameHash === "string" && currentFrameHash.trim()
    ? currentFrameHash.trim()
    : null;
  const frameDesactualizado = Boolean(
    model && (!frameHashVigente || model.decision.frame_hash !== frameHashVigente),
  );
  const resultadoDesactualizado = marcoDesactualizado || frameDesactualizado;
  const actual = model ? planCursosHorarioPublicado(model) : {};
  const estado = model
    ? estadoPlanCursosHorario({ confirmado, marcoDesactualizado: resultadoDesactualizado, actual, guardado })
    : { vigente: false, puedeConfirmar: false };
  useEffect(() => {
    if (confirmado && !estado.vigente) confirmar(null);
  }, [confirmado, confirmar, estado.vigente]);

  if (!model) {
    return (
      <div
        className="cmv2-calc-stack"
        data-audit-ready="false"
        data-surface-group="calc-muestra-calculo"
        data-surface-contract="resultado-r-alumnos-por-ch"
        data-qa-geometry-group="calc-muestra/calculo-cursos-horario"
        data-qa-geometry-contract="intrinsic"
      >
        <section className="cmv2-panel" data-qa-geometry-member>
          <EmptyState
            icon={<Grid3X3 size={20} />}
            title="Los cursos-horario requeridos aparecen al recalcular la muestra"
            hint="Confirma Alumnos por CH en Marco y ejecuta la propuesta. Esta vista no reconstruye estadísticas ni aulas en React."
          />
        </section>
      </div>
    );
  }

  return (
    <div
      className="cmv2-calc-stack"
      data-audit-ready={resultadoDesactualizado ? "false" : "true"}
      data-marco-stale={marcoDesactualizado || undefined}
      data-frame-stale={frameDesactualizado || undefined}
      data-surface-group="calc-muestra-calculo"
      data-surface-contract="resultado-r-alumnos-por-ch"
      data-qa-geometry-group="calc-muestra/calculo-cursos-horario"
      data-qa-geometry-contract="intrinsic"
    >
      {resultadoDesactualizado && (
        <AvisoModulo tone="warn" role="status">
          {marcoDesactualizado
            ? "Los criterios del marco cambiaron después del cálculo. Reconfirma Alumnos por CH y recalcula antes de publicar este plan."
            : frameHashVigente
              ? "El resultado pertenece a otro marco. Reconfirma Alumnos por CH y recalcula antes de publicar este plan."
              : "No existe un frame vigente que acredite este resultado. Reconstruye el marco y recalcula antes de publicar este plan."}
        </AvisoModulo>
      )}
      <section className="cmv2-panel cmv2-ch-panel" data-qa-geometry-member>
        <div className="cmv2-panel-head">
          <div>
            <strong>Cursos-horario requeridos publicados por R</strong>
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

        <div className="cmv2-ch-kpis" data-qa-geometry-group="calc-muestra/cursos-horario-totales" data-qa-geometry-contract="equal">
          <div className="cmv2-ch-kpi" data-qa-geometry-member data-qa-geometry-capacity="owned"><span>{fmtInt(model.aulasBaseTotal)}</span><small>CH titulares</small></div>
          <div className="cmv2-ch-kpi" data-qa-geometry-member data-qa-geometry-capacity="owned"><span>{fmtInt(model.aulasExtraTotal)}</span><small>CH de reserva</small></div>
          <div className="cmv2-ch-kpi cmv2-ch-kpi--hero" data-qa-geometry-member data-qa-geometry-capacity="owned"><span>{fmtInt(model.aulasTotal)}</span><small>CH a coordinar</small></div>
        </div>

        <div className="cmv2-table-wrap cmv2-ch-tabla-wrap" tabIndex={0} aria-label="Cursos-horario requeridos por facultad" data-qa-geometry-capacity="owned">
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
        <small className="cmv2-calc-diseno-nota">Marco firmado: {model.decision.frame_hash.slice(0, 12)} · confirmación {model.decision.confirmado_at}</small>
      </section>

      <div className="cmv2-calc-confirm-bar cmv2-calc-confirm-bar--flujo" role="region" aria-label="Confirmar cursos-horario requeridos" data-qa-geometry-member>
        <div className="cmv2-calc-confirm-copy">
          <strong>{estado.vigente ? "Cursos-horario requeridos confirmados" : "Cursos-horario requeridos pendientes de confirmación"}</strong>
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
