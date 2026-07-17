import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Info, Image as ImageIcon, Palette, Pipette, X as XIcon, RotateCcw, Plus, Trash2, Sparkles } from "lucide-react";
import { ArgMetadata, VarInfo } from "../../api/client";
import { usePlanStore } from "./store";
import { downloadUrl } from "../../api/client";
import VariablePicker from "./VariablePicker";
import VarsListPicker from "./VarsListPicker";
import { humanizeIdentifier } from "./graficadorDisplay";
import { safeText, safeTrimmedText } from "./safeText";
import {
  clampNumber,
  coerceNumber,
  evaluateNumberDraft,
  formatNumberInput,
  inferNumberStep,
  isPartialNumberInput,
} from "./argFieldNumberUtils";
import { normalizeTechnicalRows, type TechnicalRow } from "./technicalRows";

const DEFAULT_ARG_HINT = "Este ajuste define cómo se ve o se interpreta este bloque del gráfico en el slide.";

// Renderer universal de un argumento, según su `tipo_input` en el
// registry. Es la pieza que hace que podamos añadir nuevos args en
// graficos_metadata.R y que la UI los muestre sin tocar más código.
//
// Uso:
//   <ArgField meta={argMeta} value={x} onChange={(v) => ...} />
//
// Para cada `tipo_input` se renderiza el control apropiado:
//   - variable / variable_opt → VariablePicker
//   - variables_list          → VarsListPicker
//   - string                  → <input text>
//   - textarea                → <textarea>
//   - technical_rows          → editor de pares criterio / detalle
//   - number                  → <input number>
//   - bool                    → toggle
//   - choice                  → radio pills
//   - codigos_list            → chips list (split por coma/espacio)
//   - series_colors           → editor visual serie → color
//   - criteria_config         → criterios con selector de variables
//   - icono                   → selector del catálogo de iconos subidos
//   - overrides / filtros / base_config / meta → aviso de superficie dedicada

type ArgValue = unknown;
type FieldInputState = "default" | "focus" | "warning" | "error" | "disabled";
type FieldStatus = {
  state: FieldInputState;
  message: string;
};

/** Estados de origen para args de un graficador en el inspector V2:
 *  - "inherited": el valor proviene de la Base (sin override). Dot oculto,
 *    input en gris claro mostrando el valor heredado.
 *  - "from-mode": el valor proviene de un modo aplicado (override exacto).
 *    Se muestra como estado, pero sin reset por campo.
 *  - "custom": el usuario lo cambió individualmente (edit ad-hoc encima
 *    de la base o del modo). Dot azul. */
export type ArgState = "inherited" | "from-mode" | "custom";

export function ArgField({
  meta,
  value,
  onChange,
  variables,
  argState = "inherited",
  inheritedValue,
  placeholder,
  onReset,
}: {
  meta: ArgMetadata;
  value: ArgValue;
  onChange: (v: ArgValue) => void;
  variables: VarInfo[];
  /** Estado visual del arg. Por defecto `inherited`. */
  argState?: ArgState;
  /** Valor base (o del modo). Si `argState === "inherited"` y
   *  `value` es undefined/null/"", el control muestra `inheritedValue`
   *  con styling apagado para indicar que es heredado. */
  inheritedValue?: ArgValue;
  placeholder?: string;
  /** Si se provee y `argState !== "inherited"`, muestra un botón ↺ que
   *  llama a esta función para resetear el arg al valor base. */
  onReset?: () => void;
}) {
  // Si el arg está heredado y no tiene valor propio, mostramos el
  // valor del preset en el input pero con styling gris.
  const isInherited = argState === "inherited";
  const hasOwnValue = hasOwnArgValue(meta, value);
  const displayValue: ArgValue = hasOwnValue ? value : resolveDisplayFallback(meta, inheritedValue);
  const labelId = useId();
  const description = resolveArgumentDescription(meta);
  const descriptionId = `${labelId}-description`;
  const isTextInput = meta.tipo_input === "string" || meta.tipo_input === "textarea";
  const hasEmptyTextValue = isTextInput && typeof value === "string" && value.trim().length === 0;
  const hasAutomaticPlaceholder =
    isTextInput &&
    typeof placeholder === "string" &&
    placeholder.trim().length > 0 &&
    (!hasOwnValue || hasEmptyTextValue);
  const hasInheritedPreview =
    !hasOwnValue &&
    inheritedValue !== undefined &&
    inheritedValue !== null &&
    inheritedValue !== "";

  return (
    <div
      className="pulso-arg-field pulso-gv2-field-card"
      data-arg-name={meta.name}
      data-arg-type={meta.tipo_input}
      data-arg-state={argState}
      data-has-own-value={hasOwnValue}
      data-has-auto-text={hasAutomaticPlaceholder}
      data-has-inherited-preview={hasInheritedPreview}
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      style={{
        display: "flex", flexDirection: "column", gap: 4, marginBottom: 10,
        opacity: isInherited && !hasOwnValue ? 0.94 : 1,
      }}
    >
      <FieldHeader
        meta={meta}
        argState={argState}
        description={description}
        onReset={onReset}
        labelId={labelId}
        descriptionId={descriptionId}
        hasAutomaticPlaceholder={hasAutomaticPlaceholder}
      />
      <div className="pulso-gv2-field-control">
        <FieldControl
          meta={meta}
          value={value}
          displayValue={displayValue}
          hasOwnValue={hasOwnValue}
          inheritedValue={inheritedValue}
          argState={argState}
          placeholder={placeholder}
          onChange={onChange}
          variables={variables}
        />
      </div>
    </div>
  );
}

function allowsEmptyStringValue(meta: ArgMetadata): boolean {
  return meta.tipo_input === "string" || meta.tipo_input === "textarea";
}

function hasOwnArgValue(meta: ArgMetadata, value: ArgValue): boolean {
  if (value === undefined || value === null) return false;
  if (value === "") return allowsEmptyStringValue(meta);
  if (meta.tipo_input === "number") return coerceNumber(value) !== null;
  return true;
}

export function resolveDisplayFallback(meta: ArgMetadata, inheritedValue?: ArgValue): ArgValue {
  if (inheritedValue !== undefined && inheritedValue !== null) return inheritedValue;
  return meta.default;
}

// ---- Copy + estado de origen --------------------------------------------

function FieldHeader({
  meta,
  argState,
  description,
  onReset,
  labelId,
  descriptionId,
  hasAutomaticPlaceholder,
}: {
  meta: ArgMetadata;
  argState: ArgState;
  description: string;
  onReset?: () => void;
  labelId: string;
  descriptionId?: string;
  hasAutomaticPlaceholder?: boolean;
}) {
  const label = safeText(meta.label, humanizeIdentifier(meta.name, "Campo"));
  const isCustom = argState === "custom";
  const showOriginBadge = argState !== "inherited";
  const stateMeta = fieldStateMeta(argState);

  return (
    <>
      <span className="pulso-gv2-field-copy">
        <span className="pulso-gv2-field-title-row">
          <span id={labelId} className="pulso-gv2-field-title">{label}</span>
        </span>
        {description && (
          <span id={descriptionId} className="pulso-gv2-field-description">
            {description}
          </span>
        )}
      </span>
      <span className="pulso-gv2-field-utilities">
        {showOriginBadge && (
          <span
            className={`pulso-gv2-source-badge ${stateMeta.className}`}
            title={stateMeta.title}
            aria-label={stateMeta.ariaLabel}
          >
            <span
              aria-hidden="true"
              className={`pulso-gv2-source-dot ${stateMeta.className}`}
            />
            {stateMeta.label}
          </span>
        )}
        {hasAutomaticPlaceholder && (
          <span
            className="pulso-gv2-source-badge is-auto"
            title="Este campo usa un texto generado desde la variable si lo dejas vacío."
            aria-label="Texto automático desde la variable"
          >
            <span aria-hidden="true" className="pulso-gv2-source-dot is-auto" />
            Auto
          </span>
        )}
        {isCustom && onReset && (
          <button
            type="button"
            className="pulso-gv2-field-reset"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onReset();
            }}
            title="Restablecer al valor base"
            aria-label="Restablecer cambio manual al valor base"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </span>
    </>
  );
}

function fieldStateMeta(argState: ArgState): {
  label: string;
  className: string;
  title: string;
  ariaLabel: string;
} {
  if (argState === "custom") {
    return {
      label: "Ajuste",
      className: "is-custom",
      title: "Ajuste adicional de este gráfico. Tiene prioridad sobre la base y el estilo guardado.",
      ariaLabel: "Valor cambiado en este gráfico",
    };
  }
  if (argState === "from-mode") {
    return {
      label: "Estilo",
      className: "is-mode",
      title: "Valor aplicado por el estilo guardado activo",
      ariaLabel: "Valor proveniente del estilo guardado activo",
    };
  }
  return {
    label: "Base",
    className: "is-inherited",
    title: "Valor base del estilo global (o base heredada del layout).",
    ariaLabel: "Valor base heredado del estilo global",
  };
}

// ---- Control por tipo_input ---------------------------------------------

function FieldControl({
  meta,
  value,
  displayValue,
  hasOwnValue,
  inheritedValue,
  argState,
  placeholder,
  onChange,
  variables,
}: {
  meta: ArgMetadata;
  value: ArgValue;
  displayValue: ArgValue;
  hasOwnValue: boolean;
  inheritedValue?: ArgValue;
  argState: ArgState;
  placeholder?: string;
  onChange: (v: ArgValue) => void;
  variables: VarInfo[];
}) {
  const shownValue = displayValue;

  if (meta.tipo_input === "technical_rows" || (
    meta.name === "filas" && (meta.tipo_input === "textarea" || meta.tipo_input === "string")
  )) {
    return <TechnicalRowsField value={shownValue} onChange={onChange} />;
  }

  switch (meta.tipo_input) {
    case "variable":
      return <VariablePicker value={shownValue as string} onChange={(v) => onChange(v ?? "")} />;

    case "variable_opt":
      return <VariablePicker value={shownValue as string} onChange={(v) => onChange(v)} allowEmpty />;

    case "variables_list":
      return <VarsListPicker value={(shownValue as string[]) ?? []} onChange={(v) => onChange(v)} />;

    case "string":
      return (
        <TextControl
          meta={meta}
          value={safeText(shownValue)}
          argState={argState}
          placeholder={placeholder}
          onChange={onChange}
        />
      );

    case "textarea":
      return (
        <TextControl
          meta={meta}
          value={safeText(shownValue)}
          argState={argState}
          placeholder={placeholder}
          onChange={onChange}
          multiline
          rows={3}
        />
      );

    case "number":
      return <NumberControl meta={meta} value={shownValue} onChange={onChange} />;

    case "bool":
      return <BoolToggle value={!!shownValue} onChange={onChange} />;

    case "choice":
      return <ChoicePills meta={meta} value={safeText(shownValue)} onChange={onChange} />;

    case "codigos_list":
      return <CodigosList value={(shownValue as (string | number)[]) ?? []} onChange={onChange} />;

    case "multiflag":
      // Fallback a texto libre si el registry no trajo opciones — mantiene
      // compat con args antiguos que quedaron declarados como multiflag
      // sin el catálogo cerrado.
      if (!meta.opciones || meta.opciones.length === 0) {
        return <CodigosList value={(shownValue as string[]) ?? []} onChange={onChange} />;
      }
      return (
        <MultiFlag
          opciones={meta.opciones}
          value={(shownValue as string[]) ?? []}
          onChange={onChange}
        />
      );

    case "color":
      return (
        <ColorField
          value={hasOwnValue ? String(value ?? "") : ""}
          inheritedValue={typeof inheritedValue === "string" ? inheritedValue : undefined}
          defaultValue={typeof meta.default === "string" ? meta.default : undefined}
          onChange={onChange}
        />
      );

    case "series_colors":
      return (
        <SeriesColorsField
          value={shownValue}
          defaultValue={meta.default}
          onChange={onChange}
        />
      );

    case "criteria_config":
      return <CriteriaConfigField value={shownValue} onChange={onChange} />;

    case "icono":
      return <IconoSelect value={safeTrimmedText(shownValue) || null} onChange={onChange} />;

    case "overrides":
    case "filtros":
    case "base_config":
    case "meta":
    default:
      return <DedicatedSurfaceNotice meta={meta} value={shownValue} onChange={onChange} />;
  }
}

