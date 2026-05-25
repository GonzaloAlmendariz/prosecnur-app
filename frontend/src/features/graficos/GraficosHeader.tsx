import { type CSSProperties, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, ChevronDown, Download, FileText, RotateCcw, Loader2, Undo2, Redo2, Settings2, PanelTopDashed, SlidersHorizontal, Upload } from "lucide-react";
import {
  apiGraficosConfigExport,
  apiGraficosConfigImport,
  apiSaveFileAs,
  downloadUrl,
} from "../../api/client";
import { normalizeGraficosConfig } from "../../api/graficosConfigNormalizer";
import { ContextBar, ContextBarDivider } from "../../components/ContextBar";
import { SaveStatusIndicator } from "../../components/SaveStatusIndicator";
import { DEFAULT_DEBUG_PH, usePlanStore } from "./store";
import { PlanHealthBadge } from "./PlanHealthBadge";
import { usePlanValidator } from "./usePlanValidator";
import { EstiloGlobalDialog } from "./v2/shell/EstiloGlobalDialog";
import { useProjectShell } from "../project/ProjectShell";

type GraficosJsonSectionId =
  | "plan"
  | "presets"
  | "w_presets"
  | "paletas"
  | "iconos"
  | "overrides_reusables"
  | "debug_ph"
  | "scope_rules"
  | "ui_state";

const GRAFICOS_JSON_SECTIONS: Array<{ id: GraficosJsonSectionId; label: string; help: string }> = [
  { id: "plan", label: "Plan de slides", help: "Orden, tipos y contenido de cada slide." },
  { id: "presets", label: "Presets PPT", help: "Estilos globales para gráficos en PowerPoint." },
  { id: "w_presets", label: "Presets Word", help: "Opciones de gráficos y tablas para Word." },
  { id: "paletas", label: "Paletas", help: "Colores por lista de respuestas." },
  { id: "iconos", label: "Íconos", help: "Referencias a íconos subidos al proyecto." },
  { id: "overrides_reusables", label: "Modos", help: "Overrides reutilizables por tipo de gráfico." },
  { id: "debug_ph", label: "Debug visual", help: "Bordes de placeholder para revisar layout." },
  { id: "scope_rules", label: "Reglas por alcance", help: "Global, lista, tipo de gráfico, slide o slide_id." },
  { id: "ui_state", label: "Vista del editor", help: "Modo, pestaña, densidad y viewport del canvas." },
];

const DEFAULT_JSON_SECTIONS = Object.fromEntries(
  GRAFICOS_JSON_SECTIONS.map((section) => [section.id, true])
) as Record<GraficosJsonSectionId, boolean>;

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function deepMerge<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = isRecord(out[key]) && isRecord(value)
      ? deepMerge(out[key] as Record<string, unknown>, value)
      : value;
  }
  return out as T;
}

function pickGraficosConfigSections(
  cfg: Record<string, unknown>,
  sections: Record<GraficosJsonSectionId, boolean>,
  mode: "merge" | "replace"
) {
  const out: Record<string, unknown> = {
    version: "graficos/4",
  };

  if (sections.plan) out.plan = cfg.plan;
  if (sections.presets) out.presets = cfg.presets;
  if (sections.w_presets) out.w_presets = cfg.w_presets;
  if (sections.paletas) out.paletas = cfg.paletas;
  if (sections.iconos) out.iconos = cfg.iconos;
  if (sections.overrides_reusables) out.overrides_reusables = cfg.overrides_reusables;
  if (sections.debug_ph) out.debug_ph = cfg.debug_ph;
  if (sections.scope_rules) out.scope_rules = cfg.scope_rules;
  if (sections.ui_state) {
    out.selected_slide_id = cfg.selected_slide_id;
    out.view_mode = cfg.view_mode;
    out.inspector_tab = cfg.inspector_tab;
    out.density = cfg.density;
    out.canvas_viewport = cfg.canvas_viewport;
  }
  if (cfg._unknown && mode === "replace") out._unknown = cfg._unknown;

  return out;
}

