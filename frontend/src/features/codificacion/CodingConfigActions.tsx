import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "../../components/toasterStore";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  ListChecks,
  Loader2,
  Network,
  Pencil,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Table2,
  Upload,
  X,
} from "lucide-react";
import {
  apiCodifImportJsonPreview,
  apiCodifMatricesApply,
  apiCodifMatricesCasePatch,
  apiCodifMatricesMap,
  apiCodifMatricesPreview,
  apiCodifPreguntasAbiertas,
  apiUpload,
  CodifConfigImportStrategy,
  CodifMatrixMap,
  CodifImportPreview,
  CodifImportPreviewItem,
  CodifImportSelection,
  PreguntaAbierta,
} from "../../api/client";
import { Alert } from "../../components/Alert";
import { EstadoVacio } from "../../components/EstadoVacio";
import { LoadingBlock } from "../../components/States";
import { useCodifSource } from "./useCodifSource";
import { formatoConteo } from "../../lib/formatoNumero";
import { ContenedorEntregable } from "../../components/entregables/ContenedorEntregable";
import { useEntregasMatrices } from "./entregas/useEntregasMatrices";

type Props = {
  disabled?: boolean;
  onImported?: () => void;
};

type MatrixVisibility = "work" | "internal" | "client";
type Busy = "preview" | "apply" | "map" | "case-patch" | null;
type MatrixCaseRow = {
  base: string;
  variable: string;
  variableLabel: string;
  variableKindLabel?: string;
  id_caso: string;
  respuesta: string;
  codigo: string;
  etiqueta: string;
  categoryRole?: string;
  categoryRoleLabel?: string;
  obs?: string;
};
type EditingMatrixCase = MatrixCaseRow & {
  nextCodigo: string;
  nextEtiqueta: string;
};
type MatrixMapVariable = CodifMatrixMap["bases"][number]["variables"][number];

