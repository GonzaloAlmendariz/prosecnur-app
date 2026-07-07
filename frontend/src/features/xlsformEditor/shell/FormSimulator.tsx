// =============================================================================
// shell/FormSimulator.tsx — "Probar formulario": vista previa interactiva
// =============================================================================
// Overlay full-screen donde el usuario llena el formulario como encuestado
// real, sección por sección (estilo KoboToolbox). Respeta la lógica de
// visibilidad (`relevant`) evaluándola en vivo contra las respuestas con el
// evaluador de logic/evaluate.ts; las expresiones que el evaluador no cubre
// se tratan como visibles y se marcan con el badge "lógica avanzada".
//
// Estado 100% interno (sin persistencia): respuestas por `name` de variable.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react";
import type {
  BuilderNode,
  BuilderStructure,
  ChoiceItem,
  XlsformEditorWorkbook,
} from "../types";
import { buildCatalogs } from "../parsing/buildIndex";
import { typeLabel } from "../parsing/parseType";
import { iconForType } from "../helpers/icons";
import { paletteForType } from "../helpers/paletteForType";
import { TechTerm } from "../helpers/TechTerm";
import { evaluateRelevance } from "../logic";
import "../styles/xf-simulator.css";

export type FormSimulatorProps = {
  open: boolean;
  onClose: () => void;
  workbook: XlsformEditorWorkbook;
  structure: BuilderStructure | null;
  onEditRow?: (rowIndex: number) => void;
};

// -----------------------------------------------------------------------------
// Modelo interno
// -----------------------------------------------------------------------------

type SimValue = string | string[];

type VisState = { visible: boolean; advanced: boolean };

type SimPage = {
  id: string;
  title: string;
  kind: "root" | "section" | "repeat";
  nodes: BuilderNode[];
  order: number;
};

/** Tipos auto-capturados que el encuestado nunca ve. */
const AUTO_BASES = new Set(["start", "end", "today", "deviceid", "username", "hidden"]);

/** Tipos con control editable en el simulador. */
const ANSWERABLE_BASES = new Set([
  "select_one",
  "select_multiple",
  "integer",
  "decimal",
  "text",
  "date",
  "time",
  "datetime",
  "acknowledge",
]);

function isRenderable(node: BuilderNode): boolean {
  if (node.kind !== "question" && node.kind !== "note") return false;
  return !AUTO_BASES.has(node.typeInfo.base);
}

function hasAnswer(value: SimValue | undefined): boolean {
  if (value == null) return false;
  return Array.isArray(value) ? value.length > 0 : value.trim() !== "";
}

function readFormTitle(workbook: XlsformEditorWorkbook): string {
  const idx = workbook.settings.columns.indexOf("form_title");
  if (idx < 0) return "";
  return (workbook.settings.rows[0]?.[idx] ?? "").trim();
}

const ALWAYS_VISIBLE: VisState = { visible: true, advanced: false };

// -----------------------------------------------------------------------------
// Componente principal
// -----------------------------------------------------------------------------