// ---- Estilos + sub-componentes ------------------------------------------

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 12,
  border: "1px solid var(--pulso-border)",
  borderRadius: 5,
  background: "white",
  outline: "none",
};

function TechnicalRowsField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: TechnicalRow[]) => void;
}) {
  const rows = normalizeTechnicalRows(value);
  const visibleRows = rows.length > 0 ? rows : [{ criterio: "", detalle: "" }];

  function updateRow(index: number, key: keyof TechnicalRow, nextValue: string) {
    onChange(visibleRows.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [key]: nextValue } : row
    )));
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <div className="pulso-gv2-technical-rows">
      <div className="pulso-gv2-technical-rows-head" aria-hidden="true">
        <span>Criterio</span>
        <span>Detalle</span>
      </div>
      <div className="pulso-gv2-technical-rows-list">
        {visibleRows.map((row, index) => (
          <div className="pulso-gv2-technical-row" key={index}>
            <input
              value={row.criterio}
              onChange={(event) => updateRow(index, "criterio", event.target.value)}
              placeholder="Ej. Periodo de campo"
              aria-label={`Criterio de la fila ${index + 1}`}
            />
            <textarea
              value={row.detalle}
              onChange={(event) => updateRow(index, "detalle", event.target.value)}
              placeholder="Detalle que verá el cliente"
              aria-label={`Detalle de la fila ${index + 1}`}
              rows={2}
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              disabled={rows.length === 0}
              aria-label={`Eliminar fila ${index + 1}`}
              title="Eliminar fila"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="pulso-gv2-technical-row-add"
        onClick={() => onChange([...rows, { criterio: "", detalle: "" }])}
      >
        <Plus size={13} /> Añadir fila
      </button>
      {typeof value === "string" && value.trim() && (
        <span className="pulso-gv2-technical-rows-legacy">
          El texto anterior se conservó y se separó en filas editables.
        </span>
      )}
    </div>
  );
}

const iconPickerTriggerStyle: React.CSSProperties = {
  minHeight: 44,
  width: "100%",
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 10,
  padding: "6px 10px",
  border: "1px solid color-mix(in srgb, var(--pulso-module-processing-border) 72%, var(--pulso-border))",
  borderRadius: 8,
  background: "linear-gradient(180deg, rgba(255,255,255,0.98), color-mix(in srgb, var(--pulso-module-processing-soft) 18%, #ffffff))",
  color: "var(--pulso-text)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.88), 0 5px 14px rgba(0, 36, 87, 0.05)",
  cursor: "pointer",
  textAlign: "left",
};

const iconPickerPreviewStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  border: "1px solid color-mix(in srgb, var(--pulso-module-processing-border) 66%, var(--pulso-border))",
  background: "color-mix(in srgb, var(--pulso-module-processing-soft) 48%, #ffffff)",
  color: "var(--pulso-module-processing)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.82)",
  overflow: "hidden",
  flex: "0 0 auto",
};

const iconPickerImageStyle: React.CSSProperties = {
  width: "78%",
  height: "78%",
  objectFit: "contain",
  display: "block",
  filter: "drop-shadow(0 1px 1px rgba(0, 36, 87, 0.12))",
};

const iconPickerTitleStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 12,
  lineHeight: 1.15,
  color: "var(--pulso-text)",
  letterSpacing: 0,
};

const iconPickerSubtitleStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 10.5,
  lineHeight: 1.15,
  color: "var(--pulso-text-soft)",
  letterSpacing: 0,
};

function iconPickerPopoverStyle(positionStyle: React.CSSProperties): React.CSSProperties {
  return {
    ...positionStyle,
    zIndex: 10020,
    display: "grid",
    gap: 10,
    padding: 10,
    border: "1px solid color-mix(in srgb, var(--pulso-module-processing-border) 74%, var(--pulso-border))",
    borderRadius: 10,
    background: "color-mix(in srgb, var(--pulso-surface) 94%, transparent)",
    boxShadow: "var(--pulso-shadow-popover)",
    backdropFilter: "blur(14px)",
    overflow: "hidden",
  };
}

const iconPickerPopoverHeadStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr)",
  alignItems: "center",
  gap: 10,
  padding: "2px 2px 8px",
  borderBottom: "1px solid var(--pulso-border)",
};

const iconPickerGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(136px, 1fr))",
  gap: 8,
  overflow: "auto",
  paddingRight: 2,
};

const iconPickerOptionStyle: React.CSSProperties = {
  position: "relative",
  minWidth: 0,
  minHeight: 76,
  display: "grid",
  gridTemplateRows: "38px auto",
  placeItems: "center",
  gap: 6,
  padding: "9px 8px 8px",
  border: "1px solid var(--pulso-border)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.92)",
  color: "var(--pulso-text)",
  cursor: "pointer",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.82)",
};

const iconPickerOptionActiveStyle: React.CSSProperties = {
  borderColor: "var(--pulso-module-processing)",
  background: "linear-gradient(180deg, color-mix(in srgb, var(--pulso-module-processing-soft) 50%, #ffffff), #ffffff)",
  boxShadow: "0 0 0 2px color-mix(in srgb, var(--pulso-module-processing-soft) 72%, transparent)",
};

const iconPickerOptionThumbStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  border: "1px solid color-mix(in srgb, var(--pulso-module-processing-border) 62%, var(--pulso-border))",
  background: "color-mix(in srgb, var(--pulso-module-processing-soft) 42%, #ffffff)",
  color: "var(--pulso-module-processing)",
  overflow: "hidden",
};

const iconPickerOptionNameStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textAlign: "center",
  fontSize: 11,
  lineHeight: 1.2,
  fontWeight: 800,
  color: "var(--pulso-text)",
  letterSpacing: 0,
};

const iconPickerCheckStyle: React.CSSProperties = {
  position: "absolute",
  top: 7,
  right: 7,
  width: 18,
  height: 18,
  padding: 3,
  borderRadius: 999,
  background: "var(--pulso-module-processing)",
  color: "white",
  boxShadow: "0 4px 10px rgba(15, 118, 110, 0.22)",
};