function syncGlobalScopeRules(cfg: Record<string, unknown>, sections: Record<GraficosJsonSectionId, boolean>) {
  if (!isRecord(cfg.scope_rules)) cfg.scope_rules = {};
  const scopeRules = cfg.scope_rules as Record<string, unknown>;
  const global = isRecord(scopeRules.global) ? { ...scopeRules.global } : {};
  if (sections.presets) global.presets = cfg.presets;
  if (sections.paletas) global.paletas = cfg.paletas;
  if (sections.overrides_reusables) global.overrides_reusables = cfg.overrides_reusables;
  if (sections.debug_ph) global.debug_ph = cfg.debug_ph;
  scopeRules.global = global;
  return cfg;
}

const jsonIoStyles: Record<string, CSSProperties> = {
  wrap: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
  },
  count: {
    minWidth: 34,
    height: 18,
    padding: "0 7px",
    borderRadius: 999,
    background: "var(--pulso-primary-soft)",
    color: "var(--pulso-primary)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 750,
  },
  popover: {
    position: "absolute",
    zIndex: 40,
    top: "calc(100% + 8px)",
    left: 0,
    width: 430,
    padding: 12,
    borderRadius: 16,
    border: "1px solid var(--pulso-material-border)",
    background: "var(--pulso-material-bg-strong)",
    boxShadow: "var(--pulso-shadow-high)",
    backdropFilter: "blur(18px)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 10,
  },
  title: {
    display: "block",
    fontSize: 13,
    color: "var(--pulso-text)",
  },
  lead: {
    margin: "3px 0 0",
    color: "var(--pulso-text-soft)",
    fontSize: 11,
    lineHeight: 1.4,
  },
  close: {
    width: 24,
    height: 24,
    borderRadius: 999,
    border: "1px solid var(--pulso-border)",
    background: "rgba(255,255,255,0.82)",
    cursor: "pointer",
    lineHeight: 1,
  },
  quickRow: {
    display: "flex",
    gap: 6,
    marginBottom: 10,
  },
  smallButton: {
    fontSize: 10.5,
    padding: "4px 9px",
    borderRadius: 999,
    border: "1px solid var(--pulso-border)",
    background: "white",
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  option: {
    display: "grid",
    gridTemplateColumns: "16px 1fr",
    gap: 8,
    alignItems: "flex-start",
    minHeight: 58,
    padding: 9,
    borderRadius: 12,
    border: "1px solid var(--pulso-border)",
    background: "rgba(255,255,255,0.76)",
    cursor: "pointer",
  },
  optionOn: {
    borderColor: "var(--pulso-primary-border)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.96), var(--pulso-primary-soft))",
    boxShadow: "0 0 0 3px var(--pulso-primary-focus)",
  },
  modeBox: {
    marginTop: 10,
    padding: 9,
    borderRadius: 12,
    background: "var(--pulso-surface-2)",
    border: "1px solid var(--pulso-border)",
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    fontSize: 11,
  },
  modeLabel: {
    color: "var(--pulso-text-soft)",
    fontWeight: 700,
  },
  radio: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    cursor: "pointer",
  },
  actions: {
    display: "flex",
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    flex: "1 1 0",
    minHeight: 32,
    borderRadius: 10,
    border: "1px solid var(--pulso-primary-border)",
    background: "white",
    color: "var(--pulso-primary)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontSize: 11,
    fontWeight: 750,
  },
  msg: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--pulso-success-fg)",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
  error: {
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 999,
    background: "var(--pulso-danger-bg)",
    color: "var(--pulso-danger-fg)",
    border: "1px solid var(--pulso-danger-border)",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
};

// Header del módulo Gráficos. Patrón análogo a AnaliticaHeader:
// - Badge "Autoguardado" con estado (guardando / guardado / sin conexión).
// - Botones Export / Import del plan como JSON.
// - Botón Reset (con confirmación).
// - Botones para abrir los modales de presets PPT / Word (quedan aquí
//   hasta que en el Bloque 2 se muevan al bloque "Configuración global").
// - Botones de exportación .pptx / .docx con JobProgress delegado al padre.
//
// El componente NO hace el autosave — eso lo hace `useGraficosAutosave`
// en GraficosPage. Acá solo reflejamos el estado.

