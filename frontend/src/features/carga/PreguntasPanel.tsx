import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Eye,
  Filter,
  GitBranch,
  ListChecks,
  Network,
  Search,
  ShieldCheck,
  Sigma,
} from "lucide-react";
import { Pregunta, Seccion } from "../../api/client";
import ContextLens from "../validacion/components/ContextLens";
import { PreviewQuestionCard } from "../xlsformEditor/canvas/PreviewQuestionCard";
import { LogicCanvas } from "../xlsformEditor/canvas-graph/LogicCanvas";
import { iconForType } from "../xlsformEditor/helpers/icons";
import { paletteForType } from "../xlsformEditor/helpers/paletteForType";
import { typeLabel } from "../xlsformEditor/parsing/parseType";
import type { BuilderNode, BuilderStructure, CatalogSummary, ChoiceItem, SectionMeta } from "../xlsformEditor/types";

type Filtros = {
  seccion: string;
  regla: "any" | "required" | "relevant" | "constraint" | "calculate" | "choice_filter";
  busqueda: string;
};

const RULE_COLORS: Record<string, { bg: string; fg: string; border: string; label: string; nombre: string }> = {
  required: { bg: "var(--pulso-danger-bg)", fg: "var(--pulso-danger-fg)", border: "var(--pulso-danger-border)", label: "R", nombre: "Obligatoria" },
  relevant: { bg: "var(--pulso-info-bg)", fg: "var(--pulso-info-fg)", border: "var(--pulso-info-border)", label: "V", nombre: "Visible si" },
  constraint: { bg: "var(--pulso-warn-bg)", fg: "var(--pulso-warn-fg)", border: "var(--pulso-warn-border)", label: "C", nombre: "Restricción" },
  calculate: { bg: "var(--pulso-success-bg)", fg: "var(--pulso-success-fg)", border: "var(--pulso-success-border)", label: "=", nombre: "Calculada" },
  choice_filter: { bg: "var(--pulso-primary-soft)", fg: "var(--pulso-primary)", border: "var(--pulso-primary-border)", label: "F", nombre: "Filtro de opciones" },
};