function TextControl({
  meta,
  value,
  argState,
  placeholder,
  onChange,
  multiline = false,
  rows = 1,
}: {
  meta: ArgMetadata;
  value: string;
  argState: ArgState;
  placeholder?: string;
  onChange: (v: ArgValue) => void;
  multiline?: boolean;
  rows?: number;
}) {
  const label = safeText(meta.label, humanizeIdentifier(meta.name, "campo"));
  const hasDescription = safeTrimmedText(meta.descripcion).length > 0;
  const presets = quickStringPresetsFor(meta.name);
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<FieldStatus>({
    state: "default",
    message: buildTextStatusMessage({
      value,
      metaName: meta.name,
      placeholder,
    }),
  });
  const [isFocused, setIsFocused] = useState(false);
  const statusId = useId();
  const showAutomaticPreview = !!placeholder && draft.trim() === "";
  const textSource = buildTextSourceMeta(draft, placeholder, argState);
  const showTextSourceStrip = textSource.state !== "base";
  const wrapsLongSingleLine = !multiline && (
    draft.length > 64 ||
    (placeholder?.length ?? 0) > 72
  );
  const useTextarea = multiline || wrapsLongSingleLine;
  const textareaRows = multiline ? rows : 2;

  function evaluate(next: string) {
    const message = buildTextStatusMessage({ value: next, metaName: meta.name, placeholder });
    const hasAutomaticText = !!placeholder && next.trim() === "";
    setStatus({
      state: isCriticalTextField(meta.name) && next.trim() === "" && !hasAutomaticText ? "warning" : "default",
      message,
    });
  }

  useEffect(() => {
    setDraft(value);
    evaluate(value);
  }, [meta.name, value]);

  const statusRowState = isFocused && status.state === "default" ? "focus" : status.state;
  const controlStatus: FieldStatus = {
    ...status,
    state: statusRowState,
  };
  const describedBy = controlStatus.message.trim().length > 0 ? statusId : undefined;

  return (
    <div className="pulso-gv2-string-control" data-text-source={textSource.state}>
      <div className="pulso-gv2-text-input-wrap">
        {useTextarea ? (
          <textarea
            rows={textareaRows}
            data-auto-wrap={wrapsLongSingleLine ? "true" : undefined}
            value={draft}
            onChange={(e) => {
              const next = e.target.value;
              setDraft(next);
              evaluate(next);
              onChange(next);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              evaluate(draft);
            }}
            placeholder={placeholder ?? (hasDescription ? undefined : "(opcional)")}
            style={{ ...inputStyle, fontFamily: "inherit", resize: multiline ? "vertical" : "none" }}
            className={`pulso-gv2-text-input-control is-${statusRowState} ${wrapsLongSingleLine ? "is-auto-wrap" : ""}`}
            aria-describedby={describedBy}
            aria-invalid={status.state === "error" ? "true" : undefined}
          />
        ) : (
          <>
            <input
              type="text"
              value={draft}
              onChange={(e) => {
                const next = e.target.value;
                setDraft(next);
                evaluate(next);
                onChange(next);
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                setIsFocused(false);
                evaluate(draft);
              }}
              placeholder={placeholder ?? (hasDescription ? undefined : "(opcional)")}
              style={inputStyle}
              className={`pulso-gv2-text-input-control is-${statusRowState}`}
              aria-describedby={describedBy}
              aria-invalid={status.state === "error" ? "true" : undefined}
            />
            {draft !== "" && (
              <button
                type="button"
                className="pulso-gv2-field-clear"
                onClick={(e) => {
                  e.preventDefault();
                  setDraft("");
                  evaluate("");
                  onChange("");
                }}
                aria-label={`Limpiar ${label}`}
                title="Limpiar"
              >
                <XIcon size={12} />
              </button>
            )}
          </>
        )}
      </div>

      {showTextSourceStrip && (
        <div
          className="pulso-gv2-text-source-strip"
          data-source-state={textSource.state}
          aria-label={`Estado del texto: ${textSource.label}`}
        >
          <span className="pulso-gv2-text-source-label">
            <span className="pulso-gv2-text-source-dot" aria-hidden="true" />
            {textSource.label}
          </span>
          <span className="pulso-gv2-text-source-detail">{textSource.detail}</span>
        </div>
      )}

      {showAutomaticPreview && (
        <div
          className="pulso-gv2-auto-preview"
          aria-label={`Texto automático sugerido: ${placeholder}`}
        >
          <Sparkles size={12} />
          <span className="pulso-gv2-auto-preview-kicker">Placeholder</span>
          <strong>{placeholder}</strong>
        </div>
      )}

      {presets.length > 0 && (
        <div className="pulso-gv2-quick-presets" aria-label={`Atajos para ${label}`}>
          {presets.map((preset) => (
            <button
              key={`${meta.name}-${preset.label}`}
              type="button"
              className="pulso-arg-preset-button"
              onClick={(e) => {
                e.preventDefault();
                setDraft(preset.value);
                evaluate(preset.value);
                onChange(preset.value);
              }}
              aria-pressed={draft === preset.value}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      <FieldStatusRow
        id={statusId}
        status={controlStatus}
        minHeight={16}
      />
    </div>
  );
}

function buildTextSourceMeta(draft: string, placeholder: string | undefined, argState: ArgState): {
  state: "auto" | "manual" | "base" | "mode" | "empty";
  label: string;
  detail: string;
} {
  const trimmed = draft.trim();
  if (placeholder && trimmed.length === 0) {
    return {
      state: "auto",
      label: "Automático",
      detail: "Fallback activo",
    };
  }
  if (argState === "from-mode") {
    return {
      state: "mode",
      label: "Estilo",
      detail: "Estilo guardado",
    };
  }
  if (argState === "inherited") {
    return {
      state: "base",
      label: "Base",
      detail: "Sin cambios propios",
    };
  }
  if (trimmed.length > 0) {
    return {
      state: "manual",
      label: "Ajustes adicionales",
      detail: `${trimmed.length} caracteres`,
    };
  }
  return {
    state: "empty",
    label: "Vacío",
    detail: "Sin texto visible",
  };
}

function NumberControl({
  meta,
  value,
  onChange,
}: {
  meta: ArgMetadata;
  value: ArgValue;
  onChange: (v: ArgValue) => void;
}) {
  const label = safeText(meta.label, safeText(meta.name, "campo"));
  const displayAsPercent = isProportionThreshold(meta);
  const displayScale = displayAsPercent ? 100 : 1;
  const step = inferNumberStep(meta, value);
  const displayStep = step * displayScale;
  const min = typeof meta.min === "number" ? meta.min : undefined;
  const max = typeof meta.max === "number" ? meta.max : undefined;
  const hasSlider = meta.control === "slider" && typeof min === "number" && typeof max === "number";
  const displayMin = typeof min === "number" ? min * displayScale : undefined;
  const displayMax = typeof max === "number" ? max * displayScale : undefined;
  const displayUnit = displayAsPercent ? "%" : meta.unidad;
  const useThreeDecimals = meta.grupo === "espacio" || /^(canvas_|tabla_)/.test(meta.name ?? "") || meta.name === "alto_por_categoria";
  const baseHint = buildNumberStatusHint(meta);
  const [status, setStatus] = useState<FieldStatus>(() => ({
    state: "default",
    message: baseHint,
  }));
  const [isFocused, setIsFocused] = useState(false);
  const statusId = useId();
  const lastValidValueRef = useRef<number | null>(null);

  const roundToThreeDecimals = (num: number) => Number(num.toFixed(3));

  const formatDecimalDisplay = (candidate: unknown) => {
    if (!useThreeDecimals) return formatNumberInput(candidate, displayScale);
    const num = coerceNumber(candidate);
    if (num === null) return "";
    return (num * displayScale).toFixed(3);
  };
  const [draft, setDraft] = useState(() => formatDecimalDisplay(value));

  const normalizeResultForWrite = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) return null;
    if (!useThreeDecimals) return value;
    return roundToThreeDecimals(value);
  };

  function evaluateCandidate(candidate: unknown) {
    const raw = useThreeDecimals ? formatDecimalDisplay(candidate) : formatNumberInput(candidate, displayScale);
    return evaluateNumberDraft(raw, {
      min,
      max,
      meta,
      displayScale,
      displayHint: baseHint,
      step,
    });
  }

  function numberControlFallbackValue(): number {
    const candidates: unknown[] = [
      lastValidValueRef.current,
      value,
      meta.default,
      typeof min === "number" ? min : null,
    ];
    for (const candidate of candidates) {
      if (candidate === null || candidate === undefined || candidate === "") continue;
      const result = evaluateCandidate(candidate);
      if (result.state === "default" && result.parsedInternal !== null) {
        return normalizeResultForWrite(result.parsedInternal) ?? result.parsedInternal;
      }
    }
    return 0;
  }

  function fallbackDraftText(): string {
    const candidates: unknown[] = [
      lastValidValueRef.current,
      meta.default,
      typeof min === "number" ? min : null,
    ];
    for (const candidate of candidates) {
      if (candidate === null || candidate === undefined || candidate === "") continue;
      const result = evaluateCandidate(candidate);
      if (result.state === "default" && result.parsedInternal !== null) {
        return formatDecimalDisplay(normalizeResultForWrite(result.parsedInternal));
      }
    }
    return "";
  }

  const currentNumeric = numberControlFallbackValue();
  const hasCurrentValue = Number.isFinite(currentNumeric);

  const applyCandidate = (raw: number | null) => {
    if (raw === null || !Number.isFinite(raw)) {
      const fallback = fallbackDraftText();
      const normalized = evaluateNumberDraft(fallback, {
        min,
        max,
        meta,
        displayScale,
        displayHint: baseHint,
        step,
      });
      const rounded = normalizeResultForWrite(normalized.parsedInternal);
      setStatus({
        state: normalized.state === "default" ? "default" : normalized.state,
        message: normalized.message || baseHint,
      });
      setDraft(typeof rounded === "number" ? formatDecimalDisplay(rounded) : fallback);
      return;
    }
    const bounded = clampNumber(raw, min, max);
    const result = evaluateNumberDraft(useThreeDecimals ? formatDecimalDisplay(bounded) : formatNumberInput(bounded, displayScale), {
      min,
      max,
      meta,
      displayScale,
      displayHint: baseHint,
      step,
    });
    if (result.parsedInternal === null) {
      setStatus({
        state: result.state === "default" ? "default" : result.state,
        message: result.message || baseHint,
      });
      return;
    }
    const rounded = normalizeResultForWrite(result.parsedInternal);
    lastValidValueRef.current = rounded;
    setDraft(rounded === null ? "" : formatDecimalDisplay(rounded));
    onChange(rounded ?? result.parsedInternal);
    setStatus({
      state: result.state === "default" ? (isFocused ? "focus" : "default") : result.state,
      message: result.message || baseHint,
    });
  };

  const resolveFromDraft = (raw: string) => {
    const result = evaluateNumberDraft(raw, {
      min,
      max,
      meta,
      displayScale,
      displayHint: baseHint,
      step,
    });
    if (isPartialNumberInput(raw) || result.state === "error" || result.parsedInternal === null) {
      setStatus({
        state: isFocused && result.state !== "error" ? "focus" : result.state === "default" ? "default" : "error",
        message: result.message || baseHint,
      });
      return;
    }
    const rounded = normalizeResultForWrite(result.parsedInternal);
    lastValidValueRef.current = rounded;
    setDraft(rounded === null ? "" : formatDecimalDisplay(rounded));
    onChange(rounded ?? result.parsedInternal);
    setStatus({
      state: result.state === "default" ? (isFocused ? "focus" : "default") : result.state,
      message: result.message || baseHint,
    });
  };

  const revertDraft = (message?: string) => {
    const next = fallbackDraftText();
    setDraft(next);
    setStatus({
      state: message ? "error" : "default",
      message: message || baseHint,
    });
  };

  const commitDraft = (raw = draft) => {
    const trimmed = raw.trim();
    const result = evaluateNumberDraft(trimmed, {
      min,
      max,
      meta,
      displayScale,
      displayHint: baseHint,
      step,
    });
    if (result.state === "error" || result.parsedInternal === null) {
      revertDraft(result.message || "El valor no está permitido.");
      return;
    }
    const rounded = normalizeResultForWrite(result.parsedInternal);
    lastValidValueRef.current = rounded;
    setDraft(rounded === null ? "" : formatDecimalDisplay(rounded));
    onChange(rounded ?? result.parsedInternal);
    setStatus({
      state: result.state === "default" ? "default" : result.state,
      message: result.message || baseHint,
    });
  };

  useEffect(() => {
    const normalized = formatDecimalDisplay(value);
    setDraft(normalized);
    const result = evaluateNumberDraft(normalized, {
      min,
      max,
      meta,
      displayScale,
      displayHint: baseHint,
      step,
    });
    if (result.state === "default" && result.parsedInternal !== null) {
      lastValidValueRef.current = result.parsedInternal;
    }
    setStatus({
      state: result.state === "default" ? "default" : result.state,
      message: result.message || baseHint,
    });
  }, [baseHint, displayScale, max, meta, min, step, value]);

  const unitPadding = displayUnit ? Math.max(46, String(displayUnit).length * 9 + 18) : 8;
  const statusClass = isFocused && status.state === "default" ? "focus" : status.state;
  const statusClassName = statusClass === "default" ? "" : `is-${statusClass}`;
  const formatRangeTick = (candidate: number | undefined) => {
    if (typeof candidate !== "number" || !Number.isFinite(candidate)) return "Auto";
    const suffix = displayUnit ? ` ${displayUnit}` : "";
    return `${formatNumberInput(candidate)}${suffix}`;
  };
  const currentDisplayValue = hasCurrentValue ? currentNumeric * displayScale : undefined;
  const stepDisplayLabel = formatRangeTick(displayStep);
  const controlStatus: FieldStatus = {
    ...status,
    state: isFocused && status.state === "default" ? "focus" : status.state,
  };
  const describedBy = controlStatus.message.trim().length > 0 ? statusId : undefined;
  const rangeProgress =
    hasSlider &&
    typeof displayMin === "number" &&
    typeof displayMax === "number" &&
    typeof currentDisplayValue === "number" &&
    Number.isFinite(currentDisplayValue) &&
    displayMax > displayMin
      ? clampNumber(((currentDisplayValue - displayMin) / (displayMax - displayMin)) * 100, 0, 100)
      : 0;
  const rangeTrackStyle = {
    width: "100%",
    accentColor: "var(--pulso-primary)",
    "--range-progress": `${rangeProgress}%`,
  } as React.CSSProperties;

  return (
    <div className="pulso-gv2-number-control" style={{ width: "100%", maxWidth: "100%" }}>
      <div className="pulso-gv2-number-stepper">
          <button
            type="button"
            className="pulso-arg-stepper-button"
            onClick={(e) => {
              e.preventDefault();
              applyCandidate(currentNumeric - step);
            }}
            aria-label={`Disminuir ${label} en ${stepDisplayLabel}`}
            title={`Disminuir en ${stepDisplayLabel}`}
            style={stepButtonStyle}
        >
          <span aria-hidden="true" className="pulso-gv2-stepper-glyph">−</span>
        </button>
        <div className="pulso-gv2-number-input-wrap">
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={(e) => {
              const raw = e.target.value;
              setDraft(raw);
              setIsFocused(true);
              resolveFromDraft(raw);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              commitDraft();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitDraft();
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === "Escape") {
                revertDraft();
                setIsFocused(false);
                (e.target as HTMLInputElement).blur();
              }
            }}
            style={{
              ...inputStyle,
              width: "100%",
              paddingRight: unitPadding,
              fontVariantNumeric: "tabular-nums",
            }}
            className={`pulso-gv2-number-input ${statusClassName}`}
            aria-describedby={describedBy}
            aria-invalid={status.state === "error" || status.state === "warning" ? "true" : undefined}
          />
          {displayUnit && (
            <span
              aria-hidden="true"
              className="pulso-gv2-number-unit"
            >
              {displayUnit}
            </span>
          )}
        </div>
          <button
            type="button"
            className="pulso-arg-stepper-button"
            onClick={(e) => {
              e.preventDefault();
              applyCandidate(currentNumeric + step);
            }}
            aria-label={`Aumentar ${label} en ${stepDisplayLabel}`}
            title={`Aumentar en ${stepDisplayLabel}`}
            style={stepButtonStyle}
        >
          <span aria-hidden="true" className="pulso-gv2-stepper-glyph">+</span>
        </button>
      </div>

      {hasSlider && (
        <div className="pulso-gv2-range-control">
          <input
            className="pulso-arg-range"
            type="range"
            value={hasCurrentValue ? currentNumeric * displayScale : displayMin}
            min={displayMin}
            max={displayMax}
            step={displayStep}
            onChange={(e) => applyCandidate(Number(e.target.value) / displayScale)}
            aria-label={`${label}: ajustar con deslizador`}
            aria-valuetext={`${label}: ${formatRangeTick(currentDisplayValue)}. Mínimo ${formatRangeTick(displayMin)}; máximo ${formatRangeTick(displayMax)}.`}
            title={`Arrastra para ajustar ${label}; también puedes escribir el valor exacto.`}
            style={rangeTrackStyle}
          />
          <div className="pulso-gv2-range-meta" aria-hidden="true">
            <span>
              <em>Mín.</em>
              <b>{formatRangeTick(displayMin)}</b>
            </span>
            <strong>
              <em>Actual</em>
              <b>{formatRangeTick(currentDisplayValue)}</b>
            </strong>
            <span>
              <em>Máx.</em>
              <b>{formatRangeTick(displayMax)}</b>
            </span>
          </div>
        </div>
      )}

      {quickPresetsFor(meta.name).length > 0 && (
        <div className="pulso-gv2-quick-presets" aria-label={`Atajos para ${label}`}>
          {quickPresetsFor(meta.name).map((preset) => (
              <button
                key={`${preset.label}-${preset.value}`}
                type="button"
                className="pulso-arg-preset-button"
                onClick={(e) => {
                  e.preventDefault();
                  applyCandidate(preset.value);
                }}
                aria-pressed={hasCurrentValue && currentNumeric === preset.value}
                aria-label={`${label}: ${preset.label}`}
              >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      <FieldStatusRow
        id={statusId}
        status={controlStatus}
        minHeight={16}
      />
    </div>
  );
}

function buildNumberStatusHint(meta: ArgMetadata): string {
  return buildRangeHint(meta);
}

function buildRangeHint(meta: ArgMetadata): string {
  const min = typeof meta.min === "number" ? meta.min : null;
  const max = typeof meta.max === "number" ? meta.max : null;
  const unitSuffix = formatUnitHint(meta.unidad);
  if (min === null && max === null) return "";
  if (min === null && max !== null) return `Máximo permitido: ${formatNumberInput(max)}${unitSuffix}.`;
  if (min !== null && max === null) return `Mínimo permitido: ${formatNumberInput(min)}${unitSuffix}.`;
  return `Rango permitido: ${formatNumberInput(min!)} a ${formatNumberInput(max!)}${unitSuffix}.`;
}

function formatUnitHint(unit: string | undefined): string {
  const normalized = String(unit ?? "").trim();
  if (!normalized) return "";
  return ` (${normalized})`;
}

function normalizeArgKey(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function normalizeHintSentence(value: string): string {
  const text = polishArgumentCopy(value);
  if (!text) return "";
  if (/[.!?]$/.test(text)) return text;
  return `${text}.`;
}

function polishArgumentCopy(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bcanvas\b/gi, "área interna")
    .replace(/\bplaceholder(?:s)?\b/gi, "espacio visual")
    .replace(/\bcaption\b/gi, "nota/base")
    .replace(/\blayout\b/gi, "distribución")
    .replace(/\bdebug\b/gi, "guía visual")
    .replace(/\boverrides?\b/gi, "ajustes")
    .replace(/\bslot\b/gi, "gráfico")
    .replace(/\btop row\b/gi, "fila superior")
    .replace(/Parametros/g, "Parámetros");
}

export const ARGUMENT_HINT_BY_NAME: Record<string, string> = {
  brecha_cols: "Espacio horizontal entre columnas o bloques cercanos.",
  brecha_filas: "Espacio vertical entre filas o niveles.",
  colores_series: "Paleta o mapa de color que distingue cada serie.",
  config_criterios: "Criterios de cálculo y segmentación que configuran el estilo del bloque.",
  base: "Texto base de contexto para notas, nota de fuente o total de casos.",
  pie_slide: "Nota corta para aclarar contexto al final del slide.",
  decimales: "Cantidad de decimales para números estándar.",
  decimales_promedio: "Detalle decimal para el promedio mostrado.",
  desplazamiento_max_etiquetas_peq: "Máximo corrimiento permitido para mover etiquetas pequeñas.",
  texto: "Texto libre para contar la idea principal del bloque o gráfico.",
  texto_narrativo: "Texto de apoyo para guiar la lectura del bloque.",
  donut_hole: "Ajusta el tamaño del centro vacío en donuts.",
  objetivo: "Enunciado corto del objetivo o foco del análisis.",
  bullets: "Texto por renglón para convertirlo en bullets visuales.",
  eje_label_mult: "Escala de etiquetas de eje para mejorar lectura y jerarquía.",
  escala_valor: "Escala de transformación para los valores mostrados.",
  espaciado_vertical_cm: "Espaciado vertical adicional (en cm) entre filas o bloques.",
  espacio_entre_barras: "Espacio entre barras contiguas.",
  subtitulo: "Línea de apoyo que completa el contexto del título.",
  titulo: "Texto principal del bloque o gráfico.",
  titulo_slide: "Texto principal del slide.",
  pie: "Texto de cierre al pie de bloque o slide.",
  pie_grafico: "Texto de apoyo que cierra la interpretación del gráfico.",
  nota: "Nota de contexto para ayudar a interpretar el gráfico.",
  notas: "Notas complementarias de apoyo a la lectura.",
  leyenda: "Texto de referencia para distinguir categorías o grupos.",
  etiqueta: "Texto de etiqueta o rótulo visible en el gráfico.",
  etiquetas: "Texto de etiquetas o rótulos visibles en el gráfico.",
  etiqueta_x: "Etiqueta visible del eje horizontal.",
  etiqueta_y: "Etiqueta visible del eje vertical.",
  titulo_eje_x: "Texto de título para el eje X.",
  titulo_eje_y: "Texto de título para el eje Y.",
  texto_adicional: "Texto adicional para reforzar una interpretación.",
  introduccion_word: "Texto introductorio usado solo en la exportación Word.",
  descripcion: "Texto explicativo del bloque o su objetivo.",
  titulo_leyenda: "Título visible para la leyenda.",
  prefijo_barra_extra: "Texto fijo al inicio de etiquetas de barra.",
  sufijo_barra_extra: "Texto fijo al final de etiquetas de barra.",
  prefijo_n_sobre_barras: "Texto fijo para etiquetar el contador N de cada barra.",
  titulo_tabla: "Título de la tabla asociada al bloque.",
  prefijo: "Texto fijo que aparece antes del valor.",
  sufijo: "Texto fijo que aparece después del valor.",
  margen: "Espacio extra entre el bloque y su contenedor.",
  margen_superior: "Espacio de separación arriba del bloque.",
  margen_inferior: "Espacio de separación abajo del bloque.",
  margen_izquierdo: "Espacio de separación izquierda del bloque.",
  margen_derecho: "Espacio de separación derecha del bloque.",
  width: "Ancho relativo del área dibujada.",
  height: "Alto relativo del área dibujada.",
  ancho: "Ancho principal del área dibujada.",
  alto: "Altura principal del área dibujada.",
  canvas_w_etiquetas: "Espacio destinado a etiquetas dentro del gráfico.",
  canvas_h_etiquetas: "Espacio destinado para etiquetas verticales.",
  ancho_max_eje_y: "Cantidad de caracteres por línea antes de envolver etiquetas largas.",
  wrap_y: "Largo máximo de texto antes de cortar en varias líneas.",
  wrap_ejes: "Largo máximo de texto antes de cortar etiquetas de eje.",
  alto_por_categoria: "Altura base por cada categoría o fila.",
  n_top: "Cantidad de elementos principales que se muestran.",
  top_n: "Cantidad de elementos destacados en la vista.",
  top2box: "Muestra el porcentaje agregado de las dos categorías superiores de una escala ordinal.",
  top2box_labels: "Define qué categorías cuentan como Top 2 cuando la escala no usa las dos últimas opciones.",
  tipo_rango: "Define el modo de clasificación por rangos.",
  debug_lw: "Controla marcadores de diagnóstico de layout.",
  debug_ph_bordes: "Muestra bordes de ayuda para validar espacios del gráfico.",
  debug_ph_col: "Activa líneas de ayuda por columna para revisar el layout.",
  debug_ph_lwd: "Ajusta el grosor de líneas de diagnóstico.",
  mostrar: "Activa o desactiva la visibilidad de este bloque.",
  mostrar_titulo: "Activa o desactiva el bloque de título.",
  mostrar_subtitulo: "Activa o desactiva el subtítulo.",
  mostrar_valores: "Muestra u oculta los valores numéricos.",
  mostrar_leyenda: "Muestra u oculta la leyenda.",
  mostrar_tabla: "Muestra u oculta la tabla asociada.",
  mostrar_pie: "Muestra u oculta el texto de pie.",
  mostrar_barras: "Muestra u oculta las barras del gráfico.",
  mostrar_barras_extra: "Muestra u oculta barras extra de apoyo.",
  mostrar_barra_extra: "Muestra u oculta la barra extra de apoyo.",
  mostrar_eje_y: "Muestra u oculta el eje Y.",
  mostrar_rango: "Muestra u oculta la zona de rango o segmentación.",
  mostrar_tabla_derecha: "Activa o desactiva la tabla a la derecha del gráfico.",
  mostrar_ref_label: "Muestra u oculta la etiqueta de referencia.",
  mostrar_niveles: "Muestra u oculta niveles de estructura secundaria.",
  mostrar_media: "Muestra u oculta la media de referencia.",
  mostrar_n_sobre_barras: "Muestra u oculta el contador N sobre cada barra.",
  mostrar_outliers: "Controla si aparecen o no valores atípicos.",
  mostrar_radios: "Muestra u oculta radios de referencia.",
  color_borde: "Color del contorno de bloques o líneas.",
  color_fondo: "Color de fondo del bloque o panel.",
  color_texto: "Color del texto principal visible.",
  color_titulo: "Color del texto del título.",
  color_subtitulo: "Color del texto secundario.",
  color_nota_pie: "Color del texto de nota o pie.",
  color_barra_extra: "Color del indicador adicional, como Top 2 Box.",
  color_texto_barras: "Color de los textos de las barras.",
  color_ejes: "Color de ejes y marcas principales.",
  color_leyenda: "Color de leyenda y textos de referencia.",
  color_etiquetas_pct: "Color de las etiquetas de porcentaje.",
  color_n_sobre_barras: "Color del contador N mostrado sobre barras.",
  grosor_borde: "Grosor del borde de bloques o líneas.",
  radio_borde: "Redondez de esquinas para bloques y tarjetas.",
  canvas_w_bars: "Espacio para barras dentro del área interna.",
  canvas_w_buf_bars_extra: "Respiro entre barras y columna derecha.",
  canvas_w_buf_etq_bars: "Separación entre etiquetas y barras.",
  canvas_w_legend_right: "Espacio reservado al lado derecho para la leyenda.",
  canvas_h_caption: "Altura reservada para nota, fuente o base del gráfico.",
  canvas_h_caption_in: "Espacio interno para nota, fuente o base del gráfico.",
  canvas_h_header_in: "Alto reservado para título, pregunta o subtítulo del gráfico.",
  canvas_h_legend: "Alto reservado para la leyenda.",
  canvas_h_title: "Altura disponible para el título.",
  canvas_h_toprow_in: "Fila auxiliar encima de las barras para indicadores como Top 2 Box.",
  canvas_h_legend_in: "Espacio interno para la leyenda.",
  canvas_h_legend_bottom: "Altura base para leyenda inferior.",
  canvas_pad_top: "Respiro superior dentro del gráfico.",
  canvas_w_extra: "Ancho reservado para una columna derecha de apoyo.",
  bar_ra_extra: "Ajuste para el bloque de barras extra.",
  bar_rrra_extra: "Ajusta separación extra del bloque de barras.",
  barra_extra_preset: "Elige si la columna adicional muestra Base/N, Top 2 Box u otro indicador.",
  donat_hole: "Ajusta la proporción del vacío en gráficos de dona.",
  angle_x: "Ángulo de inclinación para barras/elementos del eje X.",
  invertir_barras: "Invierte el orden visual cuando el motor dibuja la primera categoría abajo.",
  orden_barras: "Permite respetar el orden del instrumento o reordenar por frecuencia.",
  max_categorias: "Limita cuántas opciones se muestran para evitar gráficos demasiado altos.",
  agrupar_resto_en_otros: "Agrupa solo en el gráfico las opciones que exceden el máximo visible.",
  otros_al_final: "Mantiene Otro/Otros al final aunque tenga muchos casos.",
  etiqueta_otros: "Nombre visible para el grupo agregado de opciones restantes.",
  invertir_leyenda: "Invierte la posición y orden de leyenda.",
  orden: "Ajusta el orden de presentación de elementos.",
  ordenar_categorias: "Ordena categorías según estrategia definida.",
  legend_espaciado: "Espaciado entre ítems de leyenda; valores menores compactan la leyenda.",
  legend_key_cm: "Tamaño visual de símbolos de leyenda.",
  legend_key_spacing_x_cm: "Espacio horizontal entre los símbolos de leyenda.",
  legend_n_por_fila: "Cantidad de entradas por fila en la leyenda.",
  leyenda_posicion: "Posición del bloque de leyenda.",
  ncol_leyenda_bajo: "Número de columnas para leyenda inferior.",
  size_linea: "Espesor o grosor visual de la línea principal.",
  size_leyenda: "Tamaño del texto o símbolos de leyenda.",
  size_titulo: "Tamaño del texto del título.",
  size_subtitulo: "Tamaño del texto del subtítulo.",
  size_ejes: "Tamaño del texto de ejes.",
  size_nota_pie: "Tamaño del texto del pie o nota final.",
  size_etiquetas_pct: "Tamaño del texto de etiquetas de porcentaje.",
  size_texto_barras: "Tamaño del texto en barras y etiquetas numéricas.",
  size_texto_celdas: "Tamaño del texto de celdas o tablas.",
  size_titulo_extra: "Tamaño del texto auxiliar extra en títulos.",
  size_titulos_grupo: "Tamaño de títulos de grupo.",
  size_barra_extra: "Tamaño del texto de la barra extra.",
  tamano_key_cm: "Tamaño del cuadrante o ícono de leyenda.",
  etiqueta_n: "Texto fijo para etiqueta de N.",
  etiquetas_negrita: "Destaca con negrita ciertas etiquetas en el bloque.",
  modo: "Modo de interpretación o presentación del bloque.",
  modo_foda: "Activa el formato de análisis FODA.",
  modo_semaforo: "Aplica lectura por niveles semáforo.",
  font_family: "Familia tipográfica principal del bloque gráfico.",
  font_family_ppt: "Familia tipográfica para salida PPT.",
  cruce: "Variable usada para cruce o segmento.",
  cruces: "Número de cruces o categorías separadas.",
  exporatr: "Control de exposición o participación del bloque.",
  exposicion: "Controla qué tanto pesa la evidencia de este bloque.",
  exportar: "Indica si este bloque participa en la salida.",
  fecha: "Texto de fecha visible para contextualizar el bloque en el tiempo.",
  var: "Variable principal asociada al control.",
  vars: "Variables usadas en el control o cálculo.",
  filas: "Cantidad de filas o elementos base usados en el bloque.",
  filtros: "Ajustes de selección para filtrar observaciones.",
  cortes_chip: "Filtros rápidos por código o segmento.",
  cortes_grilla: "Grilla visual de cortes de referencia.",
  formato: "Formato de presentación de valores o etiquetas.",
  grosor_barras: "Grosor base de las barras del gráfico.",
  grosor_barras_mult: "Grosor relativo de barras cuando hay múltiples bloques.",
  grosor_modo: "Ajusta el nivel de grosor aplicado por el modo activo.",
  repeler_etiquetas_peq: "Evita que etiquetas pequeñas se superpongan.",
  icono: "Selecciona o personaliza el icono asociado al gráfico.",
  incluir_total: "Incluye o elimina el total agregado en la visualización.",
  limites: "Ajusta límites mínimos o máximos de interpretación.",
  metrica: "Métrica o variable que se calcula para este bloque.",
  mostrar_etiquetas_pct: "Activa o desactiva etiquetas de porcentaje.",
  umbral_posicion: "Controla cuándo una etiqueta pequeña se mueve fuera de la barra para leerse mejor.",
  umbral_etiqueta: "Nivel mínimo para mostrar una etiqueta especial.",
  umbral_etiqueta_normal: "Referencia de etiqueta para estado normal.",
  umbral_mostrar_etiqueta: "Activa etiqueta al cruzar este umbral.",
  umbral_rojo_pct: "Define porcentaje de disparo del color rojo.",
  nivel: "Nivel de severidad o intensidad de la señal.",
  nota_pie: "Nota corta que refuerza la lectura final del bloque.",
  overrides: "Ajustes heredados de la base predeterminada o de un estilo guardado que puedes refinar en este gráfico.",
  pos_titulo: "Ajusta la posición/espaciado del título principal.",
  tabla_auto_fit: "Ajusta tabla al espacio disponible.",
  tabla_body_size: "Tamaño de texto del cuerpo de tabla.",
  radar_min_ejes: "Fija el límite mínimo de los ejes para gráficos radar.",
  radar_scale: "Escala global aplicada al radar para ampliar o comprimir.",
  rellenar_poligono: "Rellena el polígono central para reforzar el área del radar.",
  tabla_digits: "Cantidad de decimales en números de tabla.",
  tabla_firstcol_bold: "Resalta la primera columna con texto más fuerte.",
  tabla_firstcol_size: "Tamaño de texto para la primera columna.",
  tabla_header_size: "Tamaño de texto del encabezado de tabla.",
  tabla_grid_col: "Activa líneas de grilla en tabla.",
  tabla_ph_ancho: "Ancho base de referencia de tabla.",
  tabla_ph_gap: "Espacio entre columnas de tabla.",
  tabla_ph_margin_top: "Margen superior dentro de la tabla.",
  tabla_ph_margin_bot: "Margen inferior dentro de la tabla.",
  tabla_header_fill: "Color de fondo del encabezado de tabla.",
  tabla_firstcol_indent_npc: "Indentación de primera columna.",
  tabla_firstcol_wrap: "Permite salto de línea en primera columna.",
  tabla_firstcol_frac: "Anchura relativa de la primera columna como fracción de la tabla.",
  size_n_sobre_barras: "Tamaño del texto/contador N mostrado sobre barras.",
  tabla_text_blue: "Color azul para texto destacado de tabla.",
  tabla_line_lwd: "Grosor de líneas de separación de tabla.",
  tabla_height_frac: "Altura relativa de filas de tabla.",
  tabla_body_fill: "Color de fondo del cuerpo de tabla.",
  tabla_padding_mm: "Padding interno de celdas de tabla.",
  textos_negrita: "Elige qué textos se resalten en negrita para guiar la atención.",
  subtexto: "Texto secundario para aclarar o ampliar el significado principal.",
  sufijo_auto: "Texto fijo al final de cada valor o etiqueta.",
  titulo_barra_extra: "Texto del título para la barra extra.",
  titulos_grupo: "Ajusta cómo se muestran los títulos de grupo.",
  usar_pesos: "Controla si se usan pesos en el cálculo.",
  sm_omit_codes: "Excluye códigos específicos del cálculo.",
  sm_omit_na: "Excluye filas sin respuesta o vacías.",
  orientacion: "Dirección general de lectura del gráfico.",
  tipo_pie: "Estilo gráfico del bloque de sectores.",
};

function joinHints(values: Array<string | undefined>): string {
  const clean = values
    .map((value) => normalizeHintSentence(value ?? ""))
    .filter((value) => value.length > 0);

  return clean.join(" ");
}

function resolveTextHintByName(key: string): string {
  if (ARGUMENT_HINT_BY_NAME[key]) return ARGUMENT_HINT_BY_NAME[key];
  if (key.includes("titulo")) return "Texto de título visible para el bloque o gráfico.";
  if (key.includes("subtitulo")) return "Texto de subtítulo o contexto para completar el encabezado.";
  if (key.includes("pie") || key.includes("nota")) return "Texto de apoyo al pie para clarificar la lectura.";
  if (key.includes("etiqueta")) return "Texto para etiquetas o rótulos que aparecen en el gráfico.";
  if (key.includes("leyenda")) return "Texto de leyenda para distinguir categorías o grupos.";
  if (key.includes("texto") || key.includes("subtexto")) return "Texto libre para explicar o narrar esta sección.";
  if (key.includes("bullets") || key.includes("bullet")) return "Texto en viñetas para listar mensajes clave.";
  if (key.includes("introduccion")) return "Mensaje introductorio que prepara lo que viene en el slide.";
  if (key.includes("objetivo")) return "Texto de objetivo para enfocar la interpretación.";
  return "";
}

function resolveBooleanHintByName(key: string): string {
  if (key.startsWith("mostrar_") || key === "mostrar") return "Activa o desactiva este elemento en la salida.";
  if (key.includes("usar_")) return "Decide si este comportamiento se aplica aquí.";
  if (key.includes("activar")) return "Controla si el comportamiento entra en efecto.";
  return "";
}

function resolveNumberHintByName(key: string): string {
  if (key.includes("size") || key.includes("tamano") || key.includes("tamaño")) {
    return "Ajusta el tamaño visual para mejorar legibilidad y jerarquía.";
  }
  if (key.includes("grosor") || key.includes("thick")) {
    return "Ajusta el grosor del trazo o bloque para marcar mayor o menor énfasis.";
  }
  if (key.includes("canvas_w") || key.includes("canvas_h") || key.includes("canvas")) {
    return "Reparte mejor el espacio interno disponible del área del gráfico.";
  }
  if (key.includes("ancho") || key.includes("alto") || key.includes("width") || key.includes("height")) {
    return "Controla la distribución horizontal o vertical de elementos.";
  }
  if (key.includes("umbral")) {
    return "Fija el punto de corte para clasificar o resaltar segmentos.";
  }
  if (key.includes("espacio") || key.includes("espaciado") || key.includes("brecha")) {
    return "Controla separación y compactación entre elementos relacionados.";
  }
  if (key.includes("wrap")) {
    return "Define hasta dónde se parte el texto en líneas.";
  }
  if (key.includes("mostrar_") && !key.includes("color")) {
    return "Permite activar o desactivar la visibilidad de un componente.";
  }
  if (key.includes("top_") || key === "top_n" || key.startsWith("top") || key.includes("n_")) {
    return "Ajusta cuántos elementos entran en el top o comparación principal.";
  }
  if (key.includes("decimales") || key.includes("precision")) {
    return "Ajusta el detalle numérico mostrado en etiquetas.";
  }
  return "";
}

function resolveGeneralHintByName(key: string): string {
  if (key.includes("modo")) return "Define el modo de lectura o interpretación del bloque.";
  if (key.includes("base")) return "Configura el punto de partida del estilo antes de aplicar ajustes.";
  if (key.includes("prefijo")) return "Añade un texto inicial fijo a cada etiqueta.";
  if (key.includes("sufijo")) return "Añade un texto final fijo a cada etiqueta.";
  if (key.includes("filtro") || key.includes("filtros")) return "Aplica restricciones para mostrar solo parte de los datos.";
  return "";
}

function buildTextualLabelHint(meta: ArgMetadata): string {
  const label = safeText(meta.label, safeText(meta.name, ""));
  const normalizedLabel = normalizeArgKey(label);
  if (meta.tipo_input === "number") {
    const displayLabel = label || normalizedLabel || "este parámetro";
    const withUnit = meta.unidad ? ` y la unidad ${meta.unidad}` : "";
    return `Ajusta el valor numérico para controlar ${displayLabel}${withUnit}.`;
  }
  const fallback = resolveTextHintByName(normalizedLabel) || resolveGeneralHintByName(normalizedLabel);
  if (fallback) return fallback;
  return `Ajusta el contenido de texto de ${label || "este campo"} para mejorar la lectura visual.`;
}

function buildTypeHint(meta: ArgMetadata, options: { forText?: boolean; forNumber?: boolean } = {}): string {
  const tipo = meta.tipo_input;

  if (tipo === "variable" || tipo === "variable_opt") {
    return "Selecciona la variable del dataset que alimenta este bloque visual.";
  }
  if (tipo === "variables_list") {
    return "Selecciona varias variables para construir el cálculo o la comparación.";
  }
  if (tipo === "string" || tipo === "textarea") {
    return "Texto visible en el resultado; cambia el mensaje que ve el lector.";
  }
  if (tipo === "number") {
    return options.forNumber
      ? "Ajusta un valor numérico que modifica escala, tamaño o umbrales."
      : "Ajusta un número asociado a este control.";
  }
  if (tipo === "bool") {
    return "Activa o desactiva este comportamiento en el bloque.";
  }
  if (tipo === "choice") {
    return "Escoge una alternativa y cambia cómo se interpreta el gráfico.";
  }
  if (tipo === "codigos_list") {
    return "Introduce códigos para filtrar o seleccionar casos específicos.";
  }
  if (tipo === "multiflag") {
    return "Marca varias opciones para combinar condiciones en este bloque.";
  }
  if (tipo === "color") {
    return "Selecciona el color base para esta zona visual.";
  }
  if (tipo === "series_colors") {
    return "Asigna colores por serie para distinguir mejor cada grupo.";
  }
  if (tipo === "criteria_config") {
    return "Define criterios y parámetros avanzados para segmentar o agrupar datos.";
  }
  if (tipo === "icono") {
    return "Selecciona un icono para reforzar el mensaje visual.";
  }
  if (tipo === "overrides") {
    return "Configurable desde estilos globales para aplicar una misma apariencia a varios gráficos.";
  }
  if (tipo === "filtros") {
    return "Este control usa una interfaz dedicada para combinar condiciones lógicas.";
  }
  if (tipo === "base_config") {
    return "Parametros base usados por el render del graficador.";
  }
  if (tipo === "meta") {
    return "Configuración técnica interna; normalmente no requiere edición manual.";
  }

  return "";
}

function resolveArgumentHintByName(meta: ArgMetadata, options: {
  forText?: boolean;
  forNumber?: boolean;
}): string {
  const normalized = normalizeArgKey(meta.name || "");
  const boolHint = meta.tipo_input === "bool" ? resolveBooleanHintByName(normalized) : "";
  const nameHint =
    ARGUMENT_HINT_BY_NAME[normalized] ||
    resolveGeneralHintByName(normalized) ||
    (options.forNumber ? resolveNumberHintByName(normalized) : resolveTextHintByName(normalized)) ||
    boolHint;
  if (nameHint) return nameHint;

  const labelHint = buildTextualLabelHint(meta);
  if (labelHint) return labelHint;

  return "";
}

export function resolveArgumentDescription(meta: ArgMetadata, options: {
  forText?: boolean;
  forNumber?: boolean;
} = {}): string {
  const source =
    safeTrimmedText(meta.efecto) ||
    safeTrimmedText(meta.descripcion);
  if (source) return normalizeHintSentence(source);

  const rangeHint = options.forNumber ? buildRangeHint(meta) : "";
  const typeHint = buildTypeHint(meta, options);
  const nameHint = resolveArgumentHintByName(meta, options);
  const groupContext = groupHint(meta.grupo);
  const numberContext = options.forNumber ? relatedNumericHint(meta.name ?? "", meta.grupo ?? "") : "";
  const fallbackHint = buildTextualLabelHint(meta);

  if (nameHint) return joinHints([nameHint, rangeHint]);
  if (fallbackHint) return joinHints([fallbackHint, rangeHint]);
  if (options.forNumber && rangeHint) return rangeHint;
  return joinHints([typeHint, groupContext, numberContext]) || DEFAULT_ARG_HINT;
}

function buildTextStatusMessage({
  value,
  metaName,
  placeholder,
}: {
  value: string | undefined;
  metaName: string;
  placeholder?: string;
}): string {
  const trimmed = (value ?? "").trim();
  if (trimmed.length === 0 && placeholder) {
    return "Usa texto automático si queda vacío.";
  }
  if (isCriticalTextField(metaName) && trimmed.length === 0) {
    return "Texto recomendado para orientar la lectura.";
  }
  return "";
}

function isCriticalTextField(name: string): boolean {
  const key = String(name).toLowerCase();
  return (
    key === "titulo" ||
    key === "subtitulo" ||
    key.endsWith("_titulo") ||
    key.startsWith("titulo_") ||
    key.includes("nota") ||
    key.includes("pie")
  );
}

function FieldStatusRow({
  id,
  status,
  minHeight,
}: {
  id: string;
  status: FieldStatus;
  minHeight: number;
}) {
  if (status.message.trim().length === 0) return null;

  return (
    <p
      id={id}
      className={`pulso-gv2-field-status is-${status.state}`}
      role={status.state === "error" ? "alert" : "status"}
      aria-live="polite"
      style={{ minHeight }}
    >
      {status.message || "\u00a0"}
    </p>
  );
}

function isProportionThreshold(meta: ArgMetadata): boolean {
  const name = String(meta.name ?? "").toLowerCase();
  return (name.startsWith("umbral_") || name.includes("_umbral_")) && !name.endsWith("_pct");
}

function relatedNumericHint(name: string, grupo: string): string {
  if (name === "canvas_w_etiquetas") return "útil para ajustar ancho de etiquetas.";
  if (name === "ancho_max_eje_y" || name === "wrap_y") return "trabaja junto al espacio de etiquetas.";
  if ((name.startsWith("umbral_") || name.includes("_umbral_")) && !name.endsWith("_pct")) {
    return "usa proporción de datos (por ejemplo, 0.05 = 5%).";
  }
  if (grupo === "espacio" || grupo === "canvas") return "controla el espacio de dibujo y separación visual.";
  if (grupo === "leyenda") return "afecta cómo se distribuyen y legibilizan etiquetas o leyendas.";
  if (grupo === "valores") return "incide directamente sobre el tamaño y escala visual de barras o etiquetas.";
  if (grupo === "lectura") return "afecta cómo se ve la lectura numérica del gráfico.";
  return "";
}

function groupHint(grupo: string): string {
  if (grupo === "lectura") return "Ajusta texto, tipografía y etiquetas para que el mensaje sea más claro.";
  if (grupo === "valores") return "Ajusta escalas, límites y la interpretación numérica del bloque.";
  if (grupo === "leyenda") return "Define cómo se ordena, posiciona y presenta la leyenda.";
  if (grupo === "espacio" || grupo === "canvas") return "Controla separación, márgenes y distribución del espacio visual.";
  if (grupo === "diagrama") return "Configura la presentación general de este bloque gráfico.";
  if (grupo === "tabla") return "Configura el estilo y la lectura de la tabla asociada.";
  if (grupo === "estilo") return "Ajusta estética, consistencia y jerarquía visual.";
  if (grupo === "datos") return "Define qué datos entran y cómo se estructuran para este bloque.";
  if (grupo === "textos") return "Controla títulos, notas y contenido textual visible.";
  if (grupo === "filtro") return "Filtra o ordena los casos antes de mostrarlos.";
  return "";
}

function quickPresetsFor(name: string): { label: string; value: number }[] {
  if (name === "canvas_w_etiquetas") {
    return [
      { label: "Compacto", value: 0.12 },
      { label: "Balance", value: 0.22 },
      { label: "Amplio", value: 0.35 },
    ];
  }
  if (name === "ancho_max_eje_y" || name === "wrap_y") {
    return [
      { label: "Corto", value: 18 },
      { label: "Medio", value: 35 },
      { label: "Largo", value: 60 },
    ];
  }
  if (name === "alto_por_categoria") {
    return [
      { label: "Compacto", value: 0.36 },
      { label: "Normal", value: 0.46 },
      { label: "Alto", value: 0.65 },
    ];
  }
  if ((name.startsWith("umbral_") || name.includes("_umbral_")) && !name.endsWith("_pct")) {
    return [
      { label: "0.05%", value: 0.0005 },
      { label: "1%", value: 0.01 },
      { label: "5%", value: 0.05 },
    ];
  }
  return [];
}

function quickStringPresetsFor(name: string): { label: string; value: string }[] {
  if (name === "prefijo_barra_extra" || name === "prefijo_n_sobre_barras") {
    return [
      { label: "Vacío", value: "" },
      { label: "N =", value: "N = " },
      { label: "Base:", value: "Base: " },
    ];
  }
  return [];
}

const stepButtonStyle: React.CSSProperties = {
  width: 28,
  border: "1px solid var(--pulso-border)",
  borderRadius: 5,
  background: "white",
  color: "var(--pulso-text)",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  lineHeight: 1,
};

function BoolToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`pulso-gv2-switch ${value ? "is-on" : ""}`}
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 10px", borderRadius: 999,
        border: `1px solid ${value ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
        background: value ? "var(--pulso-primary-soft)" : "white",
        color: value ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
        fontSize: 11, fontWeight: 600, cursor: "pointer",
        alignSelf: "flex-start",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      <span
        className="pulso-gv2-switch-track"
        style={{
          width: 24, height: 12, borderRadius: 999,
          background: value ? "var(--pulso-primary)" : "var(--pulso-border)",
          position: "relative",
          transition: "background 120ms ease",
        }}
      >
        <span
          className="pulso-gv2-switch-thumb"
          style={{
            position: "absolute",
            top: 1, left: value ? 13 : 1,
            width: 10, height: 10, borderRadius: "50%",
            background: "white",
            transition: "left 120ms ease",
          }}
        />
      </span>
      {value ? "Sí" : "No"}
    </button>
  );
}

function ChoicePills({
  meta,
  value,
  onChange,
}: {
  meta: ArgMetadata;
  value: string;
  onChange: (v: string) => void;
}) {
  const choices = meta.choices ?? [];
  return (
    <div className="pulso-gv2-choice-pills">
      {choices.map((c) => {
        const choiceValue = safeText(c.value);
        const choiceLabel = safeText(c.label, choiceValue);
        const active = value === choiceValue;
        return (
          <button
            key={choiceValue}
            type="button"
            className={`pulso-gv2-choice-pill ${active ? "is-active" : ""}`}
            onClick={() => onChange(choiceValue)}
            title={safeText(c.hint)}
            style={{
              padding: "5px 10px", borderRadius: 999,
              border: `1px solid ${active ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
              background: active ? "var(--pulso-primary-soft)" : "white",
              color: active ? "var(--pulso-primary)" : "var(--pulso-text)",
              fontSize: 11, fontWeight: active ? 600 : 500,
              cursor: "pointer",
              transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
            }}
          >
            {choiceLabel}
          </button>
        );
      })}
    </div>
  );
}

