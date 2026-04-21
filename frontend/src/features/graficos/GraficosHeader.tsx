import { useRef, useState } from "react";
import { CheckCircle2, Download, FileText, Palette, Upload, RotateCcw, Loader2 } from "lucide-react";
import {
  apiGraficosConfigExport,
  apiGraficosConfigImport,
  downloadUrl,
} from "../../api/client";
import { usePlanStore } from "./store";

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
          disabled={!canExport || exportBusy}
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
          disabled={!canExport || exportBusy}
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
