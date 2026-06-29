import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  Library,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import {
  apiDisenoEstudioBitacoraDelete,
  apiDisenoEstudioBitacoraUpsert,
  apiDisenoEstudioState,
  type DisenoEstudioBitacoraEntry,
  type DisenoEstudioBitacoraInput,
  type DisenoEstudioBitacoraTone,
  type DisenoEstudioSource,
  type DisenoEstudioState,
  type DisenoEstudioTimelineItem,
} from "../../api/client";
import { Alert } from "../../components/Alert";
import { LoadingBlock } from "../../components/States";
import { PageFrame } from "../../components/PageFrame";
import { moduleChromeVars, PROSECNUR_MODULES } from "../../lib/modules";
import "./disenoEstudio.css";

type Section = "expediente" | "bitacora" | "fuentes" | "biblioteca";

const MODULE_OPTIONS = [
  ["diseno-estudio", "Diseño"],
  ["editor-xlsform", "Formulario"],
  ["carga", "Carga"],
  ["validacion", "Validación"],
  ["codificacion", "Codificación"],
  ["analitica", "Analítica"],
  ["graficos", "Gráficos"],
  ["dashboard", "Dashboard"],
  ["calc-muestra", "Muestra"],
  ["hojas-ruta", "Rutas"],
  ["recopiladores", "Fichas QR"],
  ["monitoreo", "Monitoreo"],
  ["proyecto", "Proyecto"],
] as const;

const TONE_OPTIONS: Array<[DisenoEstudioBitacoraTone, string]> = [
  ["nota", "Nota"],
  ["decision", "Decisión"],
  ["avance", "Avance"],
  ["riesgo", "Riesgo"],
  ["bloqueo", "Bloqueo"],
];

const SECTION_META: Array<{ key: Section; label: string; icon: typeof FileText }> = [
  { key: "expediente", label: "Expediente", icon: FileText },
  { key: "bitacora", label: "Bitácora", icon: ClipboardCheck },
  { key: "fuentes", label: "Fuentes", icon: CheckCircle2 },
  { key: "biblioteca", label: "Biblioteca", icon: Library },
];

const DESIGN_MODULE = PROSECNUR_MODULES.find((module) => module.slug === "diseno-estudio") ?? PROSECNUR_MODULES[0];

const EMPTY_ENTRY: DisenoEstudioBitacoraInput = {
  module_id: "diseno-estudio",
  tone: "nota",
  title: "",
  body: "",
  tags: [],
};

function fmt(value: number | null | undefined) {
  return Intl.NumberFormat("es-PE").format(Number(value ?? 0));
}

function moduleLabel(id: string) {
  return MODULE_OPTIONS.find(([key]) => key === id)?.[1] ?? id;
}

function stateLabel(state: DisenoEstudioSource["state"]) {
  if (state === "ready") return "Listo";
  if (state === "active") return "En curso";
  if (state === "warning") return "Revisar";
  return "Pendiente";
}

function toneLabel(tone: string) {
  return TONE_OPTIONS.find(([key]) => key === tone)?.[1] ?? tone;
}

