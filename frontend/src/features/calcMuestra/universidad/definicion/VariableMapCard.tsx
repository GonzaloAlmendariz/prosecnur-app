/**
 * Tarjeta de UNA variable en el mapeo manual (§3.3.2). Dos tratamientos según
 * el tipo de la columna: CATEGÓRICA (muestra las categorías reales del marco con
 * su conteo) vs NUMÉRICA (muestra el resumen conteo/rango/media). Los
 * identificadores llevan su propio afijo y no se resumen. El estado de
 * confirmación (§3.3.1) es explícito: una sugerencia queda "por confirmar" hasta
 * que el usuario la confirma; recién ahí cuenta como lista.
 */
import { CheckCircle2, CircleHelp, Hash, KeyRound, Sparkles, Tags, X } from "lucide-react";
import { Popover } from "../../../../components/Popover";
import type { CalcMuestraWorkspaceVariableMapping } from "../../../../api/client";
import { fmtInt } from "../../sharedCore";
import type { UniversityObservedCategory } from "../shared/categorias";
import {
  UNIVERSITY_VALUE_TYPE_LABEL,
  type UniversityNumericSummary,
  type UniversityVariableValueType,
} from "./variableRoles";

export type VariableMapCardState = "confirmada" | "por-confirmar" | "falta" | "opcional";

const TYPE_ICON: Record<UniversityVariableValueType, typeof Tags> = {
  categorica: Tags,
  numerica: Hash,
  identificador: KeyRound,
};

const MAX_CATEGORY_CHIPS = 8;

function fmtMean(value: number) {
  return Number.isInteger(value) ? fmtInt(value) : value.toFixed(1);
}

