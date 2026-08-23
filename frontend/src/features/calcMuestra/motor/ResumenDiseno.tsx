/**
 * Cabecera persistente del recorrido universitario. Separa las cifras duras
 * del universo, la estimación viva de elegibles y las metas operativas del
 * diseño. Vive en el toolbar del módulo, no dentro de una pestaña.
 */
import { useMemo, type ReactNode } from "react";
import { BookOpenCheck, ClipboardCheck, RotateCcw, School, ShieldCheck, Sigma, Target, Users } from "lucide-react";
import {
  type CalcMuestraAulasState,
  type CalcMuestraEstudio,
  type CalcMuestraWorkspace,
} from "../../../api/client";
import {
  normalizeCalcMuestraDistribucionI19,
  type CalcMuestraDistribucionI19State,
} from "../../../api/calcMuestraDistribucionI19";
import { fmtInt } from "../sharedCore";
import { calculoDistribucionScenarioMeta } from "../universidad/calculo/calculoDistribucionModel";
import { estadisticoDelReparto, nombreEstadistico } from "../universidad/calculo/estadisticoAula";
import { frameAuditNumber, marcoCriteriosDesactualizado } from "../universidad/shared/frame";
import { frameIntegrity, notaEstadoDelMarco } from "../universidad/shared/frameIntegrity";
import {
  normalizeUniversityAulasConfig,
  universityComponentForScenario,
} from "../universidad/shared/study";
import { useMotorStore } from "../store";
import type { MotorEfectivo } from "./usePerfilEfectivo";
import "./motor.css";

/**
 * La primera razón por la que el motor rechazó el resultado, lista para la
 * cabecera. `normalizeCalcMuestraDistribucionI19` ya la trae —y cuando viene
 * de R, con su código y sus cifras— pero la franja sólo decía «resultado
 * inválido»: la explicación existía y no se mostraba.
 *
 * Se recorta porque la cabecera es una línea, no un panel; el detalle
 * completo vive en Distribución.
 */
export function primeraRazonInvalida(
  state: { kind: string; reasons?: unknown },
  limite = 110,
): string | null {
  if (state.kind !== "invalid") return null;
  const lista = Array.isArray(state.reasons) ? state.reasons : [];
  for (const razon of lista) {
    const texto = typeof razon === "string"
      ? razon
      : typeof (razon as { message?: unknown })?.message === "string"
        ? (razon as { message: string }).message
        : "";
    const limpio = texto.trim();
    if (limpio) return limpio.length > limite ? `${limpio.slice(0, limite - 1)}…` : limpio;
  }
  return null;
}

type SummaryMetric = {
  label: string;
  value: number | null;
  /** Valor de texto para el KPI que declara el método, no una cantidad. */
  texto?: string;
  note: string;
  icon: ReactNode;
  tone: "universe" | "estimated" | "confirmed" | "operation";
};

export const summaryComponentForScenario = universityComponentForScenario;

