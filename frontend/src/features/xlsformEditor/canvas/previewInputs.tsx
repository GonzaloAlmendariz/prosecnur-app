// =============================================================================
// canvas/previewInputs.tsx — render compartido del "input fiel al tipo"
// =============================================================================
// Módulo único que reemplaza el switch duplicado que vivía en
// `PreviewQuestionCard` y `EditableQuestionCard`. Expone:
//
//   - `previewKindForType(node)`: función PURA que decide qué rama visual
//     aplica para un nodo (tipo base + appearance). Testeable sin DOM.
//   - `PreviewInputForType`: el componente que renderiza esa rama.
//   - Building blocks (`FakeInput`, `FakeUpload`, `FakeCheckLine`,
//     `PreviewBox`, `ChoiceList`) por si otro consumidor quiere solo una pieza.
//
// `choiceSlot` permite a `EditableQuestionCard` inyectar su
// `EditableChoiceList` para select_one/select_multiple: en las variantes de
// lista plana reemplaza al `ChoiceList` read-only; en las variantes visuales
// (likert, dropdown) se muestra DEBAJO del mock para no perder la edición
// inline de opciones.
// =============================================================================

import { useState } from "react";
import type { ReactNode } from "react";
import {
  Calculator,
  Calendar as CalendarIcon,
  Camera,
  ChevronDown,
  CircleDot,
  Clock,
  EyeOff,
  FileSpreadsheet,
  GripVertical,
  Hash,
  ImagePlus,
  ListChecks,
  ListOrdered,
  MapPin,
  MessageSquare,
  Mic,
  QrCode,
  Search,
  SlidersHorizontal,
  Type as TypeIcon,
} from "lucide-react";
import { IconAI, IconChecklist } from "../../../lib/icons";
import type { BuilderNode, ChoiceItem } from "../types";
import { TechTerm } from "../helpers/TechTerm";
import "../styles/xf-preview-inputs.css";

// -----------------------------------------------------------------------------
// Clasificación pura: tipo base + appearance → rama visual
// -----------------------------------------------------------------------------

export type PreviewKind =
  | "select-list"
  | "select-columns"
  | "select-likert"
  | "select-dropdown"
  | "select-external"
  | "number"
  | "text"
  | "date"
  | "time"
  | "datetime"
  | "range"
  | "rank"
  | "calculate"
  | "note"
  | "acknowledge"
  | "hidden"
  | "auto"
  | "image"
  | "audio"
  | "video"
  | "file"
  | "barcode"
  | "geo"
  | "group"
  | "fallback";

/** Tokens del campo `appearance` (space-separated). */
export function appearanceTokens(node: Pick<BuilderNode, "appearance">): string[] {
  return (node.appearance ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
}

function hasColumnsAppearance(tokens: string[]): boolean {
  return tokens.some((token) => token === "columns" || token === "columns-pack" || /^columns-\d+$/.test(token));
}

/**
 * Decide qué rama del render aplica para un nodo. Función pura — es la
 * fuente de verdad del switch de `PreviewInputForType` y lo que cubren
 * los tests (sin necesidad de renderizar DOM).
 */
export function previewKindForType(
  node: Pick<BuilderNode, "typeInfo" | "appearance">,
): PreviewKind {
  const base = node.typeInfo.base;
  const tokens = appearanceTokens(node);

  if (base === "select_one_from_file" || base === "select_multiple_from_file") {
    return "select-external";
  }

  if (base === "select_one" || base === "select_multiple") {
    if (tokens.includes("xml-external")) return "select-external";
    if (base === "select_one") {
      if (tokens.includes("likert")) return "select-likert";
      if (tokens.includes("minimal") || tokens.includes("autocomplete") || tokens.includes("dropdown")) {
        return "select-dropdown";
      }
    }
    if (hasColumnsAppearance(tokens)) return "select-columns";
    return "select-list";
  }

  switch (base) {
    case "integer":
    case "decimal":
      return "number";
    case "text":
      return "text";
    case "date":
      return "date";
    case "time":
      return "time";
    case "datetime":
      return "datetime";
    case "range":
      return "range";
    case "rank":
      return "rank";
    case "calculate":
      return "calculate";
    case "note":
      return "note";
    case "acknowledge":
      return "acknowledge";
    case "hidden":
      return "hidden";
    case "start":
    case "end":
    case "today":
    case "deviceid":
    case "username":
      return "auto";
    case "image":
      return "image";
    case "audio":
      return "audio";
    case "video":
      return "video";
    case "file":
      return "file";
    case "barcode":
      return "barcode";
    case "geopoint":
    case "geotrace":
    case "geoshape":
      return "geo";
    case "begin_group":
    case "begin_repeat":
      return "group";
    default:
      return "fallback";
  }
}

/**
 * Parámetros de un `range` leídos de la columna `parameters`
 * (ej. "start=1 end=10 step=1" o "start=1;end=10;step=1"). Fallback 0–10.
 */
export function rangeParamsForNode(
  node: Pick<BuilderNode, "parameters">,
): { start: number; end: number; step: number } {
  const out = { start: 0, end: 10, step: 1 };
  const raw = (node.parameters ?? "").trim();
  if (!raw) return out;
  for (const pair of raw.split(/[;,\s]+/)) {
    const [key, value] = pair.split("=");
    if (!key || value == null) continue;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) continue;
    if (key === "start") out.start = parsed;
    else if (key === "end") out.end = parsed;
    else if (key === "step" && parsed > 0) out.step = parsed;
  }
  if (out.end < out.start) out.end = out.start;
  return out;
}

