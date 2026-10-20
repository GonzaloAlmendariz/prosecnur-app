// =============================================================================
// shell/FormSimulator.tsx — "Probar formulario": vista previa interactiva
// =============================================================================
// Pestaña «Probar» donde el usuario llena el formulario como encuestado
// real, sección por sección (estilo KoboToolbox). Respeta la lógica de
// visibilidad (`relevant`) evaluándola en vivo contra las respuestas con el
// evaluador de logic/evaluate.ts; las expresiones que el evaluador no cubre
// se tratan como visibles y se marcan con el badge "lógica avanzada".
//
// Estado 100% interno (sin persistencia): respuestas por `name` de variable.
// Una pestaña no se cierra (ítem 50): sin «Volver» ni «Cerrar». La única salida
// al Constructor es el lápiz «Editar en Constructor» de cada pregunta.
// =============================================================================

import { esMetadato } from "../kit/tiposPregunta";
import { useCallback, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Pencil,
  QrCode,
  RotateCcw,
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
import { appearanceTokens, rangeParamsForNode } from "../canvas/previewInputs";
import "../styles/xf-simulator.css";
import { RecorridoPrueba, RespuestasPrueba } from "./simulador/PanelesPrueba";
import { respuestasDadas, seccionesDelRecorrido } from "./simulador/modeloRecorrido";
import { pendientesParaFinalizar, restriccionIncumplida, type Pendiente } from "./simulador/modeloFinalizar";
import { FaltantesPrueba, PruebaFinalizada } from "./simulador/FinalizarPrueba";
import { esNotaSinTexto, pistaLegible, textoPreguntaPlano, type LectorReferencias } from "../helpers/markdownPregunta";
import { TextoPregunta } from "../helpers/markdownTexto";
import { stripMarkdown } from "../helpers/markdown";

export type FormSimulatorProps = {
  workbook: XlsformEditorWorkbook;
  structure: BuilderStructure | null;
  /** «Editar en Constructor» del lápiz de cada pregunta: la única salida al Constructor. */
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
const esAutomatico = (b: string) => esMetadato(b) || b === "hidden";

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
  "range",
  "rank",
  "barcode",
]);