function dateLabel(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function DisenoEstudioPage() {
  const [section, setSection] = useState<Section>("expediente");
  const [state, setState] = useState<DisenoEstudioState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DisenoEstudioBitacoraInput>(EMPTY_ENTRY);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      setState(await apiDisenoEstudioState());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el diseño del estudio.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const topRisks = useMemo(() => state?.risks.slice(0, 3) ?? [], [state?.risks]);

  async function saveEntry() {
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title && !body) return;
    setSaving(true);
    setError(null);
    try {
      const next = await apiDisenoEstudioBitacoraUpsert({
        ...draft,
        title: title || "Nota de bitácora",
        body,
      });
      setState(next);
      setDraft(EMPTY_ENTRY);
      setSection("bitacora");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la bitácora.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    setSaving(true);
    setError(null);
    try {
      setState(await apiDisenoEstudioBitacoraDelete(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la entrada.");
    } finally {
      setSaving(false);
    }
  }

  function editEntry(entry: DisenoEstudioBitacoraEntry) {
    setDraft({
      id: entry.id,
      module_id: entry.module_id,
      tone: entry.tone,
      title: entry.title,
      body: entry.body,
      occurred_at: entry.occurred_at,
      tags: entry.tags,
    });
    setSection("bitacora");
  }

  if (loading && !state) {
    return <LoadingBlock label="Abriendo diseño del estudio..." />;
  }

  return (
    <PageFrame
      title="Diseño del estudio"
      headerMode="sr-only"
      layout="workbench"
      bodyMode="fill"
      scrollOwner="panels"
      className="diseno-frame"
    >
      <div className="diseno-shell" style={moduleChromeVars(DESIGN_MODULE)}>
        <div className="diseno-commandbar">
          <div className="diseno-commandbar-main">
            <span className="diseno-module-mark" aria-hidden="true">
              <ClipboardCheck size={17} />
            </span>
            <div>
              <strong>{state?.protocol.title || "Diseño del estudio"}</strong>
              <span>{state?.protocol.client || state?.protocol.project_file || "Proyecto local"}</span>
            </div>
          </div>
          <div className="diseno-commandbar-actions">
            <span className="diseno-score" aria-label={`Completitud ${state?.readiness.score ?? 0}%`}>
              {state?.readiness.score ?? 0}%
            </span>
            <button type="button" className="diseno-icon-button" onClick={load} title="Actualizar">
              {loading ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
            </button>
          </div>
        </div>

        <nav className="diseno-section-rail" aria-label="Secciones de diseño del estudio">
          {SECTION_META.map((item) => {
            const Icon = item.icon;
            const active = section === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={active ? "is-active" : ""}
                aria-pressed={active}
                onClick={() => setSection(item.key)}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {error && <Alert kind="error"><strong>No se pudo completar la acción.</strong> {error}</Alert>}

        {state && (
          <div className="diseno-workbench">
            <aside className="diseno-sidebar" aria-label="Resumen del expediente">
              <div className="diseno-readiness-ring" style={{ "--score": `${state.readiness.score}%` } as CSSProperties}>
                <span>{state.readiness.score}%</span>
                <small>{state.readiness.ready_count}/{state.readiness.total_count} fuentes</small>
              </div>
              <div className="diseno-side-metrics">
                <Metric label="Bases" value={fmt(state.protocol.bases_count)} />
                <Metric label="Registros" value={fmt(state.protocol.records_count)} />
                <Metric label="n objetivo" value={fmt(state.protocol.sample_target_n)} />
                <Metric label="Fuentes campo" value={fmt(state.protocol.monitoring_sources_count)} />
              </div>
              <div className="diseno-next-list">
                <strong>Próximos pasos</strong>
                {state.next_actions.slice(0, 4).map((action) => (
                  <Link key={`${action.route}-${action.label}`} to={action.route}>
                    <span>{action.label}</span>
                    <small>{stateLabel(action.state)}</small>
                  </Link>
                ))}
              </div>
            </aside>

            <main className="diseno-content">
              {section === "expediente" && (
                <ExpedienteSection state={state} risks={topRisks} />
              )}
              {section === "bitacora" && (
                <BitacoraSection
                  state={state}
                  draft={draft}
                  saving={saving}
                  onDraftChange={setDraft}
                  onSave={saveEntry}
                  onEdit={editEntry}
                  onDelete={deleteEntry}
                />
              )}
              {section === "fuentes" && <FuentesSection sources={state.sources} />}
              {section === "biblioteca" && <BibliotecaSection state={state} />}
            </main>
          </div>
        )}
      </div>
    </PageFrame>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ExpedienteSection({ state, risks }: { state: DisenoEstudioState; risks: DisenoEstudioState["risks"] }) {
  const protocol = state.protocol;
  return (
    <div className="diseno-section-stack">
      <section className="diseno-protocol-board">
        <article>
          <span>Proyecto</span>
          <strong>{protocol.title}</strong>
          <p>{protocol.description || "Sin descripción redactada."}</p>
        </article>
        <article>
          <span>Insumos</span>
          <strong>{fmt(protocol.records_count)} registros</strong>
          <p>{fmt(protocol.bases_count)} base(s), {fmt(protocol.instruments_count)} instrumento(s), {fmt(protocol.variables_count)} variables.</p>
        </article>
        <article>
          <span>Muestra</span>
          <strong>{fmt(protocol.sample_target_n)} objetivo</strong>
          <p>{fmt(protocol.sample_components_count)} componente(s), {fmt(protocol.sample_operational_n)} operativo, {fmt(protocol.classroom_units_count)} aulas.</p>
        </article>
        <article>
          <span>Campo</span>
          <strong>{protocol.monitoring_family || "Sin perfil"}</strong>
          <p>{fmt(protocol.monitoring_sources_count)} fuente(s), fase territorial {protocol.route_phase || "pendiente"}.</p>
        </article>
      </section>

      <section className="diseno-two-col">
        <div className="diseno-panel">
          <div className="diseno-panel-head">
            <CheckCircle2 size={16} />
            <strong>Decisiones trazables</strong>
          </div>
          <div className="diseno-list">
            {state.decisions.map((item) => (
              <article key={`${item.source}-${item.title}`} className={`is-${item.tone}`}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <span>{item.source}</span>
              </article>
            ))}
          </div>
        </div>
        <div className="diseno-panel">
          <div className="diseno-panel-head">
            <AlertTriangle size={16} />
            <strong>Control de riesgos</strong>
          </div>
          <div className="diseno-list">
            {risks.map((item) => (
              <Link key={`${item.route}-${item.title}`} to={item.route} className={`is-${item.severity}`}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <span>{item.route}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function BitacoraSection({
  state,
  draft,
  saving,
  onDraftChange,
  onSave,
  onEdit,
  onDelete,
}: {
  state: DisenoEstudioState;
  draft: DisenoEstudioBitacoraInput;
  saving: boolean;
  onDraftChange: (next: DisenoEstudioBitacoraInput) => void;
  onSave: () => void;
  onEdit: (entry: DisenoEstudioBitacoraEntry) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="diseno-bitacora-grid">
      <section className="diseno-compose">
        <div className="diseno-panel-head">
          <Pencil size={16} />
          <strong>{draft.id ? "Editar entrada" : "Nueva entrada"}</strong>
        </div>
        <div className="diseno-compose-row">
          <label>
            <span>Módulo</span>
            <select
              value={draft.module_id ?? "diseno-estudio"}
              onChange={(event) => onDraftChange({ ...draft, module_id: event.target.value })}
            >
              {MODULE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Tipo</span>
            <select
              value={draft.tone ?? "nota"}
              onChange={(event) => onDraftChange({ ...draft, tone: event.target.value as DisenoEstudioBitacoraTone })}
            >
              {TONE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span>Título</span>
          <input
            value={draft.title}
            onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
            placeholder="Decisión, incidencia o avance"
          />
        </label>
        <label>
          <span>Detalle</span>
          <textarea
            value={draft.body}
            onChange={(event) => onDraftChange({ ...draft, body: event.target.value })}
            placeholder="Redacta la evidencia, el acuerdo o el contexto operativo"
            rows={8}
          />
        </label>
        <div className="diseno-compose-actions">
          {draft.id && (
            <button type="button" className="diseno-secondary-button" onClick={() => onDraftChange(EMPTY_ENTRY)}>
              Cancelar
            </button>
          )}
          <button type="button" className="diseno-primary-button" onClick={onSave} disabled={saving || (!draft.title.trim() && !draft.body.trim())}>
            {saving ? <Loader2 size={15} className="spin" /> : draft.id ? <Save size={15} /> : <Plus size={15} />}
            <span>{draft.id ? "Guardar edición" : "Registrar"}</span>
          </button>
        </div>
      </section>

      <section className="diseno-timeline" aria-label="Bitácora viva">
        {state.timeline.slice(0, 40).map((item) => (
          <TimelineItem
            key={item.id}
            item={item}
            manual={state.bitacora.find((entry) => entry.id === item.id) ?? null}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </section>
    </div>
  );
}

function TimelineItem({
  item,
  manual,
  onEdit,
  onDelete,
}: {
  item: DisenoEstudioTimelineItem;
  manual: DisenoEstudioBitacoraEntry | null;
  onEdit: (entry: DisenoEstudioBitacoraEntry) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <article className={`diseno-timeline-item is-${item.tone} ${item.kind === "manual" ? "is-manual" : ""}`}>
      <div className="diseno-timeline-dot" aria-hidden="true" />
      <div className="diseno-timeline-body">
        <div className="diseno-timeline-meta">
          <span>{moduleLabel(item.module_id)}</span>
          <span>{toneLabel(item.tone)}</span>
          {item.occurred_at && <span><Clock3 size={12} /> {dateLabel(item.occurred_at)}</span>}
        </div>
        <strong>{item.title}</strong>
        <p>{item.body}</p>
        <div className="diseno-timeline-footer">
          <span>{item.source}</span>
          {manual ? (
            <span className="diseno-entry-actions">
              <button type="button" onClick={() => onEdit(manual)} title="Editar entrada">
                <Pencil size={13} />
              </button>
              <button type="button" onClick={() => onDelete(manual.id)} title="Eliminar entrada">
                <Trash2 size={13} />
              </button>
            </span>
          ) : item.route ? (
            <Link to={item.route}>Abrir</Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function FuentesSection({ sources }: { sources: DisenoEstudioSource[] }) {
  return (
    <section className="diseno-source-grid">
      {sources.map((source) => (
        <Link key={source.id} to={source.route} className={`diseno-source-card is-${source.state}`}>
          <div>
            <span>{source.category}</span>
            <strong>{source.label}</strong>
          </div>
          <em>{stateLabel(source.state)}</em>
          <p>{source.summary}</p>
          {source.evidence.length > 0 && (
            <ul>
              {source.evidence.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
        </Link>
      ))}
    </section>
  );
}

function BibliotecaSection({ state }: { state: DisenoEstudioState }) {
  return (
    <div className="diseno-biblioteca">
      <section className="diseno-panel">
        <div className="diseno-panel-head">
          <BookOpen size={16} />
          <strong>Biblioteca metodológica</strong>
        </div>
        <div className="diseno-library-metrics">
          <Metric label="Metodologías" value={fmt(state.library.methodologies_count)} />
          <Metric label="Familias" value={fmt(state.library.study_families_count)} />
          <Metric label="Actualización" value={state.library.updated_at || "Local"} />
        </div>
        <p>{state.library.source}</p>
        <div className="diseno-library-actions">
          <Link to="/enciclopedia" className="diseno-primary-button">
            <Library size={15} />
            <span>Abrir biblioteca</span>
          </Link>
          <Link to="/calc-muestra" className="diseno-secondary-button">
            <FileText size={15} />
            <span>Ir a cálculo</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
