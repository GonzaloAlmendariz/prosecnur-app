// =============================================================================
// inspector/AppearancePicker.tsx — pills de apariencia según el tipo
// =============================================================================
// XLSForm permite un campo `appearance` (string libre) que controla cómo se
// renderiza el control en ODK Collect. Cada tipo tiene un set propio de
// apariencias estándar:
//   - select_one: minimal, autocomplete, likert, columns-N, quick, …
//   - text: multiline, numbers, url, ear, signature, …
//   - integer: bearing, thousands-sep, …
//   - date: month-year, year, no-calendar, …
//
// Este componente muestra esas apariencias como pills clickeables (toggle).
// Combinaciones (ej. "minimal autocomplete") están permitidas — el campo
// se almacena como string concatenado con espacios. También hay un input
// libre para apariencias custom no listadas.
// =============================================================================

import { useMemo } from "react";

type AppearancePreset = {
  value: string;
  label: string;
  hint?: string;
};

const PRESETS_BY_TYPE: Record<string, AppearancePreset[]> = {
  select_one: [
    { value: "minimal", label: "Minimal", hint: "Dropdown compacto" },
    { value: "autocomplete", label: "Autocomplete", hint: "Búsqueda en lista larga" },
    { value: "likert", label: "Likert", hint: "Escala visual" },
    { value: "columns-2", label: "2 columnas" },
    { value: "columns-3", label: "3 columnas" },
    { value: "quick", label: "Quick", hint: "Avanza al seleccionar" },
    { value: "no-buttons", label: "Sin botones" },
    { value: "label", label: "Solo label" },
  ],
  select_multiple: [
    { value: "minimal", label: "Minimal" },
    { value: "autocomplete", label: "Autocomplete" },
    { value: "columns-2", label: "2 columnas" },
    { value: "columns-3", label: "3 columnas" },
    { value: "no-buttons", label: "Sin botones" },
  ],
  text: [
    { value: "multiline", label: "Multilínea", hint: "Textarea grande" },
    { value: "numbers", label: "Solo números" },
    { value: "url", label: "URL" },
    { value: "ear", label: "Reconocimiento de voz" },
    { value: "signature", label: "Firma" },
  ],
  integer: [
    { value: "bearing", label: "Brújula" },
    { value: "thousands-sep", label: "Separador miles" },
  ],
  decimal: [
    { value: "thousands-sep", label: "Separador miles" },
  ],
  date: [
    { value: "month-year", label: "Mes y año" },
    { value: "year", label: "Solo año" },
    { value: "no-calendar", label: "Sin calendario" },
  ],
  begin_group: [
    { value: "field-list", label: "Field-list", hint: "Todas las preguntas en una pantalla" },
    { value: "table-list", label: "Table-list", hint: "Tabla con columnas" },
  ],
  begin_repeat: [
    { value: "field-list", label: "Field-list" },
  ],
  image: [
    { value: "draw", label: "Dibujar" },
    { value: "annotate", label: "Anotar" },
    { value: "new", label: "Nueva (no galería)" },
  ],
};

export type AppearancePickerProps = {
  baseType: string;
  value: string;
  onChange: (next: string) => void;
};

export function AppearancePicker({ baseType, value, onChange }: AppearancePickerProps) {
  const presets = PRESETS_BY_TYPE[baseType] ?? [];
  const tokens = useMemo(() => parseAppearance(value), [value]);

  const togglePreset = (preset: string) => {
    const has = tokens.includes(preset);
    let nextTokens: string[];
    if (has) {
      nextTokens = tokens.filter((t) => t !== preset);
    } else {
      // Si el preset es "columns-X", removemos otros "columns-*" para evitar
      // combinaciones absurdas.
      const cleaned = preset.startsWith("columns-")
        ? tokens.filter((t) => !t.startsWith("columns-"))
        : tokens;
      nextTokens = [...cleaned, preset];
    }
    onChange(nextTokens.join(" "));
  };

  if (!presets.length) {
    return (
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Apariencia (opcional)"
        spellCheck={false}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {presets.map((preset) => {
          const active = tokens.includes(preset.value);
          return (
            <button
              key={preset.value}
              type="button"
              className={`pulso-appearance-pill ${active ? "is-active" : ""}`}
              onClick={() => togglePreset(preset.value)}
              title={preset.hint ?? preset.label}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Apariencia personalizada (opcional)"
        spellCheck={false}
        style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}
      />
    </div>
  );
}

function parseAppearance(value: string): string[] {
  return (value ?? "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}