function isRenderable(node: BuilderNode): boolean {
  if (node.kind !== "question" && node.kind !== "note") return false;
  // Una nota sin texto (la imagen del logo) no es algo que la persona lea: no se pinta como tarjeta.
  return !esAutomatico(node.typeInfo.base) && !esNotaSinTexto(node);
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
  workbook,
  structure,
  onEditRow,
}: FormSimulatorProps) {
  const [answers, setAnswers] = useState<Record<string, SimValue>>({});
  const [pageIdx, setPageIdx] = useState(0);
  // E8: intentar finalizar marca las pendientes; con todo en regla la prueba queda finalizada.
  const [intentoFinalizar, setIntentoFinalizar] = useState(false);
  const [finalizada, setFinalizada] = useState(false);
  const hoja = useRef<HTMLDivElement>(null);


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
            : stripMarkdown(meta.label ?? "").trim() && meta.label.trim() !== meta.name ? meta.label : "Sección sin título",
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
    setIntentoFinalizar(false);
    setFinalizada(false);
  }, []);

  const handleEdit = onEditRow;


  // M1 (2026-10-17): recorrido y respuestas en las franjas que quedaban vacías a los lados de la hoja.
  const esRespondible = (node: BuilderNode) => node.kind === "question" && node.name !== "" && ANSWERABLE_BASES.has(node.typeInfo.base);
  const secciones = seccionesDelRecorrido(pages, visiblePages, currentPage?.id ?? null, esRespondible,
    (node) => nodeState.get(node.rowIndex)?.visible ?? false, answers);
  const respondidas = respuestasDadas(pages, answers, (lista) => choicesByList.get(lista) ?? []);
  const irAPreguntaEnPrueba = (name: string) => {
    const i = visiblePages.findIndex((page) => page.nodes.some((node) => node.name === name));
    if (i >= 0) setPageIdx(i);
  };

  // `${x}` se lee con la respuesta ya dada (la etiqueta de la opción) o, si aún no la hay, «[Etiqueta corta]».
  const nodoDe = useMemo(() => new Map((structure?.outline ?? []).map((n) => [n.name, n])), [structure]);
  const lector = useMemo<LectorReferencias>(() => ({
    etiquetaDe: (name) => nodoDe.get(name)?.label,
    respuestaDe: (name) => {
      const v = answers[name];
      if (!hasAnswer(v)) return undefined;
      const lista = nodoDe.get(name)?.typeInfo.listName;
      const ops = lista ? choicesByList.get(lista) ?? [] : [];
      const etiqueta = (c: string) => stripMarkdown(ops.find((o) => o.name === c)?.label || c);
      return Array.isArray(v) ? v.map(etiqueta).join(", ") : ops.length ? etiqueta(v as string) : (v as string);
    },
  }), [nodoDe, answers, choicesByList]);

  const esUltima = clampedIdx >= visiblePages.length - 1;
  const pendientes = pendientesParaFinalizar(visiblePages, esRespondible, (node) => nodeState.get(node.rowIndex)?.visible ?? false, answers);
  const pendientesSet = new Set(pendientes.map((p) => p.rowIndex));
  const irAPendiente = (p: Pendiente) => {
    setPageIdx(p.pagina);
    // La hoja se monta con la página nueva: el foco va al control de la pregunta en el siguiente cuadro.
    window.requestAnimationFrame(() => {
      const card = hoja.current?.ownerDocument.querySelector<HTMLElement>(`[data-pregunta-prueba="${CSS.escape(p.name)}"]`);
      card?.scrollIntoView({ block: "center" });
      card?.querySelector<HTMLElement>("input, select, button[role=radio], button[role=checkbox], button[aria-pressed]")?.focus({ preventScroll: true });
    });
  };
  const finalizar = () => {
    setIntentoFinalizar(true);
    if (pendientes.length === 0) { setFinalizada(true); return; }
    window.requestAnimationFrame(() => hoja.current?.querySelector(".xfsp-faltan")?.scrollIntoView({ block: "nearest" }));
  };

  const progressFraction = visiblePages.length
    ? (clampedIdx + 1) / visiblePages.length
    : 0;

  const vista = (
    <div
      className="pulso-graph-overlay pulso-xfsim-overlay is-embebido"
      role="region"
      aria-label="Probar formulario"
    >
      <header className="pulso-graph-header">
        <div className="pulso-graph-header-left">
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
        </div>
      </header>

      <div className="pulso-xfsim-progress" aria-hidden="true">
        <i style={{ transform: `scaleX(${progressFraction})` }} />
      </div>

      <div className="pulso-xfsim-main con-paneles" data-qa-geometry-group="xlsform/prueba-columnas" data-qa-geometry-contract="intrinsic">
        {currentPage ? <RecorridoPrueba secciones={secciones} onIr={setPageIdx} /> : null}
        {currentPage ? (
          finalizada ? (
            <div className="pulso-xfsim-sheet">
              <PruebaFinalizada respondidas={answeredCount} onVolver={() => setFinalizada(false)} onReiniciar={reset} />
            </div>
          ) : (
          <div className="pulso-xfsim-sheet" key={currentPage.id} ref={hoja}>
            <header className="pulso-xfsim-page-head">
              <div className="pulso-xfsim-page-title">
                <strong><TextoPregunta texto={currentPage.title} lector={lector} /></strong>
                {currentPage.kind === "repeat" ? (
                  <span className="pulso-xfsim-page-badge">se repite en campo</span>
                ) : null}
              </div>
              <span className="pulso-xfsim-page-count">
                Sección {clampedIdx + 1} de {visiblePages.length}
              </span>
            </header>

            <div className="pulso-xfsim-cards" data-qa-geometry-group="xlsform/prueba-preguntas" data-qa-geometry-contract="intrinsic">
              {currentPage.nodes.map((node) => (
                <QuestionSlot
                  key={node.rowIndex}
                  node={node}
                  state={nodeState.get(node.rowIndex) ?? ALWAYS_VISIBLE}
                  value={answers[node.name]}
                  choicesByList={choicesByList}
                  onAnswer={setAnswer}
                  onEdit={handleEdit}
                  lector={lector}
                  error={restriccionIncumplida(node, answers[node.name], answers)}
                  marcarPendiente={intentoFinalizar && pendientesSet.has(node.rowIndex)}
                />
              ))}
            </div>

            {intentoFinalizar && esUltima && pendientes.length > 0 ? (
              <FaltantesPrueba pendientes={pendientes} lector={lector} onIr={irAPendiente} />
            ) : null}

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
              {esUltima ? (
                <button type="button" className="pulso-xfsim-pill is-primary" onClick={finalizar} data-accion="finalizar-prueba">
                  <Check size={14} /> Finalizar
                </button>
              ) : (
                <button
                  type="button"
                  className="pulso-xfsim-pill is-primary"
                  onClick={() => setPageIdx(Math.min(clampedIdx + 1, visiblePages.length - 1))}
                >
                  Siguiente <ChevronRight size={14} />
                </button>
              )}
            </footer>
          </div>
          )
        ) : (
          <div className="pulso-xfsim-empty">
            <strong>No hay preguntas para simular</strong>
            <span>Agrega preguntas en el constructor y vuelve a abrir esta vista.</span>
          </div>
        )}
        {currentPage ? <RespuestasPrueba respuestas={respondidas} onIrPregunta={irAPreguntaEnPrueba} /> : null}
      </div>
    </div>
  );
  return vista;
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
  lector,
  error,
  marcarPendiente,
}: {
  node: BuilderNode;
  state: VisState;
  value: SimValue | undefined;
  choicesByList: Map<string, ChoiceItem[]>;
  onAnswer: (name: string, value: SimValue) => void;
  onEdit?: (rowIndex: number) => void;
  lector: LectorReferencias;
  /** Mensaje de la regla que la respuesta incumple. */
  error: string | null;
  /** Al intentar finalizar: esta pregunta impide terminar. */
  marcarPendiente: boolean;
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
          className={`pulso-xfsim-card${node.kind === "note" ? " is-note" : ""}${marcarPendiente ? " is-pendiente" : ""}${error ? " is-error" : ""}`}
          data-pregunta-prueba={node.name}
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
              <TextoPregunta texto={node.label || node.name} lector={lector} />
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
                aria-label="Editar en Constructor"
                title="Editar en Constructor"
                data-accion="editar-en-constructor"
                tabIndex={visible ? 0 : -1}
                onClick={() => onEdit(node.rowIndex)}
              >
                <Pencil size={12} />
              </button>
            ) : null}
          </header>
          {pistaLegible(node) ? <TextoPregunta como="p" className="pulso-xfsim-hint" texto={pistaLegible(node)} lector={lector} /> : null}
          <QuestionControl
            node={node}
            value={value}
            disabled={!visible}
            choicesByList={choicesByList}
            onAnswer={onAnswer}
            lector={lector}
            invalido={Boolean(error) || marcarPendiente}
          />
          {error && visible ? (
            <p className="pulso-xfsim-error" role="alert"><TextoPregunta texto={error} lector={lector} /></p>
          ) : marcarPendiente && visible ? (
            <p className="pulso-xfsim-error">Falta esta respuesta para finalizar.</p>
          ) : null}
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
  lector,
  invalido,
}: {
  node: BuilderNode;
  value: SimValue | undefined;
  disabled: boolean;
  choicesByList: Map<string, ChoiceItem[]>;
  onAnswer: (name: string, value: SimValue) => void;
  lector: LectorReferencias;
  invalido: boolean;
}) {
  const base = node.typeInfo.base;
  const nombre = textoPreguntaPlano(node.label || node.name, lector);
  const ariaInvalid = invalido || undefined;

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

    // select_one con appearance minimal/dropdown/autocomplete → select nativo.
    const tokens = appearanceTokens(node);
    if (
      base === "select_one" &&
      (tokens.includes("minimal") || tokens.includes("dropdown") || tokens.includes("autocomplete"))
    ) {
      const current = typeof value === "string" ? value : "";
      return (
        <div className="pulso-xfsim-selectwrap">
          <select
            className="pulso-xfsim-input pulso-xfsim-select"
            value={current}
            disabled={disabled}
            aria-label={nombre}
            onChange={(event) => onAnswer(node.name, event.target.value)}
          >
            <option value="">Seleccionar…</option>
            {items.map((item) => (
              <option key={`${item.rowIndex}-${item.name}`} value={item.name}>
                {textoPreguntaPlano(item.label || item.name, lector)}
              </option>
            ))}
          </select>
          <span className="pulso-xfsim-select-chev" aria-hidden="true">
            <ChevronDown size={13} />
          </span>
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
        aria-label={nombre}
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
              <TextoPregunta className="pulso-xfsim-option-label" texto={item.label || item.name} lector={lector} />
            </button>
          );
        })}
      </div>
    );
  }

  if (base === "rank") {
    const items = choicesByList.get(node.typeInfo.listName) ?? [];
    if (!items.length) {
      return (
        <div className="pulso-xfsim-options-empty">
          Sin opciones en la lista <TechTerm t={node.typeInfo.listName || "choices"} />
        </div>
      );
    }
    // Valor XLSForm de rank: names en orden, separados por espacio.
    const order =
      typeof value === "string" && value.trim() !== "" ? value.trim().split(/\s+/) : [];
    return (
      <div className="pulso-xfsim-options" role="group" aria-label={nombre}>
        <span className="pulso-xfsim-rank-help">Toca en orden de prioridad · vuelve a tocar para quitar</span>
        {items.map((item) => {
          const position = order.indexOf(item.name);
          const isSelected = position >= 0;
          return (
            <button
              key={`${item.rowIndex}-${item.name}`}
              type="button"
              aria-pressed={isSelected}
              className={`pulso-xfsim-option${isSelected ? " is-selected" : ""}`}
              disabled={disabled}
              onClick={() => {
                const next = isSelected
                  ? order.filter((name) => name !== item.name)
                  : [...order, item.name];
                onAnswer(node.name, next.join(" "));
              }}
            >
              <span
                className={`pulso-xfsim-option-mark is-multi${isSelected ? " is-rank" : ""}`}
                aria-hidden="true"
              >
                {isSelected ? (
                  <span className="pulso-xfsim-rank-pos">{position + 1}</span>
                ) : (
                  <Check size={12} className="pulso-xfsim-option-check" />
                )}
              </span>
              <TextoPregunta className="pulso-xfsim-option-label" texto={item.label || item.name} lector={lector} />
            </button>
          );
        })}
      </div>
    );
  }

  if (base === "range") {
    const { start, end, step } = rangeParamsForNode(node);
    const current = typeof value === "string" && value !== "" ? value : "";
    const sliderValue = current === "" ? start : Number(current);
    return (
      <div className="pulso-xfsim-range">
        <input
          type="range"
          className="pulso-xfsim-range-input"
          min={start}
          max={end}
          step={step}
          value={Number.isFinite(sliderValue) ? sliderValue : start}
          disabled={disabled}
          aria-label={nombre}
          onChange={(event) => onAnswer(node.name, event.target.value)}
        />
        <output className={`pulso-xfsim-range-value${current === "" ? " is-empty" : ""}`}>
          {current === "" ? "—" : current}
        </output>
      </div>
    );
  }

  if (base === "barcode") {
    return (
      <div className="pulso-xfsim-barcode">
        <span className="pulso-xfsim-barcode-icon" aria-hidden="true">
          <QrCode size={14} />
        </span>
        <input
          className="pulso-xfsim-input pulso-xfsim-barcode-input"
          type="text"
          placeholder="Código escaneado o digitado"
          disabled={disabled}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onAnswer(node.name, event.target.value)}
        />
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
        aria-label={nombre}
        aria-invalid={ariaInvalid}
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
        aria-label={nombre}
        aria-invalid={ariaInvalid}
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
        aria-label={nombre}
        aria-invalid={ariaInvalid}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onAnswer(node.name, event.target.value)}
      />
    );
  }

  if (base === "acknowledge") {
    const isOn = value === "OK";
    return (
      <div className="pulso-xfsim-options" role="group" aria-label={nombre}>
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
