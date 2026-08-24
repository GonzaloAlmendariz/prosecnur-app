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
import { Panel } from "../../components/Panel";
import { PulsoButton } from "../../components/PulsoButton";
import {
  Archive,
  ChevronDown,
  ChevronUp,
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
import { deploymentStatusLabel } from "./providerRules";
import {
  createTemplateHistory,
  templateHistoryReducer,
  templateHistoryShortcut,
} from "./templateHistory";
import "./styles/materials.css";
import { composicionDelPlan, unidadesDelPlan } from "./codigoOperativo";

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

/**
 * Lo que el bloque lleva escrito, si lleva algo.
 *
 * El outline enseñaba la clave interna —«brand», «unit», «course»— debajo del
 * rótulo, que en inglés repite lo que el rótulo ya dice. El primer intento la
 * cambió por el binding, y salió igual de técnico: «Título · label».
 *
 * Sólo el texto fijo distingue de verdad un bloque de otro del mismo tipo —dos
 * instrucciones dicen cosas distintas— y es lo único que aquí informa. **Si no
 * hay nada útil que decir, no se dice**: la clave vive en el inspector, que es
 * donde se edita y donde sirve para seguir un binding.
 */
function descripcionDelBloque(block: { text?: string | null }): string {
  const texto = (block.text ?? "").trim();
  if (!texto) return "";
  return texto.length > 44 ? `${texto.slice(0, 44)}…` : texto;
}

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

// Todo binding que un preset del backend pueda dejar en un bloque `heading`/
// `body`/`footer` (binding suelto, sin `label` propio) tiene que estar acá:
// si falta uno, ese bloque vuelve a mostrar la ruta técnica cruda. Ver
// `collection_materials.R`/`collection_render_afiche.R`/
// `collection_render_ficha_campo.R` para la lista real de bindings en uso.
const BINDING_OPTIONS = [
  "access.qr_payload",
  "unit.label",
  "unit.course_name",
  "unit.schedule",
  "unit.venue",
  "unit.role",
  "deployment.deployment_id",
  "project.name",
  "project.period",
];

// El binding (`unit.schedule`, `access.qr_payload`…) es el identificador que
// viaja al backend; esta tabla es solo cómo se lo nombra en la UI del
// analista, para no obligarlo a leer rutas con puntos para saber qué está
// agregando a la ficha.
const BINDING_LABELS: Record<string, string> = {
  "access.qr_payload": "Código QR de acceso",
  "unit.label": "Nombre de la unidad",
  "unit.course_name": "Nombre del curso",
  "unit.schedule": "Horario",
  "unit.venue": "Aula o lugar",
  "unit.role": "Rol (titular / reemplazo)",
  "deployment.deployment_id": "Código de la entrega",
  "project.name": "Nombre del proyecto",
  "project.period": "Periodo del proyecto",
};

/**
 * Cuántas fichas hay hechas, de cuántas hacen falta.
 *
 * «Fichas 0» no dice de cuántas, y las que hay que hacer son las aulas que se
 * van a visitar. Es el mismo ancla que ya lleva el vacío de Accesos —«Ninguna
 * de las 193 aulas del plan tiene acceso todavía»— y aquí faltaba.
 *
 * Sin plan no se inventa un denominador: se dice la cuenta a secas, porque «0
 * de 0» promete una comparación que no se puede hacer.
 */
export function cuentaDeFichas(hechas: number, delPlan: number): string {
  const n = (v: number) => v.toLocaleString("es-PE");
  return delPlan > 0 ? `${n(hechas)} de ${n(delPlan)}` : n(hechas);
}

export function bindingLabel(binding: string): string {
  return BINDING_LABELS[binding] ?? binding;
}

export function materialFieldBinding(field: CollectionMaterialField): string {
  return typeof field === "string" ? field : field.binding;
}

export function materialFieldCanvasLabel(field: CollectionMaterialField): string {
  if (typeof field === "string") return bindingLabel(field);
  return field.label ?? bindingLabel(field.binding);
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
            aria-current={selectedId === block.block_id ? "true" : undefined}
            onClick={() => onSelect(block.block_id)}
          >
            <span>{BLOCK_LABELS[block.type]}</span>
            {block.type === "access_qr" ? <strong>QR generado por Pulso</strong> : null}
            {block.text ? <strong>{block.text}</strong> : null}
            {block.fields?.length ? <small>{block.fields.map(materialFieldCanvasLabel).join(" · ")}</small> : null}
            {block.binding && block.type !== "access_qr" ? <small>{bindingLabel(block.binding)}</small> : null}
          </button>
        ))}
      </div>
      <p>Esto es el diseño de la ficha. La imagen que genera Pulso es la única prueba de cómo saldrá impresa.</p>
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
  // Sin esto, mover/agregar/quitar un bloque (o deshacer/rehacer) DESPUÉS de
  // un render exitoso dejaba el panel de resultado (imagen, filename, sha256,
  // "Descargar artefacto") mostrando el artefacto VIEJO como si reflejara la
  // plantilla recién editada — mismo patrón que la vista previa stale de
  // Accesos (ece1b0dc), acá con el binario ya generado en vez de con datos a
  // medio confirmar.
  useEffect(() => { setRenderResult(null); }, [template]);
  const blocks = template.pages[0]?.blocks ?? [];
  const selected = blocks.find((block) => block.block_id === selectedId) ?? blocks[0] ?? null;
  // Cada tipo de bloque es un slot único en el renderer (`.crf_block()`, api/R/
  // collection_render_ficha.R, busca por tipo y toma el primero) — un segundo
  // bloque del mismo tipo pasa la validación del schema pero nunca se dibuja,
  // así que ni se avisa que sobra. Se oculta la opción en vez de dejar crear
  // un bloque que jamás va a imprimirse.
  const presentBlockTypes = new Set(blocks.map((block) => block.type));
  const addableBlockTypes = COLLECTION_BLOCK_TYPES.filter((type) => !presentBlockTypes.has(type));
  const deployment = payload?.state.deployment ?? null;
  // Las aulas que se van a visitar: son las fichas que hay que llegar a tener.
  // El denominador es lo que el botón de al lado va a crear: `createInstances`
  // manda `plan.units.map(...)` entero. Contar titulares prometía 193 fichas y
  // creaba 2.616.
  const aulasDelPlan = unidadesDelPlan(payload?.state.plan);
  const composicion = composicionDelPlan(payload?.state.plan);
  // Por que estan apagados los tres botones de render. `null` cuando no lo
  // estan: asi el vacio y los `title` preguntan lo mismo en un solo sitio.
  const motivoBloqueo = deployment
    ? null
    : "Todavia no hay accesos preparados, asi que la ficha no tiene enlace que codificar.";
  const fichasHechas = cuentaDeFichas(instances.length, aulasDelPlan);
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
    const index = blocks.findIndex((block) => block.block_id === selected.block_id);
    const next = blocks.filter((block) => block.block_id !== selected.block_id);
    commit({ ...template, pages: [{ ...template.pages[0], blocks: next }, ...template.pages.slice(1)] });
    // Selecciona lo que quedó en el mismo lugar (lo que antes era el
    // siguiente bloque) en vez de saltar siempre al primero — borrar el
    // bloque 6 de 9 no debería tirar la selección hasta el bloque 1.
    setSelectedId(next[Math.min(index, next.length - 1)]?.block_id ?? "");
  };

  // El orden del array es lo que el motor usa para apilar los bloques en la
  // hoja (api/R/collection_render_ficha.R, `.crf_flow_plan`): mover un bloque
  // acá mueve de verdad su posición en el PDF, no solo en esta lista.
  const moveBlock = (blockId: string, direction: -1 | 1) => {
    const index = blocks.findIndex((block) => block.block_id === blockId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    commit({ ...template, pages: [{ ...template.pages[0], blocks: next }, ...template.pages.slice(1)] });
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
      setError(cause instanceof Error ? cause.message : "No se pudieron crear las fichas.");
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
      setError(cause instanceof Error ? cause.message : "No se pudo generar el archivo.");
    }
  };

  const onRenderDone = useCallback((result: CollectionMaterialRenderResult) => {
    setJobId(null);
    setRenderResult(result);
    onArtifact(firstReceipt(result));
    void onStateRefresh();
  }, [onArtifact, onStateRefresh]);

  if (loading) return <div className="rec-loading">Leyendo la plantilla de la ficha…</div>;

  if (activeTab === "paquetes") {
    return (
      <div className="rec-package-layout">
        <Panel
          className="rec-package-card"
          eyebrow="Fichas"
          title={<><Archive size={18} aria-hidden /> La ficha de estos accesos</>}
        >
          <dl>
            <div><dt>Plantilla</dt><dd>{template.template_id}</dd></div>
            <div><dt>Accesos</dt><dd>{deployment?.deployment_id ?? "pendiente"}</dd></div>
            {/* Con su denominador: «Fichas 0» no dice de cuántas, y las que
                hay que hacer son las aulas que se van a visitar. Es el mismo
                ancla que ya lleva el vacío de Accesos —«Ninguna de las 193
                aulas del plan tiene acceso todavía»— y aquí faltaba. */}
            <div>
              <dt>Fichas</dt>
              <dd>
                {fichasHechas}
                {/* El total con su composición: «2.616» a secas no dice que ahí
                    dentro van los tres cajones que el paquete reparte por
                    facultad, y sin eso se lee como si se fuera a visitar 2.616
                    aulas. */}
                {aulasDelPlan > 0 && composicion.titulares > 0 ? (
                  <small className="rec-cuenta-composicion">
                    {composicion.titulares.toLocaleString("es-PE")} titulares
                    {composicion.reemplazos > 0
                      ? ` · ${composicion.reemplazos.toLocaleString("es-PE")} reemplazos` : ""}
                    {composicion.adicionales > 0
                      ? ` · ${composicion.adicionales.toLocaleString("es-PE")} adicionales` : ""}
                  </small>
                ) : null}
              </dd>
            </div>
            <div><dt>Estado</dt><dd>{deployment ? deploymentStatusLabel(deployment.status) : "sin preparar"}</dd></div>
          </dl>
          <PulsoButton variant="secondary" onClick={() => { void createInstances(); }} disabled={!deployment || instanceBusy}>
            {instanceBusy ? <Loader2 size={15} className="pulso-spin" /> : <Layers size={15} />} Crear las fichas
          </PulsoButton>
        </Panel>
        <Panel
          className="rec-render-card"
          data-qa-geometry-capacity="owned"
          eyebrow="Lo genera Pulso"
          title="PNG, PDF o paquete"
        >
          {/* **Un boton apagado dice por que lo esta, y en su sitio.** Los tres
              se apagan con `!deployment` —sin accesos preparados no hay enlace
              que meter en el QR— y el motivo vivia arriba a la derecha, en otra
              banda, como «accesos sin preparar». Quien pulsa mira el boton, no
              la esquina opuesta. */}
          <div className="rec-render-actions">
            <PulsoButton variant="secondary" title={motivoBloqueo ?? undefined} onClick={() => { void render("png"); }} disabled={!deployment || Boolean(jobId)}><Image size={15} /> Ver imagen</PulsoButton>
            <PulsoButton variant="primary" title={motivoBloqueo ?? undefined} onClick={() => { void render("pdf"); }} disabled={!deployment || Boolean(jobId)}><FileText size={15} /> Generar PDF</PulsoButton>
            <PulsoButton variant="secondary" title={motivoBloqueo ?? undefined} onClick={() => { void render("bundle"); }} disabled={!deployment || Boolean(jobId)}><Archive size={15} /> Generar el paquete</PulsoButton>
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
                <img src={downloadUrl(renderResult.file_id)} alt="La ficha tal como la genera Pulso" />
              ) : null}
              <div><strong>{renderResult.filename}</strong><span>{renderResult.media_type} · {renderResult.page_count} páginas · {renderResult.size_bytes} bytes</span><code>{renderResult.sha256}</code></div>
              <a href={downloadUrl(renderResult.file_id)}><Download size={14} /> Descargar la ficha</a>
            </div>
          ) : (
            /* **El vacio dice lo que hace falta, no una nota de archivo.**
               Sin accesos preparados los tres botones estan apagados y este
               hueco explicaba donde NO se guardan unos archivos que todavia no
               se pueden generar: informacion correcta contestando otra
               pregunta. Con accesos listos vuelve a ser esa nota, que ahi si es
               lo unico que queda por decir. */
            <div className="rec-contained-empty">
              {motivoBloqueo ? (
                <>
                  <strong>{motivoBloqueo}</strong>
                  <span>
                    Los accesos se preparan en la seccion Accesos: cada
                    curso-horario recibe su enlace y ese enlace es lo que va
                    dentro del QR de su ficha.
                  </span>
                </>
              ) : (
                "El archivo y su vista previa los genera Pulso, y no se guardan dentro del proyecto."
              )}
            </div>
          )}
          {error ? <p className="rec-inline-error" role="alert">{error}</p> : null}
        </Panel>
      </div>
    );
  }

  return (
    <div className="rec-editor">
      <div className="rec-editor-toolbar" role="toolbar" aria-label="Herramientas de plantilla">
        <select aria-label="Añadir bloque semántico" defaultValue="" onChange={(event) => { if (event.target.value) addBlock(event.target.value as CollectionBlockType); event.target.value = ""; }}>
          <option value="" disabled>Añadir bloque…</option>
          {addableBlockTypes.map((type) => <option key={type} value={type}>{BLOCK_LABELS[type]}</option>)}
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
        {/* «Outline» es la palabra del editor, no la de quien arma una ficha. */}
        <header><span>La ficha, por partes</span><strong>{blocks.length} bloques</strong></header>
        <ol>{blocks.map((block, index) => (
          <li key={block.block_id} className="rec-outline-item">
            <button
              type="button"
              className={selected?.block_id === block.block_id ? "is-selected" : ""}
              aria-current={selected?.block_id === block.block_id ? "true" : undefined}
              onClick={() => setSelectedId(block.block_id)}
            >
              {/* La clave interna del bloque —«brand», «unit», «log»— vive en el
                  inspector, que es donde se edita y donde sirve para seguir un
                  binding. Aquí, debajo de «Cabecera de marca», sólo repite en
                  inglés lo que el rótulo ya dice. Se enseña QUÉ PINTA, que es lo
                  que distingue dos bloques del mismo tipo. */}
              <span>{index + 1}</span>
              <div>
                <strong>{BLOCK_LABELS[block.type]}</strong>
                {descripcionDelBloque(block)
                  ? <small>{descripcionDelBloque(block)}</small>
                  : null}
              </div>
            </button>
            <div className="rec-outline-reorder">
              <PulsoButton
                variant="icon" size="sm" aria-label={`Subir ${BLOCK_LABELS[block.type]}`}
                title="Subir un lugar" disabled={index === 0}
                onClick={() => moveBlock(block.block_id, -1)}
              ><ChevronUp size={14} /></PulsoButton>
              <PulsoButton
                variant="icon" size="sm" aria-label={`Bajar ${BLOCK_LABELS[block.type]}`}
                title="Bajar un lugar" disabled={index === blocks.length - 1}
                onClick={() => moveBlock(block.block_id, 1)}
              ><ChevronDown size={14} /></PulsoButton>
            </div>
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
            {selected.binding !== undefined ? <label>Dato que muestra<select value={selected.binding ?? ""} onChange={(event) => updateBlock({ binding: event.target.value })}>{BINDING_OPTIONS.map((binding) => <option key={binding} value={binding}>{bindingLabel(binding)}</option>)}</select></label> : null}
            {selected.fields !== undefined ? <fieldset><legend>Campos permitidos</legend>{BINDING_OPTIONS.filter((item) => item.startsWith("unit.")).map((field) => (
              <label className="rec-check" key={field}><input type="checkbox" aria-label={bindingLabel(field)} checked={selected.fields?.some((item) => materialFieldBinding(item) === field) ?? false} onChange={(event) => updateBlock({ fields: event.target.checked ? [...(selected.fields ?? []), field] : (selected.fields ?? []).filter((item) => materialFieldBinding(item) !== field) })} /> {bindingLabel(field)}</label>
            ))}</fieldset> : null}
            <PulsoButton variant="danger" size="sm" disabled={selected.required === true || selected.type === "access_qr"} onClick={removeSelected}><Trash2 size={14} /> Eliminar bloque</PulsoButton>
          </div>
        ) : <div className="rec-contained-empty">Elige una parte de la ficha para editarla.</div>}
        {error ? <p className="rec-inline-error" role="alert">{error}</p> : null}
      </aside>
    </div>
  );
}
