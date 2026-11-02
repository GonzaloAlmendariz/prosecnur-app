import type { DisenoEstudioSourceState, ProjectOverview } from "../../api/client";
import type { ProsecnurModuleMeta } from "../../lib/modules";
import { resumenDelInicio } from "../recopiladores/campanas/resumenDelInicio";
import { baseDelAvance, estaRegenerando, lineaDelAvance, rezagado, type HechosDeMonitoreo } from "./lecturaDeMonitoreo";

export type ModuleStatusState = DisenoEstudioSourceState;

export type ModuleProgressStep = {
  label: string;
  state: "done" | "current" | "pending";
};

export type ModuleCardViz =
  | { kind: "phases"; done: number; total: number; labels: string[] }
  | { kind: "stat"; value: string; label: string }
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
  // «Cursos-horario» y no «Aulas»: es como lo llama el resto de la app —el modo
  // en la barra de Monitoreo, el selector de propósito, las tarjetas del
  // plan—. Dos nombres para la misma cosa obligan al lector a averiguar si son
  // dos cosas.
  aulas_universitarias: "Cursos-horario",
  acreditacion: "Acreditación",
  digital_general: "Digital",
};

/**
 * Lo que dice la tarjeta debajo de la cifra de preguntas. Si la cifra sale del
 * instrumento vinculado y el editor tiene abierto otro borrador, «en edición»
 * sería falso: el editor abre ese borrador, no el instrumento.
 */
