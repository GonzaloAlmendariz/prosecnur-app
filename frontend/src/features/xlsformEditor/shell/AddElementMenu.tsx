// Menú «Añadir elemento» del Constructor. Extraído de XlsformEditorPage.tsx — refactor puro, revamp 2026-10-16.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ListChecks, X } from "lucide-react";
import { IconSearch } from "../../../lib/icons";
import type { AddMenuItem } from "../types";
import { MaquetaTipo } from "../kit";

// M6 (2026-10-17): la maqueta de cómo se ve cada tipo en vez del ícono suelto. La evidencia (foto, audio, video,
// archivo, código) tiene su dibujo propio desde M8 (catálogo único del kit).
const MAQUETA_DE: Partial<Record<string, string>> = {
  text: "text", integer: "integer", decimal: "decimal", date: "date", select_one: "select_one", select_multiple: "select_multiple",
  image: "image", audio: "audio", video: "video", file: "file", barcode: "barcode",
  geopoint: "geopoint", note: "note", calculate: "calculate", section: "begin_group", section_end: "end_group",
};

export function AddElementMenu({
  items,
  anchorElement,
  onClose,
  destino,
}: {
  items: AddMenuItem[];
  anchorElement: HTMLElement | null;
  onClose: () => void;
  /** Dónde cae la pieza («Se agrega debajo de «…»»). Opcional: sin él, el menú se ve como siempre. */
  destino?: string;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<"all" | NonNullable<AddMenuItem["group"]>>("all");
  const groups = [
    { id: "choices", label: "Con opciones" },
    { id: "capture", label: "Texto y captura" },
    { id: "evidence", label: "Evidencia y ubicación" },
    { id: "logic", label: "Estructura y lógica" },
  ] as const;
  const normalizedQuery = normalizeAddMenuSearch(query);
  const visibleItems = items.filter((item) => {
    const groupMatches = activeGroup === "all" || item.group === activeGroup;
    if (!groupMatches) return false;
    if (!normalizedQuery) return true;
    const descriptor = describeAddMenuItem(item);
    return normalizeAddMenuSearch([
      item.label,
      item.hint,
      descriptor.tag,
      ...descriptor.searchTerms,
    ].join(" ")).includes(normalizedQuery);
  });

  useLayoutEffect(() => {
    menuRef.current?.querySelector<HTMLInputElement>(".pulso-add-element-menu-search")?.focus();
  }, []);

  useEffect(() => {
    const menuButtons = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>(".pulso-add-element-menu-item") ?? []);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        anchorElement?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") return;
      const buttons = menuButtons();
      if (!buttons.length) return;
      const activeIndex = buttons.findIndex((button) => button === document.activeElement);
      if (event.key === "Enter" && activeIndex < 0) {
        if (!normalizedQuery) return;
        event.preventDefault();
        buttons[0]?.click();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const fallbackIndex = event.key === "ArrowDown" ? -1 : 0;
      const index = activeIndex >= 0 ? activeIndex : fallbackIndex;
      const nextIndex = event.key === "ArrowDown"
        ? (index + 1) % buttons.length
        : (index - 1 + buttons.length) % buttons.length;
      buttons[nextIndex]?.focus();
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (anchorElement?.contains(target)) return;
      onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [anchorElement, normalizedQuery, onClose]);

  const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const menuWidth = Math.min(980, viewportWidth - 36);
  const menuHeight = Math.min(820, viewportHeight - 72);
  const style = {
    "--pulso-add-menu-width": `${menuWidth}px`,
    "--pulso-add-menu-height": `${menuHeight}px`,
  } as CSSProperties;

  return createPortal((
    <>
    <button
      type="button"
      className="pulso-add-element-menu-scrim"
      aria-label="Cerrar selector de piezas"
      onClick={() => {
        onClose();
        anchorElement?.focus();
      }}
    />
    <div
      ref={menuRef}
      className="pulso-add-element-menu"
      style={style}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pulso-add-element-menu-title"
      aria-describedby={destino ? "pulso-add-element-menu-destino" : undefined}
    >
      <div className="pulso-add-element-menu-head">
        <span className="pulso-add-element-menu-mark" aria-hidden="true">
          <ListChecks size={14} />
        </span>
        <span className="pulso-add-element-menu-head-copy">
          <strong id="pulso-add-element-menu-title">Añadir pieza al formulario</strong>
          {destino ? (
            <small id="pulso-add-element-menu-destino" className="pulso-add-element-menu-destino" data-destino="">{destino}</small>
          ) : (
            <small>Busca por tipo, evidencia, lógica o lista; Enter aplica la opción enfocada.</small>
          )}
        </span>
        <button
          type="button"
          className="pulso-add-element-menu-close"
          onClick={() => {
            onClose();
            anchorElement?.focus();
          }}
          aria-label="Cerrar selector de piezas"
          title="Cerrar"
        >
          <X size={15} />
        </button>
      </div>
      <div className="pulso-add-element-menu-tools">
        <label className="pulso-add-element-menu-searchbox">
          <IconSearch size={14} aria-hidden="true" />
          <input
            className="pulso-add-element-menu-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Buscar: selección, GPS, cálculo, sección..."
            aria-label="Buscar tipo de pieza"
          />
        </label>
        <div className="pulso-add-element-menu-filters" aria-label="Filtrar familias de piezas">
          <button
            type="button"
            className={activeGroup === "all" ? "is-active" : ""}
            onClick={() => setActiveGroup("all")}
          >
            Todo <span>{items.length}</span>
          </button>
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={activeGroup === group.id ? "is-active" : ""}
              onClick={() => setActiveGroup(group.id)}
            >
              {group.label} <span>{items.filter((item) => item.group === group.id).length}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="pulso-add-element-menu-body">
        {groups.map((group) => {
          const groupItems = visibleItems.filter((item) => item.group === group.id);
          if (!groupItems.length) return null;
          return (
            <div key={group.id} className={`pulso-add-element-menu-group${group.id === "choices" ? " is-primary" : ""}`}>
              <span className="pulso-add-element-menu-group-title">{group.label}</span>
              <div className="pulso-add-element-menu-group-grid">
                {groupItems.map((item) => {
                  const descriptor = describeAddMenuItem(item);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        item.action();
                        onClose();
                      }}
                      className={`pulso-add-element-menu-item is-${descriptor.tone}`}
                    >
                      <span className={MAQUETA_DE[item.key] ? "pulso-add-element-menu-maqueta" : "pulso-add-element-menu-icon"}>
                        {MAQUETA_DE[item.key] ? <MaquetaTipo baseType={MAQUETA_DE[item.key]!} ancho={54} /> : item.icon}
                      </span>
                      <span className="pulso-add-element-menu-copy">
                        <span className="pulso-add-element-menu-item-topline">
                          <strong>{item.label}</strong>
                          <span className="pulso-add-element-menu-chip">{descriptor.tag}</span>
                        </span>
                        <span>{item.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!visibleItems.length && (
          <div className="pulso-add-element-menu-empty">
            <IconSearch size={17} aria-hidden="true" />
            <strong>Sin piezas con ese filtro</strong>
            <span>Prueba con “selección”, “GPS”, “archivo”, “cálculo” o limpia la búsqueda.</span>
          </div>
        )}
      </div>
      <div className="pulso-add-element-menu-footer" aria-label="Atajos del selector">
        <span>Flechas navegan</span>
        <span>Enter añade la opción enfocada</span>
        <span>Esc cierra</span>
      </div>
    </div>
    </>
  ), document.body);
}

export function normalizeAddMenuSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function describeAddMenuItem(item: AddMenuItem): {
  tag: string;
  tone: "choice" | "capture" | "evidence" | "logic";
  searchTerms: string[];
} {
  switch (item.key) {
    case "select_one":
      return {
        tag: "Lista de opciones",
        tone: "choice",
        searchTerms: ["catalogo", "kobo", "opciones", "radio", "unica"],
      };
    case "select_multiple":
      return {
        tag: "Lista de opciones",
        tone: "choice",
        searchTerms: ["catalogo", "kobo", "opciones", "multiple", "checkbox"],
      };
    case "section":
      return {
        tag: "Inicio + cierre",
        tone: "logic",
        searchTerms: ["grupo", "seccion", "begin", "abrir", "bloque"],
      };
    case "section_end":
      return {
        tag: "Solo cierre",
        tone: "logic",
        searchTerms: ["grupo", "seccion", "end", "cerrar", "cierre", "bloque"],
      };
    case "note":
      return {
        tag: "Sin respuesta",
        tone: "logic",
        searchTerms: ["nota", "instruccion", "texto informativo"],
      };
    case "calculate":
      return {
        tag: "Automático",
        tone: "logic",
        searchTerms: ["calculo", "formula", "variable"],
      };
    case "image":
      return {
        tag: "Evidencia",
        tone: "evidence",
        searchTerms: ["foto", "imagen", "camara", "evidencia"],
      };
    case "audio":
      return {
        tag: "Evidencia",
        tone: "evidence",
        searchTerms: ["audio", "voz", "sonido", "evidencia"],
      };
    case "video":
      return {
        tag: "Evidencia",
        tone: "evidence",
        searchTerms: ["video", "audiovisual", "evidencia"],
      };
    case "file":
      return {
        tag: "Evidencia",
        tone: "evidence",
        searchTerms: ["archivo", "adjunto", "documento", "evidencia"],
      };
    case "barcode":
      return {
        tag: "Lectura",
        tone: "evidence",
        searchTerms: ["codigo", "barras", "qr", "lectura", "scanner"],
      };
    case "geopoint":
      return {
        tag: "Ubicación",
        tone: "evidence",
        searchTerms: ["gps", "ubicacion", "geopoint", "punto", "coordenada"],
      };
    case "integer":
    case "decimal":
      return {
        tag: "Número",
        tone: "capture",
        searchTerms: ["numero", "edad", "cantidad", "monto", "rango"],
      };
    case "date":
      return {
        tag: "Fecha",
        tone: "capture",
        searchTerms: ["fecha", "calendario", "dia"],
      };
    default:
      return {
        tag: "Campo",
        tone: "capture",
        searchTerms: ["texto", "respuesta", "pregunta"],
      };
  }
}

// =============================================================================
// Helpers añadidos en Sub-PR 2 (estado + autosave + undo/redo)
// =============================================================================
