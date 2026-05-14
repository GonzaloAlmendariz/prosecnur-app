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

type ItemStats = {
  questions: number;
  calculations: number;
  notes: number;
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
  const allStats = useMemo(() => summarizeItems(preguntas), [preguntas]);

  const filtered = useMemo(() => {
    const q = f.busqueda.trim().toLowerCase();
    return preguntas.filter((p) => {
      if (f.seccion && p.seccion !== f.seccion) return false;
      if (f.regla !== "any" && !Boolean(p[f.regla])) return false;
      if (q && !(
        p.name.toLowerCase().includes(q) ||
        p.label.toLowerCase().includes(q) ||
        (p.calculation_expr ?? "").toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [f, preguntas]);

  const bySection = useMemo(() => {
    const out: Record<string, Pregunta[]> = {};
    for (const p of filtered) (out[p.seccion] ||= []).push(p);
    return out;
  }, [filtered]);
  const filteredStats = useMemo(() => summarizeItems(filtered), [filtered]);

  return (
    <div className="pulso-question-map">
      <div className="pulso-question-map-kind-summary" aria-label="Resumen del instrumento">
        <span><strong>{allStats.questions}</strong> preguntas</span>
        <span><strong>{allStats.calculations}</strong> cálculos</span>
      </div>

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
          <option value="any">Todos los ítems</option>
          <option value="required">Solo obligatorias</option>
          <option value="relevant">Solo con relevant</option>
          <option value="constraint">Solo con constraint</option>
          <option value="calculate">Solo variables calculadas</option>
          <option value="choice_filter">Solo con choice_filter</option>
        </select>
        <label className="pulso-question-map-search">
          <Search size={13} />
          <input
            value={f.busqueda}
            onChange={(e) => setF({ ...f, busqueda: e.target.value })}
            placeholder="Buscar por nombre, etiqueta o fórmula..."
          />
        </label>
        <span className="pulso-question-map-count">
          {filtered.length}/{preguntas.length} ítems · {formatItemStats(filteredStats)}
        </span>
        <button type="button" className="pulso-question-map-logic-button" onClick={() => setLogicOpen(true)}>
          <Network size={13} />
          Mapa de lógica
        </button>
      </div>

      {Object.entries(bySection).map(([sec, items]) => (
        <details key={sec} open className="pulso-question-map-section">
          <summary style={{ background: sectionColor(sec) }}>
            <strong>{seccionLabel[sec] || sec || "Sin sección"}</strong>
            <span>{formatItemStats(summarizeItems(items))}</span>
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
        allPreguntas={preguntas}
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
        backLabel="Volver al mapa del instrumento"
      />
    </div>
  );
}

function QuestionTile({ pregunta, selected, onClick }: { pregunta: Pregunta; selected: boolean; onClick: () => void }) {
  const accent = paletteForType(pregunta.tipo);
  const Icon = iconForType(pregunta.tipo);
  const calculate = isCalculateQuestion(pregunta);
  const summary = calculate
    ? formatFormulaPreview(pregunta.calculation_expr) || pregunta.label
    : pregunta.label;
  return (
    <button
      type="button"
      className={`pulso-question-map-tile${selected ? " is-selected" : ""}${calculate ? " is-calculate" : ""}`}
      onClick={onClick}
      title={calculate ? `${pregunta.name}: ${pregunta.calculation_expr || pregunta.label}` : pregunta.label}
      style={{ background: sectionColor(pregunta.seccion), "--question-accent": accent } as CSSProperties}
    >
      <span className="pulso-question-map-tile-type">
        <Icon size={11} /> {calculate ? "Variable calculada" : typeLabel(pregunta.tipo)}
      </span>
      <code>{pregunta.name}</code>
      <span className={calculate ? "pulso-question-map-tile-formula" : undefined}>{summary}</span>
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
  allPreguntas,
  seccionLabel,
  onOpenLogicMap,
  onClose,
}: {
  pregunta: Pregunta | null;
  allPreguntas: Pregunta[];
  seccionLabel: Record<string, string>;
  onOpenLogicMap: () => void;
  onClose: () => void;
}) {
  const calculate = pregunta ? isCalculateQuestion(pregunta) : false;
  const logicRows = pregunta ? logicReadoutsForQuestion(pregunta, calculate) : [];
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

          {calculate ? (
            <CalculationDetailPanel pregunta={pregunta} allPreguntas={allPreguntas} />
          ) : (
            <ResponseDetailPanel pregunta={pregunta} />
          )}

          <section className="pulso-canvas-logic pulso-question-detail-panel">
            <div className="pulso-canvas-logic-header">
              <PanelTitle icon={<GitBranch size={14} />} title="Condiciones y lógica" />
              <span className="pulso-canvas-logic-hint">Solo lectura</span>
            </div>
            <div className="pulso-canvas-logic-grid">
              {logicRows.length ? (
                logicRows.map((row) => (
                  <LogicReadout
                    key={row.label}
                    icon={row.icon}
                    label={row.label}
                    value={row.value}
                    emptyText={row.emptyText}
                  />
                ))
              ) : (
                <EmptyReadout text={calculate ? "Sin lógica adicional declarada." : "Sin lógica declarada."} />
              )}
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

function ResponseDetailPanel({ pregunta }: { pregunta: Pregunta }) {
  const isChoice = isChoiceQuestion(pregunta);
  const choices = pregunta.choices ?? [];
  const codes = choices.map((choice) => choice.name).filter(Boolean);

  return (
    <section className="pulso-question-detail-panel pulso-question-detail-response">
      <PanelTitle icon={<ListChecks size={14} />} title="Campo de respuesta" />
      <div className="pulso-response-meta-list">
        <MetaRow label="Tipo" value={typeLabel(pregunta.tipo)} />
        {isChoice && pregunta.list_name && <MetaRow label="Catálogo" value={pregunta.list_name} mono />}
        {isChoice && <MetaRow label="Opciones" value={String(choices.length)} />}
        {isChoice && codes.length > 0 && <MetaRow label="Códigos" value={formatCodePreview(codes)} mono />}
        {pregunta.appearance && <MetaRow label="Apariencia" value={pregunta.appearance} />}
        {pregunta.required && <MetaRow label="Obligatoria" value="Sí" />}
      </div>
    </section>
  );
}

function MetaRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="pulso-response-meta-row">
      <span>{label}</span>
      {mono ? <code>{value}</code> : <strong>{value}</strong>}
    </div>
  );
}

function CalculationDetailPanel({ pregunta, allPreguntas }: { pregunta: Pregunta; allPreguntas: Pregunta[] }) {
  const formula = pregunta.calculation_expr?.trim() ?? "";
  const inputs = varsInExpression(formula);
  const usedBy = calculationConsumers(pregunta.name, allPreguntas);

  return (
    <section className="pulso-question-detail-panel pulso-question-detail-calc">
      <PanelTitle icon={<Sigma size={14} />} title="Variable calculada" />
      <div className="pulso-calc-formula-readout">
        <strong>Fórmula</strong>
        {formula ? <code>{formula}</code> : <span>Sin fórmula declarada.</span>}
      </div>
      <div className="pulso-calc-relations">
        <div>
          <strong>Usa variables</strong>
          {inputs.length ? (
            <div className="pulso-calc-chip-row">
              {inputs.map((name) => <FieldChip key={name} name={name} />)}
            </div>
          ) : (
            <span>Sin referencias a otras variables.</span>
          )}
        </div>
        <div>
          <strong>Usada por</strong>
          {usedBy.length ? (
            <div className="pulso-calc-chip-row">
              {usedBy.map((item) => (
                <FieldChip
                  key={`${item.name}-${item.kind}`}
                  name={item.name}
                  title={`${item.label || item.name} · ${item.kind}`}
                />
              ))}
            </div>
          ) : (
            <span>Ninguna regla posterior la referencia.</span>
          )}
        </div>
      </div>
    </section>
  );
}

function FieldChip({ name, title }: { name: string; title?: string }) {
  return <code className="pulso-calc-field-chip" title={title || name}>{name}</code>;
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="pulso-question-detail-title">
      <span>{icon}</span>
      <strong>{title}</strong>
    </div>
  );
}

function LogicReadout({
  icon,
  label,
  value,
  emptyText = "Sin condición declarada.",
}: {
  icon: ReactNode;
  label: string;
  value?: string | null;
  emptyText?: string;
}) {
  return (
    <div className="pulso-canvas-logic-item">
      <span className="pulso-canvas-logic-icon">{icon}</span>
      <div className="pulso-question-detail-logic-text">
        <strong>{label}</strong>
        {value && value.trim() ? <code>{value}</code> : <span>{emptyText}</span>}
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

function isCalculateQuestion(pregunta: Pregunta): boolean {
  return pregunta.tipo === "calculate" || pregunta.type_raw === "calculate";
}

function isChoiceQuestion(pregunta: Pregunta): boolean {
  return pregunta.tipo === "select_one" || pregunta.tipo === "select_multiple";
}

function summarizeItems(items: Pregunta[]): ItemStats {
  return items.reduce<ItemStats>((acc, item) => {
    if (isCalculateQuestion(item)) acc.calculations += 1;
    else if (item.tipo === "note" || item.type_raw === "note") acc.notes += 1;
    else acc.questions += 1;
    return acc;
  }, { questions: 0, calculations: 0, notes: 0 });
}

function formatItemStats(stats: ItemStats): string {
  const parts = [
    `${stats.questions} ${stats.questions === 1 ? "pregunta" : "preguntas"}`,
  ];
  if (stats.calculations > 0) {
    parts.push(`${stats.calculations} ${stats.calculations === 1 ? "cálculo" : "cálculos"}`);
  }
  if (stats.notes > 0) {
    parts.push(`${stats.notes} ${stats.notes === 1 ? "nota" : "notas"}`);
  }
  return parts.join(" · ");
}

function formatFormulaPreview(value?: string | null): string {
  const formula = value?.trim() ?? "";
  return formula ? `= ${formula}` : "";
}

function formatCodePreview(codes: string[]): string {
  const head = codes.slice(0, 10).join(", ");
  return codes.length > 10 ? `${head}, +${codes.length - 10}` : head;
}

function logicReadoutsForQuestion(
  pregunta: Pregunta,
  calculate: boolean,
): Array<{ icon: ReactNode; label: string; value?: string | null; emptyText?: string }> {
  const rows: Array<{ icon: ReactNode; label: string; value?: string | null; emptyText?: string }> = [];
  if (pregunta.relevant_expr?.trim()) {
    rows.push({ icon: <Eye size={14} />, label: "Aparece si", value: pregunta.relevant_expr });
  }
  if (pregunta.constraint_expr?.trim()) {
    rows.push({ icon: <ShieldCheck size={14} />, label: "Debe cumplir", value: pregunta.constraint_expr });
  }
  if (!calculate && pregunta.calculation_expr?.trim()) {
    rows.push({
      icon: <Sigma size={14} />,
      label: "Se calcula con",
      value: pregunta.calculation_expr,
      emptyText: "Sin cálculo declarado.",
    });
  }
  if (pregunta.choice_filter_expr?.trim()) {
    rows.push({ icon: <Filter size={14} />, label: "Filtra opciones con", value: pregunta.choice_filter_expr });
  }
  return rows;
}

function varsInExpression(value?: string | null): string[] {
  const expr = value ?? "";
  const found = new Set<string>();
  const re = /\$\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(expr))) {
    const name = match[1]?.trim();
    if (name) found.add(name);
  }
  return Array.from(found).sort((a, b) => a.localeCompare(b));
}

function calculationConsumers(
  variableName: string,
  preguntas: Pregunta[],
): Array<{ name: string; label: string; kind: string }> {
  const out: Array<{ name: string; label: string; kind: string }> = [];
  const sources: Array<{ key: keyof Pregunta; kind: string }> = [
    { key: "calculation_expr", kind: "cálculo" },
    { key: "relevant_expr", kind: "visibilidad" },
    { key: "constraint_expr", kind: "restricción" },
    { key: "choice_filter_expr", kind: "filtro" },
  ];

  for (const pregunta of preguntas) {
    if (pregunta.name === variableName) continue;
    for (const source of sources) {
      const value = pregunta[source.key];
      if (typeof value !== "string") continue;
      if (!varsInExpression(value).includes(variableName)) continue;
      out.push({ name: pregunta.name, label: pregunta.label, kind: source.kind });
      break;
    }
  }

  return out;
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
