import type { DisenoEstudioSourceState, ProjectOverview } from "../../api/client";
import type { ProsecnurModuleMeta } from "../../lib/modules";

export type ModuleStatusState = DisenoEstudioSourceState;

export type ModuleProgressStep = {
  label: string;
  state: "done" | "current" | "pending";
};

export type ModuleCardViz =
  | { kind: "phases"; done: number; total: number; labels: string[] }
  | { kind: "stat"; value: string; label: string }
  | {
      kind: "date";
      day: string;
      month: string;
      label: string;
      countdown: string;
      tone: "future" | "today" | "past" | "empty";
    }
  | {
      kind: "progress";
      current: number;
      total: number;
      display: string;
      label: string;
      steps?: ModuleProgressStep[];
    };

export type ModuleCardFact = { label: string; value: string };

export type ModuleCardView = {
  state: ModuleStatusState;
  statusLabel: string;
  viz: ModuleCardViz;
  sub: string;
  facts: ModuleCardFact[];
  action: { label: string; route: string };
  /** Hace que la actividad/decisión actual preceda visualmente a la cifra. */
  emphasis?: "activity";
  alert?: string | null;
  /** Lectura del backend sobre el estado del módulo (overview.modules[].summary). */
  summary?: string;
};

export type ProcState = {
  done: number;
  total: number;
  /** Sub-salidas de Analítica generadas (codebook, frecuencias, cruces, …) de un total. */
  analiticaDone: number;
  analiticaTotal: number;
  ppt: boolean;
  word: boolean;
};

const PROCESSING_STEPS = [
  { label: "Carga", route: "/carga" },
  { label: "Validación", route: "/validacion" },
  { label: "Codificación", route: "/codificacion" },
  { label: "Analítica", route: "/analitica" },
  { label: "Gráficos", route: "/graficos" },
] as const;

const LIMA_TIME_ZONE = "America/Lima";

type CalendarDate = { year: number; month: number; day: number };

function calendarDateFromIso(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const calendar = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const probe = new Date(Date.UTC(calendar.year, calendar.month - 1, calendar.day));
  if (
    probe.getUTCFullYear() !== calendar.year ||
    probe.getUTCMonth() !== calendar.month - 1 ||
    probe.getUTCDate() !== calendar.day
  ) {
    return null;
  }
  return calendar;
}

function calendarDateInLima(timestamp: number): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LIMA_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);
  return { year: part("year"), month: part("month"), day: part("day") };
}

function calendarOrdinal({ year, month, day }: CalendarDate): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function formatCutDate(iso: string): string {
  if (!iso) return "Sin corte";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const calendar = dateOnly ? calendarDateFromIso(iso) : null;
  const date = calendar
    ? new Date(Date.UTC(calendar.year, calendar.month - 1, calendar.day))
    : new Date(iso);
  if (Number.isNaN(date.getTime())) return "Fecha registrada";
  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: calendar ? "UTC" : LIMA_TIME_ZONE,
  });
}

function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "Sin dato";
  return Math.max(0, value).toLocaleString("es-PE");
}

/** Concordancia de número en las etiquetas del pie: "1 bases" se lee como un
 *  descuido. El plural regular se forma quitando la "s" final en singular. */
function pluralLabel(count: number, plural: string): string {
  return count === 1 ? plural.replace(/s$/, "") : plural;
}

