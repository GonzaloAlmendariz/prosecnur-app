import { useEffect, useRef, useState } from "react";
import { Bug, Download, FileText, Palette, RotateCcw, Loader2, Undo2, Redo2, Sparkles } from "lucide-react";
import {
  apiGraficosConfigExport,
  apiGraficosConfigImport,
  downloadUrl,
} from "../../api/client";
import { ConfigIoButtons } from "../../components/ConfigIoButtons";
import { ContextBar, ContextBarDivider } from "../../components/ContextBar";
import { SaveStatusIndicator } from "../../components/SaveStatusIndicator";
import { usePlanStore } from "./store";
import { PlanHealthBadge } from "./PlanHealthBadge";
import { usePlanValidator } from "./usePlanValidator";
import { TemplatesModal } from "./TemplatesModal";

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
  onOpenPresets,
  pptFileId,
  docxFileId,
  exportBusy,
  exportJobKind,
  canExport,
}: {
  onExportPpt: () => void;
  onExportWord: () => void;
  onOpenPresets: (kind: "ppt" | "word") => void;
  pptFileId: string | null;
  docxFileId: string | null;
  exportBusy: boolean;
  exportJobKind: "ppt" | "word" | null;
  canExport: boolean;
}) {
  const dirty = usePlanStore((s) => s.dirty);
  const hydrated = usePlanStore((s) => s.hydrated);
  const nSlides = usePlanStore((s) => s.plan.slides.length);
  const resetPlan = usePlanStore((s) => s.reset);
  const loadPlan = usePlanStore((s) => s.loadPlan);

  // El botón de export se desactiva si el padre lo bloquea (sesión sin
  // rp_data) O si el validador detecta errores (plan vacío, etc.).
  // Los warnings no bloquean — aparecen en el badge pero el export corre.
  const validator = usePlanValidator();
  const canExportFinal = canExport && validator.canExport;

  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Callbacks para ConfigIoButtons: el componente compartido se encarga
  // de busy state, mensaje de éxito transitorio, error inline.
  async function ioExport() {
    const bundle = await apiGraficosConfigExport();
    const { ok: _ok, ...payload } = bundle;
    void _ok;
    return payload;
  }

  async function ioImport(parsed: unknown) {
    await apiGraficosConfigImport(parsed as never);
    // Tras importar al backend, también aplicamos el plan al store local
    // para que el UI refleje sin esperar al próximo reload.
    const p = parsed as { config?: { plan?: { slides?: unknown } } } | null;
    if (p && p.config?.plan?.slides) {
      loadPlan(p.config.plan as never);
    }
  }

  function onResetClick() {
    if (!window.confirm("¿Vaciar el plan? Se elimina el orden actual de slides. Esta acción se guarda automáticamente.")) return;
    resetPlan();
  }

  // Estado del badge de autosave (3 variantes visuales).
  const savingNow = hydrated && dirty;
  const savedAll = hydrated && !dirty;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
      {/* Banda 1: contexto del plan + acciones de config/plantillas. */}
      <ContextBar
        ariaLabel="Estado del plan y acciones de configuración"
        density="compact"
      >
        <SaveStatusIndicator
          state={savedAll ? "saved" : savingNow ? "saving" : "loading"}
          savedLabel="Autoguardado"
        />

        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", flex: 1, lineHeight: 1.4 }}>
          {nSlides === 0
            ? "Empieza agregando slides en el panel izquierdo."
            : `${nSlides} ${nSlides === 1 ? "slide" : "slides"} en el plan. Tu plan se guarda automáticamente.`}
        </span>

        <UndoRedoButtons />
        <PlanHealthBadge />
        <DebugPhToggle />

        <button
          type="button"
          onClick={() => setTemplatesOpen(true)}
          style={{
            fontSize: 11, padding: "5px 10px",
            display: "inline-flex", alignItems: "center", gap: 5,
            border: "1px solid var(--pulso-primary)",
            color: "var(--pulso-primary)",
            background: "var(--pulso-primary-soft)",
            borderRadius: 6, cursor: "pointer",
          }}
        >
          <Sparkles size={12} /> Plantillas
        </button>

        <ConfigIoButtons
          onExport={ioExport}
          onImport={ioImport}
          filenamePrefix="pulso_graficos"
        />

        <button
          type="button"
          onClick={onResetClick}
          disabled={nSlides === 0}
          style={{
            fontSize: 11, padding: "5px 10px",
            display: "inline-flex", alignItems: "center", gap: 5,
            color: nSlides === 0 ? "var(--pulso-text-soft)" : "var(--pulso-danger-fg)",
          }}
        >
          <RotateCcw size={12} /> Reset
        </button>
      </ContextBar>

      {/* Banda 2: presets + export de PPT/Word (acciones finales). */}
      <ContextBar
        ariaLabel="Presets y exportación de reportes"
        style={{ gap: 8 }}
      >
        <button
          onClick={() => onOpenPresets("ppt")}
          title="Estilos globales del PPT"
          style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Palette size={13} /> Presets PPT
        </button>
        <button
          onClick={() => onOpenPresets("word")}
          title="Estilos globales del Word"
          style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Palette size={13} /> Presets Word
        </button>

        <ContextBarDivider />

        <button
          className="pulso-primary"
          onClick={onExportPpt}
          disabled={!canExportFinal || exportBusy}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {exportJobKind === "ppt" ? <Loader2 size={13} className="pulso-spin" /> : <FileText size={13} />}
          Exportar .pptx
        </button>
        {pptFileId && !exportBusy && (
          <a
            href={downloadUrl(pptFileId)}
            style={{
              fontSize: 12, fontWeight: 600, textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "5px 10px", borderRadius: 999,
              color: "var(--pulso-primary)", background: "var(--pulso-primary-soft)",
            }}
          >
            <Download size={12} /> reporte.pptx
          </a>
        )}

        <button
          className="pulso-primary"
          onClick={onExportWord}
          disabled={!canExportFinal || exportBusy}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {exportJobKind === "word" ? <Loader2 size={13} className="pulso-spin" /> : <FileText size={13} />}
          Exportar .docx
        </button>
        {docxFileId && !exportBusy && (
          <a
            href={downloadUrl(docxFileId)}
            style={{
              fontSize: 12, fontWeight: 600, textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "5px 10px", borderRadius: 999,
              color: "var(--pulso-primary)", background: "var(--pulso-primary-soft)",
            }}
          >
            <Download size={12} /> reporte.docx
          </a>
        )}
      </ContextBar>

      {templatesOpen && <TemplatesModal onClose={() => setTemplatesOpen(false)} />}
    </div>
  );
}

