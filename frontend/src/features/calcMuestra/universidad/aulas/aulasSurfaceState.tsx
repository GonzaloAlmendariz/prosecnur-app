import {
  BarChart3,
  Calculator,
  Database,
  FileText,
  RefreshCw,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { rowsFrom } from "../../sharedCore";
import { classroomRowNumber, classroomRowText } from "../shared/format";
import type { ClassroomLabModel } from "./classroomLabModel";

export type AulasNavigate = (section: string, tab?: string) => void;
export type AulasSurfaceStage =
  | "objetivo"
  | "metodo"
  | "laboratorio"
  | "seleccion"
  | "relato"
  | "reemplazos"
  | "auditoria";

export type AulasStageNoticeModel = {
  kind:
    | "missing-frame"
    | "missing-objective"
    | "stored-unaccredited"
    | "missing-comparison"
    | "missing-selection"
    | "missing-replacements";
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  detail: string;
  actionLabel: string;
  destination?: { section: string; tab: string };
  localAction?: "compare" | "select" | "replace";
};

function storedSelectionSummary(model: ClassroomLabModel) {
  const stored = model.storedSelection;
  if (!stored) return "";
  const rows = rowsFrom<Record<string, unknown>>(stored.selection);
  const titularCount = rows.filter((row) => {
    const role = classroomRowText(row, ["sample_role"]);
    const wave = classroomRowText(row, ["wave"]);
    return role === "titular" || wave === "M1";
  }).length;
  const runId = String(stored.selection_run_id ?? "").trim();
  const parts = [
    titularCount ? `${titularCount} titulares` : rows.length ? `${rows.length} filas almacenadas` : "filas almacenadas",
    rows.length > titularCount && titularCount > 0 ? `${rows.length} filas del plan` : "",
    runId ? `corrida ${runId}` : "corrida sin identificador publicable",
  ].filter(Boolean);
  return parts.join(" · ");
}

/**
 * Resuelve una sola causa accionable por pestaña. El orden es deliberado:
 * Marco → Cálculo → Método → Selección → Reemplazos. Una corrida cruda puede
 * explicar el estado, pero nunca salta los guards de vigencia del modelo.
 */
export function resolveAulasStageNotice(
  model: ClassroomLabModel,
  stage: AulasSurfaceStage,
): AulasStageNoticeModel | null {
  if (!model.frameReady) {
    return {
      kind: "missing-frame",
      icon: Database,
      eyebrow: "Marco",
      title: model.marcoDesactualizado
        ? "El marco de cursos-horario necesita reconstruirse"
        : "Falta el marco de cursos-horario",
      detail: model.marcoDesactualizado
        ? "Los criterios cambiaron después de construir el marco. Reconstrúyelo en Marco → Cursos-horario antes de acreditar cálculos o corridas."
        : "Construye el marco en Marco → Cursos-horario. Sin esa base no hay unidades elegibles que comparar ni seleccionar.",
      actionLabel: "Ir a Marco",
      destination: { section: "marco", tab: "marco-aulas" },
    };
  }

  if (!model.selectedResultReady || model.currentAulasTarget <= 0) {
    const scenario = model.aulasScenario === "e2"
      ? "Propuesta 2 (por facultad)"
      : "Propuesta 1 (universidad)";
    if (model.hasStoredSelection) {
      const summary = storedSelectionSummary(model);
      return {
        kind: "stored-unaccredited",
        icon: Calculator,
        eyebrow: "Cálculo",
        title: "La selección existe; falta acreditar el objetivo",
        detail: `Se conserva ${summary}, pero no se publica como vigente porque ${scenario} no tiene un objetivo de cursos-horario materializado. Calcula esa propuesta; la corrida almacenada no se borra ni sustituye.`,
        actionLabel: "Ir a Cálculo",
        destination: { section: "calculo", tab: "calculo-propuestas" },
      };
    }
    return {
      kind: "missing-objective",
      icon: Calculator,
      eyebrow: "Cálculo",
      title: "Falta calcular el objetivo de cursos-horario",
      detail: `${scenario} todavía no entrega n objetivo, n operativo y cursos-horario titulares. Completa Cálculo → Propuestas para continuar.`,
      actionLabel: "Ir a Cálculo",
      destination: { section: "calculo", tab: "calculo-propuestas" },
    };
  }

  if (stage === "objetivo") return null;

  if (!model.comparisonReady) {
    const stored = model.hasStoredComparison || model.hasStoredSelection;
    const partialSimulation = stage === "laboratorio" && hasAulasSimulationEvidence(model);
    return {
      kind: "missing-comparison",
      icon: BarChart3,
      eyebrow: partialSimulation ? "Simulación" : "Método",
      title: partialSimulation
        ? "Hay evidencia parcial; falta la comparación vigente"
        : stored
        ? "La evidencia almacenada no acredita la comparación vigente"
        : "Falta comparar los métodos",
      detail: partialSimulation
        ? "La estabilidad de pesos o las probabilidades Monte Carlo sí están acreditadas y se muestran abajo. Compara métodos para completar el resumen sin ocultar esa evidencia."
        : stored
        ? "Existe una corrida previa, pero su comparación no coincide con el objetivo o la firma vigente. Vuelve a comparar sin publicar esa evidencia como actual."
        : "Compara representatividad, balance, cobertura, repetidos y riesgos sobre el marco y el objetivo vigentes.",
      actionLabel: stage === "metodo" || stage === "laboratorio"
        ? "Comparar métodos"
        : "Ir a Método",
      ...(stage === "metodo" || stage === "laboratorio"
        ? { localAction: "compare" as const }
        : { destination: { section: "aulas", tab: "metodo" } }),
    };
  }

  if (stage === "laboratorio" && !model.simulationRows.length) {
    const partial = hasAulasSimulationEvidence(model);
    return {
      kind: "missing-comparison",
      icon: BarChart3,
      eyebrow: "Simulación",
      title: partial
        ? "Hay evidencia parcial; falta el resumen por método"
        : "Faltan las corridas de simulación",
      detail: partial
        ? "La estabilidad de pesos o las probabilidades Monte Carlo sí están acreditadas y se muestran abajo. Vuelve a comparar para completar el resumen sin ocultar esa evidencia."
        : "Vuelve a comparar con corridas de auditoría para medir estabilidad, probabilidades y variabilidad del diseño.",
      actionLabel: "Ejecutar corridas",
      localAction: "compare",
    };
  }

  if (stage === "metodo" || stage === "laboratorio") return null;

  if (!model.selectionReady) {
    return {
      kind: "missing-selection",
      icon: Table2,
      eyebrow: "Selección",
      title: model.hasStoredSelection
        ? "La selección almacenada no es vigente"
        : "Falta generar la selección",
      detail: model.hasStoredSelection
        ? "La corrida permanece guardada, pero no coincide con el objetivo o la firma vigente. Regenera titulares sin relajar la validación."
        : "El método ya está comparado. Genera los cursos-horario titulares y sus reservas con esa recomendación.",
      actionLabel: stage === "seleccion" ? "Generar selección" : "Ir a Selección",
      ...(stage === "seleccion"
        ? { localAction: "select" as const }
        : { destination: { section: "aulas", tab: "seleccion" } }),
    };
  }

  // El relato (ADR 0067) narra la selección persistida: con ella acreditada no
  // exige nada más — las cadenas M2+ ya viajan en las filas de la selección.
  if (stage === "seleccion" || stage === "relato") return null;

  if (!model.replacementReady) {
    return {
      kind: "missing-replacements",
      icon: RefreshCw,
      eyebrow: "Reemplazos",
      title: model.hasStoredReplacementSimulation
        ? "La simulación almacenada no acredita estos reemplazos"
        : "Falta simular los reemplazos",
      detail: model.hasStoredReplacementSimulation
        ? "La simulación previa se conserva, pero no corresponde a la selección vigente. Vuelve a simular las rutas antes de usarlas en campo."
        : "La selección ya existe. Simula profundidad por celda, balance y aporte neto de cada ruta de reemplazo.",
      actionLabel: stage === "reemplazos" ? "Simular reemplazos" : "Ir a Reemplazos",
      ...(stage === "reemplazos"
        ? { localAction: "replace" as const }
        : { destination: { section: "aulas", tab: "reemplazos" } }),
    };
  }

  return null;
}

export function hasAulasSimulationEvidence(model: ClassroomLabModel) {
  return Boolean(model.weightStability) || model.probabilityRows.some(
    (row) => classroomRowNumber(row, ["pi_mc"]) > 0,
  );
}

export function AulasStageNotice({
  notice,
  onNavigate,
  onAction,
  disabled,
  disabledReason,
}: {
  notice: AulasStageNoticeModel;
  onNavigate?: AulasNavigate;
  onAction?: () => void;
  disabled?: boolean;
  /**
   * F38 · Por qué el remedio está apagado.
   *
   * Medido en Titulares: el aviso ordenaba «regenera titulares» y su botón
   * estaba deshabilitado **sin `title`, sin `aria-describedby` y sin texto** —la
   * superficie nombraba el problema y apagaba su solución en silencio—. Un
   * control inalcanzable sin causa visible no pasa la prueba del hueco: el
   * usuario no puede saber si esperar, volver atrás o si la app se rompió.
   */
  disabledReason?: string;
}) {
  const Icon = notice.icon ?? FileText;
  const canAct = Boolean(notice.destination ? onNavigate : onAction);
  return (
    <section
      className={`cmv2-aulas-stage-notice is-${notice.kind}`}
      data-aulas-blocker={notice.kind}
      aria-live="polite"
    >
      <span className="cmv2-aulas-stage-icon" aria-hidden="true"><Icon size={18} /></span>
      <div className="cmv2-aulas-stage-copy">
        <small>{notice.eyebrow} · siguiente condición</small>
        <strong>{notice.title}</strong>
        <p>{notice.detail}</p>
        {disabled && disabledReason ? (
          <p className="cmv2-aulas-stage-blocked">{disabledReason}</p>
        ) : null}
      </div>
      {canAct && (
        <button
          type="button"
          className="cmv2-primary"
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
          onClick={() => {
            if (notice.destination) {
              onNavigate?.(notice.destination.section, notice.destination.tab);
            } else {
              onAction?.();
            }
          }}
        >
          {notice.actionLabel}
        </button>
      )}
    </section>
  );
}
