import "../styles/xf-canvas.css";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Calculator,
  CheckCircle2,
  Database,
  Eye,
  FileText,
  ImagePlus,
  Info,
  Layers3,
  LayoutList,
  ListChecks,
  Mic,
  Paintbrush,
  Repeat,
  Settings2,
  ShieldCheck,
  Trash2,
  Video,
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
import { TextRuleSuite } from "../inspector/logic/TextRuleSuite";
import { matchTextRule } from "../inspector/logic/textRules";
import { TechTerm } from "../helpers/TechTerm";

export type FocusWorkspaceMode = "focus" | "overview";

type FormCanvasBundle = Omit<FormCanvasProps, "workbook" | "structure" | "selectedRow">;

export type SectionBoundaryState = {
  itemCount: number;
  closeLabel: string;
  closeDetail: string;
  nextLabel: string | null;
  lastChildLabel: string | null;
  canIncludeNext: boolean;
  canReleaseLast: boolean;
};

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
  sectionBoundary: SectionBoundaryState | null;
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
  onIncludeNextInSection: () => void;
  onReleaseLastFromSection: () => void;
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
  sectionBoundary,
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
  onIncludeNextInSection,
  onReleaseLastFromSection,
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
            sectionBoundary={sectionBoundary}
            choiceColumns={choiceFilterColumnsFromWorkbook(workbook)}
            logicScope={logicScope}
            onFieldChange={onFieldChange}
            onFieldsChange={onFieldsChange}
            onTypeChange={onTypeChange}
            onRequiredChange={onRequiredChange}
            onCatalogAssign={onCatalogAssign}
            onCatalogCreate={onCatalogCreate}
            onOpenCatalogLens={onOpenCatalogLens}
            onCloneCatalog={onCloneCatalog}
            onIncludeNextInSection={onIncludeNextInSection}
            onReleaseLastFromSection={onReleaseLastFromSection}
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
    const kicker = node.kind === "section" || node.kind === "repeat"
      ? "Bloque seleccionado"
      : node.kind === "note"
        ? "Nota seleccionada"
        : node.kind === "calculate"
          ? "Cálculo seleccionado"
          : "Pregunta seleccionada";
    return {
      kicker,
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
  const mediaCount = [
    node.mediaImage,
    node.mediaAudio,
    node.mediaVideo,
  ].filter((value) => value?.trim()).length;
  const repeatCount = node.kind === "repeat" ? (node.repeat_count ?? "").trim() : "";
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
      label: isSelect && catalogUsageCount > 1 ? `${catalogUsageCount} usos` : "Lista",
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

  if (mediaCount > 0) {
    items.push({
      key: "prompt-media",
      label: "Consigna",
      value: `${mediaCount} ${mediaCount === 1 ? "adjunto" : "adjuntos"}`,
      tone: "accent",
      icon: <ImagePlus size={12} />,
    });
  }

  if (node.kind === "repeat") {
    items.push({
      key: "repeat-count",
      label: "Repetición",
      value: repeatCount ? "Con límite" : "Manual",
      tone: repeatCount ? "accent" : "neutral",
      icon: <Repeat size={12} />,
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
  sectionBoundary,
  choiceColumns,
  logicScope,
  onFieldChange,
  onFieldsChange,
  onTypeChange,
  onRequiredChange,
  onCatalogAssign,
  onCatalogCreate,
  onOpenCatalogLens,
  onCloneCatalog,
  onIncludeNextInSection,
  onReleaseLastFromSection,
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
  sectionBoundary: SectionBoundaryState | null;
  choiceColumns: string[];
  logicScope: LogicScope;
  onFieldChange: (field: string, value: string) => void;
  onFieldsChange: (updates: Record<string, string>) => void;
  onTypeChange: (next: string) => void;
  onRequiredChange: (checked: boolean) => void;
  onCatalogAssign: (listName: string) => void;
  onCatalogCreate: () => void;
  onOpenCatalogLens: (focusListName: string) => void;
  onCloneCatalog?: () => void;
  onIncludeNextInSection: () => void;
  onReleaseLastFromSection: () => void;
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
          sectionBoundary={sectionBoundary}
          onFieldChange={onFieldChange}
          onCloneCatalog={onCloneCatalog}
          onOpenCatalogLens={onOpenCatalogLens}
          onIncludeNextInSection={onIncludeNextInSection}
          onReleaseLastFromSection={onReleaseLastFromSection}
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
            <ContentTab
              node={node}
              onFieldChange={onFieldChange}
              onFieldsChange={onFieldsChange}
            />
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
              sectionBoundary={sectionBoundary}
              onTypeChange={onTypeChange}
              onFieldChange={onFieldChange}
              onRequiredChange={onRequiredChange}
              onCatalogAssign={onCatalogAssign}
              onCatalogCreate={onCatalogCreate}
              onOpenCatalogLens={onOpenCatalogLens}
              onCloneCatalog={onCloneCatalog}
              onIncludeNextInSection={onIncludeNextInSection}
              onReleaseLastFromSection={onReleaseLastFromSection}
              onSelectRow={onSelectRow}
            />
          )}
          {activeTab === "rules" && (
            <RulesTab
              node={node}
              scope={logicScope}
              choiceColumns={choiceColumns}
              conditionalContext={conditionalContext}
              onFieldChange={onFieldChange}
              onFieldsChange={onFieldsChange}
            />
          )}
          {activeTab === "presentation" && (
            <PresentationTab node={node} onFieldChange={onFieldChange} />
          )}
          {activeTab === "data" && (
            <DataTab
              node={node}
              structure={structure}
              catalogInfo={catalogInfo}
              catalogUsageCount={catalogUsageCount}
              onFieldChange={onFieldChange}
            />
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
  sectionBoundary,
  onFieldChange,
  onCloneCatalog,
  onOpenCatalogLens,
  onIncludeNextInSection,
  onReleaseLastFromSection,
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
  sectionBoundary: SectionBoundaryState | null;
  onFieldChange: (field: string, value: string) => void;
  onCloneCatalog?: () => void;
  onOpenCatalogLens: (focusListName: string) => void;
  onIncludeNextInSection: () => void;
  onReleaseLastFromSection: () => void;
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
        <SectionBoundaryControl
          boundary={sectionBoundary}
          onIncludeNext={onIncludeNextInSection}
          onReleaseLast={onReleaseLastFromSection}
        />
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
    : node.kind === "note"
      ? "No guarda respuesta; solo muestra contenido de apoyo."
    : node.kind === "calculate"
      ? "Se completa con una fórmula del XLSForm."
      : "Respuesta directa del encuestador.";
  const hasVisibility = Boolean(node.relevant.trim()) || Boolean(conditionalContext?.ancestorRelevants.length);
  const visibility = summarizeVisibilityForQuicklook(node, conditionalContext, logicScope);
  const validation = node.kind === "note" ? null : describeValidation(node.constraint, node, logicScope);
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
      tone: node.typeInfo.listName ? "accent" : node.kind === "note" ? "success" : "muted",
    },
    {
      label: "Obligatoriedad",
      title: node.kind === "note" ? "Sin captura" : node.required ? "Obligatoria" : "Opcional",
      detail: node.kind === "note"
        ? "La nota se muestra como apoyo y no pide entrada."
        : node.required
        ? hasVisibility
          ? "Se exige solo cuando la pregunta aparece."
          : "El encuestador debe responderla."
        : "Puede quedar sin respuesta.",
      icon: CheckCircle2,
      tone: node.required || node.kind === "note" ? "success" : "muted",
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
      title: node.kind === "note" ? "No aplica" : validation ? validation.status : "Sin validación",
      detail: node.kind === "note"
        ? "Las notas no validan respuestas."
        : validation?.summary ?? "Acepta el valor propio del tipo seleccionado.",
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

function SectionBoundaryControl({
  boundary,
  onIncludeNext,
  onReleaseLast,
}: {
  boundary: SectionBoundaryState | null;
  onIncludeNext: () => void;
  onReleaseLast: () => void;
}) {
  if (!boundary) return null;
  return (
    <div className="pulso-focus-section-boundary" aria-label="Alcance del bloque">
      <div className="pulso-focus-section-boundary-head">
        <span className="pulso-section-eyebrow">Cierre XLSForm</span>
        <strong>{boundary.closeLabel}</strong>
      </div>
      <p>{boundary.closeDetail}</p>
      <div className="pulso-focus-section-boundary-actions">
        <button
          type="button"
          className="pulso-focus-section-boundary-button is-primary"
          onClick={onIncludeNext}
          disabled={!boundary.canIncludeNext}
          title={
            boundary.nextLabel
              ? `Mover el cierre para incluir "${boundary.nextLabel}"`
              : "No hay una pieza siguiente para incluir"
          }
        >
          <ArrowDown size={13} />
          <span>Incluir siguiente pieza</span>
        </button>
        <button
          type="button"
          className="pulso-focus-section-boundary-button"
          onClick={onReleaseLast}
          disabled={!boundary.canReleaseLast}
          title={
            boundary.lastChildLabel
              ? `Mover el cierre antes de "${boundary.lastChildLabel}"`
              : "El bloque no tiene piezas para sacar"
          }
        >
          <ArrowUp size={13} />
          <span>Sacar última pieza</span>
        </button>
      </div>
      <div className="pulso-focus-section-boundary-hint">
        {boundary.nextLabel ? (
          <span>
            Siguiente fuera del bloque: <strong>{boundary.nextLabel}</strong>
          </span>
        ) : (
          <span>No hay más piezas al mismo nivel para sumar a este bloque.</span>
        )}
        {boundary.lastChildLabel && (
          <span>
            Última dentro: <strong>{boundary.lastChildLabel}</strong>
          </span>
        )}
      </div>
    </div>
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
  onFieldsChange,
}: {
  node: BuilderNode;
  onFieldChange: (field: string, value: string) => void;
  onFieldsChange: (updates: Record<string, string>) => void;
}) {
  const isSection = node.kind === "section" || node.kind === "repeat";
  return (
    <div className="pulso-focus-tab-panel">
      <InspectorBlock>
        <InspectorField
          label={isSection ? "Título del bloque" : "Texto principal"}
          hint={
            isSection
              ? "Nombre visible de la sección o repetición."
              : node.kind === "note"
                ? "La nota o instrucción que verá el encuestador."
                : "La pregunta que verá el encuestado."
          }
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
      {node.kind === "note" && (
        <NoteAuthoringPanel onFieldsChange={onFieldsChange} />
      )}
    </div>
  );
}

type NotePreset = {
  id: string;
  label: string;
  hint: string;
  title: string;
  body: string;
  mediaImage?: string;
};

const NOTE_AUTHORING_PRESETS: NotePreset[] = [
  {
    id: "instruction",
    label: "Instrucción de campo",
    hint: "Indicación breve antes de una pregunta o bloque.",
    title: "Antes de continuar",
    body: "Lee esta indicación a la persona encuestada y confirma que quedó clara.",
  },
  {
    id: "chart",
    label: "Gráfico o imagen",
    hint: "Nota con imagen de apoyo vinculada por media::image.",
    title: "Revisa el gráfico de referencia",
    body: "Usa la imagen para explicar la siguiente pregunta. Si no se visualiza, continúa con la consigna escrita.",
    mediaImage: "grafico_referencia.png",
  },
  {
    id: "consent",
    label: "Recordatorio de consentimiento",
    hint: "Pauta ética sin pedir respuesta.",
    title: "Recordatorio importante",
    body: "La participación es voluntaria. La persona puede decidir no responder una pregunta si no se siente cómoda.",
  },
  {
    id: "separator",
    label: "Separador de tema",
    hint: "Transición clara dentro del formulario.",
    title: "Nueva sección",
    body: "Ahora revisaremos un tema distinto. Tómate un momento para confirmar que la persona está lista.",
  },
];

function NoteAuthoringPanel({
  onFieldsChange,
}: {
  onFieldsChange: (updates: Record<string, string>) => void;
}) {
  return (
    <InspectorBlock>
      <div className="pulso-focus-note-authoring" aria-label="Atajos para nota">
        <div className="pulso-focus-note-authoring-head">
          <span className="pulso-focus-note-authoring-icon" aria-hidden="true">
            <FileText size={14} />
          </span>
          <div>
            <span className="pulso-section-eyebrow">Nota Kobo</span>
            <strong>Insertar texto de apoyo sin capturar respuesta</strong>
            <p>Úsala para instrucciones, consentimiento, separadores o gráficos de referencia.</p>
          </div>
        </div>
        <div className="pulso-focus-note-preset-grid">
          {NOTE_AUTHORING_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="pulso-focus-note-preset"
              onClick={() => {
                onFieldsChange({
                  label: preset.title,
                  hint: preset.body,
                  ...(preset.mediaImage ? { "media::image": preset.mediaImage } : {}),
                });
              }}
              title={preset.hint}
            >
              <span className="pulso-focus-note-preset-icon" aria-hidden="true">
                {preset.mediaImage ? <ImagePlus size={13} /> : <CheckCircle2 size={13} />}
              </span>
              <span className="pulso-focus-note-preset-copy">
                <strong>{preset.label}</strong>
                <small>{preset.hint}</small>
              </span>
              {preset.mediaImage && <code>media</code>}
            </button>
          ))}
        </div>
      </div>
    </InspectorBlock>
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
  sectionBoundary,
  onTypeChange,
  onFieldChange,
  onRequiredChange,
  onCatalogAssign,
  onCatalogCreate,
  onOpenCatalogLens,
  onCloneCatalog,
  onIncludeNextInSection,
  onReleaseLastFromSection,
  onSelectRow,
}: {
  node: BuilderNode;
  section: SectionMeta | null;
  catalogs: CatalogSummary[];
  logicScope: LogicScope;
  catalogUsageCount: number;
  catalogInfo?: CatalogInfo;
  conditionalContext?: ConditionalContext | null;
  sectionBoundary: SectionBoundaryState | null;
  onTypeChange: (next: string) => void;
  onFieldChange: (field: string, value: string) => void;
  onRequiredChange: (checked: boolean) => void;
  onCatalogAssign: (listName: string) => void;
  onCatalogCreate: () => void;
  onOpenCatalogLens: (focusListName: string) => void;
  onCloneCatalog?: () => void;
  onIncludeNextInSection: () => void;
  onReleaseLastFromSection: () => void;
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
          <SectionBoundaryControl
            boundary={sectionBoundary}
            onIncludeNext={onIncludeNextInSection}
            onReleaseLast={onReleaseLastFromSection}
          />
        </InspectorBlock>
        {node.kind === "repeat" && (
          <InspectorBlock>
            <RepeatCountPanel
              node={node}
              scope={logicScope}
              onFieldChange={onFieldChange}
            />
          </InspectorBlock>
        )}
      </div>
    );
  }

  return (
    <div className="pulso-focus-tab-panel">
      {node.kind === "calculate" && (
        <InspectorBlock>
          <CalculationRecipePanel
            expression={node.calculation}
            scope={logicScope}
            onFieldChange={onFieldChange}
          />
          <CalculationBuilder
            expression={node.calculation}
            scope={logicScope}
            fieldLabel="Cómo se calcula"
            hint="Fórmula que completa este campo. Usa ${variable} para referenciar otras preguntas."
            onChange={(next) => onFieldChange("calculation", next)}
          />
        </InspectorBlock>
      )}

      <InspectorBlock>
        <InspectorField label="Tipo de respuesta" hint="Cómo va a contestar el encuestado.">
          <TypePicker value={node.typeInfo.base} onChange={onTypeChange} />
        </InspectorField>
      </InspectorBlock>

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
            label="Lista de opciones"
            hint="Lista que alimenta esta pregunta. Puedes reusar listas o abrir el editor de listas."
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
  const messagePresets = requiredMessagePresetsFor(node, hasCondition);

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
                    <summary>Ver regla XLSForm</summary>
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
                    <summary>Ver regla XLSForm</summary>
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
          {node.required && (
            <RequiredMessageAssistant
              value={requiredMessage}
              hasCondition={hasCondition}
              presets={messagePresets}
              onApply={(message) => onFieldChange("required_message", message)}
            />
          )}
        </InspectorField>
      )}
    </>
  );
}

