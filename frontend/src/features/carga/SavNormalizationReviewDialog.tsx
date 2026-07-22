import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Search,
  ShieldCheck,
  X,
} from "../../vendor/lucide-react";
import type { SurveyMonkeySavBundleFileInspection } from "../../api/client";
import {
  SAV_NORMALIZATION_FILTERS,
  filterSavNormalizationVariables,
  savNormalizationCatalogRows,
  savNormalizationOperationLabel,
  savNormalizationStatusCounts,
  savNormalizationStatusLabel,
  savNormalizationVariableLabel,
  savNormalizationVariableName,
  type SavNormalizationReviewFilter,
} from "./savNormalizationReviewModel";

type SavNormalizationReviewDialogProps = {
  open: boolean;
  files: SurveyMonkeySavBundleFileInspection[];
  selectedEntryName: string;
  reviewedEntryNames: ReadonlySet<string>;
  onOpenChange: (open: boolean) => void;
  onSelectedEntryNameChange: (entryName: string) => void;
  onConfirm: (entryName: string) => void;
  returnFocusElement?: HTMLElement | null;
};

type SavNormalizationReviewContentProps = Omit<SavNormalizationReviewDialogProps, "open" | "onOpenChange"> & {
  onClose: () => void;
};

function selectedReviewFile(files: SurveyMonkeySavBundleFileInspection[], entryName: string) {
  return files.find((file) => file.entry_name === entryName) ?? files[0] ?? null;
}

function SavReviewFileNav({
  files,
  selectedEntryName,
  reviewedEntryNames,
  onSelectedEntryNameChange,
}: Pick<SavNormalizationReviewDialogProps, "files" | "selectedEntryName" | "reviewedEntryNames" | "onSelectedEntryNameChange">) {
  return (
    <nav
      className={`pulso-sav-review-files${files.length <= 2 ? " is-paired" : ""}`}
      aria-label="Archivos SAV inspeccionados"
    >
      {files.map((file) => {
        const confirmed = reviewedEntryNames.has(file.entry_name);
        return (
          <button
            type="button"
            className={file.entry_name === selectedEntryName ? "is-active" : ""}
            aria-current={file.entry_name === selectedEntryName ? "page" : undefined}
            title={file.file_name || file.entry_name}
            onClick={() => onSelectedEntryNameChange(file.entry_name)}
            key={file.entry_name}
          >
            {confirmed ? <CheckCircle2 size={13} aria-hidden="true" /> : file.blocking ? <AlertTriangle size={13} aria-hidden="true" /> : <FileSpreadsheet size={13} aria-hidden="true" />}
            <span>{file.file_name || file.entry_name}</span>
            <small>{confirmed ? "Confirmado" : file.blocking ? "Bloqueado" : "Pendiente"}</small>
          </button>
        );
      })}
    </nav>
  );
}

