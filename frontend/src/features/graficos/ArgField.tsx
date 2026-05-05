import { useEffect, useRef, useState } from "react";
import { Info, Image as ImageIcon, Palette, Pipette, X as XIcon, RotateCcw, Plus, Trash2 } from "lucide-react";
import { ArgMetadata, VarInfo } from "../../api/client";
import { usePlanStore } from "./store";
import { downloadUrl } from "../../api/client";
import VariablePicker from "./VariablePicker";
import VarsListPicker from "./VarsListPicker";

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
//   - number                  → <input number>
//   - bool                    → toggle
//   - choice                  → radio pills
//   - codigos_list            → chips list (split por coma/espacio)
//   - series_colors           → editor visual serie → color
//   - criteria_config         → criterios con selector de variables
//   - icono                   → selector del catálogo de iconos subidos
//   - overrides / filtros / base_config / meta → aviso de superficie dedicada

type ArgValue = unknown;

/** Tres estados visuales para args de un graficador en el inspector V2:
 *  - "inherited": el valor proviene del preset (sin override). Dot oculto,
 *    input en gris claro mostrando el valor heredado.
 *  - "from-mode": el valor proviene de un modo aplicado (override exacto).
 *    Dot morado.
 *  - "custom": el usuario lo cambió individualmente (edit ad-hoc encima
 *    del preset o del modo). Dot azul. */
export type ArgState = "inherited" | "from-mode" | "custom";

export function ArgField({
  meta,
  value,
  onChange,
  variables,
  argState = "inherited",
  inheritedValue,
  onReset,
}: {
  meta: ArgMetadata;
  value: ArgValue;
  onChange: (v: ArgValue) => void;
  variables: VarInfo[];
  /** Estado visual del arg. Por defecto `inherited`. */
  argState?: ArgState;
  /** Valor del preset (o del modo). Si `argState === "inherited"` y
   *  `value` es undefined/null/"", el control muestra `inheritedValue`
   *  con styling apagado para indicar que es heredado. */
  inheritedValue?: ArgValue;
  /** Si se provee y `argState !== "inherited"`, muestra un botón ↺ que
   *  llama a esta función para resetear el arg al preset/default. */
  onReset?: () => void;
}) {
  // Si el arg está heredado y no tiene valor propio, mostramos el
  // valor del preset en el input pero con styling gris.
  const isInherited = argState === "inherited";
  const hasOwnValue = value !== undefined && value !== null && value !== "";
  const displayValue: ArgValue = hasOwnValue ? value : inheritedValue;

  return (
    <label
      data-arg-state={argState}
      style={{
        display: "flex", flexDirection: "column", gap: 4, marginBottom: 10,
        opacity: isInherited && !hasOwnValue ? 0.78 : 1,
      }}
    >
      <FieldHeader meta={meta} argState={argState} onReset={onReset} />
      <FieldControl meta={meta} value={displayValue} onChange={onChange} variables={variables} />
    </label>
  );
}

// ---- Header con label + tooltip info ------------------------------------

