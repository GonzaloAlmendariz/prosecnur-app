// =============================================================================
// canvas/EditableQuestionCard.tsx — card editable inline para el lienzo único
// =============================================================================
// Hereda el render visual de `PreviewQuestionCard` pero hace que label, hint
// y opciones sean editables in-place. Cuando el usuario hace click en un
// label tipea y al perder foco dispara `onLabelChange`. Lo mismo para hint.
//
// Para `select_one`/`select_multiple` muestra `EditableChoiceList` en vez de
// la `ChoiceList` de solo lectura. Las opciones se editan inline al lado de
// la pregunta — sin abrir el editor de catálogos.
//
// El componente sigue siendo fiel al tipo (radio, checkbox, number input,
// etc.) — la idea es que el constructor y la vista sean la misma cosa.
// =============================================================================

import type { CSSProperties } from "react";
import {
  Calculator,
  Calendar as CalendarIcon,
  Camera,
  CircleDot,
  Clock,
  EyeOff,
  Hash,
  ImagePlus,
  ListChecks,
  MapPin,
  MessageSquare,
  Mic,
  QrCode,
  Type as TypeIcon,
} from "lucide-react";
import { IconAI, IconChecklist } from "../../../lib/icons";
import type { BuilderNode, ChoiceItem } from "../types";
import { ConditionalIcon, iconForType } from "../helpers/icons";
import { paletteForType, paletteSoftForType } from "../helpers/paletteForType";
import { RichInline } from "../helpers/RichInline";
import { typeLabel } from "../parsing/parseType";
import { EditableChoiceList } from "./EditableChoiceList";

export type EditableQuestionCardProps = {
  node: BuilderNode;
  /** Opciones del catálogo asociado (si es select_one/multiple). */
  choices: ChoiceItem[];
  /** Posición de la pregunta dentro del outline (1-indexed). */
  position?: number;
  /** Si true, esta card es la seleccionada (highlight, action bar). */
  selected?: boolean;
  /** Cuántas preguntas comparten el mismo catálogo (incluyendo esta).
   *  >1 indica que el catálogo es compartido — `EditableChoiceList`
   *  muestra el badge correspondiente. */
  catalogUsageCount?: number;
  /** Otras preguntas que usan la misma lista (NO incluye la actual). */
  sharedWith?: Array<{ rowIndex: number; label: string; name: string }>;
  /** Click en una de las preguntas compartidas → seleccionarla. */
  onSelectSharedQuestion?: (rowIndex: number) => void;
  /** Click en cualquier parte de la card → seleccionar. */
  onSelect: () => void;
  /** Edits inline. */
  onLabelChange: (value: string) => void;
  onHintChange: (value: string) => void;
  /** Choice mutations (delegadas a EditableChoiceList). */
  onChoiceLabelChange: (choiceRowIndex: number, value: string) => void;
  onChoiceNameChange: (choiceRowIndex: number, value: string) => void;
  onAddChoice: () => void;
  onRemoveChoice: (choiceRowIndex: number) => void;
  /** Renombrar la lista de opciones asociada a esta pregunta. */
  onRenameList?: (nextListName: string) => void;
  /** Opcional: clonar el catálogo solo para esta pregunta. */
  onCloneCatalog?: () => void;
  /** Acceso al editor avanzado de catálogos. */
  onOpenCatalogLens?: () => void;
};

