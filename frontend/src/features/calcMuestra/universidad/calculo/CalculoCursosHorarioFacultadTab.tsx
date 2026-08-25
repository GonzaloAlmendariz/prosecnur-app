import { useEffect, useRef } from "react";
import { Check, Grid3X3, RotateCcw } from "../../../../vendor/lucide-react";
import type { CalcMuestraAulasCerteza, CalcMuestraComponente } from "../../../../api/client";
import { EmptyState } from "../../../../components/States";
import { fmtDec, fmtInt } from "../../sharedCore";
import { useMotorStore } from "../../store";
import { CadenaFormulaFacultad } from "./CadenaFormulaFacultad";
import { etiquetaAlumnosPorChMetodo } from "../marco/alumnosPorChDecisionModel";
import { AvisoModulo } from "../shared/AvisoModulo";
import { UNIVERSITY_FACULTY_COMPONENT_ID, UNIVERSITY_TOTAL_COMPONENT_ID } from "../shared/constants";
import type { UniversityAulasScenario } from "../shared/study";
import { CertezaCoberturaPanel } from "./CertezaCoberturaPanel";
import {
  certezaEstratosDesdeResultado,
  certezaVistaDesdeEstado,
  debeMedirCertezaSola,
  motivoSinProbabilidad,
  probabilidadPorEstrato,
  type CertezaEstratoPayload,
} from "./certezaCoberturaModel";
import {
  cursosHorarioDesdeResultado,
  estadoPlanCursosHorario,
  planCursosHorarioPublicado,
} from "./cursosHorarioResultadoModel";
import "./calculo.css";
import { SinDecisionAlumnosChAviso } from "./SinDecisionAlumnosChAviso";

