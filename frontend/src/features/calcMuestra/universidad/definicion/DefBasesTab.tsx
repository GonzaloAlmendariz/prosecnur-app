/**
 * Pestaña "Bases" de Definición: aquí se explica el marco muestral (única vez),
 * se elige el modo de fuente (cada modo con su popover "¿cuándo usarlo?") y
 * cada base se declara como tarjeta de carga numerada: qué ES el archivo, qué
 * pasa si falta, dropzone real (arrastrar o clic) y resumen inmediato tras
 * cargar (hoja, filas y columnas detectadas). Bajo las tarjetas, la franja de
 * compatibilidad adelanta cuántas variables requeridas ya se detectan — el
 * puente hacia la pestaña Variables. El mini flujo archivo → lectura → marco
 * enseña las cifras reales del motor tras construir.
 */
import { useState, type ReactNode } from "react";
import { CheckCircle2, Database, FileSpreadsheet, Loader2, TriangleAlert, Upload } from "lucide-react";
import { Popover } from "../../../../components/Popover";
import { EmptyState } from "../../../../components/States";
import type {
  CalcMuestraAulasState,
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceSourceBinding,
  CalcMuestraWorkspaceSourceMode,
} from "../../../../api/client";
import { fmtInt } from "../../sharedCore";
import { BadgeMotor } from "../../didactica/PasoDidactico";
import { UNIVERSITY_REQUIRED_VARIABLES, UNIVERSITY_SOURCE_MODE_OPTIONS } from "../shared/constants";
import {
  canBuildUniversityDeskFrameFromBindings,
  ensureUniversitySourceBindings,
  inferUniversityColumn,
  reconcileUniversityVariableMappingsForColumns,
  sourceBindingBuildMessage,
  sourceBindingCompatibleForBuild,
  sourceBindingPatchForSheet,
  sourceBindingSelectedDiagnostic,
  sourceBindingSelectedSheet,
  sourceRoleLabel,
  universityInspectedColumnOptions,
} from "../shared/categorias";
import { frameAuditNumber } from "../shared/frame";
import { FlujoVertical, TerminoChip, type FlujoEtapa } from "../ui";
import { useValorSwap } from "../ui/useValorSwap";
import "./definicion.css";

const MODE_BADGES: Record<CalcMuestraWorkspaceSourceMode, string> = {
  base_madre: "Recomendado",
  dos_bases: "Equivalente",
  seleccion_existente: "Lectura histórica",
};

const UPLOAD_ACCEPT = [
  ".xlsx",
  ".xls",
  ".xlsm",
  ".csv",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",");

const UPLOAD_ACCEPT_LABEL = ".xlsx · .xls · .csv";

/** Nombre corto de cada variable requerida para la franja de compatibilidad. */
const REQUIRED_SHORT_LABEL: Record<string, string> = {
  student_id: "identificador",
  faculty: "facultad",
  sex: "sexo",
  course_id: "curso",
  schedule: "horario",
  condition: "condición",
};

/** Chip de estado de la base: cruza con blur (.cmv2-uni-swap) cuando cambia. */
function EstadoBaseChip({ estado, tone }: { estado: string; tone?: "ok" | "warn" | "info" }) {
  const cambiando = useValorSwap(estado);
  return (
    <strong className="cmv2-defi-status cmv2-uni-swap" data-tone={tone} data-cambiando={cambiando || undefined}>
      {estado}
    </strong>
  );
}