export function EditableQuestionCard({
  node,
  choices,
  position,
  selected,
  catalogUsageCount,
  sharedWith,
  onSelectSharedQuestion,
  onSelect,
  onLabelChange,
  onHintChange,
  onChoiceLabelChange,
  onChoiceNameChange,
  onAddChoice,
  onRemoveChoice,
  onRenameList,
  onCloneCatalog,
  onOpenCatalogLens,
}: EditableQuestionCardProps) {
  const accent = paletteForType(node.typeInfo.base);
  const accentSoft = paletteSoftForType(node.typeInfo.base);
  const Icon = iconForType(node.typeInfo.base);

  return (
    <article
      className={`pulso-canvas-card${selected ? " is-selected" : ""}`}
      style={{ "--card-accent": accent, "--card-accent-soft": accentSoft } as CSSProperties}
      onClick={onSelect}
    >
      {/* Header: tipo + posición + obligatoria + condicional */}
      <div className="pulso-canvas-card-header">
        <span className="pulso-canvas-card-typebadge" style={{ color: accent, background: accentSoft }}>
          <Icon size={13} />
          {typeLabel(node.typeInfo.base)}
        </span>
        {position && (
          <span className="pulso-canvas-card-position" title="Posición en el formulario">
            #{position}
          </span>
        )}
        {node.required && (
          <span className="pulso-canvas-card-required" title="Pregunta obligatoria">
            ★ Obligatoria
          </span>
        )}
        {node.relevant && (
          <span className="pulso-canvas-card-conditional" title="Aparece bajo una condición">
            <ConditionalIcon size={12} weight="thin" /> Condicional
          </span>
        )}
      </div>

      {/* Label + hint editables inline */}
      <div className="pulso-canvas-card-prompt">
        <RichInline
          as="h3"
          className="pulso-canvas-card-label"
          value={node.label}
          onChange={onLabelChange}
          placeholder="Escribe la pregunta…"
          singleLine
          ariaLabel="Texto de la pregunta"
        />
        <RichInline
          as="p"
          className="pulso-canvas-card-hint"
          value={node.hint || ""}
          onChange={onHintChange}
          placeholder="Pista opcional para el encuestador (no obligatoria)"
          singleLine
          ariaLabel="Pista de la pregunta"
        />
      </div>

      {/* Input fiel al tipo */}
      <div className="pulso-canvas-card-input" onClick={(e) => e.stopPropagation()}>
        <PreviewInput
          node={node}
          choices={choices}
          accent={accent}
          catalogUsageCount={catalogUsageCount}
          sharedWith={sharedWith}
          onSelectSharedQuestion={onSelectSharedQuestion}
          onChoiceLabelChange={onChoiceLabelChange}
          onChoiceNameChange={onChoiceNameChange}
          onAddChoice={onAddChoice}
          onRemoveChoice={onRemoveChoice}
          onRenameList={onRenameList}
          onCloneCatalog={onCloneCatalog}
          onOpenCatalogLens={onOpenCatalogLens}
        />
      </div>

      {node.name && (
        <footer className="pulso-canvas-card-footer">
          <span className="pulso-canvas-card-fieldname">
            <code>{node.name}</code>
          </span>
        </footer>
      )}
    </article>
  );
}

// -----------------------------------------------------------------------------
// PreviewInput — switch por tipo XLSForm para renderizar el control adecuado.
// Misma lógica que el render de solo lectura, pero las opciones son editables
// inline (EditableChoiceList).
// -----------------------------------------------------------------------------

