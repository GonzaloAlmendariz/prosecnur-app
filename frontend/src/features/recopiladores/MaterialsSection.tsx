import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import { downloadUrl } from "../../api/core";
import {
  COLLECTION_BLOCK_TYPES,
  apiRecopiladoresMaterialInstances,
  apiRecopiladoresMaterialsRender,
  apiRecopiladoresMaterialTemplateGet,
  apiRecopiladoresMaterialTemplatePut,
  type CollectionArtifactReceipt,
  type CollectionBlockType,
  type CollectionMaterialBlock,
  type CollectionMaterialField,
  type CollectionMaterialInstance,
  type CollectionMaterialRenderResult,
  type CollectionMaterialTemplate,
  type CollectionStatePayload,
} from "../../api/recopiladores";
import { JobProgress } from "../../components/JobProgress";
import { PulsoButton } from "../../components/PulsoButton";
import {
  Archive,
  Download,
  FileText,
  Image,
  Layers,
  Loader2,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
} from "../../vendor/lucide-react";
import type { RecopiladoresPestana } from "./navegacion";
import {
  createTemplateHistory,
  templateHistoryReducer,
  templateHistoryShortcut,
} from "./templateHistory";
import "./styles/materials.css";

type Props = {
  payload: CollectionStatePayload | null;
  activeTab: RecopiladoresPestana;
  onStateRefresh: () => Promise<void>;
  onArtifact: (artifact: CollectionArtifactReceipt | null) => void;
  /** Avisa al shell mientras la plantilla no está: sin esto la página se
      declaraba lista con el panel aún en «Leyendo plantilla semántica…», y el QA
      visual medía el esqueleto. */
  onCargando?: (cargando: boolean) => void;
};

const BLOCK_LABELS: Record<CollectionBlockType, string> = {
  brand_header: "Cabecera de marca",
  heading: "Título",
  body: "Texto",
  access_qr: "QR de acceso",
  field_grid: "Campos de la unidad",
  instructions: "Instrucciones",
  application_log: "Registro de aplicación",
  divider: "Separador",
  footer: "Pie de página",
};

const BINDING_OPTIONS = [
  "access.qr_payload",
  "unit.label",
  "unit.schedule",
  "unit.venue",
  "unit.role",
  "deployment.deployment_id",
  "project.name",
];

export function materialFieldBinding(field: CollectionMaterialField): string {
  return typeof field === "string" ? field : field.binding;
}

export function materialFieldCanvasLabel(field: CollectionMaterialField): string {
  if (typeof field === "string") return field;
  return field.label ? `${field.label} (${field.binding})` : field.binding;
}

// Semilla vacía: sólo ocupa el reducer hasta que resuelve el GET, y no se
// dibuja nunca (el componente corta en `loading`).
//
// Aquí vivía una `DEFAULT_COLLECTION_TEMPLATE` completa que parecía la ficha de
// la casa y no lo era: el backend siempre responde una plantilla —cae a
// `collection_material_builtin_template()`—, así que su rama de fallback era
// inalcanzable y nadie la mantenía. Había derivado hasta tener otro
// `template_id`, otra revisión, campos sin etiqueta y ni separador ni registro
// de aplicación. Una segunda fuente de verdad que nadie consulta no se
// sincroniza: se borra, porque el día que alguien la lea va a creerle.
const TEMPLATE_PLACEHOLDER: CollectionMaterialTemplate = {
  schema: "collection_material_template/v1",
  template_id: "",
  revision: 1,
  preset_id: "ficha_aplicacion_a4_v1",
  material_kind: "application_sheet",
  compatible_adapters: [],
  page: { size: "A4", orientation: "portrait" },
  pages: [{ page_id: "ficha", layout_preset: "single_sheet", blocks: [] }],
  brand_ref: "pulso-default",
  sensitivity_policy: "operational",
};

function firstReceipt(result: CollectionMaterialRenderResult): CollectionArtifactReceipt | null {
  if (result.receipt?.schema === "collection_artifact_receipt/v1") return result.receipt;
  if (Array.isArray(result.manifest)) {
    return result.manifest.find((item) => item.schema === "collection_artifact_receipt/v1") ?? null;
  }
  return result.manifest?.schema === "collection_artifact_receipt/v1" ? result.manifest : null;
}

