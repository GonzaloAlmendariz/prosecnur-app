import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  FileText,
  Layers3,
  ListChecks,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { BuilderNode, BuilderSelection, BuilderStructure } from "../types";
import { iconForType } from "../helpers/icons";
import { stripMarkdown } from "../helpers/markdown";
import { paletteForType } from "../helpers/paletteForType";
import { typeLabel } from "../parsing/parseType";

type SectionView = {
  id: string;
  rowIndex: number | null;
  label: string;
  name: string;
  depth: number;
  kind: "root" | "section" | "repeat";
  nodes: BuilderNode[];
};

export function QuestionnaireProgressPanel({
  structure,
  selection,
  onSelect,
}: {
  structure: BuilderStructure | null;
  selection: BuilderSelection | null;
  onSelect: (value: BuilderSelection) => void;
}) {
  if (!structure || structure.outline.length === 0) {
    return (
      <div className="pulso-questionnaire-empty">
        <span className="pulso-questionnaire-empty-icon" aria-hidden="true">
          <Layers3 size={18} />
        </span>
        <div>
          <strong>El cuestionario todavía no tiene preguntas</strong>
          <p>Agrega una sección o una pregunta para empezar a ver el recorrido completo.</p>
        </div>
      </div>
    );
  }

  const sections = buildSectionViews(structure);
  const questionNodes = structure.outline.filter((node) => isQuestionLike(node));
  const requiredCount = questionNodes.filter((node) => node.required).length;
  const conditionalCount = questionNodes.filter((node) => node.relevant).length;
  const labelledCount = questionNodes.filter((node) => Boolean(node.label?.trim())).length;
  const labelPct = questionNodes.length ? Math.round((labelledCount / questionNodes.length) * 100) : 0;
  const answerableCount = questionNodes.filter((node) => node.kind === "question").length;
  const supportCount = questionNodes.length - answerableCount;
  const realSectionCount = Math.max(sections.length - (sections.some((section) => section.kind === "root") ? 1 : 0), 0);

  return (
    <div className="pulso-questionnaire-panel">
      <section className="pulso-questionnaire-overview" aria-label="Resumen del cuestionario">
        <div className="pulso-questionnaire-overview-copy">
          <span className="pulso-section-eyebrow">Recorrido completo</span>
          <strong>Lee el formulario como lo verá la persona encuestada.</strong>
          <p>
            Las secciones agrupan el flujo real; cada fila conserva sus reglas y
            saltos para que puedas entrar a editar justo donde está el problema.
          </p>
        </div>
        <div className="pulso-questionnaire-quality" aria-label={`Textos visibles ${labelPct}%`}>
          <strong>{labelPct}%</strong>
          <span>textos visibles</span>
          <div className="pulso-questionnaire-quality-bar" aria-hidden="true">
            <i style={{ width: `${labelPct}%` }} />
          </div>
        </div>
      </section>

      <div className="pulso-questionnaire-summary-grid">
        <SummaryTile icon={<ListChecks size={15} />} value={questionNodes.length} label="preguntas/textos" />
        <SummaryTile icon={<Layers3 size={15} />} value={realSectionCount} label="secciones" />
        <SummaryTile icon={<CheckCircle2 size={15} />} value={requiredCount} label="obligatorias" />
        <SummaryTile icon={<CircleDot size={15} />} value={conditionalCount} label="con saltos" />
      </div>

      <section className="pulso-questionnaire-map" aria-label="Recorrido por secciones">
        <header className="pulso-questionnaire-map-header">
          <div>
            <strong>Recorrido del cuestionario</strong>
            <p>Haz click en cualquier pieza para volver al editor en ese punto.</p>
          </div>
          <div className="pulso-questionnaire-map-counts">
            <span>{answerableCount} capturas</span>
            <span>{supportCount} apoyos</span>
          </div>
        </header>

        <div className="pulso-questionnaire-section-grid">
          {sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              selection={selection}
              onSelect={onSelect}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function buildSectionViews(structure: BuilderStructure): SectionView[] {
  const metas = Array.from(structure.sections.values());
  const realSections = metas
    .filter((meta) => meta.kind !== "root")
    .sort((a, b) => (a.rowIndex ?? 0) - (b.rowIndex ?? 0));

  const rootNodes = structure.outline.filter(
    (node) => node.sectionId === "root" && node.kind !== "section" && node.kind !== "repeat",
  );

  const views: SectionView[] = [];
  if (rootNodes.length) {
    views.push({
      id: "root",
      rowIndex: null,
      label: "Inicio del formulario",
      name: "root",
      depth: 0,
      kind: "root",
      nodes: rootNodes,
    });
  }

  realSections.forEach((meta) => {
    const nodes = nodesInsideSection(structure, meta.rowIndex, meta.endRowIndex);
    views.push({
      id: meta.id,
      rowIndex: meta.rowIndex,
      label: meta.label || meta.name || "Sección sin título",
      name: meta.name,
      depth: meta.depth,
      kind: meta.kind,
      nodes,
    });
  });

  if (!views.length) {
    views.push({
      id: "root",
      rowIndex: null,
      label: "Formulario principal",
      name: "root",
      depth: 0,
      kind: "root",
      nodes: structure.outline.filter(isQuestionLike),
    });
  }

  return views;
}

function nodesInsideSection(
  structure: BuilderStructure,
  startRow: number | null,
  endRow: number | null,
): BuilderNode[] {
  if (startRow == null) return [];
  const end = endRow ?? Number.POSITIVE_INFINITY;
  return structure.outline.filter((node) => (
    node.rowIndex > startRow &&
    node.rowIndex < end &&
    node.kind !== "section" &&
    node.kind !== "repeat"
  ));
}

function SectionCard({
  section,
  selection,
  onSelect,
}: {
  section: SectionView;
  selection: BuilderSelection | null;
  onSelect: (value: BuilderSelection) => void;
}) {
  const questions = section.nodes.filter(isQuestionLike);
  const required = questions.filter((node) => node.required).length;
  const conditional = questions.filter((node) => node.relevant).length;
  const label = stripMarkdown(section.label) || "Sección sin título";
  const range = questionRangeLabel(questions);
  const kindLabel = section.kind === "repeat" ? "Repetición" : section.kind === "root" ? "Inicio" : "Sección";

  return (
    <section className={`pulso-questionnaire-section is-${section.kind}`}>
      <button
        type="button"
        onClick={() => {
          if (section.rowIndex != null) onSelect({ kind: "survey", rowIndex: section.rowIndex });
        }}
        disabled={section.rowIndex == null}
        className="pulso-questionnaire-section-head"
      >
        <span className="pulso-questionnaire-section-icon">
          {section.kind === "repeat" ? <ListChecks size={15} /> : <FileText size={15} />}
        </span>
        <span className="pulso-questionnaire-section-copy">
          <strong>{label}</strong>
          <span>
            {kindLabel}
            {range ? ` · ${range}` : ""}
            {section.name ? ` · ${section.name}` : ""}
          </span>
        </span>
        {section.rowIndex != null ? <ChevronRight size={15} color="#9ca3af" /> : null}
      </button>

      <div className="pulso-questionnaire-section-badges" aria-label="Estado de la sección">
        <span>{questions.length} elemento{questions.length === 1 ? "" : "s"}</span>
        {required ? <span>{required} obligatoria{required === 1 ? "" : "s"}</span> : null}
        {conditional ? <span className="is-conditional">{conditional} con salto{conditional === 1 ? "" : "s"}</span> : null}
      </div>

      {questions.length === 0 ? (
        <div className="pulso-questionnaire-section-empty">
          <AlertCircle size={14} />
          Esta sección no tiene preguntas editables.
        </div>
      ) : (
        <div className="pulso-questionnaire-question-list">
          {questions.map((node, index) => (
            <QuestionRow
              key={node.rowIndex}
              node={node}
              position={index + 1}
              active={selection?.kind === "survey" && selection.rowIndex === node.rowIndex}
              onSelect={() => onSelect({ kind: "survey", rowIndex: node.rowIndex })}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function QuestionRow({
  node,
  position,
  active,
  onSelect,
}: {
  node: BuilderNode;
  position: number;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = iconForType(node.typeInfo.base);
  const accent = paletteForType(node.typeInfo.base);
  const label = stripMarkdown(node.label) || node.name || `Pregunta ${position}`;
  const ref = displayQuestionRef(node.name) || String(position);
  const rowStyle = { "--question-accent": accent } as CSSProperties;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`pulso-questionnaire-question${active ? " is-active" : ""}${node.relevant ? " is-conditional" : ""}`}
      style={rowStyle}
    >
      <span className="pulso-questionnaire-question-ref">{ref}</span>
      <span className="pulso-questionnaire-question-icon" aria-hidden="true">
        <Icon size={14} />
      </span>
      <span className="pulso-questionnaire-question-copy">
        <strong>{label}</strong>
        <span>
          {node.kind === "note" ? "Nota informativa" : typeLabel(node.typeInfo.base)}
        </span>
      </span>
      <span className="pulso-questionnaire-question-flags" aria-label="Estados">
        {node.required ? <em>Obligatoria</em> : null}
        {node.relevant ? <em>Salto</em> : null}
      </span>
    </button>
  );
}

function SummaryTile({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="pulso-questionnaire-summary-tile">
      <span className="pulso-questionnaire-summary-icon">{icon}</span>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function isQuestionLike(node: BuilderNode): boolean {
  return node.kind === "question" || node.kind === "note" || node.kind === "calculate";
}

function questionRangeLabel(nodes: BuilderNode[]): string {
  const refs = nodes.map((node) => displayQuestionRef(node.name)).filter(Boolean);
  if (!refs.length) return "";
  if (refs.length === 1) return refs[0]!;
  return `${refs[0]}-${refs[refs.length - 1]}`;
}

function displayQuestionRef(name: string): string {
  const match = /^([pq])0*(\d+)$/i.exec(name.trim());
  if (!match) return "";
  return `${match[1]!.toUpperCase()}${Number(match[2])}`;
}
