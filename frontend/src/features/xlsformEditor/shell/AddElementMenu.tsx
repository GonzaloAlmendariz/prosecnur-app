// Menú «Añadir elemento» del Constructor. Extraído de XlsformEditorPage.tsx — refactor puro, revamp 2026-10-16.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ListChecks, X } from "lucide-react";
import { IconSearch } from "../../../lib/icons";
import type { AddMenuItem } from "../types";
import { Sello } from "../kit";
import { agruparAlta, baseDeClave } from "./familiasAlta";
import "./addElementMenu.css";

// 2026-10-20: cada tipo con su sello solo (sin recuadro), agrupado por familia con un rótulo chico (familiasAlta.ts).

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
  const normalizedQuery = normalizeAddMenuSearch(query);
  const visibleItems = items.filter((item) => {
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
      if (activeIndex < 0 && event.key === "ArrowUp") return;
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
  const menuWidth = Math.min(820, viewportWidth - 36);
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
      className="pulso-add-element-menu xfe-alta"
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
      </div>
      <div className="pulso-add-element-menu-body xfe-alta__cuerpo">
        {agruparAlta(visibleItems).map((grupo) => (
          <section key={grupo.id} className="xfe-alta__grupo" aria-labelledby={`xfe-alta-${grupo.id}`}>
            <h4 id={`xfe-alta-${grupo.id}`} className="xfe-alta__rotulo">{grupo.nombre}</h4>
            <div className="xfe-alta__lista">
              {grupo.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  className="pulso-add-element-menu-item xfe-alta__item"
                >
                  <Sello baseType={baseDeClave(item.key)} size={24} />
                  <span className="xfe-alta__texto">
                    <strong>{item.label}</strong>
                    <span>{item.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {!visibleItems.length && (
          <div className="pulso-add-element-menu-empty">
            <IconSearch size={17} aria-hidden="true" />
            <strong>Sin piezas con ese filtro</strong>
            <span>Prueba con “selección”, “GPS”, “archivo”, “cálculo” o limpia la búsqueda.</span>
          </div>
        )}
      </div>
      <div className="pulso-add-element-menu-footer" aria-label="Atajos del selector">
        <span>↑↓ recorre</span>
        <span>Enter añade</span>
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
    case "repeat":
      return {
        tag: "Inicio + cierre",
        tone: "logic",
        searchTerms: ["repeticion", "repeat", "repetir", "miembros", "registro", "bucle"],
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
