// =============================================================================
// inspector/ContextPanel.tsx — sidebar contextual sin tabs
// =============================================================================
// Reemplaza al `Inspector` con 4 tabs (Básico/Apariencia/Más/Lógica) por un
// sidebar lineal con secciones colapsables apiladas, estilo Linear/Notion.
//
// Beneficio: un usuario que necesita ajustar relevant Y validación NO
// tiene que cambiar de tab. Las secciones vacías quedan colapsadas y no
// agregan ruido. El lenguaje es plano: "Cuándo aparece" en lugar de
// "Lógica → Relevant".
//
// Reusa los componentes existentes (BasicTab, LogicTab, AppearanceTab,
// MoreTab) — solo cambia el contenedor. Esto permite mantener el
// Inspector legacy montado en paralelo si hace falta.
// =============================================================================

import { useEffect, useState } from "react";
import { ExternalLink, Layers, ListChecks, Paintbrush, Users, Workflow } from "lucide-react";
import type { BuilderNode, CatalogSummary } from "../types";
import type { LogicScope } from "../logic";
import { iconForType } from "../helpers/icons";
import { renderMarkdownInline, stripMarkdown } from "../helpers/markdown";
import { paletteForType, paletteSoftForType } from "../helpers/paletteForType";
import { typeLabel } from "../parsing/parseType";
import { CollapsibleSection } from "../shell/CollapsibleSection";
import { BasicTab } from "./BasicTab";
import { AppearanceTab } from "./AppearanceTab";
import { MoreTab } from "./MoreTab";
import { LogicTab } from "./LogicTab";

/** Info dinámica de la lista de opciones asignada (cuando aplica). */
export type CatalogInfo = {
  listName: string;
  choicesCount: number;
  /** Otras preguntas que usan la misma lista (NO incluye la actual). */
  sharedWith: Array<{ rowIndex: number; label: string; name: string }>;
};

/** Contexto condicional de la pregunta: relevant propio + relevants
 *  heredados de secciones padre. Lo usa el BasicTab para mostrar
 *  "obligatorio condicionado" cuando `required` está marcado. */
export type ConditionalContext = {
  selfRelevant: string;
  ancestorRelevants: Array<{ sectionLabel: string; relevant: string }>;
};

export type ContextPanelProps = {
  node: BuilderNode;
  catalogs: CatalogSummary[];
  logicScope: LogicScope;
  position?: number;
  catalogUsageCount?: number;
  /** Detalle del catálogo asignado: lista de opciones y dónde más se
   *  reusa. Solo aplica para preguntas select_one/select_multiple
   *  con un listName. Si está vacío, no se renderiza la sección. */
  catalogInfo?: CatalogInfo;
  /** Relevant propio + relevants heredados — usado por BasicTab para
   *  mostrar "obligatorio condicionado" cuando aplica. */
  conditionalContext?: ConditionalContext | null;
  onFieldChange: (field: string, value: string) => void;
  onTypeChange: (next: string) => void;
  onRequiredChange: (checked: boolean) => void;
  onCatalogAssign: (listName: string) => void;
  onCatalogCreate: () => void;
  onOpenCatalogLens: (focusListName: string) => void;
  onCloneCatalog?: () => void;
  /** Selecciona otra pregunta (rowIndex). Usado para los chips de
   *  preguntas que comparten la misma lista. */
  onSelectRow?: (rowIndex: number) => void;
};