function CodigosList({
  value,
  onChange,
}: {
  value: (string | number)[];
  onChange: (v: (string | number)[]) => void;
}) {
  // Input de texto donde el usuario escribe códigos separados por coma
  // o espacio. Lo parseamos a array de strings (algunos son numéricos,
  // pero el backend los acepta como string y convierte).
  const text = Array.isArray(value) ? value.join(", ") : "";
  const wrapsLongList = text.length > 64;
  const commit = (next: string) => onChange(parseCodigosList(next));

  if (wrapsLongList) {
    return (
      <textarea
        rows={3}
        value={text}
        onChange={(e) => commit(e.target.value)}
        placeholder="ej. 88, 90, 96 o etiquetas separadas por coma"
        style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
        className="pulso-gv2-text-input-control is-auto-wrap pulso-gv2-code-list-control"
      />
    );
  }

  return (
    <input
      type="text"
      value={text}
      onChange={(e) => commit(e.target.value)}
      placeholder="ej. 88, 90, 96"
      style={inputStyle}
    />
  );
}

function parseCodigosList(text: string): string[] {
  const hasComma = text.includes(",");
  const splitter = hasComma ? "," : /\s+/;
  return text
    .split(splitter)
    .map((s) => s.trim())
    .filter(Boolean);
}

