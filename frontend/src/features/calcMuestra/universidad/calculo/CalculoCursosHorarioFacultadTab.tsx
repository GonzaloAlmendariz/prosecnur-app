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
import {
  type CertezaEstratoPayload,
} from "./certezaCoberturaModel";
import {
  cursosHorarioDesdeResultado,
  estadoPlanCursosHorario,
  planCursosHorarioPublicado,
} from "./cursosHorarioResultadoModel";
import "./calculo.css";
import { SinDecisionAlumnosChAviso } from "./SinDecisionAlumnosChAviso";
import { TitularesFacultadEditor } from "./TitularesFacultadEditor";
import { FijasPendientesAviso } from "../aulas/FijasPendientesAviso";
import { resumenFijaciones } from "../aulas/certificacionAcciones";
import type { CalcMuestraEstrato } from "../../../../api/calcMuestra";
import { claveFacultad } from "../../dominio/rangosNivel";

export function CalculoCursosHorarioFacultadTab({
  componentes,
  currentFrameHash,
  escenario,
  onEscenario,
  marcoDesactualizado = false,
  onIrAAlumnosPorCh,
  onAjustarAula,
  onNotaAula,
  estratosPropios,
}: {
  componentes: [CalcMuestraComponente, CalcMuestraComponente];
  currentFrameHash: string | null | undefined;
  escenario: UniversityAulasScenario;
  onEscenario: (escenario: UniversityAulasScenario) => void;
  marcoDesactualizado?: boolean;
  /** Lleva a Marco › Alumnos por CH, donde se decide el divisor de la cadena. */
  onIrAAlumnosPorCh?: () => void;
  /** Decisión de Gonzalo (2026-08-27): el editor del reparto se muda acá, donde
   *  el número se lee, y deja de exigir una certificación corrida. Sin este
   *  callback la columna es de sólo lectura, como era antes. */
  onAjustarAula?: (facultad: string, aulasActuales: number, delta: 1 | -1) => void;
  /** Escribe el motivo de una agregación operativa. */
  onNotaAula?: (facultad: string, nota: string) => void;
  /** Los estratos del componente REAL. No se leen de `componentes`: el
   *  normalizador reparte un solo marco a los dos y el de facultad llega sin
   *  sus propias fijaciones (ver `estratosPropiosDe` en UniversidadDesk). */
  estratosPropios?: CalcMuestraEstrato[] | null;
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

  // La certeza vivia aqui: la columna de probabilidad en esta tabla y la
  // auto-medicion por `frame_hash`. Se fue con el panel a `CalculoCertezaTab`
  // (decision de Gonzalo, 2026-08-27) y esta pestana ya no la conoce.
  //
  // PENDIENTE: la auto-medicion NO viajo con la mudanza. Media la certeza una
  // sola vez por marco, con cuatro guardas, porque un boton que nadie aprieta
  // deja los cupos yendo a campo sin auditar —medido: DERECHO con 16 titulares
  // cumple en el 48 % de los sorteos y el libro operativo acabo poniendole 20
  // por criterio, sin el numero delante—. Los helpers siguen exportados en
  // `certezaCoberturaModel.ts` (`debeMedirCertezaSola`,
  // `certezaEstratosDesdeResultado`); falta engancharlos en la pestana nueva,
  // que necesita las filas del modelo para construir los estratos.
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

  // Las fijaciones se leen del componente REAL que esta pestaña muestra: el
  // normalizado llega con el marco del OTRO componente y declararía cero
  // fijaciones donde hay quince.
  const estratos: CalcMuestraEstrato[] = estratosPropios ?? componente?.marco?.estratos ?? [];
  const fijadaPorFacultad = new Map<string, CalcMuestraEstrato>();
  for (const e of estratos) {
    const n = Number((e as { aulas_base_fijas?: unknown }).aulas_base_fijas);
    if (Number.isFinite(n) && n > 0) fijadaPorFacultad.set(claveFacultad(e.label), e);
  }
  // Ajustar titulares invalida el resultado, así que el clic siguiente aterriza
  // en el estado sin modelo: la tabla que se estaba editando desaparece. Ese
  // vacío tiene que nombrar SU causa —«fijaste titulares, recalcula»— y no la
  // genérica de un proyecto que todavía no calculó nada.
  const { total: fijadasTotal, suma: fijadasSuma } = resumenFijaciones(estratos);

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
            title={fijadasTotal > 0
              ? "El cálculo quedó pendiente de recalcular"
              : "Los cursos-horario requeridos aparecen al recalcular la muestra"}
            hint={fijadasTotal > 0
              ? `Hay ${fijadasTotal} ${fijadasTotal === 1 ? "facultad" : "facultades"} con titulares fijados a mano, ${fijadasSuma} en total. Una fijación reemplaza al número que calcula la fórmula: ejecuta la propuesta en Cálculo › Propuestas para aplicarla, y vuelve a seleccionar.`
              : "Confirma Alumnos por CH en Marco y ejecuta la propuesta. Esta vista no reconstruye estadísticas ni aulas en React."}
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
      {/* Fijar titulares invalida la selección en cadena. El aviso vive también
          en Aulas · Selección, pero ahora la edición ocurre ACÁ y la causa
          tiene que nombrarse donde se produce. */}
      <FijasPendientesAviso estratos={estratos} aulasPorEstrato={model.filas} />
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
            <thead><tr><th>Facultad</th><th>Cuota</th><th>Estadístico</th><th>Alumnos por CH</th><th>Tasa de la facultad</th><th>Titulares</th><th title="Con cuántos de los sorteos posibles esos titulares alcanzan la cuota de la facultad. El número de titulares sale de la fórmula, que apunta al centro; esta columna dice qué garantía compra. Sale de la certeza de cobertura: si no se ha medido sobre el marco vigente, lo dice.">Probabilidad de cumplir</th></tr></thead>
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
                  <td>
                    {onAjustarAula ? (
                      (() => {
                        const propio = fijadaPorFacultad.get(claveFacultad(fila.estrato));
                        return (
                          <TitularesFacultadEditor
                            facultad={String(fila.estrato)}
                            // La fórmula pura, cuando R la publica: sin ella el
                            // «la fórmula calcula N» repetiría el número fijado.
                            calculadas={fila.aulas_formula ?? fila.aulas_base}
                            fijadas={propio ? Number(propio.aulas_base_fijas) : null}
                            origen={propio?.aulas_base_origen ?? fila.aulas_base_origen}
                            nota={propio?.aulas_base_nota ?? fila.aulas_base_nota}
                            onAjustar={onAjustarAula}
                            onNota={onNotaAula}
                          />
                        );
                      })()
                    ) : (
                      fmtInt(fila.aulas_base)
                    )}
                  </td>
                  <td>{fmtInt(fila.aulas_reemplazo)}</td>
                  <td className="cmv2-ch-tabla-final"><strong>{fmtInt(fila.aulas_total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <small className="cmv2-calc-diseno-nota">Marco firmado: {model.decision.frame_hash.slice(0, 12)} · confirmación {model.decision.confirmado_at}</small>
      </section>

      {/* La certeza vivía aquí debajo. Se mudó a su pestaña propia al final de
          Cálculo (decisión de Gonzalo, 2026-08-27): contesta otra pregunta y con
          otro método —la fórmula divide, la certeza simula el sorteo y cuenta—,
          y es lo último que se decide antes de sortear. */}

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