export function GraficosHeader({
  onExportPpt,
  onExportWord,
  pptFileId,
  docxFileId,
  pptFilename,
  docxFilename,
  exportBusy,
  exportJobKind,
  canExport,
}: {
  onExportPpt: () => void;
  onExportWord: () => void;
  pptFileId: string | null;
  docxFileId: string | null;
  pptFilename: string | null;
  docxFilename: string | null;
  exportBusy: boolean;
  exportJobKind: "ppt" | "word" | null;
  canExport: boolean;
}) {
  const dirty = usePlanStore((s) => s.dirty);
  const hydrated = usePlanStore((s) => s.hydrated);
  const nSlides = usePlanStore((s) => s.plan.slides.length);
  const nPresets = usePlanStore((s) => Object.keys(s.presets).length);
  const nPaletas = usePlanStore((s) => Object.keys(s.paletas).length);
  const nIconos = usePlanStore((s) => s.iconos.length);
  const nModos = usePlanStore((s) => s.overridesReusables.length);
  const resetPlan = usePlanStore((s) => s.reset);
  const hydrate = usePlanStore((s) => s.hydrate);
  const [estiloOpen, setEstiloOpen] = useState(false);
  const [jsonMenuOpen, setJsonMenuOpen] = useState(false);
  const [jsonSections, setJsonSections] = useState<Record<GraficosJsonSectionId, boolean>>(DEFAULT_JSON_SECTIONS);
  const [jsonImportMode, setJsonImportMode] = useState<"merge" | "replace">("merge");
  const [jsonBusy, setJsonBusy] = useState<"export" | "import" | null>(null);
  const [jsonMsg, setJsonMsg] = useState("");
  const [jsonError, setJsonError] = useState("");
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const { project } = useProjectShell();
  const savedRef = useRef<Record<string, true>>({});
  const [saveStatus, setSaveStatus] = useState("");

  // El botón de export se desactiva si el padre lo bloquea (sesión sin
  // rp_data) O si el validador detecta errores (plan vacío, etc.).
  // Los warnings no bloquean — aparecen en el badge pero el export corre.
  const validator = usePlanValidator();
  const canExportFinal = canExport && validator.canExport;

  function selectedJsonSections() {
    return GRAFICOS_JSON_SECTIONS.filter((section) => jsonSections[section.id]);
  }

  function setAllJsonSections(value: boolean) {
    setJsonSections(Object.fromEntries(GRAFICOS_JSON_SECTIONS.map((section) => [section.id, value])) as Record<GraficosJsonSectionId, boolean>);
  }

  async function ioExport() {
    setJsonError(""); setJsonMsg(""); setJsonBusy("export");
    try {
      const bundle = await apiGraficosConfigExport();
      const cfg = normalizeGraficosConfig(bundle.config ?? bundle, { includeLegacyAliases: true });
      const picked = pickGraficosConfigSections(cfg, jsonSections, "replace");
      const payload = {
        version: "graficos/4",
        exported_at: new Date().toISOString(),
        export_scope: selectedJsonSections().map((section) => section.id),
        config: picked,
      };
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `pulso_graficos_${selectedJsonSections().length === GRAFICOS_JSON_SECTIONS.length ? "completo" : "parcial"}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setJsonMsg("JSON exportado");
    } catch (e) {
      setJsonError((e as Error).message);
    } finally {
      setJsonBusy(null);
      setTimeout(() => setJsonMsg(""), 2600);
    }
  }

  async function ioImport(file?: File) {
    if (!file) return;
    setJsonError(""); setJsonMsg(""); setJsonBusy("import");
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = normalizeGraficosConfig(parsed);
      const currentBundle = await apiGraficosConfigExport();
      const current = normalizeGraficosConfig(currentBundle.config ?? currentBundle);
      const picked = pickGraficosConfigSections(incoming, jsonSections, jsonImportMode);
      const next = jsonImportMode === "replace"
        ? { ...current, ...picked }
        : deepMerge(current, picked);
      const synced = syncGlobalScopeRules(next, jsonSections);
      await apiGraficosConfigImport({ version: "graficos/4", config: synced });
      hydrate(synced as never);
      setJsonMsg(`${selectedJsonSections().length} sección${selectedJsonSections().length === 1 ? "" : "es"} importada${selectedJsonSections().length === 1 ? "" : "s"}`);
    } catch (e) {
      setJsonError(`JSON inválido: ${(e as Error).message}`);
    } finally {
      setJsonBusy(null);
      if (jsonFileRef.current) jsonFileRef.current.value = "";
      setTimeout(() => setJsonMsg(""), 3200);
    }
  }

  function onResetClick() {
    if (!window.confirm("¿Vaciar el plan? Se elimina el orden actual de slides. Esta acción se guarda automáticamente.")) return;
    resetPlan();
  }

  // Estado del badge de autosave (3 variantes visuales).
  const savingNow = hydrated && dirty;
  const savedAll = hydrated && !dirty;

  useEffect(() => {
    const candidate = [
      { fileId: pptFileId, filename: pptFilename ?? "reporte.pptx" },
      { fileId: docxFileId, filename: docxFilename ?? "reporte.docx" },
    ].find((item) => item.fileId && !savedRef.current[item.fileId]);
    if (!candidate?.fileId || exportBusy || !window.prosecnurApi) return;
    const fileId = candidate.fileId;
    const filename = candidate.filename;
    savedRef.current[fileId] = true;
    const ext = filename.split(".").pop() || "*";
    const defaultPath = project.status.path
      ? (() => {
          const sep = project.status.path!.includes("\\") ? "\\" : "/";
          return `${project.status.path!.replace(/[/\\][^/\\]+$/, "")}${sep}${filename}`;
        })()
      : undefined;
    let cancelled = false;
    async function saveGeneratedReport() {
      try {
        const target = await window.prosecnurApi!.saveEntregableDialog({
          defaultName: filename,
          defaultPath,
          filters: [{ name: ext.toUpperCase(), extensions: [ext] }, { name: "Todos", extensions: ["*"] }],
        });
        if (!target || cancelled) return;
        const saved = await apiSaveFileAs(fileId, target, { overwrite: true });
        if (!cancelled) setSaveStatus(`Guardado como ${saved.filename}`);
      } catch (e) {
        if (!cancelled) {
          delete savedRef.current[fileId];
          setSaveStatus((e as Error).message);
        }
      }
    }
    void saveGeneratedReport();
    return () => { cancelled = true; };
  }, [pptFileId, docxFileId, pptFilename, docxFilename, exportBusy, project.status.path]);

  return (
    <div className="pulso-gv2-command-header">
      {/* Banda 1: contexto del plan + acciones de configuración. */}
      <ContextBar
        ariaLabel="Estado del plan y acciones de configuración"
        density="compact"
        className="pulso-gv2-command-row pulso-gv2-command-row--status"
      >
        <SaveStatusIndicator
          state={savedAll ? "saved" : savingNow ? "saving" : "loading"}
          savedLabel="Autoguardado"
        />

        <span className="pulso-gv2-header-note">
          {nSlides === 0
            ? "Empieza agregando slides en el panel izquierdo."
            : `${nSlides} ${nSlides === 1 ? "slide" : "slides"} en el plan. Tu plan se guarda automáticamente.`}
        </span>

        <UndoRedoButtons />
        <PlanHealthBadge />
        <DebugPhToggle />

        <div style={jsonIoStyles.wrap}>
          <button
            type="button"
            onClick={() => setJsonMenuOpen((x) => !x)}
            className="pulso-gv2-pill-button pulso-gv2-toolbar-action"
            aria-expanded={jsonMenuOpen}
          >
            <SlidersHorizontal size={12} /> JSON avanzado
            <span style={jsonIoStyles.count}>{selectedJsonSections().length}/{GRAFICOS_JSON_SECTIONS.length}</span>
          </button>

          {jsonMenuOpen && (
            <div style={jsonIoStyles.popover} role="dialog" aria-label="Exportar o importar JSON de gráficos">
              <div style={jsonIoStyles.header}>
                <div>
                  <strong style={jsonIoStyles.title}>Qué incluir</strong>
                  <p style={jsonIoStyles.lead}>Elige las partes del plan que quieres mover entre proyectos.</p>
                </div>
                <button type="button" onClick={() => setJsonMenuOpen(false)} style={jsonIoStyles.close}>×</button>
              </div>

              <div style={jsonIoStyles.quickRow}>
                <button type="button" onClick={() => setAllJsonSections(true)} style={jsonIoStyles.smallButton}>Todo</button>
                <button type="button" onClick={() => setAllJsonSections(false)} style={jsonIoStyles.smallButton}>Nada</button>
              </div>

              <div style={jsonIoStyles.grid}>
                {GRAFICOS_JSON_SECTIONS.map((section) => (
                  <label key={section.id} style={{ ...jsonIoStyles.option, ...(jsonSections[section.id] ? jsonIoStyles.optionOn : {}) }}>
                    <input
                      type="checkbox"
                      checked={jsonSections[section.id]}
                      onChange={(e) => setJsonSections((prev) => ({ ...prev, [section.id]: e.target.checked }))}
                    />
                    <span>
                      <strong>{section.label}</strong>
                      <small>{section.help}</small>
                    </span>
                  </label>
                ))}
              </div>

              <div style={jsonIoStyles.modeBox}>
                <span style={jsonIoStyles.modeLabel}>Al importar</span>
                <label style={jsonIoStyles.radio}>
                  <input type="radio" checked={jsonImportMode === "merge"} onChange={() => setJsonImportMode("merge")} />
                  Fusionar objetos
                </label>
                <label style={jsonIoStyles.radio}>
                  <input type="radio" checked={jsonImportMode === "replace"} onChange={() => setJsonImportMode("replace")} />
                  Reemplazar secciones
                </label>
              </div>

              <div style={jsonIoStyles.actions}>
                <button type="button" onClick={ioExport} disabled={jsonBusy === "export" || selectedJsonSections().length === 0} style={jsonIoStyles.actionButton}>
                  <Download size={12} /> {jsonBusy === "export" ? "Exportando…" : "Exportar JSON"}
                </button>
                <label style={{ ...jsonIoStyles.actionButton, cursor: jsonBusy === "import" ? "wait" : "pointer" }}>
                  <Upload size={12} /> {jsonBusy === "import" ? "Importando…" : "Importar JSON"}
                  <input
                    ref={jsonFileRef}
                    type="file"
                    accept=".json,application/json"
                    style={{ display: "none" }}
                    onChange={(e) => void ioImport(e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {jsonMsg && (
          <span role="status" style={jsonIoStyles.msg}><Check size={11} /> {jsonMsg}</span>
        )}
        {jsonError && (
          <span role="alert" style={jsonIoStyles.error}><AlertCircle size={11} /> {jsonError}</span>
        )}

        <button
          type="button"
          onClick={onResetClick}
          disabled={nSlides === 0}
          className="pulso-gv2-pill-button pulso-gv2-pill-button--danger pulso-gv2-toolbar-action"
        >
          <RotateCcw size={12} /> Reset
        </button>
      </ContextBar>

      {/* Banda 2: estilo global (popup unificado) + export de PPT/Word. */}
      <ContextBar
        ariaLabel="Estilo global y exportación de reportes"
        className="pulso-gv2-command-row pulso-gv2-command-row--exports"
      >
        <button
          type="button"
          onClick={() => setEstiloOpen(true)}
          className="pulso-gv2-estilo-trigger pulso-gv2-pill-button"
          title="Configurar presets, paletas, íconos y modos para todos los slides"
        >
          <Settings2 size={13} /> Estilo global
          <span className="pulso-gv2-estilo-trigger-meta">
            {nPaletas + nIconos + nPresets + nModos > 0
              ? [
                  nPresets > 0 && `${nPresets} preset${nPresets === 1 ? "" : "s"}`,
                  nModos > 0 && `${nModos} modo${nModos === 1 ? "" : "s"}`,
                  nPaletas > 0 && `${nPaletas} paleta${nPaletas === 1 ? "" : "s"}`,
                  nIconos > 0 && `${nIconos} ícono${nIconos === 1 ? "" : "s"}`,
                ].filter(Boolean).join(" · ")
              : "configurar"}
          </span>
        </button>

        <ContextBarDivider />

        <button
          className="pulso-primary pulso-gv2-pill-button pulso-gv2-pill-button--primary"
          onClick={onExportPpt}
          disabled={!canExportFinal || exportBusy}
        >
          {exportJobKind === "ppt" ? <Loader2 size={13} className="pulso-spin" /> : <FileText size={13} />}
          Exportar .pptx
        </button>
        {pptFileId && !exportBusy && (
          <a
            href={downloadUrl(pptFileId)}
            className="pulso-gv2-download-pill"
          >
            <Download size={12} /> {pptFilename ?? "reporte.pptx"}
          </a>
        )}

        <button
          className="pulso-primary pulso-gv2-pill-button pulso-gv2-pill-button--primary"
          onClick={onExportWord}
          disabled={!canExportFinal || exportBusy}
        >
          {exportJobKind === "word" ? <Loader2 size={13} className="pulso-spin" /> : <FileText size={13} />}
          Exportar .docx
        </button>
        {docxFileId && !exportBusy && (
          <a
            href={downloadUrl(docxFileId)}
            className="pulso-gv2-download-pill"
          >
            <Download size={12} /> {docxFilename ?? "reporte.docx"}
          </a>
        )}
        {saveStatus && (
          <span className={`pulso-gv2-save-result ${saveStatus.startsWith("[") ? "is-error" : "is-ok"}`}>
            {!saveStatus.startsWith("[") && <CheckCircle2 size={12} />}
            {saveStatus}
          </span>
        )}
      </ContextBar>

      <EstiloGlobalDialog open={estiloOpen} onClose={() => setEstiloOpen(false)} />
    </div>
  );
}

// Toggle global de bordes de referencia. Cuando está activo, todos
// los graficadores renderizan bordes de color sobre los placeholders
// internos del layout — útil para diseñar y ajustar canvas en Prosecnur.
// El backend inyecta `debug_ph_bordes / debug_ph_col / debug_ph_lwd`
// al preset `base` automáticamente. Popover con color y grosor.
const DEBUG_BORDER_COLORS = ["#FF00FF", "#1F6FEB", "#16A34A", "#F97316"];
const DEBUG_BORDER_HEX_RE = /^#[0-9a-fA-F]{6}$/;
const DEBUG_BORDER_DRAFT_RE = /^#[0-9a-fA-F]{0,6}$/;

function normalizeDebugColorDraft(value: string): string | null {
  const raw = value.trim();
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  return DEBUG_BORDER_DRAFT_RE.test(withHash) ? withHash : null;
}

function isDebugColor(value: string): boolean {
  return DEBUG_BORDER_HEX_RE.test(value);
}

function clampDebugBorderWidth(value: number): number {
  return Math.min(3, Math.max(0.1, Math.round(value * 10) / 10));
}

function DebugPhToggle() {
  const debugPh = usePlanStore((s) => s.debugPh);
  const setDebugPh = usePlanStore((s) => s.setDebugPh);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [colorDraft, setColorDraft] = useState(isDebugColor(debugPh.color) ? debugPh.color : DEFAULT_DEBUG_PH.color);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPopoverOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [popoverOpen]);

  useEffect(() => {
    if (isDebugColor(debugPh.color)) setColorDraft(debugPh.color);
  }, [debugPh.color]);

  const active = debugPh.activo;
  const safeColor = isDebugColor(debugPh.color) ? debugPh.color : DEFAULT_DEBUG_PH.color;
  const rootStyle = { "--gv2-debug-border-color": safeColor } as CSSProperties;

  function commitColorDraft(nextDraft: string) {
    const normalized = normalizeDebugColorDraft(nextDraft);
    if (normalized === null) return;
    setColorDraft(normalized);
    if (isDebugColor(normalized)) setDebugPh({ color: normalized.toUpperCase() });
  }

  function revertColorDraft() {
    setColorDraft(safeColor);
  }

  return (
    <div
      ref={rootRef}
      className={`pulso-gv2-debug-border ${active ? "is-active" : ""}`}
      style={rootStyle}
    >
      <button
        type="button"
        onClick={() => setDebugPh({ activo: !active })}
        className="pulso-gv2-pill-button pulso-gv2-debug-border-trigger"
        aria-pressed={active}
        title={active ? "Ocultar bordes" : "Mostrar bordes"}
      >
        <PanelTopDashed size={12} />
        Mostrar bordes
        <span className="pulso-gv2-debug-border-chip" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => setPopoverOpen((v) => !v)}
        className={`pulso-icon pulso-gv2-icon-button pulso-gv2-debug-border-options ${popoverOpen ? "is-open" : ""}`}
        aria-label="Opciones de bordes"
        aria-expanded={popoverOpen}
        title="Color y grosor de los bordes"
      >
        <ChevronDown size={13} />
      </button>
      {popoverOpen && (
        <div
          className="pulso-gv2-debug-border-popover"
          role="dialog"
          aria-label="Bordes de referencia"
        >
          <div className="pulso-gv2-debug-border-popover-head">
            <span className="pulso-gv2-debug-border-popover-icon" aria-hidden="true">
              <PanelTopDashed size={15} />
            </span>
            <div className="pulso-gv2-debug-border-popover-title">
              <strong>Bordes de referencia</strong>
              <span>{active ? "Activo" : "Inactivo"}</span>
            </div>
            <button
              type="button"
              className={`pulso-gv2-debug-border-switch ${active ? "is-on" : ""}`}
              onClick={() => setDebugPh({ activo: !active })}
              aria-pressed={active}
            >
              <span aria-hidden="true" />
              {active ? "Activo" : "Inactivo"}
            </button>
          </div>

          <label className="pulso-gv2-debug-border-field">
            <span>Color</span>
            <input
              type="color"
              value={safeColor}
              onChange={(e) => {
                const next = e.target.value.toUpperCase();
                setColorDraft(next);
                setDebugPh({ color: next });
              }}
            />
            <input
              type="text"
              value={colorDraft}
              onChange={(e) => commitColorDraft(e.target.value)}
              onBlur={revertColorDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
              }}
            />
          </label>

          <div className="pulso-gv2-debug-border-swatches" aria-label="Colores rápidos">
            {DEBUG_BORDER_COLORS.map((color) => {
              const selected = safeColor.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={color}
                  type="button"
                  className={selected ? "is-selected" : ""}
                  style={{ "--gv2-debug-swatch": color } as CSSProperties}
                  onClick={() => {
                    setColorDraft(color);
                    setDebugPh({ color });
                  }}
                  aria-label={`Usar ${color}`}
                >
                  {selected && <CheckCircle2 size={12} />}
                </button>
              );
            })}
          </div>

          <label className="pulso-gv2-debug-border-field pulso-gv2-debug-border-field--range">
            <span>Grosor</span>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.1}
              value={debugPh.lwd}
              onChange={(e) => setDebugPh({ lwd: clampDebugBorderWidth(parseFloat(e.target.value)) })}
            />
            <input
              type="number"
              min={0.1} max={3} step={0.1}
              value={debugPh.lwd}
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                if (Number.isFinite(n)) setDebugPh({ lwd: clampDebugBorderWidth(n) });
              }}
            />
          </label>

          <button
            type="button"
            onClick={() => setPopoverOpen(false)}
            className="pulso-gv2-debug-border-done"
          >
            <CheckCircle2 size={13} />
            Listo
          </button>
        </div>
      )}
    </div>
  );
}

// Botones Undo/Redo — atajos Cmd/Ctrl+Z y Cmd/Ctrl+Shift+Z (via
// useUndoRedoShortcuts en GraficosPage). Muestra el número de acciones
// disponibles en el tooltip para que el analista tenga confianza de que
// su historial existe.
function UndoRedoButtons() {
  const past = usePlanStore((s) => s.past);
  const future = usePlanStore((s) => s.future);
  const undo = usePlanStore((s) => s.undo);
  const redo = usePlanStore((s) => s.redo);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? "⌘" : "Ctrl";
  return (
    <div className="pulso-gv2-undo-redo">
      <button
        type="button"
        onClick={undo}
        disabled={past.length === 0}
        className="pulso-gv2-icon-button"
        title={past.length === 0
          ? "Nada que deshacer"
          : `Deshacer (${mod}+Z) — ${past.length} ${past.length === 1 ? "acción disponible" : "acciones disponibles"}`}
        aria-label="Deshacer"
      >
        <Undo2 size={13} />
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={future.length === 0}
        className="pulso-gv2-icon-button"
        title={future.length === 0
          ? "Nada que rehacer"
          : `Rehacer (${mod}+Shift+Z) — ${future.length} ${future.length === 1 ? "acción disponible" : "acciones disponibles"}`}
        aria-label="Rehacer"
      >
        <Redo2 size={13} />
      </button>
    </div>
  );
}

// SaveStatusIndicator local reemplazado por
// `components/SaveStatusIndicator.tsx` — unificado con Codificación
// y Analítica.