export function ContextPanel({
  node,
  catalogs,
  logicScope,
  position,
  catalogUsageCount,
  catalogInfo,
  conditionalContext,
  onFieldChange,
  onTypeChange,
  onRequiredChange,
  onCatalogAssign,
  onCatalogCreate,
  onOpenCatalogLens,
  onCloneCatalog,
  onSelectRow,
}: ContextPanelProps) {
  const isSection = node.kind === "section" || node.kind === "repeat";
  const isSelect =
    node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple";
  const accent = paletteForType(node.typeInfo.base);
  const accentSoft = paletteSoftForType(node.typeInfo.base);
  const Icon = iconForType(node.typeInfo.base);

  // Cuando cambia la pieza activa, todas las secciones colapsan (con la
  // excepción de "Lo esencial" que siempre arranca abierto). Forzamos un
  // remount para que CollapsibleSection respete su `defaultOpen`.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    setVersion((v) => v + 1);
  }, [node.rowIndex]);

  // Heurísticas para defaultOpen — abrimos secciones que ya tienen valor,
  // así el usuario ve directo lo que ya está configurado.
  const hasLogic = !!node.relevant || !!node.constraint;
  const hasAppearance = !!node.appearance && !isSection;

  return (
    <div className="pulso-context-panel" key={version}>
      {/* Header con icono + texto + tipo + posición */}
      <header className="pulso-context-panel-header">
        <span
          className="pulso-context-panel-header-icon"
          style={{ color: accent, background: accentSoft }}
        >
          <Icon size={14} />
        </span>
        <div className="pulso-context-panel-header-meta">
          {node.label ? (
            <strong
              title={stripMarkdown(node.label)}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: renderMarkdownInline(node.label) }}
            />
          ) : (
            <strong title={node.name}>{node.name || "Sin texto"}</strong>
          )}
          <span className="pulso-context-panel-header-sub">
            {typeLabel(node.typeInfo.base)}
            {position ? <> · #{position}</> : null}
            {node.name ? <> · <code>{node.name}</code></> : null}
          </span>
        </div>
      </header>

      {/* Características — siempre abierto. Combina lo que antes estaba
          repartido entre BasicTab y MoreTab: tipo, texto, identificador,
          obligatoria, catálogo, repeticiones, solo lectura. */}
      <CollapsibleSection
        title="Características"
        hint="Tipo, texto, identificador, obligatoria"
        defaultOpen
        icon={<Layers size={13} />}
      >
        <BasicTab
          node={node}
          catalogs={catalogs}
          logicScope={logicScope}
          catalogUsageCount={catalogUsageCount}
          conditionalContext={conditionalContext}
          onFieldChange={onFieldChange}
          onTypeChange={onTypeChange}
          onRequiredChange={onRequiredChange}
          onCatalogAssign={onCatalogAssign}
          onCatalogCreate={onCatalogCreate}
          onOpenCatalogLens={onOpenCatalogLens}
          onCloneCatalog={onCloneCatalog}
        />
        <MoreTab node={node} onFieldChange={onFieldChange} />
      </CollapsibleSection>

      {/* Lista de opciones — solo para select_one/select_multiple. La
          sección expone el catálogo asignado y dónde más se reusa. */}
      {isSelect && catalogInfo && (
        <CollapsibleSection
          title="Lista de opciones"
          hint={`${catalogInfo.choicesCount} ${catalogInfo.choicesCount === 1 ? "opción" : "opciones"}${
            catalogInfo.sharedWith.length > 0
              ? ` · compartida con ${catalogInfo.sharedWith.length}`
              : ""
          }`}
          defaultOpen
          icon={<ListChecks size={13} />}
        >
          <CatalogInfoBlock
            info={catalogInfo}
            onOpenLens={() => onOpenCatalogLens(catalogInfo.listName)}
            onSelectRow={onSelectRow}
            onCloneCatalog={onCloneCatalog}
          />
        </CollapsibleSection>
      )}

      {/* Lógica y validación: relevant + constraint + mensajes */}
      <CollapsibleSection
        title="Lógica y validación"
        hint="Condiciones de visibilidad y reglas de respuesta"
        defaultOpen={hasLogic}
        icon={<Workflow size={13} />}
      >
        <LogicTab node={node} scope={logicScope} onFieldChange={onFieldChange} />
      </CollapsibleSection>

      {/* Apariencia — solo si la pieza la admite */}
      {!isSection && (
        <CollapsibleSection
          title="Apariencia"
          hint="Cómo se ve el control en pantalla"
          defaultOpen={hasAppearance}
          icon={<Paintbrush size={13} />}
        >
          <AppearanceTab node={node} onFieldChange={onFieldChange} />
        </CollapsibleSection>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// CatalogInfoBlock — info dinámica de la lista de opciones asignada
// -----------------------------------------------------------------------------

function CatalogInfoBlock({
  info,
  onOpenLens,
  onSelectRow,
  onCloneCatalog,
}: {
  info: CatalogInfo;
  onOpenLens: () => void;
  onSelectRow?: (rowIndex: number) => void;
  onCloneCatalog?: () => void;
}) {
  const isShared = info.sharedWith.length > 0;
  return (
    <div className="pulso-catalog-info">
      <div className="pulso-catalog-info-row">
        <span className="pulso-catalog-info-label">Código de la lista</span>
        <code className="pulso-catalog-info-listname">{info.listName}</code>
      </div>
      <div className="pulso-catalog-info-row">
        <span className="pulso-catalog-info-label">Opciones</span>
        <span className="pulso-catalog-info-value">
          {info.choicesCount}{" "}
          <span className="pulso-catalog-info-muted">
            {info.choicesCount === 1 ? "respuesta posible" : "respuestas posibles"}
          </span>
        </span>
      </div>

      {isShared && (
        <div className="pulso-catalog-info-shared">
          <div className="pulso-catalog-info-shared-head">
            <Users size={12} />
            <span>
              También se usa en{" "}
              <strong>{info.sharedWith.length}</strong>{" "}
              {info.sharedWith.length === 1 ? "pregunta" : "preguntas"}
            </span>
          </div>
          <ul className="pulso-catalog-info-shared-list">
            {info.sharedWith.map((q) => (
              <li key={q.rowIndex}>
                <button
                  type="button"
                  className="pulso-catalog-info-shared-link"
                  onClick={() => onSelectRow?.(q.rowIndex)}
                  title="Ir a esta pregunta"
                  disabled={!onSelectRow}
                >
                  {q.label || q.name || `fila ${q.rowIndex + 1}`}
                </button>
              </li>
            ))}
          </ul>
          {onCloneCatalog && (
            <p className="pulso-catalog-info-shared-note">
              Editar las opciones afecta a todas las preguntas de la
              lista. Si esta pregunta necesita opciones distintas, abre
              "Avanzado" en "Lo esencial" y crea una copia.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        className="pulso-catalog-info-open-lens"
        onClick={onOpenLens}
      >
        <ExternalLink size={11} /> Editor de listas
      </button>
    </div>
  );
}
