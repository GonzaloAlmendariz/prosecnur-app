// =============================================================================
// canvas/PreviewQuestionCard.tsx — preview fiel de una pregunta del formulario
// =============================================================================
// Renderiza una pregunta tal como la verá el encuestador en ODK Collect /
// KoBo, pero con el lenguaje visual de Pulso. Inputs reales (radio,
// checkbox, type=number, type=date, etc.) en estado disabled — no se puede
// responder, es solo previsualización.
//
// Diferencia clave con `AnswerPreview` previo: aquí los controles son
// fieles al tipo (radio para SO, checkbox para SM, datepicker para date,
// textarea para text+multiline, etc.) y se ven como un formulario real,
// no como un mockup textual.
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
import { renderMarkdownInline } from "../helpers/markdown";
import { typeLabel } from "../parsing/parseType";

export type PreviewQuestionCardProps = {
  node: BuilderNode;
  /** Opciones del catálogo asociado (si es select_one/multiple). */
  choices: ChoiceItem[];
  /** Posición de la pregunta dentro del outline (1-indexed) — se muestra
   *  como número de pregunta en el header. */
  position?: number;
};

export function PreviewQuestionCard({ node, choices, position }: PreviewQuestionCardProps) {
  const accent = paletteForType(node.typeInfo.base);
  const accentSoft = paletteSoftForType(node.typeInfo.base);
  const Icon = iconForType(node.typeInfo.base);

  return (
    <article
      className="pulso-canvas-card"
      style={{ "--card-accent": accent, "--card-accent-soft": accentSoft } as CSSProperties}
    >
      {/* Header: tipo + posición + obligatoria */}
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
          <span
            className="pulso-canvas-card-required"
            title="Pregunta obligatoria"
          >
            ★ Obligatoria
          </span>
        )}
        {node.relevant && (
          <span className="pulso-canvas-card-conditional" title="Aparece bajo una condición">
            <ConditionalIcon size={12} weight="thin" /> Condicional
          </span>
        )}
      </div>

      {/* Label + hint */}
      <div className="pulso-canvas-card-prompt">
        {node.label ? (
          <h3
            className="pulso-canvas-card-label"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: renderMarkdownInline(node.label),
            }}
          />
        ) : (
          <h3 className="pulso-canvas-card-label">
            <em style={{ color: "var(--pulso-warn-fg)" }}>
              (sin texto · agrégalo en el inspector)
            </em>
          </h3>
        )}
        {node.hint && (
          <p
            className="pulso-canvas-card-hint"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: renderMarkdownInline(node.hint),
            }}
          />
        )}
      </div>

      {/* Input fiel al tipo */}
      <div className="pulso-canvas-card-input">
        <PreviewInput node={node} choices={choices} accent={accent} />
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
// PreviewInput — switch por tipo XLSForm para renderizar el control adecuado
// -----------------------------------------------------------------------------

function PreviewInput({
  node,
  choices,
  accent,
}: {
  node: BuilderNode;
  choices: ChoiceItem[];
  accent: string;
}) {
  const base = node.typeInfo.base;

  switch (base) {
    case "select_one":
      return <ChoiceList items={choices} kind="radio" accent={accent} listName={node.typeInfo.listName} />;
    case "select_multiple":
      return <ChoiceList items={choices} kind="check" accent={accent} listName={node.typeInfo.listName} />;

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
          title="Variable calculada"
          detail={node.calculation || "Sin fórmula declarada."}
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
      return (
        <FakeCheckLine icon={<IconChecklist size={14} />} text="Confirmar que se leyó" accent={accent} />
      );

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
      return (
        <FakeUpload icon={<QrCode size={14} />} text="Escanear código de barras o QR" accent={accent} />
      );

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

    case "begin_group":
    case "begin_repeat":
      return (
        <PreviewBox
          icon={<ListChecks size={14} />}
          tone={accent}
          title={base === "begin_group" ? "Sección" : "Bloque repetido"}
          detail={
            base === "begin_group"
              ? "Agrupa preguntas relacionadas. Vive como container en el formulario."
              : "Se repite por cada caso (ej. por cada miembro del hogar)."
          }
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
// Building blocks de UI fake
// -----------------------------------------------------------------------------

function ChoiceList({
  items,
  kind,
  accent,
  listName,
}: {
  items: ChoiceItem[];
  kind: "radio" | "check";
  accent: string;
  listName: string;
}) {
  if (!items.length) {
    return (
      <PreviewBox
        icon={<ListChecks size={14} />}
        tone="var(--pulso-warn-fg)"
        title={listName ? `Catálogo «${listName}» vacío` : "Sin catálogo asignado"}
        detail={
          listName
            ? "Agrega opciones en el editor de catálogos para que esta pregunta tenga respuestas posibles."
            : "Asigna un catálogo desde el inspector para que la pregunta sea respondible."
        }
      />
    );
  }
  return (
    <ul className="pulso-canvas-choices">
      {items.slice(0, 8).map((it, idx) => (
        <li key={`${it.rowIndex}-${idx}`} className="pulso-canvas-choice-item">
          <span
            className={`pulso-canvas-choice-mark ${kind === "radio" ? "is-radio" : "is-check"}`}
            style={{ borderColor: accent }}
          />
          <span className="pulso-canvas-choice-label">{it.label || it.name}</span>
          {it.label && it.label !== it.name && (
            <code className="pulso-canvas-choice-code">{it.name}</code>
          )}
        </li>
      ))}
      {items.length > 8 && (
        <li className="pulso-canvas-choice-more">
          + {items.length - 8} opciones más
        </li>
      )}
    </ul>
  );
}

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
      <span
        className="pulso-canvas-choice-mark is-check"
        style={{ borderColor: accent }}
      />
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