/** Qué ES cada archivo y qué pasa si falta — dos frases por rol. */
function whatIsForRole(role: string): ReactNode {
  switch (role) {
    case "base_madre":
      return (
        <>
          Es el Excel institucional de matrícula: una fila por estudiante en cada curso y
          horario. Sin él no existe el{" "}
          <TerminoChip termino="marco muestral">marco muestral</TerminoChip> y ningún paso
          posterior — marco, cálculo, aulas — puede construirse.
        </>
      );
    case "estudiantes":
      return (
        <>
          Es la base principal de matrícula: estudiante elegible o, idealmente, estudiante
          por curso y horario. De aquí sale el{" "}
          <TerminoChip termino="marco muestral">marco muestral</TerminoChip>; si falta, no
          hay nada que construir.
        </>
      );
    case "catalogo_curso_horario":
      return (
        <>
          Es el catálogo de cursos y horarios: curso, horario, aula, docente y cupos. Si
          falta y la base principal ya trae curso y horario por estudiante, la lectura se
          completa igual.
        </>
      );
    case "muestra_previa":
      return (
        <>
          Es la muestra ya seleccionada: aulas titulares y reemplazos tal como fueron
          sorteados. Si falta, no hay selección que leer ni conservar.
        </>
      );
    case "agenda":
      return (
        <>
          Es la agenda operativa de las aulas: docente, fecha, responsable y estado. Si
          falta, la lectura no puede reconstruir el plan de campo de la selección.
        </>
      );
    default:
      return <>Declara el archivo y la hoja que entregará esta pieza del marco.</>;
  }
}

// -----------------------------------------------------------------------------
// BaseUploadCard — tarjeta numerada con dropzone real y resumen inmediato
// -----------------------------------------------------------------------------