// -----------------------------------------------------------------------------
// PreviewInputForType — el switch visual, compartido por ambas cards
// -----------------------------------------------------------------------------

export type PreviewInputForTypeProps = {
  node: BuilderNode;
  choices: ChoiceItem[];
  accent: string;
  /** Lista de opciones editable (EditableChoiceList) inyectada por
   *  EditableQuestionCard. Reemplaza al ChoiceList read-only en las ramas
   *  de lista; en likert/dropdown se muestra debajo del mock. */
  choiceSlot?: ReactNode;
};

export function PreviewInputForType({ node, choices, accent, choiceSlot }: PreviewInputForTypeProps) {
  const kind = previewKindForType(node);
  const base = node.typeInfo.base;
  const selectKind: "radio" | "check" = base === "select_multiple" ? "check" : "radio";

  switch (kind) {
    case "select-list":
      return (
        choiceSlot ?? (
          <ChoiceList items={choices} kind={selectKind} accent={accent} listName={node.typeInfo.listName} />
        )
      );

    case "select-columns":
      return (
        choiceSlot ?? (
          <ChoiceList
            items={choices}
            kind={selectKind}
            accent={accent}
            listName={node.typeInfo.listName}
            columns
          />
        )
      );

    case "select-likert":
      if (!choices.length) {
        return (
          choiceSlot ?? (
            <ChoiceList items={choices} kind={selectKind} accent={accent} listName={node.typeInfo.listName} />
          )
        );
      }
      return (
        <>
          <LikertScale items={choices} accent={accent} />
          {choiceSlot}
        </>
      );

    case "select-dropdown":
      if (!choices.length) {
        return (
          choiceSlot ?? (
            <ChoiceList items={choices} kind={selectKind} accent={accent} listName={node.typeInfo.listName} />
          )
        );
      }
      return (
        <>
          <DropdownField count={choices.length} accent={accent} />
          {choiceSlot}
        </>
      );

    case "select-external":
      return (
        <PreviewBox
          icon={<FileSpreadsheet size={14} />}
          tone={accent}
          title="Opciones desde archivo externo"
          detail={
            node.typeInfo.listName ? (
              <>
                Las opciones se leen del archivo <code>{node.typeInfo.listName}</code> al desplegar el
                formulario en campo.
              </>
            ) : (
              "Las opciones se leen de un archivo adjunto al desplegar el formulario en campo."
            )
          }
        />
      );

    case "number":
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
          multiline={appearanceTokens(node).includes("multiline")}
          accent={accent}
        />
      );

    case "date":
      return <FakeInput icon={<CalendarIcon size={14} />} placeholder="DD/MM/AAAA" accent={accent} />;
    case "time":
      return <FakeInput icon={<Clock size={14} />} placeholder="HH:MM" accent={accent} />;
    case "datetime":
      return <FakeInput icon={<CalendarIcon size={14} />} placeholder="DD/MM/AAAA — HH:MM" accent={accent} />;

    case "range":
      return <RangeSliderMock node={node} accent={accent} />;

    case "rank":
      return <RankList items={choices} accent={accent} listName={node.typeInfo.listName} />;

    case "calculate":
      return (
        <PreviewBox
          icon={<Calculator size={14} />}
          tone={accent}
          title="Variable calculada"
          detail={
            node.calculation ? (
              <code className="pulso-xfpi-formula">{node.calculation}</code>
            ) : (
              "Sin fórmula declarada — defínela en el panel lateral."
            )
          }
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

    case "auto":
      return (
        <PreviewBox
          icon={<IconAI size={14} />}
          tone="var(--pulso-text-soft)"
          title="Dato automático"
          detail={
            <>
              El sistema captura este valor automáticamente <TechTerm t={base} />.
            </>
          }
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

    case "geo":
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

    case "group":
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
          title={base ? <>Tipo <TechTerm t={base} /></> : "Tipo sin definir"}
          detail="No hay vista previa específica para este tipo todavía."
        />
      );
  }
}