export function formatSavedAt(iso: string, now?: number): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.round(((now ?? Date.now()) - date.getTime()) / 60000);
  if (minutes < 1) return "guardado ahora";
  if (minutes < 60) return `guardado hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `guardado hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "guardado ayer";
  if (days < 30) return `guardado hace ${days} días`;
  return `guardado el ${date.toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}`;
}

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function dateViz(
  iso: string,
  now?: number,
): Extract<ModuleCardViz, { kind: "date" }> {
  const date = calendarDateFromIso(iso);
  if (!date) {
    return {
      kind: "date",
      day: "",
      month: "",
      label: "fecha programada",
      countdown: "Fecha por confirmar",
      tone: "empty",
    };
  }
  const today = calendarDateInLima(now ?? Date.now());
  const diff = calendarOrdinal(date) - calendarOrdinal(today);
  const tone = diff < 0 ? "past" : diff === 0 ? "today" : "future";
  const countdown =
    diff < 0 ? "Fecha programada" : diff === 0 ? "Es hoy" : diff === 1 ? "Mañana" : `En ${diff} días`;
  return {
    kind: "date",
    day: String(date.day),
    month: MONTHS_SHORT[date.month - 1] ?? "",
    label: tone === "past" ? "fecha de cronograma" : "próximo entregable",
    countdown,
    tone,
  };
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

const ROUTE_PHASE_LABEL: Record<string, string> = {
  field: "Campo",
  campo: "Campo",
  pilot: "Piloto",
  piloto: "Piloto",
};

function routePhaseLabel(phase: string): string {
  if (!phase) return "Sin fase registrada";
  return ROUTE_PHASE_LABEL[phase.toLowerCase()] ?? capitalize(phase);
}

const MONITOREO_FAMILY_LABEL: Record<string, string> = {
  territorial: "Territorial",
  telefonico: "Telefónico",
  aulas_universitarias: "Aulas",
  acreditacion: "Acreditación",
  digital_general: "Digital",
};

const FORM_ORIGIN_LABEL: Record<string, string> = {
  "": "Desde cero",
  xlsform: "Importado",
  surveymonkey: "SurveyMonkey",
};

function stateLabel(state: ModuleStatusState): string {
  if (state === "ready") return "Al día";
  if (state === "active") return "En curso";
  if (state === "warning") return "Requiere atención";
  return "Por iniciar";
}

function progressSteps(labels: string[], current: number): ModuleProgressStep[] {
  return labels.map((label, index) => ({
    label,
    state: index < current ? "done" : index === current ? "current" : "pending",
  }));
}

function nodeForModule(module: ProsecnurModuleMeta, overview: ProjectOverview) {
  const nodeId = module.slug === "diseno-estudio" ? "plan-trabajo" : module.slug;
  return overview.modules.find((item) => item.id === nodeId);
}

function moduleAction(module: ProsecnurModuleMeta, label: string, route?: string) {
  return { label, route: route ?? module.to ?? "/" };
}

export function buildModuleCardView(
  module: ProsecnurModuleMeta,
  overview: ProjectOverview,
  proc: ProcState,
  now?: number,
): ModuleCardView {
  const protocol = overview.protocol;
  const metrics = overview.metrics;
  const facts = overview.facts;
  const node = nodeForModule(module, overview);
  const nodeState: ModuleStatusState = node?.state ?? "pending";
  const nodeAlert = nodeState === "warning" ? "Revisar" : null;
  const summary = node?.summary ?? "";

  switch (module.slug) {
    case "procesamiento": {
      const total = PROCESSING_STEPS.length;
      const done = Math.min(total, Math.max(0, Math.trunc(proc.done)));
      const nextIndex = Math.min(done, total - 1);
      const next = PROCESSING_STEPS[nextIndex];
      const warningStep = PROCESSING_STEPS.find(({ route }) =>
        overview.modules.some(
          (item) => item.id === route.slice(1) && item.state === "warning",
        ),
      );
      const state: ModuleStatusState = warningStep
        ? "warning"
        : done >= total
          ? "ready"
          : done > 0
            ? "active"
            : "pending";
      const outputParts = [
        proc.analiticaTotal > 0 ? `${proc.analiticaDone}/${proc.analiticaTotal}` : "",
        proc.ppt ? "PPT" : "",
        proc.word ? "Word" : "",
      ].filter(Boolean);
      // Multibase: el avance de las 5 fases es global, pero la analítica sí se
      // registra por base. Decir "1 de 3 bases" evita que un 2/5 global se lea
      // como si el estudio entero estuviera parejo.
      const processing = facts.procesamiento;
      const multibase = (processing?.bases_count ?? metrics.bases_count) > 1;
      const cardFacts: ModuleCardFact[] = multibase
        ? [
            {
              label: "bases con analítica",
              value: `${formatCount(processing?.bases_con_analitica ?? 0)} de ${formatCount(processing?.bases_count ?? metrics.bases_count)}`,
            },
            { label: "registros", value: formatCount(metrics.records_count) },
            { label: "variables", value: formatCount(metrics.variables_count) },
          ]
        : [
            {
              label: pluralLabel(metrics.bases_count, "bases"),
              value: formatCount(metrics.bases_count),
            },
            { label: "registros", value: formatCount(metrics.records_count) },
            { label: "variables", value: formatCount(metrics.variables_count) },
          ];
      if (outputParts.length > 0) {
        cardFacts.push({ label: "salidas", value: outputParts.join(" · ") });
      }
      return {
        state,
        statusLabel: stateLabel(state),
        viz: {
          kind: "progress",
          current: done,
          total,
          display: `${done}/${total}`,
          label: "secciones",
        },
        sub: warningStep
          ? `${warningStep.label} requiere revisión`
          : done >= total
            ? "Flujo completo; revisa las salidas"
            : `Sigue: ${next.label}`,
        facts: cardFacts,
        action: warningStep
          ? { label: `Revisar ${warningStep.label}`, route: warningStep.route }
          : {
              label: done >= total ? "Revisar gráficos" : `Continuar en ${next.label}`,
              route: next.route,
            },
        alert: warningStep ? "Revisar" : null,
        summary:
          warningStep
            ? overview.modules.find((item) => item.id === warningStep.route.slice(1))?.summary ?? summary
            : summary,
      };
    }

    case "monitoreo": {
      const monitoring = facts.monitoreo;
      const state: ModuleStatusState = monitoring.alerts > 0 ? "warning" : nodeState;
      const family =
        MONITOREO_FAMILY_LABEL[monitoring.family] ??
        (monitoring.family ? capitalize(monitoring.family) : "Sin tipo registrado");
      // El vocabulario lo manda el backend porque cambia con la familia: en
      // territorial el avance es "válidas sobre meta"; en acreditación y
      // telefónico es "efectivas sobre universo contactado". Rotular ambas
      // igual haría que la tarjeta mienta aunque las cifras sean correctas.
      const validLabel = monitoring.valid_label || "válidos";
      const collectedLabel = monitoring.collected_label || "recolectados";
      const avanceLabel = monitoring.avance_label || "avance de campo";
      const viz: ModuleCardViz =
        monitoring.avance_pct >= 0
          ? { kind: "stat", value: `${monitoring.avance_pct}%`, label: avanceLabel }
          : monitoring.valid > 0
            ? { kind: "stat", value: formatCount(monitoring.valid), label: `casos ${validLabel}` }
            : monitoring.collected > 0
              ? { kind: "stat", value: formatCount(monitoring.collected), label: "casos recolectados" }
              : protocol.monitoring_sources_count > 0
                ? {
                    kind: "stat",
                    value: formatCount(protocol.monitoring_sources_count),
                    label: "fuentes de campo",
                  }
                : { kind: "stat", value: "Sin fuentes", label: "conexión de campo" };
      // Lo que el operativo necesita saber es cuánto falta para la meta, no
      // cuánto se ha recorrido de la base: esa lectura va en la sub-línea y el
      // recorrido baja a fact. Antes una alerta borraba el progreso; ahora el
      // progreso manda y la alerta vive en su propio chip (repetirla aquí era
      // ruido).
      const gap = Math.max(0, monitoring.target - monitoring.valid);
      const progressText =
        monitoring.target > 0
          ? gap === 0
            ? `Meta cumplida · ${formatCount(monitoring.valid)} de ${formatCount(monitoring.target)} ${validLabel}`
            : `Faltan ${formatCount(gap)} para la meta · ${formatCount(monitoring.valid)} de ${formatCount(monitoring.target)}`
          : monitoring.collected > 0
            ? `${formatCount(monitoring.valid)} ${validLabel} de ${formatCount(monitoring.collected)}`
            : "";
      // Con cuotas por actor el agregado no basta: la tarjeta nombra al que va
      // último, que es donde hay que mirar. Solo cuando hay más de un actor y
      // de verdad está rezagado respecto del conjunto.
      const lagging =
        monitoring.actors_count && monitoring.actors_count > 1 &&
        monitoring.lagging_actor &&
        typeof monitoring.lagging_pct === "number" &&
        monitoring.lagging_pct >= 0 &&
        monitoring.lagging_pct < monitoring.avance_pct
          ? `${monitoring.lagging_actor} al ${Math.round(monitoring.lagging_pct)}%`
          : "";
      const alertText =
        monitoring.alerts > 0 ? `${formatCount(monitoring.alerts)} por revisar` : "";
      return {
        state,
        statusLabel: stateLabel(state),
        emphasis:
          monitoring.alerts > 0 ||
          (monitoring.avance_pct < 0 &&
            monitoring.valid === 0 &&
            monitoring.collected === 0 &&
            protocol.monitoring_sources_count === 0)
            ? "activity"
            : undefined,
        viz,
        sub:
          [progressText, lagging].filter(Boolean).join(" · ") ||
          alertText ||
          (nodeState === "ready"
            ? "Tablero operativo conectado"
            : "Conecta una fuente para iniciar el seguimiento"),
        facts: [
          { label: "tipo", value: family },
          { label: "último corte", value: formatCutDate(metrics.monitoreo_last_cut) },
          {
            label: collectedLabel,
            value: monitoring.collected > 0 ? formatCount(monitoring.collected) : "Sin definir",
          },
        ],
        action: moduleAction(module, monitoring.alerts > 0 ? "Revisar alertas" : "Abrir monitoreo"),
        alert: monitoring.alerts > 0 ? `${formatCount(monitoring.alerts)} por revisar` : nodeAlert,
        summary,
      };
    }

    case "calc-muestra": {
      const calculation = facts.calc;
      if (calculation.mode === "aulas") {
        return {
          state: nodeState,
          statusLabel: stateLabel(nodeState),
          emphasis: calculation.aulas_titulares > 0 ? undefined : "activity",
          viz: {
            kind: "stat",
            value:
              calculation.aulas_titulares > 0
                ? formatCount(calculation.aulas_titulares)
                : "Sin selección",
            label: "aulas titulares",
          },
          sub:
            calculation.aulas_titulares > 0
              ? "Selección de aulas registrada"
              : "Revisa el diseño para confirmar la selección",
          facts: [
            { label: "estudiantes", value: formatCount(calculation.students_covered) },
            { label: "facultades", value: formatCount(calculation.faculties_count) },
            { label: "n objetivo", value: formatCount(protocol.sample_target_n) },
          ],
          action: moduleAction(module, "Abrir cálculo"),
          alert: nodeAlert,
          summary,
        };
      }
      if (calculation.mode === "territorial") {
        return {
          state: nodeState,
          statusLabel: stateLabel(nodeState),
          emphasis: protocol.sample_target_n > 0 ? undefined : "activity",
          viz: {
            kind: "stat",
            value:
              protocol.sample_target_n > 0
                ? formatCount(protocol.sample_target_n)
                : "Sin cálculo",
            label: "n objetivo",
          },
          sub: nodeState === "ready" ? "Diseño territorial trazable" : "Completa el diseño muestral",
          facts: [
            { label: "n operativo", value: formatCount(protocol.sample_operational_n) },
            { label: "territorios", value: formatCount(calculation.territories_count) },
            { label: "componentes", value: formatCount(protocol.sample_components_count) },
          ],
          action: moduleAction(module, "Abrir cálculo"),
          alert: nodeAlert,
          summary,
        };
      }
      const showActors = calculation.actors_count > 1;
      return {
        state: nodeState,
        statusLabel: stateLabel(nodeState),
        emphasis: protocol.sample_target_n > 0 ? undefined : "activity",
        viz: {
          kind: "stat",
          value:
            protocol.sample_target_n > 0
              ? formatCount(protocol.sample_target_n)
              : "Sin cálculo",
          label: "n objetivo",
        },
        sub: nodeState === "ready" ? "Diseño muestral trazable" : "Completa el diseño muestral",
        facts: [
          { label: "n operativo", value: formatCount(protocol.sample_operational_n) },
          { label: "componentes", value: formatCount(protocol.sample_components_count) },
          {
            label: showActors ? "actores" : "técnicas",
            value: formatCount(showActors ? calculation.actors_count : calculation.techniques_count),
          },
        ],
        action: moduleAction(module, "Abrir cálculo"),
        alert: nodeAlert,
        summary,
      };
    }

    case "editor-xlsform": {
      const editor = facts.editor;
      const hasQuestions = editor.questions_count > 0;
      // Un estudio puede vincular varios instrumentos; el editor solo cuenta
      // las preguntas de UNO. Con más de uno, la cifra honesta es cuántos hay.
      const instruments = editor.instruments_count ?? 0;
      const multiInstrument = instruments > 1;
      const origin =
        FORM_ORIGIN_LABEL[editor.source_kind] ??
        (editor.source_kind ? capitalize(editor.source_kind) : "Sin origen registrado");
      return {
        state: nodeState,
        statusLabel: stateLabel(nodeState),
        emphasis: hasQuestions ? undefined : "activity",
        viz: multiInstrument
          ? { kind: "stat", value: formatCount(instruments), label: "instrumentos" }
          : hasQuestions
            ? { kind: "stat", value: formatCount(editor.questions_count), label: "preguntas" }
            : { kind: "stat", value: "Sin preguntas", label: "cuestionario" },
        sub: multiInstrument
          ? `${formatCount(editor.questions_count)} preguntas en el que estás editando`
          : hasQuestions
            ? "Cuestionario en edición"
            : "Empieza o importa un formulario",
        facts: [
          { label: "secciones", value: formatCount(editor.sections_count) },
          { label: "catálogos", value: formatCount(editor.catalogs_count) },
          { label: "origen", value: origin },
        ],
        action: moduleAction(module, hasQuestions ? "Editar formulario" : "Crear formulario"),
        alert: nodeAlert,
        summary,
      };
    }

    case "hojas-ruta": {
      const routes = facts.hojas;
      const routeFacts: ModuleCardFact[] = [
        { label: "distritos", value: formatCount(routes.districts_count) },
        routes.blocks_count > 0
          ? { label: "manzanas", value: formatCount(routes.blocks_count) }
          : { label: "cuotas", value: formatCount(routes.quota_assigned) },
      ];
      if (routes.interviews_count > 0) {
        routeFacts.push({ label: "entrevistas", value: formatCount(routes.interviews_count) });
      } else if (routes.n_objetivo > 0) {
        routeFacts.push({ label: "n objetivo", value: formatCount(routes.n_objetivo) });
      } else {
        routeFacts.push({ label: "objetivo", value: "Sin definir" });
      }
      return {
        state: nodeState,
        statusLabel: stateLabel(nodeState),
        emphasis: nodeState === "ready" ? undefined : "activity",
        viz: {
          kind: "stat",
          value: routePhaseLabel(protocol.route_phase || routes.phase),
          label: "fase actual",
        },
        sub:
          nodeState === "ready"
            ? routes.from_pilot
              ? "Campo derivado del piloto"
              : "Rutas y cartografía generadas"
            : "Genera las rutas para el equipo de campo",
        facts: routeFacts,
        action: moduleAction(module, "Abrir hojas de ruta"),
        alert: nodeAlert,
        summary,
      };
    }

    case "recopiladores": {
      const collectors = facts.recopiladores;
      const total = Math.max(0, collectors.titulares);
      const current = Math.max(0, collectors.with_link);
      const state: ModuleStatusState = nodeState === "warning"
        ? "warning"
        : total === 0
          ? "pending"
          : current >= total
            ? "ready"
            : "active";
      return {
        state,
        statusLabel:
          state === "warning"
            ? "Requiere atención"
            : state === "ready"
              ? "Listas para imprimir"
              : state === "active"
                ? "En preparación"
                : "Por iniciar",
        viz: total > 0
          ? {
              kind: "progress",
              current,
              total,
              display: `${current}/${total}`,
              label: "fichas con enlace",
            }
          : { kind: "stat", value: "Sin fichas", label: "plan de recopilación" },
        emphasis: total > 0 ? undefined : "activity",
        sub:
          total === 0
            ? "Aún no hay aulas titulares en el plan"
            : collectors.without_link > 0
              ? `${formatCount(collectors.without_link)} fichas requieren enlace`
              : "Todas las fichas tienen enlace",
        facts: [
          { label: "con enlace", value: formatCount(collectors.with_link) },
          { label: "faltantes", value: formatCount(collectors.without_link) },
          { label: "facultades", value: formatCount(collectors.faculties_count) },
        ],
        action: moduleAction(
          module,
          state === "warning"
            ? "Revisar recopiladores"
            : collectors.without_link > 0
              ? "Completar enlaces"
              : "Abrir recopiladores",
        ),
        alert: nodeAlert,
        summary,
      };
    }

    case "dashboard": {
      const dashboard = facts.dashboard;
      const current = dashboard.published
        ? 3
        : dashboard.confirmed
          ? 2
          : dashboard.rows_count > 0
            ? 1
            : 0;
      const state: ModuleStatusState =
        nodeState === "warning"
          ? "warning"
          : dashboard.published
            ? "ready"
            : current > 0 || nodeState === "active" || dashboard.sections_count > 0
              ? "active"
              : "pending";
      return {
        state,
        statusLabel:
          state === "warning"
            ? "Requiere atención"
            : dashboard.published
            ? "Publicado"
            : dashboard.confirmed
              ? "Curación confirmada"
              : state === "active"
                ? "En preparación"
                : "Por iniciar",
        viz: {
          kind: "progress",
          current,
          total: 3,
          display: `${current}/3`,
          label: "etapas",
          steps: progressSteps(["Datos", "Curación", "Publicación"], current),
        },
        sub:
          dashboard.published
            ? "Dashboard disponible para tu cliente"
            : dashboard.confirmed
              ? "Falta publicar el entregable"
              : dashboard.rows_count > 0
                ? "Los datos están listos para curación"
                : "Conecta los datos propios del dashboard",
        facts: [
          { label: "secciones", value: formatCount(dashboard.sections_count) },
          { label: "registros", value: formatCount(dashboard.rows_count) },
          { label: "excluidas", value: formatCount(dashboard.excluded_vars_count) },
        ],
        action: moduleAction(
          module,
          state === "warning"
            ? "Revisar dashboard"
            : dashboard.published
              ? "Abrir dashboard"
              : dashboard.confirmed
                ? "Publicar dashboard"
                : dashboard.rows_count > 0
                  ? "Curar dashboard"
                  : "Preparar dashboard",
        ),
        alert: nodeAlert,
        summary,
      };
    }

    case "diseno-estudio":
    default: {
      const log = facts.bitacora;
      const total = Math.max(0, log.total_tasks);
      const pending = Math.max(0, log.pending);
      const completed = Math.max(0, Math.min(total, total - pending));
      const scheduledDate = log.next_date ? dateViz(log.next_date, now) : null;
      const scheduledDateIsPast = scheduledDate?.tone === "past";
      const cardFacts: ModuleCardFact[] = [
        { label: "registros", value: formatCount(log.entries_count) },
        { label: "decisiones", value: formatCount(log.decisions_count) },
        { label: "pendientes", value: formatCount(pending) },
      ];
      if (log.next_date) {
        cardFacts.push({
          label: scheduledDateIsPast ? "fecha de cronograma" : "próxima fecha",
          value: formatCutDate(log.next_date),
        });
      }
      if (total > 0) {
        const state: ModuleStatusState =
          nodeState === "warning" ? "warning" : pending === 0 ? "ready" : "active";
        const actionLabel =
          state === "warning"
            ? "Revisar cronograma"
            : pending > 0
              ? "Continuar cronograma"
              : "Revisar bitácora";
        return {
          state,
          statusLabel: stateLabel(state),
          viz: {
            kind: "progress",
            current: completed,
            total,
            display: `${completed}/${total}`,
            label: "actividades",
          },
          sub:
            log.next_title
              ? `${scheduledDateIsPast ? "Fecha" : "Próximo"}: ${log.next_title}`
              : pending > 0
                ? `${formatCount(pending)} actividades pendientes`
                : "Cronograma completado",
          facts: cardFacts,
          action: moduleAction(
            module,
            actionLabel,
            state === "warning" || pending > 0
              ? "/bitacora?seccion=cronograma"
              : undefined,
          ),
          alert: state === "warning" ? "Revisar cronograma" : null,
          summary,
        };
      }
      if (log.next_date) {
        const viz = scheduledDate as Extract<ModuleCardViz, { kind: "date" }>;
        return {
          state: nodeState === "warning" ? "warning" : "active",
          statusLabel: nodeState === "warning" ? "Requiere atención" : "En curso",
          viz,
          sub: log.next_title || "Hay una fecha registrada en el cronograma",
          facts: cardFacts,
          action: moduleAction(module, "Abrir cronograma", "/bitacora?seccion=cronograma"),
          alert: nodeAlert,
          summary,
        };
      }
      if (log.entries_count > 0) {
        const state: ModuleStatusState = nodeState === "warning" ? "warning" : "active";
        return {
          state,
          statusLabel: stateLabel(state),
          emphasis: log.last_entry_title ? "activity" : undefined,
          viz: { kind: "stat", value: formatCount(log.entries_count), label: "registros" },
          sub: log.last_entry_title ? `Última: ${log.last_entry_title}` : "Bitácora con actividad",
          facts: cardFacts,
          action: moduleAction(module, "Registrar avance"),
          alert: nodeAlert,
          summary,
        };
      }
      return {
        state: "pending",
        statusLabel: "Por iniciar",
        emphasis: "activity",
        viz: { kind: "stat", value: "Sin actividad", label: "bitácora y cronograma" },
        sub: "Registra avances y arma el cronograma del estudio",
        facts: cardFacts,
        action: moduleAction(module, "Registrar primer avance"),
        summary,
      };
    }
  }
}
