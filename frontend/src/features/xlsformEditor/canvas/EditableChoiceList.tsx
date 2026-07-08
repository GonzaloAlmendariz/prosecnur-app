// =============================================================================
// canvas/EditableChoiceList.tsx — opciones editables inline en el lienzo
// =============================================================================
// Muestra los choices de una pregunta select_one / select_multiple con
// edición in-place del label, botón "+ Agregar opción" al final, eliminar
// por opción, y un badge "Lista compartida con N preguntas" cuando el
// catálogo es usado por más de una pregunta.
//
// Si el usuario quiere divergir, ofrece "Hacer copia para esta pregunta"
// que clona el catálogo a un listName nuevo y reasigna esta pregunta — el
// padre maneja la mutación en `onCloneCatalog`.
//
// Para edición masiva (importar CSV, renombrar code, drag-drop), el
// usuario puede abrir `CatalogsContextLens` desde el badge.
// =============================================================================

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Info, ListChecks, Plus, Trash2, Users } from "lucide-react";
import type { ChoiceItem } from "../types";
import { RichInline } from "../helpers/RichInline";
import { TechTerm } from "../helpers/TechTerm";
import { SearchInline, filterChoices } from "./previewInputs";

/** Con más opciones que esto, la lista gana scroll interno acotado. */
const EDIT_SCROLL_THRESHOLD = 8;
/** Con más opciones que esto, aparece la búsqueda inline. */
const EDIT_SEARCH_THRESHOLD = 12;

export type EditableChoiceListProps = {
  items: ChoiceItem[];
  kind: "radio" | "check";
  accent: string;
  listName: string;
  /** Cuántas preguntas comparten el catálogo (incluyendo la actual). */
  catalogUsageCount?: number;
  /** Otras preguntas que usan esta lista (NO incluye la actual). Si está
   *  vacío, no se muestra el aviso de "lista compartida". */
  sharedWith?: Array<{ rowIndex: number; label: string; name: string }>;
  /** Click en una pregunta del aviso "compartida" → seleccionarla. */
  onSelectSharedQuestion?: (rowIndex: number) => void;
  onLabelChange: (choiceRowIndex: number, value: string) => void;
  onNameChange: (choiceRowIndex: number, value: string) => void;
  onAdd: () => void;
  onRemove: (choiceRowIndex: number) => void;
  /** Renombrar la lista entera. Renombra el listName en la hoja `choices`
   *  y actualiza todas las filas `survey` que la referencian. */
  onRenameList?: (nextListName: string) => void;
  /** Clonar el catálogo solo para la pregunta actual. */
  onCloneCatalog?: () => void;
  /** Abre el editor de catálogos. */
  onOpenCatalogLens?: () => void;
};

