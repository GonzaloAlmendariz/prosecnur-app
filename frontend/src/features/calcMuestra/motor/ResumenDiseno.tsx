/**
 * Cabecera persistente del recorrido universitario. Separa las cifras duras
 * del universo, la estimación viva de elegibles y las metas operativas del
 * diseño. Vive en el toolbar del módulo, no dentro de una pestaña.
 */
import { useMemo, type ReactNode } from "react";
import { BookOpenCheck, ClipboardCheck, RotateCcw, ShieldCheck, Target, Users } from "lucide-react";
import {
  normalizeCriteriosCatalogo,
  type CalcMuestraAulasState,
  type CalcMuestraWorkspace,
} from "../../../api/client";
import { computeImpactoMarco, seleccionInicial } from "../dominio";
import { fmtInt } from "../sharedCore";
import { frameAuditNumber } from "../universidad/shared/frame";
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
  workspace,
  aulasState,
}: {
  motor: MotorEfectivo;
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
}) {
  const resetCanon = useMotorStore((s) => s.resetCanon);
  const { perfil, e1 } = motor;
  const frame = aulasState?.frame ?? null;
  const frameProfile = frame?.perfil ?? null;

  const catalogo = useMemo(
    () => normalizeCriteriosCatalogo(frame?.criterios_catalogo ?? null),
    [frame?.criterios_catalogo],
  );
  const seleccion = useMemo(() => {
    const config = normalizeUniversityAulasConfig(workspace.aulas_config);
    return config.criterios_seleccion ?? seleccionInicial(catalogo);
  }, [catalogo, workspace.aulas_config]);

  const universoEstudiantes = frameProfile?.universo ?? perfil.universo;
  const universoCursosHorario =
    frameProfile?.aulas_totales ?? (frameAuditNumber(frame, "classroom_n") || perfil.aulasTotales);
  const estudiantesDuros = frameProfile?.poblacion_n ?? (e1.N > 0 ? e1.N : null);
  const cursosHorarioDuros =
    frameProfile?.marco_aulas ?? (frameAuditNumber(frame, "classroom_included_n") || perfil.marcoAulas);

  const impacto = useMemo(
    () => computeImpactoMarco(
      catalogo,
      seleccion,
      {
        population: frame?.population,
        population_pool: frame?.population_pool,
        aula_frame: frame?.aula_frame,
      },
      { poblacionN: estudiantesDuros, marcoAulas: cursosHorarioDuros },
    ),
    [catalogo, cursosHorarioDuros, estudiantesDuros, frame?.aula_frame, frame?.population, frame?.population_pool, seleccion],
  );

  const estudiantesElegibles = impacto.estudiantesLive ?? estudiantesDuros;
  const cursosHorarioElegibles = impacto.aulasLive ?? cursosHorarioDuros;
  const estudiantesEstimados =
    estudiantesElegibles != null && estudiantesDuros != null && estudiantesElegibles !== estudiantesDuros;
  const cursosEstimados =
    cursosHorarioElegibles != null && cursosHorarioDuros != null && cursosHorarioElegibles !== cursosHorarioDuros;

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
      note: estudiantesEstimados ? "estimación · falta reconstruir" : "marco vigente",
      icon: <ClipboardCheck size={16} aria-hidden="true" />,
      tone: estudiantesEstimados ? "estimated" : "confirmed",
    },
    {
      label: "Cursos-horario elegibles",
      value: cursosHorarioElegibles,
      note: cursosEstimados ? "estimación · falta reconstruir" : "marco vigente",
      icon: <BookOpenCheck size={16} aria-hidden="true" />,
      tone: cursosEstimados ? "estimated" : "confirmed",
    },
    {
      label: "Muestra objetivo",
      value: e1.N > 0 ? e1.nDiseno : null,
      note: "respuestas válidas",
      icon: <Target size={16} aria-hidden="true" />,
      tone: "operation",
    },
    {
      label: "Sobremuestra operativa",
      value: e1.N > 0 ? e1.sobremuestraTotal : null,
      note: "techo con contingencia",
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
              <strong>{metric.value != null ? fmtInt(metric.value) : "—"}</strong>
              <span>{metric.note}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