function FieldHeader({ meta, argState, onReset }: { meta: ArgMetadata; argState: ArgState; onReset?: () => void }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const isCustom = argState === "custom";
  const isFromMode = argState === "from-mode";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}>
      <span style={{ fontWeight: 600, color: "var(--pulso-text)" }}>{meta.label}</span>
      {(isCustom || isFromMode) && (
        <span
          title={isCustom ? "Valor custom (azul): tú lo cambiaste sobre el preset/modo" : "Valor del modo (morado): proviene del modo aplicado"}
          aria-label={isCustom ? "Valor custom" : "Valor del modo"}
          style={{
            width: 7, height: 7, borderRadius: 999,
            background: isCustom ? "var(--pulso-primary)" : "#7c3aed",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
      )}
      {meta.descripcion && (
        <span
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "help" }}
        >
          <Info size={11} color="var(--pulso-text-soft)" />
          {showTooltip && (
            <span
              role="tooltip"
              style={{
                position: "absolute",
                left: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)",
                zIndex: 30,
                minWidth: 180, maxWidth: 280,
                padding: "7px 10px",
                background: "var(--pulso-text)",
                color: "white",
                fontSize: 11, fontWeight: 400,
                lineHeight: 1.45,
                borderRadius: 6,
                boxShadow: "var(--pulso-shadow-med)",
                whiteSpace: "normal",
                pointerEvents: "none",
              }}
            >
              {meta.descripcion}
            </span>
          )}
        </span>
      )}
      {(isCustom || isFromMode) && onReset && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); onReset(); }}
          title={isCustom ? "Restaurar al valor del preset" : "Quitar este arg del modo (volver al preset)"}
          aria-label="Restaurar al preset"
          style={{
            marginLeft: "auto",
            display: "inline-flex", alignItems: "center", gap: 3,
            padding: "2px 6px", borderRadius: 4,
            border: "1px solid var(--pulso-border)",
            background: "white",
            color: "var(--pulso-text-soft)",
            fontSize: 10, fontWeight: 500,
            cursor: "pointer",
            transition: "background 120ms, color 120ms",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--pulso-surface-2)";
            e.currentTarget.style.color = "var(--pulso-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "white";
            e.currentTarget.style.color = "var(--pulso-text-soft)";
          }}
        >
          <RotateCcw size={10} />
          preset
        </button>
      )}
    </span>
  );
}

// ---- Control por tipo_input ---------------------------------------------

