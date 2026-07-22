import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "../../vendor/lucide-react";
import {
  apiSurveyMonkeyMultibaseSavBundleImport,
  apiSurveyMonkeyMultibaseSavBundleInspect,
  apiUpload,
  type EstudioBase,
  type EstudioPayload,
  type SurveyMonkeySavBundleImportResult,
  type SurveyMonkeySavBundleInspection,
  type SurveyMonkeySavBundleMissingRequiredPolicy,
} from "../../api/client";
import {
  savBundleCleanFileBaseMap,
  savBundleContractFingerprint,
  savBundleFileBaseMapValidation,
  savBundleInspectionIsStale,
  savBundleResolvedFileBaseMap,
  savBundleRevisionView,
  savBundleVariableLabelLookup,
  smSavBundleImpactLabel,
  smSavBundleInspectionCanImport,
  smSavBundleInspectionWarningCount,
  smSavBundleIssueGroups,
  smSavBundleIssueLabel,
  smSavBundleVariableLabel,
  smSavBundleVariableSummary,
  type SavBundleFileBaseMap,
  type SavBundleInspectionCredit,
} from "./savBundleImportModel";
import { SavNormalizationReviewDialog } from "./SavNormalizationReviewDialog";
import {
  savNormalizationApplyReason,
  savNormalizationConfirmationState,
} from "./savNormalizationReviewModel";

type Props = {
  bases: EstudioBase[];
  disabled?: boolean;
  onImported: (payload: EstudioPayload) => Promise<void>;
};

function savBundleBaseLabel(base: EstudioBase) {
  const actor = String(base.source_alias || base.source_title || "").trim();
  return actor && actor !== base.nombre ? `${actor} · ${base.nombre}` : base.nombre;
}

export function savFirstReviewableEntryName(
  files: readonly { entry_name: string; blocking: boolean; normalization_review?: unknown }[],
): string {
  return files.find((candidate) => !candidate.blocking && candidate.normalization_review != null)?.entry_name ?? "";
}

