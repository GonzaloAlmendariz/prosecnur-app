// =============================================================================
// inspector/TypePicker.tsx — selector visual de tipo de pregunta
// =============================================================================
// Reemplaza al `<select>` del inspector legacy. Muestra una grilla de
// "tarjetitas" agrupadas por familia (Selección, Texto, Numérico, Fecha,
// Estructura, Multimedia, Geo, Auto-meta) con icono + label.
//
// Flujo:
//   - El usuario abre un popover desde el botón principal (chip del tipo
//     actual) → ve la grilla → click selecciona y cierra.
//   - Hay un input de búsqueda arriba para filtrar por nombre.
//
// La lista incluye TODOS los tipos del corpus (ESPP, RMS, HST, GIZ),
// incluyendo los multimedia y geo que no estaban en el monolito.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { iconForType } from "../helpers/icons";
import { paletteForType, paletteSoftForType } from "../helpers/paletteForType";
import { typeLabel } from "../parsing/parseType";

type TypeFamily = {
  id: string;
  label: string;
  hint: string;
  types: string[];
};

const TYPE_FAMILIES: TypeFamily[] = [
  {
    id: "select",
    label: "Selección",
    hint: "El encuestado elige entre opciones",
    types: ["select_one", "select_multiple"],
  },
  {
    id: "text",
    label: "Texto",
    hint: "Respuestas libres en palabras",
    types: ["text", "note"],
  },
  {
    id: "number",
    label: "Numérico",
    hint: "Respuestas en números",
    types: ["integer", "decimal"],
  },
  {
    id: "datetime",
    label: "Fecha y hora",
    hint: "Cuándo ocurrió algo",
    types: ["date", "time", "datetime"],
  },
  {
    id: "media",
    label: "Multimedia",
    hint: "Foto, audio, video, archivo",
    types: ["image", "audio", "video", "file", "barcode"],
  },
  {
    id: "geo",
    label: "Ubicación",
    hint: "Punto, recorrido o área",
    types: ["geopoint", "geotrace", "geoshape"],
  },
  {
    id: "structure",
    label: "Estructura",
    hint: "Agrupar o repetir preguntas",
    types: ["begin_group", "begin_repeat"],
  },
  {
    id: "auto",
    label: "Automáticos",
    hint: "Se completan solos",
    types: ["calculate", "acknowledge", "hidden", "start", "end", "today", "deviceid", "username"],
  },
];

export type TypePickerProps = {
  value: string;
  onChange: (next: string) => void;
  /** Si true, el control está deshabilitado (ej. la selección es una sección root). */
  disabled?: boolean;
};

export function TypePicker({ value, onChange, disabled }: TypePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Click-outside cierra el popover.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onMouseDown);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const accent = paletteForType(value);
  const accentSoft = paletteSoftForType(value);
  const Icon = iconForType(value);
  const label = typeLabel(value) || "Sin tipo";

  const normalizedQuery = query.trim().toLowerCase();

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="pulso-typepicker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className="pulso-typepicker-trigger-icon"
          style={{ color: accent, background: accentSoft }}
        >
          <Icon size={14} />
        </span>
        <span className="pulso-typepicker-trigger-label">{label}</span>
        <ChevronDown size={14} style={{ color: "var(--pulso-text-soft)" }} />
      </button>

      {open && (
        <div className="pulso-typepicker-pop" role="listbox">
          <div className="pulso-typepicker-search">
            <Search size={13} style={{ color: "var(--pulso-text-soft)" }} />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar tipo..."
              spellCheck={false}
            />
          </div>

          <div className="pulso-typepicker-list">
            {TYPE_FAMILIES.map((family) => {
              const matches = family.types.filter((t) => {
                if (!normalizedQuery) return true;
                return (
                  t.toLowerCase().includes(normalizedQuery) ||
                  typeLabel(t).toLowerCase().includes(normalizedQuery)
                );
              });
              if (!matches.length) return null;

              return (
                <div key={family.id} className="pulso-typepicker-family">
                  <div className="pulso-typepicker-family-header">
                    <strong>{family.label}</strong>
                    <span>{family.hint}</span>
                  </div>
                  <div className="pulso-typepicker-grid">
                    {matches.map((type) => {
                      const TIcon = iconForType(type);
                      const tAccent = paletteForType(type);
                      const tAccentSoft = paletteSoftForType(type);
                      const isCurrent = type === value;
                      return (
                        <button
                          key={type}
                          type="button"
                          className={`pulso-typepicker-item ${isCurrent ? "is-active" : ""}`}
                          onClick={() => {
                            onChange(type);
                            setOpen(false);
                            setQuery("");
                          }}
                          style={{
                            ["--type-accent" as string]: tAccent,
                            ["--type-accent-soft" as string]: tAccentSoft,
                          }}
                          aria-selected={isCurrent}
                          role="option"
                        >
                          <span
                            className="pulso-typepicker-item-icon"
                            style={{ color: tAccent, background: tAccentSoft }}
                          >
                            <TIcon size={14} />
                          </span>
                          <span className="pulso-typepicker-item-label">{typeLabel(type)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