function SeriesColorsField({
  value,
  defaultValue,
  onChange,
}: {
  value: unknown;
  defaultValue?: unknown;
  onChange: (v: Record<string, string> | null) => void;
}) {
  const current = normalizeSeriesColors(value);
  const inherited = normalizeSeriesColors(defaultValue);
  const rows = Object.entries(current);
  const visibleRows = rows.length > 0 ? rows : Object.entries(inherited);
  const showingInherited = rows.length === 0 && visibleRows.length > 0;

  function emit(entries: Array<[string, string]>) {
    const next: Record<string, string> = {};
    for (const [rawName, rawColor] of entries) {
      const name = rawName.trim();
      const color = rawColor.trim();
      if (!name || !color) continue;
      next[name] = color;
    }
    onChange(Object.keys(next).length > 0 ? next : null);
  }

  function updateName(index: number, name: string) {
    const base = visibleRows.length > 0 ? visibleRows : [["Serie", "#081F5C"] as [string, string]];
    const next = base.map(([n, c], i) => [i === index ? name : n, c] as [string, string]);
    emit(next);
  }

  function updateColor(index: number, color: string | null) {
    const base = visibleRows.length > 0 ? visibleRows : [["Serie", "#081F5C"] as [string, string]];
    const next = base.map(([n, c], i) => [n, i === index ? (color ?? "") : c] as [string, string]);
    emit(next);
  }

  function removeRow(index: number) {
    emit(visibleRows.filter((_, i) => i !== index));
  }

  function addRow() {
    const used = new Set(visibleRows.map(([name]) => name));
    let i = visibleRows.length + 1;
    let name = `Serie ${i}`;
    while (used.has(name)) {
      i += 1;
      name = `Serie ${i}`;
    }
    emit([...visibleRows, [name, COLOR_PRESETS[visibleRows.length % 8].value]]);
  }

  function applySuggested() {
    const names = visibleRows.length > 0 ? visibleRows.map(([name]) => name) : ["Serie 1", "Serie 2", "Serie 3"];
    const palette = ["#081F5C", "#CA5651", "#85BB85", "#EFD25E", "#BFBFBF", "#E4A34C", "#7594CC", "#9688D3"];
    emit(names.map((name, i) => [name, palette[i % palette.length]] as [string, string]));
  }

  return (
    <div className="pulso-gv2-series-colors">
      {visibleRows.length === 0 ? (
        <div className="pulso-gv2-inline-empty">
          Sin colores personalizados. Se usará la paleta del gráfico.
        </div>
      ) : (
        <div className="pulso-gv2-series-list">
          {showingInherited && (
            <span className="pulso-gv2-field-hint">
              Valores heredados del preset. Edita una fila para personalizarlos.
            </span>
          )}
          {visibleRows.map(([name, color], index) => (
            <div
              key={`${name}-${index}`}
              className="pulso-gv2-series-row"
            >
              <input
                type="text"
                value={name}
                onChange={(e) => updateName(index, e.target.value)}
                placeholder="Nombre de serie"
                style={inputStyle}
              />
              <ColorField
                value={color}
                defaultValue={typeof inherited[name] === "string" ? inherited[name] : undefined}
                onChange={(v) => updateColor(index, v)}
              />
              <button
                type="button"
                className="pulso-icon"
                onClick={(e) => { e.preventDefault(); removeRow(index); }}
                aria-label={`Quitar color de ${name}`}
                title="Quitar serie"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pulso-gv2-inline-actions">
        <button
          type="button"
          className="pulso-arg-preset-button"
          onClick={(e) => { e.preventDefault(); addRow(); }}
        >
          <Plus size={12} /> Agregar serie
        </button>
        <button
          type="button"
          className="pulso-arg-preset-button"
          onClick={(e) => { e.preventDefault(); applySuggested(); }}
        >
          <Palette size={12} /> Paleta sugerida
        </button>
        {(rows.length > 0 || showingInherited) && (
          <button
            type="button"
            className="pulso-arg-preset-button"
            onClick={(e) => { e.preventDefault(); onChange(null); }}
          >
            <RotateCcw size={12} /> Usar preset
          </button>
        )}
      </div>
    </div>
  );
}

function normalizeSeriesColors(value: unknown): Record<string, string> {
  if (!value) return {};
  if (Array.isArray(value)) {
    const out: Record<string, string> = {};
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const name = String(obj.name ?? obj.serie ?? "").trim();
      const color = String(obj.color ?? obj.value ?? "").trim();
      if (name && color) out[name] = color;
    }
    return out;
  }
  if (typeof value === "object") {
    const out: Record<string, string> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const name = key.trim();
      const color = String(raw ?? "").trim();
      if (name && color) out[name] = color;
    }
    return out;
  }
  if (typeof value === "string") {
    const out: Record<string, string> = {};
    for (const line of value.split(/\n+/)) {
      const match = line.match(/^\s*([^:=]+?)\s*[:=]\s*(\S+)\s*$/);
      if (!match) continue;
      out[match[1].trim()] = match[2].trim();
    }
    return out;
  }
  return {};
}

type CriteriaConfigItem = {
  id?: string;
  titulo: string;
  vars: string[];
};

function CriteriaConfigField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: CriteriaConfigItem[] | null) => void;
}) {
  const items = normalizeCriteriaConfig(value);

  function emit(nextItems: CriteriaConfigItem[]) {
    const clean = nextItems
      .map((item, index) => {
        const titulo = item.titulo.trim();
        const vars = Array.from(new Set((item.vars ?? []).filter(Boolean)));
        return {
          id: item.id?.trim() || slugify(titulo || `criterio_${index + 1}`),
          titulo,
          vars,
        };
      })
      .filter((item) => item.titulo || item.vars.length > 0);
    onChange(clean.length > 0 ? clean : null);
  }

  function update(index: number, patch: Partial<CriteriaConfigItem>) {
    emit(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  function addCriterion() {
    emit([...items, { titulo: `Criterio ${items.length + 1}`, vars: [] }]);
  }

  return (
    <div className="pulso-gv2-criteria-config">
      {items.length === 0 ? (
        <div className="pulso-gv2-inline-empty">
          Agrega criterios y asigna variables a cada uno.
        </div>
      ) : (
        items.map((item, index) => (
          <div
            key={`${item.id ?? item.titulo}-${index}`}
            className="pulso-gv2-criteria-card"
          >
            <div className="pulso-gv2-criteria-row">
              <input
                type="text"
                value={item.titulo}
                onChange={(e) => update(index, { titulo: e.target.value })}
                placeholder="Nombre del criterio"
                style={inputStyle}
              />
              <button
                type="button"
                className="pulso-icon"
                onClick={(e) => {
                  e.preventDefault();
                  emit(items.filter((_, i) => i !== index));
                }}
                aria-label={`Quitar criterio ${item.titulo || index + 1}`}
                title="Quitar criterio"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <VarsListPicker
              value={item.vars ?? []}
              onChange={(vars) => update(index, { vars })}
            />
          </div>
        ))
      )}

      <button
        type="button"
        className="pulso-arg-preset-button"
        onClick={(e) => { e.preventDefault(); addCriterion(); }}
      >
        <Plus size={12} /> Agregar criterio
      </button>
    </div>
  );
}

function normalizeCriteriaConfig(value: unknown): CriteriaConfigItem[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((raw, index) => normalizeCriteriaItem(raw, `Criterio ${index + 1}`))
      .filter((item): item is CriteriaConfigItem => !!item);
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, raw]) => normalizeCriteriaItem(raw, key))
      .filter((item): item is CriteriaConfigItem => !!item);
  }
  return [];
}

