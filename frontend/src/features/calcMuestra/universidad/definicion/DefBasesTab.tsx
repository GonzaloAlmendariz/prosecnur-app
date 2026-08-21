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
import { useEffect, useState, type ReactNode } from "react";
import { Database, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Popover } from "../../../../components/Popover";
import { EmptyState } from "../../../../components/States";
import type {
  CalcMuestraAulasState,
  CalcMuestraReferenciaAsistencia,
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceSourceBinding,
  CalcMuestraWorkspaceSourceMode,
} from "../../../../api/client";
import {
  apiCalcMuestraAsistenciaRequisitos,
  type CalcMuestraAsistenciaRequisito,
} from "../../../../api/calcMuestra";
import { fmtInt } from "../../sharedCore";
import { BadgeMotor } from "../../didactica/PasoDidactico";
import { AvisoModulo } from "../shared/AvisoModulo";
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
  universityFrameSourceBindings,
  universityInspectedColumnOptions,
} from "../shared/categorias";
import { frameAuditNumber } from "../shared/frame";
import { FlujoVertical, TerminoChip, type FlujoEtapa } from "../ui";
import { useValorSwap } from "../ui/useValorSwap";
import { SolicitudDtiButton } from "./SolicitudDtiButton";
import { ReferenciaAsistenciaCard } from "./ReferenciaAsistenciaCard";
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
/**
 * Qué columnas debe traer la referencia histórica, ANTES de subirla.
 *
 * Medido con el estudio real: en su carpeta conviven ocho Excel «históricos»
 * —agenda, perfil de campo, base de aplicabilidad, la exportación cruda de la
 * encuesta…— y solo UNO pasa la validación. Hasta ahora la única forma de
 * saberlo era fallar. La lista la sirve el motor (mismo mapa de alias que
 * valida), así que no puede quedar diciendo algo distinto de lo que se exige.
 */
function RequisitosReferencia() {
  const [requisitos, setRequisitos] = useState<CalcMuestraAsistenciaRequisito[] | null>(null);

  useEffect(() => {
    let vivo = true;
    void apiCalcMuestraAsistenciaRequisitos()
      .then((res) => { if (vivo) setRequisitos(res.requisitos ?? []); })
      // Silencio deliberado: es información de apoyo. Si no llega, la tarjeta
      // sigue funcionando igual que antes y el error de subida sigue diciendo
      // qué falta.
      .catch(() => undefined);
    return () => { vivo = false; };
  }, []);

  if (!requisitos || !requisitos.length) return null;
  // Sin plegar: el contrato de la superficie de criterios (ADR 0057) prohíbe
  // esconder aquí, y en este caso tiene toda la razón — plegar justo lo que el
  // usuario no sabe sería el mismo defecto con otra forma. Los alias van en el
  // title de cada nombre para no convertir la tarjeta en un muro.
  return (
    <div className="cmv2-defi-requisitos">
      <span>Columnas que debe traer ({requisitos.length})</span>
      <p>
        {requisitos.map((req, i) => (
          <span key={req.campo}>
            {i > 0 ? " · " : null}
            <code title={req.alias.length > 1 ? `También se acepta: ${req.alias.filter((a) => a !== req.campo).join(", ")}` : undefined}>
              {req.campo}
            </code>
          </span>
        ))}
      </p>
    </div>
  );
}

function whatIsForRole(role: string): ReactNode {
  switch (role) {
    case "base_madre":
      return (
        <>
          Es el Excel institucional de matrícula: una fila por estudiante en cada curso y
          horario. Sin él no existe el{" "}
          <TerminoChip termino="marco muestral">marco muestral</TerminoChip> y ningún paso
          posterior — marco, cálculo, cursos-horario — puede construirse.
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
          Es el catálogo de cursos y horarios: curso, horario, salón, docente y cupos. Si
          falta y la base principal ya trae curso y horario por estudiante, la lectura se
          completa igual.
        </>
      );
    case "muestra_previa":
      return (
        <>
          Es la muestra ya seleccionada: cursos-horario titulares y reemplazos tal como fueron
          sorteados. Si falta, no hay selección que leer ni conservar.
        </>
      );
    case "agenda":
      return (
        <>
          Es la agenda operativa de los cursos-horario: docente, fecha, responsable y estado. Si
          falta, la lectura no puede reconstruir el plan de campo de la selección.
        </>
      );
    case "referencia_asistencia":
      return (
        <>
          Es la base de control de un estudio ya aplicado. Solo transfiere tasas
          agregadas por celda; no entra al marco vigente ni modifica el número de
          cursos-horario a seleccionar.
        </>
      );
    default:
      return <>Declara el archivo y la hoja que entregará esta pieza del marco.</>;
  }
}

// -----------------------------------------------------------------------------
// BaseUploadCard — tarjeta numerada con dropzone real y resumen inmediato
// -----------------------------------------------------------------------------