export function SavNormalizationReviewDialogContent({
  files,
  selectedEntryName,
  reviewedEntryNames,
  onSelectedEntryNameChange,
  onConfirm,
  onClose,
}: SavNormalizationReviewContentProps) {
  const file = selectedReviewFile(files, selectedEntryName);
  const review = file?.normalization_review ?? null;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SavNormalizationReviewFilter>("all");
  const [selectedVariableId, setSelectedVariableId] = useState("");
  const variableOptionRefs = useRef(new Map<string, HTMLButtonElement>());
  const variables = review?.variables ?? [];
  const counts = useMemo(() => savNormalizationStatusCounts(variables), [variables]);
  const visibleVariables = useMemo(
    () => filterSavNormalizationVariables(variables, filter, query),
    [variables, filter, query],
  );
  const selectedVariable = visibleVariables.find((variable) => variable.id === selectedVariableId)
    ?? visibleVariables[0]
    ?? null;
  const catalogRows = selectedVariable ? savNormalizationCatalogRows(selectedVariable) : [];
  const confirmed = file ? reviewedEntryNames.has(file.entry_name) : false;
  const nextPending = file
    ? files.find((candidate) => (
        candidate.entry_name !== file.entry_name
        && !candidate.blocking
        && Boolean(candidate.normalization_review)
        && !reviewedEntryNames.has(candidate.entry_name)
      )) ?? null
    : null;

  function confirmCurrentFile() {
    if (!file || file.blocking || !review) return;
    onConfirm(file.entry_name);
    if (nextPending) onSelectedEntryNameChange(nextPending.entry_name);
    else onClose();
  }

  function handleVariableKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;
    if (event.key === "ArrowDown") nextIndex = Math.min(index + 1, visibleVariables.length - 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(index - 1, 0);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = visibleVariables.length - 1;
    else return;
    event.preventDefault();
    const nextVariable = visibleVariables[nextIndex];
    if (!nextVariable) return;
    setSelectedVariableId(nextVariable.id);
    variableOptionRefs.current.get(nextVariable.id)?.focus();
  }

  return (
    <>
      <header className="pulso-sav-review-header">
        <div>
          <Dialog.Title>Revisar normalización SAV</Dialog.Title>
          <Dialog.Description>
            Comprueba cómo cada columna del SAV se convertirá al contrato del XLSForm antes de reemplazar respuestas.
          </Dialog.Description>
          <div className="pulso-sav-review-privacy" role="note">
            <ShieldCheck size={13} aria-hidden="true" />
            <span><strong>Sin datos personales.</strong> Estructura, etiquetas, operaciones y catálogos; nunca valores de respuestas.</span>
          </div>
        </div>
        <button type="button" className="pulso-sav-review-close" onClick={onClose} aria-label="Cerrar revisión de normalización">
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <section className="pulso-sav-review-commandbar" aria-label="Archivos, resumen y filtros de normalización">
        <SavReviewFileNav
          files={files}
          selectedEntryName={file?.entry_name ?? ""}
          reviewedEntryNames={reviewedEntryNames}
          onSelectedEntryNameChange={onSelectedEntryNameChange}
        />
        {file && review ? (
          <>
            <dl className="pulso-sav-review-metrics" aria-label="Resumen de variables">
              <div><dt>Iguales</dt><dd>{counts.unchanged}</dd></div>
              <div><dt>Cambios</dt><dd>{counts.transformed}</dd></div>
              <div><dt>Alertas</dt><dd>{counts.warning}</dd></div>
              <div><dt>Metadatos</dt><dd>{counts.source_only}</dd></div>
            </dl>
            <div className="pulso-sav-review-tools">
              <label className="pulso-sav-review-search">
                <Search size={14} aria-hidden="true" />
              <span className="pulso-sr-only">Buscar variable, operación o código</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar variable, operación o código…"
              />
            </label>
            <div className="pulso-sav-review-filters" role="group" aria-label="Filtrar variables">
              {SAV_NORMALIZATION_FILTERS.map((option) => (
                <button
                  type="button"
                  className={filter === option.value ? "is-active" : ""}
                  aria-pressed={filter === option.value}
                  onClick={() => setFilter(option.value)}
                  key={option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
            </div>
          </>
        ) : null}
      </section>

      {file && review ? (
          <div className="pulso-sav-review-body">
            {visibleVariables.length ? (
              <div className="pulso-sav-review-workbench">
                <div className="pulso-sav-review-variable-list" role="listbox" aria-label="Variables normalizadas" aria-orientation="vertical">
                  {visibleVariables.map((variable, index) => (
                    <button
                      type="button"
                      role="option"
                      ref={(node) => {
                        if (node) variableOptionRefs.current.set(variable.id, node);
                        else variableOptionRefs.current.delete(variable.id);
                      }}
                      className={`${variable.id === selectedVariable?.id ? "is-active " : ""}is-${variable.status}`}
                      aria-selected={variable.id === selectedVariable?.id}
                      tabIndex={variable.id === selectedVariable?.id ? 0 : -1}
                      onClick={() => setSelectedVariableId(variable.id)}
                      onKeyDown={(event) => handleVariableKeyDown(event, index)}
                      key={variable.id}
                    >
                      <span><code>{savNormalizationVariableName(variable)}</code><small>{savNormalizationVariableLabel(variable)}</small></span>
                      <em>{savNormalizationStatusLabel(variable.status)}</em>
                    </button>
                  ))}
                </div>

                {selectedVariable ? (
                  <article className="pulso-sav-review-detail" aria-label={`Detalle de ${savNormalizationVariableName(selectedVariable)}`}>
                    <header>
                      <div><code>{savNormalizationVariableName(selectedVariable)}</code><h3>{savNormalizationVariableLabel(selectedVariable)}</h3></div>
                      <span className={`pulso-sav-review-status is-${selectedVariable.status}`}>{savNormalizationStatusLabel(selectedVariable.status)}</span>
                    </header>

                    <div className="pulso-sav-review-flow" aria-label="Flujo SAV a XLSForm">
                      <div><Database size={15} aria-hidden="true" /><span><small>SAV</small><strong>{selectedVariable.source_columns.map((column) => column.name).join(", ") || "Sin columna"}</strong></span></div>
                      <ArrowRight size={15} aria-hidden="true" />
                      <div><Check size={15} aria-hidden="true" /><span><small>Transformación</small><strong>{selectedVariable.operations.length ? `${selectedVariable.operations.length} operación${selectedVariable.operations.length === 1 ? "" : "es"}` : "Conservar"}</strong></span></div>
                      <ArrowRight size={15} aria-hidden="true" />
                      <div><FileSpreadsheet size={15} aria-hidden="true" /><span><small>XLSForm</small><strong>{selectedVariable.xlsform?.name || "Metadato auxiliar"}</strong></span></div>
                    </div>

                    {selectedVariable.operations.length ? (
                      <section className="pulso-sav-review-section">
                        <h4>Transformaciones</h4>
                        <ol className="pulso-sav-review-operations">
                          {selectedVariable.operations.map((operation, index) => (
                            <li key={`${operation.kind}-${index}`}>
                              <span>{String(index + 1).padStart(2, "0")}</span>
                              <div><strong>{savNormalizationOperationLabel(operation.kind, operation.label)}</strong>{operation.detail ? <small>{operation.detail}</small> : null}</div>
                              {operation.source || operation.target ? <code>{operation.source || "—"} → {operation.target || "—"}</code> : null}
                            </li>
                          ))}
                        </ol>
                      </section>
                    ) : null}

                    {catalogRows.length ? (
                      <section className="pulso-sav-review-section">
                        <div className="pulso-sav-review-section-heading"><h4>Catálogo de códigos</h4><small>{catalogRows.length} equivalencias</small></div>
                        <div className="pulso-sav-review-catalog-frame" tabIndex={0} aria-label="Catálogo de códigos; desplázate para ver más equivalencias">
                          <table className="pulso-sav-review-catalog">
                            <caption className="pulso-sr-only">Equivalencias de códigos entre SAV y XLSForm</caption>
                            <thead><tr><th scope="col">Código SAV</th><th scope="col">Etiqueta SAV</th><th scope="col">Código XLSForm</th><th scope="col">Etiqueta XLSForm</th></tr></thead>
                            <tbody>
                              {catalogRows.map((mapping, index) => (
                                <tr key={`${mapping.source}-${mapping.target}-${index}`}>
                                  <td><code>{mapping.source || "—"}</code></td><td>{mapping.source_label || "—"}</td>
                                  <td><code>{mapping.target || "—"}</code></td><td>{mapping.target_label || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    ) : null}

                    {selectedVariable.alerts.length ? (
                      <section className="pulso-sav-review-section">
                        <h4>Advertencias</h4>
                        <ul className="pulso-sav-review-alerts">
                          {selectedVariable.alerts.map((alert, index) => (
                            <li className={`is-${alert.severity}`} key={`${alert.code}-${index}`}>
                              <AlertTriangle size={13} aria-hidden="true" /><span>{alert.message}</span>{alert.code ? <code>{alert.code}</code> : null}
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                  </article>
                ) : null}
              </div>
            ) : (
              <div className="pulso-sav-review-empty" role="status">
                <Search size={18} aria-hidden="true" /><strong>Sin coincidencias</strong><span>Ajusta la búsqueda o selecciona otro filtro.</span>
              </div>
            )}
          </div>
      ) : (
        <div className="pulso-sav-review-unavailable" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <div><strong>{file?.blocking ? "Archivo bloqueado" : "Detalle no disponible"}</strong><span>{file?.blocking ? "Resuelve los bloqueos y reinspecciona para revisar la normalización." : "El backend no entregó el contrato de revisión. Reinspecciona antes de aplicar."}</span></div>
        </div>
      )}

      <footer className="pulso-sav-review-footer">
        <span aria-live="polite">
          {confirmed ? <><CheckCircle2 size={13} aria-hidden="true" /> Revisión confirmada</> : review && !file?.blocking ? "Confirma este archivo para habilitar la aplicación." : "Este archivo todavía no se puede confirmar."}
        </span>
        <div>
          <button type="button" className="pulso-sm-secondary" onClick={onClose}>Cerrar</button>
          <button type="button" disabled={!file || file.blocking || !review || confirmed} onClick={confirmCurrentFile}>
            <CheckCircle2 size={13} aria-hidden="true" />
            {confirmed ? "Archivo confirmado" : nextPending ? "Confirmar y revisar siguiente" : "Confirmar archivo"}
          </button>
        </div>
      </footer>
    </>
  );
}

export function SavNormalizationReviewDialog(props: SavNormalizationReviewDialogProps) {
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-sav-review-overlay" />
        <Dialog.Content
          className="pulso-sav-review-dialog"
          data-audit-ready="sav-normalization-review"
          onCloseAutoFocus={(event) => {
            if (!props.returnFocusElement?.isConnected) return;
            event.preventDefault();
            props.returnFocusElement.focus();
          }}
        >
          <SavNormalizationReviewDialogContent
            files={props.files}
            selectedEntryName={props.selectedEntryName}
            reviewedEntryNames={props.reviewedEntryNames}
            onSelectedEntryNameChange={props.onSelectedEntryNameChange}
            onConfirm={props.onConfirm}
            onClose={() => props.onOpenChange(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
