import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import { Activity, CalendarDays, Database, Layers, Plus, SlidersHorizontal, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  PROSECNUR_PRIMARY_ACTIVE_MODULES,
  type ProsecnurModuleMeta,
  type ProsecnurModuleSlug,
} from "../../lib/modules";
import type { ProjectOverview } from "../../api/client";
import { ModuleStatusCard, type ModuleCardView, type ModuleStatusState } from "./ModuleStatusCard";

export type ProcState = {
  done: number;
  total: number;
  /** Sub-salidas de Analítica generadas (codebook, frecuencias, cruces, …) de un total. */
  analiticaDone: number;
  analiticaTotal: number;
  ppt: boolean;
  word: boolean;
};

function formatCutDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCount(value: number): string {
  return value > 0 ? value.toLocaleString("es-PE") : "—";
}

function formatSavedAt(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const minutes = Math.round((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return "guardado ahora";
  if (minutes < 60) return `guardado hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `guardado hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "guardado ayer";
  if (days < 30) return `guardado hace ${days} días`;
  return `guardado el ${d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}`;
}

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function dateViz(iso: string): { day: string; month: string; countdown: string; tone: "future" | "today" | "overdue" } {
  const d = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  const tone = diff < 0 ? "overdue" : diff === 0 ? "today" : "future";
  const countdown =
    diff < 0 ? `vencido hace ${Math.abs(diff)} d` : diff === 0 ? "es hoy" : diff === 1 ? "mañana" : `en ${diff} días`;
  return { day: String(d.getDate()), month: MONTHS_SHORT[d.getMonth()] ?? "", countdown, tone };
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

// Las fases de Hojas de ruta viven en inglés en el estado (field/pilot).
const ROUTE_PHASE_LABEL: Record<string, string> = {
  field: "Campo",
  campo: "Campo",
  pilot: "Piloto",
  piloto: "Piloto",
};

function routePhaseLabel(phase: string): string {
  if (!phase) return "—";
  return ROUTE_PHASE_LABEL[phase.toLowerCase()] ?? capitalize(phase);
}

// Etiquetas legibles del tipo de monitoreo (familia del perfil dinámico).
const MONITOREO_FAMILY_LABEL: Record<string, string> = {
  territorial: "Territorial",
  telefonico: "Telefónico",
  aulas_universitarias: "Aulas",
  acreditacion: "Acreditación",
  digital_general: "Digital",
};

// Origen del cuestionario en el Editor (xlsform_state.source.kind).
const FORM_ORIGIN_LABEL: Record<string, string> = {
  "": "Desde cero",
  xlsform: "Importado",
  surveymonkey: "SurveyMonkey",
};

// Indicador y facts específicos del dominio de cada módulo, CONSCIENTES DEL MODO
// que el proyecto está usando (territorial vs telefónico, aulas vs territorial,
// desde cero vs importado…). La regla: el hero responde "¿qué me dice esta
// herramienta hoy?" y los facts aportan las 2-3 cifras que un investigador
// realmente consulta antes de entrar. Cada card lee su propio namespace de
// `overview.facts.<módulo>`, no cifras genéricas de la data.
function buildModuleCardView(
  module: ProsecnurModuleMeta,
  overview: ProjectOverview,
  proc: ProcState,
): ModuleCardView {
  const p = overview.protocol;
  const m = overview.metrics;
  const f = overview.facts;
  const nf = formatCount;
  const node = overview.modules.find((item) => item.id === module.slug);
  const state: ModuleStatusState = node?.state ?? "pending";
  const alert = state === "warning" ? "Revisar" : null;

  switch (module.slug) {
    case "procesamiento": {
      const done = proc.done;
      const total = proc.total;
      const procState: ModuleStatusState =
        total > 0 && done >= total ? "ready" : done > 0 ? "active" : "pending";
      const labels = ["Carga", "Valid.", "Codif.", "Analít.", "Gráf."];
      const sub =
        total > 0 && done >= total
          ? "Procesamiento completo"
          : done > 0
            ? `Sigue: ${labels[done] ?? "cierre"}`
            : "Aún sin iniciar";
      const entregables = [proc.ppt && "PPT", proc.word && "Word"].filter(Boolean).join(" · ");
      const lastFact = entregables
        ? { label: "entregables", value: entregables }
        : {
            label: "salidas",
            value: proc.analiticaDone > 0 ? `${proc.analiticaDone}/${proc.analiticaTotal}` : "—",
          };
      // Sin barra de avance lineal: el hero es lo que el módulo tiene entre
      // manos (registros), y el sub dice en qué está. No "fase 3 de 5".
      return {
        state: procState,
        viz:
          m.records_count > 0
            ? { kind: "stat", value: nf(m.records_count), label: "registros procesados" }
            : { kind: "stat", value: nf(m.bases_count), label: "bases cargadas" },
        sub,
        facts: [
          { label: "variables", value: nf(m.variables_count) },
          { label: "bases", value: nf(m.bases_count) },
          lastFact,
        ],
      };
    }
    case "monitoreo": {
      const mon = f.monitoreo;
      const cut = formatCutDate(m.monitoreo_last_cut);
      const familyLabel =
        MONITOREO_FAMILY_LABEL[mon.family] ?? (mon.family ? capitalize(mon.family) : "—");
      const heroIsAvance = mon.avance_pct >= 0;
      const heroIsCasos = !heroIsAvance && mon.collected > 0;
      const viz: ModuleCardView["viz"] = heroIsAvance
        ? { kind: "stat", value: `${mon.avance_pct}%`, label: "avance de campo" }
        : heroIsCasos
          ? { kind: "stat", value: nf(mon.collected), label: "casos recolectados" }
          : { kind: "stat", value: nf(p.monitoring_sources_count), label: "fuentes de campo" };
      const monAlert =
        mon.alerts > 0 ? `${nf(mon.alerts)} por revisar` : state === "warning" ? "Revisar" : null;
      return {
        state,
        viz,
        sub:
          mon.collected > 0
            ? `${nf(mon.valid)} válidos de ${nf(mon.collected)}`
            : state === "warning"
              ? "Hay señales del tablero por revisar"
              : state === "ready"
                ? "Tablero operativo conectado"
                : "Sin fuentes de campo conectadas",
        facts: [
          { label: "tipo", value: familyLabel },
          heroIsAvance
            ? { label: "casos", value: mon.collected > 0 ? nf(mon.collected) : "—" }
            : { label: "válidos", value: mon.valid > 0 ? nf(mon.valid) : "—" },
          { label: "último corte", value: cut || "—" },
        ],
        alert: monAlert,
      };
    }
    case "calc-muestra": {
      const calc = f.calc;
      if (calc.mode === "aulas") {
        return {
          state,
          viz: {
            kind: "stat",
            value: nf(calc.aulas_titulares || p.classroom_units_count),
            label: "aulas titulares",
          },
          sub: state === "ready" ? "Muestra de aulas trazable" : "Sin selección de aulas",
          facts: [
            { label: "estudiantes", value: nf(calc.students_covered) },
            { label: "facultades", value: nf(calc.faculties_count) },
            { label: "n objetivo", value: nf(p.sample_target_n) },
          ],
          alert,
        };
      }
      if (calc.mode === "territorial") {
        return {
          state,
          viz: { kind: "stat", value: nf(p.sample_target_n), label: "n objetivo" },
          sub: state === "ready" ? "Diseño territorial trazable" : "Sin diseño muestral calculado",
          facts: [
            { label: "n operativo", value: nf(p.sample_operational_n) },
            { label: "territorios", value: nf(calc.territories_count) },
            { label: "componentes", value: nf(p.sample_components_count) },
          ],
          alert,
        };
      }
      const showActors = calc.actors_count > 1;
      return {
        state,
        viz: { kind: "stat", value: nf(p.sample_target_n), label: "n objetivo" },
        sub: state === "ready" ? "Diseño muestral trazable" : "Sin diseño muestral calculado",
        facts: [
          { label: "n operativo", value: nf(p.sample_operational_n) },
          { label: "componentes", value: nf(p.sample_components_count) },
          {
            label: showActors ? "actores" : "técnicas",
            value: nf(showActors ? calc.actors_count : calc.techniques_count),
          },
        ],
        alert,
      };
    }
    case "editor-xlsform": {
      const ed = f.editor;
      const hasForm = ed.questions_count > 0;
      return {
        state,
        viz: hasForm
          ? { kind: "stat", value: nf(ed.questions_count), label: "preguntas" }
          : { kind: "stat", value: nf(p.instruments_count), label: "instrumentos" },
        sub: hasForm
          ? "Cuestionario en edición"
          : state === "ready"
            ? "Cuestionario vinculado al estudio"
            : "Sin instrumento aún",
        facts: [
          { label: "secciones", value: nf(ed.sections_count) },
          { label: "origen", value: hasForm ? FORM_ORIGIN_LABEL[ed.source_kind] ?? "—" : "—" },
          { label: "variables", value: nf(m.variables_count) },
        ],
        alert,
      };
    }
    case "hojas-ruta": {
      const hr = f.hojas;
      return {
        state,
        viz: { kind: "stat", value: routePhaseLabel(p.route_phase || hr.phase), label: "fase actual" },
        sub:
          state === "ready"
            ? hr.from_pilot
              ? "Campo derivado del piloto"
              : "Rutas y cartografía generadas"
            : "Sin rutas generadas aún",
        facts: [
          { label: "distritos", value: nf(hr.districts_count) },
          hr.blocks_count > 0
            ? { label: "manzanas", value: nf(hr.blocks_count) }
            : { label: "cuotas", value: nf(hr.quota_assigned) },
          {
            label: "entrevistas",
            value: nf(hr.interviews_count > 0 ? hr.interviews_count : hr.n_objetivo),
          },
        ],
        alert,
      };
    }
    case "recopiladores": {
      const rc = f.recopiladores;
      const hasPlan = rc.titulares > 0;
      return {
        state,
        viz: {
          kind: "stat",
          value: nf(rc.titulares || p.classroom_units_count),
          label: "aulas titulares",
        },
        sub: hasPlan
          ? `${nf(rc.with_link)} con enlace`
          : state !== "pending"
            ? "Fichas QR conectadas a Monitoreo"
            : "Requiere selección de aulas",
        facts: [
          { label: "con enlace", value: hasPlan ? nf(rc.with_link) : "—" },
          { label: "por generar", value: rc.without_link > 0 ? nf(rc.without_link) : "—" },
          { label: "facultades", value: nf(rc.faculties_count) },
        ],
        alert,
      };
    }
    case "dashboard": {
      const db = f.dashboard;
      return {
        state,
        viz: { kind: "windows", items: ["Resumen", "Cruces", "Base"], label: "ventanas del tablero" },
        sub: db.published
          ? "Publicado para tu cliente"
          : db.confirmed
            ? "Curación confirmada"
            : state === "ready"
              ? "Listo para compartir con tu cliente"
              : "Requiere bases procesadas",
        facts: [
          { label: "secciones", value: nf(db.sections_count) },
          { label: "registros", value: nf(db.rows_count || m.records_count) },
          {
            label: db.published ? "publicado" : "curación",
            value: db.published ? "sí" : db.confirmed ? "confirmada" : "pendiente",
          },
        ],
        alert,
      };
    }
    case "diseno-estudio":
    default: {
      const b = overview.facts.bitacora;
      // Lo que el usuario REGISTRA (entradas del log) primero, luego el plan.
      const facts = [
        { label: "registros", value: nf(b.entries_count) },
        { label: "decisiones", value: b.decisions_count > 0 ? nf(b.decisions_count) : "—" },
        { label: "pendientes", value: nf(b.pending) },
      ];
      if (b.next_date) {
        const dv = dateViz(b.next_date);
        return {
          state: "ready",
          viz: { kind: "date", day: dv.day, month: dv.month, label: "próximo entregable", countdown: dv.countdown, tone: dv.tone },
          sub: b.next_title || `${b.pending} pendiente(s)`,
          facts,
        };
      }
      return {
        state: "ready",
        viz:
          b.entries_count > 0
            ? { kind: "stat", value: nf(b.entries_count), label: "registros" }
            : { kind: "stat", value: nf(b.pending), label: "pendientes" },
        sub: b.last_entry_title
          ? `Última: ${b.last_entry_title}`
          : b.total_tasks > 0
            ? "Cronograma activo, sin entregable con fecha"
            : "Registra decisiones y arma el cronograma",
        facts,
      };
    }
  }
}

// Los next_actions del backend hablan de rutas internas (/carga, /validacion…).
// Las traducimos al módulo dueño para no invitar módulos que el proyecto no agregó.
function routeToSlug(route: string): ProsecnurModuleSlug | null {
  if (!route || route === "/") return null;
  if (route.startsWith("/bitacora")) return "diseno-estudio";
  if (route.startsWith("/tablero")) return "dashboard";
  const processing = ["/carga", "/validacion", "/codificacion", "/analitica", "/graficos", "/procesamiento"];
  if (processing.some((prefix) => route.startsWith(prefix))) return "procesamiento";
  const direct = PROSECNUR_PRIMARY_ACTIVE_MODULES.find((module) => route.startsWith(module.to));
  return direct?.slug ?? null;
}

export function MissionControl({
  overview,
  proc,
  addedSlugs,
  onAddModule,
  onRemoveModule,
}: {
  overview: ProjectOverview;
  proc: ProcState;
  addedSlugs: string[];
  onAddModule: () => void;
  onRemoveModule: (slug: string) => void;
}) {
  const metrics = overview.metrics;
  const navigate = useNavigate();
  const [confirmSlug, setConfirmSlug] = useState<string | null>(null);

  const cards = PROSECNUR_PRIMARY_ACTIVE_MODULES.filter((module) =>
    addedSlugs.includes(module.slug),
  ).map((module) => {
    const view = buildModuleCardView(module, overview, proc);
    const node = overview.modules.find((item) => item.id === module.slug);
    return { module, view: { ...view, summary: node?.summary ?? "" } };
  });

  const confirmModule = cards.find((card) => card.module.slug === confirmSlug)?.module;

  // FLIP: al agregar/quitar un módulo, las tarjetas cambian de tamaño y de
  // posición (la densidad reflowa el grid). Animamos ese reflow — medimos las
  // posiciones nuevas, invertimos con transform y transicionamos a cero — para
  // que el board "respire" en vez de saltar. Respeta prefers-reduced-motion.
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const addedKey = addedSlugs.join(",");

  useLayoutEffect(() => {
    const nextRects = new Map<string, DOMRect>();
    cardRefs.current.forEach((el, slug) => nextRects.set(slug, el.getBoundingClientRect()));
    const reduce =
      typeof window !== "undefined" &&
      Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    if (!reduce) {
      cardRefs.current.forEach((el, slug) => {
        const prev = prevRects.current.get(slug);
        const next = nextRects.get(slug);
        if (!prev || !next) return;
        const dx = prev.left - next.left;
        const dy = prev.top - next.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        el.style.transition = "none";
        requestAnimationFrame(() => {
          el.style.transform = "";
          el.style.transition = "transform 460ms cubic-bezier(0.32, 0.72, 0, 1)";
          const clear = () => {
            el.style.transition = "";
            el.removeEventListener("transitionend", clear);
          };
          el.addEventListener("transitionend", clear);
        });
      });
    }
    prevRects.current = nextRects;
  }, [addedKey]);

  // Sin banda de métricas global: los módulos son herramientas independientes,
  // no fases de un avance lineal. Cada tarjeta reporta la sustancia de su
  // módulo (qué tiene, qué hace, cómo va) desde overview.facts.<módulo>; no se
  // sacan cifras globales fuera de contexto al encabezado.

  // Derivado de los estados por módulo (no de next_actions, que el backend
  // capa a 5 antes de poder filtrar por módulos agregados).
  const nextSteps = useMemo(() => {
    const seen = new Set<string>();
    const steps: { label: string; route: string; summary: string; module: ProsecnurModuleMeta }[] = [];
    for (const node of overview.modules ?? []) {
      if (node.state === "ready" || !node.route || node.route === "/") continue;
      const slug = routeToSlug(node.route);
      if (!slug || !addedSlugs.includes(slug) || seen.has(node.route)) continue;
      const module = PROSECNUR_PRIMARY_ACTIVE_MODULES.find((item) => item.slug === slug);
      if (!module) continue;
      seen.add(node.route);
      steps.push({ label: node.label, route: node.route, summary: node.summary, module });
      if (steps.length >= 4) break;
    }
    return steps;
  }, [overview.modules, addedSlugs]);

  const metaLine = [
    overview.project.client,
    overview.project.project_file,
    formatSavedAt(overview.project.saved_at),
  ].filter(Boolean);

  return (
    <section className="home-mission" aria-label="Estado del proyecto">
      <header className="home-mission-head">
        <div className="home-mission-id">
          <p className="home-mission-kicker">Proyecto</p>
          <h1 className="home-mission-title">{overview.project.name}</h1>
          {metaLine.length > 0 && (
            <p className="home-mission-client">
              {metaLine.map((part, i) => (
                <span key={i}>
                  {i > 0 && <span className="home-mission-meta-dot" aria-hidden="true">·</span>}
                  {part}
                </span>
              ))}
            </p>
          )}
        </div>
      </header>

      {nextSteps.length > 0 && (
        <div className="home-mission-next">
          <p className="home-mission-next-label">Siguientes pasos</p>
          <div className="home-mission-next-list">
            {nextSteps.map((step) => (
              <button
                key={step.route}
                type="button"
                className="home-mission-next-item"
                title={step.summary}
                onClick={() => navigate(step.route)}
              >
                <step.module.icon size={13} aria-hidden="true" />
                <span>{step.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="home-mission-grid" data-density={cards.length <= 3 ? "spacious" : cards.length <= 6 ? "balanced" : "dense"}>
        {cards.map(({ module, view }, index) => (
          <ModuleStatusCard
            key={module.slug}
            ref={(el) => {
              if (el) cardRefs.current.set(module.slug, el);
              else cardRefs.current.delete(module.slug);
            }}
            module={module}
            view={view}
            index={index}
            onRequestRemove={setConfirmSlug}
          />
        ))}
        <button
          type="button"
          className="home-mc-add-card"
          onClick={onAddModule}
          style={{ "--i": cards.length } as CSSProperties}
        >
          <span className="home-mc-add-icon" aria-hidden="true">
            <Plus size={22} strokeWidth={2.2} />
          </span>
          <strong>Agregar módulo</strong>
        </button>
      </div>

      {confirmModule && createPortal(
        <div className="home-confirm-backdrop" role="dialog" aria-modal="true" onClick={() => setConfirmSlug(null)}>
          <div className="home-confirm" onClick={(event) => event.stopPropagation()}>
            <strong>¿Quitar {confirmModule.shortLabel} del proyecto?</strong>
            <p>
              El módulo dejará de aparecer en este proyecto. Puedes volver a agregarlo cuando
              quieras; su información no se borra.
            </p>
            <div className="home-confirm-actions">
              <button type="button" className="plan-button" onClick={() => setConfirmSlug(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="home-confirm-remove"
                onClick={() => {
                  onRemoveModule(confirmModule.slug);
                  setConfirmSlug(null);
                }}
              >
                Quitar del proyecto
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}