function FieldControl({
  meta,
  value,
  onChange,
  variables,
}: {
  meta: ArgMetadata;
  value: ArgValue;
  onChange: (v: ArgValue) => void;
  variables: VarInfo[];
}) {
  switch (meta.tipo_input) {
    case "variable":
      return <VariablePicker value={value as string} onChange={(v) => onChange(v ?? "")} />;

    case "variable_opt":
      return <VariablePicker value={value as string} onChange={(v) => onChange(v)} allowEmpty />;

    case "variables_list":
      return <VarsListPicker value={(value as string[]) ?? []} onChange={(v) => onChange(v)} />;

    case "string":
      return (
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={meta.descripcion ? undefined : "(opcional)"}
          style={inputStyle}
        />
      );

    case "textarea":
      return (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
        />
      );

    case "number":
      return <NumberControl meta={meta} value={value} onChange={onChange} />;

    case "bool":
      return <BoolToggle value={!!value} onChange={onChange} />;

    case "choice":
      return <ChoicePills meta={meta} value={value as string} onChange={onChange} />;

    case "codigos_list":
      return <CodigosList value={(value as (string | number)[]) ?? []} onChange={onChange} />;

    case "multiflag":
      // Fallback a texto libre si el registry no trajo opciones — mantiene
      // compat con args antiguos que quedaron declarados como multiflag
      // sin el catálogo cerrado.
      if (!meta.opciones || meta.opciones.length === 0) {
        return <CodigosList value={(value as string[]) ?? []} onChange={onChange} />;
      }
      return (
        <MultiFlag
          opciones={meta.opciones}
          value={(value as string[]) ?? []}
          onChange={onChange}
        />
      );

    case "color":
      return (
        <ColorField
          value={(value as string | null | undefined) ?? ""}
          defaultValue={typeof meta.default === "string" ? meta.default : undefined}
          onChange={onChange}
        />
      );

    case "series_colors":
      return (
        <SeriesColorsField
          value={value}
          defaultValue={meta.default}
          onChange={onChange}
        />
      );

    case "criteria_config":
      return <CriteriaConfigField value={value} onChange={onChange} />;

    case "icono":
      return <IconoSelect value={value as string | null} onChange={onChange} />;

    case "overrides":
    case "filtros":
    case "base_config":
    case "meta":
    default:
      return <DedicatedSurfaceNotice meta={meta} value={value} onChange={onChange} />;
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

function NumberControl({
  meta,
  value,
  onChange,
}: {
  meta: ArgMetadata;
  value: ArgValue;
  onChange: (v: ArgValue) => void;
}) {
  const n = coerceNumber(value);
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
  const [draft, setDraft] = useState(formatNumberInput(value, displayScale));
  const presets = quickPresetsFor(meta.name);
  const controlWidth = displayUnit && String(displayUnit).length > 3 ? 220 : hasSlider ? 260 : 180;
  const unitPadding = displayUnit ? Math.max(46, String(displayUnit).length * 9 + 18) : 8;

  useEffect(() => {
    setDraft(formatNumberInput(value, displayScale));
  }, [displayScale, value]);

  function clamp(next: number | null): number | null {
    if (next === null || !Number.isFinite(next)) return null;
    let out = next;
    if (typeof min === "number") out = Math.max(min, out);
    if (typeof max === "number") out = Math.min(max, out);
    return Number(out.toFixed(decimalsForStep(step)));
  }

  function update(next: number | null) {
    const clamped = clamp(next);
    onChange(clamped);
    setDraft(formatNumberInput(clamped, displayScale));
  }

  function revertDraft() {
    setDraft(formatNumberInput(value, displayScale));
  }

  function commitDraft(raw = draft) {
    const trimmed = raw.trim();
    if (trimmed === "" || isPartialNumberInput(trimmed)) {
      revertDraft();
      return;
    }
    const parsed = parseNumberInput(raw);
    if (parsed === null) {
      revertDraft();
      return;
    }
    update(parsed / displayScale);
  }

  const relatedHint = getRelatedHint(meta.name);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: controlWidth }}>
      <div style={{ display: "flex", alignItems: "stretch", gap: 4 }}>
        <button
          type="button"
          className="pulso-arg-stepper-button"
          onClick={(e) => { e.preventDefault(); update((Number.isFinite(n) ? n : (min ?? 0)) - step); }}
          aria-label={`Disminuir ${meta.label}`}
          style={stepButtonStyle}
        >
          −
        </button>
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={(e) => {
              const raw = e.target.value;
              setDraft(raw);
              if (isPartialNumberInput(raw)) return;
              const parsed = parseNumberInput(raw);
              if (parsed !== null) onChange(clamp(parsed / displayScale));
            }}
            onBlur={() => commitDraft()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitDraft();
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === "Escape") {
                revertDraft();
                (e.target as HTMLInputElement).blur();
              }
            }}
            style={{
              ...inputStyle,
              width: "100%",
              paddingRight: unitPadding,
              fontVariantNumeric: "tabular-nums",
            }}
          />
          {displayUnit && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 10,
                color: "var(--pulso-text-soft)",
                pointerEvents: "none",
              }}
            >
              {displayUnit}
            </span>
          )}
        </div>
        <button
          type="button"
          className="pulso-arg-stepper-button"
          onClick={(e) => { e.preventDefault(); update((Number.isFinite(n) ? n : (min ?? 0)) + step); }}
          aria-label={`Aumentar ${meta.label}`}
          style={stepButtonStyle}
        >
          +
        </button>
      </div>

      {hasSlider && (
        <input
          className="pulso-arg-range"
          type="range"
          value={Number.isFinite(n) ? n * displayScale : displayMin}
          min={displayMin}
          max={displayMax}
          step={displayStep}
          onChange={(e) => update(Number(e.target.value) / displayScale)}
          aria-label={`${meta.label} fino`}
          style={{ width: "100%", accentColor: "var(--pulso-primary)" }}
        />
      )}

      {presets.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {presets.map((preset) => (
            <button
              key={`${preset.label}-${preset.value}`}
              type="button"
              className="pulso-arg-preset-button"
              onClick={(e) => { e.preventDefault(); update(preset.value); }}
              style={{
                padding: "3px 7px",
                borderRadius: 999,
                border: "1px solid var(--pulso-border)",
                background: "white",
                color: "var(--pulso-text-soft)",
                fontSize: 10.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {(meta.efecto || relatedHint) && (
        <span style={{ fontSize: 10.5, color: "var(--pulso-text-soft)", lineHeight: 1.35 }}>
          {meta.efecto}
          {meta.efecto && relatedHint ? " " : ""}
          {relatedHint}
        </span>
      )}
    </div>
  );
}

function coerceNumber(value: ArgValue): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

function formatNumberInput(value: ArgValue, scale = 1): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(Number((value * scale).toFixed(6)));
  if (typeof value === "string") {
    const parsed = parseNumberInput(value);
    if (parsed !== null) return String(Number((parsed * scale).toFixed(6)));
    return value;
  }
  return "";
}

function parseNumberInput(value: string): number | null {
  const clean = value.trim().replace(",", ".");
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPartialNumberInput(value: string): boolean {
  const clean = value.trim();
  return (
    clean === "" ||
    clean === "-" ||
    clean === "+" ||
    clean === "." ||
    clean === "," ||
    /^[-+]?\d+[.,]$/.test(clean)
  );
}

function decimalsForStep(step: number): number {
  const s = String(step);
  const dot = s.indexOf(".");
  return dot >= 0 ? Math.min(6, s.length - dot - 1) : 0;
}

function inferNumberStep(meta: ArgMetadata, value: ArgValue): number {
  if (typeof meta.step === "number" && meta.step > 0) return meta.step;

  const fromText = typeof value === "string" ? value.trim() : "";
  const decimalMatch = fromText.match(/[.,](\d+)/);
  if (decimalMatch) {
    const decimals = Math.min(4, decimalMatch[1].length);
    return Math.pow(10, -decimals);
  }

  const n = coerceNumber(value);
  const min = typeof meta.min === "number" ? meta.min : undefined;
  const max = typeof meta.max === "number" ? meta.max : undefined;
  const span = typeof min === "number" && typeof max === "number" ? max - min : NaN;
  const unit = String(meta.unidad ?? "").toLowerCase();
  const name = String(meta.name ?? "").toLowerCase();

  if (isProportionThreshold(meta)) return 0.0001;
  if (unit.includes("propor") || name.startsWith("canvas_w_")) return 0.01;
  if (unit.includes("pulgada") || name.endsWith("_in") || name.includes("_in_")) return 0.02;
  if (Number.isFinite(span) && span > 0 && span <= 2) return 0.01;
  if (Number.isFinite(n) && Math.abs(n) > 0 && Math.abs(n) < 1) return 0.01;
  if (Number.isFinite(n) && !Number.isInteger(n)) return 0.1;

  return 1;
}

function isProportionThreshold(meta: ArgMetadata): boolean {
  const name = String(meta.name ?? "").toLowerCase();
  return (name.startsWith("umbral_") || name.includes("_umbral_")) && !name.endsWith("_pct");
}

function getRelatedHint(name: string): string | null {
  if (name === "canvas_w_etiquetas") {
    return "Si el texto sigue partido, sube también el ancho de texto de etiquetas.";
  }
  if (name === "ancho_max_eje_y" || name === "wrap_y") {
    return "Trabaja junto con el espacio para etiquetas.";
  }
  if ((name.startsWith("umbral_") || name.includes("_umbral_")) && !name.endsWith("_pct")) {
    return "Está en porcentaje visible: escribe 0.05 para 0.05%.";
  }
  return null;
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
        style={{
          width: 24, height: 12, borderRadius: 999,
          background: value ? "var(--pulso-primary)" : "var(--pulso-border)",
          position: "relative",
          transition: "background 120ms ease",
        }}
      >
        <span
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
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {choices.map((c) => {
        const active = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            title={c.hint}
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
            {c.label}
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
  return (
    <input
      type="text"
      value={text}
      onChange={(e) => {
        const parts = e.target.value.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
        onChange(parts);
      }}
      placeholder="ej. 88, 90, 96"
      style={inputStyle}
    />
  );
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
    const base = visibleRows.length > 0 ? visibleRows : [["Serie", "#39588B"] as [string, string]];
    const next = base.map(([n, c], i) => [i === index ? name : n, c] as [string, string]);
    emit(next);
  }

  function updateColor(index: number, color: string | null) {
    const base = visibleRows.length > 0 ? visibleRows : [["Serie", "#39588B"] as [string, string]];
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
    emit([...visibleRows, [name, COLOR_PRESETS[(visibleRows.length + 6) % COLOR_PRESETS.length].value]]);
  }

  function applySuggested() {
    const names = visibleRows.length > 0 ? visibleRows.map(([name]) => name) : ["Serie 1", "Serie 2", "Serie 3"];
    const palette = ["#39588B", "#0B3A67", "#00BFC4", "#F8766D", "#7CAE00", "#C77CFF"];
    emit(names.map((name, i) => [name, palette[i % palette.length]] as [string, string]));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 460 }}>
      {visibleRows.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--pulso-border)",
            borderRadius: 8,
            background: "var(--pulso-surface)",
            padding: 10,
            fontSize: 11,
            color: "var(--pulso-text-soft)",
          }}
        >
          Sin colores personalizados. Se usará la paleta del gráfico.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {showingInherited && (
            <span style={{ fontSize: 10.5, color: "var(--pulso-text-soft)" }}>
              Valores heredados del preset. Edita una fila para personalizarlos.
            </span>
          )}
          {visibleRows.map(([name, color], index) => (
            <div
              key={`${name}-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(140px, 1fr) minmax(180px, 220px) 28px",
                gap: 8,
                alignItems: "start",
              }}
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
                style={{ minWidth: 28, minHeight: 28 }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button
          type="button"
          className="pulso-arg-preset-button"
          onClick={(e) => { e.preventDefault(); addRow(); }}
          style={seriesButtonStyle}
        >
          <Plus size={12} /> Agregar serie
        </button>
        <button
          type="button"
          className="pulso-arg-preset-button"
          onClick={(e) => { e.preventDefault(); applySuggested(); }}
          style={seriesButtonStyle}
        >
          <Palette size={12} /> Paleta sugerida
        </button>
        {(rows.length > 0 || showingInherited) && (
          <button
            type="button"
            className="pulso-arg-preset-button"
            onClick={(e) => { e.preventDefault(); onChange(null); }}
            style={seriesButtonStyle}
          >
            <RotateCcw size={12} /> Usar preset
          </button>
        )}
      </div>
    </div>
  );
}

const seriesButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 9px",
  borderRadius: 7,
  border: "1px solid var(--pulso-border)",
  background: "white",
  color: "var(--pulso-text)",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};

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
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
      {items.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--pulso-border)",
            borderRadius: 8,
            background: "var(--pulso-surface)",
            padding: 10,
            fontSize: 11,
            color: "var(--pulso-text-soft)",
          }}
        >
          Agrega criterios y asigna variables a cada uno.
        </div>
      ) : (
        items.map((item, index) => (
          <div
            key={`${item.id ?? item.titulo}-${index}`}
            style={{
              border: "1px solid var(--pulso-border)",
              borderRadius: 8,
              background: "white",
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 28px", gap: 8, alignItems: "center" }}>
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
                style={{ minWidth: 28, minHeight: 28 }}
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
        style={{ ...seriesButtonStyle, alignSelf: "flex-start" }}
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
    const titulo = String(obj.titulo ?? obj.title ?? obj.label ?? fallbackTitle).trim();
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        style={{ ...inputStyle, padding: "5px 8px" }}
      >
        <option value="">(ninguno)</option>
        {iconos.map((ic) => (
          <option key={ic.id} value={ic.id}>
            {ic.nombre}
          </option>
        ))}
      </select>
      {selected && (
        <div
          style={{
            marginTop: 4, padding: 6,
            background: "var(--pulso-surface)",
            border: "1px solid var(--pulso-border)",
            borderRadius: 5,
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <img
            src={downloadUrl(selected.file_id)}
            alt={selected.nombre}
            style={{ width: 34, height: 34, objectFit: "contain" }}
          />
          <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>{selected.nombre}</span>
        </div>
      )}
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
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 6,
        border: "1px dashed var(--pulso-border)",
        background: "var(--pulso-surface)",
        fontSize: 11,
        color: "var(--pulso-text-soft)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Info size={12} />
      <span style={{ flex: 1 }}>
        {surfaceLabel(meta.tipo_input)}
      </span>
      {hasValue && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onChange(meta.tipo_input === "overrides" || meta.tipo_input === "filtros" || meta.tipo_input === "base_config" ? {} : null);
          }}
          style={{ fontSize: 10, padding: "3px 7px", color: "#991b1b" }}
        >
          Limpiar
        </button>
      )}
    </div>
  );
}

function surfaceLabel(tipo: string): string {
  if (tipo === "filtros") return "Se configura desde la pestaña Filtros.";
  if (tipo === "overrides") return "Se configura desde Modo o Estilo del gráfico.";
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
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {opciones.map((opt) => {
        const on = set.has(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            role="switch"
            aria-checked={on}
            title={opt.hint}
            onClick={() => toggle(opt.value)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 999,
              border: `1px solid ${on ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
              background: on ? "var(--pulso-primary-soft)" : "white",
              color: on ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
              fontSize: 11, fontWeight: on ? 700 : 500,
              cursor: "pointer",
              transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
            }}
          >
            {on && (
              <span
                aria-hidden="true"
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "var(--pulso-primary)",
                  display: "inline-block",
                }}
              />
            )}
            {opt.label}
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
  { value: "#000000", label: "Negro" },
  { value: "#222222", label: "Casi negro" },
  { value: "#555555", label: "Gris oscuro" },
  { value: "#888888", label: "Gris medio" },
  { value: "#BBBBBB", label: "Gris claro" },
  { value: "#FFFFFF", label: "Blanco" },
  { value: "#002457", label: "Azul Prosecnur" },
  { value: "#0B3A67", label: "Azul profundo" },
  { value: "#39588B", label: "Azul acero" },
  { value: "#B33A3A", label: "Rojo" },
  { value: "#2E7D32", label: "Verde" },
  { value: "#F5A623", label: "Ámbar" },
];

// Palabras clave CSS que los graficadores R también aceptan y que no
// tienen representación hex — se muestran como chip literal en vez
// de swatch.
const COLOR_KEYWORDS = ["transparent", "white", "black"];

function isValidColor(v: string): boolean {
  if (!v) return true; // vacío = hereda
  if (COLOR_KEYWORDS.includes(v.toLowerCase())) return true;
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim());
}

// Normaliza shorthand (#abc → #aabbcc) y keyword → hex, para que el
// <input type="color"> nativo siempre reciba un hex de 7 chars.
function toHex7(v: string): string {
  const s = (v || "").trim().toLowerCase();
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

function ColorField({
  value, defaultValue, onChange,
}: {
  value: string;
  defaultValue?: string;
  onChange: (v: string | null) => void;
}) {
  const paletas = usePlanStore((s) => s.paletas);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  // Sync draft con prop externo (ej. al cambiar de preset seleccionado).
  useEffect(() => { setDraft(value); }, [value]);

  // Click fuera → cerrar popover.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function commit(v: string | null) {
    const clean = v == null ? null : v.trim();
    if (clean === "" || clean == null) onChange(null);
    else onChange(clean);
    setDraft(clean ?? "");
  }

  function pickSwatch(hex: string) {
    commit(hex);
    setOpen(false);
  }

  const effective = value || defaultValue || "";
  const valid = isValidColor(draft);

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
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 8, width: "min(100%, 360px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        {/* Swatch clickeable */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="Elegir color"
          style={{
            width: 28, height: 28, borderRadius: 6,
            border: "1px solid var(--pulso-border)",
            background:
              effective && effective !== "transparent"
                ? effective
                : "repeating-linear-gradient(45deg, #eee 0 4px, #fff 4px 8px)",
            cursor: "pointer", padding: 0, flexShrink: 0,
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.4)",
          }}
          aria-label="Abrir selector de color"
        />
        {/* Input hex con validación visual */}
        <input
          type="text"
          value={draft}
          placeholder={defaultValue || "#RRGGBB o 'white'"}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { commit(draft); (e.target as HTMLInputElement).blur(); }
            if (e.key === "Escape") { setDraft(value); (e.target as HTMLInputElement).blur(); }
          }}
          style={{
            ...inputStyle,
            width: 150,
            minWidth: 0,
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            borderColor: valid ? "var(--pulso-border)" : "#f59f9f",
            background: valid ? "white" : "#fef7f7",
          }}
        />
        {draft && (
          <button
            type="button"
            onClick={() => commit(null)}
            className="pulso-icon"
            aria-label="Borrar color (heredar)"
            title="Borrar (hereda del preset padre)"
            style={{ padding: 3, minWidth: 22, minHeight: 22 }}
          >
            <XIcon size={11} />
          </button>
        )}
      </div>

      {open && (
        <div
          style={{
            width: "100%",
            maxHeight: 260,
            overflowY: "auto",
            background: "white",
            border: "1px solid var(--pulso-border)",
            borderRadius: 8,
            boxShadow: "var(--pulso-shadow-med)",
            padding: 10,
            display: "flex", flexDirection: "column", gap: 10,
          }}
        >
          {/* Presets comunes */}
          <PopoverSection icon={<Palette size={11} />} label="Comunes">
            <SwatchRow colors={COLOR_PRESETS} active={effective} onPick={pickSwatch} />
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
                      active={effective}
                      onPick={pickSwatch}
                    />
                  </div>
                ))}
              </div>
            </PopoverSection>
          )}

          {/* Color wheel nativo + keywords */}
          <PopoverSection icon={<Pipette size={11} />} label="Personalizado">
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <label
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 11, cursor: "pointer",
                }}
              >
                <input
                  type="color"
                  value={toHex7(draft || effective)}
                  onChange={(e) => commit(e.target.value)}
                  style={{
                    width: 28, height: 28, padding: 0,
                    border: "1px solid var(--pulso-border)",
                    borderRadius: 6, cursor: "pointer",
                  }}
                />
                Abrir rueda
              </label>
              {COLOR_KEYWORDS.map((kw) => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => pickSwatch(kw)}
                  style={{
                    fontSize: 10, padding: "3px 8px", borderRadius: 999,
                    border: `1px solid ${effective === kw ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                    background: effective === kw ? "var(--pulso-primary-soft)" : "white",
                    color: effective === kw ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
                    fontFamily: "ui-monospace, monospace",
                    cursor: "pointer",
                  }}
                >
                  {kw}
                </button>
              ))}
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
    <section style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <h5
        style={{
          margin: 0, fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: 0.4,
          color: "var(--pulso-text-soft)",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}
      >
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
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {colors.map((c) => {
        const isActive = active.toLowerCase() === c.value.toLowerCase();
        return (
          <button
            key={c.value + c.label}
            type="button"
            onClick={() => onPick(c.value)}
            title={`${c.label} · ${c.value}`}
            style={{
              width: 22, height: 22, borderRadius: 5,
              background: c.value,
              border: isActive
                ? "2px solid var(--pulso-primary)"
                : "1px solid var(--pulso-border)",
              boxShadow: isActive
                ? "0 0 0 2px var(--pulso-primary-soft)"
                : "inset 0 0 0 1px rgba(255,255,255,0.35)",
              cursor: "pointer", padding: 0,
              transition: "transform 120ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          />
        );
      })}
    </div>
  );
}