export function subDelCuestionario(editor: {
  questions_count: number;
  draft_questions_count?: number;
  from_instrument?: boolean;
}): string {
  if (!editor.from_instrument) return "Cuestionario en edición";
  const borrador = editor.draft_questions_count ?? 0;
  if (borrador === editor.questions_count) return "Cuestionario en edición";
  return borrador > 0
    ? `Instrumento del estudio; el editor tiene abierto un borrador de ${formatCount(borrador)} ${borrador === 1 ? "pregunta" : "preguntas"}`
    : "Instrumento del estudio; todavía no está abierto en el editor";
}

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
  return overview.modules.find((item) => item.id === module.slug);
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
      // Una sola definición de avance, la del motor (L31): cada fase cuenta si
      // `overview.modules` la declara lista. Las banderas de la sesión que lee
      // `proc` exigían `state.xlsform` en una sesión multibase y la tarjeta
      // decía «Por iniciar · Sigue: Carga» con la base ya codificada y
      // Analítica lista. `proc` queda sólo para un backend que no publique fases.
      const fasesDelMotor = PROCESSING_STEPS.map(({ route }) =>
        overview.modules.find((item) => item.id === route.slice(1)),
      );
      const delMotor = fasesDelMotor.every(Boolean);
      const done = delMotor
        ? fasesDelMotor.filter((item) => item?.state === "ready").length
        : Math.min(total, Math.max(0, Math.trunc(proc.done)));
      const pendiente = delMotor ? fasesDelMotor.findIndex((item) => item?.state !== "ready") : -1;
      const nextIndex = delMotor
        ? (pendiente >= 0 ? pendiente : total - 1)
        : Math.min(done, total - 1);
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
      const monitoring: HechosDeMonitoreo = facts.monitoreo;
      // Mientras el tablero se regenera la cifra guardada es la del corte
      // anterior: la tarjeta dice el estado y no la publica como actual (L20).
      const regenerando = estaRegenerando(monitoring);
      const state: ModuleStatusState = regenerando ? "active" : monitoring.alerts > 0 ? "warning" : nodeState;
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
        regenerando
          ? { kind: "stat", value: "Actualizando", label: avanceLabel }
          : monitoring.avance_pct >= 0
          // Entero y con espacio, la convención de la insignia de Avance de
          // Monitoreo (`pctEntero`): «107 %» en los dos lados, no «106.9%» (L20).
          ? { kind: "stat", value: `${Math.round(monitoring.avance_pct)} %`, label: avanceLabel }
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
      // cuánto se ha recorrido de la base: la sub-línea dice la base del
      // porcentaje («423 de 400 efectivas») y si se cumplió o cuánto falta. El
      // recorrido baja a fact y el actor rezagado va a su propio pie, sin
      // encadenarlo con «·».
      const progressText = lineaDelAvance(monitoring);
      const lagging = regenerando ? "" : rezagado(monitoring);
      const alertText =
        monitoring.alerts > 0 ? `${formatCount(monitoring.alerts)} por revisar` : "";
      return {
        state,
        statusLabel: regenerando ? "Actualizando" : stateLabel(state),
        emphasis:
          monitoring.alerts > 0 ||
          (monitoring.avance_pct < 0 &&
            monitoring.valid === 0 &&
            monitoring.collected === 0 &&
            protocol.monitoring_sources_count === 0)
            ? "activity"
            : undefined,
        viz,
        // **El subtítulo no puede contradecir a la cifra que tiene encima.**
        //
        // `nodeState` lo declara el backend a partir del protocolo, y da
        // «ready» en cuanto el estudio declara su familia de monitoreo —aunque
        // no haya conectado ninguna fuente—. Medido en HSVG2026 el 2026-08-23,
        // la tarjeta decía a la vez «Sin fuentes» en grande y «Tablero
        // operativo conectado» debajo. Las dos salían del mismo payload y se
        // negaban entre sí.
        //
        // Sin fuentes manda la ausencia, porque es lo accionable: lo que hay
        // que hacer es conectar una, no leer que está conectado.
        sub:
          (regenerando ? (baseDelAvance(monitoring) ? `Corte anterior: ${baseDelAvance(monitoring)}` : "") : progressText) ||
          alertText ||
          (protocol.monitoring_sources_count === 0
            ? "Conecta una fuente para iniciar el seguimiento"
            : nodeState === "ready"
              ? "Tablero operativo conectado"
              : "Conecta una fuente para iniciar el seguimiento"),
        facts: [
          { label: "tipo", value: family },
          { label: "último corte", value: formatCutDate(metrics.monitoreo_last_cut) },
          {
            label: collectedLabel,
            // «Sin definir» sobre un cero miente: está definido, y es cero. Lo
            // que de verdad no se sabe es cuando todavía no ha llegado nada de
            // la plataforma —ahí no hay un cero medido, hay un hueco—, y eso lo
            // dice `has_snapshot`.
            value: monitoring.collected > 0
              ? formatCount(monitoring.collected)
              : monitoring.has_snapshot
                ? "0"
                : "Sin sincronizar",
          },
          ...(lagging ? [{ label: "va último", value: lagging }] : []),
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
            ? subDelCuestionario(editor)
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
      // ADR 0122 P2: un territorial por conveniencia no sortea UMP. Es un vacío legítimo, no un pendiente.
      if (routes.aplica === false) {
        return {
          state: "pending",
          statusLabel: "No aplica",
          viz: { kind: "stat", value: "No aplica", label: "en este estudio" },
          sub: "Este estudio no sortea manzanas: no lleva hojas de ruta.",
          facts: [],
          action: moduleAction(module, "Abrir hojas de ruta"),
          alert: null,
          summary: "No aplica en este estudio",
        };
      }
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
              ? "A partir de la muestra del piloto"
              : "Rutas y cartografía generadas"
            : "Genera las rutas para el equipo de campo",
        facts: routeFacts,
        action: moduleAction(module, "Abrir hojas de ruta"),
        alert: nodeAlert,
        summary,
      };
    }

    case "material-campo": {
      // Un backend viejo publicaba este bloque como `recopiladores`;
      // `normalizeProjectOverview` ya lo movió a su clave vigente.
      const collectors = facts["material-campo"];
      // ADR 0111 §9: con campañas, la tarjeta resume cada una con su avance.
      const porCampana = resumenDelInicio(collectors.campaigns);
      if (porCampana) {
        const estado: ModuleStatusState = nodeState === "warning" ? "warning" : porCampana.estado;
        return {
          state: estado,
          statusLabel: estado === "warning" ? "Requiere atención" : porCampana.statusLabel,
          viz: porCampana.viz,
          sub: porCampana.sub,
          facts: porCampana.facts,
          action: moduleAction(module, estado === "warning" ? "Revisar material de campo" : "Abrir material de campo"),
          alert: nodeAlert,
          summary,
        };
      }
      const total = Math.max(0, collectors.titulares);
      const current = Math.max(0, collectors.with_link);
      const planDeAulas = facts.calc.mode === "aulas";
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
              ? "Titulares con enlace"
              : state === "active"
                ? "En preparación"
                : "Por iniciar",
        viz: total > 0
          ? {
              kind: "progress",
              current,
              total,
              display: `${current}/${total}`,
              // **«titulares», no «fichas».** El denominador es
              // `collectors.titulares` porque el operativo real se mide sobre
              // ellas —«las reservas son respaldo», dice el motor—, pero la
              // palabra «ficha» significa otra cosa a un click de aqui: en
              // Materiales las fichas son las **2.616** unidades del plan,
              // porque una reserva necesita la suya impresa el dia que su
              // titular cae. Medido el 2026-08-23: «193 fichas» aqui y «0 de
              // 2.616» alla, las dos correctas y la misma palabra.
              label: "titulares con enlace",
            }
          : { kind: "stat", value: "Sin unidades", label: "en el plan" },
        emphasis: total > 0 ? undefined : "activity",
        // Neutral al tipo de campo: la tarjeta habla de unidades. «Aulas» y
        // «facultades» son vocabulario de un plan de aulas y solo aparecen
        // cuando el cálculo del estudio lo es.
        sub:
          total === 0
            ? "Espera la selección de la muestra"
            : collectors.without_link > 0
              ? `${formatCount(collectors.without_link)} titulares requieren enlace`
              : "Todos los titulares tienen enlace",
        // Los pies dicen lo que la barra NO dice. Tenían «con enlace 0» y
        // «faltantes 193» debajo de una barra que ya marcaba «0/193» y de un
        // subtítulo que ya decía «193 fichas requieren enlace»: el mismo dato
        // tres veces, gastando las tres ranuras de la tarjeta. `total` —las
        // 2.616 unidades del plan, titulares más reservas más banco— no se
        // enseñaba en ninguna parte.
        //
        // Dos pies y no tres a propósito: el otro dato disponible,
        // `eligible_total`, cuenta los elegibles de las 2.616 unidades y la
        // tarjeta de Cálculo, a diez centímetros, dice «5.987 estudiantes»
        // contando los de las titulares. Dos denominadores en la misma pantalla
        // es peor que un hueco.
        facts: [
          { label: "unidades en el plan", value: formatCount(collectors.total) },
          ...(planDeAulas
            ? [{ label: "facultades", value: formatCount(collectors.faculties_count) }]
            : []),
        ],
        action: moduleAction(
          module,
          state === "warning"
            ? "Revisar material de campo"
            : collectors.without_link > 0
              ? "Completar enlaces"
              : "Abrir material de campo",
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

    default:
      // Un slug sin tarjeta propia: el manifiesto ya no tiene Bitácora (ADR
      // 0124), y los slugs de legado sólo sobreviven en el tipo. Lectura
      // neutra, sin inventar datos.
      return {
        state: "pending",
        statusLabel: "Por iniciar",
        viz: { kind: "stat", value: "Sin lectura", label: "en este estudio" },
        sub: module.tagline,
        facts: [],
        action: moduleAction(module, `Abrir ${module.shortLabel}`),
        summary,
      };
  }
}