export function EditableChoiceList({
  items,
  kind,
  accent,
  listName,
  catalogUsageCount,
  sharedWith,
  onSelectSharedQuestion,
  onLabelChange,
  onNameChange,
  onAdd,
  onRemove,
  onRenameList,
  onCloneCatalog,
  onOpenCatalogLens,
}: EditableChoiceListProps) {
  const isShared = (catalogUsageCount ?? 1) > 1;
  const sharedList = sharedWith ?? [];
  const [query, setQuery] = useState("");

  const scrollable = items.length > EDIT_SCROLL_THRESHOLD;
  const searchable = items.length > EDIT_SEARCH_THRESHOLD;
  // Filtrado con índice ORIGINAL (los placeholders "Opción N" no deben
  // renumerarse al buscar).
  const indexed = items.map((item, idx) => ({ item, idx }));
  const visible =
    searchable && query
      ? indexed.filter(({ item }) => filterChoices([item], query).length > 0)
      : indexed;

  if (!items.length && !listName) {
    return (
      <div className="pulso-canvas-previewbox">
        <span className="pulso-canvas-previewbox-icon" style={{ color: "var(--pulso-warn-fg)" }}>
          <ListChecks size={14} />
        </span>
        <div>
          <strong style={{ color: "var(--pulso-warn-fg)", fontSize: 12, letterSpacing: 0.3, textTransform: "uppercase" }}>
            Sin lista de opciones
          </strong>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
            Asigna o crea una lista desde el panel lateral para que esta pregunta sea respondible.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pulso-choices-edit">
      {/* Aviso de lista compartida con la lista de preguntas afectadas.
          Click en cada chip lleva a esa pregunta — así el usuario sabe
          exactamente a qué afecta editar las opciones. */}
      {isShared && (
        <div className="pulso-choices-edit-shared">
          <div className="pulso-choices-edit-shared-head">
            <Users size={12} />
            <span>
              Lista compartida — los cambios aplican a{" "}
              <strong>{sharedList.length + 1}</strong> preguntas
            </span>
          </div>
          {sharedList.length > 0 && onSelectSharedQuestion && (
            <ul className="pulso-choices-edit-shared-list">
              {sharedList.map((q) => (
                <li key={q.rowIndex}>
                  <button
                    type="button"
                    className="pulso-choices-edit-shared-chip"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSharedQuestion(q.rowIndex);
                    }}
                    title="Ir a esta pregunta"
                  >
                    {q.label || q.name || `fila ${q.rowIndex + 1}`}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {items.length === 0 && (
        <div className="pulso-choices-edit-empty">
          <span className="pulso-choices-edit-empty-icon" aria-hidden="true">
            <Info size={13} />
          </span>
          <div>
            <strong>Lista en preparación</strong>
            <p>
              Agrega la primera opción cuando tengas el texto real. No creamos opciones de ejemplo
              en la hoja de opciones <TechTerm t="choices" />.
            </p>
          </div>
        </div>
      )}

      {/* Contador + búsqueda para listas largas (mismo patrón que el preview
          read-only: scroll interno acotado, el canvas conserva el scroll de
          página). */}
      {scrollable && (
        <div className="pulso-xfpi-edithead">
          <span className="pulso-xfpi-count">{items.length} opciones</span>
          {searchable && (
            <SearchInline query={query} onQuery={setQuery} placeholder="Buscar opción…" />
          )}
        </div>
      )}

      {(() => {
        const list = (
          <ul className="pulso-canvas-choices pulso-choices-edit-list">
            {visible.map(({ item, idx }) => (
              <li
                key={item.rowIndex}
                className="pulso-canvas-choice-item pulso-choice-edit-row"
              >
                <span
                  className={`pulso-canvas-choice-mark ${kind === "radio" ? "is-radio" : "is-check"}`}
                  style={{ borderColor: accent }}
                />
                <RichInline
                  as="span"
                  className="pulso-canvas-choice-label pulso-choice-edit-label"
                  value={item.label}
                  onChange={(v) => onLabelChange(item.rowIndex, v)}
                  placeholder={`Opción ${idx + 1}`}
                  singleLine
                  ariaLabel={`Texto de la opción ${idx + 1}`}
                />
                <ChoiceCodeInput
                  value={item.name}
                  label={item.label}
                  placeholder={`opcion_${idx + 1}`}
                  takenCodes={items
                    .filter((other) => other.rowIndex !== item.rowIndex)
                    .map((other) => other.name)}
                  onCommit={(v) => onNameChange(item.rowIndex, v)}
                />
                <button
                  type="button"
                  className="pulso-choice-edit-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.rowIndex);
                  }}
                  title="Eliminar opción"
                  aria-label="Eliminar opción"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="pulso-xfpi-noresults">Sin coincidencias para «{query}»</li>
            )}
          </ul>
        );
        return scrollable ? <div className="pulso-xfpi-scroll is-editable">{list}</div> : list;
      })()}

      {/* + Agregar opción — SIEMPRE visible, fuera del área con scroll. */}
      <div className="pulso-choice-edit-add-row pulso-xfpi-edit-footer-add">
        <button
          type="button"
          className="pulso-choice-edit-add"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
        >
          <Plus size={13} /> Agregar opción
        </button>
      </div>

      {/* Footer con el nombre de la lista (editable) + acceso al editor
          de catálogos. El nombre lo establece el usuario para reconocer la
          lista cuando quiera reusarla en otra pregunta. */}
      {listName && (
        <div className="pulso-choices-edit-footer">
          <ListNameInput
            value={listName}
            onCommit={(next) => onRenameList?.(next)}
            disabled={!onRenameList}
          />
          {onOpenCatalogLens && (
            <button
              type="button"
              className="pulso-choices-edit-open-lens"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCatalogLens();
              }}
              title="Abrir el editor de listas (importar CSV, ver todas, reordenar masivo)"
            >
              <ExternalLink size={11} /> Ver todas las listas
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// ChoiceCodeInput — input controlado para el `name` (code interno) de la
// opción. Antes era un toggle (display ↔ input on click + autoFocus + onBlur)
// que se cerraba cuando el componente padre re-renderizaba durante la
// edición — el bug típico es: tipeas, el reducer actualiza el workbook,
// React reconcilia, el input pierde foco, el `onBlur` cierra el toggle, y el
// usuario nota que "se desactiva mientras edita".
//
// Esta versión es siempre visible (sin toggle), state local, normaliza
// el valor a un identificador válido (sin espacios ni acentos) cuando el
// usuario pierde el foco. Pequeño hint debajo cuando está enfocado.
// -----------------------------------------------------------------------------

function ChoiceCodeInput({
  value,
  label,
  placeholder,
  takenCodes,
  onCommit,
}: {
  value: string;
  label: string;
  placeholder: string;
  takenCodes: string[];
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const normalizedDraft = normalizeCode(draft);
  const cleanDraft = draft.trim();
  const isEmpty = cleanDraft.length === 0;
  const hasCanonicalFormat = cleanDraft.length > 0 && cleanDraft === normalizedDraft;
  const isDuplicate = normalizedDraft.length > 0 && takenCodes.some((code) => normalizeCode(code) === normalizedDraft);
  const suggestion = suggestChoiceCode(label, value, placeholder, takenCodes);
  const needsReview = isEmpty || !hasCanonicalFormat || isDuplicate;
  const showAssistant = focused;

  // Sincronizar `draft` cuando `value` cambia desde fuera (ej. otro
  // componente normalizó el código). No pisamos al usuario mientras
  // edita — sólo actualizamos si NO estamos enfocados.
  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  const commit = () => {
    const normalized = normalizeCode(draft);
    if (normalized !== value) onCommit(normalized);
    setDraft(normalized);
  };

  const applySuggestion = () => {
    setDraft(suggestion);
    if (suggestion !== value) onCommit(suggestion);
  };

  return (
    <span className={`pulso-choice-code-wrap${focused ? " is-focused" : ""}${showAssistant ? " has-assistant" : ""}`}>
      <input
        type="text"
        className={`pulso-choice-edit-code${needsReview && !focused ? " needs-review" : ""}`}
        value={draft}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label="Código de la opción"
        title="Código de la opción — letras, números y guion bajo (sin tildes ni espacios)"
      />
      {showAssistant && (
        <span className="pulso-choice-code-assistant" role="status">
          <span className="pulso-choice-code-assistant-head">
            {hasCanonicalFormat && !isDuplicate && !isEmpty ? (
              <CheckCircle2 size={11} />
            ) : (
              <Info size={11} />
            )}
            <span>{choiceCodeStatusLabel(isEmpty, hasCanonicalFormat, isDuplicate)}</span>
          </span>
          {suggestion && suggestion !== cleanDraft && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                applySuggestion();
              }}
              title={`Usar ${suggestion}`}
            >
              Usar <code>{suggestion}</code>
            </button>
          )}
        </span>
      )}
    </span>
  );
}

/** Normaliza un texto a un identificador XLSForm válido: sin acentos,
 *  sin espacios, en minúscula. */
function normalizeCode(raw: string): string {
  return raw
    .replace(/ñ/g, "n")
    .normalize("NFD")
    // Quitar diacríticos (tildes, etc).
    .replace(/[\u0300-\u036f]/g, "")
    // Reemplazar caracteres no válidos por _.
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    // Compactar _ múltiples.
    .replace(/_+/g, "_")
    // Trim _ a los lados.
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function suggestChoiceCode(
  label: string,
  currentValue: string,
  fallback: string,
  takenCodes: string[],
): string {
  const base = normalizeCode(label) || normalizeCode(currentValue) || normalizeCode(fallback) || "opcion";
  const taken = new Set(takenCodes.map((code) => normalizeCode(code)).filter(Boolean));
  if (!taken.has(base)) return base;
  for (let index = 2; index <= 99; index += 1) {
    const candidate = `${base}_${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  return base;
}

function choiceCodeStatusLabel(isEmpty: boolean, hasCanonicalFormat: boolean, isDuplicate: boolean): string {
  if (isEmpty) return "Falta código Kobo";
  if (isDuplicate) return "Código repetido en la lista";
  if (!hasCanonicalFormat) return "Conviene limpiar el código";
  return "Código listo para Kobo";
}

// -----------------------------------------------------------------------------
// ListNameInput — input controlado para el nombre del catálogo. Permite al
// usuario darle un nombre humano a la lista (ej. "sexo", "nivel_estudio")
// para reconocerla cuando la quiera reusar en otra pregunta. Validamos el
// formato al perder foco (sin espacios, sin tildes).
// -----------------------------------------------------------------------------

function ListNameInput({
  value,
  onCommit,
  disabled,
}: {
  value: string;
  onCommit: (next: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  const commit = () => {
    const normalized = normalizeCode(draft);
    if (normalized && normalized !== value) onCommit(normalized);
    setDraft(normalized || value);
  };

  return (
    <span className={`pulso-listname-wrap${focused ? " is-focused" : ""}`}>
      <span className="pulso-listname-label">Lista:</span>
      <input
        type="text"
        className="pulso-listname-input"
        value={draft}
        disabled={disabled}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label="Nombre de la lista de opciones"
        title={
          disabled
            ? "Nombre de la lista (solo lectura)"
            : "Cambia el nombre para identificar la lista cuando la reuses en otras preguntas"
        }
      />
    </span>
  );
}