function sectionColor(sectionName: string): string {
  let h = 0;
  for (let i = 0; i < sectionName.length; i++) h = (h * 31 + sectionName.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 42%, 95%)`;
}

function Chip({ k }: { k: keyof typeof RULE_COLORS }) {
  const c = RULE_COLORS[k];
  return (
    <span className="pulso-question-map-chip" title={c.nombre} style={{ background: c.bg, color: c.fg, borderColor: c.border }}>
      {c.label}
    </span>
  );
}

export default function PreguntasPanel({ preguntas, secciones }: { preguntas: Pregunta[]; secciones: Seccion[] }) {
  const [f, setF] = useState<Filtros>({ seccion: "", regla: "any", busqueda: "" });
  const [focus, setFocus] = useState<Pregunta | null>(null);
  const [logicOpen, setLogicOpen] = useState(false);

  const seccionLabel = useMemo(() => Object.fromEntries(secciones.map((s) => [s.name, s.label])), [secciones]);
  const logicInputs = useMemo(() => buildReadOnlyLogicInputs(preguntas, secciones), [preguntas, secciones]);

  const filtered = useMemo(() => {
    const q = f.busqueda.trim().toLowerCase();
    return preguntas.filter((p) => {
      if (f.seccion && p.seccion !== f.seccion) return false;
      if (f.regla !== "any" && !Boolean(p[f.regla])) return false;
      if (q && !(p.name.toLowerCase().includes(q) || p.label.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [f, preguntas]);

  const bySection = useMemo(() => {
    const out: Record<string, Pregunta[]> = {};
    for (const p of filtered) (out[p.seccion] ||= []).push(p);
    return out;
  }, [filtered]);

  return (
    <div className="pulso-question-map">
      <div className="pulso-question-map-legend">
        <span className="pulso-question-map-legend-title">Leyenda</span>
        {(Object.keys(RULE_COLORS) as (keyof typeof RULE_COLORS)[]).map((k) => (
          <span key={k} className="pulso-question-map-legend-item">
            <Chip k={k} /> {RULE_COLORS[k].nombre}
          </span>
        ))}
      </div>

      <div className="pulso-question-map-toolbar">
        <select value={f.seccion} onChange={(e) => setF({ ...f, seccion: e.target.value })}>
          <option value="">Todas las secciones</option>
          {secciones.map((s) => <option key={s.name} value={s.name}>{s.label}</option>)}
        </select>
        <select value={f.regla} onChange={(e) => setF({ ...f, regla: e.target.value as Filtros["regla"] })}>
          <option value="any">Cualquier regla</option>
          <option value="required">Solo obligatorias</option>
          <option value="relevant">Solo con relevant</option>
          <option value="constraint">Solo con constraint</option>
          <option value="calculate">Solo calculadas</option>
          <option value="choice_filter">Solo con choice_filter</option>
        </select>
        <label className="pulso-question-map-search">
          <Search size={13} />
          <input
            value={f.busqueda}
            onChange={(e) => setF({ ...f, busqueda: e.target.value })}
            placeholder="Buscar por nombre o etiqueta..."
          />
        </label>
        <span className="pulso-question-map-count">{filtered.length}/{preguntas.length}</span>
        <button type="button" className="pulso-question-map-logic-button" onClick={() => setLogicOpen(true)}>
          <Network size={13} />
          Mapa de lógica
        </button>
      </div>

      {Object.entries(bySection).map(([sec, items]) => (
        <details key={sec} open className="pulso-question-map-section">
          <summary style={{ background: sectionColor(sec) }}>
            <strong>{seccionLabel[sec] || sec || "Sin sección"}</strong>
            <span>{items.length} {items.length === 1 ? "pregunta" : "preguntas"}</span>
          </summary>
          <div className="pulso-question-map-grid">
            {items.map((p) => (
              <QuestionTile
                key={p.name}
                pregunta={p}
                selected={focus?.name === p.name}
                onClick={() => setFocus(p)}
              />
            ))}
          </div>
        </details>
      ))}

      <QuestionDetailPopup
        pregunta={focus}
        seccionLabel={seccionLabel}
        onOpenLogicMap={() => setLogicOpen(true)}
        onClose={() => setFocus(null)}
      />
      <LogicCanvas
        open={logicOpen}
        onClose={() => setLogicOpen(false)}
        structure={logicInputs.structure}
        catalogs={logicInputs.catalogs}
        readOnly
        title="Mapa de lógica del instrumento"
        backLabel="Volver al mapa de preguntas"
      />
    </div>
  );
}

function QuestionTile({ pregunta, selected, onClick }: { pregunta: Pregunta; selected: boolean; onClick: () => void }) {
  const accent = paletteForType(pregunta.tipo);
  const Icon = iconForType(pregunta.tipo);
  return (
    <button
      type="button"
      className={`pulso-question-map-tile${selected ? " is-selected" : ""}`}
      onClick={onClick}
      title={pregunta.label}
      style={{ background: sectionColor(pregunta.seccion), "--question-accent": accent } as CSSProperties}
    >
      <span className="pulso-question-map-tile-type"><Icon size={11} /> {typeLabel(pregunta.tipo)}</span>
      <code>{pregunta.name}</code>
      <span>{pregunta.label}</span>
      <span className="pulso-question-map-tile-chips">
        {pregunta.required && <Chip k="required" />}
        {pregunta.relevant && <Chip k="relevant" />}
        {pregunta.constraint && <Chip k="constraint" />}
        {pregunta.calculate && <Chip k="calculate" />}
        {pregunta.choice_filter && <Chip k="choice_filter" />}
      </span>
    </button>
  );
}

function QuestionDetailPopup({
  pregunta,
  seccionLabel,
  onOpenLogicMap,
  onClose,
}: {
  pregunta: Pregunta | null;
  seccionLabel: Record<string, string>;
  onOpenLogicMap: () => void;
  onClose: () => void;
}) {
  return (
    <ContextLens
      open={!!pregunta}
      onClose={onClose}
      placement="center"
      variant="wide"
      title={pregunta?.label || "Detalle de pregunta"}
      subtitle={pregunta ? `${pregunta.name} · ${seccionLabel[pregunta.seccion] || pregunta.seccion || "Sin sección"}` : undefined}
    >
      {pregunta && (
        <div className="pulso-question-detail">
          <PreviewQuestionCard
            node={toBuilderNode(pregunta)}
            choices={toChoiceItems(pregunta)}
            position={pregunta.row_index}
          />

          <section className="pulso-question-detail-panel">
            <PanelTitle icon={<ListChecks size={14} />} title="Catálogo de opciones" />
            {pregunta.choices?.length ? (
              <ul className="pulso-question-detail-choice-table">
                {pregunta.choices.map((choice) => (
                  <li key={`${choice.name}-${choice.label}`}>
                    <code>{choice.name}</code>
                    <span>{choice.label || choice.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyReadout text="Esta pregunta no usa una lista de opciones." />
            )}
          </section>

          <section className="pulso-canvas-logic pulso-question-detail-panel">
            <div className="pulso-canvas-logic-header">
              <PanelTitle icon={<GitBranch size={14} />} title="Condiciones y lógica" />
              <span className="pulso-canvas-logic-hint">Solo lectura</span>
            </div>
            <div className="pulso-canvas-logic-grid">
              <LogicReadout icon={<Eye size={14} />} label="Aparece si" value={pregunta.relevant_expr} />
              <LogicReadout icon={<ShieldCheck size={14} />} label="Debe cumplir" value={pregunta.constraint_expr} />
              <LogicReadout icon={<Sigma size={14} />} label="Se calcula con" value={pregunta.calculation_expr} />
              <LogicReadout icon={<Filter size={14} />} label="Filtra opciones con" value={pregunta.choice_filter_expr} />
            </div>
          </section>

          <section className="pulso-question-detail-panel">
            <PanelTitle icon={<Network size={14} />} title="Mapa de lógica del instrumento" />
            <button type="button" className="pulso-question-detail-map-button" onClick={onOpenLogicMap}>
              <Network size={14} />
              Abrir el mismo mapa de lógica del editor
            </button>
          </section>
        </div>
      )}
    </ContextLens>
  );
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="pulso-question-detail-title">
      <span>{icon}</span>
      <strong>{title}</strong>
    </div>
  );
}

function LogicReadout({ icon, label, value }: { icon: ReactNode; label: string; value?: string | null }) {
  return (
    <div className="pulso-canvas-logic-item">
      <span className="pulso-canvas-logic-icon">{icon}</span>
      <div className="pulso-question-detail-logic-text">
        <strong>{label}</strong>
        {value && value.trim() ? <code>{value}</code> : <span>Sin condición declarada.</span>}
      </div>
    </div>
  );
}

function EmptyReadout({ text }: { text: string }) {
  return <div className="pulso-question-detail-empty">{text}</div>;
}

function toChoiceItems(pregunta: Pregunta): ChoiceItem[] {
  return (pregunta.choices ?? []).map((choice, rowIndex) => ({
    rowIndex,
    name: choice.name,
    label: choice.label,
  }));
}

function buildReadOnlyLogicInputs(
  preguntas: Pregunta[],
  secciones: Seccion[],
): { structure: BuilderStructure; catalogs: CatalogSummary[] } {
  const outline: BuilderNode[] = [];
  const byRow = new Map<number, BuilderNode>();
  const rowToSectionId = new Map<number, string>();
  const sections = new Map<string, SectionMeta>();
  const spans = new Map<number, { start: number; end: number }>();
  const unmatchedEndRows: number[] = [];
  const unclosedSectionIds: string[] = [];
  const sectionRows = new Map<string, number>();

  sections.set("root", {
    id: "root",
    rowIndex: null,
    endRowIndex: null,
    depth: 0,
    kind: "root",
    label: "Formulario principal",
    name: "root",
    parentId: null,
    itemCount: 0,
  });

  secciones.forEach((sec, idx) => {
    const rowIndex = -idx - 1;
    const id = `section-${rowIndex}`;
    sectionRows.set(sec.name, rowIndex);
    const node: BuilderNode = {
      rowIndex,
      depth: 0,
      kind: sec.is_repeat ? "repeat" : "section",
      label: sec.label || sec.name,
      name: sec.name,
      sectionId: "root",
      typeInfo: {
        raw: sec.is_repeat ? "begin_repeat" : "begin_group",
        base: sec.is_repeat ? "begin_repeat" : "begin_group",
        listName: "",
      },
      required: false,
      relevant: sec.relevant ?? "",
      constraint: "",
      calculation: "",
      choiceFilter: "",
      hint: "",
      appearance: "",
    };
    outline.push(node);
    byRow.set(rowIndex, node);
    rowToSectionId.set(rowIndex, "root");
    sections.set(id, {
      id,
      rowIndex,
      endRowIndex: null,
      depth: 0,
      kind: sec.is_repeat ? "repeat" : "section",
      label: sec.label || sec.name,
      name: sec.name,
      parentId: "root",
      itemCount: preguntas.filter((p) => p.seccion === sec.name).length,
    });
    spans.set(rowIndex, { start: rowIndex, end: rowIndex });
  });

  preguntas.forEach((pregunta, idx) => {
    const rowIndex = pregunta.row_index ?? idx + 1;
    const sectionRow = sectionRows.get(pregunta.seccion);
    const sectionId = sectionRow == null ? "root" : `section-${sectionRow}`;
    const node = toBuilderNode(pregunta);
    node.rowIndex = rowIndex;
    node.sectionId = sectionId;
    outline.push(node);
    byRow.set(rowIndex, node);
    rowToSectionId.set(rowIndex, sectionId);
  });

  const catalogsByName = new Map<string, CatalogSummary>();
  for (const pregunta of preguntas) {
    if (!pregunta.list_name || !pregunta.choices?.length || catalogsByName.has(pregunta.list_name)) continue;
    catalogsByName.set(pregunta.list_name, {
      listName: pregunta.list_name,
      title: pregunta.list_name,
      items: toChoiceItems(pregunta),
    });
  }

  return {
    structure: {
      outline,
      byRow,
      sections,
      rowToSectionId,
      firstSelectableRow: outline.find((node) => node.kind === "question")?.rowIndex ?? null,
      spans,
      unmatchedEndRows,
      unclosedSectionIds,
    },
    catalogs: Array.from(catalogsByName.values()).sort((a, b) => a.listName.localeCompare(b.listName)),
  };
}

function toBuilderNode(pregunta: Pregunta): BuilderNode {
  return {
    rowIndex: (pregunta.row_index ?? 1) - 1,
    depth: 0,
    kind: pregunta.tipo === "calculate" ? "calculate" : pregunta.tipo === "note" ? "note" : "question",
    label: pregunta.label,
    name: pregunta.name,
    sectionId: pregunta.seccion || "root",
    typeInfo: {
      raw: pregunta.type_raw || pregunta.tipo,
      base: pregunta.tipo,
      listName: pregunta.list_name || "",
    },
    required: pregunta.required,
    relevant: pregunta.relevant_expr ?? "",
    constraint: pregunta.constraint_expr ?? "",
    calculation: pregunta.calculation_expr ?? "",
    choiceFilter: pregunta.choice_filter_expr ?? "",
    hint: pregunta.hint ?? "",
    appearance: pregunta.appearance ?? "",
  };
}