type RequiredMessagePreset = {
  id: string;
  label: string;
  hint: string;
  message: string;
};

function RequiredMessageAssistant({
  value,
  hasCondition,
  presets,
  onApply,
}: {
  value: string;
  hasCondition: boolean;
  presets: RequiredMessagePreset[];
  onApply: (message: string) => void;
}) {
  const cleanValue = value.trim();
  const hasMessage = cleanValue.length > 0;
  const looksTechnical = fieldMessageLooksTechnical(cleanValue);
  const isReady = hasMessage && !looksTechnical;
  const checks = [
    {
      key: "message",
      label: hasMessage ? "Mensaje definido" : "Sin mensaje propio",
      ok: hasMessage,
    },
    {
      key: "field",
      label: "Lenguaje de campo",
      ok: hasMessage && !looksTechnical,
    },
    {
      key: "scope",
      label: hasCondition ? "Solo si aparece" : "Siempre que falte",
      ok: true,
    },
  ];
  const presetGrid = (
    <div className="pulso-focus-message-preset-grid">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className="pulso-focus-message-preset"
          onClick={() => onApply(preset.message)}
          title={preset.hint}
        >
          <span className="pulso-focus-message-preset-icon">
            <CheckCircle2 size={12} />
          </span>
          <span className="pulso-focus-message-preset-copy">
            <strong>{preset.label}</strong>
            <small>{preset.hint}</small>
            <em>{preset.message}</em>
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div className={`pulso-focus-message-presets pulso-focus-required-message-assistant${isReady ? "" : " is-warning"}`} aria-label="Asistente de mensaje obligatorio">
      <div className="pulso-focus-message-presets-head pulso-focus-required-message-head">
        <span className="pulso-focus-required-message-icon" aria-hidden="true">
          {isReady ? <CheckCircle2 size={14} /> : <IconRequired size={14} />}
        </span>
        <div>
          <span className="pulso-section-eyebrow">Mensaje Kobo</span>
          <strong>{isReady ? "Texto listo para campo" : "Define una frase amable y accionable"}</strong>
          <small>
            {hasCondition
              ? "Kobo lo muestra solo si esta pregunta aparece y queda vacía."
              : "Kobo lo muestra cuando la pregunta obligatoria queda vacía."}
          </small>
        </div>
      </div>

      <div className="pulso-focus-required-message-checks" aria-label="Revisión del mensaje obligatorio">
        {checks.map((check) => (
          <span key={check.key} className={check.ok ? "is-ok" : "is-pending"}>
            {check.ok ? <CheckCircle2 size={11} /> : <Info size={11} />}
            {check.label}
          </span>
        ))}
      </div>

      {isReady ? (
        <details className="pulso-focus-required-message-alternatives">
          <summary>Cambiar por otro texto sugerido</summary>
          {presetGrid}
        </details>
      ) : (
        presetGrid
      )}
    </div>
  );
}

function fieldMessageLooksTechnical(value: string): boolean {
  return /\b(required|constraint|constraint_message|relevant|regex|odk|xlsform|formula|fórmula|xpath)\b/i.test(
    value,
  );
}

function requiredMessagePresetsFor(
  node: BuilderNode,
  hasCondition: boolean,
): RequiredMessagePreset[] {
  const typePreset = requiredMessagePresetForType(node.typeInfo.base);
  const presets: RequiredMessagePreset[] = [
    typePreset,
  ];

  if (hasCondition) {
    presets.push({
      id: "conditional",
      label: "Solo si corresponde",
      hint: "Para preguntas que aparecen por una regla o dentro de una sección condicionada.",
      message: "Completa esta respuesta para continuar con esta sección.",
    });
  } else {
    presets.push({
      id: "continue",
      label: "Necesaria para continuar",
      hint: "Para campos obligatorios generales.",
      message: "Esta respuesta es necesaria para continuar.",
    });
  }

  presets.push(
    {
      id: "confirm",
      label: "Confirmar con la persona",
      hint: "Para datos que deben verificarse en campo.",
      message: "Confirma esta información antes de avanzar.",
    },
    {
      id: "analysis",
      label: "Dato clave del análisis",
      hint: "Para variables que no deberían quedar vacías.",
      message: "Necesitamos este dato para completar el análisis.",
    },
  );

  const unique = new Map<string, RequiredMessagePreset>();
  presets.forEach((preset) => unique.set(preset.id, preset));
  return [...unique.values()];
}