function blockSeed(type: CollectionBlockType, ordinal: number): CollectionMaterialBlock {
  const shared = { block_id: `${type}-${ordinal}`, type };
  if (type === "access_qr") return { ...shared, binding: "access.qr_payload", required: true };
  if (type === "field_grid") return { ...shared, fields: ["unit.label", "unit.schedule", "unit.venue"] };
  if (["heading", "body", "instructions"].includes(type)) return { ...shared, text: BLOCK_LABELS[type] };
  if (type === "footer") return { ...shared, binding: "deployment.deployment_id" };
  return shared;
}

function MaterialCanvas({ template, selectedId, onSelect }: {
  template: CollectionMaterialTemplate;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const blocks = template.pages[0]?.blocks ?? [];
  return (
    <div className="rec-material-canvas" aria-label="Lienzo semántico de la plantilla">
      <div className="rec-paper" data-size={template.page.size}>
        {blocks.map((block) => (
          <button
            key={block.block_id}
            type="button"
            className={`rec-canvas-block is-${block.type}${selectedId === block.block_id ? " is-selected" : ""}`}
            onClick={() => onSelect(block.block_id)}
          >
            <span>{BLOCK_LABELS[block.type]}</span>
            {block.type === "access_qr" ? <strong>QR autoritativo del backend</strong> : null}
            {block.text ? <strong>{block.text}</strong> : null}
            {block.fields?.length ? <small>{block.fields.map(materialFieldCanvasLabel).join(" · ")}</small> : null}
            {block.binding && block.type !== "access_qr" ? <code>{block.binding}</code> : null}
          </button>
        ))}
      </div>
      <p>Este lienzo representa la receta. La preview PNG del job es la única prueba autoritativa del material final.</p>
    </div>
  );
}

export function MaterialsSection({ payload, activeTab, onStateRefresh, onArtifact, onCargando }: Props) {
  const [history, dispatch] = useReducer(templateHistoryReducer, TEMPLATE_PLACEHOLDER, createTemplateHistory);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [instances, setInstances] = useState<CollectionMaterialInstance[]>([]);
  const [instanceBusy, setInstanceBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobFormat, setJobFormat] = useState<"png" | "pdf" | "bundle" | null>(null);
  const [renderResult, setRenderResult] = useState<CollectionMaterialRenderResult | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { onCargando?.(loading); }, [loading, onCargando]);
  const template = history.present;
  const blocks = template.pages[0]?.blocks ?? [];
  const selected = blocks.find((block) => block.block_id === selectedId) ?? blocks[0] ?? null;
  const deployment = payload?.state.deployment ?? null;
  const activeAdapter = payload?.state.plan?.adapter.id ?? null;
  const adapterCompatible = activeAdapter ? template.compatible_adapters.includes(activeAdapter) : true;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void apiRecopiladoresMaterialTemplateGet()
      .then((result) => {
        if (!alive) return;
        // Sin plantilla no se inventa una: el editor guardaría sobre el estado
        // real una ficha que el motor nunca produjo.
        if (!result.template) {
          setError("El backend respondió sin plantilla; no se abre el editor para no guardar una receta inventada.");
          return;
        }
        dispatch({ type: "replace", template: result.template });
        setSelectedId(result.template.pages[0]?.blocks[0]?.block_id ?? "");
      })
      .catch((cause) => {
        if (alive) setError(cause instanceof Error ? cause.message : "No se pudo leer la plantilla.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = templateHistoryShortcut(event);
      if (!action) return;
      event.preventDefault();
      dispatch({ type: action });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const commit = useCallback((next: CollectionMaterialTemplate) => {
    dispatch({ type: "commit", template: { ...next, template_sha256: null } });
  }, []);

  const addActiveAdapter = () => {
    if (!activeAdapter || adapterCompatible) return;
    commit({ ...template, compatible_adapters: [...template.compatible_adapters, activeAdapter] });
  };

  const updateBlock = (patch: Partial<CollectionMaterialBlock>) => {
    if (!selected) return;
    const nextBlocks = blocks.map((block) => block.block_id === selected.block_id ? { ...block, ...patch } : block);
    commit({ ...template, pages: [{ ...template.pages[0], blocks: nextBlocks }, ...template.pages.slice(1)] });
  };

  const addBlock = (type: CollectionBlockType) => {
    const block = blockSeed(type, blocks.length + 1);
    commit({ ...template, pages: [{ ...template.pages[0], blocks: [...blocks, block] }, ...template.pages.slice(1)] });
    setSelectedId(block.block_id);
  };

  const removeSelected = () => {
    if (!selected || selected.required || selected.type === "access_qr") return;
    const next = blocks.filter((block) => block.block_id !== selected.block_id);
    commit({ ...template, pages: [{ ...template.pages[0], blocks: next }, ...template.pages.slice(1)] });
    setSelectedId(next[0]?.block_id ?? "");
  };

  const saveTemplate = async () => {
    if (!payload) return;
    setSaving(true);
    setError("");
    try {
      const result = await apiRecopiladoresMaterialTemplatePut({
        expected_revision: payload.state_revision,
        template,
      });
      if (result.template) dispatch({ type: "replace", template: result.template });
      await onStateRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la plantilla.");
    } finally {
      setSaving(false);
    }
  };

  const createInstances = async () => {
    if (!payload || !deployment) return [];
    setInstanceBusy(true);
    setError("");
    try {
      const result = await apiRecopiladoresMaterialInstances({
        expected_revision: payload.state_revision,
        unit_refs: payload.state.plan?.units.map((unit) => unit.unit_id),
        locale: "es-PE",
      });
      setInstances(result.instances);
      return result.instances;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron crear las instancias.");
      return [];
    } finally {
      setInstanceBusy(false);
    }
  };

  const render = async (format: "png" | "pdf" | "bundle") => {
    if (!deployment) return;
    const readyInstances = instances.length ? instances : await createInstances();
    if (!readyInstances.length) return;
    setError("");
    setRenderResult(null);
    try {
      const job = await apiRecopiladoresMaterialsRender({
        format,
        instance_id: readyInstances[0].instance_id,
        audience: "field_team",
      });
      setJobFormat(format);
      setJobId(job.job_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar el render.");
    }
  };

  const onRenderDone = useCallback((result: CollectionMaterialRenderResult) => {
    setJobId(null);
    setRenderResult(result);
    onArtifact(firstReceipt(result));
    void onStateRefresh();
  }, [onArtifact, onStateRefresh]);

  if (loading) return <div className="rec-loading">Leyendo plantilla semántica…</div>;

  if (activeTab === "paquetes") {
    return (
      <div className="rec-package-layout">
        <section className="rec-package-card">
          <header><Archive size={19} /><div><span>Instancias</span><h2>Receta ligada al deployment</h2></div></header>
          <dl>
            <div><dt>Template</dt><dd>{template.template_id}</dd></div>
            <div><dt>Deployment</dt><dd>{deployment?.deployment_id ?? "pendiente"}</dd></div>
            <div><dt>Instancias</dt><dd>{instances.length}</dd></div>
            <div><dt>Estado</dt><dd>{deployment?.status ?? "sin deployment"}</dd></div>
          </dl>
          <PulsoButton variant="secondary" onClick={() => { void createInstances(); }} disabled={!deployment || instanceBusy}>
            {instanceBusy ? <Loader2 size={15} className="pulso-spin" /> : <Layers size={15} />} Crear instancias
          </PulsoButton>
        </section>
        <section className="rec-render-card" data-qa-geometry-capacity="owned">
          <header><div><span>Renderer autoritativo</span><h2>PNG, PDF o paquete</h2></div></header>
          <div className="rec-render-actions">
            <PulsoButton variant="secondary" onClick={() => { void render("png"); }} disabled={!deployment || Boolean(jobId)}><Image size={15} /> Preview PNG</PulsoButton>
            <PulsoButton variant="primary" onClick={() => { void render("pdf"); }} disabled={!deployment || Boolean(jobId)}><FileText size={15} /> Render PDF</PulsoButton>
            <PulsoButton variant="secondary" onClick={() => { void render("bundle"); }} disabled={!deployment || Boolean(jobId)}><Archive size={15} /> Render paquete</PulsoButton>
          </div>
          <JobProgress<CollectionMaterialRenderResult>
            label={`Render ${jobFormat ?? "material"}`}
            jobId={jobId}
            onDone={onRenderDone}
            onError={(message) => { setJobId(null); setError(message); }}
            onCancelled={() => setJobId(null)}
          />
          {renderResult ? (
            <div className="rec-render-result">
              {renderResult.media_type === "image/png" ? (
                <img src={downloadUrl(renderResult.file_id)} alt="Preview PNG autoritativa del material" />
              ) : null}
              <div><strong>{renderResult.filename}</strong><span>{renderResult.media_type} · {renderResult.page_count} páginas · {renderResult.size_bytes} bytes</span><code>{renderResult.sha256}</code></div>
              <a href={downloadUrl(renderResult.file_id)}><Download size={14} /> Descargar artefacto</a>
            </div>
          ) : <div className="rec-contained-empty">El binario y su preview se generan en backend y quedan fuera del proyecto `.pulso`.</div>}
          {error ? <p className="rec-inline-error" role="alert">{error}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="rec-editor">
      <div className="rec-editor-toolbar" role="toolbar" aria-label="Herramientas de plantilla">
        <select aria-label="Añadir bloque semántico" defaultValue="" onChange={(event) => { if (event.target.value) addBlock(event.target.value as CollectionBlockType); event.target.value = ""; }}>
          <option value="" disabled>Añadir bloque…</option>
          {COLLECTION_BLOCK_TYPES.map((type) => <option key={type} value={type}>{BLOCK_LABELS[type]}</option>)}
        </select>
        <PulsoButton variant="icon" size="sm" aria-label="Deshacer" title="Deshacer (Cmd/Ctrl+Z)" disabled={!history.past.length} onClick={() => dispatch({ type: "undo" })}><Undo2 size={15} /></PulsoButton>
        <PulsoButton variant="icon" size="sm" aria-label="Rehacer" title="Rehacer (Shift+Cmd/Ctrl+Z o Ctrl+Y)" disabled={!history.future.length} onClick={() => dispatch({ type: "redo" })}><Redo2 size={15} /></PulsoButton>
        <span className="rec-editor-spacer" />
        {!adapterCompatible ? (
          <PulsoButton variant="secondary" size="sm" onClick={addActiveAdapter}>
            <Plus size={14} /> Habilitar {activeAdapter}
          </PulsoButton>
        ) : null}
        <span className="rec-template-revision">revisión {template.revision}</span>
        <PulsoButton variant="primary" size="sm" disabled={!payload || saving} onClick={() => { void saveTemplate(); }}>{saving ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />} Guardar plantilla</PulsoButton>
      </div>
      <aside className="rec-outline" aria-label="Estructura de bloques">
        <header><span>Outline</span><strong>{blocks.length} bloques</strong></header>
        <ol>{blocks.map((block, index) => (
          <li key={block.block_id}>
            <button type="button" className={selected?.block_id === block.block_id ? "is-selected" : ""} onClick={() => setSelectedId(block.block_id)}>
              <span>{index + 1}</span><div><strong>{BLOCK_LABELS[block.type]}</strong><small>{block.block_id}</small></div>
            </button>
          </li>
        ))}</ol>
      </aside>
      <main className="rec-canvas-wrap" data-qa-geometry-capacity="owned">
        <MaterialCanvas template={template} selectedId={selected?.block_id ?? ""} onSelect={setSelectedId} />
      </main>
      <aside className="rec-inspector" aria-label="Inspector del bloque">
        <header><span>Inspector</span><strong>{selected ? BLOCK_LABELS[selected.type] : "Sin selección"}</strong></header>
        {selected ? (
          <div className="rec-inspector-fields">
            <label>ID del bloque<input value={selected.block_id} readOnly /></label>
            <label>Tipo<select value={selected.type} disabled>{COLLECTION_BLOCK_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
            {selected.text !== undefined ? <label>Texto<textarea value={selected.text ?? ""} onChange={(event) => updateBlock({ text: event.target.value })} rows={5} /></label> : null}
            {selected.binding !== undefined ? <label>Binding<select value={selected.binding ?? ""} onChange={(event) => updateBlock({ binding: event.target.value })}>{BINDING_OPTIONS.map((binding) => <option key={binding}>{binding}</option>)}</select></label> : null}
            {selected.fields !== undefined ? <fieldset><legend>Campos permitidos</legend>{BINDING_OPTIONS.filter((item) => item.startsWith("unit.")).map((field) => (
              <label className="rec-check" key={field}><input type="checkbox" checked={selected.fields?.some((item) => materialFieldBinding(item) === field) ?? false} onChange={(event) => updateBlock({ fields: event.target.checked ? [...(selected.fields ?? []), field] : (selected.fields ?? []).filter((item) => materialFieldBinding(item) !== field) })} /> {field}</label>
            ))}</fieldset> : null}
            <PulsoButton variant="danger" size="sm" disabled={selected.required === true || selected.type === "access_qr"} onClick={removeSelected}><Trash2 size={14} /> Eliminar bloque</PulsoButton>
          </div>
        ) : <div className="rec-contained-empty">Selecciona un bloque del outline.</div>}
        {error ? <p className="rec-inline-error" role="alert">{error}</p> : null}
      </aside>
    </div>
  );
}
