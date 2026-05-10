// =============================================================================
// canvas/SectionHeader.tsx — header editable de una sección en el lienzo
// =============================================================================
// Cuando el FormCanvas encuentra un begin_group / begin_repeat, monta este
// header con el título editable, conteo de preguntas, indicador
// condicional, y un toggle para colapsar/expandir el contenido. Las
// secciones anidadas se identan visualmente por `depth`.
// =============================================================================

import { ChevronDown, ChevronRight, Folder, Repeat } from "lucide-react";
import { ConditionalIcon } from "../helpers/icons";
import { RichInline } from "../helpers/RichInline";

export type SectionHeaderProps = {
  /** Título editable de la sección. */
  label: string;
  /** Identificador interno (mostrado como code en hover). */
  name: string;
  /** Tipo: agrupador simple o repetidor. */
  kind: "section" | "repeat";
  /** Profundidad de anidamiento (0 = top level). */
  depth: number;
  /** Cuántas preguntas hay dentro (recursivo). */
  childCount: number;
  /** Si true, la sección tiene visibilidad condicional (relevant). */
  hasRelevant: boolean;
  /** Si true, esta sección es la pieza activa del editor. */
  selected: boolean;
  /** Si true, el contenido está colapsado. */
  collapsed: boolean;
  onSelect: () => void;
  onToggleCollapsed: () => void;
  onLabelChange: (value: string) => void;
};

export function SectionHeader({
  label,
  name,
  kind,
  depth,
  childCount,
  hasRelevant,
  selected,
  collapsed,
  onSelect,
  onToggleCollapsed,
  onLabelChange,
}: SectionHeaderProps) {
  const Icon = kind === "repeat" ? Repeat : Folder;
  return (
    <header
      className={`pulso-canvas-section-header${selected ? " is-selected" : ""}`}
      style={{ paddingLeft: 4 + depth * 16 }}
      onClick={onSelect}
    >
      <button
        type="button"
        className="pulso-canvas-section-toggle"
        onClick={(e) => {
          e.stopPropagation();
          onToggleCollapsed();
        }}
        aria-label={collapsed ? "Expandir sección" : "Colapsar sección"}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>
      <span className="pulso-canvas-section-icon" aria-hidden="true">
        <Icon size={15} />
      </span>
      <RichInline
        as="h3"
        className="pulso-canvas-section-title"
        value={label}
        onChange={onLabelChange}
        placeholder={kind === "repeat" ? "Bloque repetido sin nombre" : "Sección sin nombre"}
        singleLine
        ariaLabel="Título de la sección"
      />
      <span className="pulso-canvas-section-meta">
        <span className="pulso-canvas-section-count">
          {childCount} {childCount === 1 ? "pregunta" : "preguntas"}
        </span>
        {hasRelevant && (
          <span className="pulso-canvas-section-conditional" title="Sección condicional">
            <ConditionalIcon size={12} weight="bold" /> Condicional
          </span>
        )}
        {name && (
          <code className="pulso-canvas-section-name" title="Identificador interno">
            {name}
          </code>
        )}
      </span>
    </header>
  );
}