export function CalculoCursosHorarioFacultadTab({
  componentes,
  currentFrameHash,
  escenario,
  onEscenario,
  marcoDesactualizado = false,
  certeza = null,
  certezaEnCurso = false,
  onMedirCerteza,
  onIrAAlumnosPorCh,
}: {
  componentes: [CalcMuestraComponente, CalcMuestraComponente];
  currentFrameHash: string | null | undefined;
  escenario: UniversityAulasScenario;
  onEscenario: (escenario: UniversityAulasScenario) => void;
  marcoDesactualizado?: boolean;
  certeza?: CalcMuestraAulasCerteza | null;
  certezaEnCurso?: boolean;
  onMedirCerteza?: (payload: { estratos: CertezaEstratoPayload[]; nivel: number }) => void | Promise<void>;
  /** Lleva a Marco › Alumnos por CH, donde se decide el divisor de la cadena. */
  onIrAAlumnosPorCh?: () => void;
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

  // **La probabilidad de cumplir viaja en la misma tabla que el cupo.**
  //
  // El número de titulares sale de la fórmula, que apunta al CENTRO de la
  // distribución; la certeza dice qué garantía compra ese número. Estaban en dos
  // superficies —la tabla arriba, el panel debajo— y con el panel sin medir la
  // tabla se leía como si sus cupos estuvieran auditados. Medido sobre el
  // estudio: DERECHO con 16 titulares cumple en el 48 % de los sorteos y con 17
  // en el 94 %; el plan le dio 16 y el libro operativo acabó poniéndole 20 por
  // criterio, sin el número delante.
  //
  // La vista se calcula UNA sola vez y la comparten tabla y panel: dos cálculos
  // del mismo dato es cómo dos superficies empiezan a discrepar.
  const vistaCerteza = certezaVistaDesdeEstado(certeza, frameHashVigente);
  const probPorEstrato = probabilidadPorEstrato(vistaCerteza);
  const motivoSinProb = motivoSinProbabilidad(vistaCerteza);

  // **La certeza se mide sola, una vez por marco.**
  //
  // Era un botón, y un botón que nadie aprieta deja los cupos yendo a campo sin
  // auditar: el plan le dio 16 titulares a DERECHO —48 % de probabilidad de
  // cumplir— y eso se corrigió a 20 por criterio, no porque el número estuviera
  // delante.
  //
  // Los estratos se construyen desde el modelo que ESTA pestaña muestra, así que
  // el disparo vive aquí y no junto a `calculateSample`: la página no los
  // conoce.
  //
  // Cuatro guardas, y las cuatro hacen falta:
  //   · una sola vez por `frame_hash` (un ref, no un estado: no repinta);
  //   · nunca si ya hay una medición vigente para ese marco;
  //   · nunca mientras otra corre;
  //   · nunca con el resultado desactualizado — mediría estratos que ya no son.
  // El hash se marca ANTES de disparar: si la medición falla, no reintenta en
  // bucle. El botón sigue ahí para eso.
  const certezaAutoRef = useRef<string | null>(null);
  const puedeMedirSola = Boolean(onMedirCerteza) && debeMedirCertezaSola({
    vista: vistaCerteza,
    frameHash: frameHashVigente,
    hayFilas: Boolean(model && model.filas.length > 0),
    midiendo: Boolean(certezaEnCurso),
    resultadoDesactualizado,
    yaDisparadoPara: certezaAutoRef.current,
  });
  useEffect(() => {
    if (!puedeMedirSola || !onMedirCerteza || !model || !frameHashVigente) return;
    certezaAutoRef.current = frameHashVigente;
    void onMedirCerteza({ estratos: certezaEstratosDesdeResultado(model.filas), nivel: 0.95 });
  }, [puedeMedirSola, onMedirCerteza, model, frameHashVigente]);
  const actual = model ? planCursosHorarioPublicado(model) : {};
  const estado = model
    ? estadoPlanCursosHorario({ confirmado, marcoDesactualizado: resultadoDesactualizado, actual, guardado })
    : { vigente: false, puedeConfirmar: false };
  useEffect(() => {
    if (confirmado && !estado.vigente) confirmar(null);
  }, [confirmado, confirmar, estado.vigente]);

  // Cuando la decisión de alumnos por CH no está firmada, R marca cada fila con
  // `sin_decision` y calcula las quince facultades con UN promedio global. Va
  // aquí arriba, y también en el estado sin modelo, porque es justo el caso en
  // que la pantalla no puede mostrar el detalle por facultad.
  const filasSinDecision = componentes.flatMap((c) => c.resultado?.aulas_por_estrato ?? []);

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
        <SinDecisionAlumnosChAviso filas={filasSinDecision} />
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
      <SinDecisionAlumnosChAviso filas={filasSinDecision} />
      {resultadoDesactualizado && (
        <AvisoModulo tone="warn" role="status">
          {marcoDesactualizado
            ? "Los criterios del marco cambiaron después del cálculo. Reconfirma Alumnos por CH y recalcula antes de publicar este plan."
            : frameHashVigente
              ? "El resultado pertenece a otro marco. Reconfirma Alumnos por CH y recalcula antes de publicar este plan."
              : "No existe un marco vigente que acredite este resultado. Reconstruye el marco y recalcula antes de publicar este plan."}
        </AvisoModulo>
      )}
      {/* La vista se calcula UNA vez: la tabla de cupos y el panel de certeza
          tienen que decir lo mismo. Calcularla dos veces es cómo dos superficies
          empiezan a discrepar sin que nadie lo note. */}
      <section className="cmv2-panel cmv2-ch-panel" data-qa-geometry-member>
        <div className="cmv2-panel-head">
          <div>
            <strong>Cursos-horario requeridos, facultad por facultad</strong>
            <CadenaFormulaFacultad
              nombreDivisor={etiquetaAlumnosPorChMetodo(model.decision.estadistico_default) || "aula típica"}
              onIrAAlumnosPorCh={onIrAAlumnosPorCh}
            />
          </div>
          <div className="cmv2-segment" role="radiogroup" aria-label="Propuesta que dimensiona las aulas">
            <button type="button" role="radio" aria-checked={escenario !== "e2"} data-active={escenario !== "e2" || undefined} onClick={() => onEscenario("e1")}>P1 · Universidad</button>
            <button type="button" role="radio" aria-checked={escenario === "e2"} data-active={escenario === "e2" || undefined} onClick={() => onEscenario("e2")}>P2 · Facultades</button>
          </div>
        </div>

        {/* UN solo total, y es el que viaja. El panel publicaba además un
            «cupo de reserva» y un «CH del plan» que NADIE consumía —ni la
            selección, ni las cadenas, ni el banco de extras, ni Monitoreo— y
            que encima se calculaban con un fijo de 1 por facultad mientras el
            rótulo prometía «la mitad de los titulares». Los targets del sorteo
            salen de `aulas_base` (afijacionTargets.ts), así que ese total era
            una cuarta magnitud decorativa justo donde importa distinguir la
            muestra de la sobremuestra. */}
        <div className="cmv2-ch-kpis" data-qa-geometry-group="calc-muestra/cursos-horario-totales" data-qa-geometry-contract="equal">
          <div className="cmv2-ch-kpi cmv2-ch-kpi--hero" data-qa-geometry-member data-qa-geometry-capacity="owned" title="Los cursos-horario que hay que visitar: el sorteo reparte exactamente estos por facultad. Las aulas de reemplazo no se cuentan aquí; las construye la selección en cadenas por titular."><span>{fmtInt(model.aulasBaseTotal)}</span><small>CH titulares</small></div>
        </div>

        <div className="cmv2-table-wrap cmv2-ch-tabla-wrap" tabIndex={0} aria-label="Cursos-horario requeridos por facultad" data-qa-geometry-capacity="owned">
          <table className="cmv2-table cmv2-table--university cmv2-ch-tabla">
            <thead><tr><th>Facultad</th><th>Cuota</th><th>Estadístico</th><th>Alumnos por CH</th><th>Tasa de efectividad</th><th>Titulares</th><th title="Con cuántos de los sorteos posibles esos titulares alcanzan la cuota de la facultad. El número de titulares sale de la fórmula, que apunta al centro; esta columna dice qué garantía compra. Sale de la certeza de cobertura: si no se ha medido sobre el marco vigente, lo dice.">Probabilidad de cumplir</th></tr></thead>
            <tbody>
              {model.filas.map((fila) => (
                <tr key={fila.estrato}>
                  <td><strong>{fila.estrato}</strong></td>
                  <td>{fmtInt(fila.cuota)}</td>
                  <td>{etiquetaAlumnosPorChMetodo(fila.estadistico_usado)}</td>
                  <td>{fmtDec(fila.alumnos_por_ch!.valor, 1)}</td>
                  <td>{(() => {
                    const t = Number((fila as Record<string, unknown>).tau);
                    return Number.isFinite(t) && t > 0 ? `${(t * 100).toFixed(1).replace(".", ",")} %` : "—";
                  })()}</td>
                  <td className="cmv2-ch-tabla-final"><strong>{fmtInt(fila.aulas_base)}</strong></td>
                  {/* **Nunca en blanco ni con un guion.** Un cupo sin auditar y
                      un cupo con probabilidad baja son cosas distintas, y el
                      guion las volvía la misma. Si no está medida sobre el
                      marco vigente, la celda lo dice con esas palabras. */}
                  <td className="cmv2-ch-tabla-prob" data-sin-medir={probPorEstrato.has(fila.estrato) ? undefined : ""}>
                    {(() => {
                      const p = probPorEstrato.get(fila.estrato);
                      if (p == null) return <em>{motivoSinProb}</em>;
                      return `${(p * 100).toFixed(0)} %`;
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <small className="cmv2-calc-diseno-nota">Marco firmado: {model.decision.frame_hash.slice(0, 12)} · confirmación {model.decision.confirmado_at}</small>
      </section>

      {/* La tabla de arriba dice CUÁNTAS aulas pide la fórmula; este panel dice
          si ese número alcanza. Van juntos a propósito: separarlos deja al
          usuario decidiendo con la mitad de la respuesta. */}
      {onMedirCerteza && (
        <CertezaCoberturaPanel
          filasResultado={model.filas}
          vista={vistaCerteza}
          busy={certezaEnCurso}
          onMedir={onMedirCerteza}
          marcoDesactualizado={resultadoDesactualizado}
        />
      )}

      <div className="cmv2-calc-confirm-bar cmv2-calc-confirm-bar--flujo" role="region" aria-label="Confirmar cursos-horario requeridos" data-qa-geometry-member>
        <div className="cmv2-calc-confirm-copy">
          <strong>{estado.vigente ? "Cursos-horario requeridos confirmados" : "Cursos-horario requeridos pendientes de confirmación"}</strong>
          {/* Sólo titulares. Antes decía «y N de reserva» y ese N era el cupo
              retirado del panel: un fijo de 1 por facultad que no consumía
              nadie. Dejarlo aquí reintroducía por la puerta de atrás el número
              que la tabla dejó de mostrar, y encima en la frase que describe lo
              que se está firmando. */}
          <span>{fmtInt(model.aulasBaseTotal)} titulares según el resultado vigente.</span>
          {/* Qué hace confirmar, porque no se adivina: Gonzalo supuso que
              desbloqueaba algo («me imagino que si le das a confirmar el plan,
              eso permitiría marcar cuántas aulas»). No abre ninguna puerta —el
              sorteo no lo exige— y su decisión no viaja al motor: es el sello
              de que revisaste ESTE plan, y se cae solo si el marco o el
              resultado cambian. */}
          <small className="cmv2-calc-confirm-que-hace">
            {estado.vigente
              ? "Queda como constancia de que revisaste este plan; si el marco o el cálculo cambian, vuelve a pendiente."
              : "Confirmar deja constancia de que revisaste este plan. No condiciona el sorteo."}
          </small>
        </div>
        <div className="cmv2-inline-actions">
          {estado.vigente && <button type="button" className="cmv2-ghost" onClick={() => confirmar(null)}><RotateCcw size={13} aria-hidden="true" /> Reabrir</button>}
          <button type="button" className="cmv2-primary" disabled={!estado.puedeConfirmar} onClick={() => confirmar(actual)}><Check size={13} aria-hidden="true" /> Confirmar plan</button>
        </div>
      </div>
    </div>
  );
}
