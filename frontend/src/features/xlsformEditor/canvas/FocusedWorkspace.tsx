import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Database,
  Eye,
  FileText,
  Info,
  Layers3,
  LayoutList,
  ListChecks,
  Paintbrush,
  Settings2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IconConditionalLogic, IconRequired } from "../../../lib/icons";
import type {
  BuilderNode,
  BuilderSelection,
  BuilderStructure,
  CatalogSummary,
  ChoiceItem,
  SectionMeta,
  XlsformEditorWorkbook,
} from "../types";
import {
  parseExpression,
  serializeExpression,
  tryFlattenConstraint,
  type Expr,
  type LogicScope,
} from "../logic";
import type { CatalogInfo, ConditionalContext } from "../inspector/ContextPanel";
import { iconForType } from "../helpers/icons";
import { renderMarkdownInline, stripMarkdown } from "../helpers/markdown";
import { paletteForType, paletteSoftForType } from "../helpers/paletteForType";
import { typeLabel } from "../parsing/parseType";
import { FormCanvas, type FormCanvasProps } from "./FormCanvas";
import { EditableQuestionCard } from "./EditableQuestionCard";
import { SectionHeader } from "./SectionHeader";
import { InspectorBlock, InspectorField } from "../inspector/InspectorPrimitives";
import { MarkdownField } from "../inspector/MarkdownField";
import { TypePicker } from "../inspector/TypePicker";
import { NameField } from "../inspector/NameField";
import { CatalogChip } from "../inspector/CatalogChip";
import { AppearancePicker } from "../inspector/AppearancePicker";
import { CalculationBuilder } from "../inspector/logic/CalculationBuilder";
import { LogicBuilder } from "../inspector/logic/LogicBuilder";
import { ConstraintBuilder } from "../inspector/logic/ConstraintBuilder";

export type FocusWorkspaceMode = "focus" | "overview";

type FormCanvasBundle = Omit<FormCanvasProps, "workbook" | "structure" | "selectedRow">;

export type FocusedWorkspaceProps = {
  mode: FocusWorkspaceMode;
  onModeChange: (mode: FocusWorkspaceMode) => void;
  workbook: XlsformEditorWorkbook | null;
  structure: BuilderStructure | null;
  selection: BuilderSelection | null;
  node: BuilderNode | null;
  section: SectionMeta | null;
  settingsRecord: Record<string, string> | null;
  selectedChoices: ChoiceItem[];
  selectedPosition?: number;
  catalogUsageCount: number;
  catalogInfo?: CatalogInfo;
  conditionalContext?: ConditionalContext | null;
  catalogs: CatalogSummary[];
  logicScope: LogicScope;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onSettingsChange: (field: string, value: string) => void;
  onFieldChange: (field: string, value: string) => void;
  onFieldsChange: (updates: Record<string, string>) => void;
  onTypeChange: (next: string) => void;
  onRequiredChange: (checked: boolean) => void;
  onCatalogAssign: (listName: string) => void;
  onCatalogCreate: () => void;
  onOpenCatalogLens: (focusListName: string) => void;
  onCloneCatalog?: () => void;
  onSelectRow: (rowIndex: number) => void;
  formCanvasProps: FormCanvasBundle;
};

