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
      <div style={emptyStyle}>
        <Layers3 size={18} />
        <div>
          <strong>El cuestionario todavía no tiene preguntas</strong>
          <p style={emptyTextStyle}>Agrega una sección o una pregunta para empezar a ver el recorrido completo.</p>
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

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={summaryGridStyle}>
        <SummaryTile icon={<ListChecks size={15} />} value={questionNodes.length} label="preguntas/textos" />
        <SummaryTile icon={<Layers3 size={15} />} value={Math.max(sections.length - 1, 0)} label="secciones" />
        <SummaryTile icon={<CheckCircle2 size={15} />} value={requiredCount} label="obligatorias" />
        <SummaryTile icon={<CircleDot size={15} />} value={conditionalCount} label="con saltos" />
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 }}>
          <div>
            <strong style={{ fontSize: 13 }}>Recorrido del cuestionario</strong>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--pulso-text-soft)" }}>
              Revisa el formulario como lo verá una persona encuestada. Haz click en cualquier pregunta para editarla.
            </p>
          </div>
          <div style={{ minWidth: 160 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--pulso-text-soft)", marginBottom: 4 }}>
              <span>Textos visibles</span>
              <strong>{labelPct}%</strong>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
              <div style={{ width: `${labelPct}%`, height: "100%", background: "var(--pulso-primary, #2563eb)" }} />
            </div>
          </div>
        </div>

        <div style={sectionGridStyle}>
          {sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              selection={selection}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
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
  const label = section.label || "Sección sin título";
  const range = questionRangeLabel(questions);

  return (
    <section style={sectionCardStyle}>
      <button
        type="button"
        onClick={() => {
          if (section.rowIndex != null) onSelect({ kind: "survey", rowIndex: section.rowIndex });
        }}
        disabled={section.rowIndex == null}
        style={sectionHeaderButtonStyle}
      >
        <span style={sectionIconStyle}>
          {section.kind === "repeat" ? <ListChecks size={15} /> : <FileText size={15} />}
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <strong style={sectionTitleStyle}>{label}</strong>
          <span style={sectionMetaStyle}>
            {questions.length} elemento{questions.length === 1 ? "" : "s"}
            {range ? ` · ${range}` : ""}
            {required ? ` · ${required} obligatoria${required === 1 ? "" : "s"}` : ""}
            {conditional ? ` · ${conditional} con salto${conditional === 1 ? "" : "s"}` : ""}
          </span>
        </span>
        {section.rowIndex != null ? <ChevronRight size={15} color="#9ca3af" /> : null}
      </button>

      {questions.length === 0 ? (
        <div style={emptySectionStyle}>
          <AlertCircle size={14} />
          Esta sección no tiene preguntas editables.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
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
  const label = node.label || node.name || `Pregunta ${position}`;
  const ref = displayQuestionRef(node.name) || String(position);

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        ...questionButtonStyle,
        borderColor: active ? "var(--pulso-primary, #2563eb)" : "var(--pulso-border, #e5e7eb)",
        background: active ? "var(--pulso-primary-soft, #eff6ff)" : "#fff",
      }}
    >
      <span style={questionNumberStyle}>{ref}</span>
      <span style={{ color: accent, display: "inline-flex", marginTop: 2 }}>
        <Icon size={14} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <strong style={questionLabelStyle}>{label}</strong>
        <span style={questionMetaStyle}>
          {node.kind === "note" ? "Texto informativo" : typeLabel(node.typeInfo.base)}
          {node.required ? " · obligatoria" : ""}
          {node.relevant ? " · con salto" : ""}
        </span>
      </span>
    </button>
  );
}

function SummaryTile({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div style={summaryTileStyle}>
      <span style={summaryIconStyle}>{icon}</span>
      <strong style={{ fontSize: 18, lineHeight: 1 }}>{value}</strong>
      <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>{label}</span>
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

const emptyStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: 14,
  border: "1px dashed var(--pulso-border, #cbd5e1)",
  borderRadius: 8,
  color: "var(--pulso-text-soft)",
};

const emptyTextStyle: CSSProperties = {
  margin: "3px 0 0",
  fontSize: 12,
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 8,
};

const summaryTileStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  border: "1px solid var(--pulso-border, #e5e7eb)",
  borderRadius: 8,
  background: "#fff",
};

const summaryIconStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 7,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--pulso-primary-soft, #eff6ff)",
  color: "var(--pulso-primary, #2563eb)",
  flexShrink: 0,
};

const sectionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 12,
};

const sectionCardStyle: CSSProperties = {
  border: "1px solid var(--pulso-border, #e5e7eb)",
  borderRadius: 8,
  padding: 12,
  background: "#fff",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const sectionHeaderButtonStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "flex-start",
  gap: 9,
  border: "none",
  background: "transparent",
  padding: 0,
  marginBottom: 9,
  textAlign: "left",
  cursor: "pointer",
};

const sectionIconStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#fff",
  color: "var(--pulso-primary, #2563eb)",
  border: "1px solid var(--pulso-border, #e5e7eb)",
  flexShrink: 0,
};

const sectionTitleStyle: CSSProperties = {
  display: "block",
  fontSize: 14,
  lineHeight: 1.3,
  color: "var(--pulso-text, #111827)",
  whiteSpace: "normal",
};

const sectionMetaStyle: CSSProperties = {
  display: "block",
  marginTop: 3,
  fontSize: 11,
  color: "var(--pulso-text-soft)",
};

const emptySectionStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  color: "var(--pulso-text-soft)",
  padding: "8px 4px",
};

const questionButtonStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  border: "1px solid var(--pulso-border, #e5e7eb)",
  borderRadius: 7,
  padding: "7px 8px",
  textAlign: "left",
  cursor: "pointer",
};

const questionNumberStyle: CSSProperties = {
  minWidth: 32,
  height: 20,
  padding: "0 6px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f3f4f6",
  color: "#6b7280",
  fontSize: 10,
  fontWeight: 700,
  flexShrink: 0,
};

const questionLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 12.5,
  lineHeight: 1.35,
  color: "var(--pulso-text, #111827)",
  whiteSpace: "normal",
};

const questionMetaStyle: CSSProperties = {
  display: "block",
  marginTop: 2,
  fontSize: 10.5,
  color: "var(--pulso-text-soft)",
};