function normalizeCriteriaItem(raw: unknown, fallbackTitle: string): CriteriaConfigItem | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return { id: slugify(fallbackTitle), titulo: fallbackTitle, vars: raw.map(String).filter(Boolean) };
  }
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const titulo = safeTrimmedText(obj.titulo, safeTrimmedText(obj.title, safeTrimmedText(obj.label, fallbackTitle)));
    const varsRaw = obj.vars ?? obj.variables ?? [];
    const vars = Array.isArray(varsRaw) ? varsRaw.map(String).filter(Boolean) : [];
    return {
      id: typeof obj.id === "string" ? obj.id : slugify(titulo || fallbackTitle),
      titulo,
      vars,
    };
  }
  return null;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "criterio";
}

function IconoSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const iconos = usePlanStore((s) => s.iconos);
  const selected = iconos.find((i) => i.id === value);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
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

  if (iconos.length === 0) {
    return (
      <div
        style={{
          padding: "8px 10px", borderRadius: 6,
          border: "1px dashed var(--pulso-border)",
          background: "var(--pulso-surface)",
          fontSize: 11, color: "var(--pulso-text-soft)",
        }}
      >
        <ImageIcon size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "-2px" }} />
        No tienes iconos subidos. Sube PNGs en <strong>Configuración global → Iconos</strong>.
      </div>
    );
  }

  function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(460, window.innerWidth - 28);
      const left = Math.max(14, Math.min(rect.left, window.innerWidth - width - 14));
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < 300 && spaceAbove > spaceBelow;
      setPopoverStyle({
        position: "fixed",
        left,
        width,
        maxHeight: Math.max(240, Math.min(440, (openUp ? spaceAbove : spaceBelow) - 14)),
        ...(openUp ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
      });
    }
    setOpen(true);
  }

  function commit(nextValue: string | null) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div ref={rootRef} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={iconPickerTriggerStyle}
      >
        <span style={iconPickerPreviewStyle} aria-hidden="true">
          {selected ? (
            <img
              src={downloadUrl(selected.file_id)}
              alt=""
              style={iconPickerImageStyle}
            />
          ) : (
            <ImageIcon size={15} />
          )}
        </span>
        <span style={{ minWidth: 0, display: "grid", gap: 2 }}>
          <strong style={iconPickerTitleStyle}>{selected ? safeText(selected.nombre, "Icono") : "Sin icono"}</strong>
          <small style={iconPickerSubtitleStyle}>{iconos.length} recurso{iconos.length === 1 ? "" : "s"} disponible{iconos.length === 1 ? "" : "s"}</small>
        </span>
        <ChevronDown size={14} style={{ color: "var(--pulso-text-soft)" }} />
      </button>

      {open && typeof document !== "undefined" && createPortal((
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Seleccionar icono"
          style={iconPickerPopoverStyle(popoverStyle)}
        >
          <div style={iconPickerPopoverHeadStyle}>
            <span style={iconPickerPreviewStyle} aria-hidden="true"><ImageIcon size={15} /></span>
            <span style={{ minWidth: 0 }}>
              <strong style={iconPickerTitleStyle}>Seleccionar icono</strong>
              <small style={iconPickerSubtitleStyle}>Recursos cargados en Estilo global</small>
            </span>
          </div>
          <div style={iconPickerGridStyle}>
            <button
              type="button"
              onClick={() => commit(null)}
              aria-pressed={!value}
              style={{
                ...iconPickerOptionStyle,
                ...(!value ? iconPickerOptionActiveStyle : {}),
              }}
            >
              <span style={iconPickerOptionThumbStyle}><XIcon size={15} /></span>
              <span style={iconPickerOptionNameStyle}>Sin icono</span>
              {!value && <Check size={13} style={iconPickerCheckStyle} />}
            </button>
            {iconos.map((ic) => {
              const active = ic.id === value;
              const nombre = safeText(ic.nombre, "Icono");
              return (
                <button
                  key={ic.id}
                  type="button"
                  onClick={() => commit(ic.id)}
                  aria-pressed={active}
                  title={nombre}
                  style={{
                    ...iconPickerOptionStyle,
                    ...(active ? iconPickerOptionActiveStyle : {}),
                  }}
                >
                  <span style={iconPickerOptionThumbStyle}>
                    <img
                      src={downloadUrl(ic.file_id)}
                      alt=""
                      style={iconPickerImageStyle}
                    />
                  </span>
                  <span style={iconPickerOptionNameStyle}>{nombre}</span>
                  {active && <Check size={13} style={iconPickerCheckStyle} />}
                </button>
              );
            })}
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

// Fallback para tipos con superficie dedicada. No ofrece edición cruda:
// si un arg llega aquí por error, la UI lo oculta detrás de una indicación
// segura y permite limpiar el valor.
function DedicatedSurfaceNotice({
  meta,
  value,
  onChange,
}: {
  meta: ArgMetadata;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const hasValue =
    value !== null && value !== undefined &&
    !(typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) &&
    !(Array.isArray(value) && value.length === 0);

  return (
    <div className="pulso-gv2-dedicated-notice">
      <Info size={12} />
      <span className="pulso-gv2-dedicated-notice-text">
        {surfaceLabel(meta.tipo_input)}
      </span>
      {hasValue && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onChange(meta.tipo_input === "overrides" || meta.tipo_input === "filtros" || meta.tipo_input === "base_config" ? {} : null);
          }}
          className="pulso-gv2-dedicated-clear"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}

function surfaceLabel(tipo: string): string {
  if (tipo === "filtros") return "Se configura desde la pestaña Filtros.";
  if (tipo === "overrides") return "Se configura desde Estilo guardado o Ajustes adicionales.";
  if (tipo === "base_config") return "La base se calcula automáticamente o se edita como texto del gráfico.";
  return "Este ajuste usa una interfaz dedicada.";
}

// Multi-select cerrado de tokens — usado por `textos_negrita` y
// similares. Renderiza chips toggleables con las `opciones` que el
// preset declara soportar. El valor es un array de strings.
//
// Diseñado para que el analista NO escriba tokens a mano y NO tenga
// que memorizar qué elementos del gráfico acepta cada preset.
function MultiFlag({
  opciones, value, onChange,
}: {
  opciones: { value: string; label: string; hint?: string }[];
  value: string[];
  onChange: (v: string[] | null) => void;
}) {
  const set = new Set(value);

  function toggle(v: string) {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    const arr = Array.from(next);
    // Null en vez de [] para que el store normalice y no persista un
    // array vacío innecesariamente (mismo patrón que otros inputs).
    onChange(arr.length === 0 ? null : arr);
  }

  return (
    <div className="pulso-gv2-multiflag">
      {opciones.map((opt) => {
        const optionValue = safeText(opt.value);
        const optionLabel = safeText(opt.label, optionValue);
        const on = set.has(optionValue);
        return (
          <button
            key={optionValue}
            type="button"
            role="switch"
            aria-checked={on}
            title={safeText(opt.hint)}
            onClick={() => toggle(optionValue)}
            className={`pulso-gv2-multiflag-chip ${on ? "is-on" : ""}`}
          >
            {on && (
              <span
                aria-hidden="true"
                className="pulso-gv2-multiflag-dot"
              />
            )}
            {optionLabel}
          </button>
        );
      })}
    </div>
  );
}

// ---- Color picker -------------------------------------------------------

// Presets generales — cubren los casos más comunes sin forzar al
// analista a abrir el color wheel. Ordenados: neutros → primary → acento.
const COLOR_PRESETS: { value: string; label: string }[] = [
  { value: "#081F5C", label: "Pulso azul" },
  { value: "#CA5651", label: "Pulso rojo" },
  { value: "#85BB85", label: "Pulso verde" },
  { value: "#EFD25E", label: "Pulso amarillo" },
  { value: "#BFBFBF", label: "Pulso gris" },
  { value: "#E4A34C", label: "Pulso naranja" },
  { value: "#7594CC", label: "Pulso azul secundario" },
  { value: "#9688D3", label: "Pulso morado" },
  { value: "#D8D8D8", label: "Pulso gris secundario" },
  { value: "#000000", label: "Negro" },
  { value: "#222222", label: "Casi negro" },
  { value: "#555555", label: "Gris oscuro" },
  { value: "#888888", label: "Gris medio" },
  { value: "#BBBBBB", label: "Gris claro" },
  { value: "#FFFFFF", label: "Blanco" },
  { value: "#002457", label: "Azul Prosecnur" },
  { value: "#0B3A67", label: "Azul profundo" },
];

// Palabras clave CSS que los graficadores R también aceptan y que no
// tienen representación hex — se muestran como chip literal en vez
// de swatch.
const COLOR_KEYWORDS: { value: string; label: string }[] = [
  { value: "transparent", label: "Transparente" },
  { value: "white", label: "Blanco" },
  { value: "black", label: "Negro" },
];

const COLOR_KEYWORD_ALIASES: Record<string, string> = {
  transparente: "transparent",
  transparent: "transparent",
  blanco: "white",
  white: "white",
  negro: "black",
  black: "black",
};

export function isValidColor(v: string): boolean {
  if (!v) return true; // vacío = hereda
  const clean = canonicalizeColorInput(v);
  if (COLOR_KEYWORDS.some((kw) => kw.value === clean.toLowerCase())) return true;
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(clean.trim());
}

export function isValidColorDraft(v: string): boolean {
  const clean = (v || "").trim();
  if (!clean) return true;
  const lower = clean.toLowerCase();
  if (COLOR_KEYWORDS.some((kw) => kw.value.startsWith(lower))) return true;
  return /^#?[0-9a-f]{0,8}$/i.test(clean);
}

// Normaliza shorthand (#abc → #aabbcc) y keyword → hex, para que el
// <input type="color"> nativo siempre reciba un hex de 7 chars.
export function toHex7(v: string): string {
  const s = canonicalizeColorInput(v).toLowerCase();
  if (s === "white") return "#ffffff";
  if (s === "black" || s === "transparent" || s === "") return "#000000";
  const m = s.match(/^#([0-9a-f]{3})$/);
  if (m) {
    const [r, g, b] = m[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{8}$/.test(s)) return s.slice(0, 7);
  return "#000000";
}

export function canonicalizeColorInput(v: string): string {
  const clean = (v || "").trim();
  const alias = COLOR_KEYWORD_ALIASES[clean.toLowerCase()];
  if (alias) return alias;
  if (/^[0-9a-f]{3}$|^[0-9a-f]{6}$|^[0-9a-f]{8}$/i.test(clean)) {
    return `#${clean}`;
  }
  return clean;
}

function formatColorInput(v: string | undefined): string {
  const clean = canonicalizeColorInput(v || "");
  const keyword = COLOR_KEYWORDS.find((kw) => kw.value === clean.toLowerCase());
  if (keyword) return keyword.label;
  if (/^#[0-9a-f]{3,8}$/i.test(clean)) return clean.toUpperCase();
  return clean;
}

export function shouldCommitColorDraft(v: string): boolean {
  const clean = v.trim();
  if (!clean) return false;
  const canonical = canonicalizeColorInput(clean).toLowerCase();
  if (COLOR_KEYWORDS.some((kw) => kw.value === canonical)) return true;
  return /^#?[0-9a-f]{3}$/i.test(clean) || /^#?[0-9a-f]{6}$/i.test(clean) || /^#?[0-9a-f]{8}$/i.test(clean);
}

function swatchBackgroundFor(value: string): string {
  const clean = canonicalizeColorInput(value).toLowerCase();
  if (clean === "transparent") {
    return "repeating-linear-gradient(45deg, #d8deea 0 4px, #fff 4px 8px)";
  }
  return clean;
}

function ColorField({
  value, inheritedValue, defaultValue, onChange,
}: {
  value: string;
  inheritedValue?: string;
  defaultValue?: string;
  onChange: (v: string | null) => void;
}) {
  const paletas = usePlanStore((s) => s.paletas);
  const [open, setOpen] = useState(false);
  const inheritedColor = inheritedValue || defaultValue || "";
  const effective = value || inheritedColor;
  const [draft, setDraft] = useState(formatColorInput(effective));
  const ref = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft);
  const committedRef = useRef(canonicalizeColorInput(effective));
  const pendingCommitRef = useRef<string | null>(null);
  const colorInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { draftRef.current = draft; }, [draft]);

  // Sync draft con prop externo (ej. al cambiar de preset seleccionado).
  useEffect(() => {
    const next = canonicalizeColorInput(value || inheritedColor);
    if (pendingCommitRef.current && next !== pendingCommitRef.current) {
      return;
    }
    pendingCommitRef.current = null;
    committedRef.current = next;
    setDraft(formatColorInput(next));
  }, [inheritedColor, value]);

  // Click fuera -> cerrar popover. No commiteamos acá: el input de texto ya
  // confirma en blur y los swatches/native picker confirman explícitamente.
  // Esto evita que un draft anterior vuelva a pisar el color recién elegido.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function setDraftText(next: string) {
    draftRef.current = next;
    setDraft(next);
  }

  function acceptLocalCommit(next: string) {
    const clean = canonicalizeColorInput(next);
    pendingCommitRef.current = clean;
    committedRef.current = clean;
    setDraftText(formatColorInput(clean));
  }

  function commit(v: string | null) {
    const clean = v == null ? null : canonicalizeColorInput(v);
    if (clean === "" || clean == null) {
      acceptLocalCommit(canonicalizeColorInput(inheritedColor));
      onChange(null);
      return;
    }
    if (!isValidColor(clean)) {
      setDraftText(formatColorInput(committedRef.current));
      return;
    }
    acceptLocalCommit(clean);
    onChange(clean);
  }

  function pickSwatch(hex: string) {
    commit(hex);
    setOpen(false);
  }

  const valid = isValidColorDraft(draft);
  const canPreviewDraft = isValidColor(draft);
  const previewColor = canPreviewDraft
    ? canonicalizeColorInput(draft || effective)
    : canonicalizeColorInput(effective);
  const wheelHex = toHex7(previewColor);
  const canClear = value.trim() !== "";

  // Todos los colores únicos extraídos de las paletas del estudio.
  // Agrupados por paleta para que el analista reconozca de dónde viene
  // cada color (importante para mantener consistencia con los gráficos).
  const paletasEntries = Object.entries(paletas)
    .map(([name, mapa]) => ({
      name,
      colores: Array.from(new Set(Object.values(mapa))).filter(Boolean),
    }))
    .filter((p) => p.colores.length > 0);

  return (
    <div ref={ref} className="pulso-gv2-color-control">
      <div className="pulso-gv2-color-row" data-can-clear={canClear}>
        {/* Swatch clickeable */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={() => setOpen((v) => !v)}
          title="Elegir color"
          className="pulso-gv2-color-swatch"
          style={{
            background: previewColor
              ? swatchBackgroundFor(previewColor)
              : "repeating-linear-gradient(45deg, #d8deea 0 4px, #fff 4px 8px)",
          }}
          aria-label="Abrir selector de color"
        />
        {/* Input hex con validación visual */}
        <input
          type="text"
          value={draft}
          placeholder={formatColorInput(inheritedColor) || "#RRGGBB, blanco o transparente"}
          onChange={(e) => {
            const raw = e.target.value;
            setDraftText(raw);
            if (shouldCommitColorDraft(raw)) {
              const clean = canonicalizeColorInput(raw);
              if (isValidColor(clean)) {
                acceptLocalCommit(clean);
                onChange(clean);
              }
            }
          }}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { commit(draft); (e.target as HTMLInputElement).blur(); }
            if (e.key === "Escape") { setDraftText(formatColorInput(committedRef.current)); (e.target as HTMLInputElement).blur(); }
          }}
          style={{
            ...inputStyle,
            width: "100%",
            minWidth: 0,
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            borderColor: valid ? "var(--pulso-border)" : "#f59f9f",
            background: valid ? "white" : "#fef7f7",
          }}
        />
        {canClear && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => commit(null)}
            className="pulso-icon pulso-gv2-color-clear"
            aria-label="Borrar color (heredar)"
            title="Borrar (hereda del preset padre)"
          >
            <XIcon size={11} />
          </button>
        )}
      </div>

      {open && (
        <div
          className="pulso-gv2-color-popover"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Presets comunes */}
          <PopoverSection icon={<Palette size={11} />} label="Comunes">
            <SwatchRow colors={COLOR_PRESETS} active={previewColor} onPick={pickSwatch} />
          </PopoverSection>

          {/* Paletas del estudio */}
          {paletasEntries.length > 0 && (
            <PopoverSection icon={<Palette size={11} />} label="Tus paletas">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {paletasEntries.map((p) => (
                  <div key={p.name} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 10, color: "var(--pulso-text-soft)" }}>{p.name}</span>
                    <SwatchRow
                      colors={p.colores.map((c) => ({ value: c, label: c }))}
                      active={previewColor}
                      onPick={pickSwatch}
                    />
                  </div>
                ))}
              </div>
            </PopoverSection>
          )}

          {/* Color wheel nativo + keywords */}
          <PopoverSection icon={<Pipette size={11} />} label="Personalizado">
            <div className="pulso-gv2-color-custom">
              <button
                type="button"
                className="pulso-gv2-color-wheel-button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  colorInputRef.current?.click();
                }}
              >
                <span className="pulso-gv2-color-wheel-icon" aria-hidden="true" />
                <span>Rueda de color</span>
                <span
                  className="pulso-gv2-color-wheel-preview"
                  style={{ background: wheelHex }}
                  aria-hidden="true"
                />
              </button>
              <input
                ref={colorInputRef}
                type="color"
                value={wheelHex}
                onInput={(e) => commit((e.target as HTMLInputElement).value)}
                onChange={(e) => commit(e.target.value)}
                className="pulso-gv2-color-native-input"
                aria-label="Selector nativo de color"
              />
              <div className="pulso-gv2-color-keywords" aria-label="Colores especiales">
                {COLOR_KEYWORDS.map((kw) => {
                  const active = canonicalizeColorInput(previewColor).toLowerCase() === kw.value;
                  return (
                    <button
                      key={kw.value}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickSwatch(kw.value)}
                      className={`pulso-gv2-color-keyword ${active ? "is-active" : ""}`}
                      aria-pressed={active}
                    >
                      {kw.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </PopoverSection>
        </div>
      )}
    </div>
  );
}

function PopoverSection({ icon, label, children }: {
  icon: JSX.Element;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pulso-gv2-color-popover-section">
      <h5>
        {icon}
        {label}
      </h5>
      {children}
    </section>
  );
}

function SwatchRow({
  colors, active, onPick,
}: {
  colors: { value: string; label: string }[];
  active: string;
  onPick: (hex: string) => void;
}) {
  return (
    <div className="pulso-gv2-swatch-row">
      {colors.map((c) => {
        const isActive = active.toLowerCase() === c.value.toLowerCase();
        return (
          <button
            key={c.value + c.label}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(c.value)}
            title={`${c.label} · ${c.value}`}
            aria-label={`${c.label} (${c.value})`}
            className={`pulso-gv2-swatch ${isActive ? "is-active" : ""}`}
            style={{
              background: swatchBackgroundFor(c.value),
            }}
          />
        );
      })}
    </div>
  );
}