export function FocusedWorkspace({
  mode,
  onModeChange,
  workbook,
  structure,
  selection,
  node,
  section,
  settingsRecord,
  selectedChoices,
  selectedPosition,
  catalogUsageCount,
  catalogInfo,
  conditionalContext,
  catalogs,
  logicScope,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDelete,
  onSettingsChange,
  onFieldChange,
  onFieldsChange,
  onTypeChange,
  onRequiredChange,
  onCatalogAssign,
  onCatalogCreate,
  onOpenCatalogLens,
  onCloneCatalog,
  onSelectRow,
  formCanvasProps,
}: FocusedWorkspaceProps) {
  const header = useMemo(
    () => buildHeaderCopy(selection, node, section, settingsRecord),
    [selection, node, section, settingsRecord],
  );
  const focusStatus = useMemo(
    () => buildFocusStatusItems(node, selectedChoices, catalogUsageCount, conditionalContext),
    [node, selectedChoices, catalogUsageCount, conditionalContext],
  );
  const HeaderIcon = header.icon;

  return (
    <section className="pulso-focus-workspace" aria-label="Workspace de edición">
      <header className="pulso-focus-workspace-header">
        <div className="pulso-focus-title-cluster">
          <span className="pulso-focus-title-icon" style={header.iconStyle}>
            <HeaderIcon size={16} />
          </span>
          <div className="pulso-focus-title-copy">
            <span className="pulso-section-eyebrow">{header.kicker}</span>
            <h3
              title={stripMarkdown(header.title)}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: renderMarkdownInline(header.title) }}
            />
            <p>{header.subtitle}</p>
            {focusStatus.length > 0 && (
              <div className="pulso-focus-status-strip" aria-label="Estado rápido del elemento seleccionado">
                {focusStatus.map((item) => (
                  <span key={item.key} className={`pulso-focus-status-chip is-${item.tone}`}>
                    <span className="pulso-focus-status-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>
                      <strong>{item.value}</strong>
                      <small>{item.label}</small>
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pulso-focus-workspace-controls">
          <div className="pulso-focus-mode-toggle" role="tablist" aria-label="Vista del builder">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "focus"}
              className={mode === "focus" ? "is-on" : ""}
              onClick={() => onModeChange("focus")}
            >
              <Eye size={13} /> En foco
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "overview"}
              className={mode === "overview" ? "is-on" : ""}
              onClick={() => onModeChange("overview")}
            >
              <LayoutList size={13} /> Formulario completo
            </button>
          </div>

          {selection?.kind === "survey" && (
            <div className="pulso-focus-actions" aria-label="Acciones del elemento seleccionado">
              <button type="button" className="pulso-icon" onClick={onMoveUp} disabled={!canMoveUp} title="Mover arriba">
                <ArrowUp size={14} />
              </button>
              <button type="button" className="pulso-icon" onClick={onMoveDown} disabled={!canMoveDown} title="Mover abajo">
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                className="pulso-focus-danger-action"
                onClick={onDelete}
                title="Eliminar elemento seleccionado"
              >
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="pulso-focus-workspace-body">
        {mode === "overview" ? (
          <FullFormWorkspace
            workbook={workbook}
            structure={structure}
            selectedRow={selection?.kind === "survey" ? selection.rowIndex : null}
            formCanvasProps={formCanvasProps}
          />
        ) : selection?.kind === "settings" ? (
          <FocusedSettingsWorkspace values={settingsRecord} onChange={onSettingsChange} />
        ) : node ? (
          <FocusedSurveyWorkspace
            node={node}
            section={section}
            structure={structure}
            choices={selectedChoices}
            position={selectedPosition}
            catalogUsageCount={catalogUsageCount}
            catalogInfo={catalogInfo}
            conditionalContext={conditionalContext}
            catalogs={catalogs}
            logicScope={logicScope}
            onFieldChange={onFieldChange}
            onFieldsChange={onFieldsChange}
            onTypeChange={onTypeChange}
            onRequiredChange={onRequiredChange}
            onCatalogAssign={onCatalogAssign}
            onCatalogCreate={onCatalogCreate}
            onOpenCatalogLens={onOpenCatalogLens}
            onCloneCatalog={onCloneCatalog}
            onSelectRow={onSelectRow}
            formCanvasProps={formCanvasProps}
          />
        ) : (
          <FocusEmptyState />
        )}
      </div>
    </section>
  );
}

function buildHeaderCopy(
  selection: BuilderSelection | null,
  node: BuilderNode | null,
  section: SectionMeta | null,
  settingsRecord: Record<string, string> | null,
) {
  if (selection?.kind === "settings") {
    return {
      kicker: "Ajustes del formulario",
      title: settingsRecord?.form_title || "Configuración del formulario",
      subtitle: `ID ${settingsRecord?.form_id || "sin definir"} · versión ${settingsRecord?.version || "1"}`,
      icon: Settings2,
      iconStyle: undefined,
    };
  }

  if (node) {
    const Icon = iconForType(node.typeInfo.base);
    const accent = paletteForType(node.typeInfo.base);
    const accentSoft = paletteSoftForType(node.typeInfo.base);
    const place = section && section.kind !== "root"
      ? ` · en ${stripMarkdown(section.label)}`
      : "";
    return {
      kicker: node.kind === "section" || node.kind === "repeat" ? "Bloque seleccionado" : "Pregunta seleccionada",
      title: node.label || node.name || "Elemento sin texto",
      subtitle: `${typeLabel(node.typeInfo.base)}${node.name ? ` · ${node.name}` : ""}${place}`,
      icon: Icon,
      iconStyle: { color: accent, background: accentSoft },
    };
  }

  return {
    kicker: "Constructor",
    title: "Selecciona una pieza",
    subtitle: "El outline manda el foco del workspace.",
    icon: Layers3,
    iconStyle: undefined,
  };
}

type FocusStatusItem = {
  key: string;
  label: string;
  value: string;
  tone: "neutral" | "accent" | "success" | "warn";
  icon: ReactNode;
};

function buildFocusStatusItems(
  node: BuilderNode | null,
  choices: ChoiceItem[],
  catalogUsageCount: number,
  conditionalContext?: ConditionalContext | null,
): FocusStatusItem[] {
  if (!node) return [];
  const isSelect = node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple";
  const logicCount = [
    node.relevant,
    node.constraint,
    node.calculation,
    node.choiceFilter,
  ].filter((value) => value?.trim()).length;
  const requiredIsConditional =
    node.required &&
    Boolean(conditionalContext?.selfRelevant || conditionalContext?.ancestorRelevants.length);

  const items: FocusStatusItem[] = [
    {
      key: "required",
      label: "Obligatoriedad",
      value: node.required ? (requiredIsConditional ? "Condicionada" : "Obligatoria") : "Opcional",
      tone: node.required ? "warn" : "neutral",
      icon: <IconRequired size={12} />,
    },
    {
      key: "logic",
      label: "Lógica",
      value: logicCount > 0 ? `${logicCount} ${logicCount === 1 ? "regla" : "reglas"}` : "Sin reglas",
      tone: logicCount > 0 ? "accent" : "neutral",
      icon: <IconConditionalLogic size={12} />,
    },
  ];

  if (isSelect) {
    items.push({
      key: "catalog",
      label: isSelect && catalogUsageCount > 1 ? `${catalogUsageCount} usos` : "Catálogo",
      value: `${choices.length} ${choices.length === 1 ? "opción" : "opciones"}`,
      tone: "accent",
      icon: <Database size={12} />,
    });
  }

  if (node.constraint?.trim()) {
    items.push({
      key: "validation",
      label: "Validación",
      value: "Con regla",
      tone: "success",
      icon: <ShieldCheck size={12} />,
    });
  }

  return items;
}

function FullFormWorkspace({
  workbook,
  structure,
  selectedRow,
  formCanvasProps,
}: {
  workbook: XlsformEditorWorkbook | null;
  structure: BuilderStructure | null;
  selectedRow: number | null;
  formCanvasProps: FormCanvasBundle;
}) {
  if (!workbook || !structure) return <FocusEmptyState />;
  const sectionsCount = Array.from(structure.sections.values()).filter(
    (section) => section.kind !== "root",
  ).length;
  return (
    <div className="pulso-focus-overview">
      <div className="pulso-focus-overview-toolbar" role="toolbar" aria-label="Resumen del canvas del formulario">
        <span>Formulario completo</span>
        <strong>{structure.outline.length} piezas</strong>
        <strong>{sectionsCount} secciones</strong>
      </div>
      <div className="pulso-focus-overview-stage">
        <FormCanvas
          workbook={workbook}
          structure={structure}
          selectedRow={selectedRow}
          {...formCanvasProps}
        />
      </div>
    </div>
  );
}

function FocusedSurveyWorkspace({
  node,
  section,
  structure,
  choices,
  position,
  catalogUsageCount,
  catalogInfo,
  conditionalContext,
  catalogs,
  logicScope,
  onFieldChange,
  onFieldsChange,
  onTypeChange,
  onRequiredChange,
  onCatalogAssign,
  onCatalogCreate,
  onOpenCatalogLens,
  onCloneCatalog,
  onSelectRow,
  formCanvasProps,
}: {
  node: BuilderNode;
  section: SectionMeta | null;
  structure: BuilderStructure | null;
  choices: ChoiceItem[];
  position?: number;
  catalogUsageCount: number;
  catalogInfo?: CatalogInfo;
  conditionalContext?: ConditionalContext | null;
  catalogs: CatalogSummary[];
  logicScope: LogicScope;
  onFieldChange: (field: string, value: string) => void;
  onFieldsChange: (updates: Record<string, string>) => void;
  onTypeChange: (next: string) => void;
  onRequiredChange: (checked: boolean) => void;
  onCatalogAssign: (listName: string) => void;
  onCatalogCreate: () => void;
  onOpenCatalogLens: (focusListName: string) => void;
  onCloneCatalog?: () => void;
  onSelectRow: (rowIndex: number) => void;
  formCanvasProps: FormCanvasBundle;
}) {
  const [activeTab, setActiveTab] = useState<FocusTabId>("content");
  const isSection = node.kind === "section" || node.kind === "repeat";
  const showPresentation = shouldOfferPresentationTab(node);
  const tabs = useMemo(
    () => buildFocusTabs(isSection, showPresentation),
    [isSection, showPresentation],
  );

  useEffect(() => {
    setActiveTab("content");
  }, [node.rowIndex]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) setActiveTab(tabs[0]?.id ?? "content");
  }, [activeTab, tabs]);

  return (
    <div className="pulso-focused-node-layout">
      <div className="pulso-focus-preview-pane">
        <div className="pulso-focus-pane-head">
          <span className="pulso-section-eyebrow">Vista de trabajo</span>
          <strong>{isSection ? "Bloque" : "Pregunta"}</strong>
        </div>
        <FocusedPreview
          node={node}
          section={section}
          structure={structure}
          choices={choices}
          position={position}
          catalogUsageCount={catalogUsageCount}
          catalogInfo={catalogInfo}
          conditionalContext={conditionalContext}
          logicScope={logicScope}
          onFieldChange={onFieldChange}
          onCloneCatalog={onCloneCatalog}
          onOpenCatalogLens={onOpenCatalogLens}
          onSelectRow={onSelectRow}
          formCanvasProps={formCanvasProps}
        />
      </div>

      <div className="pulso-focus-config-pane">
        <div className="pulso-focus-tabs" role="tablist" aria-label="Configuración del elemento seleccionado">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={isActive ? "is-active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="pulso-focus-config-body" role="tabpanel">
          {activeTab === "content" && (
            <ContentTab node={node} onFieldChange={onFieldChange} />
          )}
          {activeTab === "response" && (
            <ResponseTab
              node={node}
              section={section}
              catalogs={catalogs}
              logicScope={logicScope}
              catalogUsageCount={catalogUsageCount}
              catalogInfo={catalogInfo}
              conditionalContext={conditionalContext}
              onTypeChange={onTypeChange}
              onFieldChange={onFieldChange}
              onRequiredChange={onRequiredChange}
              onCatalogAssign={onCatalogAssign}
              onCatalogCreate={onCatalogCreate}
              onOpenCatalogLens={onOpenCatalogLens}
              onCloneCatalog={onCloneCatalog}
              onSelectRow={onSelectRow}
            />
          )}
          {activeTab === "rules" && (
            <RulesTab
              node={node}
              scope={logicScope}
              conditionalContext={conditionalContext}
              onFieldChange={onFieldChange}
              onFieldsChange={onFieldsChange}
            />
          )}
          {activeTab === "presentation" && (
            <PresentationTab node={node} onFieldChange={onFieldChange} />
          )}
          {activeTab === "data" && (
            <DataTab node={node} onFieldChange={onFieldChange} />
          )}
        </div>
      </div>
    </div>
  );
}

type FocusTabId = "content" | "response" | "rules" | "presentation" | "data";

function buildFocusTabs(isSection: boolean, showPresentation: boolean): Array<{
  id: FocusTabId;
  label: string;
  icon: typeof FileText;
}> {
  const tabs: Array<{
    id: FocusTabId;
    label: string;
    icon: typeof FileText;
  }> = [
    { id: "content", label: "Contenido", icon: FileText },
    { id: "response", label: isSection ? "Estructura" : "Respuesta", icon: isSection ? Layers3 : ListChecks },
    { id: "rules", label: "Reglas", icon: IconConditionalLogic },
    { id: "data", label: "Datos", icon: Database },
  ];
  if (showPresentation) {
    tabs.push({ id: "presentation", label: "Presentación", icon: Paintbrush });
  }
  return tabs;
}

function FocusedPreview({
  node,
  section,
  structure,
  choices,
  position,
  catalogUsageCount,
  catalogInfo,
  conditionalContext,
  logicScope,
  onFieldChange,
  onCloneCatalog,
  onOpenCatalogLens,
  onSelectRow,
  formCanvasProps,
}: {
  node: BuilderNode;
  section: SectionMeta | null;
  structure: BuilderStructure | null;
  choices: ChoiceItem[];
  position?: number;
  catalogUsageCount: number;
  catalogInfo?: CatalogInfo;
  conditionalContext?: ConditionalContext | null;
  logicScope: LogicScope;
  onFieldChange: (field: string, value: string) => void;
  onCloneCatalog?: () => void;
  onOpenCatalogLens: (focusListName: string) => void;
  onSelectRow: (rowIndex: number) => void;
  formCanvasProps: FormCanvasBundle;
}) {
  if (node.kind === "section" || node.kind === "repeat") {
    const sectionMeta = structure?.sections.get(`section-${node.rowIndex}`) ?? section;
    return (
      <div className="pulso-focus-section-preview">
        <SectionHeader
          label={node.label}
          name={node.name}
          kind={node.kind}
          depth={0}
          childCount={sectionMeta?.itemCount ?? 0}
          hasRelevant={!!node.relevant}
          selected
          collapsed={false}
          onSelect={() => onSelectRow(node.rowIndex)}
          onToggleCollapsed={() => undefined}
          onLabelChange={(value) => onFieldChange("label", value)}
        />
        <div className="pulso-focus-section-facts">
          <FocusFact label="Piezas dentro" value={`${sectionMeta?.itemCount ?? 0}`} />
          <FocusFact label="Tipo de bloque" value={node.kind === "repeat" ? "Repetición" : "Sección"} />
          <FocusFact label="Código" value={node.name || "sin código"} code />
        </div>
      </div>
    );
  }

  const sharedWith = node.typeInfo.listName
    ? (formCanvasProps.questionsByCatalog?.get(node.typeInfo.listName) ?? []).filter(
        (question) => question.rowIndex !== node.rowIndex,
      )
    : [];

  return (
    <div className="pulso-focus-question-preview">
      <EditableQuestionCard
        node={node}
        choices={choices}
        position={position}
        selected
        catalogUsageCount={catalogUsageCount}
        sharedWith={sharedWith}
        onSelectSharedQuestion={onSelectRow}
        onSelect={() => onSelectRow(node.rowIndex)}
        onLabelChange={(value) => onFieldChange("label", value)}
        onHintChange={(value) => onFieldChange("hint", value)}
        onChoiceLabelChange={(choiceRow, value) =>
          node.typeInfo.listName && formCanvasProps.onChoiceLabelChange(node.typeInfo.listName, choiceRow, value)
        }
        onChoiceNameChange={(choiceRow, value) =>
          node.typeInfo.listName && formCanvasProps.onChoiceNameChange(node.typeInfo.listName, choiceRow, value)
        }
        onAddChoice={() => node.typeInfo.listName && formCanvasProps.onAddChoice(node.typeInfo.listName)}
        onRemoveChoice={(choiceRow) =>
          node.typeInfo.listName && formCanvasProps.onRemoveChoice(node.typeInfo.listName, choiceRow)
        }
        onRenameList={
          node.typeInfo.listName
            ? (nextListName) => formCanvasProps.onRenameList(node.typeInfo.listName, nextListName)
            : undefined
        }
        onCloneCatalog={onCloneCatalog}
        onOpenCatalogLens={
          node.typeInfo.listName
            ? () => onOpenCatalogLens(node.typeInfo.listName)
            : undefined
        }
      />
      <FocusQuestionQuicklook
        node={node}
        section={section}
        choices={choices}
        catalogUsageCount={catalogUsageCount}
        catalogInfo={catalogInfo}
        conditionalContext={conditionalContext}
        logicScope={logicScope}
      />
    </div>
  );
}

function FocusQuestionQuicklook({
  node,
  section,
  choices,
  catalogUsageCount,
  catalogInfo,
  conditionalContext,
  logicScope,
}: {
  node: BuilderNode;
  section: SectionMeta | null;
  choices: ChoiceItem[];
  catalogUsageCount: number;
  catalogInfo?: CatalogInfo;
  conditionalContext?: ConditionalContext | null;
  logicScope: LogicScope;
}) {
  const responseDetail = node.typeInfo.listName
    ? `${choices.length} ${choices.length === 1 ? "opción" : "opciones"} en ${catalogInfo?.listName || node.typeInfo.listName}${
        catalogUsageCount > 1 ? ` · usada por ${catalogUsageCount} preguntas` : ""
      }`
    : node.kind === "calculate"
      ? "Se completa con una fórmula del XLSForm."
      : "Respuesta directa del encuestador.";
  const hasVisibility = Boolean(node.relevant.trim()) || Boolean(conditionalContext?.ancestorRelevants.length);
  const visibility = summarizeVisibilityForQuicklook(node, conditionalContext, logicScope);
  const validation = describeValidation(node.constraint, node, logicScope);
  const location = section && section.kind !== "root"
    ? `Dentro de ${stripMarkdown(section.label || section.name || "la sección")}`
    : "En el nivel principal del formulario";
  const items: Array<{
    label: string;
    title: string;
    detail: string;
    icon: LucideIcon;
    tone?: "accent" | "success" | "warn" | "muted";
  }> = [
    {
      label: "Respuesta",
      title: typeLabel(node.typeInfo.base),
      detail: responseDetail,
      icon: ListChecks,
      tone: node.typeInfo.listName ? "accent" : "muted",
    },
    {
      label: "Obligatoriedad",
      title: node.required ? "Obligatoria" : "Opcional",
      detail: node.required
        ? hasVisibility
          ? "Se exige solo cuando la pregunta aparece."
          : "El encuestador debe responderla."
        : "Puede quedar sin respuesta.",
      icon: CheckCircle2,
      tone: node.required ? "success" : "muted",
    },
    {
      label: "Visibilidad",
      title: visibility.title,
      detail: visibility.detail,
      icon: IconConditionalLogic,
      tone: hasVisibility ? "accent" : "muted",
    },
    {
      label: "Validación",
      title: validation ? validation.status : "Sin validación",
      detail: validation?.summary ?? "Acepta el valor propio del tipo seleccionado.",
      icon: ShieldCheck,
      tone: validation ? (validation.technical ? "warn" : "success") : "muted",
    },
  ];

  return (
    <aside className="pulso-focus-quicklook" aria-label="Resumen rápido de la pregunta">
      <div className="pulso-focus-quicklook-head">
        <span className="pulso-section-eyebrow">Resumen rápido</span>
        <strong>{location}</strong>
      </div>
      <div className="pulso-focus-quicklook-grid">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={`pulso-focus-quicklook-item ${item.tone ? `is-${item.tone}` : ""}`}
            >
              <span className="pulso-focus-quicklook-icon" aria-hidden="true">
                <Icon size={13} />
              </span>
              <span className="pulso-focus-quicklook-copy">
                <em>{item.label}</em>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function summarizeVisibilityForQuicklook(
  node: BuilderNode,
  conditionalContext: ConditionalContext | null | undefined,
  scope: LogicScope,
): { title: string; detail: string } {
  const ownRelevant = node.relevant.trim();
  const ancestors = conditionalContext?.ancestorRelevants ?? [];
  if (!ownRelevant && ancestors.length === 0) {
    return {
      title: "Siempre visible",
      detail: "No depende de otra respuesta ni de una sección condicionada.",
    };
  }

  const parts: string[] = [];
  if (ownRelevant) {
    const own = describeRuleBreakdown(ownRelevant, scope, "Esta pregunta");
    parts.push(own.technical ? "condición técnica propia" : pluralizeRule(own.items.length, "regla propia", "reglas propias"));
  }
  if (ancestors.length > 0) {
    const labels = ancestors
      .map((ancestor) => stripMarkdown(ancestor.sectionLabel || "sección"))
      .slice(0, 2);
    const suffix = ancestors.length > 2 ? ` y ${ancestors.length - 2} más` : "";
    parts.push(`hereda de ${labels.join(", ")}${suffix}`);
  }

  return {
    title: "Condicionada",
    detail: parts.join(" · "),
  };
}

function pluralizeRule(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function ContentTab({
  node,
  onFieldChange,
}: {
  node: BuilderNode;
  onFieldChange: (field: string, value: string) => void;
}) {
  const isSection = node.kind === "section" || node.kind === "repeat";
  return (
    <div className="pulso-focus-tab-panel">
      <InspectorBlock>
        <InspectorField
          label={isSection ? "Título del bloque" : "Texto principal"}
          hint={isSection ? "Nombre visible de la sección o repetición." : "La pregunta que verá el encuestado."}
        >
          <MarkdownField
            value={node.label}
            onChange={(next) => onFieldChange("label", next)}
            placeholder={isSection ? "Ej. Datos de la vivienda" : "Ej. ¿Cuál es tu edad?"}
            rows={2}
          />
        </InspectorField>

        {!isSection && (
          <InspectorField
            label="Pista de apoyo"
            hint="Aclaración breve debajo de la pregunta. Puede quedar vacía."
          >
            <MarkdownField
              value={node.hint}
              onChange={(next) => onFieldChange("hint", next)}
              placeholder="Ej. Indica años cumplidos."
              rows={2}
              compact
            />
          </InspectorField>
        )}
      </InspectorBlock>
    </div>
  );
}

function ResponseTab({
  node,
  section,
  catalogs,
  logicScope,
  catalogUsageCount,
  catalogInfo,
  conditionalContext,
  onTypeChange,
  onFieldChange,
  onRequiredChange,
  onCatalogAssign,
  onCatalogCreate,
  onOpenCatalogLens,
  onCloneCatalog,
  onSelectRow,
}: {
  node: BuilderNode;
  section: SectionMeta | null;
  catalogs: CatalogSummary[];
  logicScope: LogicScope;
  catalogUsageCount: number;
  catalogInfo?: CatalogInfo;
  conditionalContext?: ConditionalContext | null;
  onTypeChange: (next: string) => void;
  onFieldChange: (field: string, value: string) => void;
  onRequiredChange: (checked: boolean) => void;
  onCatalogAssign: (listName: string) => void;
  onCatalogCreate: () => void;
  onOpenCatalogLens: (focusListName: string) => void;
  onCloneCatalog?: () => void;
  onSelectRow: (rowIndex: number) => void;
}) {
  const isSection = node.kind === "section" || node.kind === "repeat";
  const isSelect = node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple";

  if (isSection) {
    return (
      <div className="pulso-focus-tab-panel">
        <InspectorBlock>
          <div className="pulso-focus-structure-summary">
            <FocusFact label="Bloque" value={node.kind === "repeat" ? "Repetición" : "Sección"} />
            <FocusFact label="Contenido directo" value={`${section?.itemCount ?? 0} piezas`} />
            <FocusFact label="Padre" value={section?.parentId && section.parentId !== "root" ? section.parentId : "Formulario"} />
          </div>
        </InspectorBlock>
        {node.kind === "repeat" && (
          <InspectorBlock>
            <InspectorField
              label="Cantidad de repeticiones"
              hint="Número fijo o referencia a otra pregunta. Vacío = el encuestador decide."
            >
              <input
                type="text"
                value={node.repeat_count ?? ""}
                onChange={(event) => onFieldChange("repeat_count", event.target.value)}
                placeholder='Ej. 5 o ${num_personas}'
                spellCheck={false}
                style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
              />
            </InspectorField>
          </InspectorBlock>
        )}
      </div>
    );
  }

  return (
    <div className="pulso-focus-tab-panel">
      <InspectorBlock>
        <InspectorField label="Tipo de respuesta" hint="Cómo va a contestar el encuestado.">
          <TypePicker value={node.typeInfo.base} onChange={onTypeChange} />
        </InspectorField>
      </InspectorBlock>

      {node.kind === "calculate" && (
        <InspectorBlock>
          <CalculationBuilder
            expression={node.calculation}
            scope={logicScope}
            fieldLabel="Cómo se calcula"
            hint="Fórmula que completa este campo. Usa ${variable} para referenciar otras preguntas."
            onChange={(next) => onFieldChange("calculation", next)}
          />
        </InspectorBlock>
      )}

      {node.kind === "question" && (
        <InspectorBlock>
          <RequiredControl
            node={node}
            conditionalContext={conditionalContext}
            scope={logicScope}
            onRequiredChange={onRequiredChange}
            onFieldChange={onFieldChange}
          />
        </InspectorBlock>
      )}

      {isSelect && (
        <InspectorBlock>
          <InspectorField
            label="Catálogo de opciones"
            hint="Lista que alimenta esta pregunta. Puedes reusar listas o abrir el editor de catálogos."
          >
            <CatalogChip
              assignedListName={node.typeInfo.listName}
              catalogs={catalogs}
              onAssign={onCatalogAssign}
              onCreate={onCatalogCreate}
              onOpenLens={onOpenCatalogLens}
            />
          </InspectorField>
          {catalogInfo && (
            <FocusedCatalogInfo
              info={catalogInfo}
              usageCount={catalogUsageCount}
              onOpenLens={() => onOpenCatalogLens(catalogInfo.listName)}
              onSelectRow={onSelectRow}
              onCloneCatalog={onCloneCatalog}
            />
          )}
        </InspectorBlock>
      )}

      {node.kind === "question" && (
        <InspectorBlock>
          <InspectorField
            label="Valor por defecto"
            hint="Respuesta prellenada al abrir la pregunta. Déjalo vacío si el encuestador debe responder desde cero."
          >
            <input
              type="text"
              value={(node as BuilderNode & { default?: string }).default ?? ""}
              onChange={(event) => onFieldChange("default", event.target.value)}
              placeholder="Opcional"
            />
          </InspectorField>
        </InspectorBlock>
      )}
    </div>
  );
}

function RequiredControl({
  node,
  conditionalContext,
  scope,
  onRequiredChange,
  onFieldChange,
}: {
  node: BuilderNode;
  conditionalContext?: ConditionalContext | null;
  scope: LogicScope;
  onRequiredChange: (checked: boolean) => void;
  onFieldChange: (field: string, value: string) => void;
}) {
  const [conditionExplainOpen, setConditionExplainOpen] = useState(false);
  const hasCondition =
    !!conditionalContext &&
    (conditionalContext.selfRelevant.length > 0 ||
      conditionalContext.ancestorRelevants.length > 0);
  const requiredMessage = node.required_message ?? "";

  return (
    <>
      <label className={`pulso-inspector-toggle pulso-inspector-required-toggle ${node.required ? "is-on" : ""}`}>
        <input
          type="checkbox"
          checked={node.required}
          onChange={(event) => onRequiredChange(event.target.checked)}
        />
        <span className="pulso-inspector-required-icon" aria-hidden="true">
          <IconRequired size={14} strokeWidth={2.4} style={{ opacity: node.required ? 1 : 0.35 }} />
        </span>
        <span>
          <strong>Pregunta obligatoria</strong>
          <em>El encuestador no puede pasar de largo sin responderla.</em>
        </span>
      </label>

      {node.required && hasCondition && (
        <div className="pulso-inspector-conditional-required">
          <button
            type="button"
            className="pulso-inspector-conditional-required-trigger"
            onClick={() => setConditionExplainOpen((value) => !value)}
            aria-expanded={conditionExplainOpen}
          >
            <IconConditionalLogic size={12} />
            <span>Obligatoria condicionada</span>
          </button>
          {conditionExplainOpen && (
            <div className="pulso-inspector-conditional-required-body">
              <p>
                Esta pregunta es obligatoria solo cuando se cumple su regla de
                apertura o la de una sección contenedora.
              </p>
              {conditionalContext?.selfRelevant && (
                <div className="pulso-inspector-conditional-required-rule">
                  <span>Aparece cuando</span>
                  <strong>{describeExpression(conditionalContext.selfRelevant, scope).summary}</strong>
                  <details>
                    <summary>Ver fórmula técnica</summary>
                    <code>{conditionalContext.selfRelevant}</code>
                  </details>
                </div>
              )}
              {conditionalContext?.ancestorRelevants.map((ancestor, index) => (
                <div
                  key={`${ancestor.sectionLabel}-${index}`}
                  className="pulso-inspector-conditional-required-rule"
                >
                  <span>Sección «{ancestor.sectionLabel}» aparece cuando</span>
                  <strong>{describeExpression(ancestor.relevant, scope).summary}</strong>
                  <details>
                    <summary>Ver fórmula técnica</summary>
                    <code>{ancestor.relevant}</code>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(node.required || requiredMessage) && (
        <InspectorField
          label="Mensaje si falta respuesta"
          hint="Texto que aparece cuando esta pregunta obligatoria queda vacía."
        >
          <input
            type="text"
            value={requiredMessage}
            onChange={(event) => onFieldChange("required_message", event.target.value)}
            placeholder="Ej. Esta respuesta es necesaria para continuar."
          />
        </InspectorField>
      )}
    </>
  );
}

function FocusedCatalogInfo({
  info,
  usageCount,
  onOpenLens,
  onSelectRow,
  onCloneCatalog,
}: {
  info: CatalogInfo;
  usageCount: number;
  onOpenLens: () => void;
  onSelectRow: (rowIndex: number) => void;
  onCloneCatalog?: () => void;
}) {
  return (
    <div className="pulso-focus-catalog-summary">
      <div className="pulso-focus-catalog-summary-grid">
        <FocusFact label="Lista" value={info.listName} code />
        <FocusFact label="Opciones" value={`${info.choicesCount}`} />
        <FocusFact label="Uso" value={`${usageCount} ${usageCount === 1 ? "pregunta" : "preguntas"}`} />
      </div>

      {info.sharedWith.length > 0 && (
        <div className="pulso-focus-shared-list">
          <span className="pulso-section-eyebrow">También usa esta lista</span>
          {info.sharedWith.map((question) => (
            <button
              key={question.rowIndex}
              type="button"
              onClick={() => onSelectRow(question.rowIndex)}
            >
              {question.label || question.name || `fila ${question.rowIndex + 1}`}
            </button>
          ))}
          {onCloneCatalog && (
            <button type="button" className="pulso-focus-link-action" onClick={onCloneCatalog}>
              Crear copia exclusiva
            </button>
          )}
        </div>
      )}

      <button type="button" className="pulso-focus-link-action" onClick={onOpenLens}>
        Abrir editor de listas
      </button>
    </div>
  );
}

function RulesTab({
  node,
  scope,
  conditionalContext,
  onFieldChange,
  onFieldsChange,
}: {
  node: BuilderNode;
  scope: LogicScope;
  conditionalContext?: ConditionalContext | null;
  onFieldChange: (field: string, value: string) => void;
  onFieldsChange: (updates: Record<string, string>) => void;
}) {
  const isSelect =
    node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple";
  const isCalculate = node.kind === "calculate";
  const isSection = node.kind === "section" || node.kind === "repeat";
  const isNote = node.kind === "note";
  const showConstraint = !isCalculate && !isSection && !isNote;
  const targetNoun = isSection ? "este bloque" : "esta pregunta";
  const constraintMessage =
    (node as BuilderNode & { constraint_message?: string }).constraint_message ?? "";
  const validation = describeValidation(node.constraint, node, scope);
  const isGuidedPreset = validation?.status === "Preset claro";
  const readonlyBlocks: Array<{
    field: string;
    title: string;
    hint: string;
    value: string;
  }> = [];

  if (!isCalculate && node.calculation) {
    readonlyBlocks.push({
      field: "calculation",
      title: "Fórmula importada",
      hint: "Esta fila tiene una fórmula en una pregunta que no es calculate. Se preserva al exportar.",
      value: node.calculation,
    });
  }
  if (isSelect && node.choiceFilter) {
    readonlyBlocks.push({
      field: "choice_filter",
      title: "Filtro de opciones",
      hint: "Filtro importado para limitar el catálogo disponible en esta pregunta.",
      value: node.choiceFilter,
    });
  }

  return (
    <div className="pulso-focus-tab-panel">
      <InspectorBlock>
        <RuleInheritancePanel
          ownRelevant={node.relevant}
          conditionalContext={conditionalContext}
          scope={scope}
          targetLabel={isSection ? "Este bloque" : "Esta pregunta"}
        />
        <LogicBuilder
          expression={node.relevant}
          scope={scope}
          fieldLabel="Editar condición propia"
          hint={`Modifica las reglas directas que muestran ${targetNoun}. Si también depende de una sección, esa herencia se muestra en la lectura superior.`}
          onChange={(next) => onFieldChange("relevant", next)}
        />
      </InspectorBlock>

      {showConstraint && (
        <InspectorBlock>
          <ValidationSummary
            node={node}
            scope={scope}
            onFieldChange={onFieldChange}
            onFieldsChange={onFieldsChange}
          />
          <CustomValidationPanel
            node={node}
            validation={validation}
            onFieldChange={onFieldChange}
          />
          {isGuidedPreset && validation ? (
            <GuidedValidationNotice
              summary={validation.summary}
              onClear={() => {
                onFieldChange("constraint", "");
                onFieldChange("constraint_message", "");
              }}
            />
          ) : (
            <ConstraintBuilder
              expression={node.constraint}
              scope={scope}
              baseType={node.typeInfo.base}
              listName={node.typeInfo.listName || undefined}
              fieldLabel="Cómo se valida la respuesta"
              hint="Define qué condición debe cumplir la respuesta. Puedes partir de un preset o editar la regla manualmente."
              onChange={(next) => onFieldChange("constraint", next)}
            />
          )}
          {(node.constraint || constraintMessage) && (
            <InspectorField
              label="Mensaje / etiqueta cuando no es válida"
              hint="Opcional. Texto visible si la respuesta no cumple la regla; también ayuda a reconocer una regla personalizada."
            >
              <input
                type="text"
                value={constraintMessage}
                onChange={(event) =>
                  onFieldChange("constraint_message", event.target.value)
                }
                placeholder="Ej. Ingresa un correo electrónico válido."
              />
            </InspectorField>
          )}
        </InspectorBlock>
      )}

      {readonlyBlocks.length > 0 && (
        <InspectorBlock>
          {readonlyBlocks.map((block) => (
            <InspectorField key={block.field} label={block.title} hint={block.hint}>
              <div className="pulso-inspector-logic-readout">
                <pre>{block.value}</pre>
                <button
                  type="button"
                  className="pulso-inspector-logic-clear"
                  onClick={() => onFieldChange(block.field, "")}
                  title="Quitar esta regla"
                >
                  <Trash2 size={12} /> Quitar
                </button>
              </div>
            </InspectorField>
          ))}
        </InspectorBlock>
      )}
    </div>
  );
}

function CustomValidationPanel({
  node,
  validation,
  onFieldChange,
}: {
  node: BuilderNode;
  validation: (HumanizedExpression & { status: string }) | null;
  onFieldChange: (field: string, value: string) => void;
}) {
  const openByDefault = Boolean(
    node.constraint.trim() &&
      validation?.status !== "Preset claro" &&
      validation?.status !== "Editable visualmente",
  );

  return (
    <details className="pulso-focus-custom-validation" open={openByDefault}>
      <summary>Regex o fórmula avanzada</summary>
      <p>
        Pega una regla completa cuando el atajo no alcance. Por ejemplo:
        regex para patrones, count-selected para selección múltiple o una regla
        importada desde otro XLSForm.
      </p>
      <InspectorField
        label="Fórmula de validación"
        hint="Debe evaluar verdadero cuando la respuesta es aceptable. Se guarda en constraint."
      >
        <textarea
          value={node.constraint}
          onChange={(event) => onFieldChange("constraint", event.target.value)}
          placeholder={"Ej. regex(., '^[^@\\\\s]+@[^@\\\\s]+\\\\.[^@\\\\s]+$')"}
          rows={3}
          spellCheck={false}
        />
      </InspectorField>
    </details>
  );
}

function GuidedValidationNotice({
  summary,
  onClear,
}: {
  summary: string;
  onClear: () => void;
}) {
  return (
    <div className="pulso-focus-guided-validation">
      <div>
        <span className="pulso-section-eyebrow">Cómo se valida la respuesta</span>
        <strong>{summary}</strong>
        <p>Esta regla está aplicada como preset. Para cambiarla, elige otro preset arriba o quítala para construir una regla manual.</p>
      </div>
      <button type="button" className="pulso-logic-builder-clear" onClick={onClear}>
        <Trash2 size={12} /> Quitar
      </button>
    </div>
  );
}

function RuleInheritancePanel({
  ownRelevant,
  conditionalContext,
  scope,
  targetLabel,
}: {
  ownRelevant: string;
  conditionalContext?: ConditionalContext | null;
  scope: LogicScope;
  targetLabel: string;
}) {
  const ancestors = conditionalContext?.ancestorRelevants ?? [];
  const hasOwn = ownRelevant.trim().length > 0;

  return (
    <div className="pulso-focus-rule-context" aria-label="Alcance de reglas de visibilidad">
      <div className="pulso-focus-rule-context-head">
        <span className="pulso-section-eyebrow">Lectura de visibilidad</span>
        <strong>{hasOwn || ancestors.length ? "Condicionada" : "Siempre visible"}</strong>
      </div>

      {!hasOwn && !ancestors.length && (
        <div className="pulso-focus-rule-card is-muted">
          <Info size={13} />
          <span>Esta pieza no tiene condición propia ni hereda condiciones de secciones.</span>
        </div>
      )}

      {hasOwn && (
        <HumanRuleCard
          label="Condición propia"
          expression={ownRelevant}
          scope={scope}
          targetLabel={targetLabel}
        />
      )}

      {ancestors.map((ancestor, index) => (
        <HumanRuleCard
          key={`${ancestor.sectionLabel}-${index}`}
          label={`Heredada de ${ancestor.sectionLabel}`}
          expression={ancestor.relevant}
          scope={scope}
          targetLabel={targetLabel}
        />
      ))}
    </div>
  );
}

function HumanRuleCard({
  label,
  expression,
  scope,
  targetLabel,
}: {
  label: string;
  expression: string;
  scope: LogicScope;
  targetLabel: string;
}) {
  const breakdown = describeRuleBreakdown(expression, scope, targetLabel);
  return (
    <div className={`pulso-focus-rule-card ${breakdown.technical ? "is-technical" : ""}`}>
      <IconConditionalLogic size={13} />
      <div>
        <span>{label}</span>
        <strong>{breakdown.title}</strong>
        <div className="pulso-focus-rule-list">
          {breakdown.items.map((item, index) => (
            <div className="pulso-focus-rule-item" key={`${item.subject}-${index}`}>
              <span className="pulso-focus-rule-item-index">{index + 1}</span>
              <div className="pulso-focus-rule-item-copy">
                <strong>{item.subject}</strong>
                <p>
                  {item.relation}
                  {item.value && <b>{item.value}</b>}
                </p>
                {item.values && (
                  <div className="pulso-focus-rule-values">
                    {item.values.map((value) => (
                      <span key={value}>{value}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <details>
          <summary>Ver fórmula XLSForm</summary>
          <code>{breakdown.raw}</code>
        </details>
      </div>
    </div>
  );
}

function ValidationSummary({
  node,
  scope,
  onFieldChange,
  onFieldsChange,
}: {
  node: BuilderNode;
  scope: LogicScope;
  onFieldChange: (field: string, value: string) => void;
  onFieldsChange: (updates: Record<string, string>) => void;
}) {
  const summary = describeValidation(node.constraint, node, scope);
  const presets = validationPresetsFor(node);

  return (
    <div className="pulso-focus-validation">
      <div className={`pulso-focus-validation-card ${summary ? "" : "is-empty"}`}>
        {summary ? <ShieldCheck size={14} /> : <Info size={14} />}
        <div>
          <span>{summary?.status ?? "Sin validación"}</span>
          <strong>{summary?.summary ?? "La respuesta se acepta tal como fue ingresada."}</strong>
          {summary?.technical && (
            <details>
              <summary>Ver fórmula técnica</summary>
              <code>{summary.raw}</code>
            </details>
          )}
        </div>
      </div>

      {presets.length > 0 && (
        <div className="pulso-focus-validation-presets" aria-label="Validaciones sugeridas">
          <div className="pulso-focus-validation-presets-head">
            <span className="pulso-section-eyebrow">Atajos Kobo</span>
            <strong>Aplicar una regla común</strong>
            <small>La regla técnica y el mensaje para el encuestado se completan juntos.</small>
          </div>
          <div className="pulso-focus-validation-preset-grid">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="pulso-focus-validation-preset"
                onClick={() => {
                  if (preset.message) {
                    onFieldsChange({
                      constraint: preset.expression,
                      constraint_message: preset.message,
                    });
                    return;
                  }
                  onFieldChange("constraint", preset.expression);
                }}
                title={preset.hint}
              >
                <span className="pulso-focus-validation-preset-icon">
                  <CheckCircle2 size={12} />
                </span>
                <span className="pulso-focus-validation-preset-copy">
                  <strong>{preset.label}</strong>
                  <small>{preset.hint}</small>
                  {preset.message && <em>{preset.message}</em>}
                </span>
                {preset.expression.includes("regex(") && (
                  <code className="pulso-focus-validation-preset-badge">regex</code>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PresentationTab({
  node,
  onFieldChange,
}: {
  node: BuilderNode;
  onFieldChange: (field: string, value: string) => void;
}) {
  if (!shouldOfferPresentationTab(node)) {
    return (
      <div className="pulso-focus-tab-panel">
        <div className="pulso-focus-soft-empty">
          <Paintbrush size={15} />
          <span>Este tipo no necesita ajustes de presentación en el flujo guiado.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pulso-focus-tab-panel">
      <InspectorBlock>
        <InspectorField
          label="Apariencia del control"
          hint="Opciones de renderizado aplicables para este tipo en Collect. Déjalo vacío para usar el comportamiento estándar."
        >
          <AppearancePicker
            baseType={node.typeInfo.base}
            value={node.appearance}
            onChange={(next) => onFieldChange("appearance", next)}
          />
        </InspectorField>
      </InspectorBlock>
      <div className="pulso-focus-soft-empty">
        <Info size={14} />
        <span>La multimedia no se configura desde este panel todavía; si el XLSX la trae, Prosecnur la conserva al exportar.</span>
      </div>
    </div>
  );
}

function DataTab({
  node,
  onFieldChange,
}: {
  node: BuilderNode;
  onFieldChange: (field: string, value: string) => void;
}) {
  const isSection = node.kind === "section" || node.kind === "repeat";
  const paperFields = [
    node.paperNumber,
    node.paperLabel,
    node.paperSkip,
    node.paperGroup,
    node.paperLayout,
  ];
  const hasPaperOverrides = paperFields.some((value) => Boolean(value?.trim()));
  const hasTechnicalOverrides = Boolean(
    node.read_only?.trim() || node.parameters?.trim() || node.paperOnly?.trim(),
  );

  return (
    <div className="pulso-focus-tab-panel">
      <InspectorBlock>
        <InspectorField
          label={isSection ? "Código interno del bloque" : "Código interno de la pregunta"}
          hint="Identificador XLSForm usado por lógica, exportación y bases. No es el número visible para encuestadores."
        >
          <NameField
            value={node.name}
            onChange={(next) => onFieldChange("name", next)}
            placeholder={isSection ? "ej. datos_hogar" : "ej. p1_edad"}
          />
        </InspectorField>
        <div className="pulso-focus-data-note">
          <Info size={13} />
          <span>La numeración visible y los saltos impresos se derivan de la estructura y las reglas, salvo que el XLSX traiga un override explícito.</span>
        </div>
      </InspectorBlock>

      {hasPaperOverrides && (
        <InspectorBlock>
          <details className="pulso-focus-disclosure" open>
            <summary>Overrides de salida impresa importados</summary>
            <InspectorField
              label="Número visible en papel"
              hint="Override opcional para el PDF. Si queda vacío, se deriva automáticamente."
            >
              <input
                type="text"
                value={node.paperNumber ?? ""}
                onChange={(event) => onFieldChange("paper_number", event.target.value)}
                placeholder="Ej. 108"
              />
            </InspectorField>
            <InspectorField
              label="Texto alternativo para papel"
              hint="Reemplaza el texto de la pregunta solo en el PDF impreso."
            >
              <input
                type="text"
                value={node.paperLabel ?? ""}
                onChange={(event) => onFieldChange("paper_label", event.target.value)}
                placeholder="Etiqueta para el PDF"
              />
            </InspectorField>
            <InspectorField
              label="Salto impreso manual"
              hint="Tiene prioridad sobre el salto inferido desde Reglas. Úsalo solo cuando el papel necesita una redacción especial."
            >
              <input
                type="text"
                value={node.paperSkip ?? ""}
                onChange={(event) => onFieldChange("paper_skip", event.target.value)}
                placeholder="Ej. IR A LA PREGUNTA 117"
              />
            </InspectorField>
            <InspectorField
              label="Agrupación impresa"
              hint="Une varias filas en una matriz o bloque común dentro del PDF."
            >
              <input
                type="text"
                value={node.paperGroup ?? ""}
                onChange={(event) => onFieldChange("paper_group", event.target.value)}
                placeholder="Ej. p104_servicios"
              />
            </InspectorField>
            <InspectorField
              label="Layout impreso"
              hint="Override del layout automático: full, wide, matrix o compact."
            >
              <input
                type="text"
                value={node.paperLayout ?? ""}
                onChange={(event) => onFieldChange("paper_layout", event.target.value)}
                placeholder="Automático"
                spellCheck={false}
              />
            </InspectorField>
          </details>
        </InspectorBlock>
      )}

      {hasTechnicalOverrides && (
        <InspectorBlock>
          <details className="pulso-focus-disclosure" open>
            <summary>Comportamiento técnico importado</summary>
            {node.read_only && (
              <label className="pulso-inspector-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(node.read_only)}
                  onChange={(event) =>
                    onFieldChange("read_only", event.target.checked ? "yes" : "")
                  }
                />
                <span>
                  <strong>Solo lectura</strong>
                  <em>Se conserva porque vino configurado en el XLSX.</em>
                </span>
              </label>
            )}
            {node.paperOnly && (
              <InspectorField
                label="Solo papel"
                hint="Marca importada para salida impresa. Déjala vacía si el elemento debe vivir también en el formulario digital."
              >
                <input
                  type="text"
                  value={node.paperOnly}
                  onChange={(event) => onFieldChange("paper_only", event.target.value)}
                  spellCheck={false}
                />
              </InspectorField>
            )}
            {node.parameters && (
              <InspectorField
                label="Parámetros XLSForm"
                hint="Atributos crudos importados. Se preservan al exportar."
              >
                <input
                  type="text"
                  value={node.parameters}
                  onChange={(event) => onFieldChange("parameters", event.target.value)}
                  placeholder="Ej. randomize=true seed=42"
                  spellCheck={false}
                  style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}
                />
              </InspectorField>
            )}
          </details>
        </InspectorBlock>
      )}
    </div>
  );
}

function FocusedSettingsWorkspace({
  values,
  onChange,
}: {
  values: Record<string, string> | null;
  onChange: (field: string, value: string) => void;
}) {
  const items = [
    { label: "Título visible", value: values?.form_title || "Sin título" },
    { label: "ID interno", value: values?.form_id || "Sin ID" },
    { label: "Versión", value: values?.version || "1" },
    { label: "Idioma", value: values?.default_language || "es" },
  ];
  return (
    <div className="pulso-focus-settings-layout">
      <div className="pulso-focus-preview-pane">
        <div className="pulso-focus-pane-head">
          <span className="pulso-section-eyebrow">Identidad</span>
          <strong>Formulario</strong>
        </div>
        <div className="pulso-focus-settings-summary">
          {items.map((item) => (
            <FocusFact key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </div>
      <div className="pulso-focus-config-pane">
        <div className="pulso-focus-config-body">
          <InspectorBlock>
            <InspectorField label="Título del formulario">
              <input value={values?.form_title ?? ""} onChange={(event) => onChange("form_title", event.target.value)} />
            </InspectorField>
            <InspectorField label="ID interno">
              <input value={values?.form_id ?? ""} onChange={(event) => onChange("form_id", event.target.value)} />
            </InspectorField>
          </InspectorBlock>
          <InspectorBlock>
            <InspectorField label="Versión">
              <input value={values?.version ?? ""} onChange={(event) => onChange("version", event.target.value)} />
            </InspectorField>
            <InspectorField label="Idioma por defecto">
              <input value={values?.default_language ?? "es"} onChange={(event) => onChange("default_language", event.target.value)} />
            </InspectorField>
          </InspectorBlock>
        </div>
      </div>
    </div>
  );
}

function FocusFact({
  label,
  value,
  code,
}: {
  label: string;
  value: string;
  code?: boolean;
}) {
  return (
    <div className="pulso-focus-fact">
      <span>{label}</span>
      {code ? <code>{value}</code> : <strong>{value}</strong>}
    </div>
  );
}

function FocusEmptyState() {
  return (
    <div className="pulso-focus-empty">
      <span className="pulso-focus-empty-icon">
        <Layers3 size={18} />
      </span>
      <strong>Selecciona una pieza del formulario</strong>
      <p>El workspace mostrará la pregunta, sección o ajustes que elijas en la estructura.</p>
    </div>
  );
}

type HumanizedExpression = {
  summary: string;
  raw: string;
  technical: boolean;
};

type RuleBreakdown = {
  title: string;
  raw: string;
  technical: boolean;
  items: RuleBreakdownItem[];
};

type RuleBreakdownItem = {
  subject: string;
  relation: string;
  value?: string;
  values?: string[];
};

type ValidationPreset = {
  id: string;
  label: string;
  hint: string;
  expression: string;
  message: string;
};

function describeRuleBreakdown(expression: string, scope: LogicScope, targetLabel: string): RuleBreakdown {
  const raw = expression.trim();
  const ast = parseExpression(raw);
  if (!raw || !ast) {
    return {
      title: "Sin condición legible",
      raw,
      technical: !ast && Boolean(raw),
      items: [{ subject: raw || "Sin condición", relation: "" }],
    };
  }

  const items = ruleItemsFromExpr(ast, scope);
  const title = items.length === 1
    ? `${targetLabel} aparece con esta regla`
    : `${targetLabel} aparece cuando se cumplen ${items.length} reglas`;
  return {
    title,
    raw: exprRaw(ast, raw),
    technical: items.some((item) => item.subject === "Regla técnica importada"),
    items,
  };
}

function ruleItemsFromExpr(expr: Expr, scope: LogicScope): RuleBreakdownItem[] {
  if (expr.kind === "logical" && expr.op === "and") {
    return expr.operands.flatMap((operand) => ruleItemsFromExpr(operand, scope));
  }

  const multiSelected = multiSelectedRuleItem(expr, scope);
  if (multiSelected) return [multiSelected];

  const simple = simpleRuleItem(expr, scope);
  if (simple) return [simple];

  if (expr.kind === "logical" && expr.op === "or") {
    const options = expr.operands.map((operand) => {
      const item = simpleRuleItem(operand, scope) ?? multiSelectedRuleItem(operand, scope);
      return item ? ruleItemSentence(item) : describeExpr(operand, scope);
    });
    return [{
      subject: "Cualquiera de estas condiciones",
      relation: "puede cumplirse",
      values: options,
    }];
  }

  return [{
    subject: "Regla técnica importada",
    relation: describeExpr(expr, scope),
  }];
}

function simpleRuleItem(expr: Expr, scope: LogicScope): RuleBreakdownItem | null {
  if (expr.kind === "compare") {
    const presence = presenceCompare(expr);
    if (presence) {
      return {
        subject: describeOperand(expr.left, scope),
        relation: presence === "answered" ? "tiene respuesta" : "está vacía",
      };
    }
    const variableName = expr.left.kind === "ref" ? expr.left.name : undefined;
    return {
      subject: describeOperand(expr.left, scope),
      relation: `${compareLabel(expr.op)} `,
      value: describeOperand(expr.right, scope, {}, variableName),
    };
  }

  const selected = selectedRuleParts(expr);
  if (selected) {
    const variable = scope.variables.find((candidate) => candidate.name === selected.variableName);
    const value = variable?.listName
      ? choiceLabel(variable.listName, selected.value, scope)
      : selected.value;
    return {
      subject: variableLabel(selected.variableName, scope),
      relation: selected.negated ? "no incluye " : "incluye ",
      value,
    };
  }

  return null;
}

function multiSelectedRuleItem(expr: Expr, scope: LogicScope): RuleBreakdownItem | null {
  if (expr.kind !== "logical" || expr.op !== "or" || expr.operands.length < 2) return null;
  const parts = expr.operands.map(selectedRuleParts);
  if (parts.some((part) => !part || part.negated)) return null;
  const first = parts[0];
  if (!first) return null;
  if (parts.some((part) => part?.variableName !== first.variableName)) return null;
  const variable = scope.variables.find((candidate) => candidate.name === first.variableName);
  const values = parts.map((part) => {
    const raw = part?.value ?? "";
    return variable?.listName ? choiceLabel(variable.listName, raw, scope) : raw;
  });
  return {
    subject: variableLabel(first.variableName, scope),
    relation: "incluye cualquiera de estas opciones",
    values,
  };
}

function selectedRuleParts(expr: Expr): { variableName: string; value: string; negated: boolean } | null {
  if (expr.kind === "call" && expr.name === "selected" && expr.args.length === 2) {
    const variable = expr.args[0];
    const value = expr.args[1];
    if (variable?.kind === "ref" && value?.kind === "literal") {
      return { variableName: variable.name, value: String(value.value), negated: false };
    }
  }
  if (
    expr.kind === "not" &&
    expr.operand.kind === "call" &&
    expr.operand.name === "selected" &&
    expr.operand.args.length === 2
  ) {
    const variable = expr.operand.args[0];
    const value = expr.operand.args[1];
    if (variable?.kind === "ref" && value?.kind === "literal") {
      return { variableName: variable.name, value: String(value.value), negated: true };
    }
  }
  return null;
}

function ruleItemSentence(item: RuleBreakdownItem): string {
  if (item.values?.length) {
    return `${item.subject} ${item.relation}: ${item.values.join(", ")}`;
  }
  return `${item.subject} ${item.relation}${item.value ?? ""}`.trim();
}

function describeExpression(
  expression: string,
  scope: LogicScope,
  options: { currentLabel?: string } = {},
): HumanizedExpression {
  const raw = expression.trim();
  if (!raw) {
    return { summary: "Sin condición", raw, technical: false };
  }

  const ast = parseExpression(raw);
  if (!ast) {
    return { summary: "Regla vacía", raw, technical: false };
  }

  const summary = describeExpr(ast, scope, options);
  return {
    summary,
    raw: exprRaw(ast, raw),
    technical: summary === "Regla técnica importada",
  };
}

function describeValidation(
  expression: string,
  node: BuilderNode,
  scope: LogicScope,
): (HumanizedExpression & { status: string }) | null {
  const raw = expression.trim();
  if (!raw) return null;
  const ast = parseExpression(raw);
  if (!ast) {
    return {
      summary: "Validación técnica importada",
      raw,
      technical: true,
      status: "Regla técnica preservada",
    };
  }

  const known = knownValidation(ast, raw, node.typeInfo.base);
  if (known) {
    return {
      summary: known,
      raw: exprRaw(ast, raw),
      technical: false,
      status: "Preset claro",
    };
  }

  const editable = isConstraintVisuallyEditable(ast);
  const described = describeExpression(raw, scope, { currentLabel: "La respuesta" });
  return {
    ...described,
    technical: !editable || described.technical,
    status: editable ? "Editable visualmente" : "Regla técnica preservada",
  };
}

function describeExpr(
  expr: Expr,
  scope: LogicScope,
  options: { currentLabel?: string } = {},
): string {
  if (expr.kind === "logical") {
    const connector = expr.op === "and" ? " y " : " o ";
    return expr.operands
      .map((operand) => describeExpr(operand, scope, options))
      .join(connector);
  }

  if (expr.kind === "compare") {
    const presence = presenceCompare(expr);
    if (presence) {
      return `${describeOperand(expr.left, scope, options)} ${
        presence === "answered" ? "tiene respuesta" : "está vacía"
      }`;
    }
    const variableName = expr.left.kind === "ref" ? expr.left.name : undefined;
    return [
      describeOperand(expr.left, scope, options),
      compareLabel(expr.op),
      describeOperand(expr.right, scope, options, variableName),
    ].join(" ");
  }

  if (expr.kind === "call" && expr.name === "selected" && expr.args.length === 2) {
    const variable = expr.args[0];
    const value = expr.args[1];
    const variableName = variable.kind === "ref" ? variable.name : undefined;
    return `${describeOperand(variable, scope, options)} incluye ${describeOperand(value, scope, options, variableName)}`;
  }

  if (
    expr.kind === "not" &&
    expr.operand.kind === "call" &&
    expr.operand.name === "selected" &&
    expr.operand.args.length === 2
  ) {
    const variable = expr.operand.args[0]!;
    const value = expr.operand.args[1]!;
    const variableName = variable.kind === "ref" ? variable.name : undefined;
    return `${describeOperand(variable, scope, options)} no incluye ${describeOperand(value, scope, options, variableName)}`;
  }

  if (expr.kind === "not") {
    return `No se cumple: ${describeExpr(expr.operand, scope, options)}`;
  }

  if (expr.kind === "call" && expr.name === "today") return "hoy";
  if (expr.kind === "call" && expr.name === "now") return "ahora";
  if (expr.kind === "literal") return literalLabel(expr.value);
  if (expr.kind === "ref" || expr.kind === "current") return describeOperand(expr, scope, options);

  return "Regla técnica importada";
}

function describeOperand(
  expr: Expr,
  scope: LogicScope,
  options: { currentLabel?: string } = {},
  valueForVariableName?: string,
): string {
  if (expr.kind === "current") return options.currentLabel ?? "La respuesta";
  if (expr.kind === "ref") return variableLabel(expr.name, scope);
  if (expr.kind === "literal") {
    const listName = valueForVariableName
      ? scope.variables.find((variable) => variable.name === valueForVariableName)?.listName
      : undefined;
    if (listName) return choiceLabel(listName, String(expr.value), scope);
    return literalLabel(expr.value);
  }
  if (expr.kind === "call" && expr.name === "today") return "hoy";
  if (expr.kind === "call" && expr.name === "now") return "ahora";
  return describeExpr(expr, scope, options);
}

function variableLabel(name: string, scope: LogicScope): string {
  const variable = scope.variables.find((candidate) => candidate.name === name);
  return stripMarkdown(variable?.label || name);
}

function choiceLabel(listName: string, rawValue: string, scope: LogicScope): string {
  const item = scope.catalogsByListName
    .get(listName)
    ?.items.find((choice) => choice.name === rawValue);
  return stripMarkdown(item?.label || rawValue);
}

function literalLabel(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "sí" : "no";
  if (value === "") return "vacío";
  return String(value);
}

function presenceCompare(expr: Expr): "answered" | "empty" | null {
  if (expr.kind !== "compare") return null;
  if (expr.right.kind !== "literal" || expr.right.value !== "") return null;
  if (expr.left.kind !== "ref" && expr.left.kind !== "current") return null;
  if (expr.op === "!=") return "answered";
  if (expr.op === "=") return "empty";
  return null;
}

function compareLabel(op: string): string {
  switch (op) {
    case "=":
      return "es";
    case "!=":
      return "no es";
    case "<":
      return "es menor que";
    case "<=":
      return "es menor o igual que";
    case ">":
      return "es mayor que";
    case ">=":
      return "es mayor o igual que";
    default:
      return op;
  }
}

function exprRaw(expr: Expr, fallback: string): string {
  try {
    return serializeExpression(expr);
  } catch {
    return fallback;
  }
}

function isConstraintVisuallyEditable(expr: Expr): boolean {
  if (tryFlattenConstraint(expr)) return true;
  if (expr.kind !== "logical") return false;
  return expr.operands.every((operand) => Boolean(tryFlattenConstraint(operand)));
}

function knownValidation(expr: Expr, raw: string, baseType: string): string | null {
  const normalized = raw.toLowerCase().replace(/\s+/g, "");
  if (expr.kind === "call" && expr.name === "regex" && expr.args[0]?.kind === "current") {
    const pattern = expr.args[1]?.kind === "literal" ? String(expr.args[1].value).toLowerCase() : normalized;
    if (pattern.includes("@")) return "La respuesta debe tener formato de correo electrónico.";
    if (pattern.includes("http")) return "La respuesta debe ser una URL válida.";
    if (pattern.includes("\\d") || pattern.includes("[0-9]")) return "La respuesta debe contener solo dígitos.";
  }
  if (baseType === "date" && normalized.includes("<=today()")) {
    return "La fecha no puede ser posterior a hoy.";
  }
  if (normalized === ".>=0") return "La respuesta debe ser cero o mayor.";
  if (normalized === ".>0") return "La respuesta debe ser mayor que cero.";
  return null;
}

function validationPresetsFor(node: BuilderNode): ValidationPreset[] {
  switch (node.typeInfo.base) {
    case "text":
      return [
        {
          id: "email",
          label: "Correo electrónico",
          hint: "Acepta respuestas con formato nombre@dominio.",
          expression: "regex(., '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$')",
          message: "Ingresa un correo electrónico válido.",
        },
        {
          id: "url",
          label: "URL",
          hint: "Acepta enlaces que empiezan con http:// o https://.",
          expression: "regex(., '^https?://.+')",
          message: "Ingresa una URL válida.",
        },
        {
          id: "digits",
          label: "Solo dígitos",
          hint: "Acepta únicamente caracteres numéricos.",
          expression: "regex(., '^\\d+$')",
          message: "Ingresa solo números.",
        },
      ];
    case "integer":
    case "decimal":
      return [
        {
          id: "non-negative",
          label: "No negativo",
          hint: "Acepta cero o valores mayores.",
          expression: ". >= 0",
          message: "Ingresa un valor igual o mayor que cero.",
        },
        {
          id: "positive",
          label: "Mayor que cero",
          hint: "Rechaza cero y valores negativos.",
          expression: ". > 0",
          message: "Ingresa un valor mayor que cero.",
        },
      ];
    case "date":
      return [
        {
          id: "not-future",
          label: "No futura",
          hint: "La fecha debe ser hoy o anterior.",
          expression: ". <= today()",
          message: "La fecha no puede ser posterior a hoy.",
        },
      ];
    default:
      return [];
  }
}

function shouldOfferPresentationTab(node: BuilderNode): boolean {
  if (node.appearance.trim()) return true;
  if (node.kind === "section" || node.kind === "repeat") return true;
  return [
    "select_one",
    "select_multiple",
    "integer",
    "decimal",
    "date",
    "image",
    "audio",
    "video",
    "file",
    "barcode",
    "geopoint",
    "geotrace",
    "geoshape",
  ].includes(node.typeInfo.base);
}
