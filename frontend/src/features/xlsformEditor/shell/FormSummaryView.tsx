// =============================================================================
// shell/FormSummaryView.tsx — "Resumen del formulario": panorama ejecutivo
// =============================================================================
// Overlay full-screen 100% visual: KPIs con stagger de entrada, distribución
// por tipo de pregunta (barras CSS puras), mapa de secciones clickeable y
// badge de salud construido desde diagnostics + problemas estructurales.
// Click en sección/aviso → onSelectRow(rowIndex) y cierra.
// =============================================================================

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Asterisk,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Folder,
  GitBranch,
  Layers3,
  List,
  ListChecks,
  Repeat,
  X,
} from "lucide-react";
import type {
  BuilderDiagnostic,
  BuilderNode,
  BuilderStructure,
  SectionMeta,
  XlsformEditorWorkbook,
} from "../types";
import { buildCatalogs } from "../parsing/buildIndex";
import { typeLabel } from "../parsing/parseType";
import { iconForType } from "../helpers/icons";
import { paletteForType } from "../helpers/paletteForType";
import { TechTerm } from "../helpers/TechTerm";
import "../styles/xf-summary.css";

export type FormSummaryViewProps = {
  open: boolean;
  onClose: () => void;
  workbook: XlsformEditorWorkbook;
  structure: BuilderStructure | null;
  diagnostics: BuilderDiagnostic[];
  onSelectRow?: (rowIndex: number) => void;
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Nodos "de contenido": preguntan, informan o calculan (no estructura). */
function isContentNode(node: BuilderNode): boolean {
  return node.kind === "question" || node.kind === "note" || node.kind === "calculate";
}

function readFormTitle(workbook: XlsformEditorWorkbook): string {
  const idx = workbook.settings.columns.indexOf("form_title");
  if (idx < 0) return "";
  return (workbook.settings.rows[0]?.[idx] ?? "").trim();
}

type KpiCard = {
  key: string;
  icon: ReactNode;
  value: number | string;
  label: string;
  tech?: string;
};

type SectionRow = {
  meta: SectionMeta;
  count: number;
  firstRow: number | null;
  pct: number;
};

// -----------------------------------------------------------------------------
// Componente principal
// -----------------------------------------------------------------------------

export function FormSummaryView({
  open,
  onClose,
  workbook,
  structure,
  diagnostics,
  onSelectRow,
}: FormSummaryViewProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const formTitle = useMemo(() => readFormTitle(workbook), [workbook]);

  const stats = useMemo(() => {
    const outline = structure?.outline ?? [];
    const questionNodes = outline.filter((node) => node.kind === "question");
    const contentNodes = outline.filter(isContentNode);
    const catalogs = buildCatalogs(workbook.choices);
    const catalogSizes = new Map(
      catalogs.map((catalog) => [catalog.listName, catalog.items.length]),
    );

    // Heurística de duración: ~20s por pregunta simple, ~30s por select con
    // más de 6 opciones, +10s si es obligatoria.
    let seconds = 0;
    questionNodes.forEach((node) => {
      const base = node.typeInfo.base;
      const isSelect = base === "select_one" || base === "select_multiple";
      const optionCount = isSelect ? (catalogSizes.get(node.typeInfo.listName) ?? 0) : 0;
      seconds += isSelect && optionCount > 6 ? 30 : 20;
      if (node.required) seconds += 10;
    });

    const sections = Array.from(structure?.sections.values() ?? [])
      .filter((section) => section.kind !== "root")
      .sort((a, b) => (a.rowIndex ?? 0) - (b.rowIndex ?? 0));

    return {
      nQuestions: questionNodes.length,
      nSections: sections.length,
      nRequired: questionNodes.filter((node) => node.required).length,
      nLogic: contentNodes.filter((node) => node.relevant !== "").length,
      nCatalogs: catalogs.length,
      minutes: questionNodes.length ? Math.max(1, Math.round(seconds / 60)) : 0,
      contentNodes,
      sections,
    };
  }, [structure, workbook]);

  const typeRows = useMemo(() => {
    const counts = new Map<string, number>();
    stats.contentNodes.forEach((node) => {
      const base = node.typeInfo.base || "sin_tipo";
      counts.set(base, (counts.get(base) ?? 0) + 1);
    });
    const rows = Array.from(counts.entries()).map(([base, count]) => ({ base, count }));
    rows.sort((a, b) => b.count - a.count || a.base.localeCompare(b.base));
    const max = rows[0]?.count ?? 1;
    return rows.map((row) => ({
      ...row,
      pct: Math.max(8, Math.round((row.count / max) * 100)),
    }));
  }, [stats.contentNodes]);

  const sectionRows = useMemo<SectionRow[]>(() => {
    if (!structure) return [];
    const rows = stats.sections.map((meta) => {
      const items = structure.outline.filter(
        (node) => node.sectionId === meta.id && isContentNode(node),
      );
      return {
        meta,
        count: items.length,
        firstRow: items[0]?.rowIndex ?? meta.rowIndex,
      };
    });
    const max = Math.max(1, ...rows.map((row) => row.count));
    return rows.map((row) => ({
      ...row,
      pct: Math.max(6, Math.round((row.count / max) * 100)),
    }));
  }, [structure, stats.sections]);

  const structuralIssues =
    (structure?.unmatchedEndRows.length ?? 0) +
    (structure?.unclosedSectionIds.length ?? 0);
  const warnCount = diagnostics.filter((diag) => diag.level === "warn").length;
  const healthTone: "ok" | "warn" | "danger" =
    structuralIssues > 0 ? "danger" : warnCount > 0 ? "warn" : "ok";
  const healthLabel =
    healthTone === "danger"
      ? `${structuralIssues} error${structuralIssues === 1 ? "" : "es"} de estructura`
      : healthTone === "warn"
        ? `${warnCount} aviso${warnCount === 1 ? "" : "s"}`
        : "Sin avisos";
  const healthIcon =
    healthTone === "ok" ? (
      <CheckCircle2 size={13} />
    ) : healthTone === "warn" ? (
      <AlertTriangle size={13} />
    ) : (
      <AlertCircle size={13} />
    );

  const kpis: KpiCard[] = [
    { key: "preguntas", icon: <ListChecks size={15} />, value: stats.nQuestions, label: "Preguntas" },
    { key: "secciones", icon: <Layers3 size={15} />, value: stats.nSections, label: "Secciones" },
    { key: "obligatorias", icon: <Asterisk size={15} />, value: stats.nRequired, label: "Obligatorias", tech: "required" },
    { key: "logica", icon: <GitBranch size={15} />, value: stats.nLogic, label: "Con lógica", tech: "relevant" },
    { key: "listas", icon: <List size={15} />, value: stats.nCatalogs, label: "Listas de opciones", tech: "choices" },
    { key: "duracion", icon: <Clock3 size={15} />, value: stats.minutes ? `≈ ${stats.minutes} min` : "—", label: "Duración estimada" },
  ];

  const goToRow = (rowIndex: number | null | undefined) => {
    if (rowIndex == null || !onSelectRow) return;
    onSelectRow(rowIndex);
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div
      className="pulso-graph-overlay pulso-xfsum-overlay pulso-xf-overlay-enter"
      role="dialog"
      aria-modal="true"
      aria-label="Resumen del formulario"
    >
      <header className="pulso-graph-header">
        <div className="pulso-graph-header-left">
          <button type="button" className="pulso-graph-back" onClick={onClose}>
            <ChevronLeft size={14} /> Volver al editor
          </button>
          <div className="pulso-graph-header-title">
            <strong>Resumen del formulario</strong>
            <span>{formTitle || "Formulario sin título"}</span>
          </div>
        </div>
        <div className="pulso-graph-header-right">
          <button
            type="button"
            className="pulso-icon"
            onClick={onClose}
            aria-label="Cerrar resumen"
            title="Cerrar"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      <main className="pulso-xfsum-main">
        <section className="pulso-xfsum-kpis" aria-label="Indicadores del formulario">
          {kpis.map((kpi, index) => (
            <article
              key={kpi.key}
              className="pulso-xfsum-kpi"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <span className="pulso-xfsum-kpi-icon" aria-hidden="true">
                {kpi.icon}
              </span>
              <strong className="pulso-xfsum-kpi-value">{kpi.value}</strong>
              <span className="pulso-xfsum-kpi-label">
                {kpi.label}
                {kpi.tech ? (
                  <>
                    {" "}
                    <TechTerm t={kpi.tech} />
                  </>
                ) : null}
              </span>
            </article>
          ))}
        </section>

        <div className="pulso-xfsum-grid">
          <section className="pulso-xfsum-panel" aria-label="Tipos de pregunta">
            <h3 className="pulso-xfsum-panel-title">Tipos de pregunta</h3>
            <ul className="pulso-xfsum-types">
              {typeRows.map((row, index) => {
                const Icon = iconForType(row.base);
                const color = paletteForType(row.base);
                return (
                  <li
                    key={row.base}
                    className="pulso-xfsum-type-row"
                    style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                  >
                    <span
                      className="pulso-xfsum-type-icon"
                      style={{ color }}
                      aria-hidden="true"
                    >
                      <Icon size={13} />
                    </span>
                    <span className="pulso-xfsum-type-label">
                      {typeLabel(row.base)} <TechTerm t={row.base} />
                    </span>
                    <span className="pulso-xfsum-type-bar" aria-hidden="true">
                      <i
                        style={{
                          width: `${row.pct}%`,
                          background: color,
                          animationDelay: `${Math.min(index, 8) * 40 + 80}ms`,
                        }}
                      />
                    </span>
                    <span className="pulso-xfsum-type-count">{row.count}</span>
                  </li>
                );
              })}
              {typeRows.length === 0 ? (
                <li className="pulso-xfsum-empty-row">Aún no hay preguntas</li>
              ) : null}
            </ul>
          </section>

          <section className="pulso-xfsum-panel" aria-label="Mapa de secciones">
            <h3 className="pulso-xfsum-panel-title">Secciones</h3>
            <ul className="pulso-xfsum-sections">
              {sectionRows.map((row, index) => {
                const Icon = row.meta.kind === "repeat" ? Repeat : Folder;
                return (
                  <li
                    key={row.meta.id}
                    className="pulso-xfsum-section-item"
                    style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                  >
                    <button
                      type="button"
                      className="pulso-xfsum-section-row"
                      disabled={!onSelectRow || row.firstRow == null}
                      onClick={() => goToRow(row.firstRow)}
                      style={{ paddingLeft: `${12 + Math.min(row.meta.depth, 4) * 14}px` }}
                    >
                      <span className="pulso-xfsum-section-icon" aria-hidden="true">
                        <Icon size={13} />
                      </span>
                      <span className="pulso-xfsum-section-label">
                        {row.meta.label || row.meta.name || "Sección"}
                      </span>
                      <span className="pulso-xfsum-section-bar" aria-hidden="true">
                        <i
                          style={{
                            width: `${row.pct}%`,
                            animationDelay: `${Math.min(index, 8) * 40 + 80}ms`,
                          }}
                        />
                      </span>
                      <span className="pulso-xfsum-section-count">
                        {row.count} pregunta{row.count === 1 ? "" : "s"}
                      </span>
                    </button>
                  </li>
                );
              })}
              {sectionRows.length === 0 ? (
                <li className="pulso-xfsum-empty-row">Sin secciones todavía</li>
              ) : null}
            </ul>
          </section>
        </div>

        <section className="pulso-xfsum-panel" aria-label="Salud del formulario">
          <header className="pulso-xfsum-health-head">
            <h3 className="pulso-xfsum-panel-title">Salud del formulario</h3>
            <span className={`pulso-xfsum-health is-${healthTone}`}>
              {healthIcon}
              {healthLabel}
            </span>
          </header>
          {diagnostics.length > 0 ? (
            <ul className="pulso-xfsum-diags">
              {diagnostics.map((diag, index) => (
                <li
                  key={diag.id}
                  className="pulso-xfsum-diag-item"
                  style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
                >
                  <button
                    type="button"
                    className={`pulso-xfsum-diag is-${diag.level}`}
                    disabled={diag.rowIndex == null || !onSelectRow}
                    onClick={() => goToRow(diag.rowIndex)}
                  >
                    <i className="pulso-xfsum-diag-dot" aria-hidden="true" />
                    <strong>{diag.title}</strong>
                    <span>{diag.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </main>
    </div>,
    document.body,
  );
}
