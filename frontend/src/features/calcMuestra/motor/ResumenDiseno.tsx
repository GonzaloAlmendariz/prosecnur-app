/**
 * Cabecera persistente del recorrido universitario. Separa las cifras duras
 * del universo, la estimación viva de elegibles y las metas operativas del
 * diseño. Vive en el toolbar del módulo, no dentro de una pestaña.
 */
import { useMemo, type ReactNode } from "react";
import { BookOpenCheck, ClipboardCheck, RotateCcw, ShieldCheck, Target, Users } from "lucide-react";
import {
  type CalcMuestraAulasState,
  type CalcMuestraEstudio,
  type CalcMuestraWorkspace,
} from "../../../api/client";
import { CountUp } from "./CountUp";
import { frameAuditNumber, marcoCriteriosDesactualizado } from "../universidad/shared/frame";
import {
  UNIVERSITY_FACULTY_COMPONENT_ID,
  UNIVERSITY_TOTAL_COMPONENT_ID,
} from "../universidad/shared/constants";
import { normalizeUniversityAulasConfig } from "../universidad/shared/study";
import { useMotorStore } from "./store";
import type { MotorEfectivo } from "./usePerfilEfectivo";
import "./motor.css";

type SummaryMetric = {
  label: string;
  value: number | null;
  note: string;
  icon: ReactNode;
  tone: "universe" | "estimated" | "confirmed" | "operation";
};

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
  const { perfil } = motor;
  const frame = aulasState?.frame ?? null;
  const frameProfile = frame?.perfil ?? null;

  const config = useMemo(() => normalizeUniversityAulasConfig(workspace.aulas_config), [workspace.aulas_config]);

  // Cifras DURAS del marco construido (producto de "Construir marco"). Nunca
  // se rellenan con la estimación reactiva del motor: la cabecera "Diseño
  // vigente" muestra solo lo que ya se ejecutó, no una vista previa.
  const universoEstudiantes = frameProfile?.universo ?? null;
  const universoCursosHorario =
    frameProfile?.aulas_totales ?? (frameAuditNumber(frame, "classroom_n") || null);
  const estudiantesElegibles = frameProfile?.poblacion_n ?? null;
  const cursosHorarioElegibles =
    frameProfile?.marco_aulas ?? (frameAuditNumber(frame, "classroom_included_n") || null);

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

  // Metas operativas: SOLO tras ejecutar el cálculo (resultado persistido del
  // componente). Sin corrida de cálculo → "—" (no hay diseño calculado aún).
  const totalComp =
    estudio.componentes.find((c) => c.actor_id === UNIVERSITY_TOTAL_COMPONENT_ID) ??
    estudio.componentes.find((c) => c.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID) ??
    estudio.componentes[0];
  const resultado = totalComp?.resultado ?? null;
  const calcEjecutado = Boolean(resultado && Number(resultado.n_objetivo) > 0);
  const muestraObjetivo = calcEjecutado && resultado ? resultado.n_objetivo : null;
  const sobremuestraOperativa =
    calcEjecutado && resultado ? (resultado.n_operativo ?? resultado.sobremuestra ?? null) : null;

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
      note: estudiantesDesactualizados ? "criterios cambiados · reconstruye" : "marco vigente",
      icon: <ClipboardCheck size={16} aria-hidden="true" />,
      tone: estudiantesDesactualizados ? "estimated" : "confirmed",
    },
    {
      label: "Cursos-horario elegibles",
      value: cursosHorarioElegibles,
      note: cursosDesactualizados ? "criterios cambiados · reconstruye" : "marco vigente",
      icon: <BookOpenCheck size={16} aria-hidden="true" />,
      tone: cursosDesactualizados ? "estimated" : "confirmed",
    },
    {
      label: "Muestra objetivo",
      value: muestraObjetivo,
      note: calcEjecutado ? "respuestas válidas" : "falta calcular",
      icon: <Target size={16} aria-hidden="true" />,
      tone: "operation",
    },
    {
      label: "Sobremuestra operativa",
      value: sobremuestraOperativa,
      note: calcEjecutado ? "techo con contingencia" : "falta calcular",
      icon: <ShieldCheck size={16} aria-hidden="true" />,
      tone: "operation",
    },
  ];

  return (
    <section className="rec-resumen-shell" data-audit-ready="calc-muestra-motor" aria-label="Resumen persistente del diseño">
      <header className="rec-resumen-context">
        <span className="rec-resumen-context-title">
          <small>Diseño vigente</small>
          <strong>Universo → elegibles → operación</strong>
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
      <div className="rec-resumen" role="status" aria-label="Resultados del diseño">
        {metrics.map((metric) => (
          <div className="rec-resumen-item" data-tone={metric.tone} key={metric.label}>
            <span className="rec-resumen-item-icon" aria-hidden="true">{metric.icon}</span>
            <span className="rec-resumen-item-copy">
              <small>{metric.label}</small>
              <strong><CountUp value={metric.value} /></strong>
              <span>{metric.note}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