export function ResumenDiseno({
  motor,
  estudio,
  workspace,
  aulasState,
}: {
  motor: MotorEfectivo;
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
}) {
  const resetCanon = useMotorStore((s) => s.resetCanon);
  const opcionalesActivos = useMotorStore((s) => s.decisiones.opcionalesActivos);
  const escenario = useMotorStore((s) => s.decisiones.escenario);
  const { perfil } = motor;
  const frame = aulasState?.frame ?? null;
  const frameProfile = frame?.perfil ?? null;
  const integridadFrame = frameIntegrity(frame);
  const marcoPublicable = integridadFrame.status === "consistent";

  const config = useMemo(() => normalizeUniversityAulasConfig(workspace.aulas_config), [workspace.aulas_config]);

  // Cifras DURAS del marco construido (producto de "Construir marco"). Nunca
  // se rellenan con la estimación reactiva del motor: la cabecera "Diseño
  // vigente" muestra solo lo que ya se ejecutó, no una vista previa.
  const universoEstudiantes = frameProfile?.universo ?? null;
  const universoCursosHorario =
    frameProfile?.aulas_totales ?? (frameAuditNumber(frame, "classroom_n") || null);
  const estudiantesElegibles = marcoPublicable ? frameProfile?.poblacion_n ?? null : null;
  const cursosHorarioElegibles = integridadFrame.marcoAulas;

  // ¿El marco quedó desactualizado? Señal EXACTA (no una estimación viva): los
  // criterios confirmados en el workspace difieren de los que produjeron el
  // marco vigente (el frame guarda la selección con que se construyó). Si
  // difieren, la cifra de elegibles ya no corresponde y hay que reconstruir.
  const marcoDesactualizado = useMemo(
    () =>
      marcoCriteriosDesactualizado(frame, config.criterios_seleccion, config.teacher_type_orden, {
        config,
        opcionalesActivos,
      }),
    [frame, config, opcionalesActivos],
  );
  const estudiantesDesactualizados = estudiantesElegibles != null && marcoDesactualizado;
  const cursosDesactualizados = cursosHorarioElegibles != null && marcoDesactualizado;
  // Ausencia y no-verificabilidad no son lo mismo, y esta cabecera las confundía.
  //
  // Medido sobre un proyecto recién creado: los dos KPIs de elegibles decían
  // «frame no verificable · reconstruye» —pidiendo REconstruir algo que nunca se
  // construyó— porque `frameIntegrity` clasifica el marco ausente como
  // "unverifiable", que es correcto para lo suyo: sin proyecciones no hay nada
  // que contrastar. Pero las dos situaciones piden acciones opuestas: calcular
  // por primera vez frente a rehacer. Es el mismo defecto que ya se reparó en
  // Criterios del estudiante, y aquí pesa más porque esta tira acompaña a TODAS
  // las pestañas del módulo.
  const notaIntegridad = notaEstadoDelMarco(frame);

  // Metas operativas: el mismo selector P1/P2 y el mismo normalizador de la
  // superficie Distribución acreditan actor, escenario, owner R y frame. Un
  // resultado raw stale/invalid nunca publica cifras en la cabecera.
  const resultModel = useMemo(() => {
    const selection = calculoDistribucionScenarioMeta(escenario);
    const matching = estudio.componentes.filter((component) => component.actor_id === selection.actorId);
    const component = matching.length === 1 ? matching[0] : undefined;
    const state: CalcMuestraDistribucionI19State = component
      ? normalizeCalcMuestraDistribucionI19(component.resultado, {
          component_id: component.id,
          actor_id: selection.actorId,
          scenario: selection.scenario,
          technique: component.tecnica,
          current_frame_hash: frame?.frame_hash,
        })
      : {
          kind: "invalid",
          reasons: [`${selection.shortLabel} requiere exactamente un componente ${selection.actorId}.`],
        };
    return { component, selection, state };
  }, [escenario, estudio.componentes, frame?.frame_hash]);
  const resultReady = resultModel.state.kind === "ready";
  const muestraObjetivo = resultModel.state.kind === "ready"
    ? resultModel.state.data.totals.sample_n
    : null;
  const rawOperational = resultModel.component?.resultado?.n_operativo;
  const sobremuestraOperativa = resultReady && Number.isSafeInteger(rawOperational) && Number(rawOperational) >= 0
    ? Number(rawOperational)
    : null;
  // El último eslabón, que faltaba (Gonzalo, 2026-08-21): «el KPI donde está
  // universo, estudiantes elegibles, muestra objetivo y sobremuestra operativa
  // debería también hacer espacio para el último criterio importante, que es
  // el número de aulas titulares… así ya cerramos todo el círculo: ya sabemos
  // el universo, los elegibles, la muestra y las aulas a las que ir».
  // Se SUMA del reparto por facultad en vez de leer un total aparte: es la
  // misma cifra que la pestaña de cursos-horario requeridos muestra abajo, y
  // dos fuentes para el mismo número es justo lo que se viene corrigiendo.
  const sumaDelReparto = (campo: "aulas_base" | "aulas_total") => {
    if (!resultReady) return null;
    const filas = resultModel.component?.resultado?.aulas_por_estrato;
    if (!Array.isArray(filas) || !filas.length) return null;
    let total = 0;
    for (const fila of filas) {
      const v = Number((fila as Record<string, unknown>)?.[campo]);
      if (Number.isFinite(v) && v > 0) total += v;
    }
    return total > 0 ? total : null;
  };
  const aulasTitulares = sumaDelReparto("aulas_base");
  // CON QUÉ se dimensiona, justo antes de decir cuántas aulas salen. Gonzalo,
  // 2026-08-21: «ojo, las aulas de reserva no se coordinan así; más bien antes
  // de aulas titulares podría indicar que estamos usando P25 y tasa de
  // efectividad histórica, y luego la cantidad de aulas titulares». El KPI que
  // había ahí —titulares + reservas como «aulas a coordinar»— prometía una
  // coordinación que las reservas no tienen.
  // Ninguno de los dos términos se escribe a mano: el divisor sale de la
  // decisión del analista y la tasa, de si el histórico dio base propia.
  const metodoDimensionado = (() => {
    if (!resultReady) return null;
    const filas = resultModel.component?.resultado?.aulas_por_estrato;
    if (!Array.isArray(filas) || !filas.length) return null;
    const divisor = nombreEstadistico(estadisticoDelReparto(filas as Array<{ estadistico_usado?: unknown }>));
    const conResidual = (aulasState?.frame as { tasas_efectividad_facultad?: unknown } | undefined)
      ?.tasas_efectividad_facultad;
    const hayHistorico = Array.isArray(conResidual)
      && conResidual.some((f) => (f as { con_residual?: unknown })?.con_residual === true);
    return `${divisor} × tasa ${hayHistorico ? "histórica" : "de referencia"}`;
  })();
  // Vocabulario de la pantalla, no del código: aquí decía «frame» —inglés en
  // una interfaz en español— y «contrato anterior», que no le dice a nadie qué
  // hacer. Los estados que piden acción la nombran: «recalcula».
  const resultNote = resultReady
    ? `${resultModel.selection.shortLabel} · R · marco vigente`
    : resultModel.state.kind === "stale"
      ? `${resultModel.selection.shortLabel} · R · marco anterior · recalcula`
      : resultModel.state.kind === "invalid"
        // Con la razón que R publicó, no sólo «inválido». El motor explica por
        // qué —«La suma de facultades no coincide con el marco validado del
        // diseño», con los dos números— y esa explicación llegaba al front y
        // se quedaba sin mostrar: la cabecera decía «resultado inválido» y el
        // usuario no tenía forma de saber qué revisar.
        ? `${resultModel.selection.shortLabel} · R · ${primeraRazonInvalida(resultModel.state) ?? "resultado inválido"}`
        : resultModel.state.kind === "legacy"
          ? `${resultModel.selection.shortLabel} · calculado con una versión anterior · recalcula`
          : `${resultModel.selection.shortLabel} · falta calcular`;

  const metrics: SummaryMetric[] = [
    {
      label: "Universo de estudiantes",
      value: universoEstudiantes,
      note: "base completa",
      icon: <Users size={16} aria-hidden="true" />,
      tone: "universe",
    },
    {
      label: "Universo de cursos-horario",
      value: universoCursosHorario,
      note: "unidades únicas",
      icon: <BookOpenCheck size={16} aria-hidden="true" />,
      tone: "universe",
    },
    {
      label: "Estudiantes elegibles",
      value: estudiantesElegibles,
      note: notaIntegridad ?? (estudiantesDesactualizados ? "criterios cambiados · reconstruye" : "marco vigente"),
      icon: <ClipboardCheck size={16} aria-hidden="true" />,
      tone: estudiantesDesactualizados || !marcoPublicable ? "estimated" : "confirmed",
    },
    {
      label: "Cursos-horario elegibles",
      value: cursosHorarioElegibles,
      note: notaIntegridad ?? (cursosDesactualizados ? "criterios cambiados · reconstruye" : "marco vigente"),
      icon: <BookOpenCheck size={16} aria-hidden="true" />,
      tone: cursosDesactualizados || !marcoPublicable ? "estimated" : "confirmed",
    },
    {
      label: "Muestra objetivo",
      value: muestraObjetivo,
      note: resultNote,
      icon: <Target size={16} aria-hidden="true" />,
      tone: "operation",
    },
    {
      label: "Sobremuestra operativa",
      value: sobremuestraOperativa,
      note: resultNote,
      icon: <ShieldCheck size={16} aria-hidden="true" />,
      tone: "operation",
    },
    {
      label: "Se dimensiona con",
      value: null,
      texto: metodoDimensionado ?? "—",
      note: metodoDimensionado ? "alumnos por CH × efectividad" : resultNote,
      icon: <Sigma size={16} aria-hidden="true" />,
      tone: "operation",
    },
    {
      // «Aulas que pide el cálculo» y no «Aulas titulares» a secas.
      //
      // Este KPI suma `aulas_base` del reparto por facultad: es lo que el
      // diseño EXIGE. Las que se sortean pueden ser más —el sorteo añade
      // adicionales donde una facultad no llegaría a su cuota— y el mapa del
      // recorrido, en la misma pantalla, enseña esa otra cifra bajo
      // «cursos-horario titulares sorteados».
      //
      // Medido en HSVG2026 el 2026-08-23: «AULAS TITULARES 190» arriba y
      // «CURSOS-HORARIO M1 193» a la derecha. Los dos números son correctos y
      // la diferencia ES información —son los tres adicionales—, pero con el
      // mismo rótulo se leen como una contradicción y no como un dato.
      label: "Aulas que pide el cálculo",
      value: aulasTitulares,
      note: resultNote,
      icon: <School size={16} aria-hidden="true" />,
      tone: "operation",
    },
  ];

  return (
    <section
      className="rec-resumen-shell"
      data-audit-ready="calc-muestra-motor"
      data-result-state={resultModel.state.kind}
      aria-label="Resumen persistente del diseño"
    >
      <header className="rec-resumen-context">
        <span className="rec-resumen-context-title">
          <small>Diseño vigente</small>
          <strong>Universo → elegibles → operación → aulas</strong>
        </span>
        <span className="rec-resumen-meta">
          {perfil.esEjemplo && <span className="rec-badge-ejemplo">EJEMPLO</span>}
          <span className="rec-cabecera-perfil" data-fuente={motor.usaProyecto ? "proyecto" : "manual"}>
            {motor.marcaFuente} · {perfil.nombre}
          </span>
          {motor.tocado && (
            <button type="button" className="rec-link" onClick={resetCanon}>
              <RotateCcw size={12} aria-hidden="true" /> Restaurar parámetros
            </button>
          )}
        </span>
      </header>
      {/* `equal`: los seis indicadores son la misma lectura del diseño vigente y
          comparten franja. La rejilla los reparte en `repeat(6, minmax(0, 1fr))`,
          así que ninguno puede ensancharse ni crecer por su cuenta según el
          largo de su nombre o de su cifra. */}
      <div
        className="rec-resumen"
        role="status"
        aria-label="Resultados del diseño"
        data-qa-geometry-group="calc-muestra/resumen-diseno"
        data-qa-geometry-contract="equal"
      >
        {metrics.map((metric) => (
          <div className="rec-resumen-item" data-tone={metric.tone} key={metric.label}>
            <span className="rec-resumen-item-icon" aria-hidden="true">{metric.icon}</span>
            <span className="rec-resumen-item-copy">
              <small>{metric.label}</small>
              <strong data-texto={metric.texto ? "true" : undefined}>
                {metric.texto ?? (metric.value == null ? "—" : fmtInt(metric.value))}
              </strong>
              <span>{metric.note}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