export function VariableMapCard({
  motorResuelto = "",
  base,
  valueType,
  columns,
  columnGroups,
  sheetNote,
  suggested,
  confirmedColumn,
  selectValue,
  motivoExtra,
  categories,
  numeric,
  hasFrame,
  flash,
  onSelect,
  onConfirm,
  onClear,
}: {
  /** Columna que el MOTOR resolvió para este rol en el marco vigente
   *  (frame.mapeo_resuelto). Información, no asignación (§3.3.1): se muestra
   *  solo cuando el usuario no confirmó, con confirmación a un click. */
  motorResuelto?: string;
  base: CalcMuestraWorkspaceVariableMapping;
  valueType: UniversityVariableValueType;
  columns: string[];
  /** Opciones agrupadas por hoja (solo roles dual-hoja como condicion_curso). */
  columnGroups?: Array<{ label: string; columns: string[] }>;
  /** Subtítulo bajo el select (p.ej. aviso de que la variable vive en dos hojas). */
  sheetNote?: string;
  suggested: string;
  confirmedColumn: string;
  selectValue: string;
  motivoExtra?: string;
  categories: UniversityObservedCategory[];
  numeric: UniversityNumericSummary;
  hasFrame: boolean;
  flash: boolean;
  onSelect: (value: string) => void;
  onConfirm: () => void;
  onClear: () => void;
}) {
  const required = Boolean(base.required);
  const persistedConfirmed = confirmedColumn !== "";
  const dirty = selectValue !== confirmedColumn;
  const state: VariableMapCardState = selectValue === ""
    ? (required ? "falta" : "opcional")
    : persistedConfirmed && !dirty
      ? "confirmada"
      : "por-confirmar";
  const suggestionPending = state === "por-confirmar" && !persistedConfirmed && selectValue === suggested && Boolean(suggested);
  const TypeIcon = TYPE_ICON[valueType];
  const otherColumns = columns.filter((column) => column !== suggested);

  return (
    <article
      className="cmv2-defi-var-card"
      data-state={state}
      data-type={valueType}
      data-flash={flash || undefined}
      data-qa-geometry-member
    >
      <div className="cmv2-defi-var-card-head">
        <span className="cmv2-defi-var-title">
          <span className="cmv2-defi-var-type-ic" aria-hidden="true">
            <TypeIcon size={13} />
          </span>
          <strong>{base.label}</strong>
        </span>
        <span className="cmv2-defi-var-card-meta">
          <span className="cmv2-defi-chip" data-tone={required ? "req" : undefined}>
            {required ? "requerida" : "opcional"}
          </span>
          <Popover
            openOn="hover"
            ariaLabel={`Por qué la calculadora necesita ${base.label}`}
            trigger={
              <button type="button" className="cmv2-defi-why" aria-label={`Por qué la calculadora necesita ${base.label}`}>
                <CircleHelp size={14} />
              </button>
            }
          >
            <div className="cmv2-defi-why-pop">
              <strong>¿Por qué la calculadora lo necesita?</strong>
              <p>{base.description}</p>
              {motivoExtra && <p>{motivoExtra}</p>}
            </div>
          </Popover>
        </span>
      </div>

      <span className="cmv2-defi-var-type-tag" data-type={valueType}>
        {UNIVERSITY_VALUE_TYPE_LABEL[valueType]}
      </span>

      <select
        className="cmv2-defi-var-select"
        value={selectValue}
        aria-label={`Columna del Excel para ${base.label}`}
        onChange={(event) => onSelect(event.currentTarget.value)}
      >
        <option value="">Sin asignar</option>
        {Boolean(suggested) && (
          <optgroup label="Sugerencia">
            <option value={suggested}>{suggested}</option>
          </optgroup>
        )}
        {columnGroups
          ? columnGroups.map((grupo) => (
              <optgroup key={grupo.label} label={grupo.label}>
                {grupo.columns
                  .filter((column) => column !== suggested)
                  .map((column) => (
                    <option key={`${base.role}-${grupo.label}-${column}`} value={column}>{column}</option>
                  ))}
              </optgroup>
            ))
          : (
              <optgroup label="Todas las columnas">
                {otherColumns.map((column) => (
                  <option key={`${base.role}-${column}`} value={column}>{column}</option>
                ))}
              </optgroup>
            )}
      </select>
      {sheetNote && <p className="cmv2-defi-var-sheet-note">{sheetNote}</p>}

      <div className="cmv2-defi-var-confirm" data-state={state}>
        {state === "confirmada" ? (
          <>
            <span className="cmv2-defi-var-confirmed">
              <CheckCircle2 size={14} />
              Confirmada
            </span>
            <button type="button" className="cmv2-defi-var-clear" onClick={onClear}>
              <X size={12} />
              Quitar
            </button>
          </>
        ) : state === "por-confirmar" ? (
          <>
            <button type="button" className="cmv2-defi-var-confirm-btn" onClick={onConfirm}>
              <CheckCircle2 size={14} />
              {persistedConfirmed ? "Confirmar cambio" : "Confirmar"}
            </button>
            {suggestionPending && (
              <span className="cmv2-defi-var-suggestion">
                <Sparkles size={12} />
                sugerida
              </span>
            )}
          </>
        ) : motorResuelto ? (
          <span className="cmv2-defi-var-motor">
            <span className="cmv2-defi-var-motor-copy">
              El motor está usando <b>{motorResuelto}</b>
            </span>
            <button
              type="button"
              className="cmv2-defi-var-confirm-btn"
              title={`Confirmar ${motorResuelto} como ${base.label} en el estudio`}
              onClick={() => {
                onSelect(motorResuelto);
                onConfirm();
              }}
            >
              <CheckCircle2 size={14} />
              Confirmarla
            </button>
          </span>
        ) : (
          <span className={`cmv2-defi-var-pending ${required ? "is-required" : ""}`}>
            {required ? "Falta asignar esta columna" : "Sin asignar (opcional)"}
          </span>
        )}
      </div>

      <div className="cmv2-defi-var-detail" data-type={valueType} data-qa-geometry-content>
        {valueType === "categorica" && (
          categories.length > 0 ? (
            <div className="cmv2-defi-var-cats" aria-label={`Categorías observadas de ${base.label}`}>
              {categories.slice(0, MAX_CATEGORY_CHIPS).map((item) => (
                <span key={`${item.role}-${item.raw}`} className="cmv2-defi-var-cat" title={item.raw}>
                  <b>{item.label}</b>
                  {item.count > 0 && <em>{fmtInt(item.count)}</em>}
                </span>
              ))}
              {categories.length > MAX_CATEGORY_CHIPS && (
                <span className="cmv2-defi-var-cat is-more">+{fmtInt(categories.length - MAX_CATEGORY_CHIPS)}</span>
              )}
            </div>
          ) : (
            <p className="cmv2-defi-var-detail-note">
              {!hasFrame
                ? "Construye el marco para ver las categorías de esta columna."
                : selectValue
                  ? "Sin categorías detectadas en esta columna."
                  : "Asigna una columna para leer sus categorías."}
            </p>
          )
        )}

        {valueType === "numerica" && (
          numeric ? (
            <div className="cmv2-defi-var-numeric" aria-label={`Resumen numérico de ${base.label}`}>
              <span><small>valores</small><b>{fmtInt(numeric.count)}</b></span>
              <span><small>mín</small><b>{fmtInt(numeric.min)}</b></span>
              <span><small>máx</small><b>{fmtInt(numeric.max)}</b></span>
              <span><small>media</small><b>{fmtMean(numeric.mean)}</b></span>
            </div>
          ) : (
            <p className="cmv2-defi-var-detail-note">
              {!hasFrame
                ? "Construye el marco para ver el rango de esta variable numérica."
                : selectValue
                  ? "Sin valores numéricos legibles en esta columna."
                  : "Asigna una columna para ver su rango."}
            </p>
          )
        )}

        {valueType === "identificador" && (
          <p className="cmv2-defi-var-detail-note is-identifier">
            Identificador: se usa fila por fila (no se resume por categorías).
          </p>
        )}
      </div>
    </article>
  );
}