// -----------------------------------------------------------------------------
// ChoiceList — lista de opciones read-only. Con >8 opciones NO trunca: scroll
// interno acotado + fade masks + badge con el total. Con >12 agrega búsqueda
// inline funcional (filtra por label o name).
// -----------------------------------------------------------------------------

const SCROLL_THRESHOLD = 8;
const SEARCH_THRESHOLD = 12;

export function ChoiceList({
  items,
  kind,
  accent,
  listName,
  columns,
}: {
  items: ChoiceItem[];
  kind: "radio" | "check";
  accent: string;
  listName: string;
  /** appearance `columns`/`columns-pack`: opciones en grid de 2 columnas. */
  columns?: boolean;
}) {
  const [query, setQuery] = useState("");

  if (!items.length) {
    return (
      <PreviewBox
        icon={<ListChecks size={14} />}
        tone="var(--pulso-warn-fg)"
        title={listName ? `Lista «${listName}» en preparación` : "Sin lista asignada"}
        detail={
          listName
            ? "Agrega opciones en el editor de listas para que esta pregunta tenga respuestas posibles."
            : "Asigna una lista desde el inspector para que la pregunta sea respondible."
        }
      />
    );
  }

  const scrollable = items.length > SCROLL_THRESHOLD;
  const searchable = items.length > SEARCH_THRESHOLD;
  const visible = searchable && query ? filterChoices(items, query) : items;

  const list = (
    <ul className={`pulso-canvas-choices${columns ? " pulso-xfpi-columns" : ""}`}>
      {visible.map((it, idx) => (
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
      {visible.length === 0 && (
        <li className="pulso-xfpi-noresults">Sin coincidencias para «{query}»</li>
      )}
    </ul>
  );

  // Lista corta: markup idéntico al histórico (sin wrappers extra).
  if (!scrollable) return list;

  return (
    <div className="pulso-xfpi-listwrap">
      <div className="pulso-xfpi-listhead">
        <span className="pulso-xfpi-count">{items.length} opciones</span>
        {searchable && (
          <SearchInline query={query} onQuery={setQuery} placeholder="Buscar opción…" />
        )}
      </div>
      <div className="pulso-xfpi-scroll">{list}</div>
    </div>
  );
}

export function filterChoices(items: ChoiceItem[], query: string): ChoiceItem[] {
  const needle = normalizeSearch(query);
  if (!needle) return items;
  return items.filter(
    (it) => normalizeSearch(it.label).includes(needle) || normalizeSearch(it.name).includes(needle),
  );
}

function normalizeSearch(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Buscador inline chiquito para listas largas (compartido con la editable). */
export function SearchInline({
  query,
  onQuery,
  placeholder,
}: {
  query: string;
  onQuery: (next: string) => void;
  placeholder: string;
}) {
  return (
    <span className="pulso-xfpi-search">
      <Search size={12} aria-hidden="true" />
      <input
        type="search"
        value={query}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => onQuery(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Buscar opción en la lista"
      />
    </span>
  );
}

// -----------------------------------------------------------------------------
// LikertScale — escala horizontal de radios con labels debajo (hasta 7 puntos)
// -----------------------------------------------------------------------------

function LikertScale({ items, accent }: { items: ChoiceItem[]; accent: string }) {
  const points = items.slice(0, 7);
  return (
    <div className="pulso-xfpi-likert" role="presentation">
      {points.map((it) => (
        <span key={it.rowIndex} className="pulso-xfpi-likert-point">
          <span className="pulso-canvas-choice-mark is-radio" style={{ borderColor: accent }} />
          <span className="pulso-xfpi-likert-label">{it.label || it.name}</span>
        </span>
      ))}
      {items.length > 7 && (
        <span className="pulso-xfpi-likert-more" title={`${items.length - 7} puntos más en la lista`}>
          +{items.length - 7}
        </span>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// DropdownField — select_one con appearance minimal / autocomplete / dropdown
// -----------------------------------------------------------------------------

function DropdownField({ count, accent }: { count: number; accent: string }) {
  return (
    <div className="pulso-canvas-fakeinput pulso-xfpi-dropdown" style={{ borderColor: accent }}>
      <span className="pulso-canvas-fakeinput-placeholder">
        Seleccionar de {count} {count === 1 ? "opción" : "opciones"}…
      </span>
      <span className="pulso-xfpi-dropdown-chev" style={{ color: accent }} aria-hidden="true">
        <ChevronDown size={14} />
      </span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// RangeSliderMock — slider estático con labels min/max de `parameters`
// -----------------------------------------------------------------------------

function RangeSliderMock({ node, accent }: { node: BuilderNode; accent: string }) {
  const { start, end } = rangeParamsForNode(node);
  return (
    <div className="pulso-xfpi-range">
      <span className="pulso-xfpi-range-icon" style={{ color: accent }} aria-hidden="true">
        <SlidersHorizontal size={14} />
      </span>
      <div className="pulso-xfpi-range-body">
        <div className="pulso-xfpi-range-track" aria-hidden="true">
          <i className="pulso-xfpi-range-fill" style={{ background: accent }} />
          <i className="pulso-xfpi-range-thumb" style={{ borderColor: accent }} />
        </div>
        <div className="pulso-xfpi-range-labels">
          <span>{start}</span>
          <span>{end}</span>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// RankList — lista numerada con grip decorativo (el orden se define en campo)
// -----------------------------------------------------------------------------

function RankList({
  items,
  accent,
  listName,
}: {
  items: ChoiceItem[];
  accent: string;
  listName: string;
}) {
  if (!items.length) {
    return (
      <PreviewBox
        icon={<ListOrdered size={14} />}
        tone="var(--pulso-warn-fg)"
        title={listName ? `Lista «${listName}» en preparación` : "Sin lista asignada"}
        detail="Agrega opciones a la lista para que el encuestador pueda ordenarlas."
      />
    );
  }
  return (
    <div className="pulso-xfpi-rank">
      <span className="pulso-xfpi-rank-cap">
        <ListOrdered size={12} aria-hidden="true" />
        El encuestador ordena las opciones por prioridad <TechTerm t="rank" />
      </span>
      <ol className="pulso-xfpi-rank-list">
        {items.slice(0, SCROLL_THRESHOLD).map((it, idx) => (
          <li key={`${it.rowIndex}-${idx}`} className="pulso-xfpi-rank-item">
            <span className="pulso-xfpi-rank-num" style={{ color: accent, borderColor: accent }}>
              {idx + 1}
            </span>
            <span className="pulso-canvas-choice-label">{it.label || it.name}</span>
            <span className="pulso-xfpi-rank-grip" aria-hidden="true">
              <GripVertical size={12} />
            </span>
          </li>
        ))}
        {items.length > SCROLL_THRESHOLD && (
          <li className="pulso-canvas-choice-more">+ {items.length - SCROLL_THRESHOLD} opciones más</li>
        )}
      </ol>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Building blocks de UI fake (antes duplicados en ambas cards)
// -----------------------------------------------------------------------------

export function FakeInput({
  icon,
  placeholder,
  multiline,
  accent,
}: {
  icon: ReactNode;
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

export function FakeUpload({
  icon,
  text,
  accent,
}: {
  icon: ReactNode;
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

export function FakeCheckLine({
  icon,
  text,
  accent,
}: {
  icon: ReactNode;
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

export function PreviewBox({
  icon,
  tone,
  title,
  detail,
}: {
  icon: ReactNode;
  tone: string;
  title: ReactNode;
  detail: ReactNode;
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
