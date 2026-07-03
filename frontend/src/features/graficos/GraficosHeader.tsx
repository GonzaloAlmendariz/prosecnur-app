import { type CSSProperties, useEffect, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, AlignJustify, Check, CheckCircle2, ChevronDown, Download, FileText, GanttChart, LayoutGrid, RotateCcw, Loader2, Rows3, Undo2, Redo2, Settings2, PanelTopDashed, SlidersHorizontal, Upload } from "lucide-react";
import {
  apiGraficosConfigGet,
  apiGraficosConfigExport,
  apiGraficosConfigImport,
  apiGraficosShareExport,
  apiGraficosShareImport,
  apiGraficosShareInspect,
  apiSaveFileAs,
  downloadUrl,
  type GraficosShareInspectResult,
} from "../../api/client";
import { normalizeGraficosConfig } from "../../api/graficosConfigNormalizer";
import { ContextBar } from "../../components/ContextBar";
import { DEFAULT_DEBUG_PH, usePlanStore } from "./store";
import { PlanHealthBadge } from "./PlanHealthBadge";
import { PlanCoverageBadge } from "./PlanCoverageBadge";
import { SuggestedPlanButton } from "./SuggestedPlanButton";
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
  { id: "plan", label: "Slides", help: "La estructura del reporte y el contenido de cada lámina." },
  { id: "presets", label: "Estilo para PPT", help: "La apariencia base de los gráficos en PowerPoint." },
  { id: "w_presets", label: "Estilo para Word", help: "Cómo se ven los gráficos y tablas en el documento." },
  { id: "paletas", label: "Colores", help: "Las paletas usadas para respuestas y categorías." },
  { id: "iconos", label: "Íconos", help: "Los íconos cargados para láminas de población." },
  { id: "overrides_reusables", label: "Estilos guardados", help: "Apariencias reutilizables para aplicar el mismo ajuste a varios gráficos." },
  { id: "debug_ph", label: "Guías visuales", help: "Marcas temporales para revisar espacios y posiciones." },
  { id: "scope_rules", label: "Reglas específicas", help: "Ajustes que aplican solo a una lista, gráfico o slide." },
  { id: "ui_state", label: "Vista de trabajo", help: "La vista, pestaña y zoom con que dejaste el editor." },
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
    zIndex: 10000,
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
    zIndex: 10000,
    top: "calc(100% + 10px)",
    right: 0,
    width: 660,
    maxWidth: "calc(100vw - 32px)",
    padding: 12,
    borderRadius: 16,
    border: "1px solid color-mix(in srgb, var(--gv2-accent-border, var(--pulso-primary-border)) 50%, var(--pulso-border))",
    background: "linear-gradient(180deg, #ffffff, color-mix(in srgb, var(--gv2-accent-soft, var(--pulso-primary-soft)) 10%, #ffffff))",
    boxShadow: "0 22px 52px rgba(0, 36, 87, 0.16), 0 4px 12px rgba(0, 36, 87, 0.07), inset 0 1px 0 rgba(255,255,255,0.86)",
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
    maxHeight: "calc(100vh - 190px)",
    overflowY: "auto",
  },
  packagePanel: {
    border: "1px solid color-mix(in srgb, var(--gv2-accent-border, var(--pulso-primary-border)) 32%, var(--pulso-border))",
    borderRadius: 13,
    background: "rgba(255,255,255,0.9)",
    padding: 11,
  },
  packageHead: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 10,
  },
  packageActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },
  primaryActionButton: {
    minHeight: 30,
    borderRadius: 10,
    border: "1px solid var(--pulso-primary)",
    background: "var(--pulso-primary)",
    color: "white",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "0 10px",
    fontSize: 10.5,
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryActionButton: {
    minHeight: 30,
    borderRadius: 10,
    border: "1px solid var(--pulso-border)",
    background: "white",
    color: "var(--pulso-primary)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "0 10px",
    fontSize: 10.5,
    fontWeight: 760,
    cursor: "pointer",
  },
  inspectSummary: {
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "9px 10px",
    borderRadius: 12,
    border: "1px solid var(--pulso-info-border)",
    background: "var(--pulso-info-bg)",
    color: "var(--pulso-info-fg)",
    fontSize: 11,
    fontWeight: 740,
  },
  planTable: {
    marginTop: 8,
    border: "1px solid var(--pulso-border)",
    borderRadius: 12,
    overflow: "hidden",
    background: "white",
  },
  planRow: {
    display: "grid",
    gridTemplateColumns: "minmax(170px, 1.1fr) minmax(120px, 0.8fr) minmax(180px, 1.2fr) minmax(150px, 1fr)",
    gap: 10,
    alignItems: "start",
    padding: "9px 10px",
    borderBottom: "1px solid var(--pulso-border)",
    fontSize: 11,
  },
  planRowHead: {
    background: "var(--pulso-header-row)",
    color: "var(--pulso-text-soft)",
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  cellTitle: {
    display: "block",
    color: "var(--pulso-text)",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.2,
  },
  cellMuted: {
    display: "block",
    marginTop: 3,
    color: "var(--pulso-text-soft)",
    fontSize: 10.5,
    lineHeight: 1.3,
    fontWeight: 600,
  },
  warningText: {
    color: "var(--pulso-warn-fg)",
    fontWeight: 720,
    lineHeight: 1.35,
  },
  advancedToggle: {
    width: "100%",
    marginTop: 7,
    border: 0,
    background: "transparent",
    color: "var(--pulso-primary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "7px 2px 3px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },
  applyBar: {
    position: "sticky",
    bottom: -10,
    zIndex: 2,
    marginTop: 8,
    padding: "10px 0 0",
    display: "flex",
    justifyContent: "flex-end",
    background: "linear-gradient(180deg, rgba(255,255,255,0), var(--pulso-material-bg-strong) 38%)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    padding: "2px 2px 9px",
    marginBottom: 0,
  },
  headerActions: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    flex: "0 0 auto",
  },
  title: {
    display: "block",
    fontSize: 13,
    lineHeight: 1.15,
    color: "var(--pulso-text)",
  },
  lead: {
    margin: "3px 0 0",
    color: "var(--pulso-text-soft)",
    fontSize: 10.4,
    lineHeight: 1.4,
  },
  close: {
    width: 27,
    height: 27,
    borderRadius: 999,
    border: "1px solid var(--pulso-border)",
    background: "rgba(255,255,255,0.82)",
    cursor: "pointer",
    lineHeight: 1,
  },
  smallButton: {
    fontSize: 10,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid var(--pulso-border)",
    background: "white",
    cursor: "pointer",
  },
  grid: {
    display: "flex",
    flexDirection: "column",
    marginTop: 4,
    borderTop: "1px solid var(--pulso-border)",
    borderBottom: "1px solid var(--pulso-border)",
    background: "transparent",
  },
  option: {
    display: "grid",
    gridTemplateColumns: "1fr 18px",
    gap: 12,
    alignItems: "center",
    minHeight: 0,
    padding: "10px 4px",
    borderRadius: 0,
    border: 0,
    borderBottom: "1px solid var(--pulso-border)",
    background: "transparent",
    cursor: "pointer",
    transition: "background 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 120ms ease",
  },
  optionOn: {
    background: "transparent",
    boxShadow: "none",
  },
  optionText: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
  },
  optionTitle: {
    display: "block",
    color: "var(--pulso-text)",
    fontSize: 12,
    lineHeight: 1.15,
    fontWeight: 740,
    letterSpacing: "-0.01em",
  },
  optionHelp: {
    display: "block",
    color: "var(--pulso-text-soft)",
    fontSize: 10.4,
    lineHeight: 1.25,
    fontWeight: 500,
    letterSpacing: "-0.005em",
  },
  checkDot: {
    width: 32,
    height: 18,
    borderRadius: 999,
    border: "1px solid var(--pulso-border)",
    background: "#edf1f7",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-start",
    color: "transparent",
    padding: 1,
    transition: "background 140ms ease, border-color 140ms ease",
  },
  checkDotOn: {
    borderColor: "var(--pulso-primary)",
    background: "var(--pulso-primary)",
    color: "white",
  },
  switchKnob: {
    width: 14,
    height: 14,
    borderRadius: 999,
    background: "white",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.18)",
    transform: "translateX(0)",
    transition: "transform 140ms ease",
  },
  switchKnobOn: {
    transform: "translateX(14px)",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    pointerEvents: "none",
  },
  modeBox: {
    marginTop: 0,
    padding: "12px 4px 4px",
    borderRadius: 0,
    background: "transparent",
    border: 0,
    borderBottom: "1px solid var(--pulso-border)",
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    fontSize: 11,
  },
  modeLabel: {
    color: "var(--pulso-text-soft)",
    fontWeight: 700,
    flexBasis: "100%",
  },
  radio: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    padding: 0,
    borderRadius: 999,
    background: "transparent",
  },
  actions: {
    display: "flex",
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: "1 1 0",
    minHeight: 32,
    borderRadius: 12,
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
  const nPaletas = usePlanStore((s) => Object.keys(s.paletas).length);
  const nIconos = usePlanStore((s) => s.iconos.length);
  const nModos = usePlanStore((s) => s.overridesReusables.length);
  const resetPlan = usePlanStore((s) => s.reset);
  const hydrate = usePlanStore((s) => s.hydrate);
  const [estiloOpen, setEstiloOpen] = useState(false);
  const [jsonMenuOpen, setJsonMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [jsonSections, setJsonSections] = useState<Record<GraficosJsonSectionId, boolean>>(DEFAULT_JSON_SECTIONS);
  const [jsonImportMode, setJsonImportMode] = useState<"merge" | "replace">("merge");
  const [jsonBusy, setJsonBusy] = useState<"export" | "import" | null>(null);
  const [shareBusy, setShareBusy] = useState<"export" | "inspect" | "apply" | null>(null);
  const [sharePlan, setSharePlan] = useState<GraficosShareInspectResult | null>(null);
  const [shareSelected, setShareSelected] = useState<Record<string, boolean>>({});
  const [jsonAdvancedOpen, setJsonAdvancedOpen] = useState(false);
  const [jsonMsg, setJsonMsg] = useState("");
  const [jsonError, setJsonError] = useState("");
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const shareFileRef = useRef<HTMLInputElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const { project } = useProjectShell();
  const savedRef = useRef<Record<string, true>>({});
  const [saveStatus, setSaveStatus] = useState("");
  const styleTriggerItems = [
    { key: "ppt", label: "Base PPT", tone: "base" },
    ...(nModos > 0 ? [{ key: "modos", label: `${nModos} estilo${nModos === 1 ? "" : "s"}`, tone: "mode" }] : []),
    ...(nPaletas > 0 ? [{ key: "paletas", label: `${nPaletas} paleta${nPaletas === 1 ? "" : "s"}`, tone: "color" }] : []),
    ...(nIconos > 0 ? [{ key: "iconos", label: `${nIconos} ícono${nIconos === 1 ? "" : "s"}`, tone: "asset" }] : []),
  ];

  // El botón de export se desactiva si el padre lo bloquea (sesión sin
  // rp_data) O si el validador detecta errores (plan vacío, etc.).
  // Los warnings no bloquean — aparecen en el badge pero el export corre.
  const validator = usePlanValidator();
  const canExportFinal = canExport && validator.canExport;
  const generatedReports = Number(Boolean(pptFileId)) + Number(Boolean(docxFileId));

  useEffect(() => {
    if (!exportMenuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExportMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [exportMenuOpen]);

  useEffect(() => {
    if (!jsonMenuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) setJsonMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setJsonMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [jsonMenuOpen]);

  function selectedJsonSections() {
    return GRAFICOS_JSON_SECTIONS.filter((section) => jsonSections[section.id]);
  }

  function setAllJsonSections(value: boolean) {
    setJsonSections(Object.fromEntries(GRAFICOS_JSON_SECTIONS.map((section) => [section.id, value])) as Record<GraficosJsonSectionId, boolean>);
  }

  function selectedShareBases() {
    if (!sharePlan) return [];
    return sharePlan.bases
      .filter((base) => !base.blocking && shareSelected[base.base_name])
      .map((base) => base.base_name);
  }

  async function packageExport() {
    setJsonError(""); setJsonMsg(""); setShareBusy("export");
    try {
      const result = await apiGraficosShareExport();
      const a = document.createElement("a");
      a.href = downloadUrl(result.file_id);
      a.download = result.filename || "plan_graficos.pulso-graficos.zip";
      a.click();
      setJsonMsg("Paquete compartible exportado");
    } catch (e) {
      setJsonError((e as Error).message);
    } finally {
      setShareBusy(null);
      setTimeout(() => setJsonMsg(""), 3000);
    }
  }

  async function packageInspect(file?: File) {
    if (!file) return;
    setJsonError(""); setJsonMsg(""); setShareBusy("inspect");
    try {
      const plan = await apiGraficosShareInspect(file);
      const selected = Object.fromEntries(plan.bases.map((base) => [base.base_name, Boolean(base.selected_default && !base.blocking)]));
      setSharePlan(plan);
      setShareSelected(selected);
      setJsonMsg(`${plan.summary.n_compatible}/${plan.summary.n_bases} bases compatibles`);
    } catch (e) {
      setSharePlan(null);
      setShareSelected({});
      setJsonError((e as Error).message);
    } finally {
      setShareBusy(null);
      if (shareFileRef.current) shareFileRef.current.value = "";
      setTimeout(() => setJsonMsg(""), 3200);
    }
  }

  async function packageApply() {
    if (!sharePlan) return;
    const bases = selectedShareBases();
    if (!bases.length) {
      setJsonError("Selecciona al menos una base compatible.");
      return;
    }
    setJsonError(""); setJsonMsg(""); setShareBusy("apply");
    try {
      await apiGraficosShareImport(sharePlan.package_file_id, bases);
      const refreshed = await apiGraficosConfigGet();
      const cfg = normalizeGraficosConfig(refreshed.config ?? refreshed, { includeLegacyAliases: true });
      hydrate(cfg as never);
      setJsonMsg(`Plan aplicado a ${bases.length} base${bases.length === 1 ? "" : "s"}`);
    } catch (e) {
      setJsonError((e as Error).message);
    } finally {
      setShareBusy(null);
      setTimeout(() => setJsonMsg(""), 3600);
    }
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
      <ContextBar
        ariaLabel="Acciones del plan de gráficos"
        density="compact"
        className="pulso-gv2-command-row pulso-gv2-command-row--unified"
      >
        <div className="pulso-gv2-command-cluster pulso-gv2-command-cluster--state">
          <PlanSnapshotBadge
            nSlides={nSlides}
            hydrated={hydrated}
            dirty={dirty}
          />
        </div>

        <div className="pulso-gv2-command-cluster pulso-gv2-command-cluster--mode">
          <ConstructorViewControls issueCount={validator.issues.length} />
        </div>

        <div className="pulso-gv2-command-cluster pulso-gv2-command-cluster--review">
          <UndoRedoButtons />
          <PlanHealthBadge />
          <PlanCoverageBadge />
          <SuggestedPlanButton />
        </div>

        <div className="pulso-gv2-command-spacer" aria-hidden="true" />

        <div className="pulso-gv2-command-cluster pulso-gv2-command-cluster--tools">
          <DebugPhToggle />

          <button
            type="button"
            onClick={() => {
              setJsonMenuOpen(false);
              setExportMenuOpen(false);
              setEstiloOpen(true);
            }}
            className={`pulso-gv2-estilo-trigger pulso-gv2-pill-button ${estiloOpen ? "is-open" : ""}`}
            aria-haspopup="dialog"
            aria-expanded={estiloOpen}
            title="Configurar bases visuales, color, íconos y estilos guardados para todos los slides"
          >
            <span className="pulso-gv2-estilo-trigger-icon" aria-hidden="true">
              <Settings2 size={13} />
            </span>
            <span className="pulso-gv2-estilo-trigger-copy">
              <span className="pulso-gv2-estilo-trigger-label">Estilo</span>
              <span className="pulso-gv2-estilo-trigger-meta">
                {styleTriggerItems.map((item) => (
                  <span key={item.key} data-tone={item.tone}>{item.label}</span>
                ))}
              </span>
            </span>
          </button>

          <div style={jsonIoStyles.wrap} ref={shareMenuRef}>
          <button
            type="button"
            onClick={() => {
              setExportMenuOpen(false);
              setJsonMenuOpen((x) => !x);
            }}
            className="pulso-gv2-pill-button pulso-gv2-toolbar-action"
            aria-expanded={jsonMenuOpen}
            aria-label={`Compartir plan. ${selectedJsonSections().length} de ${GRAFICOS_JSON_SECTIONS.length} secciones activas`}
            title="Compartir plan editable e importar/exportar configuración"
          >
            <SlidersHorizontal size={12} />
            <span className="pulso-gv2-toolbar-label">Compartir</span>
            <span style={jsonIoStyles.count}>{selectedJsonSections().length}/{GRAFICOS_JSON_SECTIONS.length}</span>
          </button>

          {jsonMenuOpen && (
            <div style={jsonIoStyles.popover} role="dialog" aria-label="Compartir plan de gráficos">
              <div style={jsonIoStyles.header}>
                <div>
                  <strong style={jsonIoStyles.title}>Compartir plan de gráficos</strong>
                  <p style={jsonIoStyles.lead}>Paquete portable para llevar el plan editable a otro proyecto compatible.</p>
                </div>
                <div style={jsonIoStyles.headerActions}>
                  <button type="button" onClick={() => setJsonMenuOpen(false)} style={jsonIoStyles.close}>×</button>
                </div>
              </div>

              <div style={jsonIoStyles.packagePanel}>
                <div style={jsonIoStyles.packageHead}>
                  <div>
                    <strong style={jsonIoStyles.optionTitle}>Paquete portable</strong>
                    <small style={jsonIoStyles.optionHelp}>
                      No cambia data ni XLSForm. Al aplicar, reemplaza solo el plan de Gráficos y pide regenerar PPT/Word.
                    </small>
                  </div>
                  <div style={jsonIoStyles.packageActions}>
                    <button type="button" onClick={packageExport} disabled={shareBusy === "export"} style={jsonIoStyles.primaryActionButton}>
                      {shareBusy === "export" ? <Loader2 size={12} className="pulso-spin" /> : <Download size={12} />}
                      Exportar plan compartible
                    </button>
                    <label style={{ ...jsonIoStyles.secondaryActionButton, cursor: shareBusy === "inspect" ? "wait" : "pointer" }}>
                      {shareBusy === "inspect" ? <Loader2 size={12} className="pulso-spin" /> : <Upload size={12} />}
                      Importar plan compartido
                      <input
                        ref={shareFileRef}
                        type="file"
                        accept=".pulso-graficos.zip,.zip,application/zip"
                        style={{ display: "none" }}
                        onChange={(e) => void packageInspect(e.target.files?.[0])}
                      />
                    </label>
                  </div>
                </div>

                {sharePlan && (
                  <>
                    <div style={jsonIoStyles.inspectSummary}>
                      <span>
                        {sharePlan.summary.n_compatible}/{sharePlan.summary.n_bases} bases compatibles · {sharePlan.manifest.n_slides} slides · {sharePlan.summary.n_warnings} advertencias
                      </span>
                      <span>{sharePlan.filename}</span>
                    </div>

                    <div style={jsonIoStyles.planTable}>
                      <div style={{ ...jsonIoStyles.planRow, ...jsonIoStyles.planRowHead }}>
                        <span>Base</span>
                        <span>Actualmente</span>
                        <span>Después de aplicar</span>
                        <span>Variables faltantes</span>
                      </div>
                      {sharePlan.bases.map((base, index) => {
                        const missing = base.impact.missing_variables;
                        const checked = Boolean(shareSelected[base.base_name] && !base.blocking);
                        return (
                          <label
                            key={base.base_name}
                            style={{
                              ...jsonIoStyles.planRow,
                              ...(index === sharePlan.bases.length - 1 ? { borderBottom: 0 } : {}),
                              ...(base.blocking ? { background: "var(--pulso-warn-bg)" } : {}),
                            }}
                          >
                            <span>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={base.blocking}
                                onChange={(e) => setShareSelected((prev) => ({ ...prev, [base.base_name]: e.target.checked }))}
                              />{" "}
                              <strong style={jsonIoStyles.cellTitle}>{base.base_label || base.base_name}</strong>
                              <small style={jsonIoStyles.cellMuted}>{base.base_name}</small>
                            </span>
                            <span>
                              <strong style={jsonIoStyles.cellTitle}>{base.current.n_slides} slides</strong>
                              <small style={jsonIoStyles.cellMuted}>XLSForm y data se conservan</small>
                            </span>
                            <span>
                              <strong style={jsonIoStyles.cellTitle}>
                                {base.incoming.n_slides_applicable}/{base.incoming.n_slides_total} slides se conservarán
                              </strong>
                              <small style={jsonIoStyles.cellMuted}>
                                {missing.length > 0
                                  ? "variables faltantes quedarán vacías"
                                  : "sin omisiones"}
                              </small>
                            </span>
                            <span>
                              {missing.length === 0 ? (
                                <small style={jsonIoStyles.cellMuted}>Todas las variables del plan están disponibles.</small>
                              ) : (
                                <small style={jsonIoStyles.warningText}>
                                  {missing.slice(0, 4).map((v) => `${v.code}: ${v.label}`).join(" · ")}
                                  {missing.length > 4 ? ` · +${missing.length - 4}` : ""}
                                </small>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <div style={jsonIoStyles.applyBar}>
                      <button
                        type="button"
                        onClick={packageApply}
                        disabled={shareBusy === "apply" || selectedShareBases().length === 0}
                        style={jsonIoStyles.primaryActionButton}
                      >
                        {shareBusy === "apply" ? <Loader2 size={12} className="pulso-spin" /> : <Check size={12} />}
                        Aplicar a {selectedShareBases().length} base{selectedShareBases().length === 1 ? "" : "s"} compatible{selectedShareBases().length === 1 ? "" : "s"}
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setJsonAdvancedOpen((v) => !v)}
                style={jsonIoStyles.advancedToggle}
                aria-expanded={jsonAdvancedOpen}
              >
                <span>JSON avanzado</span>
                <ChevronDown size={13} />
              </button>

              {jsonAdvancedOpen && (
                <>
                  <div style={jsonIoStyles.header}>
                    <div>
                      <strong style={jsonIoStyles.title}>Partes del JSON</strong>
                      <p style={jsonIoStyles.lead}>{selectedJsonSections().length} de {GRAFICOS_JSON_SECTIONS.length} secciones activas.</p>
                    </div>
                    <div style={jsonIoStyles.headerActions}>
                      <button type="button" onClick={() => setAllJsonSections(true)} style={jsonIoStyles.smallButton}>Todo</button>
                      <button type="button" onClick={() => setAllJsonSections(false)} style={jsonIoStyles.smallButton}>Nada</button>
                    </div>
                  </div>

                  <div style={jsonIoStyles.grid}>
                    {GRAFICOS_JSON_SECTIONS.map((section, index) => (
                      <label
                        key={section.id}
                        title={section.help}
                        style={{
                          ...jsonIoStyles.option,
                          ...(jsonSections[section.id] ? jsonIoStyles.optionOn : {}),
                          ...(index === GRAFICOS_JSON_SECTIONS.length - 1 ? { borderBottom: 0 } : {}),
                        }}
                        >
                          <span style={jsonIoStyles.optionText}>
                            <strong style={jsonIoStyles.optionTitle}>{section.label}</strong>
                            <small style={jsonIoStyles.optionHelp}>{section.help}</small>
                        </span>
                        <span style={{ ...jsonIoStyles.checkDot, ...(jsonSections[section.id] ? jsonIoStyles.checkDotOn : {}) }}>
                          <span style={{ ...jsonIoStyles.switchKnob, ...(jsonSections[section.id] ? jsonIoStyles.switchKnobOn : {}) }} />
                        </span>
                        <input
                          type="checkbox"
                          checked={jsonSections[section.id]}
                          onChange={(e) => setJsonSections((prev) => ({ ...prev, [section.id]: e.target.checked }))}
                          style={jsonIoStyles.hiddenInput}
                        />
                      </label>
                    ))}
                  </div>

                  <div style={jsonIoStyles.modeBox}>
                    <span style={jsonIoStyles.modeLabel}>Importación JSON</span>
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
                      <Download size={12} /> {jsonBusy === "export" ? "Exportando…" : "Exportar selección"}
                    </button>
                    <label style={{ ...jsonIoStyles.actionButton, cursor: jsonBusy === "import" ? "wait" : "pointer" }}>
                      <Upload size={12} /> {jsonBusy === "import" ? "Importando…" : "Importar selección"}
                      <input
                        ref={jsonFileRef}
                        type="file"
                        accept=".json,application/json"
                        style={{ display: "none" }}
                        onChange={(e) => void ioImport(e.target.files?.[0])}
                      />
                    </label>
                  </div>
                </>
              )}
            </div>
          )}
          </div>

          <div className="pulso-gv2-export-menu" ref={exportMenuRef}>
            <button
              type="button"
              className="pulso-primary pulso-gv2-pill-button pulso-gv2-pill-button--primary pulso-gv2-export-menu-trigger"
              onClick={() => {
                setJsonMenuOpen(false);
                setExportMenuOpen((v) => !v);
              }}
              disabled={!canExportFinal && !pptFileId && !docxFileId}
              aria-haspopup="dialog"
              aria-expanded={exportMenuOpen}
              title={canExportFinal ? "Exportar el reporte en PowerPoint o Word" : "Revisa el estado del plan antes de exportar"}
            >
              {exportBusy ? <Loader2 size={13} className="pulso-spin" /> : <Download size={13} />}
              <span>Exportar</span>
              {generatedReports > 0 && <b>{generatedReports}</b>}
              <ChevronDown size={13} />
            </button>

            {exportMenuOpen && (
              <div className="pulso-gv2-export-menu-popover" role="dialog" aria-label="Exportar reporte">
                <div className="pulso-gv2-export-menu-head">
                  <span className="pulso-gv2-export-menu-mark" aria-hidden="true">
                    <Download size={15} />
                  </span>
                  <div>
                    <strong>Exportar reporte</strong>
                    <span>Elige el archivo final que necesitas generar.</span>
                  </div>
                </div>

                {!canExportFinal && (
                  <div className="pulso-gv2-export-menu-warning">
                    Revisa el estado del plan antes de generar archivos.
                  </div>
                )}

                <div className="pulso-gv2-export-menu-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setExportMenuOpen(false);
                      onExportPpt();
                    }}
                    disabled={!canExportFinal || exportBusy}
                  >
                    <span className="pulso-gv2-export-menu-action-icon" aria-hidden="true">
                      {exportJobKind === "ppt" ? <Loader2 size={14} className="pulso-spin" /> : <FileText size={14} />}
                    </span>
                    <span>
                      <strong>PowerPoint</strong>
                      <small>PPTX editable</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExportMenuOpen(false);
                      onExportWord();
                    }}
                    disabled={!canExportFinal || exportBusy}
                  >
                    <span className="pulso-gv2-export-menu-action-icon" aria-hidden="true">
                      {exportJobKind === "word" ? <Loader2 size={14} className="pulso-spin" /> : <FileText size={14} />}
                    </span>
                    <span>
                      <strong>Word</strong>
                      <small>DOCX narrativo</small>
                    </span>
                  </button>
                </div>

                {(pptFileId || docxFileId || saveStatus) && (
                  <div className="pulso-gv2-export-menu-files">
                    {pptFileId && !exportBusy && (
                      <a href={downloadUrl(pptFileId)}>
                        <Download size={12} /> {pptFilename ?? "reporte.pptx"}
                      </a>
                    )}
                    {docxFileId && !exportBusy && (
                      <a href={downloadUrl(docxFileId)}>
                        <Download size={12} /> {docxFilename ?? "reporte.docx"}
                      </a>
                    )}
                    {saveStatus && (
                      <span className={saveStatus.startsWith("[") ? "is-error" : "is-ok"}>
                        {!saveStatus.startsWith("[") && <CheckCircle2 size={12} />}
                        {saveStatus}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onResetClick}
            disabled={nSlides === 0}
            className="pulso-gv2-icon-button pulso-gv2-toolbar-reset"
            aria-label="Vaciar plan"
            title="Vaciar plan"
          >
            <RotateCcw size={12} />
          </button>
        </div>

        {jsonMsg && (
          <span role="status" style={jsonIoStyles.msg}><Check size={11} /> {jsonMsg}</span>
        )}
        {jsonError && (
          <span role="alert" style={jsonIoStyles.error}><AlertCircle size={11} /> {jsonError}</span>
        )}
      </ContextBar>

      <EstiloGlobalDialog open={estiloOpen} onClose={() => setEstiloOpen(false)} />
    </div>
  );
}

function PlanSnapshotBadge({
  nSlides,
  hydrated,
  dirty,
}: {
  nSlides: number;
  hydrated: boolean;
  dirty: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const saveLabel = !hydrated
    ? "Cargando plan"
    : dirty
      ? "Guardando cambios"
      : "Cambios guardados";

  return (
    <div className="pulso-gv2-plan-snapshot" ref={rootRef}>
      <button
        type="button"
        className="pulso-gv2-plan-snapshot-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`${nSlides} ${nSlides === 1 ? "slide" : "slides"} · ${saveLabel}`}
      >
        <FileText size={13} />
        <strong>{nSlides}</strong>
        <span>slides</span>
      </button>

      {open && (
        <div className="pulso-gv2-plan-snapshot-popover" role="dialog" aria-label="Estado del plan">
          <div>
            <strong>{nSlides === 0 ? "Plan vacío" : `${nSlides} ${nSlides === 1 ? "slide" : "slides"}`}</strong>
            <span>{nSlides === 0 ? "Agrega slides desde el timeline." : "Estructura editable del reporte actual."}</span>
          </div>
          <div>
            <strong>{saveLabel}</strong>
            <span>El guardado ocurre en segundo plano mientras editas.</span>
          </div>
        </div>
      )}
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

const CONSTRUCTOR_VIEW_MODES = [
  { key: "timeline" as const, label: "Timeline", Icon: GanttChart, hint: "Vista lineal para ordenar slides" },
  { key: "canvas" as const, label: "Canvas", Icon: LayoutGrid, hint: "Grilla para reordenar en bloque" },
];

function ConstructorViewControls({ issueCount }: { issueCount: number }) {
  const viewMode = usePlanStore((s) => s.viewMode);
  const setViewMode = usePlanStore((s) => s.setViewMode);
  const density = usePlanStore((s) => s.density);
  const setDensity = usePlanStore((s) => s.setDensity);
  const slides = usePlanStore((s) => s.plan.slides);
  const selectedSlideId = usePlanStore((s) => s.selectedSlideId);
  const selectedIndex = selectedSlideId ? slides.findIndex((slide) => slide.id === selectedSlideId) : -1;
  const currentSlideLabel = slides.length === 0
    ? "sin slides"
    : selectedIndex >= 0
      ? `slide ${selectedIndex + 1}/${slides.length}`
      : `${slides.length} ${slides.length === 1 ? "slide" : "slides"}`;
  const densityLabel = density === "compact" ? "Compacto" : "Cómodo";

  return (
    <div className="pulso-gv2-command-view-control" role="toolbar" aria-label="Vista del constructor">
      <div className="pulso-gv2-suite-status" aria-label={`Constructor, ${currentSlideLabel}`}>
        <span className="pulso-gv2-suite-mark" aria-hidden="true">
          <LayoutGrid size={13} />
        </span>
        <span className="pulso-gv2-suite-copy">
          <strong>Constructor</strong>
          <span>{currentSlideLabel}</span>
        </span>
        {issueCount > 0 && (
          <span className="pulso-gv2-suite-chip is-warn">
            <AlertTriangle size={11} />
            {issueCount}
          </span>
        )}
      </div>

      <div className="pulso-gv2-mode-tabs pulso-gv2-segmented" role="tablist" aria-label="Modo de trabajo">
        {CONSTRUCTOR_VIEW_MODES.map(({ key, label, Icon, hint }) => (
          <button
            key={key}
            role="tab"
            aria-selected={viewMode === key}
            type="button"
            className={`pulso-gv2-mode-tab ${viewMode === key ? "is-active" : ""}`}
            onClick={() => setViewMode(key)}
            aria-label={`${label}. ${hint}`}
            title={hint}
          >
            <Icon size={12} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className={`pulso-gv2-density-toggle pulso-gv2-pill-button ${density === "compact" ? "is-on" : ""}`}
        onClick={() => setDensity(density === "comfortable" ? "compact" : "comfortable")}
        aria-label={density === "compact" ? "Cambiar a vista cómoda" : "Cambiar a vista compacta"}
        aria-pressed={density === "compact"}
        title={density === "compact" ? "Cambiar a vista cómoda" : "Cambiar a vista compacta"}
      >
        {density === "compact" ? <AlignJustify size={12} /> : <Rows3 size={12} />}
        <span>{densityLabel}</span>
      </button>
    </div>
  );
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
        title={active ? "Ocultar guías de layout" : "Mostrar guías de layout"}
      >
        <PanelTopDashed size={12} />
        <span className="pulso-gv2-debug-border-label">Guías</span>
        <span className="pulso-gv2-debug-border-chip" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => setPopoverOpen((v) => !v)}
        className={`pulso-icon pulso-gv2-icon-button pulso-gv2-debug-border-options ${popoverOpen ? "is-open" : ""}`}
        aria-label="Configurar guías de layout"
        aria-expanded={popoverOpen}
        title="Color y grosor de las guías"
      >
        <ChevronDown size={13} />
      </button>
      {popoverOpen && (
        <div
          className="pulso-gv2-debug-border-popover"
          role="dialog"
          aria-label="Guías de layout"
        >
          <div className="pulso-gv2-debug-border-popover-head">
            <span className="pulso-gv2-debug-border-popover-icon" aria-hidden="true">
              <PanelTopDashed size={15} />
            </span>
            <div className="pulso-gv2-debug-border-popover-title">
              <strong>Guías de layout</strong>
              <span>{active ? "Visibles en el preview" : "Ocultas en el preview"}</span>
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
