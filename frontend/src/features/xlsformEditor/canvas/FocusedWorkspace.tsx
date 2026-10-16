import "../styles/xf-canvas.css";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GlidingTabList } from "../../../components/GlidingTabList";
import {
  ArrowDown,
  ArrowUp,
  Calculator,
  CheckCircle2,
  Database,
  Eye,
  FileText,
  FolderMinus,
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
import { countFieldsInOutline, formatFieldSectionPair, plural } from "../shell/editorMetrics";
import { InspectorBlock, InspectorField } from "../inspector/InspectorPrimitives";
import { MarkdownField } from "../inspector/MarkdownField";
import { TypePicker } from "../inspector/TypePicker";
import { NameField } from "../inspector/NameField";
import { CatalogChip } from "../inspector/CatalogChip";
import { AppearancePicker } from "../inspector/AppearancePicker";
import { CalculationBuilder } from "../inspector/logic/CalculationBuilder";
import { LogicBuilder } from "../inspector/logic/LogicBuilder";
import { ConstraintBuilder } from "../inspector/logic/ConstraintBuilder";
import { ResumenPregunta } from "./constructor/ResumenPregunta";
import { TextRuleSuite } from "../inspector/logic/TextRuleSuite";
import {
  describeExpression,
  describeRuleBreakdown,
  describeValidation,
  validationPresetsFor,
  variableLabel,
  type HumanizedExpression,
} from "./reglasHumanas";
import { matchTextRule } from "../inspector/logic/textRules";
import { TechTerm } from "../helpers/TechTerm";
import { PaperSettingsBlock } from "./PaperSettingsBlock";
import { offersPaperSettings } from "./paperSettings";
import { SectionBoundaryControl, fieldMessageLooksTechnical, variableDisplayLabel, FocusFact, shouldOfferPresentationTab } from "./constructor/compartido";
import { DataTab } from "./constructor/TabDatos";
import { PresentationTab } from "./constructor/TabPresentacion";
import { RulesTab } from "./constructor/TabReglas";
import { ResponseTab, choiceFilterColumnsFromWorkbook } from "./constructor/TabRespuesta";
import { ContentTab } from "./constructor/TabContenido";

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
              <div className="pulso-focus-status-strip" aria-label="Estado rápido del elemento seleccionado" data-qa-geometry-group="xlsform/tira-foco" data-qa-geometry-contract="intrinsic">
                {focusStatus.map((item) => (
                  <span key={item.key} className={`pulso-focus-status-chip is-${item.tone}`}>
                    <span className="pulso-focus-status-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>
                      <small>{item.label}</small>
                      <strong>{item.value}</strong>
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pulso-focus-workspace-controls">
          <GlidingTabList
            className="pulso-focus-mode-toggle"
            activeKey={mode}
            mode="tabs"
            role="radiogroup"
            aria-label="Vista del builder"
            onRovingKeyChange={(key) => onModeChange(key as FocusWorkspaceMode)}
          >
            <button
              type="button"
              role="radio"
              aria-checked={mode === "focus"}
              data-gliding-key="focus"
              className={mode === "focus" ? "is-on" : ""}
              onClick={() => onModeChange("focus")}
              aria-label="En foco"
              title="En foco: edita el elemento seleccionado"
            >
              <Eye size={13} aria-hidden="true" /> <span className="pulso-xf-focus-label">En foco</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === "overview"}
              data-gliding-key="overview"
              className={mode === "overview" ? "is-on" : ""}
              onClick={() => onModeChange("overview")}
              aria-label="Formulario completo"
              title="Formulario completo: todas las preguntas en orden"
            >
              <LayoutList size={13} aria-hidden="true" /> <span className="pulso-xf-focus-label">Formulario completo</span>
            </button>
          </GlidingTabList>

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
                aria-label="Eliminar elemento seleccionado"
              >
                <Trash2 size={14} aria-hidden="true" /> <span className="pulso-xf-focus-label">Eliminar</span>
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
        ) : selection?.kind === "survey" ? (
          <SectionEndPanel />
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
    // Con un bloque seleccionado, `section` es el propio bloque: decir «en
    // Pag1 (p1)» debajo del título «Pag1 (p1)» repetía el nombre.
    const isOwnSection = section?.rowIndex === node.rowIndex;
    const place = section && section.kind !== "root" && !isOwnSection
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

  if (selection?.kind === "survey") {
    // Selección de una fila de CIERRE de sección (no tiene node en byRow).
    return {
      kicker: "Cierre de sección",
      title: "Fin del grupo",
      subtitle: "Marca dónde termina la sección abierta.",
      icon: FolderMinus,
      iconStyle: undefined,
    };
  }

  return {
    kicker: "Constructor",
    title: "Selecciona un elemento",
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
        <strong>{formatFieldSectionPair(
          countFieldsInOutline(structure.outline),
          sectionsCount,
        )}</strong>
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
          onEditarPestana={setActiveTab}
        />
      </div>

      <div className="pulso-focus-config-pane">
        <GlidingTabList className="pulso-focus-tabs" activeKey={activeTab} role="tablist" aria-label="Configuración del elemento seleccionado">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                id={`pulso-focus-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`pulso-focus-panel-${tab.id}`}
                data-gliding-key={tab.id}
                className={isActive ? "is-active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </GlidingTabList>

        <div
          className="pulso-focus-config-body"
          role="tabpanel"
          id={`pulso-focus-panel-${activeTab}`}
          aria-labelledby={`pulso-focus-tab-${activeTab}`}
        >
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
  onEditarPestana,
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
  onEditarPestana: (pestana: "response" | "rules") => void;
  formCanvasProps: FormCanvasBundle;
}) {
  if (node.kind === "section" || node.kind === "repeat") {
    const sectionMeta = structure?.sections.get(`section-${node.rowIndex}`) ?? section;
    return (
      <div className="pulso-focus-section-preview">
        {/* El título ya está en la cabecera y se edita en «Contenido»: aquí
            van sólo los datos del bloque, cada uno una vez. */}
        <div
          className="pulso-focus-section-facts"
          data-qa-geometry-group="xlsform/vista-trabajo-metricas"
          data-qa-geometry-contract="equal"
        >
          <FocusFact
            label="Dentro del bloque"
            value={plural(sectionMeta?.itemCount ?? 0, "elemento", "elementos")}
          />
          <FocusFact
            label="Visibilidad"
            value={node.relevant?.trim() ? "Condicional" : "Siempre"}
          />
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
      <ResumenPregunta
        node={node}
        section={section}
        choices={choices}
        catalogUsageCount={catalogUsageCount}
        catalogInfo={catalogInfo}
        conditionalContext={conditionalContext}
        logicScope={logicScope}
        onEditar={onEditarPestana}
      />
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
              {(campo) => (
                <input id={campo.id} value={values?.form_title ?? ""} onChange={(event) => onChange("form_title", event.target.value)} />
              )}
            </InspectorField>
            <InspectorField label="ID interno">
              {(campo) => (
                <input id={campo.id} value={values?.form_id ?? ""} onChange={(event) => onChange("form_id", event.target.value)} />
              )}
            </InspectorField>
          </InspectorBlock>
          <InspectorBlock>
            <InspectorField label="Versión">
              {(campo) => (
                <input id={campo.id} value={values?.version ?? ""} onChange={(event) => onChange("version", event.target.value)} />
              )}
            </InspectorField>
            <InspectorField label="Idioma por defecto">
              {(campo) => (
                <input id={campo.id} value={values?.default_language ?? "es"} onChange={(event) => onChange("default_language", event.target.value)} />
              )}
            </InspectorField>
          </InspectorBlock>
        </div>
      </div>
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

function SectionEndPanel() {
  return (
    <div className="pulso-focus-empty pulso-focus-sectionend">
      <span className="pulso-focus-empty-icon">
        <FolderMinus size={18} />
      </span>
      <strong>Cierre de sección</strong>
      <p>
        Esta fila marca dónde termina el grupo. Es una pieza independiente del
        inicio: usa <em>Eliminar</em> para quitarla (la sección quedará abierta)
        o agrega un nuevo cierre desde el menú donde quieras que termine.
      </p>
    </div>
  );
}