// G42 · Exportada para la pestaña Histórico, que carga la base de referencia
// con la misma tarjeta: dos dropzones distintas para el mismo gesto serían dos
// sitios donde arreglar el mismo detalle.
export function BaseUploadCard({
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
  // `isUploading` va PRIMERO: al reemplazar un archivo el binding conserva su
  // file_id, así que sin esta rama el chip seguía afirmando «listo» durante
  // toda la lectura del Excel nuevo —mientras la zona de arrastre, en la misma
  // tarjeta, decía «Subiendo…»—. Dos superficies de la misma tarjeta no pueden
  // declarar estados distintos del mismo archivo.
  const status = gated
    ? "en espera"
    : isUploading
      ? "subiendo"
      : done
        ? isCompatible ? "listo" : "revisar hoja"
        : binding.file_name ? "declarada" : "pendiente";
  const statusTone = status === "listo" ? "ok" : status === "revisar hoja" ? "warn" : status === "declarada" || status === "en espera" || status === "subiendo" ? "info" : undefined;
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
      {binding.role === "referencia_asistencia" && !binding.file_id ? <RequisitosReferencia /> : null}

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
              {/* Quien sube por primera vez una matrícula de seis cifras lee «80»
                  y no tiene cómo saber si su archivo entró completo: la
                  inspección lee a propósito solo las primeras filas para
                  reconocer las columnas (calc_muestra_aulas_inspect_workbook,
                  max_rows), y el total recién se cuenta al construir el marco.
                  Sin esta línea, el número invita justo a la lectura contraria. */}
              {filasReales > 0 ? null : filasPreview > 0 ? (
                <small>Solo para reconocer columnas; el total se cuenta al construir el marco.</small>
              ) : null}
            </div>
          </div>
          {/* F104 · Era un `<details>` rotulado «Ver columnas detectadas (N)».
              Lo primero que se comprueba tras cargar una base es si el motor
              leyó las columnas que debía: esto no es detalle de apoyo, es la
              verificación de la carga, y estaba a un click de distancia junto a
              «Filas leídas», que sí se muestra.

              La etiqueta además escribía la afordancia —«Ver…»— donde cabía
              nombrar la cosa. Con muchas columnas la lista se desplaza en su
              propio contenedor; el ancho de la tarjeta no cambia. */}
          {columnas.length > 0 && (
            <div className="cmv2-defi-upload-cols">
              <p className="cmv2-defi-upload-cols-head">
                <strong>{columnas.length}</strong>{" "}
                {columnas.length === 1 ? "columna detectada" : "columnas detectadas"}
              </p>
              <div className="cmv2-defi-upload-cols-list">
                {columnas.map((columna, index) => (
                  <span key={`${index}:${columna}`}>{columna}</span>
                ))}
              </div>
            </div>
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
  referencia,
  onWorkspace,
  onSourceUpload,
  onSourceBuild,
  onReferenceSheetChange,
  uploadingSourceId,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  referencia: CalcMuestraReferenciaAsistencia | null;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onSourceUpload: (binding: CalcMuestraWorkspaceSourceBinding, file: File) => void | Promise<void>;
  onSourceBuild: (workspace: CalcMuestraWorkspace) => void | Promise<void>;
  onReferenceSheetChange: (
    binding: CalcMuestraWorkspaceSourceBinding,
    workspace: CalcMuestraWorkspace,
  ) => void | Promise<void>;
  uploadingSourceId: string | null;
}) {
  const [construyendo, setConstruyendo] = useState(false);
  const frame = aulasState?.frame ?? null;
  const inputRows = frameAuditNumber(frame, "input_rows");
  const populationN = frameAuditNumber(frame, "population_n");
  const sourceMode = workspace.source_mode ?? "base_madre";
  const allBindings = ensureUniversitySourceBindings(sourceMode, workspace.source_bindings);
  const frameBindings = universityFrameSourceBindings(allBindings);
  const referenceBinding = allBindings.find((binding) => binding.role === "referencia_asistencia");
  const loadedCount = frameBindings.filter((binding) => binding.file_id).length;
  const primaryLoaded = sourceMode !== "dos_bases" ||
    Boolean(frameBindings.find((item) => item.role === "estudiantes")?.file_id);
  const readyToBuild = sourceMode === "base_madre"
    ? Boolean(frameBindings.find((item) => item.role === "base_madre" && sourceBindingCompatibleForBuild(item))?.file_id)
    : sourceMode === "dos_bases"
      ? canBuildUniversityDeskFrameFromBindings(frameBindings)
      : false;

  // Franja de compatibilidad: sobre las columnas ya inspeccionadas, cuántas de
  // las variables requeridas se detectan solas (mapeo guardado o inferencia).
  const inspectedColumns = universityInspectedColumnOptions({ ...workspace, source_bindings: frameBindings });
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
    const nextBindings = allBindings.map((item) => (item.id === id ? { ...item, ...patch } : item));
    const nextBinding = nextBindings.find((item) => item.id === id);
    const nextWorkspace: CalcMuestraWorkspace = {
      ...workspace,
      source_bindings: nextBindings,
    };
    if (patch.sheet_name !== undefined && nextBinding?.role !== "referencia_asistencia") {
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
    const binding = allBindings.find((item) => item.id === id);
    if (!binding) return;
    const patch = (binding.available_sheets ?? []).length > 0
      ? sourceBindingPatchForSheet(binding, sheetName)
      : { sheet_name: sheetName };
    if (binding.role === "referencia_asistencia" && binding.file_id) {
      const nextBinding = { ...binding, ...patch };
      const nextWorkspace: CalcMuestraWorkspace = {
        ...workspace,
        source_bindings: allBindings.map((item) => (item.id === id ? nextBinding : item)),
      };
      void onReferenceSheetChange(nextBinding, nextWorkspace);
      return;
    }
    updateBinding(id, patch);
  }

  const etapasMini: FlujoEtapa[] = [
    {
      id: "archivo",
      label: "Archivo",
      valor: `${loadedCount}/${frameBindings.length}`,
      detalle: loadedCount ? "Excel cargados" : "sube el Excel institucional",
      estado: loadedCount === frameBindings.length && loadedCount > 0 ? "ready" : loadedCount > 0 ? "working" : "pending",
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
    <section className="cmv2-panel cmv2-university-sources" data-qa-geometry-member>
      {/* Dos escenarios reales de datos (§3.1.3): base única o dos bases. La
          lectura de una selección ya trabajada no es un tipo de base para armar
          el marco, sino un camino aparte: vive como opción secundaria abajo. */}
      <div className="cmv2-source-mode-grid cmv2-uni-stagger" role="radiogroup" aria-label="Escenario de datos institucional">
        {UNIVERSITY_SOURCE_MODE_OPTIONS.filter((option) => option.id !== "seleccion_existente").map((option) => (
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
      {(() => {
        const historica = UNIVERSITY_SOURCE_MODE_OPTIONS.find((option) => option.id === "seleccion_existente");
        if (!historica) return null;
        const activa = sourceMode === "seleccion_existente";
        return (
          <div className="cmv2-source-historica">
            <button
              type="button"
              className={`cmv2-source-historica-toggle ${activa ? "is-active" : ""}`}
              aria-pressed={activa}
              onClick={() => setSourceMode(activa ? "base_madre" : "seleccion_existente")}
            >
              <span>{activa ? "◂ Volver a construir el marco desde la base" : "¿Ya tienes una selección trabajada? Léela sin reconstruir el marco"}</span>
            </button>
          </div>
        );
      })()}
      {sourceMode === "dos_bases" && (
        <AvisoModulo tone="info" icon={Database}>
          Con el archivo 2025 basta usar <strong>MATRICULADO</strong> como base principal y{" "}
          <strong>CURSO Y HORARIO</strong> como catálogo. La hoja de inscripciones solo es necesaria si la
          base principal no trae curso y horario por estudiante.
        </AvisoModulo>
      )}
      <div className="cmv2-source-binding-list cmv2-defi-upload-list cmv2-uni-stagger" aria-label="Bases declaradas">
        {frameBindings.map((binding, index) => (
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
      {/* G42 · La base de un estudio anterior salió de aquí a su propia pestaña
          (Datos › Histórico) porque vivía al final de esta lista, entre las
          fuentes que SÍ construyen el marco, y ahí se leía como una más.
          G44 · Gonzalo: «cuando nosotros agregamos la base, debe estar en
          bases». Vuelve a Fuentes —aquí se sube todo— pero en su propio grupo,
          separada de las que construyen el marco: sigue sin entrar al marco
          vigente ni cambiar el tamaño de muestra. Su LECTURA es lo que vive en
          Histórico. */}
      {referenceBinding ? (
        <div className="cmv2-source-optional" aria-label="Fuente opcional">
          <div className="cmv2-source-optional-head">
            <span className="cmv2-eyebrow">Fuente opcional</span>
            <p>
              Un estudio ya aplicado, para heredar sus tasas de campo. No entra al marco ni
              cambia cuántos cursos-horario se seleccionan. Su lectura está en Histórico.
            </p>
          </div>
          <BaseUploadCard
            binding={referenceBinding}
            index={frameBindings.length}
            isUploading={uploadingSourceId === referenceBinding.id}
            gated={false}
            filasMotor={0}
            onUpload={(next, file) => void onSourceUpload(next, file)}
            onSheet={updateSheet}
          />
        </div>
      ) : null}
      {sourceMode !== "seleccion_existente" && <SolicitudDtiButton />}
      {showCompat && (
        <AvisoModulo tone={compatOk ? "success" : "warn"} role="status" compact>
          {compatOk
            ? `Compatible · ${detectedRequired.length}/${requiredVariables.length} variables requeridas detectadas · confírmalas en la pestaña Variables`
            : `Por revisar · ${detectedRequired.length}/${requiredVariables.length} variables requeridas detectadas · faltan: ${missingRequired
                .map((row) => REQUIRED_SHORT_LABEL[row.role] ?? row.label.toLowerCase())
                .join(", ")} — mapéalas en la pestaña Variables`}
        </AvisoModulo>
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
                  onSourceBuild({ ...workspace, source_mode: sourceMode, source_bindings: frameBindings }),
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