export function CodingConfigActions({ disabled = false, onImported }: Props) {
  const [busy, setBusy] = useState<Busy>(null);
  // Matrices Excel y respaldo JSON (ADR 0133): el contenedor del kit anclado a la barra.
  const entregas = useEntregasMatrices();
  // El botón que pidió el archivo: el contenedor cuelga de su borde, no del de la barra.
  const ejeEntrega = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [map, setMap] = useState<CodifMatrixMap | null>(null);
  const [questions, setQuestions] = useState<PreguntaAbierta[]>([]);
  const [selectedVarsByBase, setSelectedVarsByBase] = useState<Record<string, Record<string, boolean>>>({});
  const [editingCase, setEditingCase] = useState<EditingMatrixCase | null>(null);
  const [focusedVariable, setFocusedVariable] = useState<string>("all");
  const [caseQuery, setCaseQuery] = useState("");
  const source = useCodifSource();

  const mapBases = map?.bases ?? [];
  const baseOptions = useMemo(() => {
    const names = source.options;
    return Array.from(new Set(names.map((name) => String(name ?? "").trim()).filter(Boolean)));
  }, [source.options]);
  const activeBase = source.active ?? source.options[0] ?? baseOptions[0] ?? "";
  const activeBaseKey = activeBase || "__active_base__";
  const matrixBaseLabel = (base: string | null | undefined) => compactMatrixBaseLabel(base, source.labelFor(base));
  const activeBaseLabel = matrixBaseLabel(activeBase);
  const selectedVars = selectedVarsByBase[activeBaseKey] ?? {};
  const questionLabelByVar = useMemo(() => {
    return new Map(questions.map((question) => [question.parent, question.parent_label || question.parent]));
  }, [questions]);
  const labelForVariable = (variable: string, label?: string) => {
    return compactMatrixVariableLabel(variable, label || questionLabelByVar.get(variable) || variable);
  };

  const activeMapBase = useMemo(() => {
    if (!mapBases.length) return null;
    return mapBases.find((base) => base.base === activeBase) ?? mapBases[0] ?? null;
  }, [activeBase, mapBases]);
  const activeMapVariables = activeMapBase?.variables ?? [];

  const textQuestions = useMemo(() => {
    return questions
      .filter((question) => question.tipo === "text" && question.habilitada !== false)
      .sort((a, b) => (a.q_order ?? 9999) - (b.q_order ?? 9999));
  }, [questions]);

  const selectedVariableNames = useMemo(() => {
    return textQuestions
      .filter((question) => selectedVars[question.parent] !== false)
      .map((question) => question.parent);
  }, [selectedVars, textQuestions]);

  const matrixStats = useMemo(() => {
    const variables = activeMapBase?.variables.length ?? 0;
    const categories = activeMapBase?.variables.reduce(
      (acc, variable) => acc + variable.categories.length,
      0
    ) ?? 0;
    const cases = textQuestions.reduce((acc, question) => acc + (question.n_respuestas ?? 0), 0);
    const mappedCases = activeMapBase?.variables.reduce(
      (baseAcc, variable) => baseAcc + (variable.n_casos ?? variable.categories.reduce((catAcc, category) => catAcc + category.n_casos, 0)),
      0
    ) ?? 0;
    const assignments = activeMapBase?.variables.reduce(
      (baseAcc, variable) => baseAcc + (variable.n_asignaciones ?? variable.categories.reduce((catAcc, category) => catAcc + (category.n_asignaciones ?? category.n_casos), 0)),
      0
    ) ?? 0;
    const observations = activeMapBase?.variables.reduce(
      (baseAcc, variable) => baseAcc + (variable.n_observaciones ?? variable.categories.reduce((catAcc, category) => catAcc + (category.n_observaciones ?? 0), 0)),
      0
    ) ?? 0;
    return { variables, categories, cases, mappedCases, assignments, observations };
  }, [activeMapBase, textQuestions]);

  const hasActiveMatrix = matrixStats.categories > 0;
  const exportVariableNames = useMemo(() => {
    if (hasActiveMatrix && activeMapBase?.variables.length) {
      return activeMapBase.variables.map((variable) => variable.variable);
    }
    return selectedVariableNames;
  }, [activeMapBase, hasActiveMatrix, selectedVariableNames]);

  const activeCaseRows = useMemo<MatrixCaseRow[]>(() => {
    if (!activeMapBase) return [];
    const rows: MatrixCaseRow[] = [];
    for (const variable of activeMapBase.variables) {
      const variableLabel = labelForVariable(variable.variable, variable.variable_label);
      for (const category of variable.categories) {
        for (const item of category.cases ?? []) {
          rows.push({
            base: activeMapBase.base,
            variable: variable.variable,
            variableLabel,
            variableKindLabel: variable.variable_kind_label,
            id_caso: item.id_caso,
            respuesta: item.respuesta,
            codigo: item.codigo || category.codigo,
            etiqueta: item.etiqueta || category.etiqueta,
            categoryRole: category.category_role,
            categoryRoleLabel: category.category_role_label,
            obs: item.obs,
          });
        }
      }
    }
    return rows;
  }, [activeMapBase, questionLabelByVar]);

  const focusedMapVariable = useMemo(() => {
    if (focusedVariable === "all") return null;
    return activeMapVariables.find((variable) => variable.variable === focusedVariable) ?? null;
  }, [activeMapVariables, focusedVariable]);

  const visibleMapVariables = useMemo(() => {
    if (focusedVariable === "all") return activeMapVariables;
    return activeMapVariables.filter((variable) => variable.variable === focusedVariable);
  }, [activeMapVariables, focusedVariable]);

  const visibleCaseRows = useMemo(() => {
    const query = normalizeMatrixSearch(caseQuery);
    return activeCaseRows.filter((row) => {
      if (focusedVariable !== "all" && row.variable !== focusedVariable) return false;
      if (!query) return true;
      return normalizeMatrixSearch([
        row.variableLabel,
        row.variableKindLabel ?? "",
        row.id_caso,
        row.respuesta,
        row.codigo,
        row.etiqueta,
        row.categoryRoleLabel ?? "",
        row.obs ?? "",
      ].join(" ")).includes(query);
    });
  }, [activeCaseRows, caseQuery, focusedVariable]);

  const focusedCaseCount = focusedMapVariable
    ? matrixVariableCases(focusedMapVariable)
    : matrixStats.mappedCases;
  const focusedAssignmentCount = focusedMapVariable
    ? matrixVariableAssignments(focusedMapVariable)
    : matrixStats.assignments;
  const focusedLabel = focusedMapVariable
    ? labelForVariable(focusedMapVariable.variable, focusedMapVariable.variable_label)
    : "Todas las variables";

  const editCategoryOptions = useMemo(() => {
    if (!activeMapBase || !editingCase) return [];
    return activeMapBase.variables.find((variable) => variable.variable === editingCase.variable)?.categories ?? [];
  }, [activeMapBase, editingCase]);

  useEffect(() => {
    if (!source.loading) void refreshMatrixContext();
  }, [activeBase, source.loading]);

  useEffect(() => {
    setFocusedVariable("all");
    setCaseQuery("");
    setEditingCase(null);
  }, [activeBase]);

  useEffect(() => {
    if (focusedVariable === "all") return;
    if (!activeMapVariables.some((variable) => variable.variable === focusedVariable)) {
      setFocusedVariable("all");
    }
  }, [activeMapVariables, focusedVariable]);

  async function refreshMatrixContext() {
    setBusy((current) => current ?? "map");
    setError("");
    try {
      const [nextMap, openQuestions] = await Promise.all([
        apiCodifMatricesMap(activeBase || undefined),
        apiCodifPreguntasAbiertas(activeBase || undefined),
      ]);
      setMap(nextMap);
      setQuestions(openQuestions.preguntas);
      setSelectedVarsByBase((prev) => {
        const current = prev[activeBaseKey] ?? {};
        const next = { ...current };
        for (const question of openQuestions.preguntas) {
          if (question.tipo === "text" && question.habilitada !== false && next[question.parent] === undefined) {
            next[question.parent] = true;
          }
        }
        return { ...prev, [activeBaseKey]: next };
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy((current) => (current === "map" ? null : current));
    }
  }

  function exportConfig(boton: HTMLElement) {
    ejeEntrega.current = boton;
    setError("");
    void entregas.respaldo();
  }

  function exportMatrix(visibility: MatrixVisibility, boton: HTMLElement) {
    ejeEntrega.current = boton;
    if (!activeBase) {
      setError("Selecciona una base para generar la matriz.");
      return;
    }
    setError("");
    void entregas.matriz(visibility, exportVariableNames, activeBase);
  }

  function updateSelectedVarsForActive(updater: (prev: Record<string, boolean>) => Record<string, boolean>) {
    setSelectedVarsByBase((prev) => ({
      ...prev,
      [activeBaseKey]: updater(prev[activeBaseKey] ?? {}),
    }));
  }

  function toggleAllVariables(next: boolean) {
    updateSelectedVarsForActive((prev) => {
      const out = { ...prev };
      for (const question of textQuestions) out[question.parent] = next;
      return out;
    });
  }

  function toggleVariable(parent: string, next: boolean) {
    updateSelectedVarsForActive((prev) => ({ ...prev, [parent]: next }));
  }

  function openCaseEditor(row: MatrixCaseRow) {
    setEditingCase({ ...row, nextCodigo: row.codigo, nextEtiqueta: row.etiqueta });
  }

  function updateEditingCode(code: string) {
    const hit = editCategoryOptions.find((category) => category.codigo === code);
    setEditingCase((current) => current
      ? { ...current, nextCodigo: code, nextEtiqueta: hit?.etiqueta ?? current.nextEtiqueta }
      : current);
  }

  async function saveCaseEdit() {
    if (!editingCase) return;
    setBusy("case-patch");
    setError("");
    try {
      const result = await apiCodifMatricesCasePatch({
        base: editingCase.base,
        variable: editingCase.variable,
        id_caso: editingCase.id_caso,
        from_codigo: editingCase.codigo,
        codigo: editingCase.nextCodigo,
        etiqueta: editingCase.nextEtiqueta,
      });
      setMap(result.map);
      setEditingCase(null);
      toast.exito(`Caso ${editingCase.id_caso} actualizado en ${activeBaseLabel}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const visibleError = error || source.error;

  const importDialog = dialogOpen ? (
    <CodingConfigImportDialog
      onClose={() => setDialogOpen(false)}
      onImported={() => {
        onImported?.();
        toast.exito("Matriz aplicada y registrada en el historial.");
      }}
    />
  ) : null;

  // La barra se deshabilita mientras corre cualquier trabajo suyo, incluida una matriz o el respaldo.
  const barraOcupada = busy !== null || entregas.enCurso;

  return (
    <div className="pulso-codificacion-matrix-workbench" aria-label="Matrices y mapeo de codificación">
      {!source.loading && !source.error && !error && map !== null && (
        <span data-audit-ready="codificacion-matrices" hidden />
      )}
      <section className="pulso-codificacion-matrix-hero">
        <span className="pulso-codificacion-matrix-hero-icon" aria-hidden="true">
          <Network size={18} />
        </span>
        <div className="pulso-codificacion-matrix-hero-copy">
          <span className="pulso-section-eyebrow">Mapeo por matriz</span>
          <h3>{hasActiveMatrix ? "Mapeo Excel activo" : "Crear matriz de textos abiertos"}</h3>
          <p>
            {hasActiveMatrix
              ? "Esta base tiene un mapa importado con texto original, código final, categoría y comentarios; se aplica en la pestaña Aplicar junto con los códigos asignados en Prosecnur."
              : "Selecciona variables de texto abierto para generar una matriz editable por ID caso; al importarla quedará lista para aplicarse en la pestaña Aplicar."}
          </p>
        </div>
        <div className="pulso-codificacion-matrix-hero-stats" aria-label="Resumen del mapa actual">
          {hasActiveMatrix ? (
            <>
              <MatrixStat label="Variables" value={matrixStats.variables} />
              <MatrixStat label="Casos" value={matrixStats.mappedCases} />
              <MatrixStat label="Asignaciones" value={matrixStats.assignments} />
              <MatrixStat label="Categorías" value={matrixStats.categories} />
              <MatrixStat label="Comentarios" value={matrixStats.observations} />
            </>
          ) : (
            <>
              <MatrixStat label="Variables" value={matrixStats.variables} />
              <MatrixStat label="Textos" value={textQuestions.length} />
              <MatrixStat label="Casos" value={matrixStats.cases} />
              <MatrixStat label="Categorías" value={matrixStats.categories} />
            </>
          )}
        </div>
      </section>

      <div className="pulso-codificacion-matrix-commandbar">
        <div className="pulso-codificacion-matrix-command-actions">
          <button
            type="button"
            className={`pulso-codificacion-config-button ${hasActiveMatrix ? "is-primary" : ""}`}
            onClick={() => {
              setError("");
              setDialogOpen(true);
            }}
            disabled={disabled || barraOcupada}
            title="Importa una matriz Excel o JSON; queda como mapeo listo para aplicarse en la pestaña Aplicar."
          >
            <Upload size={13} />
            {hasActiveMatrix ? "Actualizar mapeo..." : "Importar matriz..."}
          </button>
          {!hasActiveMatrix && (
            <button
              type="button"
              className="pulso-codificacion-config-button is-primary"
              onClick={(e) => exportMatrix("work", e.currentTarget)}
              disabled={disabled || barraOcupada || exportVariableNames.length === 0}
              title="Crea una matriz editable con id de caso, variable, texto original, código, categoría y observaciones."
            >
              <FileSpreadsheet size={14} />
              Generar matriz
            </button>
          )}
          {hasActiveMatrix && (
            <button
              type="button"
              className="pulso-codificacion-config-button"
              onClick={(e) => exportMatrix("work", e.currentTarget)}
              disabled={disabled || barraOcupada || exportVariableNames.length === 0}
              title="Descarga una matriz editable de la base activa para revisar, completar o actualizar casos."
            >
              <FileSpreadsheet size={14} />
              Generar matriz
            </button>
          )}
          {hasActiveMatrix && (
            <button
              type="button"
              className="pulso-codificacion-config-button"
              onClick={() => visibleCaseRows[0] && openCaseEditor(visibleCaseRows[0])}
              disabled={disabled || barraOcupada || visibleCaseRows.length === 0}
              title="Abre la edición puntual de un caso visible del mapeo."
            >
              <Pencil size={13} />
              Editar casos
            </button>
          )}
          <button
            type="button"
            className="pulso-codificacion-config-button"
            onClick={(e) => exportMatrix("client", e.currentTarget)}
            disabled={disabled || barraOcupada}
            title="Exporta una matriz limpia para compartir, sin IDs internos ni rutas locales."
          >
            <Table2 size={13} />
            Matriz para el cliente
          </button>
          <button
            type="button"
            className="pulso-codificacion-config-button"
            onClick={(e) => exportMatrix("internal", e.currentTarget)}
            disabled={disabled || barraOcupada}
            title="Exporta una auditoría interna con trazabilidad y casos cuando existen."
          >
            <ShieldCheck size={13} />
            Auditoría
          </button>
          <button
            type="button"
            className="pulso-codificacion-config-button"
            onClick={(e) => exportConfig(e.currentTarget)}
            disabled={disabled || barraOcupada}
            title="Descarga un respaldo JSON reutilizable de categorías, reglas y recodificaciones."
          >
            <Download size={13} />
            Respaldo JSON
          </button>
          <button
            type="button"
            className="pulso-codificacion-config-button is-icon"
            onClick={() => void refreshMatrixContext()}
            disabled={disabled || barraOcupada}
            aria-label="Actualizar mapa de matrices"
            title="Actualizar mapa de bases, variables y categorías."
          >
            {busy === "map" ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
          </button>
        </div>
        {/* Matrices y respaldo: el contenedor del kit flota bajo la barra sin mover la página, colgado del botón pulsado. */}
        <ContenedorEntregable estado={entregas.estado} forma="anclada" eje={ejeEntrega} onCerrar={entregas.cerrar} />
      </div>

      {/* L25: "Matriz aplicada…" es un toast y las matrices y el respaldo salen en el contenedor de la barra; aquí queda sólo el error, que no se va solo. */}
      {visibleError && (
        <div className="pulso-codificacion-matrix-feedback" role="status" aria-live="polite" aria-atomic="true">
          {visibleError && <span className="pulso-codificacion-config-feedback is-error">{visibleError}</span>}
        </div>
      )}

      {hasActiveMatrix && activeMapVariables.length > 0 && (
        <section className="pulso-codificacion-matrix-focusbar" aria-label="Filtrar matriz de la base activa">
          <div className="pulso-codificacion-matrix-focus-group">
            <span>Ver</span>
            <button
              type="button"
              className={`pulso-codificacion-matrix-focus-chip is-all${focusedVariable === "all" ? " is-active" : ""}`}
              onClick={() => setFocusedVariable("all")}
              aria-pressed={focusedVariable === "all"}
            >
              <span>Todas</span>
              <small>{matrixStats.assignments}</small>
            </button>
            <div className="pulso-codificacion-matrix-focus-scroll">
              {activeMapVariables.map((variable) => {
                const variableLabel = labelForVariable(variable.variable, variable.variable_label);
                const assignments = matrixVariableAssignments(variable);
                return (
                  <button
                    key={variable.variable}
                    type="button"
                    className={`pulso-codificacion-matrix-focus-chip${focusedVariable === variable.variable ? " is-active" : ""}`}
                    onClick={(event) => {
                      setFocusedVariable(variable.variable);
                      resetMatrixFocusRail(event.currentTarget.parentElement);
                    }}
                    aria-pressed={focusedVariable === variable.variable}
                    title={`${variableLabel}: ${matrixVariableCases(variable)} casos únicos`}
                  >
                    <span>{variableLabel}</span>
                    <small>{assignments}</small>
                  </button>
                );
              })}
            </div>
          </div>
          <label className="pulso-codificacion-matrix-search">
            <Search size={14} aria-hidden="true" />
            <input
              value={caseQuery}
              onChange={(event) => setCaseQuery(event.target.value)}
              placeholder="Buscar caso o categoría"
              aria-label="Buscar en los casos del mapeo"
            />
            {caseQuery && (
              <button type="button" onClick={() => setCaseQuery("")} aria-label="Limpiar búsqueda">
                <X size={13} />
              </button>
            )}
          </label>
        </section>
      )}

      <div className="pulso-codificacion-matrix-layout">
        <section className="pulso-codificacion-matrix-panel">
          {hasActiveMatrix ? (
            <>
              <div className="pulso-codificacion-matrix-panel-head">
                <span aria-hidden="true"><Pencil size={15} /></span>
                <div>
                  <strong>Casos y asignaciones</strong>
                  <small>{activeBaseLabel}: {formatoConteo(visibleCaseRows.length)} visibles, {formatoConteo(focusedAssignmentCount)} asignaciones y {formatoConteo(focusedCaseCount)} casos únicos</small>
                </div>
              </div>
              <div className="pulso-codificacion-matrix-case-list">
                {editingCase && (
                  <div className="pulso-codificacion-matrix-case-editor">
                    <div>
                      <strong>{editingCase.id_caso}</strong>
                      <span>{editingCase.variableLabel}: {editingCase.respuesta}</span>
                    </div>
                    <select
                      value={editingCase.nextCodigo}
                      disabled={busy !== null}
                      onChange={(event) => updateEditingCode(event.target.value)}
                    >
                      {editCategoryOptions.map((category) => (
                        <option key={category.codigo} value={category.codigo}>
                          {category.codigo}. {category.etiqueta}
                        </option>
                      ))}
                    </select>
                    <input
                      value={editingCase.nextEtiqueta}
                      disabled={busy !== null}
                      onChange={(event) => setEditingCase((current) => current ? { ...current, nextEtiqueta: event.target.value } : current)}
                      aria-label="Etiqueta del caso"
                    />
                    <div>
                      <button type="button" onClick={() => setEditingCase(null)} disabled={busy !== null}>
                        Cancelar
                      </button>
                      <button type="button" className="is-primary" onClick={() => void saveCaseEdit()} disabled={busy !== null || !editingCase.nextCodigo || !editingCase.nextEtiqueta}>
                        {busy === "case-patch" ? <Loader2 size={13} className="pulso-spin" /> : <Save size={13} />}
                        Guardar
                      </button>
                    </div>
                  </div>
                )}
                {visibleCaseRows.length === 0 ? (
                  <EstadoVacio icono={<Pencil size={18} />} titulo="No hay casos visibles" descripcion={caseQuery ? "Limpia la búsqueda o cambia la variable activa." : "Actualiza el mapa o importa una matriz con id_caso para habilitar edición puntual."} />
                ) : (
                  visibleCaseRows.map((row, index) => (
                    <button
                      key={`${row.variable}:${row.id_caso}:${row.codigo}:${index}`}
                      type="button"
                      className="pulso-codificacion-matrix-case-row"
                      onClick={() => openCaseEditor(row)}
                    >
                      <span className="pulso-codificacion-matrix-variable-code">C{row.codigo || "s/c"}</span>
                      <span>
                        <strong>{row.respuesta || "Sin texto registrado"}</strong>
                        <small>{row.variableLabel}, caso {row.id_caso}</small>
                        {row.obs && <small>Comentario de revisión: {row.obs}</small>}
                      </span>
                      <em className={`is-${matrixCategoryRoleClass(row.categoryRole)}`}>
                        {matrixCaseCategoryLabel(row)}
                      </em>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="pulso-codificacion-matrix-panel-head">
                <span aria-hidden="true"><ListChecks size={15} /></span>
                <div>
                  <strong>Variables para generar matriz</strong>
                  <small>{activeBaseLabel}: {formatoConteo(selectedVariableNames.length)} de {formatoConteo(textQuestions.length)} seleccionadas</small>
                </div>
                <div className="pulso-codificacion-matrix-panel-actions">
                  <button type="button" onClick={() => toggleAllVariables(true)} disabled={!textQuestions.length || busy !== null}>
                    Todas
                  </button>
                  <button type="button" onClick={() => toggleAllVariables(false)} disabled={!textQuestions.length || busy !== null}>
                    Ninguna
                  </button>
                </div>
              </div>
              <div className="pulso-codificacion-matrix-variable-list">
                {textQuestions.length === 0 ? (
                  <EstadoVacio icono={<FileSpreadsheet size={18} />} titulo="No hay textos abiertos detectados" descripcion="Vuelve a Preparar para revisar qué preguntas se pueden codificar." />
                ) : (
                  textQuestions.map((question) => (
                    <label key={question.parent} className="pulso-codificacion-matrix-variable-row">
                      <input
                        type="checkbox"
                        checked={selectedVars[question.parent] !== false}
                        disabled={busy !== null}
                        onChange={(event) => toggleVariable(question.parent, event.target.checked)}
                      />
                      <span className="pulso-codificacion-matrix-variable-code">{question.parent}</span>
                      <span className="pulso-codificacion-matrix-variable-copy">
                        <strong>{question.parent_label || question.parent}</strong>
                        <small>{formatoConteo(question.n_respuestas)} casos, {formatoConteo(question.n_unicas)} respuestas únicas</small>
                      </span>
                      <span className={`pulso-codificacion-matrix-state is-${question.status.replace("-", "")}`}>
                        {question.status === "completo" ? "Lista" : question.marcada ? "Marcada" : "Disponible"}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </>
            )}
        </section>

        <section className="pulso-codificacion-matrix-panel">
          <div className="pulso-codificacion-matrix-panel-head">
            <span aria-hidden="true"><Database size={15} /></span>
            <div>
              <strong>Diccionario por variable</strong>
              <small>{focusedLabel} en {activeBaseLabel}, solo casos de esta base</small>
            </div>
          </div>
          <div className="pulso-codificacion-matrix-map">
            {!map ? (
              <LoadingBlock label="Leyendo el mapa de codificación…" variant="inline" />
            ) : !activeMapBase ? (
              <EstadoVacio icono={<Network size={18} />} titulo="Selecciona una base" descripcion="El mapa mostrará variables y categorías de una base a la vez." />
            ) : activeMapBase.variables.length === 0 ? (
              <EstadoVacio icono={<Network size={18} />} titulo={<>Sin mapeo de matriz en {activeBaseLabel}</>} descripcion="Esta vista muestra solo mapeos de matriz por base; los códigos asignados en Prosecnur se aplican junto con este mapa en la pestaña Aplicar." />
            ) : (
              visibleMapVariables.map((variable) => (
                <article key={`${activeMapBase.base}:${variable.variable}`} className={`pulso-codificacion-matrix-base-card${focusedVariable === variable.variable ? " is-focused" : ""}`}>
                  <header>
                    <div className="pulso-codificacion-matrix-card-title">
                      <strong>{labelForVariable(variable.variable, variable.variable_label)}</strong>
                      <small>{variable.variable_kind_label ?? "Variable de matriz"} ({variable.variable})</small>
                    </div>
                    <span>{formatoConteo(variable.n_casos ?? 0)} casos, {formatoConteo(variable.categories.length)} categorías</span>
                  </header>
                  <div className="pulso-codificacion-matrix-dictionary-table-wrap">
                    {variable.categories.length === 0 ? (
                      <small>Sin categorías todavía.</small>
                    ) : (
                      <table className="pulso-codificacion-matrix-dictionary-table">
                        <thead>
                          <tr>
                            <th scope="col">Código</th>
                            <th scope="col">Tipo</th>
                            <th scope="col">Categoría</th>
                            <th scope="col">Casos</th>
                            <th scope="col">Asign.</th>
                            <th scope="col">Obs.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variable.categories.map((category) => (
                            <tr
                              key={`${variable.variable}:${category.codigo}:${category.etiqueta}`}
                              className={`is-${matrixCategoryRoleClass(category.category_role)}`}
                            >
                              <td>
                                <code>{category.codigo || "s/c"}</code>
                              </td>
                              <td>
                                <span className={`pulso-codificacion-matrix-role-badge is-${matrixCategoryRoleClass(category.category_role)}`}>
                                  {category.category_role_label ?? "Categoría"}
                                </span>
                              </td>
                              <td>
                                <strong>{category.etiqueta || "Sin etiqueta"}</strong>
                              </td>
                              <td>{category.n_casos}</td>
                              <td>{category.n_asignaciones ?? category.n_casos}</td>
                              <td>{category.n_observaciones ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="pulso-codificacion-matrix-standard">
        <span>Mapa previo a adaptación</span>
        <strong>ID caso, texto original, código, categoría y observaciones</strong>
        <small>{hasActiveMatrix ? `Diccionario activo en ${activeBaseLabel}; se aplica en la pestaña Aplicar junto con la codificación manual.` : `La matriz editable se genera para ${activeBaseLabel} y se aplica después en la pestaña Aplicar.`}</small>
      </section>
      {importDialog}
    </div>
  );
}

function MatrixStat({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="pulso-codificacion-matrix-stat">
      <strong>{typeof value === "number" ? formatoConteo(value) : value}</strong>
      {label}
    </span>
  );
}

function matrixVariableAssignments(variable: MatrixMapVariable) {
  return variable.n_asignaciones ?? variable.categories.reduce(
    (acc, category) => acc + (category.n_asignaciones ?? category.n_casos ?? 0),
    0
  );
}

function matrixVariableCases(variable: MatrixMapVariable) {
  return variable.n_casos ?? variable.categories.reduce(
    (acc, category) => acc + (category.n_casos ?? 0),
    0
  );
}

function normalizeMatrixSearch(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matrixCategoryRoleClass(role: string | null | undefined) {
  return role === "otro" || role === "no_contesta" ? role : "regular";
}

function matrixCaseCategoryLabel(row: MatrixCaseRow) {
  const etiqueta = row.etiqueta || "Sin etiqueta";
  const role = matrixCategoryRoleClass(row.categoryRole);
  const roleLabel = row.categoryRoleLabel || "";
  if (role === "regular" || !roleLabel || normalizeMatrixSearch(roleLabel) === normalizeMatrixSearch(etiqueta)) {
    return etiqueta;
  }
  return `${roleLabel}: ${etiqueta}`;
}

function resetMatrixFocusRail(node: HTMLElement | null) {
  if (!node || typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    node.scrollLeft = 0;
  });
}

function compactMatrixBaseLabel(base: string | null | undefined, label: string) {
  const clean = String(label || "").trim();
  const compact = clean
    .replace(/^Acreditaci[oó]n\s+/i, "")
    .replace(/\s*[-–—]\s*Encuesta\s+(a\s+)?Egresados.*$/i, "")
    .replace(/\s*[-–—]\s*Encuesta\s+Egresados.*$/i, "")
    .trim();
  if (compact && compact !== "Base única" && compact !== "NA") return compact;
  const fallback = String(base || "").trim();
  if (!fallback || fallback === "default") return clean || "Base única";
  return fallback
    .replace(/^ingenieria_/i, "Ingeniería ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compactMatrixVariableLabel(variable: string, label: string) {
  const clean = String(label || "").trim().replace(/:\s*$/, "");
  if (clean && clean !== variable) return clean;
  return variable;
}

function CodingConfigImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [fileName, setFileName] = useState("");
  const [bundle, setBundle] = useState<unknown>(null);
  const [preview, setPreview] = useState<CodifImportPreview | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [strategies, setStrategies] = useState<Record<string, CodifConfigImportStrategy>>({});
  const [error, setError] = useState("");
  const [result, setResult] = useState<string>("");

  const selectedItems = useMemo(() => {
    if (!preview) return [];
    return preview.items.filter((item) => selected[item.match_id] && item.can_apply);
  }, [preview, selected]);

  async function loadFile(file?: File) {
    if (!file) return;
    setBusy("preview");
    setError("");
    setResult("");
    setPreview(null);
    setBundle(null);
    setFileName(file.name);
    try {
      const isExcel = /\.(xlsx|xlsm|xls)$/i.test(file.name);
      const parsed = isExcel ? null : JSON.parse(await file.text());
      const excelResult = isExcel ? await apiCodifImportExcel(file) : null;
      const nextBundle = excelResult?.bundle ?? parsed;
      const nextPreview = excelResult?.preview ?? await apiCodifImportJsonPreview(parsed, file.name);
      setBundle(nextBundle);
      setPreview(nextPreview);
      const nextSelected: Record<string, boolean> = {};
      const nextStrategies: Record<string, CodifConfigImportStrategy> = {};
      for (const item of nextPreview.items) {
        nextSelected[item.match_id] = item.status === "compatible";
        nextStrategies[item.match_id] = item.existing_state ? "merge_missing" : "replace";
      }
      setSelected(nextSelected);
      setStrategies(nextStrategies);
      const warnings = excelResult?.bundle.metadata?.warnings ?? [];
      if (warnings.length) {
        setResult(`${warnings.length} aviso(s) del Excel. Revisa las variables compatibles antes de aplicar.`);
      }
    } catch (e) {
      setError(`Archivo inválido o no compatible: ${(e as Error).message}`);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function apiCodifImportExcel(file: File) {
    const uploaded = await apiUpload(file, "plantilla_codif");
    return apiCodifMatricesPreview(uploaded.file_id, file.name);
  }

  async function applyImport() {
    if (!bundle || !preview) return;
    const selections: CodifImportSelection[] = selectedItems.map((item) => ({
      match_id: item.match_id,
      strategy: strategies[item.match_id] ?? (item.existing_state ? "merge_missing" : "replace"),
    }));
    if (!selections.length) {
      setError("Selecciona al menos una variable compatible para aplicar la matriz.");
      return;
    }
    setBusy("apply");
    setError("");
    try {
      const applied = await apiCodifMatricesApply(bundle, selections, fileName);
      setResult(
        `${applied.summary.variables_imported} importada(s), ${applied.summary.variables_versioned} guardada(s) como nueva versión, ${applied.summary.variables_skipped} omitida(s).`
      );
      onImported();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function setItemSelected(item: CodifImportPreviewItem, checked: boolean) {
    setSelected((prev) => ({ ...prev, [item.match_id]: checked }));
    if (checked && item.existing_state && (strategies[item.match_id] ?? "keep") === "keep") {
      setStrategies((prev) => ({ ...prev, [item.match_id]: "merge_missing" }));
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-codificacion-import-backdrop pulso-cv2-overlay" />
        <Dialog.Content
          className="pulso-codificacion-import-dialog pulso-cv2-dialog"
          aria-describedby="codif-import-description"
        >
        <header className="pulso-codificacion-import-head">
          <span className="pulso-codificacion-import-icon" aria-hidden="true"><FileJson size={18} /></span>
          <div>
            <span className="pulso-section-eyebrow">Matrices</span>
            <Dialog.Title asChild>
              <h2>Importar matriz de codificación</h2>
            </Dialog.Title>
            <Dialog.Description id="codif-import-description">
              Compara origen y destino antes de traer categorías, reglas o recodificaciones al proyecto actual.
            </Dialog.Description>
          </div>
          <Dialog.Close asChild>
            <button type="button" className="pulso-icon" aria-label="Cerrar">
              <X size={14} />
            </button>
          </Dialog.Close>
        </header>

        <div className="pulso-codificacion-import-body">
          <div className="pulso-codificacion-import-picker">
            <div>
              <strong>{fileName || "Selecciona una matriz Excel o JSON"}</strong>
              <span>Soporta matrices p35 caso-código, puesto/función por pares respuesta-categoría y bundles JSON.</span>
            </div>
            <button type="button" className="pulso-secondary" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
              <Upload size={13} />
              {busy === "preview" ? "Validando..." : "Elegir archivo..."}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json,.xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.ms-excel.sheet.macroEnabled.12"
              hidden
              onChange={(e) => void loadFile(e.target.files?.[0])}
            />
          </div>

          {error && <Alert kind="error">{error}</Alert>}
          {result && (
            <div className="pulso-codificacion-import-result" role="status" aria-live="polite" aria-atomic="true">
              <CheckCircle2 size={15} />
              <strong>{result}</strong>
            </div>
          )}

          {preview && (
            <>
              <ImportSummary preview={preview} />
              <div className="pulso-codificacion-import-table-wrap">
                <table className="pulso-codificacion-import-table">
                  <caption className="pulso-sr-only">
                    Variables detectadas en la matriz importada y estrategia para aplicarlas.
                  </caption>
                  <thead>
                    <tr>
                      <th>Usar</th>
                      <th>Origen</th>
                      <th>Destino</th>
                      <th>Estado</th>
                      <th>Cambios</th>
                      <th>Cómo aplicar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((item) => (
                      <tr key={item.match_id} className={`is-${item.status.replace("_", "-")}`}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!selected[item.match_id]}
                            disabled={!item.can_apply || busy !== null}
                            onChange={(e) => setItemSelected(item, e.target.checked)}
                            aria-label={`Usar ${item.source.name}`}
                          />
                        </td>
                        <td>
                          <code>{item.source.name}</code>
                          <span>{item.source.label || item.source.base_id}</span>
                        </td>
                        <td>
                          {item.target.name ? <code>{item.target.name}</code> : <strong>No encontrada</strong>}
                          <span>{item.target.base_id}{item.target.label ? `, ${item.target.label}` : ""}</span>
                        </td>
                        <td>
                          <StatusBadge item={item} />
                          <small>{item.reason}</small>
                        </td>
                        <td>
                          <span>{item.changes.categories_new} nuevas</span>
                          <span>{item.changes.categories_overwrite} posibles reemplazos</span>
                          <span>{item.changes.rules_add + item.changes.recodes_add} reglas/recodificaciones</span>
                          {item.matrix_layout && (
                            <span>{item.matrix_layout === "case_code_matrix" ? "p35 caso-código" : "respuesta-categoría"}</span>
                          )}
                          {item.matrix_diagnostics?.matched_cases !== undefined && (
                            <span>{item.matrix_diagnostics.matched_cases} casos con match</span>
                          )}
                          {item.matrix_diagnostics?.unmatched_cases ? (
                            <span>{item.matrix_diagnostics.unmatched_cases} casos sin match</span>
                          ) : null}
                          {item.matrix_diagnostics?.review_rows ? (
                            <span>{item.matrix_diagnostics.review_rows} en revisión</span>
                          ) : null}
                        </td>
                        <td>
                          {item.existing_state ? (
                            <select
                              value={strategies[item.match_id] ?? "merge_missing"}
                              disabled={!selected[item.match_id] || busy !== null}
                              onChange={(e) => setStrategies((prev) => ({
                                ...prev,
                                [item.match_id]: e.target.value as CodifConfigImportStrategy,
                              }))}
                            >
                              <option value="keep">Conservar actual</option>
                              <option value="merge_missing">Agregar solo faltantes</option>
                              <option value="replace">Reemplazar lo actual</option>
                              <option value="duplicate">Guardar como nueva versión</option>
                            </select>
                          ) : (
                            <span className="pulso-codificacion-import-strategy">Aplicar matriz</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <footer className="pulso-codificacion-import-footer">
          <Dialog.Close asChild>
            <button type="button">Cancelar</button>
          </Dialog.Close>
          <button
            type="button"
            className="pulso-primary"
            disabled={!preview || selectedItems.length === 0 || busy !== null}
            onClick={applyImport}
          >
            <ShieldCheck size={14} />
            {busy === "apply" ? "Aplicando..." : `Aplicar matriz (${selectedItems.length})`}
          </button>
        </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ImportSummary({ preview }: { preview: CodifImportPreview }) {
  const s = preview.summary;
  const matrixTotal = preview.matrix_summary?.total;
  return (
    <div className="pulso-codificacion-import-summary">
      <SummaryPill tone="ok" label="Compatibles" value={s.n_compatible} />
      <SummaryPill tone="review" label="Requieren revisión" value={s.n_needs_confirmation} />
      <SummaryPill tone="warn" label="Conflictos" value={s.n_conflicts} />
      <SummaryPill tone="muted" label="No compatibles" value={s.n_missing} />
      {matrixTotal && (
        <>
          <SummaryPill tone="muted" label="Filas matriz" value={matrixTotal.filas ?? 0} />
          <SummaryPill tone="ok" label="Puestos categ." value={matrixTotal.puestos_categorizados ?? 0} />
          <SummaryPill tone="review" label="Puestos rev." value={matrixTotal.puestos_revision ?? 0} />
          <SummaryPill tone="ok" label="Funciones categ." value={matrixTotal.funciones_categorizadas ?? 0} />
          <SummaryPill tone="review" label="Funciones rev." value={matrixTotal.funciones_revision ?? 0} />
        </>
      )}
      <span className="pulso-codificacion-import-source">
        {preview.source.project_label || "Proyecto origen"} → {preview.target.project_label || "Proyecto actual"}
      </span>
    </div>
  );
}

function SummaryPill({ tone, label, value }: { tone: "ok" | "review" | "warn" | "muted"; label: string; value: number }) {
  return (
    <span className={`pulso-codificacion-import-pill is-${tone}`}>
      <strong>{typeof value === "number" ? formatoConteo(value) : value}</strong>
      {label}
    </span>
  );
}

function StatusBadge({ item }: { item: CodifImportPreviewItem }) {
  const label =
    item.status === "compatible" ? "Compatible" :
    item.status === "needs_confirmation" ? "Requiere revisión" :
    item.status === "conflict" ? "Conflicto" :
    "No compatible";
  const Icon = item.status === "compatible" ? CheckCircle2 : AlertTriangle;
  return (
    <span className={`pulso-codificacion-import-status is-${item.status.replace("_", "-")}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}