function BaseUploadCard({
  binding,
  index,
  isUploading,
  gated,
  filasMotor,
  onUpload,
  onSheet,
}: {
  binding: CalcMuestraWorkspaceSourceBinding;
  index: number;
  isUploading: boolean;
  /** Card en espera: aún no aplica hasta que la base principal esté cargada. */
  gated: boolean;
  /** Filas reales leídas por el motor al construir (solo para la base principal). */
  filasMotor: number;
  onUpload: (binding: CalcMuestraWorkspaceSourceBinding, file: File) => void;
  onSheet: (id: string, sheetName: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputId = `cmv2-source-file-${binding.id}`;
  const sheetName = binding.sheet_name?.trim() || "";
  const availableSheets = binding.available_sheets ?? [];
  const selectedDiagnostic = sourceBindingSelectedDiagnostic(binding);
  const isCompatible = sourceBindingCompatibleForBuild(binding);
  const done = Boolean(binding.file_id);
  const status = gated
    ? "en espera"
    : done
      ? isCompatible ? "listo" : "revisar hoja"
      : binding.file_name ? "declarada" : "pendiente";
  const statusTone = status === "listo" ? "ok" : status === "revisar hoja" ? "warn" : status === "declarada" || status === "en espera" ? "info" : undefined;
  // Filas: primero la cifra real (declarada en el binding o auditada por el
  // motor al construir); si solo existe la vista previa de la inspección, se
  // dice explícitamente que es una muestra.
  const filasReales = binding.rows ?? (filasMotor > 0 ? filasMotor : 0);
  const filasPreview = selectedDiagnostic?.rows_preview ?? 0;
  const columnas = selectedDiagnostic?.columns_sample ?? [];
  const disabled = gated || isUploading;

  function pick(file?: File | null) {
    if (!file || disabled) return;
    onUpload({ ...binding, sheet_name: sheetName || binding.sheet_name }, file);
  }

  return (
    <article className={`cmv2-defi-upload-card${done ? " is-done" : ""}${gated ? " is-waiting" : ""}`}>
      <header className="cmv2-defi-upload-head">
        <span className="cmv2-defi-upload-num" aria-hidden="true">{index + 1}</span>
        <div className="cmv2-defi-upload-copy">
          <small>{sourceRoleLabel(binding.role)}</small>
          <strong>{binding.label}</strong>
        </div>
        <EstadoBaseChip estado={status} tone={statusTone} />
      </header>

      <p className="cmv2-defi-upload-whatis">{whatIsForRole(binding.role)}</p>

      <label
        className={`cmv2-defi-dropzone${dragOver ? " is-drag-over" : ""}${disabled ? " is-disabled" : ""}`}
        aria-disabled={disabled || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files?.[0]);
        }}
      >
        <input
          id={inputId}
          className="cmv2-source-file-input"
          type="file"
          accept={UPLOAD_ACCEPT}
          disabled={disabled}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            pick(file);
          }}
        />
        {isUploading
          ? <Loader2 size={20} className="pulso-spin cmv2-defi-dropzone-icon" aria-hidden="true" />
          : <Upload size={20} className="cmv2-defi-dropzone-icon" aria-hidden="true" />}
        <span className="cmv2-defi-dropzone-title">
          {isUploading
            ? "Subiendo…"
            : gated
              ? "Disponible después de cargar la base principal"
              : done
                ? "Reemplazar archivo"
                : "Arrastra o haz clic para subir"}
        </span>
        <span className="cmv2-defi-dropzone-formats">{gated ? "primero la tarjeta 1" : UPLOAD_ACCEPT_LABEL}</span>
      </label>

      {done && (
        <div className="cmv2-defi-upload-resumen">
          <div className="cmv2-defi-upload-stats">
            <div className="cmv2-defi-upload-stat">
              <span>Archivo</span>
              <strong>{binding.file_name || "cargado"}</strong>
            </div>
            <label className="cmv2-compact-field">
              <span>Hoja leída</span>
              {availableSheets.length > 0 ? (
                <select
                  value={sourceBindingSelectedSheet(binding)}
                  onChange={(e) => onSheet(binding.id, e.currentTarget.value)}
                >
                  {availableSheets.map((sheet) => (
                    <option key={sheet} value={sheet}>{sheet}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={binding.sheet_name ?? ""}
                  placeholder="MATRICULADO / CURSO Y HORARIO"
                  onChange={(e) => onSheet(binding.id, e.currentTarget.value)}
                />
              )}
              {selectedDiagnostic?.role_label && <em>{selectedDiagnostic.role_label}</em>}
            </label>
            <div className="cmv2-defi-upload-stat">
              <span>{filasReales > 0 ? "Filas leídas" : "Filas (vista previa)"}</span>
              <strong>{filasReales > 0 ? fmtInt(filasReales) : filasPreview > 0 ? fmtInt(filasPreview) : "—"}</strong>
            </div>
          </div>
          {columnas.length > 0 && (
            <details className="cmv2-defi-upload-cols">
              <summary>Ver columnas detectadas ({columnas.length})</summary>
              <div className="cmv2-defi-upload-cols-list">
                {columnas.map((columna) => (
                  <span key={columna}>{columna}</span>
                ))}
              </div>
            </details>
          )}
          {!isCompatible && (
            <p className="cmv2-source-warning">{sourceBindingBuildMessage(binding)}</p>
          )}
        </div>
      )}
    </article>
  );
}

// -----------------------------------------------------------------------------
// DefBasesTab
// -----------------------------------------------------------------------------

export function DefBasesTab({
  workspace,
  aulasState,
  onWorkspace,
  onSourceUpload,
  onSourceBuild,
  uploadingSourceId,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onSourceUpload: (binding: CalcMuestraWorkspaceSourceBinding, file: File) => void | Promise<void>;
  onSourceBuild: (workspace: CalcMuestraWorkspace) => void | Promise<void>;
  uploadingSourceId: string | null;
}) {
  const [construyendo, setConstruyendo] = useState(false);
  const frame = aulasState?.frame ?? null;
  const inputRows = frameAuditNumber(frame, "input_rows");
  const populationN = frameAuditNumber(frame, "population_n");
  const sourceMode = workspace.source_mode ?? "base_madre";
  const sourceBindings = ensureUniversitySourceBindings(sourceMode, workspace.source_bindings);
  const loadedCount = sourceBindings.filter((binding) => binding.file_id).length;
  const primaryLoaded = sourceMode !== "dos_bases" ||
    Boolean(sourceBindings.find((item) => item.role === "estudiantes")?.file_id);
  const readyToBuild = sourceMode === "base_madre"
    ? Boolean(sourceBindings.find((item) => item.role === "base_madre" && sourceBindingCompatibleForBuild(item))?.file_id)
    : sourceMode === "dos_bases"
      ? canBuildUniversityDeskFrameFromBindings(sourceBindings)
      : false;

  // Franja de compatibilidad: sobre las columnas ya inspeccionadas, cuántas de
  // las variables requeridas se detectan solas (mapeo guardado o inferencia).
  const inspectedColumns = universityInspectedColumnOptions({ ...workspace, source_bindings: sourceBindings });
  const requiredVariables = UNIVERSITY_REQUIRED_VARIABLES.filter((row) => row.required);
  const detectedRequired = requiredVariables.filter((row) => {
    const mapped = (workspace.variable_mappings ?? []).find((m) => m.role === row.role && m.column);
    if (mapped?.column && inspectedColumns.includes(mapped.column)) return true;
    return Boolean(inferUniversityColumn(row.role, inspectedColumns));
  });
  const missingRequired = requiredVariables.filter((row) => !detectedRequired.includes(row));
  const showCompat = sourceMode !== "seleccion_existente" && loadedCount > 0 && inspectedColumns.length > 0;
  const compatOk = missingRequired.length === 0;

  function setSourceMode(next: CalcMuestraWorkspaceSourceMode) {
    onWorkspace({
      ...workspace,
      source_mode: next,
      source_bindings: ensureUniversitySourceBindings(next, workspace.source_bindings),
    });
  }

  function updateBinding(id: string, patch: Partial<CalcMuestraWorkspaceSourceBinding>) {
    const nextBindings = sourceBindings.map((item) => (item.id === id ? { ...item, ...patch } : item));
    const nextWorkspace: CalcMuestraWorkspace = {
      ...workspace,
      source_bindings: nextBindings,
    };
    if (patch.sheet_name !== undefined) {
      const inspected = universityInspectedColumnOptions(nextWorkspace);
      if (inspected.length) {
        nextWorkspace.variable_mappings = reconcileUniversityVariableMappingsForColumns(
          nextWorkspace.variable_mappings,
          inspected,
        );
      }
    }
    onWorkspace(nextWorkspace);
  }

  function updateSheet(id: string, sheetName: string) {
    const binding = sourceBindings.find((item) => item.id === id);
    if (!binding) return;
    if ((binding.available_sheets ?? []).length > 0) {
      updateBinding(id, sourceBindingPatchForSheet(binding, sheetName));
    } else {
      updateBinding(id, { sheet_name: sheetName });
    }
  }

  const etapasMini: FlujoEtapa[] = [
    {
      id: "archivo",
      label: "Archivo",
      valor: `${loadedCount}/${sourceBindings.length}`,
      detalle: loadedCount ? "Excel cargados" : "sube el Excel institucional",
      estado: loadedCount === sourceBindings.length && loadedCount > 0 ? "ready" : loadedCount > 0 ? "working" : "pending",
    },
    {
      id: "lectura",
      label: "Lectura",
      valor: inputRows > 0 ? fmtInt(inputRows) : undefined,
      detalle: inputRows > 0 ? "filas leídas" : "tras construir el marco",
      estado: inputRows > 0 ? "ready" : "pending",
    },
    {
      id: "marco",
      label: "Marco (N)",
      valor: populationN > 0 ? fmtInt(populationN) : undefined,
      detalle: populationN > 0 ? "estudiantes únicos" : "población por validar",
      estado: populationN > 0 ? "ready" : "pending",
    },
  ];

  return (
    <section className="cmv2-panel cmv2-university-sources">
      <p className="cmv2-defi-intro">
        Con estos archivos se construye el{" "}
        <TerminoChip termino="marco muestral">marco muestral</TerminoChip>: la lista completa de
        aulas y estudiantes de donde el sorteo puede elegir. Declara qué insumo tienes y de qué hoja se lee.
      </p>
      <div className="cmv2-source-mode-grid cmv2-uni-stagger" role="radiogroup" aria-label="Tipo de insumo institucional">
        {UNIVERSITY_SOURCE_MODE_OPTIONS.map((option) => (
          <div key={option.id} className="cmv2-defi-mode">
            <button
              type="button"
              role="radio"
              aria-checked={option.id === sourceMode}
              className={`cmv2-source-mode-card ${option.id === sourceMode ? "is-active" : ""}`}
              onClick={() => setSourceMode(option.id)}
            >
              <span className="cmv2-defi-mode-radio" aria-hidden="true" />
              <small>{MODE_BADGES[option.id]}</small>
              <strong>{option.label}</strong>
              <span>{option.detail}</span>
            </button>
            <Popover
              openOn="hover"
              ariaLabel={`Cuándo usar ${option.label}`}
              trigger={<button type="button" className="cmv2-defi-when">¿Cuándo usar este modo?</button>}
            >
              <div className="cmv2-defi-when-pop">
                <strong>{option.label}</strong>
                <p>{option.detail}</p>
                <ul>
                  {option.cards.map((card) => (
                    <li key={card}>{card}</li>
                  ))}
                </ul>
              </div>
            </Popover>
          </div>
        ))}
      </div>
      {sourceMode === "dos_bases" && (
        <div className="cmv2-source-mode-note">
          <Database size={15} />
          <span>Con el archivo 2025 basta usar <strong>MATRICULADO</strong> como base principal y <strong>CURSO Y HORARIO</strong> como catálogo. La hoja de inscripciones solo es necesaria si la base principal no trae curso y horario por estudiante.</span>
        </div>
      )}
      <div className="cmv2-source-binding-list cmv2-defi-upload-list cmv2-uni-stagger" aria-label="Bases declaradas">
        {sourceBindings.map((binding, index) => (
          <BaseUploadCard
            key={binding.id}
            binding={binding}
            index={index}
            isUploading={uploadingSourceId === binding.id}
            gated={sourceMode === "dos_bases" && binding.role === "catalogo_curso_horario" && !primaryLoaded}
            filasMotor={binding.role === "base_madre" || binding.role === "estudiantes" ? inputRows : 0}
            onUpload={(next, file) => void onSourceUpload(next, file)}
            onSheet={updateSheet}
          />
        ))}
      </div>
      {showCompat && (
        <p className={`cmv2-defi-compat ${compatOk ? "is-ok" : "is-warn"}`} role="status">
          {compatOk
            ? <CheckCircle2 size={14} aria-hidden="true" />
            : <TriangleAlert size={14} aria-hidden="true" />}
          <span>
            {compatOk
              ? `Compatible · ${detectedRequired.length}/${requiredVariables.length} variables requeridas detectadas · confírmalas en la pestaña Variables`
              : `Por revisar · ${detectedRequired.length}/${requiredVariables.length} variables requeridas detectadas · faltan: ${missingRequired
                  .map((row) => REQUIRED_SHORT_LABEL[row.role] ?? row.label.toLowerCase())
                  .join(", ")} — mapéalas en la pestaña Variables`}
          </span>
        </p>
      )}
      {sourceMode === "seleccion_existente" ? (
        <EmptyState
          variant="inline"
          icon={<FileSpreadsheet size={18} />}
          title="Este modo lee una selección ya trabajada"
          hint="Sube la muestra y la agenda operativa: el marco no se reconstruye aquí; la lectura conserva la selección tal como fue diseñada."
        />
      ) : (
        <>
          <div className="cmv2-defi-build">
            <button
              type="button"
              className="cmv2-primary"
              onClick={() => {
                setConstruyendo(true);
                void Promise.resolve(
                  onSourceBuild({ ...workspace, source_mode: sourceMode, source_bindings: sourceBindings }),
                ).finally(() => setConstruyendo(false));
              }}
              disabled={!readyToBuild || construyendo || Boolean(uploadingSourceId)}
            >
              {construyendo && <Loader2 size={14} className="pulso-spin" />}
              {construyendo ? "Construyendo…" : "Construir marco"}
            </button>
            <p className="cmv2-defi-build-hint">
              {readyToBuild
                ? "La lectura deduplica estudiantes, aplica los criterios de inclusión y deja cada exclusión auditada."
                : "Sube el archivo y elige una hoja compatible para habilitar la construcción."}
            </p>
          </div>
          <div className="cmv2-defi-miniflujo cmv2-defi-stagger" aria-label="Del archivo al marco">
            <span className="cmv2-defi-miniflujo-caption">
              Del archivo al marco
              {populationN > 0 && <BadgeMotor estado="validado" />}
            </span>
            <FlujoVertical etapas={etapasMini} orientacion="horizontal" />
          </div>
        </>
      )}
    </section>
  );
}
