// =============================================================================
// inspector/Inspector.tsx — entry del nuevo inspector con tabs
// =============================================================================
// Reemplaza al `<QuestionInspector>` legacy del monolito. Cambios clave:
//
//   1. Cuatro tabs: Básico / Apariencia / Más / Lógica.
//   2. Catálogos: solo se ASIGNAN aquí (chip + popover); la edición de las
//      opciones vive exclusivamente en `CatalogsContextLens`.
//   3. Diagnostics: ya no aparecen como columna separada; viven en el icono
//      de alerta del header.
//   4. Header con tipo + nombre técnico + número de pregunta.
//
// La selección puede ser:
//   - Una pregunta normal (kind=question/note/calculate) → todas las tabs.
//   - Una sección (kind=section/repeat) → solo Básico + Más + Lógica
//     (Apariencia se oculta porque no tiene controles visibles propios).
//
// La selección "settings" se maneja en otro componente (`SettingsPanel` o el
// `SettingsInspector` legacy hasta que migremos también esa parte).
// =============================================================================

import { useEffect, useState } from "react";
import { Layers, Paintbrush, Sliders, Workflow } from "lucide-react";
import type { BuilderNode, CatalogSummary } from "../types";
import type { LogicScope } from "../logic";
import { iconForType } from "../helpers/icons";
import { renderMarkdownInline, stripMarkdown } from "../helpers/markdown";
import { paletteForType, paletteSoftForType } from "../helpers/paletteForType";
import { typeLabel } from "../parsing/parseType";
import { BasicTab } from "./BasicTab";
import { AppearanceTab } from "./AppearanceTab";
import { MoreTab } from "./MoreTab";
import { LogicTab } from "./LogicTab";

type InspectorTabId = "basic" | "appearance" | "more" | "logic";

const TABS: Array<{ id: InspectorTabId; label: string; icon: typeof Layers }> = [
  { id: "basic", label: "Básico", icon: Layers },
  { id: "appearance", label: "Apariencia", icon: Paintbrush },
  { id: "more", label: "Más", icon: Sliders },
  { id: "logic", label: "Lógica", icon: Workflow },
];

export type InspectorProps = {
  node: BuilderNode;
  catalogs: CatalogSummary[];
  /** Scope de lógica: variables y catálogos disponibles para el builder
   *  guiado de relevant/constraint/calculation. */
  logicScope: LogicScope;
  /** Posición de la pregunta dentro del outline (1-indexed), si aplica. */
  position?: number;
  /** Cuántas preguntas usan el catálogo asignado (incluyendo esta). >1
   *  habilita la action "Crear copia solo para esta pregunta" en
   *  Avanzado. */
  catalogUsageCount?: number;
  onFieldChange: (field: string, value: string) => void;
  onTypeChange: (next: string) => void;
  onRequiredChange: (checked: boolean) => void;
  onCatalogAssign: (listName: string) => void;
  onCatalogCreate: () => void;
  /** Abre el ContextLens de catálogos preposicionado en `focusListName`. */
  onOpenCatalogLens: (focusListName: string) => void;
  /** Clona el catálogo a un listName nuevo y reasigna esta pregunta —
   *  útil cuando varias preguntas comparten lista pero esta pregunta
   *  necesita opciones distintas. */
  onCloneCatalog?: () => void;
};

export function Inspector({
  node,
  catalogs,
  logicScope,
  position,
  catalogUsageCount,
  onFieldChange,
  onTypeChange,
  onRequiredChange,
  onCatalogAssign,
  onCatalogCreate,
  onOpenCatalogLens,
  onCloneCatalog,
}: InspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTabId>("basic");

  // Si cambia la fila seleccionada, volvemos a la tab Básico — evita que el
  // usuario se quede mirando la tab Lógica de otra pregunta sin querer.
  useEffect(() => {
    setActiveTab("basic");
  }, [node.rowIndex]);

  const isSection = node.kind === "section" || node.kind === "repeat";
  const accent = paletteForType(node.typeInfo.base);
  const accentSoft = paletteSoftForType(node.typeInfo.base);
  const Icon = iconForType(node.typeInfo.base);

  const visibleTabs = TABS.filter((tab) => {
    if (tab.id === "appearance" && isSection) return false;
    return true;
  });

  return (
    <div className="pulso-inspector">
      <header className="pulso-inspector-header">
        <div className="pulso-inspector-header-top">
          <span
            className="pulso-inspector-header-icon"
            style={{ color: accent, background: accentSoft }}
          >
            <Icon size={14} />
          </span>
          <div className="pulso-inspector-header-meta">
            {node.label ? (
              <strong
                title={stripMarkdown(node.label)}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: renderMarkdownInline(node.label) }}
              />
            ) : (
              <strong title={node.name}>{node.name || "Sin texto"}</strong>
            )}
            <span className="pulso-inspector-header-sub">
              {typeLabel(node.typeInfo.base)}
              {position ? <> · #{position}</> : null}
              {node.name ? <> · <code>{node.name}</code></> : null}
            </span>
          </div>
        </div>
      </header>

      <nav className="pulso-inspector-tabs" role="tablist" aria-label="Secciones del inspector">
        {visibleTabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`pulso-inspector-tab-trigger ${isActive ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <TabIcon size={13} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="pulso-inspector-tabpanel" role="tabpanel">
        {activeTab === "basic" && (
          <BasicTab
            node={node}
            catalogs={catalogs}
            logicScope={logicScope}
            catalogUsageCount={catalogUsageCount}
            onFieldChange={onFieldChange}
            onTypeChange={onTypeChange}
            onRequiredChange={onRequiredChange}
            onCatalogAssign={onCatalogAssign}
            onCatalogCreate={onCatalogCreate}
            onOpenCatalogLens={onOpenCatalogLens}
            onCloneCatalog={onCloneCatalog}
          />
        )}
        {activeTab === "appearance" && !isSection && (
          <AppearanceTab node={node} onFieldChange={onFieldChange} />
        )}
        {activeTab === "more" && <MoreTab node={node} onFieldChange={onFieldChange} />}
        {activeTab === "logic" && (
          <LogicTab node={node} scope={logicScope} onFieldChange={onFieldChange} />
        )}
      </div>
    </div>
  );
}