function requiredMessagePresetForType(baseType: string): RequiredMessagePreset {
  switch (baseType) {
    case "integer":
    case "decimal":
    case "range":
      return {
        id: "type-number",
        label: "Número requerido",
        hint: "Para edades, cantidades, montos o puntajes.",
        message: "Ingresa un número para continuar.",
      };
    case "select_one":
      return {
        id: "type-select-one",
        label: "Elegir una opción",
        hint: "Para preguntas de selección única.",
        message: "Selecciona una opción para continuar.",
      };
    case "select_multiple":
      return {
        id: "type-select-multiple",
        label: "Elegir al menos una",
        hint: "Para preguntas donde pueden marcarse varias respuestas.",
        message: "Selecciona al menos una opción para continuar.",
      };
    case "geopoint":
    case "geotrace":
    case "geoshape":
      return {
        id: "type-location",
        label: "Ubicación requerida",
        hint: "Para coordenadas, recorridos o áreas GPS.",
        message: "Registra la ubicación para continuar.",
      };
    case "image":
    case "audio":
    case "video":
    case "file":
      return {
        id: "type-media",
        label: "Evidencia requerida",
        hint: "Para fotos, audios, videos o archivos adjuntos.",
        message: "Adjunta la evidencia solicitada para continuar.",
      };
    default:
      return {
        id: "type-text",
        label: "Respuesta solicitada",
        hint: "Para textos, fechas, nombres o códigos.",
        message: "Completa esta respuesta para continuar.",
      };
  }
}