function PreviewInput({
  node,
  choices,
  accent,
  catalogUsageCount,
  sharedWith,
  onSelectSharedQuestion,
  onChoiceLabelChange,
  onChoiceNameChange,
  onAddChoice,
  onRemoveChoice,
  onRenameList,
  onCloneCatalog,
  onOpenCatalogLens,
}: {
  node: BuilderNode;
  choices: ChoiceItem[];
  accent: string;
  catalogUsageCount?: number;
  sharedWith?: Array<{ rowIndex: number; label: string; name: string }>;
  onSelectSharedQuestion?: (rowIndex: number) => void;
  onChoiceLabelChange: (choiceRowIndex: number, value: string) => void;
  onChoiceNameChange: (choiceRowIndex: number, value: string) => void;
  onAddChoice: () => void;
  onRemoveChoice: (choiceRowIndex: number) => void;
  onRenameList?: (nextListName: string) => void;
  onCloneCatalog?: () => void;
  onOpenCatalogLens?: () => void;
}) {
  const base = node.typeInfo.base;

  switch (base) {
    case "select_one":
    case "select_multiple":
      return (
        <EditableChoiceList
          items={choices}
          kind={base === "select_one" ? "radio" : "check"}
          accent={accent}
          listName={node.typeInfo.listName}
          catalogUsageCount={catalogUsageCount}
          sharedWith={sharedWith}
          onSelectSharedQuestion={onSelectSharedQuestion}
          onLabelChange={onChoiceLabelChange}
          onNameChange={onChoiceNameChange}
          onAdd={onAddChoice}
          onRemove={onRemoveChoice}
          onRenameList={onRenameList}
          onCloneCatalog={onCloneCatalog}
          onOpenCatalogLens={onOpenCatalogLens}
        />
      );

    case "integer":
    case "decimal":
      return (
        <FakeInput
          icon={<Hash size={14} />}
          placeholder={base === "integer" ? "Escribe un número entero" : "Escribe un número decimal"}
          accent={accent}
        />
      );

    case "text":
      return (
        <FakeInput
          icon={<TypeIcon size={14} />}
          placeholder="Respuesta de texto libre"
          multiline={node.appearance.includes("multiline")}
          accent={accent}
        />
      );

    case "date":
      return <FakeInput icon={<CalendarIcon size={14} />} placeholder="DD/MM/AAAA" accent={accent} />;
    case "time":
      return <FakeInput icon={<Clock size={14} />} placeholder="HH:MM" accent={accent} />;
    case "datetime":
      return <FakeInput icon={<CalendarIcon size={14} />} placeholder="DD/MM/AAAA — HH:MM" accent={accent} />;

    case "calculate":
      return (
        <PreviewBox
          icon={<Calculator size={14} />}
          tone={accent}
          title="Campo automático"
          detail="Esta variable se completa con una fórmula. Edítala en el panel lateral."
        />
      );

    case "note":
      return (
        <PreviewBox
          icon={<MessageSquare size={14} />}
          tone="var(--pulso-text-soft)"
          title="Nota informativa"
          detail="Mensaje al encuestador. No espera respuesta."
        />
      );

    case "acknowledge":
      return <FakeCheckLine icon={<IconChecklist size={14} />} text="Confirmar que se leyó" accent={accent} />;

    case "hidden":
      return (
        <PreviewBox
          icon={<EyeOff size={14} />}
          tone="var(--pulso-text-soft)"
          title="Campo oculto"
          detail="Viaja con el envío pero el encuestador no lo ve."
        />
      );

    case "start":
    case "end":
    case "today":
    case "deviceid":
    case "username":
      return (
        <PreviewBox
          icon={<IconAI size={14} />}
          tone="var(--pulso-text-soft)"
          title="Auto-meta"
          detail={`El sistema captura este valor automáticamente (${base}).`}
        />
      );

    case "image":
      return <FakeUpload icon={<ImagePlus size={14} />} text="Tomar foto o subir imagen" accent={accent} />;
    case "audio":
      return <FakeUpload icon={<Mic size={14} />} text="Grabar o subir audio" accent={accent} />;
    case "video":
      return <FakeUpload icon={<Camera size={14} />} text="Grabar o subir video" accent={accent} />;
    case "file":
      return <FakeUpload icon={<Camera size={14} />} text="Subir archivo" accent={accent} />;
    case "barcode":
      return <FakeUpload icon={<QrCode size={14} />} text="Escanear código de barras o QR" accent={accent} />;

    case "geopoint":
    case "geotrace":
    case "geoshape":
      return (
        <FakeUpload
          icon={<MapPin size={14} />}
          text={
            base === "geopoint"
              ? "Capturar ubicación (punto)"
              : base === "geotrace"
                ? "Capturar recorrido"
                : "Capturar área"
          }
          accent={accent}
        />
      );

    default:
      return (
        <PreviewBox
          icon={<CircleDot size={14} />}
          tone="var(--pulso-text-soft)"
          title={`Tipo: ${base || "sin definir"}`}
          detail="No hay vista previa específica para este tipo todavía."
        />
      );
  }
}

// -----------------------------------------------------------------------------
// Building blocks de UI fake (idénticos a PreviewQuestionCard)
// -----------------------------------------------------------------------------

function FakeInput({
  icon,
  placeholder,
  multiline,
  accent,
}: {
  icon: React.ReactNode;
  placeholder: string;
  multiline?: boolean;
  accent: string;
}) {
  return (
    <div className="pulso-canvas-fakeinput" style={{ borderColor: accent }}>
      <span className="pulso-canvas-fakeinput-icon" style={{ color: accent }}>
        {icon}
      </span>
      <span className="pulso-canvas-fakeinput-placeholder">
        {placeholder}
        {multiline && " · multilínea"}
      </span>
    </div>
  );
}

function FakeUpload({
  icon,
  text,
  accent,
}: {
  icon: React.ReactNode;
  text: string;
  accent: string;
}) {
  return (
    <button type="button" disabled className="pulso-canvas-fakeupload" style={{ borderColor: accent, color: accent }}>
      <span style={{ color: accent }}>{icon}</span>
      <span>{text}</span>
    </button>
  );
}

function FakeCheckLine({
  icon,
  text,
  accent,
}: {
  icon: React.ReactNode;
  text: string;
  accent: string;
}) {
  return (
    <div className="pulso-canvas-fakecheck">
      <span className="pulso-canvas-choice-mark is-check" style={{ borderColor: accent }} />
      <span style={{ color: accent }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function PreviewBox({
  icon,
  tone,
  title,
  detail,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="pulso-canvas-previewbox">
      <span className="pulso-canvas-previewbox-icon" style={{ color: tone }}>
        {icon}
      </span>
      <div>
        <strong style={{ color: tone, fontSize: 12, letterSpacing: 0.3, textTransform: "uppercase" }}>
          {title}
        </strong>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
          {detail}
        </p>
      </div>
    </div>
  );
}

// Re-export del PreviewQuestionCard original via PreviewBox style — no es
// estrictamente necesario, pero ayuda a otros consumidores que sólo
// quieran un placeholder visual ligero.
ListChecks; // prevent tree-shake of unused-icon import warning if any
