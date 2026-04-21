import { useEffect, useRef, useState } from "react";
import { Bug, CheckCircle2, Download, FileText, Palette, Upload, RotateCcw, Loader2 } from "lucide-react";
import {
  apiGraficosConfigExport,
  apiGraficosConfigImport,
  downloadUrl,
} from "../../api/client";
import { usePlanStore } from "./store";
import { PlanHealthBadge } from "./PlanHealthBadge";
import { usePlanValidator } from "./usePlanValidator";

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

  const [ioBusy, setIoBusy] = useState<"export" | "import" | null>(null);
  const [ioMsg, setIoMsg] = useState("");
  const [ioError, setIoError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onExport() {
    setIoError(""); setIoMsg(""); setIoBusy("export");
    try {
      const bundle = await apiGraficosConfigExport();
      const { ok: _ok, ...payload } = bundle;
      void _ok;
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `pulso_graficos_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setIoMsg("Exportado ✓");
    } catch (e) {
      setIoError((e as Error).message);
    } finally {
      setIoBusy(null);
      setTimeout(() => setIoMsg(""), 2500);
    }
  }

  async function onImport(file?: File) {
    if (!file) return;
    setIoError(""); setIoMsg(""); setIoBusy("import");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await apiGraficosConfigImport(parsed);
      // Tras importar al backend, también aplicamos el plan al store
      // local para que el UI refleje sin esperar al próximo reload.
      if (parsed?.config?.plan?.slides) {
        loadPlan(parsed.config.plan);
      }
      setIoMsg("Importado ✓");
    } catch (e) {
      setIoError(`JSON inválido: ${(e as Error).message}`);
    } finally {
      setIoBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setIoMsg(""), 3000);
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
      {/* Banner: autosave + export/import */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "8px 12px",
          background: "var(--pulso-surface)",
          border: "1px solid var(--pulso-border)",
          borderRadius: 8,
        }}
      >
        {savedAll ? (
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              color: "#15803d", fontSize: 11, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 0.4,
            }}
          >
            <CheckCircle2 size={12} /> Autoguardado
          </span>
        ) : savingNow ? (
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              color: "var(--pulso-text-soft)", fontSize: 11, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 0.4,
            }}
          >
            <Loader2 size={12} className="pulso-spin" /> Guardando…
          </span>
        ) : (
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              color: "var(--pulso-text-soft)", fontSize: 11, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 0.4,
            }}
          >
            Cargando…
          </span>
        )}

        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", flex: 1, lineHeight: 1.4 }}>
          {nSlides === 0
            ? "Empieza agregando slides en el panel izquierdo."
            : `${nSlides} ${nSlides === 1 ? "slide" : "slides"} en el plan. Tu plan se guarda automáticamente.`}
        </span>

        <PlanHealthBadge />
        <DebugPhToggle />

        <button
          type="button"
          onClick={onExport}
          disabled={ioBusy === "export"}
          style={{ fontSize: 11, padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: 5 }}
        >
          <Download size={12} /> {ioBusy === "export" ? "Exportando…" : "Exportar JSON"}
        </button>

        <label
          style={{
            fontSize: 11, padding: "5px 10px",
            display: "inline-flex", alignItems: "center", gap: 5,
            cursor: ioBusy === "import" ? "wait" : "pointer",
            border: "1px solid var(--pulso-border)", borderRadius: 6, background: "white",
          }}
        >
          <Upload size={12} />
          {ioBusy === "import" ? "Importando…" : "Importar JSON"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={(e) => onImport(e.target.files?.[0])}
          />
        </label>

        <button
          type="button"
          onClick={onResetClick}
          disabled={nSlides === 0}
          style={{
            fontSize: 11, padding: "5px 10px",
            display: "inline-flex", alignItems: "center", gap: 5,
            color: nSlides === 0 ? "var(--pulso-text-soft)" : "#991b1b",
          }}
        >
          <RotateCcw size={12} /> Reset
        </button>

        {ioMsg && <span style={{ fontSize: 11, color: "#15803d", fontWeight: 600 }}>{ioMsg}</span>}
        {ioError && <span style={{ fontSize: 11, color: "#b91c1c", fontWeight: 600 }}>{ioError}</span>}
      </div>

      {/* Toolbar de exportación + presets */}
      <div
        style={{
          display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
          padding: "10px 14px",
          background: "var(--pulso-surface)",
          border: "1px solid var(--pulso-border)",
          borderRadius: 8,
        }}
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

        <span style={{ width: 1, height: 22, background: "var(--pulso-border)", margin: "0 4px" }} />

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
      </div>
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
            boxShadow: "var(--pulso-shadow-med, 0 6px 20px rgba(0,0,0,0.12))",
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