export function FormSimulator({
  open,
  onClose,
  workbook,
  structure,
  onEditRow,
}: FormSimulatorProps) {
  const [answers, setAnswers] = useState<Record<string, SimValue>>({});
  const [pageIdx, setPageIdx] = useState(0);

  useEffect(() => {
    if (open) setPageIdx(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const formTitle = useMemo(() => readFormTitle(workbook), [workbook]);

  const choicesByList = useMemo(() => {
    const map = new Map<string, ChoiceItem[]>();
    buildCatalogs(workbook.choices).forEach((catalog) => {
      map.set(catalog.listName, catalog.items);
    });
    return map;
  }, [workbook]);

  // Páginas: una por sección con contenido renderizable (root incluido).
  const pages = useMemo<SimPage[]>(() => {
    if (!structure) return [];
    const out: SimPage[] = [];
    Array.from(structure.sections.values()).forEach((meta) => {
      const nodes = structure.outline.filter(
        (node) => node.sectionId === meta.id && isRenderable(node),
      );
      if (!nodes.length) return;
      out.push({
        id: meta.id,
        title:
          meta.kind === "root"
            ? formTitle || "Inicio"
            : meta.label || meta.name || "Sección",
        kind: meta.kind,
        nodes,
        order: meta.rowIndex ?? Math.min(...nodes.map((node) => node.rowIndex)),
      });
    });
    return out.sort((a, b) => a.order - b.order);
  }, [structure, formTitle]);

  // Visibilidad efectiva por sección: propia ∧ todos los ancestros.
  const sectionState = useMemo(() => {
    const map = new Map<string, VisState>();
    if (!structure) return map;
    const resolve = (id: string): VisState => {
      const cached = map.get(id);
      if (cached) return cached;
      const meta = structure.sections.get(id);
      if (!meta) {
        map.set(id, ALWAYS_VISIBLE);
        return ALWAYS_VISIBLE;
      }
      const parent = meta.parentId ? resolve(meta.parentId) : ALWAYS_VISIBLE;
      const node = meta.rowIndex != null ? structure.byRow.get(meta.rowIndex) : null;
      const own = node?.relevant
        ? evaluateRelevance(node.relevant, answers)
        : ALWAYS_VISIBLE;
      const state: VisState = {
        visible: parent.visible && own.visible,
        advanced: parent.advanced || own.advanced,
      };
      map.set(id, state);
      return state;
    };
    Array.from(structure.sections.keys()).forEach((id) => resolve(id));
    return map;
  }, [structure, answers]);

  // Visibilidad efectiva por pregunta (sección ∧ relevant propio).
  const nodeState = useMemo(() => {
    const map = new Map<number, VisState>();
    if (!structure) return map;
    structure.outline.forEach((node) => {
      if (!isRenderable(node)) return;
      const section = sectionState.get(node.sectionId) ?? ALWAYS_VISIBLE;
      const own = node.relevant
        ? evaluateRelevance(node.relevant, answers)
        : ALWAYS_VISIBLE;
      map.set(node.rowIndex, {
        visible: section.visible && own.visible,
        advanced: own.advanced,
      });
    });
    return map;
  }, [structure, sectionState, answers]);

  const visiblePages = useMemo(
    () =>
      pages.filter(
        (page) =>
          (sectionState.get(page.id)?.visible ?? true) &&
          page.nodes.some((node) => nodeState.get(node.rowIndex)?.visible),
      ),
    [pages, sectionState, nodeState],
  );

  const clampedIdx = Math.min(pageIdx, Math.max(visiblePages.length - 1, 0));
  const currentPage = visiblePages[clampedIdx] ?? null;

  const visibleQuestions = useMemo(
    () =>
      pages
        .flatMap((page) => page.nodes)
        .filter(
          (node) =>
            node.kind === "question" &&
            node.name !== "" &&
            ANSWERABLE_BASES.has(node.typeInfo.base) &&
            (nodeState.get(node.rowIndex)?.visible ?? false),
        ),
    [pages, nodeState],
  );
  const answeredCount = visibleQuestions.filter((node) =>
    hasAnswer(answers[node.name]),
  ).length;

  const setAnswer = useCallback((name: string, value: SimValue) => {
    if (!name) return;
    setAnswers((prev) => ({ ...prev, [name]: value }));
  }, []);

  const reset = useCallback(() => {
    setAnswers({});
    setPageIdx(0);
  }, []);

  const handleEdit = useMemo(() => {
    if (!onEditRow) return undefined;
    return (rowIndex: number) => {
      onEditRow(rowIndex);
      onClose();
    };
  }, [onEditRow, onClose]);

  if (!open) return null;

  const progressFraction = visiblePages.length
    ? (clampedIdx + 1) / visiblePages.length
    : 0;

  return createPortal(
    <div
      className="pulso-graph-overlay pulso-xfsim-overlay pulso-xf-overlay-enter"
      role="dialog"
      aria-modal="true"
      aria-label="Probar formulario"
    >
      <header className="pulso-graph-header">
        <div className="pulso-graph-header-left">
          <button type="button" className="pulso-graph-back" onClick={onClose}>
            <ChevronLeft size={14} /> Volver al editor
          </button>
          <div className="pulso-graph-header-title">
            <strong>Probar formulario</strong>
            <span>
              {answeredCount} de {visibleQuestions.length} respondida
              {visibleQuestions.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="pulso-graph-header-right">
          <button type="button" className="pulso-xfsim-pill" onClick={reset}>
            <RotateCcw size={13} /> Reiniciar
          </button>
          <button
            type="button"
            className="pulso-icon"
            onClick={onClose}
            aria-label="Cerrar simulador"
            title="Cerrar"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="pulso-xfsim-progress" aria-hidden="true">
        <i style={{ transform: `scaleX(${progressFraction})` }} />
      </div>

      <main className="pulso-xfsim-main">
        {currentPage ? (
          <div className="pulso-xfsim-sheet" key={currentPage.id}>
            <header className="pulso-xfsim-page-head">
              <div className="pulso-xfsim-page-title">
                <strong>{currentPage.title}</strong>
                {currentPage.kind === "repeat" ? (
                  <span className="pulso-xfsim-page-badge">se repite en campo</span>
                ) : null}
              </div>
              <span className="pulso-xfsim-page-count">
                Sección {clampedIdx + 1} de {visiblePages.length}
              </span>
            </header>

            <div className="pulso-xfsim-cards">
              {currentPage.nodes.map((node) => (
                <QuestionSlot
                  key={node.rowIndex}
                  node={node}
                  state={nodeState.get(node.rowIndex) ?? ALWAYS_VISIBLE}
                  value={answers[node.name]}
                  choicesByList={choicesByList}
                  onAnswer={setAnswer}
                  onEdit={handleEdit}
                />
              ))}
            </div>

            <footer className="pulso-xfsim-nav">
              <button
                type="button"
                className="pulso-xfsim-pill"
                disabled={clampedIdx === 0}
                onClick={() => setPageIdx(Math.max(clampedIdx - 1, 0))}
              >
                <ChevronLeft size={14} /> Anterior
              </button>
              <span className="pulso-xfsim-nav-count">
                {clampedIdx + 1} / {visiblePages.length}
              </span>
              <button
                type="button"
                className="pulso-xfsim-pill is-primary"
                disabled={clampedIdx >= visiblePages.length - 1}
                onClick={() =>
                  setPageIdx(Math.min(clampedIdx + 1, visiblePages.length - 1))
                }
              >
                Siguiente <ChevronRight size={14} />
              </button>
            </footer>
          </div>
        ) : (
          <div className="pulso-xfsim-empty">
            <strong>No hay preguntas para simular</strong>
            <span>Agrega preguntas en el constructor y vuelve a abrir esta vista.</span>
          </div>
        )}
      </main>
    </div>,
    document.body,
  );
}

// -----------------------------------------------------------------------------
// Card de pregunta (con slot animable para aparecer/desaparecer por lógica)
// -----------------------------------------------------------------------------

function QuestionSlot({
  node,
  state,
  value,
  choicesByList,
  onAnswer,
  onEdit,
}: {
  node: BuilderNode;
  state: VisState;
  value: SimValue | undefined;
  choicesByList: Map<string, ChoiceItem[]>;
  onAnswer: (name: string, value: SimValue) => void;
  onEdit?: (rowIndex: number) => void;
}) {
  const visible = state.visible;
  const accent = paletteForType(node.typeInfo.base);
  const Icon = iconForType(node.typeInfo.base);
  const answered = hasAnswer(value);
  const pendingRequired = node.required && !answered && node.kind === "question";

  return (
    <div
      className={`pulso-xfsim-slot${visible ? " is-visible" : ""}`}
      aria-hidden={!visible}
    >
      <div className="pulso-xfsim-slot-inner">
        <article
          className={`pulso-xfsim-card${node.kind === "note" ? " is-note" : ""}`}
          style={{ "--xfsim-accent": accent } as CSSProperties}
        >
          <header className="pulso-xfsim-card-head">
            <span
              className="pulso-xfsim-card-icon"
              style={{ color: accent }}
              aria-hidden="true"
            >
              <Icon size={13} />
            </span>
            <span className="pulso-xfsim-card-label">
              {node.label}
              {pendingRequired ? (
                <i className="pulso-xfsim-req" title="Obligatoria sin responder" />
              ) : null}
            </span>
            {state.advanced ? (
              <span
                className="pulso-xfsim-adv"
                title="Este salto usa funciones que el simulador no evalúa"
              >
                <GitBranch size={10} /> lógica avanzada
              </span>
            ) : null}
            {onEdit ? (
              <button
                type="button"
                className="pulso-xfsim-edit"
                aria-label="Editar esta pregunta"
                title="Editar esta pregunta"
                tabIndex={visible ? 0 : -1}
                onClick={() => onEdit(node.rowIndex)}
              >
                <Pencil size={12} />
              </button>
            ) : null}
          </header>
          {node.hint ? <div className="pulso-xfsim-hint">{node.hint}</div> : null}
          <QuestionControl
            node={node}
            value={value}
            disabled={!visible}
            choicesByList={choicesByList}
            onAnswer={onAnswer}
          />
        </article>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Control por tipo de pregunta
// -----------------------------------------------------------------------------

function QuestionControl({
  node,
  value,
  disabled,
  choicesByList,
  onAnswer,
}: {
  node: BuilderNode;
  value: SimValue | undefined;
  disabled: boolean;
  choicesByList: Map<string, ChoiceItem[]>;
  onAnswer: (name: string, value: SimValue) => void;
}) {
  const base = node.typeInfo.base;

  if (node.kind === "note") return null;

  if (base === "select_one" || base === "select_multiple") {
    const items = choicesByList.get(node.typeInfo.listName) ?? [];
    if (!items.length) {
      return (
        <div className="pulso-xfsim-options-empty">
          Sin opciones en la lista <TechTerm t={node.typeInfo.listName || "choices"} />
        </div>
      );
    }
    const multi = base === "select_multiple";
    const selectedValues = multi
      ? Array.isArray(value)
        ? value
        : []
      : typeof value === "string" && value
        ? [value]
        : [];
    return (
      <div
        className="pulso-xfsim-options"
        role={multi ? "group" : "radiogroup"}
        aria-label={node.label}
      >
        {items.map((item) => {
          const isSelected = selectedValues.includes(item.name);
          return (
            <button
              key={`${item.rowIndex}-${item.name}`}
              type="button"
              role={multi ? "checkbox" : "radio"}
              aria-checked={isSelected}
              className={`pulso-xfsim-option${isSelected ? " is-selected" : ""}`}
              disabled={disabled}
              onClick={() => {
                if (multi) {
                  const next = isSelected
                    ? selectedValues.filter((v) => v !== item.name)
                    : [...selectedValues, item.name];
                  onAnswer(node.name, next);
                } else {
                  onAnswer(node.name, isSelected ? "" : item.name);
                }
              }}
            >
              <span
                className={`pulso-xfsim-option-mark${multi ? " is-multi" : ""}`}
                aria-hidden="true"
              >
                <Check size={12} className="pulso-xfsim-option-check" />
              </span>
              <span className="pulso-xfsim-option-label">
                {item.label || item.name}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (base === "integer" || base === "decimal") {
    return (
      <input
        className="pulso-xfsim-input"
        type="number"
        inputMode={base === "integer" ? "numeric" : "decimal"}
        step={base === "integer" ? 1 : "any"}
        placeholder="0"
        disabled={disabled}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onAnswer(node.name, event.target.value)}
      />
    );
  }

  if (base === "text") {
    return (
      <input
        className="pulso-xfsim-input is-wide"
        type="text"
        placeholder="Escribe una respuesta"
        disabled={disabled}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onAnswer(node.name, event.target.value)}
      />
    );
  }

  if (base === "date" || base === "time" || base === "datetime") {
    const inputType = base === "datetime" ? "datetime-local" : base;
    return (
      <input
        className="pulso-xfsim-input"
        type={inputType}
        disabled={disabled}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onAnswer(node.name, event.target.value)}
      />
    );
  }

  if (base === "acknowledge") {
    const isOn = value === "OK";
    return (
      <div className="pulso-xfsim-options" role="group" aria-label={node.label}>
        <button
          type="button"
          role="checkbox"
          aria-checked={isOn}
          className={`pulso-xfsim-option${isOn ? " is-selected" : ""}`}
          disabled={disabled}
          onClick={() => onAnswer(node.name, isOn ? "" : "OK")}
        >
          <span className="pulso-xfsim-option-mark is-multi" aria-hidden="true">
            <Check size={12} className="pulso-xfsim-option-check" />
          </span>
          <span className="pulso-xfsim-option-label">Entendido</span>
        </button>
      </div>
    );
  }

  // Tipos que solo se capturan en campo (gps, foto, audio, código, …).
  const PlaceholderIcon = iconForType(base);
  return (
    <div className="pulso-xfsim-placeholder">
      <PlaceholderIcon size={14} />
      <span>{typeLabel(base)}</span>
      <em>se captura en campo</em>
    </div>
  );
}