function CalculationRecipePanel({
  expression,
  scope,
  onFieldChange,
}: {
  expression: string;
  scope: LogicScope;
  onFieldChange: (field: string, value: string) => void;
}) {
  const variables = scope.variables.filter((variable) => variable.name.trim().length > 0);
  const multiVariables = variables.filter((variable) => variable.baseType === "select_multiple");
  const numericVariables = variables.filter(
    (variable) => variable.baseType === "integer" || variable.baseType === "decimal",
  );
  const variableOptionsKey = variables.map((variable) => variable.name).join("\u0000");
  const multiOptionsKey = multiVariables.map((variable) => variable.name).join("\u0000");
  const numericOptionsKey = numericVariables.map((variable) => variable.name).join("\u0000");
  const [copyVariable, setCopyVariable] = useState(variables[0]?.name ?? "");
  const [multiVariable, setMultiVariable] = useState(multiVariables[0]?.name ?? "");
  const [numericVariable, setNumericVariable] = useState(numericVariables[0]?.name ?? "");
  const hasExpression = expression.trim().length > 0;

  useEffect(() => {
    setCopyVariable((current) => {
      if (current && variables.some((variable) => variable.name === current)) return current;
      return variables[0]?.name ?? "";
    });
  }, [variableOptionsKey]);

  useEffect(() => {
    setMultiVariable((current) => {
      if (current && multiVariables.some((variable) => variable.name === current)) return current;
      return multiVariables[0]?.name ?? "";
    });
  }, [multiOptionsKey]);

  useEffect(() => {
    setNumericVariable((current) => {
      if (current && numericVariables.some((variable) => variable.name === current)) return current;
      return numericVariables[0]?.name ?? "";
    });
  }, [numericOptionsKey]);

  const applyFormula = (formula: string) => onFieldChange("calculation", formula);
  if (hasExpression) return null;

  return (
    <div className="pulso-focus-calculation-recipes" aria-label="Recetas rápidas de cálculo">
      <div className="pulso-focus-calculation-recipes-head">
        <span className="pulso-focus-calculation-recipes-icon" aria-hidden="true">
          <Calculator size={14} />
        </span>
        <div>
          <span className="pulso-section-eyebrow">Cálculo Kobo</span>
          <strong>Recetas frecuentes sin escribir fórmula desde cero</strong>
          <p>Aplican una fórmula XLSForm válida y dejan el editor avanzado disponible para ajustes finos.</p>
        </div>
      </div>

      <div className="pulso-focus-calculation-recipe-grid">
        <button
          type="button"
          className="pulso-focus-calculation-recipe"
          onClick={() => applyFormula("today()")}
        >
          <span>
            <strong>Fecha de hoy</strong>
            <small>Guarda la fecha del dispositivo al abrir el formulario.</small>
          </span>
          <code>today()</code>
        </button>
        <button
          type="button"
          className="pulso-focus-calculation-recipe"
          onClick={() => applyFormula("now()")}
        >
          <span>
            <strong>Momento actual</strong>
            <small>Guarda fecha y hora del dispositivo.</small>
          </span>
          <code>now()</code>
        </button>

        {variables.length > 0 && (
          <div className="pulso-focus-calculation-recipe is-builder">
            <span>
              <strong>Copiar una respuesta</strong>
              <small>Útil para conservar una versión calculada o normalizada.</small>
            </span>
            <div className="pulso-focus-calculation-recipe-row">
              <select value={copyVariable} onChange={(event) => setCopyVariable(event.target.value)}>
                {variables.map((variable) => (
                  <option key={variable.name} value={variable.name}>
                    {variableDisplayLabel(variable)}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => copyVariable && applyFormula(`\${${copyVariable}}`)}>
                Usar
              </button>
            </div>
          </div>
        )}

        {multiVariables.length > 0 && (
          <div className="pulso-focus-calculation-recipe is-builder">
            <span>
              <strong>Contar opciones marcadas</strong>
              <small>Para preguntas de selección múltiple.</small>
            </span>
            <div className="pulso-focus-calculation-recipe-row">
              <select value={multiVariable} onChange={(event) => setMultiVariable(event.target.value)}>
                {multiVariables.map((variable) => (
                  <option key={variable.name} value={variable.name}>
                    {variableDisplayLabel(variable)}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => multiVariable && applyFormula(`count-selected(\${${multiVariable}})`)}>
                Contar
              </button>
            </div>
          </div>
        )}

        {numericVariables.length > 0 && (
          <div className="pulso-focus-calculation-recipe is-builder">
            <span>
              <strong>Convertir años a meses</strong>
              <small>Multiplica una edad, antigüedad o duración numérica por 12.</small>
            </span>
            <div className="pulso-focus-calculation-recipe-row">
              <select value={numericVariable} onChange={(event) => setNumericVariable(event.target.value)}>
                {numericVariables.map((variable) => (
                  <option key={variable.name} value={variable.name}>
                    {variableDisplayLabel(variable)}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => numericVariable && applyFormula(`\${${numericVariable}} * 12`)}>
                Aplicar
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function RepeatCountPanel({
  node,
  scope,
  onFieldChange,
}: {
  node: BuilderNode;
  scope: LogicScope;
  onFieldChange: (field: string, value: string) => void;
}) {
  const value = node.repeat_count ?? "";
  const trimmed = value.trim();
  const variables = scope.variables.filter(
    (variable) =>
      variable.name.trim().length > 0 &&
      ["integer", "decimal", "calculate"].includes(variable.baseType) &&
      (typeof variable.rowIndex !== "number" || variable.rowIndex < node.rowIndex),
  );
  const variableOptionsKey = variables.map((variable) => variable.name).join("\u0000");
  const [fixedCount, setFixedCount] = useState(isPositiveInteger(trimmed) ? trimmed : "");
  const [selectedVariable, setSelectedVariable] = useState(variables[0]?.name ?? "");
  const status = describeRepeatCount(trimmed, variables);

  useEffect(() => {
    setFixedCount(isPositiveInteger(trimmed) ? trimmed : "");
  }, [trimmed]);

  useEffect(() => {
    setSelectedVariable((current) => {
      if (current && variables.some((variable) => variable.name === current)) return current;
      return variables[0]?.name ?? "";
    });
  }, [variableOptionsKey]);

  const applyFixedCount = () => {
    const next = fixedCount.trim();
    if (!isPositiveInteger(next)) return;
    onFieldChange("repeat_count", next);
  };

  const applyVariable = () => {
    if (!selectedVariable) return;
    onFieldChange("repeat_count", `\${${selectedVariable}}`);
  };

  return (
    <div className={`pulso-focus-repeat-panel ${trimmed ? "is-active" : "is-empty"} ${status.tone === "warn" ? "is-warning" : ""}`}>
      <div className="pulso-focus-repeat-head">
        <span className="pulso-focus-repeat-icon" aria-hidden="true">
          <Repeat size={14} />
        </span>
        <div>
          <span className="pulso-section-eyebrow">Repeticiones Kobo</span>
          <strong>{status.title}</strong>
          <p>{status.detail}</p>
        </div>
        {trimmed && (
          <button
            type="button"
            className="pulso-focus-repeat-clear-icon"
            onClick={() => onFieldChange("repeat_count", "")}
            aria-label="Quitar límite de repeticiones"
            title="Quitar límite"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div className="pulso-focus-repeat-builder" aria-label="Constructor de cantidad de repeticiones">
        <label className="pulso-focus-repeat-fixed">
          <span>Número fijo</span>
          <div>
            <input
              type="number"
              min="1"
              step="1"
              value={fixedCount}
              onChange={(event) => setFixedCount(event.target.value)}
              placeholder="Ej. 5"
            />
            <button type="button" onClick={applyFixedCount} disabled={!isPositiveInteger(fixedCount)}>
              Aplicar
            </button>
          </div>
        </label>

        <label className="pulso-focus-repeat-variable">
          <span>Según respuesta previa</span>
          <div>
            <select
              value={selectedVariable}
              onChange={(event) => setSelectedVariable(event.target.value)}
              disabled={variables.length === 0}
            >
              {variables.length === 0 ? (
                <option value="">Sin variables numéricas</option>
              ) : (
                variables.map((variable) => (
                  <option key={variable.name} value={variable.name}>
                    {variableDisplayLabel(variable)}
                  </option>
                ))
              )}
            </select>
            <button type="button" onClick={applyVariable} disabled={!selectedVariable}>
              Usar
            </button>
          </div>
        </label>
      </div>

      <InspectorField
        label="Regla guardada"
        hint="Vacío = el encuestador decide cuántas veces repetir. También puedes pegar una fórmula XLSForm."
      >
        <input
          type="text"
          value={value}
          onChange={(event) => onFieldChange("repeat_count", event.target.value)}
          placeholder='Ej. 5 o ${num_personas}'
          spellCheck={false}
          className="pulso-focus-repeat-formula"
        />
      </InspectorField>
    </div>
  );
}

function describeRepeatCount(
  value: string,
  variables: LogicScope["variables"],
): { tone: "empty" | "ok" | "warn"; title: string; detail: string } {
  if (!value) {
    return {
      tone: "empty",
      title: "Cantidad decidida en campo",
      detail: "Kobo preguntará al encuestador si desea agregar otra repetición.",
    };
  }
  if (isPositiveInteger(value)) {
    return {
      tone: "ok",
      title: `${value} ${value === "1" ? "repetición fija" : "repeticiones fijas"}`,
      detail: "El bloque se abrirá esa cantidad de veces.",
    };
  }
  const variable = simpleVariableReference(value);
  if (variable) {
    const match = variables.find((candidate) => candidate.name === variable);
    return {
      tone: match ? "ok" : "warn",
      title: match ? "Controlada por una respuesta" : "Referencia por revisar",
      detail: match
        ? `La cantidad sale de ${variableDisplayLabel(match)}.`
        : `No encuentro ${value} entre las variables actuales del formulario.`,
    };
  }
  return {
    tone: "warn",
    title: "Fórmula avanzada",
    detail: "Se preserva como repeat_count; confirma que devuelve un número entero positivo.",
  };
}

function isPositiveInteger(value: string): boolean {
  return /^[1-9]\d*$/.test(value.trim());
}

function simpleVariableReference(value: string): string | null {
  const match = /^\$\{([^}]+)\}$/.exec(value.trim());
  return match?.[1]?.trim() || null;
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

function choiceFilterColumnsFromWorkbook(workbook: XlsformEditorWorkbook | null): string[] {
  if (!workbook) return [];
  const reservedColumns = new Set([
    "list_name",
    "name",
    "label",
    "image",
    "media::image",
    "audio",
    "media::audio",
    "video",
    "media::video",
    "paper_skip",
  ]);

  const candidates = workbook.choices.columns
    .map((column) => column.trim())
    .filter((column) => {
      const normalized = column.toLowerCase();
      return (
        column.length > 0 &&
        !reservedColumns.has(normalized) &&
        !normalized.startsWith("label::") &&
        !normalized.startsWith("image::") &&
        !normalized.startsWith("media::")
      );
    });

  return Array.from(new Set(candidates));
}

function RulesTab({
  node,
  scope,
  choiceColumns,
  conditionalContext,
  onFieldChange,
  onFieldsChange,
}: {
  node: BuilderNode;
  scope: LogicScope;
  choiceColumns: string[];
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
  const constraintMessage = node.constraint_message ?? "";
  const validation = describeValidation(node.constraint, node, scope);
  // Si el constraint es una receta de texto reconocida, el ConstraintBuilder
  // la muestra en modo humano editable (TextRuleSuite) — eso gana sobre el
  // aviso "Preset claro" legado, que ocultaba la edición paramétrica.
  const constraintTextRule = node.constraint.trim()
    ? matchTextRule(parseExpression(node.constraint))
    : null;
  const isGuidedPreset =
    validation?.status === "Preset claro" && !constraintTextRule;
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
          targetNoun={targetNoun}
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
            onFieldsChange={onFieldsChange}
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
              // Re-monta al cambiar de pregunta (mismo criterio que LogicTab):
              // descarta borradores internos de la fila previa.
              key={node.rowIndex}
              expression={node.constraint}
              scope={scope}
              baseType={node.typeInfo.base}
              listName={node.typeInfo.listName || undefined}
              fieldLabel="Cómo se valida la respuesta"
              hint="Define qué condición debe cumplir la respuesta. Puedes partir de un preset o editar la regla manualmente."
              onChange={(next) => onFieldChange("constraint", next)}
              onApplyPreset={({ expression, message }) => {
                onFieldsChange({ constraint: expression, constraint_message: message });
              }}
              showShortcuts={false}
            />
          )}
          {(node.constraint || constraintMessage) && (
            <ConstraintMessageField
              node={node}
              validation={validation}
              value={constraintMessage}
              onFieldChange={onFieldChange}
            />
          )}
        </InspectorBlock>
      )}

      {isSelect && (
        <InspectorBlock>
          <ChoiceFilterPanel
            node={node}
            scope={scope}
            choiceColumns={choiceColumns}
            onFieldChange={onFieldChange}
          />
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

function ChoiceFilterPanel({
  node,
  scope,
  choiceColumns,
  onFieldChange,
}: {
  node: BuilderNode;
  scope: LogicScope;
  choiceColumns: string[];
  onFieldChange: (field: string, value: string) => void;
}) {
  const currentFilter = node.choiceFilter ?? "";
  const hasFilter = currentFilter.trim().length > 0;
  const variables = scope.variables.filter((variable) => variable.name.trim().length > 0);
  const priorVariables = variables.filter(
    (variable) => variable.rowIndex == null || variable.rowIndex < node.rowIndex,
  );
  const controllingVariables = priorVariables.length > 0 ? priorVariables : variables;
  const [draftColumn, setDraftColumn] = useState(choiceColumns[0] ?? "");
  const [draftVariable, setDraftVariable] = useState(controllingVariables[0]?.name ?? "");
  const variableOptionsKey = controllingVariables.map((variable) => variable.name).join("\u0000");
  const columnOptionsKey = choiceColumns.join("\u0000");
  const status = describeChoiceFilter(currentFilter, scope, choiceColumns);
  const selectedVariable = controllingVariables.find((variable) => variable.name === draftVariable);
  const simpleFilter = parseSimpleChoiceFilter(currentFilter);
  const filterHasComparison = /(?:!=|<=|>=|=|<|>\b|\bselected\s*\()/i.test(currentFilter);
  const suggestions = buildChoiceFilterSuggestions(node, choiceColumns, controllingVariables, currentFilter);
  const checks = [
    {
      key: "columns",
      label: choiceColumns.length > 0 ? "Columnas en choices" : "Añade columnas en choices",
      ok: choiceColumns.length > 0,
    },
    {
      key: "variable",
      label: controllingVariables.length > 0 ? "Respuesta previa" : "Falta respuesta previa",
      ok: controllingVariables.length > 0,
    },
    {
      key: "comparison",
      label: hasFilter ? "Regla comparativa" : "Sin filtro aplicado",
      ok: hasFilter && filterHasComparison,
    },
    {
      key: "column",
      label: simpleFilter?.column ? `Columna ${simpleFilter.column}` : "Columna por definir",
      ok: Boolean(simpleFilter?.column && (!choiceColumns.length || choiceColumns.includes(simpleFilter.column))),
    },
  ];
  const canApplyTemplate = draftColumn.trim().length > 0 && draftVariable.trim().length > 0;
  const datalistId = `pulso-choice-filter-columns-${node.rowIndex}`;

  useEffect(() => {
    setDraftColumn((current) => {
      if (current.trim() && (!choiceColumns.length || choiceColumns.includes(current))) return current;
      return choiceColumns[0] ?? "";
    });
  }, [columnOptionsKey]);

  useEffect(() => {
    setDraftVariable((current) => {
      if (current && controllingVariables.some((variable) => variable.name === current)) return current;
      return controllingVariables[0]?.name ?? "";
    });
  }, [variableOptionsKey]);

  const applyTemplate = () => {
    const column = draftColumn.trim();
    const variable = draftVariable.trim();
    if (!column || !variable) return;
    onFieldChange("choice_filter", `${column}=\${${variable}}`);
  };

  const applySuggestion = (expression: string) => {
    onFieldChange("choice_filter", expression);
    const suggestion = parseSimpleChoiceFilter(expression);
    if (suggestion) {
      setDraftColumn(suggestion.column);
      setDraftVariable(suggestion.variable);
    }
  };

  const suggestionGrid = suggestions.length > 0 ? (
    <div className="pulso-focus-choice-filter-suggestion-grid">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.expression}
          type="button"
          className="pulso-focus-choice-filter-suggestion"
          onClick={() => applySuggestion(suggestion.expression)}
          title={suggestion.detail}
        >
          <span>
            <strong>{suggestion.title}</strong>
            <small>{suggestion.detail}</small>
          </span>
          <code>{suggestion.expression}</code>
        </button>
      ))}
    </div>
  ) : null;

  const insertVariableReference = (variableName: string) => {
    const token = `\${${variableName}}`;
    const separator = currentFilter.trim().length > 0 && !currentFilter.endsWith(" ") ? " " : "";
    onFieldChange("choice_filter", `${currentFilter}${separator}${token}`);
  };

  return (
    <div className={`pulso-focus-choice-filter ${hasFilter ? "is-active" : "is-empty"} ${status.tone === "warn" ? "is-warning" : ""}`}>
      <div className="pulso-focus-choice-filter-head">
        <span className="pulso-focus-choice-filter-icon" aria-hidden="true">
          <IconConditionalLogic size={14} />
        </span>
        <div>
          <span className="pulso-section-eyebrow">Filtro de opciones Kobo</span>
          <strong>{hasFilter ? "Lista condicionada" : "Lista completa"}</strong>
          <p>
            Para cascadas como departamento, provincia y distrito: Kobo guarda esta regla en <code>choice_filter</code>.
          </p>
        </div>
        <code className="pulso-focus-choice-filter-code">choice_filter</code>
      </div>

      <div className="pulso-focus-choice-filter-state">
        {status.tone === "ok" ? <CheckCircle2 size={14} /> : <Info size={14} />}
        <div>
          <strong>{status.title}</strong>
          <p>{status.detail}</p>
          {status.references.length > 0 && (
            <div className="pulso-focus-choice-filter-refs" aria-label="Variables usadas por el filtro">
              {status.references.map((variable) => (
                <span key={variable.name}>{variableDisplayLabel(variable)}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pulso-focus-choice-filter-checks" aria-label="Revisión rápida del filtro de opciones">
        {checks.map((check) => (
          <span key={check.key} className={check.ok ? "is-ok" : "is-pending"}>
            {check.ok ? <CheckCircle2 size={11} /> : <Info size={11} />}
            {check.label}
          </span>
        ))}
      </div>

      {suggestionGrid && status.tone === "ok" ? (
        <details className="pulso-focus-choice-filter-suggestions pulso-focus-choice-filter-suggestions-compact">
          <summary>Cambiar por otra cascada sugerida</summary>
          {suggestionGrid}
        </details>
      ) : suggestionGrid ? (
        <div className="pulso-focus-choice-filter-suggestions" aria-label="Atajos sugeridos para filtros de opciones">
          <div className="pulso-focus-choice-filter-suggestions-head">
            <strong>Cascadas sugeridas</strong>
            <small>Atajos seguros desde columnas detectadas y respuestas previas.</small>
          </div>
          {suggestionGrid}
        </div>
      ) : null}

      <div className="pulso-focus-choice-filter-builder" aria-label="Constructor de filtro de opciones">
        <div className="pulso-focus-choice-filter-builder-head">
          <strong>Constructor rápido</strong>
          <small>Une una columna de la lista con una respuesta previa.</small>
        </div>
        <div className="pulso-focus-choice-filter-builder-row">
          <label>
            <span>Columna en choices</span>
            <input
              type="text"
              list={datalistId}
              value={draftColumn}
              onChange={(event) => setDraftColumn(event.target.value)}
              placeholder="Ej. region"
              spellCheck={false}
            />
            <datalist id={datalistId}>
              {choiceColumns.map((column) => (
                <option key={column} value={column} />
              ))}
            </datalist>
          </label>
          <label>
            <span>Respuesta que controla</span>
            <select
              value={draftVariable}
              onChange={(event) => setDraftVariable(event.target.value)}
              disabled={controllingVariables.length === 0}
            >
              {controllingVariables.length === 0 ? (
                <option value="">Sin variables disponibles</option>
              ) : (
                controllingVariables.map((variable) => (
                  <option key={variable.name} value={variable.name}>
                    {variableDisplayLabel(variable)}
                  </option>
                ))
              )}
            </select>
          </label>
          <button
            type="button"
            className="pulso-focus-choice-filter-apply"
            onClick={applyTemplate}
            disabled={!canApplyTemplate}
            title={selectedVariable ? `Usar ${selectedVariable.name}` : "Elige una variable"}
          >
            <IconConditionalLogic size={12} />
            Aplicar
          </button>
        </div>
        {choiceColumns.length > 0 && (
          <div className="pulso-focus-choice-filter-chips" aria-label="Columnas detectadas en choices">
            {choiceColumns.slice(0, 8).map((column) => (
              <button key={column} type="button" onClick={() => setDraftColumn(column)}>
                {column}
              </button>
            ))}
          </div>
        )}
      </div>

      <InspectorField
        label="Regla guardada"
        hint="Ej. region=${region}. La parte antes del igual debe existir como columna en choices."
      >
        <textarea
          value={currentFilter}
          onChange={(event) => onFieldChange("choice_filter", event.target.value)}
          placeholder="Ej. region=${region}"
          rows={2}
          spellCheck={false}
        />
      </InspectorField>

      <div className="pulso-focus-choice-filter-actions">
        <div className="pulso-focus-choice-filter-vars" aria-label="Insertar referencia a una respuesta">
          {controllingVariables.slice(0, 6).map((variable) => (
            <button
              key={variable.name}
              type="button"
              onClick={() => insertVariableReference(variable.name)}
              title={`Insertar ${variable.name}`}
            >
              ${`{${variable.name}}`}
            </button>
          ))}
        </div>
        {hasFilter && (
          <button
            type="button"
            className="pulso-inspector-logic-clear"
            onClick={() => onFieldChange("choice_filter", "")}
          >
            <Trash2 size={12} /> Quitar filtro
          </button>
        )}
      </div>
    </div>
  );
}

function describeChoiceFilter(
  expression: string,
  scope: LogicScope,
  choiceColumns: string[],
): {
  tone: "empty" | "ok" | "warn";
  title: string;
  detail: string;
  references: LogicScope["variables"];
} {
  const raw = expression.trim();
  if (!raw) {
    return {
      tone: "empty",
      title: "Sin filtro aplicado",
      detail: "Todas las opciones de la lista aparecen cuando la pregunta se muestra.",
      references: [],
    };
  }

  const variableNames = choiceFilterVariableNames(raw);
  const references = variableNames
    .map((name) => scope.variables.find((variable) => variable.name === name))
    .filter((variable): variable is LogicScope["variables"][number] => Boolean(variable));
  const missingVariables = variableNames.filter(
    (name) => !scope.variables.some((variable) => variable.name === name),
  );
  const simpleFilter = parseSimpleChoiceFilter(raw);
  const hasComparison = /(?:!=|<=|>=|=|<|>|\bselected\s*\()/i.test(raw);

  if (missingVariables.length > 0) {
    return {
      tone: "warn",
      title: "Revisa la referencia",
      detail: `No encuentro ${missingVariables.map((name) => `\${${name}}`).join(", ")} entre las variables actuales del formulario.`,
      references,
    };
  }

  if (!hasComparison) {
    return {
      tone: "warn",
      title: "Falta la comparación",
      detail: "Agrega la columna de la lista y el operador, por ejemplo region=${region}.",
      references,
    };
  }

  if (simpleFilter && choiceColumns.length > 0 && !choiceColumns.includes(simpleFilter.column)) {
    return {
      tone: "warn",
      title: "Columna no detectada",
      detail: `El filtro usa ${simpleFilter.column}; confirma que exista como columna adicional en la hoja choices.`,
      references,
    };
  }

  if (simpleFilter) {
    return {
      tone: "ok",
      title: "Filtro conectado",
      detail: `Kobo mostrará opciones donde ${simpleFilter.column} coincida con ${variableLabel(simpleFilter.variable, scope)}.`,
      references,
    };
  }

  return {
    tone: references.length > 0 ? "ok" : "warn",
    title: references.length > 0 ? "Filtro avanzado" : "Filtro técnico importado",
    detail:
      references.length > 0
        ? "La regla usa variables del formulario y se conservará al exportar."
        : "No detecté referencias ${variable}; conserva la fórmula si viene de un XLSForm probado.",
    references,
  };
}

function choiceFilterVariableNames(expression: string): string[] {
  const names = new Set<string>();
  const regex = /\$\{([^}]+)\}/g;
  let match = regex.exec(expression);
  while (match) {
    const name = match[1]?.trim();
    if (name) names.add(name);
    match = regex.exec(expression);
  }
  return Array.from(names);
}

function parseSimpleChoiceFilter(expression: string): { column: string; variable: string } | null {
  const match = /^([^\s=<>!()]+)\s*={1,2}\s*\$\{([^}]+)\}\s*$/.exec(expression.trim());
  if (!match) return null;
  const column = match[1] ?? "";
  const variable = (match[2] ?? "").trim();
  if (!column || !variable) return null;
  return { column, variable };
}

type ChoiceFilterSuggestion = {
  title: string;
  detail: string;
  expression: string;
};

function buildChoiceFilterSuggestions(
  node: BuilderNode,
  choiceColumns: string[],
  variables: LogicScope["variables"],
  currentFilter: string,
): ChoiceFilterSuggestion[] {
  if (choiceColumns.length === 0 || variables.length === 0) return [];
  const current = currentFilter.trim();
  const scored: Array<ChoiceFilterSuggestion & { score: number }> = [];

  choiceColumns.forEach((column) => {
    variables.forEach((variable) => {
      const expression = `${column}=\${${variable.name}}`;
      if (expression === current) return;
      const score = scoreChoiceFilterPair(column, variable, node);
      if (score <= 0) return;
      scored.push({
        score,
        expression,
        title: `${column} coincide con ${variable.name}`,
        detail: `Muestra opciones donde ${column} sea igual a ${variableDisplayLabel(variable)}.`,
      });
    });
  });

  scored.sort((a, b) => b.score - a.score || a.expression.localeCompare(b.expression));
  const unique = new Map<string, ChoiceFilterSuggestion>();
  scored.forEach(({ score: _score, ...suggestion }) => {
    if (!unique.has(suggestion.expression)) unique.set(suggestion.expression, suggestion);
  });
  return [...unique.values()].slice(0, 3);
}

function scoreChoiceFilterPair(
  column: string,
  variable: LogicScope["variables"][number],
  node: BuilderNode,
): number {
  const col = normalizeChoiceFilterToken(column);
  const name = normalizeChoiceFilterToken(variable.name);
  const listName = normalizeChoiceFilterToken(variable.listName ?? "");
  const label = normalizeChoiceFilterToken(variable.label);
  if (!col || !name) return 0;

  let score = 0;
  if (col === name) score += 10;
  if (listName && col === listName) score += 8;
  if (label && col === label) score += 7;
  if (col.includes(name) || name.includes(col)) score += 5;
  if (label && (label.includes(col) || col.includes(label))) score += 4;
  if (variable.baseType === "select_one") score += 4;
  if (variable.baseType === "select_multiple") score += 2;
  if (variable.rowIndex == null || variable.rowIndex < node.rowIndex) score += 3;
  if (/^(region|departamento|provincia|distrito|zona|sector|ubigeo|sede|facultad|curso)$/.test(col)) {
    score += 2;
  }
  return score;
}

function normalizeChoiceFilterToken(value: string): string {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/ñ/g, "n")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function variableDisplayLabel(variable: LogicScope["variables"][number]): string {
  return stripMarkdown(variable.label || variable.name) || variable.name;
}

function CustomValidationPanel({
  node,
  validation,
  onFieldChange,
  onFieldsChange,
}: {
  node: BuilderNode;
  validation: (HumanizedExpression & { status: string }) | null;
  onFieldChange: (field: string, value: string) => void;
  onFieldsChange: (updates: Record<string, string>) => void;
}) {
  const openByDefault = Boolean(
    node.constraint.trim() &&
      validation?.status !== "Preset claro" &&
      validation?.status !== "Editable visualmente",
  );
  // Las reglas de texto (regex) viven en la galería humana de
  // ValidationSummary; este panel queda solo para la fórmula cruda.

  return (
    <details className="pulso-focus-custom-validation" open={openByDefault}>
      <summary>Patrón o regla avanzada</summary>
      <p>
        Pega una regla completa cuando los atajos no alcancen: patrones de texto,
        conteos de selección múltiple o una validación importada desde otro XLSForm.
      </p>
      <InspectorField
        label="Regla avanzada"
        hint="Debe devolver verdadero cuando la respuesta puede aceptarse. Se exporta como validación XLSForm."
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


function ConstraintMessageField({
  node,
  validation,
  value,
  onFieldChange,
}: {
  node: BuilderNode;
  validation: (HumanizedExpression & { status: string }) | null;
  value: string;
  onFieldChange: (field: string, value: string) => void;
}) {
  const presets = constraintMessagePresetsFor(node, validation);
  const hasConstraint = node.constraint.trim().length > 0;

  return (
    <InspectorField
      label="Mensaje si la respuesta no es válida"
      hint="Texto visible en Kobo cuando la respuesta no cumple la regla. Escríbelo como una indicación para campo."
    >
      {hasConstraint && (
        <ConstraintMessageAssistant
          value={value}
          validation={validation}
          presets={presets}
          onApply={(message) => onFieldChange("constraint_message", message)}
        />
      )}
      <input
        type="text"
        value={value}
        onChange={(event) =>
          onFieldChange("constraint_message", event.target.value)
        }
        placeholder="Ej. Ingresa un correo electrónico válido."
      />
    </InspectorField>
  );
}

type ConstraintMessagePreset = {
  id: string;
  label: string;
  hint: string;
  message: string;
};

function ConstraintMessageAssistant({
  value,
  validation,
  presets,
  onApply,
}: {
  value: string;
  validation: (HumanizedExpression & { status: string }) | null;
  presets: ConstraintMessagePreset[];
  onApply: (message: string) => void;
}) {
  const cleanValue = value.trim();
  const hasMessage = cleanValue.length > 0;
  const looksTechnical = fieldMessageLooksTechnical(cleanValue);
  const hasCorrectionCue =
    /\b(ingresa|selecciona|elige|escribe|usa|verifica|corrige|marca|indica|debe|solo|entre|mínimo|máximo|mayor|menor)\b/i.test(
      cleanValue,
    );
  const isReady = hasMessage && !looksTechnical && hasCorrectionCue;
  const checks = [
    {
      key: "message",
      label: hasMessage ? "Mensaje definido" : "Falta mensaje",
      ok: hasMessage,
    },
    {
      key: "language",
      label: looksTechnical ? "Suena técnico" : "Lenguaje de campo",
      ok: hasMessage && !looksTechnical,
    },
    {
      key: "action",
      label: hasCorrectionCue ? "Dice cómo corregir" : "Explica qué hacer",
      ok: hasMessage && hasCorrectionCue,
    },
  ];
  const primaryPresets = isReady ? presets : presets.slice(0, 2);
  const secondaryPresets = isReady ? [] : presets.slice(2);
  const renderPresetGrid = (items: ConstraintMessagePreset[]) =>
    items.length > 0 ? (
      <div className="pulso-focus-message-preset-grid">
        {items.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="pulso-focus-message-preset"
            onClick={() => onApply(preset.message)}
            title={preset.hint}
          >
            <span className="pulso-focus-message-preset-icon">
              <CheckCircle2 size={12} />
            </span>
            <span className="pulso-focus-message-preset-copy">
              <strong>{preset.label}</strong>
              <small>{preset.hint}</small>
              <em>{preset.message}</em>
            </span>
          </button>
        ))}
      </div>
    ) : null;
  const primaryPresetGrid = renderPresetGrid(primaryPresets);

  return (
    <div
      className={`pulso-focus-message-presets pulso-focus-constraint-message-presets pulso-focus-constraint-message-assistant${isReady ? "" : " is-warning"}`}
      aria-label="Asistente de mensaje de validación"
    >
      <div className="pulso-focus-message-presets-head pulso-focus-constraint-message-head">
        <span className="pulso-focus-constraint-message-icon" aria-hidden="true">
          {isReady ? <CheckCircle2 size={14} /> : <Info size={14} />}
        </span>
        <div>
          <span className="pulso-section-eyebrow">Mensaje Kobo</span>
          <strong>{isReady ? "Texto listo para campo" : "Completa una indicación clara"}</strong>
          <small>
            Kobo lo muestra cuando la respuesta no cumple
            {validation?.summary ? " la regla resumida arriba." : " esta validación."}
          </small>
        </div>
      </div>

      <div className="pulso-focus-required-message-checks pulso-focus-constraint-message-checks" aria-label="Revisión del mensaje de validación">
        {checks.map((check) => (
          <span key={check.key} className={check.ok ? "is-ok" : "is-pending"}>
            {check.ok ? <CheckCircle2 size={11} /> : <Info size={11} />}
            {check.label}
          </span>
        ))}
      </div>

      {isReady ? (
        primaryPresetGrid ? (
          <details className="pulso-focus-required-message-alternatives">
            <summary>Cambiar por otro texto sugerido</summary>
            {primaryPresetGrid}
          </details>
        ) : null
      ) : (
        <>
          {primaryPresetGrid}
          {secondaryPresets.length > 0 && (
            <details className="pulso-focus-required-message-alternatives pulso-focus-constraint-message-more">
              <summary>Más textos sugeridos</summary>
              {renderPresetGrid(secondaryPresets)}
            </details>
          )}
          {!primaryPresetGrid && (
            <div className="pulso-focus-constraint-message-guidance">
              <strong>Guía rápida</strong>
              <span>
                Empieza con una acción: 'Ingresa...', 'Selecciona...' o 'Debe estar entre...'.
                Evita mencionar regex, constraint o XLSForm.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function constraintMessagePresetsFor(
  node: BuilderNode,
  validation: (HumanizedExpression & { status: string }) | null,
): ConstraintMessagePreset[] {
  const summary = validation?.summary.toLowerCase() ?? "";
  const base = node.typeInfo.base;
  const presets: ConstraintMessagePreset[] = [];

  if (summary.includes("correo")) {
    presets.push({
      id: "email",
      label: "Correo válido",
      hint: "Para validaciones de correo electrónico.",
      message: "Ingresa un correo electrónico válido.",
    });
  } else if (summary.includes("url") || summary.includes("enlace")) {
    presets.push({
      id: "url",
      label: "Enlace válido",
      hint: "Para respuestas que deben ser enlaces web.",
      message: "Ingresa un enlace web válido.",
    });
  } else if (summary.includes("dígitos") || summary.includes("digitos")) {
    presets.push({
      id: "digits",
      label: "Solo números",
      hint: "Para códigos o identificadores numéricos.",
      message: "Ingresa solo números, sin letras ni símbolos.",
    });
  } else if (summary.includes("posterior a hoy") || summary.includes("hoy")) {
    presets.push({
      id: "date",
      label: "Fecha permitida",
      hint: "Para fechas que no pueden estar en el futuro.",
      message: "La fecha no puede ser posterior a hoy.",
    });
  } else if (summary.includes("mayor que cero")) {
    presets.push({
      id: "positive",
      label: "Valor positivo",
      hint: "Para cantidades que no aceptan cero.",
      message: "Ingresa un valor mayor que cero.",
    });
  } else if (summary.includes("cero o mayor") || summary.includes("igual o mayor")) {
    presets.push({
      id: "non-negative",
      label: "Cero o más",
      hint: "Para cantidades que no aceptan valores negativos.",
      message: "Ingresa un valor igual o mayor que cero.",
    });
  }

  if (base === "integer" || base === "decimal") {
    presets.push({
      id: "numeric-range",
      label: "Rango numérico",
      hint: "Para reglas de mínimos, máximos o rangos.",
      message: "Ingresa un número dentro del rango permitido.",
    });
  }
  if (base === "date") {
    presets.push({
      id: "date-general",
      label: "Revisar fecha",
      hint: "Para reglas de fecha importadas o personalizadas.",
      message: "Revisa la fecha antes de continuar.",
    });
  }
  if (base === "text") {
    presets.push({
      id: "text-format",
      label: "Formato de texto",
      hint: "Para patrones de texto personalizados.",
      message: "Revisa el formato de esta respuesta.",
    });
  }

  presets.push(
    {
      id: "field-confirm",
      label: "Confirmar en campo",
      hint: "Para datos que conviene verificar con la persona encuestada.",
      message: "Confirma este dato antes de continuar.",
    },
    {
      id: "review-answer",
      label: "Revisar respuesta",
      hint: "Mensaje general para reglas técnicas importadas.",
      message: "Revisa esta respuesta antes de continuar.",
    },
  );

  const seen = new Set<string>();
  return presets.filter((preset) => {
    if (seen.has(preset.message)) return false;
    seen.add(preset.message);
    return true;
  }).slice(0, 4);
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
  const messageStatus = summary
    ? validationMessageStatusFor(node.constraint_message ?? "")
    : null;
  // Preguntas de texto: la galería de reglas humanas (textRules) reemplaza a
  // los presets fijos. Solo en modo "elegir" — si el constraint actual ya es
  // una receta reconocida, el ConstraintBuilder de abajo la muestra en modo
  // humano y acá no se duplica.
  const recognizedRule = node.constraint.trim()
    ? matchTextRule(parseExpression(node.constraint))
    : null;
  const showTextRuleGallery = node.typeInfo.base === "text" && !recognizedRule;
  // La lectura superior usa el título humano de la receta cuando existe
  // ("Debe tener exactamente 8 dígitos" en vez de un resumen genérico).
  const summaryStatus = recognizedRule ? "Regla de texto" : summary?.status;
  const summaryText = recognizedRule
    ? recognizedRule.recipe.title(recognizedRule.params)
    : summary?.summary;

  return (
    <div className="pulso-focus-validation">
      <div className={`pulso-focus-validation-card ${summary ? "" : "is-empty"}`}>
        {summary ? <ShieldCheck size={14} /> : <Info size={14} />}
        <div>
          <span>{summaryStatus ?? "Sin validación"}</span>
          <strong>{summaryText ?? "La respuesta se acepta tal como fue ingresada."}</strong>
          {summary?.technical && (
            <details>
              <summary>Ver regla XLSForm</summary>
              <code>{summary.raw}</code>
            </details>
          )}
        </div>
      </div>
      {messageStatus && (
        <div className={`pulso-focus-validation-message-status is-${messageStatus.tone}`}>
          {messageStatus.tone === "ok" ? <CheckCircle2 size={12} /> : <Info size={12} />}
          <span>
            <strong>{messageStatus.title}</strong>
            <small>{messageStatus.detail}</small>
          </span>
        </div>
      )}

      {showTextRuleGallery && (
        <div className="pulso-focus-validation-presets" aria-label="Reglas de texto">
          <div className="pulso-focus-validation-presets-head">
            <span className="pulso-section-eyebrow">
              Formato del texto <TechTerm t="regex" />
            </span>
            <strong>Reglas en lenguaje claro</strong>
            <small>La regla técnica y el mensaje para el encuestado se completan juntos.</small>
          </div>
          <TextRuleSuite
            active={null}
            onApply={(constraintExpr, message) => {
              onFieldsChange({
                constraint: constraintExpr,
                constraint_message: message,
              });
            }}
            onClear={() => {
              onFieldsChange({ constraint: "", constraint_message: "" });
            }}
          />
        </div>
      )}

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

function validationMessageStatusFor(value: string): {
  tone: "ok" | "warning";
  title: string;
  detail: string;
} {
  const cleanValue = value.trim();
  if (!cleanValue) {
    return {
      tone: "warning",
      title: "Falta mensaje para campo",
      detail: "Completa una frase clara para que Kobo explique cómo corregir la respuesta.",
    };
  }
  if (fieldMessageLooksTechnical(cleanValue)) {
    return {
      tone: "warning",
      title: "Mensaje suena técnico",
      detail: "Cambia términos como regex, constraint o XLSForm por una instrucción directa.",
    };
  }
  return {
    tone: "ok",
    title: "Mensaje listo para campo",
    detail: "Kobo mostrará una indicación entendible cuando la respuesta no cumpla la regla.",
  };
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
      <MediaAttachmentPanel node={node} onFieldChange={onFieldChange} />
      <PresentationGuidance node={node} />
    </div>
  );
}

function MediaAttachmentPanel({
  node,
  onFieldChange,
}: {
  node: BuilderNode;
  onFieldChange: (field: string, value: string) => void;
}) {
  const fields = [
    {
      key: "media::image",
      value: node.mediaImage ?? "",
      label: "Imagen de apoyo",
      placeholder: "Ej. referencia.png",
      icon: ImagePlus,
      hint: "Aparece junto al texto de la pregunta o nota.",
      examples: ["referencia.png", "mapa_sector.png", "ejemplo_respuesta.png"],
    },
    {
      key: "media::audio",
      value: node.mediaAudio ?? "",
      label: "Audio de consigna",
      placeholder: "Ej. instruccion.mp3",
      icon: Mic,
      hint: "Útil para idiomas, pronunciación o instrucciones de campo.",
      examples: ["instruccion.mp3", "lectura_consentimiento.mp3"],
    },
    {
      key: "media::video",
      value: node.mediaVideo ?? "",
      label: "Video de referencia",
      placeholder: "Ej. demostracion.mp4",
      icon: Video,
      hint: "Material breve para explicar un procedimiento.",
      examples: ["demostracion.mp4", "ejemplo_visita.mp4"],
    },
  ];
  const active = fields.filter((field) => field.value.trim().length > 0);

  return (
    <InspectorBlock>
      <div className="pulso-focus-media-panel">
        <div className="pulso-focus-media-head">
          <span className="pulso-focus-media-icon" aria-hidden="true">
            <ImagePlus size={14} />
          </span>
          <div>
            <span className="pulso-section-eyebrow">Material de consigna</span>
            <strong>{active.length ? `${active.length} adjunto${active.length === 1 ? "" : "s"} vinculado${active.length === 1 ? "" : "s"}` : "Sin multimedia adjunta"}</strong>
            <p>Usa archivos que ya estarán en la carpeta media del XLSForm. No reemplaza preguntas de evidencia como foto, audio o video.</p>
          </div>
        </div>

        <div className="pulso-focus-media-grid">
          {fields.map((field) => {
            const Icon = field.icon;
            const hasValue = field.value.trim().length > 0;
            return (
              <div key={field.key} className={`pulso-focus-media-field ${hasValue ? "is-active" : ""}`}>
                <div className="pulso-focus-media-field-head">
                  <span aria-hidden="true">
                    <Icon size={13} />
                  </span>
                  <div>
                    <strong>{field.label}</strong>
                    <small>{field.hint}</small>
                  </div>
                </div>
                <input
                  type="text"
                  value={field.value}
                  onChange={(event) => onFieldChange(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  spellCheck={false}
                />
                <div className="pulso-focus-media-examples" aria-label={`Atajos para ${field.label}`}>
                  {field.examples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => onFieldChange(field.key, example)}
                    >
                      {example}
                    </button>
                  ))}
                  {hasValue && (
                    <button
                      type="button"
                      className="is-clear"
                      onClick={() => onFieldChange(field.key, "")}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </InspectorBlock>
  );
}

function PresentationGuidance({ node }: { node: BuilderNode }) {
  const base = node.typeInfo.base;
  const guide = presentationGuideFor(base);

  return (
    <div className="pulso-focus-presentation-guide">
      <div className="pulso-focus-presentation-guide-icon" aria-hidden="true">
        <Info size={14} />
      </div>
      <div>
        <span className="pulso-section-eyebrow">{guide.kicker}</span>
        <strong>{guide.title}</strong>
        <p>{guide.body}</p>
        {guide.badges.length > 0 && (
          <div className="pulso-focus-presentation-badges">
            {guide.badges.map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function presentationGuideFor(baseType: string): {
  kicker: string;
  title: string;
  body: string;
  badges: string[];
} {
  switch (baseType) {
    case "image":
      return {
        kicker: "Evidencia de campo",
        title: "Foto, dibujo o anotación",
        body: "Usa la apariencia para pedir foto normal, dibujo o anotación sobre imagen. La respuesta se guarda como adjunto del envío.",
        badges: ["image", "draw", "annotate"],
      };
    case "audio":
      return {
        kicker: "Evidencia de campo",
        title: "Registro de audio",
        body: "Este control captura una grabación o archivo de audio. El texto de la pregunta debe explicar qué evidencia se espera.",
        badges: ["audio", "media"],
      };
    case "video":
      return {
        kicker: "Evidencia de campo",
        title: "Registro de video",
        body: "Este control captura video como adjunto. Mantén la consigna breve para que el encuestador sepa qué registrar.",
        badges: ["video", "media"],
      };
    case "file":
      return {
        kicker: "Evidencia de campo",
        title: "Archivo adjunto",
        body: "Sirve para solicitar un documento u otro respaldo. Si el XLSForm trae columnas media::, Prosecnur las conserva al exportar.",
        badges: ["file", "media"],
      };
    case "barcode":
      return {
        kicker: "Captura rápida",
        title: "Código de barras o QR",
        body: "El encuestador escanea un código y Kobo guarda el valor leído. Es útil para formularios con identificadores físicos.",
        badges: ["barcode", "qr"],
      };
    case "geopoint":
      return {
        kicker: "Ubicación",
        title: "Punto GPS",
        body: "Captura una coordenada puntual. Para recorridos o áreas, cambia el tipo a geotrace o geoshape desde el selector de tipo.",
        badges: ["geopoint", "gps"],
      };
    case "geotrace":
      return {
        kicker: "Ubicación",
        title: "Recorrido GPS",
        body: "Captura una línea o recorrido. Úsalo cuando el levantamiento necesita trazar desplazamientos, no solo un punto.",
        badges: ["geotrace", "gps"],
      };
    case "geoshape":
      return {
        kicker: "Ubicación",
        title: "Área GPS",
        body: "Captura un polígono o área. Es adecuado para delimitar zonas, parcelas o coberturas en campo.",
        badges: ["geoshape", "gps"],
      };
    default:
      return {
        kicker: "Presentación",
        title: `${typeLabel(baseType)} en Collect`,
        body: "La apariencia ajusta cómo se muestra el control sin cambiar la columna de datos. Si el XLSX trae multimedia asociada, Prosecnur la conserva al exportar.",
        badges: baseType ? [baseType] : [],
      };
  }
}

function DataTab({
  node,
  structure,
  catalogInfo,
  catalogUsageCount,
  onFieldChange,
}: {
  node: BuilderNode;
  structure: BuilderStructure | null;
  catalogInfo?: CatalogInfo;
  catalogUsageCount: number;
  onFieldChange: (field: string, value: string) => void;
}) {
  const isSection = node.kind === "section" || node.kind === "repeat";
  const baseType = typeof node.typeInfo.base === "string" ? node.typeInfo.base : "text";
  const listName = scalarText(node.typeInfo.listName);
  const nodeName = scalarText(node.name);
  const usageCount = Number.isFinite(Number(catalogUsageCount)) ? Number(catalogUsageCount) : 0;
  const isSelect = baseType === "select_one" || baseType === "select_multiple";
  const dataKindLabel = isSection
    ? node.kind === "repeat" ? "Repetición" : "Sección"
    : typeLabel(baseType);
  const dataContractFacts = [
    {
      label: isSection ? "Código del bloque" : "Columna en base",
      value: nodeName || "sin nombre",
      code: Boolean(nodeName),
    },
    {
      label: "Tipo guardado",
      value: dataKindLabel,
      code: false,
    },
    ...(isSelect
      ? [
          {
            label: "Lista",
            value: listName || "sin lista",
            code: Boolean(listName),
          },
          {
            label: "Uso de lista",
            value: catalogInfo ? `${usageCount} ${usageCount === 1 ? "pregunta" : "preguntas"}` : "Pendiente",
            code: false,
          },
        ]
      : []),
  ];
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
  const selectGuide = isSelect
    ? selectDataGuideFor(baseType, listName, catalogInfo, usageCount)
    : [];

  return (
    <div className="pulso-focus-tab-panel">
      <div className="pulso-focus-data-contract">
        <div className="pulso-focus-data-contract-head">
          <span className="pulso-focus-data-contract-icon">
            <Database size={15} />
          </span>
          <div>
            <strong>Contrato de datos</strong>
            <p>
              Estos campos no cambian el texto que ve el encuestador; definen
              cómo se guarda la respuesta y cómo se conserva el XLSForm al exportar.
            </p>
          </div>
        </div>
        <div className="pulso-focus-data-contract-grid">
          {dataContractFacts.map((fact) => (
            <FocusFact
              key={fact.label}
              label={fact.label}
              value={fact.value}
              code={fact.code}
            />
          ))}
        </div>
        <div className="pulso-focus-data-principle">
          <Info size={13} />
          <span>
            Regla práctica: cambia el nombre cuando lo usarás en lógica,
            exportación o base de datos. Deja papel y parámetros en automático
            salvo que estés corrigiendo una plantilla importada.
          </span>
        </div>
        {selectGuide.length > 0 && (
          <div className="pulso-focus-select-data-guide" aria-label="Cómo se guardan las selecciones">
            <div className="pulso-focus-select-data-guide-head">
              <ListChecks size={14} />
              <strong>Cómo se guarda esta selección</strong>
            </div>
            <div className="pulso-focus-select-data-guide-grid">
              {selectGuide.map((item) => (
                <span key={item.title}>
                  <strong>{item.title}</strong>
                  <em>{item.detail}</em>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <InspectorBlock>
        <InspectorField
          label={isSection ? "Nombre de variable del bloque" : "Nombre de columna"}
          hint="Se usa en reglas, exportación y bases. Usa algo corto, único y reconocible."
        >
          <NameField
            value={node.name}
            onChange={(next) => onFieldChange("name", next)}
            placeholder={isSection ? "ej. datos_hogar" : "ej. p1_edad"}
          />
          <KoboNameAssistant
            node={node}
            structure={structure}
            onApply={(next) => onFieldChange("name", next)}
          />
        </InspectorField>
      </InspectorBlock>

      {hasPaperOverrides && (
        <InspectorBlock>
          <details className="pulso-focus-disclosure" open>
            <summary>Ajustes de PDF importados</summary>
            <InspectorField
              label="Número visible en PDF"
              hint="Número heredado de una plantilla impresa. Si queda vacío, Quobo lo deriva automáticamente."
            >
              <input
                type="text"
                value={node.paperNumber ?? ""}
                onChange={(event) => onFieldChange("paper_number", event.target.value)}
                placeholder="Ej. 108"
              />
            </InspectorField>
            <InspectorField
              label="Texto alternativo en PDF"
              hint="Reemplaza el texto solo en la versión impresa, no en el formulario digital."
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
              hint="Tiene prioridad sobre el salto inferido desde Reglas. Úsalo solo si el papel necesita una redacción especial."
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
              hint="Une varias filas en una matriz o bloque común dentro del PDF importado."
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
              hint="Anula el layout automático del PDF: full, wide, matrix o compact."
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
            <summary>Atributos avanzados importados</summary>
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
                  <em>Se conserva porque vino configurado en el archivo importado.</em>
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

function selectDataGuideFor(
  baseType: string,
  listName: string,
  catalogInfo: CatalogInfo | undefined,
  usageCount: number,
): Array<{ title: string; detail: string }> {
  const isMulti = baseType === "select_multiple";
  const choicesCount = catalogInfo?.choicesCount ?? 0;
  const listDetail = listName
    ? choicesCount > 0
      ? `${choicesCount} ${choicesCount === 1 ? "opción" : "opciones"} en ${listName}.`
      : `Lista ${listName} preparada, aún sin opciones reales.`
    : "Sin lista vinculada todavía.";
  return [
    {
      title: isMulti ? "Guarda varias marcas" : "Guarda una marca",
      detail: isMulti
        ? "Kobo guarda los códigos elegidos en la misma columna, separados por espacios."
        : "Kobo guarda un solo código de opción en esta columna.",
    },
    {
      title: "Lista de opciones",
      detail: listDetail,
    },
    {
      title: usageCount > 1 ? "Lista reutilizada" : "Lista propia",
      detail: usageCount > 1
        ? `La comparten ${usageCount} preguntas; cambia códigos con cuidado.`
        : "Puedes ajustar opciones sin afectar otras preguntas.",
    },
  ];
}

function scalarText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

const KOBO_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;
const KOBO_NAME_MAX_LENGTH = 42;
const KOBO_NAME_STOPWORDS = new Set([
  "a",
  "al",
  "cual",
  "cuales",
  "cuando",
  "cuantos",
  "cuantas",
  "de",
  "del",
  "el",
  "en",
  "es",
  "esta",
  "este",
  "estos",
  "estas",
  "ha",
  "han",
  "indique",
  "ingrese",
  "la",
  "las",
  "lo",
  "los",
  "para",
  "por",
  "pregunte",
  "que",
  "seleccione",
  "si",
  "sobre",
  "su",
  "sus",
  "un",
  "una",
]);

function KoboNameAssistant({
  node,
  structure,
  onApply,
}: {
  node: BuilderNode;
  structure: BuilderStructure | null;
  onApply: (next: string) => void;
}) {
  const currentName = (node.name ?? "").trim();
  const hasName = Boolean(currentName);
  const hasValidSyntax = hasName && KOBO_NAME_REGEX.test(currentName);
  const duplicateCount = hasName
    ? structure?.outline.filter((item) => item.name.trim() === currentName).length ?? 0
    : 0;
  const isDuplicate = duplicateCount > 1;
  const isReady = hasValidSyntax && !isDuplicate;
  const suggestions = buildKoboNameSuggestions(node, structure).filter((suggestion) => suggestion !== currentName);
  const isGenericName = hasName && /^(?:p|q|fila|pregunta)_?\d+$/i.test(currentName);
  const showSuggestions = suggestions.length > 0 && (!isReady || isGenericName);
  const statusCopy = isReady
    ? {
        title: "Listo para Kobo",
        body: "Este nombre ya funciona para lógica, exportación y bases.",
      }
    : {
        title: hasName ? "Conviene ajustarlo" : "Falta un nombre interno",
        body: "Usa una versión corta, sin espacios ni tildes, que puedas reconocer en reglas y datos.",
      };
  const checks = [
    {
      key: "start",
      label: "Empieza con letra o _",
      ok: hasName && /^[A-Za-z_]/.test(currentName),
    },
    {
      key: "chars",
      label: "Sin espacios ni símbolos",
      ok: hasName && /^[A-Za-z_][A-Za-z0-9_]*$/.test(currentName),
    },
    {
      key: "unique",
      label: "Único en survey",
      ok: hasName && !isDuplicate,
    },
  ];

  return (
    <div className={`pulso-focus-name-assistant${isReady ? "" : " is-warning"}`}>
      <div className="pulso-focus-name-assistant-head">
        <span className="pulso-focus-name-assistant-icon" aria-hidden="true">
          {isReady ? <CheckCircle2 size={15} /> : <Database size={15} />}
        </span>
        <div>
          <strong>{statusCopy.title}</strong>
          <p>{statusCopy.body}</p>
        </div>
      </div>

      <div className="pulso-focus-name-checks" aria-label="Revisión rápida del nombre Kobo">
        {checks.map((check) => (
          <span key={check.key} className={check.ok ? "is-ok" : "is-pending"}>
            {check.ok ? <CheckCircle2 size={11} /> : <Info size={11} />}
            {check.label}
          </span>
        ))}
      </div>

      {showSuggestions && (
        <div className="pulso-focus-name-suggestions" aria-label="Sugerencias de nombre interno">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onApply(suggestion)}
              title={`Usar ${suggestion} como name`}
            >
              <code>{suggestion}</code>
              <span>Aplicar</span>
            </button>
          ))}
        </div>
      )}

      <p className="pulso-focus-name-tip">
        Si se repite, Prosecnur lo marca en Diagnóstico; corrígelo antes de usarlo en relevant,
        constraint, cálculo o choice_filter.
      </p>
    </div>
  );
}

function buildKoboNameSuggestions(node: BuilderNode, structure: BuilderStructure | null): string[] {
  const takenNames = new Set(
    (structure?.outline ?? [])
      .filter((item) => item.rowIndex !== node.rowIndex)
      .map((item) => item.name.trim())
      .filter(Boolean),
  );
  const fallback = fallbackKoboNameForNode(node);
  const base = makeKoboName(node.label || node.hint || node.name, fallback);
  const compact = makeKoboName(wordsForKoboName(node.label).slice(0, 4).join("_"), fallback);
  const expanded = makeKoboName([node.label, node.hint].filter(Boolean).join(" "), fallback);
  const prefix = koboNamePrefixForNode(node);
  const candidates = [
    base,
    compact,
    expanded,
    prefix ? withKoboPrefix(base, prefix) : base,
    node.kind === "section" ? withKoboPrefix(base, "grupo") : null,
    node.kind === "repeat" ? withKoboPrefix(base, "rep") : null,
    node.kind === "calculate" ? `${base}_calc` : null,
    node.kind === "note" ? withKoboPrefix(base, "nota") : null,
  ];

  const unique = new Set<string>();
  candidates.forEach((candidate) => {
    if (!candidate) return;
    const available = makeAvailableKoboName(candidate, takenNames);
    if (available && KOBO_NAME_REGEX.test(available)) unique.add(available);
  });
  return [...unique].slice(0, 4);
}

function withKoboPrefix(value: string, prefix: string): string {
  if (!value || value === prefix || value.startsWith(`${prefix}_`)) return value;
  return limitKoboName(`${prefix}_${value}`);
}

function makeAvailableKoboName(value: string, takenNames: Set<string>): string {
  const base = makeKoboName(value, "pregunta");
  if (!takenNames.has(base)) return base;
  for (let index = 2; index <= 9; index += 1) {
    const candidate = limitKoboName(`${base}_${index}`);
    if (!takenNames.has(candidate)) return candidate;
  }
  return base;
}

function makeKoboName(value: string, fallback: string): string {
  const words = wordsForKoboName(value);
  const raw = words.length > 0 ? words.join("_") : fallback;
  const normalized = raw.replace(/_+/g, "_").replace(/^_+|_+$/g, "") || fallback;
  const prefixed = /^[0-9]/.test(normalized) ? `p_${normalized}` : normalized;
  return limitKoboName(/^[a-z_]/.test(prefixed) ? prefixed : `p_${prefixed}`);
}

function wordsForKoboName(value: string): string[] {
  return stripMarkdown(value.replace(/_/g, " "))
    .toLowerCase()
    .replace(/ñ/g, "n")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((word) => !KOBO_NAME_STOPWORDS.has(word));
}

function limitKoboName(value: string): string {
  return value
    .slice(0, KOBO_NAME_MAX_LENGTH)
    .replace(/_+$/g, "")
    .replace(/^([0-9])/, "p_$1");
}

function fallbackKoboNameForNode(node: BuilderNode): string {
  if (node.kind === "section") return "grupo";
  if (node.kind === "repeat") return "repeticion";
  if (node.kind === "note") return "nota";
  if (node.kind === "calculate") return "calculo";
  if (node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple") return "seleccion";
  return makeKoboName(typeLabel(node.typeInfo.base), "pregunta");
}

function koboNamePrefixForNode(node: BuilderNode): string | null {
  if (node.kind === "section") return "g";
  if (node.kind === "repeat") return "rep";
  if (node.kind === "note") return "nota";
  if (node.kind === "calculate") return "calc";
  switch (node.typeInfo.base) {
    case "integer":
    case "decimal":
    case "range":
      return "num";
    case "select_one":
      return "sel";
    case "select_multiple":
      return "multi";
    case "geopoint":
    case "geotrace":
    case "geoshape":
      return "gps";
    case "image":
    case "audio":
    case "video":
    case "file":
    case "barcode":
      return node.typeInfo.base;
    default:
      return null;
  }
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
    if (pattern.includes("http")) return "La respuesta debe ser un enlace web válido.";
    if (pattern.includes("a-z") && pattern.includes("0-9") && pattern.includes("_-")) {
      return "La respuesta debe ser un código sin espacios.";
    }
    if (pattern.includes("\\d") || pattern.includes("[0-9]")) return "La respuesta debe usar solo números.";
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
    // "text" ya no vive aquí: las reglas de texto (regex) las sirve la
    // galería humana TextRuleSuite en ValidationSummary — una sola fuente
    // (inspector/logic/textRules.ts) con parámetros y probador en vivo.
    case "integer":
    case "decimal":
      return [
        {
          id: "non-negative",
          label: "Cero o más",
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
          label: "Fecha hasta hoy",
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
  if (hasPromptMedia(node)) return true;
  if (node.kind === "section" || node.kind === "repeat") return true;
  if (node.kind === "question" || node.kind === "note") return true;
  return [
    "geopoint",
    "geotrace",
    "geoshape",
  ].includes(node.typeInfo.base);
}

function hasPromptMedia(node: BuilderNode): boolean {
  return Boolean(
    node.mediaImage?.trim() ||
      node.mediaAudio?.trim() ||
      node.mediaVideo?.trim(),
  );
}