// Toggle global del debug de placeholders. Cuando está activo, todos
// los graficadores renderizan bordes de color sobre los placeholders
// internos del layout — útil para diseñar y ajustar canvas en Pulso.
// El backend inyecta `debug_ph_bordes / debug_ph_col / debug_ph_lwd`
// al preset `base` automáticamente. Popover con color y grosor.
function DebugPhToggle() {
  const debugPh = usePlanStore((s) => s.debugPh);
  const setDebugPh = usePlanStore((s) => s.setDebugPh);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPopoverOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [popoverOpen]);

  const active = debugPh.activo;

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}>
      <button
        type="button"
        onClick={() => setDebugPh({ activo: !active })}
        title={active ? "Desactivar bordes de debug" : "Activar bordes de debug"}
        style={{
          fontSize: 11, padding: "5px 10px",
          display: "inline-flex", alignItems: "center", gap: 5,
          border: `1px solid ${active ? debugPh.color : "var(--pulso-border)"}`,
          borderRadius: 6,
          background: active ? `${debugPh.color}14` : "white",
          color: active ? debugPh.color : "var(--pulso-text)",
          fontWeight: active ? 600 : 500,
          cursor: "pointer",
          transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
        }}
      >
        <Bug size={12} />
        Debug bordes
        {active && (
          <span
            style={{
              display: "inline-block", width: 8, height: 8, borderRadius: 2,
              background: debugPh.color,
              marginLeft: 2,
            }}
          />
        )}
      </button>
      <button
        type="button"
        onClick={() => setPopoverOpen((v) => !v)}
        className="pulso-icon"
        aria-label="Opciones de debug"
        title="Color / grosor del debug"
        style={{ minWidth: 22, minHeight: 22 }}
      >
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {popoverOpen && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0,
            zIndex: 30,
            minWidth: 220,
            padding: 12,
            background: "white",
            border: "1px solid var(--pulso-border)",
            borderRadius: 8,
            boxShadow: "var(--pulso-shadow-med)",
            display: "flex", flexDirection: "column", gap: 10,
          }}
        >
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
            Marca los bordes de los placeholders internos del layout para
            diseñar y ajustar canvas. Se aplica a <strong>todos los gráficos</strong>.
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ flex: 1, fontWeight: 600 }}>Color</span>
            <input
              type="color"
              value={debugPh.color}
              onChange={(e) => setDebugPh({ color: e.target.value })}
              style={{ width: 40, height: 24, padding: 0, border: "1px solid var(--pulso-border)", borderRadius: 4, cursor: "pointer" }}
            />
            <input
              type="text"
              value={debugPh.color}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) {
                  setDebugPh({ color: v.startsWith("#") || v === "" ? v : `#${v}` });
                }
              }}
              style={{
                width: 80, fontSize: 11, fontFamily: "monospace",
                padding: "3px 6px", borderRadius: 4, border: "1px solid var(--pulso-border)",
              }}
            />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ flex: 1, fontWeight: 600 }}>Grosor (lwd)</span>
            <input
              type="number"
              min={0.1} max={3} step={0.1}
              value={debugPh.lwd}
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                if (Number.isFinite(n) && n > 0) setDebugPh({ lwd: n });
              }}
              style={{ width: 70, fontSize: 11, padding: "3px 6px", borderRadius: 4, border: "1px solid var(--pulso-border)" }}
            />
          </label>

          <button
            type="button"
            onClick={() => setPopoverOpen(false)}
            style={{ alignSelf: "flex-end", fontSize: 11, padding: "3px 10px" }}
          >
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
    <div style={{ display: "inline-flex", gap: 2 }}>
      <button
        type="button"
        onClick={undo}
        disabled={past.length === 0}
        title={past.length === 0
          ? "Nada que deshacer"
          : `Deshacer (${mod}+Z) — ${past.length} ${past.length === 1 ? "acción disponible" : "acciones disponibles"}`}
        aria-label="Deshacer"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 28, height: 28, padding: 0,
          border: "1px solid var(--pulso-border)",
          borderRadius: 6,
          background: "white",
          color: past.length === 0 ? "var(--pulso-text-soft)" : "var(--pulso-text)",
          cursor: past.length === 0 ? "default" : "pointer",
          opacity: past.length === 0 ? 0.5 : 1,
        }}
      >
        <Undo2 size={13} />
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={future.length === 0}
        title={future.length === 0
          ? "Nada que rehacer"
          : `Rehacer (${mod}+Shift+Z) — ${future.length} ${future.length === 1 ? "acción disponible" : "acciones disponibles"}`}
        aria-label="Rehacer"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 28, height: 28, padding: 0,
          border: "1px solid var(--pulso-border)",
          borderRadius: 6,
          background: "white",
          color: future.length === 0 ? "var(--pulso-text-soft)" : "var(--pulso-text)",
          cursor: future.length === 0 ? "default" : "pointer",
          opacity: future.length === 0 ? 0.5 : 1,
        }}
      >
        <Redo2 size={13} />
      </button>
    </div>
  );
}

// SaveStatusIndicator local reemplazado por
// `components/SaveStatusIndicator.tsx` — unificado con Codificación
// y Analítica.
