import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Download, FileJson, ShieldCheck, Upload, X } from "lucide-react";
import {
  apiCodifImportExcelCategorizationPreview,
  apiCodifExportJson,
  apiCodifImportJsonApply,
  apiCodifImportJsonPreview,
  apiUpload,
  CodifConfigImportStrategy,
  CodifImportPreview,
  CodifImportPreviewItem,
  CodifImportSelection,
} from "../../api/client";
import { Alert } from "../../components/Alert";

type Props = {
  disabled?: boolean;
  onImported?: () => void;
};

type Busy = "export" | "preview" | "apply" | null;

export function CodingConfigActions({ disabled = false, onImported }: Props) {
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);

  async function exportConfig() {
    setBusy("export");
    setError("");
    setMessage("");
    try {
      const bundle = await apiCodifExportJson();
      const { ok: _ok, suggested_filename: suggestedFilename, ...payload } = bundle;
      void _ok;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = suggestedFilename || `prosecnur_codificacion_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(href);
      setMessage(`Ajustes descargados: ${payload.variables.length} pregunta(s) o campo(s).`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      window.setTimeout(() => setMessage(""), 3600);
    }
  }

  const importDialog = dialogOpen && typeof document !== "undefined" ? createPortal(
    <CodingConfigImportDialog
      onClose={() => setDialogOpen(false)}
      onImported={() => {
        onImported?.();
        setMessage("Ajustes cargados y registrados en auditoría.");
        window.setTimeout(() => setMessage(""), 3600);
      }}
    />,
    document.body
  ) : null;

  return (
    <div className="pulso-codificacion-config-actions" aria-label="Ajustes de codificación">
      <button
        type="button"
        className="pulso-codificacion-config-button"
        onClick={exportConfig}
        disabled={disabled || busy === "export"}
        title="Descarga categorías, reglas y ajustes de codificación. No incluye filas ni casos."
      >
        <Download size={13} />
        {busy === "export" ? "Descargando..." : "Descargar ajustes"}
      </button>
      <button
        type="button"
        className="pulso-codificacion-config-button"
        onClick={() => {
          setError("");
          setMessage("");
          setDialogOpen(true);
        }}
        disabled={disabled}
        title="Carga un archivo portable o Excel de categorizaciones y revisa los cambios antes de aplicarlos."
      >
        <Upload size={13} />
        Cargar ajustes...
      </button>
      {message && <span className="pulso-codificacion-config-feedback is-ok">{message}</span>}
      {error && <span className="pulso-codificacion-config-feedback is-error">{error}</span>}
      {importDialog}
    </div>
  );
}

function CodingConfigImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [fileName, setFileName] = useState("");
  const [bundle, setBundle] = useState<unknown>(null);
  const [preview, setPreview] = useState<CodifImportPreview | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [strategies, setStrategies] = useState<Record<string, CodifConfigImportStrategy>>({});
  const [error, setError] = useState("");
  const [result, setResult] = useState<string>("");

  const selectedItems = useMemo(() => {
    if (!preview) return [];
    return preview.items.filter((item) => selected[item.match_id] && item.can_apply);
  }, [preview, selected]);

  async function loadFile(file?: File) {
    if (!file) return;
    setBusy("preview");
    setError("");
    setResult("");
    setPreview(null);
    setBundle(null);
    setFileName(file.name);
    try {
      const isExcel = /\.xlsx?$/i.test(file.name);
      const parsed = isExcel ? null : JSON.parse(await file.text());
      const excelResult = isExcel ? await apiCodifImportExcel(file) : null;
      const nextBundle = excelResult?.bundle ?? parsed;
      const nextPreview = excelResult?.preview ?? await apiCodifImportJsonPreview(parsed, file.name);
      setBundle(nextBundle);
      setPreview(nextPreview);
      const nextSelected: Record<string, boolean> = {};
      const nextStrategies: Record<string, CodifConfigImportStrategy> = {};
      for (const item of nextPreview.items) {
        nextSelected[item.match_id] = item.status === "compatible";
        nextStrategies[item.match_id] = item.existing_state ? "merge_missing" : "replace";
      }
      setSelected(nextSelected);
      setStrategies(nextStrategies);
      const warnings = excelResult?.bundle.metadata?.warnings ?? [];
      if (warnings.length) {
        setResult(`${warnings.length} aviso(s) del Excel. Revisa las variables compatibles antes de aplicar.`);
      }
    } catch (e) {
      setError(`Archivo inválido o no compatible: ${(e as Error).message}`);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function apiCodifImportExcel(file: File) {
    const uploaded = await apiUpload(file, "plantilla_codif");
    return apiCodifImportExcelCategorizationPreview(uploaded.file_id, file.name);
  }

  async function applyImport() {
    if (!bundle || !preview) return;
    const selections: CodifImportSelection[] = selectedItems.map((item) => ({
      match_id: item.match_id,
      strategy: strategies[item.match_id] ?? (item.existing_state ? "merge_missing" : "replace"),
    }));
    if (!selections.length) {
      setError("Selecciona al menos una variable compatible para importar.");
      return;
    }
    setBusy("apply");
    setError("");
    try {
      const applied = await apiCodifImportJsonApply(bundle, selections, fileName);
      setResult(
        `${applied.summary.variables_imported} importada(s), ${applied.summary.variables_versioned} versionada(s), ${applied.summary.variables_skipped} omitida(s).`
      );
      onImported();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function setItemSelected(item: CodifImportPreviewItem, checked: boolean) {
    setSelected((prev) => ({ ...prev, [item.match_id]: checked }));
    if (checked && item.existing_state && (strategies[item.match_id] ?? "keep") === "keep") {
      setStrategies((prev) => ({ ...prev, [item.match_id]: "merge_missing" }));
    }
  }

  return (
    <div className="pulso-codificacion-import-backdrop" role="presentation" onClick={onClose}>
      <section
        className="pulso-codificacion-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="codif-import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pulso-codificacion-import-head">
          <span className="pulso-codificacion-import-icon" aria-hidden="true"><FileJson size={18} /></span>
          <div>
            <span className="pulso-section-eyebrow">Ajustes portables</span>
            <h2 id="codif-import-title">Cargar ajustes</h2>
            <p>Revisa coincidencias y conflictos antes de modificar la codificación del proyecto actual.</p>
          </div>
          <button type="button" className="pulso-icon" onClick={onClose} aria-label="Cerrar">
            <X size={14} />
          </button>
        </header>

        <div className="pulso-codificacion-import-body">
          <div className="pulso-codificacion-import-picker">
            <div>
              <strong>{fileName || "Selecciona un archivo JSON o Excel"}</strong>
              <span>Archivo portable o Excel con pares de respuesta original y recategorización. No importa filas de casos al proyecto.</span>
            </div>
            <button type="button" className="pulso-secondary" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
              <Upload size={13} />
              {busy === "preview" ? "Validando..." : "Elegir archivo..."}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              hidden
              onChange={(e) => void loadFile(e.target.files?.[0])}
            />
          </div>

          {error && <Alert kind="error">{error}</Alert>}
          {result && (
            <div className="pulso-codificacion-import-result">
              <CheckCircle2 size={15} />
              <strong>{result}</strong>
            </div>
          )}

          {preview && (
            <>
              <ImportSummary preview={preview} />
              <div className="pulso-codificacion-import-table-wrap">
                <table className="pulso-codificacion-import-table">
                  <thead>
                    <tr>
                      <th>Importar</th>
                      <th>Origen</th>
                      <th>Destino</th>
                      <th>Estado</th>
                      <th>Cambios</th>
                      <th>Estrategia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((item) => (
                      <tr key={item.match_id} className={`is-${item.status.replace("_", "-")}`}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!selected[item.match_id]}
                            disabled={!item.can_apply || busy !== null}
                            onChange={(e) => setItemSelected(item, e.target.checked)}
                            aria-label={`Importar ${item.source.name}`}
                          />
                        </td>
                        <td>
                          <code>{item.source.name}</code>
                          <span>{item.source.label || item.source.base_id}</span>
                        </td>
                        <td>
                          {item.target.name ? <code>{item.target.name}</code> : <strong>No encontrada</strong>}
                          <span>{item.target.base_id}{item.target.label ? ` · ${item.target.label}` : ""}</span>
                        </td>
                        <td>
                          <StatusBadge item={item} />
                          <small>{item.reason}</small>
                        </td>
                        <td>
                          <span>{item.changes.categories_new} nuevas</span>
                          <span>{item.changes.categories_overwrite} posibles reemplazos</span>
                          <span>{item.changes.rules_add + item.changes.recodes_add} reglas/recodes</span>
                        </td>
                        <td>
                          {item.existing_state ? (
                            <select
                              value={strategies[item.match_id] ?? "merge_missing"}
                              disabled={!selected[item.match_id] || busy !== null}
                              onChange={(e) => setStrategies((prev) => ({
                                ...prev,
                                [item.match_id]: e.target.value as CodifConfigImportStrategy,
                              }))}
                            >
                              <option value="keep">Conservar actual</option>
                              <option value="merge_missing">Agregar faltantes</option>
                              <option value="replace">Reemplazar destino</option>
                              <option value="duplicate">Duplicar como versión</option>
                            </select>
                          ) : (
                            <span className="pulso-codificacion-import-strategy">Aplicar ajustes</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <footer className="pulso-codificacion-import-footer">
          <button type="button" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="pulso-primary"
            disabled={!preview || selectedItems.length === 0 || busy !== null}
            onClick={applyImport}
          >
            <ShieldCheck size={14} />
            {busy === "apply" ? "Aplicando..." : `Aplicar importación (${selectedItems.length})`}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ImportSummary({ preview }: { preview: CodifImportPreview }) {
  const s = preview.summary;
  return (
    <div className="pulso-codificacion-import-summary">
      <SummaryPill tone="ok" label="Compatibles" value={s.n_compatible} />
      <SummaryPill tone="review" label="Requieren revisión" value={s.n_needs_confirmation} />
      <SummaryPill tone="warn" label="Conflictos" value={s.n_conflicts} />
      <SummaryPill tone="muted" label="No compatibles" value={s.n_missing} />
      <span className="pulso-codificacion-import-source">
        {preview.source.project_label || "Proyecto origen"} → {preview.target.project_label || "Proyecto actual"}
      </span>
    </div>
  );
}

function SummaryPill({ tone, label, value }: { tone: "ok" | "review" | "warn" | "muted"; label: string; value: number }) {
  return (
    <span className={`pulso-codificacion-import-pill is-${tone}`}>
      <strong>{value}</strong>
      {label}
    </span>
  );
}

function StatusBadge({ item }: { item: CodifImportPreviewItem }) {
  const label =
    item.status === "compatible" ? "Compatible" :
    item.status === "needs_confirmation" ? "Requiere revisión" :
    item.status === "conflict" ? "Conflicto" :
    "No compatible";
  const Icon = item.status === "compatible" ? CheckCircle2 : AlertTriangle;
  return (
    <span className={`pulso-codificacion-import-status is-${item.status.replace("_", "-")}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}