export function SavBundleImportPanel({ bases, disabled = false, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState("");
  const [inspection, setInspection] = useState<SurveyMonkeySavBundleInspection | null>(null);
  const [importResult, setImportResult] = useState<SurveyMonkeySavBundleImportResult | null>(null);
  const [policy, setPolicy] = useState<SurveyMonkeySavBundleMissingRequiredPolicy>("strict");
  const [fileBaseMap, setFileBaseMap] = useState<SavBundleFileBaseMap>({});
  const [credit, setCredit] = useState<SavBundleInspectionCredit | null>(null);
  const [busy, setBusy] = useState<"" | "inspect" | "import">("");
  const [error, setError] = useState("");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewEntryName, setReviewEntryName] = useState("");
  const [reviewedEntryNames, setReviewedEntryNames] = useState<Set<string>>(() => new Set());
  const inspectButtonRef = useRef<HTMLButtonElement | null>(null);
  const reviewReturnFocusRef = useRef<HTMLElement | null>(null);

  const baseNames = useMemo(() => bases.map((base) => base.nombre), [bases]);
  const baseByName = useMemo(() => new Map(bases.map((base) => [base.nombre, base] as const)), [bases]);
  const mapValidation = savBundleFileBaseMapValidation(inspection?.files ?? [], fileBaseMap, baseNames);
  const inspectionStale = savBundleInspectionIsStale(credit, policy, fileBaseMap);
  const confirmationState = savNormalizationConfirmationState(inspection?.files ?? [], reviewedEntryNames);
  const mappingReady = mapValidation.complete
    && mapValidation.duplicateBases.length === 0
    && mapValidation.unknownBases.length === 0;
  const canReinspect = Boolean(file || fileId) && (!inspection || mappingReady) && !busy && !disabled;
  const canImport = smSavBundleInspectionCanImport(inspection)
    && mappingReady
    && !inspectionStale
    && Boolean(credit?.backendFingerprint)
    && confirmationState.complete
    && !importResult
    && !busy
    && !disabled;
  const applyDisabledReason = !inspection
    ? "Inspecciona el SAV o ZIP antes de aplicar."
    : inspectionStale
      ? "La base o la política cambió; reinspecciona antes de aplicar."
      : !mappingReady
        ? "Asigna cada archivo a una base distinta."
        : !inspection.ok
          ? "La inspección conserva bloqueos que deben resolverse."
          : !credit?.backendFingerprint
            ? "Falta el sello de integridad de la inspección."
            : !confirmationState.complete
              ? savNormalizationApplyReason(inspection.files, reviewedEntryNames)
            : importResult
              ? "La actualización acreditada ya se aplicó."
            : busy
              ? "Hay una operación en curso."
              : "Aplicar la actualización acreditada.";

  function pickFile(nextFile: File | null) {
    setFile(nextFile);
    setFileId("");
    setInspection(null);
    setImportResult(null);
    setPolicy("strict");
    setFileBaseMap({});
    setCredit(null);
    setBusy("");
    setError("");
    setReviewDialogOpen(false);
    setReviewEntryName("");
    setReviewedEntryNames(new Set());
  }

  function updateMapping(entryName: string, baseName: string) {
    setFileBaseMap((current) => ({ ...current, [entryName]: baseName }));
    setImportResult(null);
    setError("");
    setReviewedEntryNames(new Set());
  }

  function updatePolicy(nextPolicy: SurveyMonkeySavBundleMissingRequiredPolicy) {
    setPolicy(nextPolicy);
    setImportResult(null);
    setError("");
    setReviewedEntryNames(new Set());
  }

  function openNormalizationReview(entryName: string, trigger: HTMLElement | null) {
    reviewReturnFocusRef.current = trigger;
    setReviewEntryName(entryName);
    setReviewDialogOpen(true);
  }

  function confirmNormalizationReview(entryName: string) {
    setReviewedEntryNames((current) => new Set(current).add(entryName));
  }

  async function inspectBundle() {
    if (!file && !fileId) return;
    setBusy("inspect");
    setError("");
    setImportResult(null);
    setReviewedEntryNames(new Set());
    try {
      let uploadedFileId = fileId;
      if (!uploadedFileId) {
        if (!file) throw new Error("Selecciona un archivo .sav o un ZIP con archivos .sav.");
        const upload = await apiUpload(file, file.name.trim().toLowerCase().endsWith(".zip") ? "sav_bundle" : "sav");
        uploadedFileId = upload.file_id;
        setFileId(uploadedFileId);
      }
      const requestedMap = inspection ? savBundleCleanFileBaseMap(fileBaseMap) : {};
      const result = await apiSurveyMonkeyMultibaseSavBundleInspect({
        file_id: uploadedFileId,
        file_base_map: requestedMap,
        missing_required_policy: policy,
      });
      const resolvedMap = savBundleResolvedFileBaseMap(result, requestedMap, baseNames);
      const localFingerprint = savBundleContractFingerprint(policy, resolvedMap);
      setInspection(result);
      setFileBaseMap(resolvedMap);
      setCredit({
        policy,
        fileBaseMap: savBundleCleanFileBaseMap(resolvedMap),
        localFingerprint,
        backendFingerprint: result.inspection_fingerprint,
      });
      const firstReviewableEntryName = savFirstReviewableEntryName(result.files);
      if (firstReviewableEntryName) {
        reviewReturnFocusRef.current = inspectButtonRef.current;
        setReviewEntryName(firstReviewableEntryName);
        setReviewDialogOpen(true);
      }
      if (!result.inspection_fingerprint) {
        setError("La inspección no devolvió su sello de integridad. Reinspecciona cuando el backend esté actualizado.");
      } else if (!result.ok) {
        setError("La inspección mantiene bloqueos. Revisa la asignación, la política y la revisión publicada de cada archivo.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo inspeccionar el SAV.");
    } finally {
      setBusy("");
    }
  }

  async function importBundle() {
    if (!fileId || !inspection || !credit || !canImport) return;
    setBusy("import");
    setError("");
    setImportResult(null);
    try {
      const result = await apiSurveyMonkeyMultibaseSavBundleImport({
        file_id: fileId,
        file_base_map: credit.fileBaseMap,
        missing_required_policy: credit.policy,
        expected_inspection_fingerprint: credit.backendFingerprint,
      });
      setImportResult(result);
      setInspection(result.inspection);
      await onImported(result.estudio);
      window.dispatchEvent(new Event("pulso:session-changed"));
      window.dispatchEvent(new CustomEvent("pulso:active-base-changed", {
        detail: { active: result.estudio.active_base, processing_mode: result.estudio.processing_mode },
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo aplicar el SAV.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="pulso-sm-workbook-import is-sav pulso-sav-import" aria-label="Importar y normalizar SAV">
      <div className="pulso-sm-family-config-head">
        <div>
          <strong>Importar SAV</strong>
          <span>Sube un .sav o un ZIP, asígnalo a una base y normalízalo contra su revisión publicada.</span>
        </div>
        <div className="pulso-sm-family-actions">
          <button
            type="button"
            className="pulso-sm-secondary"
            ref={inspectButtonRef}
            disabled={!canReinspect}
            onClick={() => void inspectBundle()}
          >
            {busy === "inspect" ? <Loader2 size={13} className="pulso-spin" /> : inspection ? <RefreshCw size={13} /> : <Database size={13} />}
            {inspection ? "Reinspeccionar" : "Inspeccionar"}
          </button>
          <button
            type="button"
            aria-disabled={!canImport}
            aria-describedby="sav-import-apply-reason"
            onClick={() => { if (canImport) void importBundle(); }}
            title={applyDisabledReason}
            aria-label={`Aplicar actualización. ${applyDisabledReason}`}
          >
            {busy === "import" ? <Loader2 size={13} className="pulso-spin" /> : <CheckCircle2 size={13} />}
            Aplicar actualización
          </button>
        </div>
      </div>
      <p id="sav-import-apply-reason" className="pulso-sr-only" aria-live="polite">{applyDisabledReason}</p>

      <div className="pulso-sav-import-commandbar">
        <label className={`pulso-base-file-picker${file ? " is-ready" : ""}`}>
          {file ? <Check size={18} /> : <Upload size={18} />}
          <span className="pulso-base-file-picker-title"><Database size={13} />{file ? file.name : "SAV o ZIP con SAV"}</span>
          <span className="pulso-base-file-picker-accept">.sav · .zip</span>
          <input
            type="file"
            accept=".sav,.zip,application/x-spss-sav,application/octet-stream,application/zip,application/x-zip-compressed"
            onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
          />
        </label>

        <fieldset className="pulso-sav-policy">
          <legend>Variables obligatorias</legend>
          <label className={policy === "strict" ? "is-selected" : ""}>
            <input
              type="radio"
              name="sav-missing-policy"
              value="strict"
              checked={policy === "strict"}
              onChange={() => updatePolicy("strict")}
            />
            <span><strong>Estricta</strong><small>Bloquea si falta una variable esperada.</small></span>
          </label>
          <label className={policy === "fill_blank_warn" ? "is-selected is-compat" : "is-compat"}>
            <input
              type="radio"
              name="sav-missing-policy"
              value="fill_blank_warn"
              checked={policy === "fill_blank_warn"}
              onChange={() => updatePolicy("fill_blank_warn")}
            />
            <span><strong>Compatibilidad explícita</strong><small>Completa faltantes en blanco y conserva advertencias.</small></span>
          </label>
        </fieldset>

        <div className="pulso-sm-workbook-summary">
          {inspection ? (
            <>
              <span className={`pulso-sm-family-status${inspection.ok ? "" : " is-warning"}`}>
                {inspection.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                {inspection.n_matched}/{inspection.n_files} archivos listos
              </span>
              <small>{smSavBundleInspectionWarningCount(inspection)} advertencias · {inspection.filename}</small>
              <small>{policy === "strict" ? "Política estricta" : "Compatibilidad con blancos"} · formulario preservado</small>
            </>
          ) : (
            <>
              <span className="pulso-sm-family-status is-neutral"><Database size={12} />Sin inspección</span>
              <small>La política estricta es el punto de partida recomendado.</small>
            </>
          )}
        </div>
      </div>

      {error ? (
        <div className="pulso-sav-import-feedback is-warning" role="status">
          <AlertTriangle size={14} aria-hidden="true" /><span>{error}</span>
        </div>
      ) : null}

      {inspection && inspectionStale ? (
        <div className="pulso-sav-import-feedback is-stale" role="status">
          <RefreshCw size={14} aria-hidden="true" />
          <span>La inspección sigue visible, pero quedó desactualizada por el cambio de base o política. Reinspecciona antes de aplicar.</span>
        </div>
      ) : null}

      {inspection && inspection.ok && credit?.backendFingerprint && mappingReady && !inspectionStale && !importResult ? (
        <div className="pulso-sav-import-feedback is-accredited" role="status">
          <ShieldCheck size={14} aria-hidden="true" />
          <span>{confirmationState.complete
            ? "Mapa, política y normalización acreditados. Aplicar usará exactamente esta inspección."
            : savNormalizationApplyReason(inspection.files, reviewedEntryNames)}</span>
        </div>
      ) : null}

      {inspection ? (
        <div className="pulso-sm-family-table is-sav-bundle" role="table" aria-label="Plan de actualización ZIP SAV">
          <div className="pulso-sm-family-row is-head is-sav-row" role="row">
            <span>Archivo</span><span>Base / actor</span><span>Revisión publicada</span><span>Después</span><span>Impacto</span><span>Revisión</span>
          </div>
          {inspection.files.map((inspectedFile) => {
            const issueGroups = smSavBundleIssueGroups(inspectedFile);
            const hasIssues = issueGroups.length > 0;
            const selectedBase = fileBaseMap[inspectedFile.entry_name] ?? "";
            const fileBase = baseByName.get(selectedBase);
            const fileLabelLookup = savBundleVariableLabelLookup(fileBase);
            const incoming = inspectedFile.change_plan?.incoming;
            const revision = savBundleRevisionView(inspectedFile);
            return (
              <div
                className={`pulso-sm-family-row is-sav-row${inspectedFile.blocking ? " is-invalid" : hasIssues ? " is-warning" : ""}`}
                role="row"
                key={inspectedFile.entry_name || inspectedFile.file_name}
              >
                <div className="pulso-sm-family-origin-cell">
                  <strong>{inspectedFile.file_name || inspectedFile.entry_name}</strong>
                  <small>{inspectedFile.n_rows} filas · {inspectedFile.n_columns} columnas SAV</small>
                </div>
                <label className="pulso-sav-base-select">
                  <span className="pulso-sr-only">Base para {inspectedFile.file_name || inspectedFile.entry_name}</span>
                  <select value={selectedBase} onChange={(event) => updateMapping(inspectedFile.entry_name, event.target.value)}>
                    <option value="">Selecciona una base…</option>
                    {bases.map((base) => <option value={base.nombre} key={base.nombre}>{savBundleBaseLabel(base)}</option>)}
                  </select>
                  <small>{inspectedFile.base_name === selectedBase ? "Coincidencia propuesta" : selectedBase ? "Asignación manual" : "Requiere asignación"}</small>
                </label>
                <div className="pulso-sm-family-data-cell">
                  <span className={`pulso-sm-family-status is-${revision.tone}`} title={revision.detail}>
                    {revision.tone === "success" ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                    {revision.label}
                  </span>
                  <small title={revision.detail}>{revision.detail}</small>
                </div>
                <div className="pulso-sm-family-data-cell">
                  <span className={`pulso-sm-family-status${inspectedFile.blocking ? " is-warning" : " is-neutral"}`}>
                    {inspectedFile.blocking ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                    {incoming?.normalized_rows ?? inspectedFile.n_rows} filas
                  </span>
                  <small>{smSavBundleImpactLabel(inspectedFile)}</small>
                </div>
                <div className="pulso-sm-family-data-cell">
                  <span className={`pulso-sm-family-status${hasIssues ? " is-warning" : " is-neutral"}`}>
                    {hasIssues ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                    {inspectedFile.matched_variables}/{inspectedFile.expected_variables} variables
                  </span>
                  <small title={[...inspectedFile.warnings, ...inspectedFile.all_empty_variables, ...inspectedFile.missing_variables].join("\n")}>
                    {inspectedFile.blocking ? smSavBundleIssueLabel(inspectedFile) : smSavBundleVariableSummary(inspectedFile)}
                  </small>
                </div>
                <div className="pulso-sav-review-row-action">
                  <button
                    type="button"
                    className="pulso-sm-secondary"
                    onClick={(event) => openNormalizationReview(inspectedFile.entry_name, event.currentTarget)}
                  >
                    {reviewedEntryNames.has(inspectedFile.entry_name) ? <CheckCircle2 size={13} aria-hidden="true" /> : <ShieldCheck size={13} aria-hidden="true" />}
                    Revisar
                  </button>
                  <small>{reviewedEntryNames.has(inspectedFile.entry_name)
                    ? "Confirmado"
                    : inspectedFile.normalization_review
                      ? "Pendiente"
                      : "No disponible"}</small>
                </div>
                {issueGroups.length > 0 ? (
                  <div className="pulso-sm-sav-detail-tray" aria-label={`Detalle de advertencias para ${inspectedFile.file_name || inspectedFile.entry_name}`}>
                    <div className="pulso-sm-family-detail-head"><span><AlertTriangle size={13} />Motivos de revisión</span></div>
                    <div className="pulso-sm-sav-issue-grid">
                      {issueGroups.map((group) => (
                        <div
                          className={`pulso-sm-sav-issue-card is-${group.tone}${group.variables.length ? "" : " is-notes-only"}`}
                          key={group.key}
                        >
                          <strong>{group.label}<span>{group.variables.length || group.notes.length}</span></strong>
                          <p>{group.reason}</p>
                          {group.variables.length ? (
                            <div className="pulso-sm-sav-variable-list">
                              {group.variables.map((variable) => {
                                const label = smSavBundleVariableLabel(variable, fileLabelLookup);
                                return <span className="pulso-sm-sav-variable-item" key={variable}><code>{variable}</code><span>{label || "Sin etiqueta de formulario"}</span></span>;
                              })}
                            </div>
                          ) : null}
                          {group.notes.length ? <div className="pulso-sm-sav-note-list">{group.notes.map((note) => <span key={note}>{note}</span>)}</div> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {inspection && (!mappingReady || mapValidation.duplicateBases.length > 0) ? (
        <div className="pulso-sav-import-feedback is-warning" role="status">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{mapValidation.duplicateBases.length
            ? `Cada archivo necesita una base distinta. Repetidas: ${mapValidation.duplicateBases.join(", ")}.`
            : "Asigna explícitamente cada archivo a una base existente."}</span>
        </div>
      ) : null}

      {importResult ? (
        <div className="pulso-sav-import-feedback is-success" role="status">
          <CheckCircle2 size={14} aria-hidden="true" />
          <span>Actualizadas {importResult.imported_bases} bases desde {importResult.filename}; los formularios se conservaron.</span>
        </div>
      ) : null}

      {inspection ? (
        <SavNormalizationReviewDialog
          open={reviewDialogOpen}
          files={inspection.files}
          selectedEntryName={reviewEntryName}
          reviewedEntryNames={reviewedEntryNames}
          onOpenChange={setReviewDialogOpen}
          onSelectedEntryNameChange={setReviewEntryName}
          onConfirm={confirmNormalizationReview}
          returnFocusElement={reviewReturnFocusRef.current}
        />
      ) : null}
    </div>
  );
}
