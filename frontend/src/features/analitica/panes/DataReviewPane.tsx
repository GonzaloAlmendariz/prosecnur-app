import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Database, Eye, EyeOff, FolderSearch, RefreshCw, RotateCcw, Tags } from "lucide-react";
import {
  apiAnaliticaDataReview,
  apiAnaliticaDetectSecciones,
  type DataReviewVariable,
  type SeccionDetectada,
} from "../../../api/client";
import { Panel } from "../../../components/Panel";
import { ErrorBlock, LoadingBlock } from "../../../components/States";
import { describirCobertura, padresConDummies } from "../coberturaVariable";
import { useAnaliticaStore, type SeccionConfig } from "../store";

export function dataReviewHasEditableOptions(variable: Pick<DataReviewVariable, "tipo_xlsform" | "opciones">) {
  const tipo = (variable.tipo_xlsform ?? "").trim().toLowerCase();
  return (tipo.startsWith("select_one") || tipo.startsWith("select_multiple")) && variable.opciones.length > 0;
}

export function dataReviewEffectiveVariableLabel(variable: DataReviewVariable, override?: string) {
  return override ?? (variable.label_actual || variable.label_original || variable.name);
}

export function dataReviewEffectiveOptionLabel(option: DataReviewVariable["opciones"][number], override?: string) {
  return override ?? (option.label || option.code);
}

export type DataReviewDraft = {
  variableLabels: Record<string, string>;
  valueLabels: Record<string, Record<string, string>>;
};

export function buildDataReviewDraft(
  variables: DataReviewVariable[],
  variableOverrides: Record<string, string> = {},
  valueOverrides: Record<string, Record<string, string>> = {},
): DataReviewDraft {
  const variableLabels: Record<string, string> = {};
  const valueLabels: Record<string, Record<string, string>> = {};
  for (const variable of variables) {
    variableLabels[variable.name] = dataReviewEffectiveVariableLabel(variable, variableOverrides[variable.name]);
    if (dataReviewHasEditableOptions(variable)) {
      valueLabels[variable.name] = {};
      const overrides = valueOverrides[variable.name] ?? {};
      for (const option of variable.opciones) {
        valueLabels[variable.name][option.code] = dataReviewEffectiveOptionLabel(option, overrides[option.code]);
      }
    }
  }
  return { variableLabels, valueLabels };
}

export function dataReviewDraftStatus(variables: DataReviewVariable[], draft: DataReviewDraft, baseline: DataReviewDraft) {
  let pendingCount = 0;
  let emptyCount = 0;
  for (const variable of variables) {
    const draftLabel = draft.variableLabels[variable.name] ?? "";
    const baselineLabel = baseline.variableLabels[variable.name] ?? "";
    if (draftLabel !== baselineLabel) pendingCount += 1;
    if (!draftLabel.trim()) emptyCount += 1;
    if (!dataReviewHasEditableOptions(variable)) continue;
    for (const option of variable.opciones) {
      const draftOption = draft.valueLabels[variable.name]?.[option.code] ?? "";
      const baselineOption = baseline.valueLabels[variable.name]?.[option.code] ?? "";
      if (draftOption !== baselineOption) pendingCount += 1;
      if (!draftOption.trim()) emptyCount += 1;
    }
  }
  return { pendingCount, emptyCount };
}

export type DataReviewSectionGroup = {
  id: string;
  name: string;
  hidden: boolean;
  manual?: boolean;
  synthetic: boolean;
  variables: DataReviewVariable[];
};

export function buildDataReviewSectionGroups(
  variables: DataReviewVariable[],
  sections: SeccionConfig[],
): DataReviewSectionGroup[] {
  const byName = new Map(variables.map((variable) => [variable.name, variable]));
  const assigned = new Set<string>();
  const groups: DataReviewSectionGroup[] = [];
  const groupByVariable = new Map<string, DataReviewSectionGroup>();
  const sortedSections = [...sections].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

  for (const section of sortedSections) {
    const sectionVars = section.variables
      .map((name) => byName.get(name))
      .filter((variable): variable is DataReviewVariable => Boolean(variable));
    sectionVars.forEach((variable) => assigned.add(variable.name));
    if (sectionVars.length === 0) continue;
    const group = {
      id: section.id,
      name: section.nombre || section.id,
      hidden: Boolean(section.oculto),
      manual: section.manual,
      synthetic: false,
      variables: sectionVars,
    };
    groups.push(group);
    sectionVars.forEach((variable) => groupByVariable.set(variable.name, group));
  }

  for (const variable of variables) {
    if (assigned.has(variable.name)) continue;
    const parentGroup = variable.dummy_parent ? groupByVariable.get(variable.dummy_parent) : undefined;
    if (parentGroup) {
      parentGroup.variables.push(variable);
      assigned.add(variable.name);
      groupByVariable.set(variable.name, parentGroup);
      continue;
    }
    const configuredSection = groups.find(
      (group) => !group.synthetic && (group.name === variable.seccion || group.id === variable.seccion),
    );
    if (configuredSection) {
      configuredSection.variables.push(variable);
      assigned.add(variable.name);
      groupByVariable.set(variable.name, configuredSection);
      continue;
    }
    const fallbackName = variable.seccion || "General";
    const existing = groups.find((group) => group.synthetic && group.name === fallbackName);
    if (existing) {
      existing.variables.push(variable);
      groupByVariable.set(variable.name, existing);
    }
    else {
      const group = {
        id: `__fallback_${fallbackName}`,
        name: fallbackName,
        hidden: false,
        synthetic: true,
        variables: [variable],
      };
      groups.push(group);
      groupByVariable.set(variable.name, group);
    }
  }

  return groups;
}

export function DataReviewPane() {
  const [variables, setVariables] = useState<DataReviewVariable[]>([]);
  const [openOptions, setOpenOptions] = useState<Set<string>>(new Set());
  const [sectionBusy, setSectionBusy] = useState(false);
  const [sectionError, setSectionError] = useState("");
  const [autoDetectedSections, setAutoDetectedSections] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draftVariableLabels, setDraftVariableLabels] = useState<Record<string, string>>({});
  const [draftValueLabels, setDraftValueLabels] = useState<Record<string, Record<string, string>>>({});
  const [draftError, setDraftError] = useState("");
  const config = useAnaliticaStore((s) => s.config);
  const setSecciones = useAnaliticaStore((s) => s.setSecciones);
  const renameSeccion = useAnaliticaStore((s) => s.renameSeccion);
  const toggleSeccionOculto = useAnaliticaStore((s) => s.toggleSeccionOculto);
  const setVariablesExcluidas = useAnaliticaStore((s) => s.setVariablesExcluidas);
  const toggleVariableExcluida = useAnaliticaStore((s) => s.toggleVariableExcluida);
  const setDatosVariableLabel = useAnaliticaStore((s) => s.setDatosVariableLabel);
  const setDatosValueLabel = useAnaliticaStore((s) => s.setDatosValueLabel);
  const clearDatosVariable = useAnaliticaStore((s) => s.clearDatosVariable);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await apiAnaliticaDataReview();
      setVariables(r.variables);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function detectSections(opts: { silent?: boolean } = {}) {
    setSectionBusy(true);
    if (!opts.silent) setSectionError("");
    try {
      const r = await apiAnaliticaDetectSecciones();
      const detected = r.secciones;
      const byIdManual = new Map(
        config.secciones.filter((section) => section.manual).map((section) => [section.id, section]),
      );
      const merged: SeccionConfig[] = detected.map((section: SeccionDetectada, index: number) => {
        const prior = byIdManual.get(section.id);
        if (prior) return { ...prior, variables: section.variables, orden: prior.orden ?? index };
        return { ...section, orden: index, manual: false };
      });
      const detectedIds = new Set(detected.map((section) => section.id));
      const orphans = config.secciones.filter((section) => section.manual && !detectedIds.has(section.id));
      setSecciones([...merged, ...orphans].map((section, index) => ({ ...section, orden: index })));
      setAutoDetectedSections(true);
    } catch (e) {
      if (!opts.silent) setSectionError((e as Error).message);
    } finally {
      setSectionBusy(false);
    }
  }

  useEffect(() => {
    void load();
    function onSourceChanged() {
      setAutoDetectedSections(false);
      void load();
      void detectSections({ silent: true });
    }
    window.addEventListener("pulso:analitica-source-changed", onSourceChanged);
    return () => window.removeEventListener("pulso:analitica-source-changed", onSourceChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading || autoDetectedSections || variables.length === 0 || config.secciones.length > 0) return;
    void detectSections({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, autoDetectedSections, variables.length, config.secciones.length]);

  function toggleOptions(name: string) {
    setOpenOptions((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function setSectionVariablesIncluded(names: string[], include: boolean) {
    const next = new Set(config.variables_excluidas);
    for (const name of names) {
      if (include) next.delete(name);
      else next.add(name);
    }
    setVariablesExcluidas(Array.from(next));
  }

  const excluded = new Set(config.variables_excluidas);
  const groups = useMemo(
    () => buildDataReviewSectionGroups(variables, config.secciones),
    [variables, config.secciones],
  );
  // Sobre el payload completo y no sobre el grupo: si un dummy cayera en otra
  // sección, su padre se leería como ausente y avisaría en falso.
  const padresRepartidos = useMemo(() => padresConDummies(variables), [variables]);
  const baselineDraft = useMemo(
    () => buildDataReviewDraft(variables, config.datos.variable_labels, config.datos.value_labels),
    [variables, config.datos.variable_labels, config.datos.value_labels],
  );
  const draftReady =
    variables.length === 0 ||
    variables.every((variable) => Object.prototype.hasOwnProperty.call(draftVariableLabels, variable.name));
  const currentDraft = useMemo(
    () => (draftReady ? { variableLabels: draftVariableLabels, valueLabels: draftValueLabels } : baselineDraft),
    [baselineDraft, draftReady, draftVariableLabels, draftValueLabels],
  );
  const draftStatus = useMemo(
    () => dataReviewDraftStatus(variables, currentDraft, baselineDraft),
    [variables, currentDraft, baselineDraft],
  );
  const includedCount = variables.filter((v) => !excluded.has(v.name)).length;
  const excludedCount = Math.max(variables.length - includedCount, 0);
  const editedCount = useMemo(() => {
    const varCount = Object.keys(config.datos.variable_labels ?? {}).length;
    const valueCount = Object.values(config.datos.value_labels ?? {}).reduce(
      (sum, labels) => sum + Object.keys(labels ?? {}).length,
      0,
    );
    return varCount + valueCount;
  }, [config.datos.variable_labels, config.datos.value_labels]);

  useEffect(() => {
    setDraftVariableLabels(baselineDraft.variableLabels);
    setDraftValueLabels(baselineDraft.valueLabels);
    setDraftError("");
  }, [baselineDraft]);

  function setDraftVariableLabel(name: string, label: string) {
    setDraftVariableLabels((prev) => ({ ...prev, [name]: label }));
    if (draftError) setDraftError("");
  }

  function setDraftValueLabel(name: string, code: string, label: string) {
    setDraftValueLabels((prev) => ({
      ...prev,
      [name]: { ...(prev[name] ?? {}), [code]: label },
    }));
    if (draftError) setDraftError("");
  }

  function resetDraftVariable(name: string) {
    const variable = variables.find((item) => item.name === name);
    if (!variable) return;
    setDraftVariableLabels((prev) => ({
      ...prev,
      [name]: dataReviewEffectiveVariableLabel(variable),
    }));
    setDraftValueLabels((prev) => {
      const next = { ...prev };
      if (dataReviewHasEditableOptions(variable)) {
        next[name] = Object.fromEntries(
          variable.opciones.map((option) => [option.code, dataReviewEffectiveOptionLabel(option)]),
        );
      } else {
        delete next[name];
      }
      return next;
    });
    if (draftError) setDraftError("");
  }

  function confirmDraftLabels() {
    const status = dataReviewDraftStatus(variables, currentDraft, baselineDraft);
    if (status.emptyCount > 0) {
      setDraftError(
        `${status.emptyCount} etiqueta${status.emptyCount === 1 ? "" : "s"} vacía${status.emptyCount === 1 ? "" : "s"}. Completa esos campos antes de confirmar los cambios.`,
      );
      return;
    }
    if (status.pendingCount === 0) return;

    for (const variable of variables) {
      const draftLabel = (currentDraft.variableLabels[variable.name] ?? "").trim();
      const baselineLabel = baselineDraft.variableLabels[variable.name] ?? "";
      const originalLabel = dataReviewEffectiveVariableLabel(variable);
      let changed = draftLabel !== baselineLabel;

      if (dataReviewHasEditableOptions(variable)) {
        for (const option of variable.opciones) {
          const draftOption = (currentDraft.valueLabels[variable.name]?.[option.code] ?? "").trim();
          const baselineOption = baselineDraft.valueLabels[variable.name]?.[option.code] ?? "";
          if (draftOption !== baselineOption) {
            changed = true;
            break;
          }
        }
      }

      if (!changed) continue;
      clearDatosVariable(variable.name);
      if (draftLabel !== originalLabel) setDatosVariableLabel(variable.name, draftLabel);
      if (dataReviewHasEditableOptions(variable)) {
        for (const option of variable.opciones) {
          const draftOption = (currentDraft.valueLabels[variable.name]?.[option.code] ?? "").trim();
          if (draftOption !== dataReviewEffectiveOptionLabel(option)) {
            setDatosValueLabel(variable.name, option.code, draftOption);
          }
        }
      }
    }
    setDraftVariableLabels((prev) => {
      const next = { ...prev };
      for (const variable of variables) {
        if (Object.prototype.hasOwnProperty.call(next, variable.name)) next[variable.name] = next[variable.name].trim();
      }
      return next;
    });
    setDraftValueLabels((prev) => {
      const next = { ...prev };
      for (const variable of variables) {
        if (!next[variable.name]) continue;
        next[variable.name] = Object.fromEntries(
          Object.entries(next[variable.name]).map(([code, label]) => [code, label.trim()]),
        );
      }
      return next;
    });
    setDraftError("");
  }

  return (
    <Panel className="pulso-data-review-panel">
      <div className="pulso-data-review-workbench">
        <div className="pulso-data-review-docbar">
          <span className="pulso-data-review-docbar-icon" aria-hidden="true">
            <Database size={16} />
          </span>
          <div className="pulso-data-review-docbar-copy">
            <span>Producto de datos</span>
            <strong>Revisión de etiquetas</strong>
            <small>Variables, secciones y labels que alimentan todos los reportes.</small>
          </div>
          <div
            className="pulso-data-review-command"
            role="toolbar"
            aria-label="Comandos de revisión de datos"
          >
            <span className="pulso-data-review-command-chip">{includedCount}/{variables.length} incluidas</span>
            {excludedCount > 0 ? (
              <span className="pulso-data-review-command-chip">{excludedCount} excluida{excludedCount === 1 ? "" : "s"} · autoguardadas</span>
            ) : null}
            <span className="pulso-data-review-command-chip">{editedCount} etiqueta{editedCount === 1 ? "" : "s"} editada{editedCount === 1 ? "" : "s"}</span>
            {draftStatus.pendingCount > 0 ? (
              <span className="pulso-data-review-command-chip">{draftStatus.pendingCount} etiqueta{draftStatus.pendingCount === 1 ? "" : "s"} sin confirmar</span>
            ) : null}
            {draftStatus.emptyCount > 0 && draftStatus.pendingCount > 0 ? (
              <span className="pulso-data-review-command-chip is-danger">
                {draftStatus.emptyCount} etiqueta{draftStatus.emptyCount === 1 ? "" : "s"} vacía{draftStatus.emptyCount === 1 ? "" : "s"}
              </span>
            ) : null}
            <button
              type="button"
              onClick={confirmDraftLabels}
              disabled={loading || draftStatus.pendingCount === 0}
              className="pulso-primary pulso-data-review-command-button"
              title={draftStatus.pendingCount === 0 ? "No hay etiquetas pendientes. La inclusión de variables se autoguarda." : "Validar y guardar etiquetas editadas."}
            >
              <CheckCircle2 size={13} />
              Confirmar etiquetas
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="pulso-ghost pulso-data-review-command-button"
            >
              <RefreshCw size={13} className={loading ? "pulso-spin" : ""} />
              Actualizar
            </button>
          </div>
        </div>

        {loading ? <LoadingBlock minHeight={280} label="Cargando revisión de datos..." /> : null}
        {error ? <ErrorBlock label="No se pudo cargar la revisión" detail={error} /> : null}
        {sectionError ? <ErrorBlock label="No se pudo detectar la estructura" detail={sectionError} /> : null}
        {draftError ? <ErrorBlock label="No se pueden confirmar cambios" detail={draftError} /> : null}

        {!loading && !error ? (
          <section className="pulso-data-review-structure" aria-label="Estructura y variables">
            <div className="pulso-data-review-structurebar">
              <div className="pulso-data-review-structure-copy">
                <strong>Estructura y variables</strong>
                <span>Ordena secciones y decide qué etiquetas entran a reportes, bases y cruces.</span>
              </div>
              <div className="pulso-data-review-structure-actions">
                <span className="pulso-data-review-structure-count">
                  {groups.length} {groups.length === 1 ? "sección" : "secciones"} · {variables.length} {variables.length === 1 ? "variable" : "variables"}
                </span>
                <button
                  type="button"
                  onClick={() => void detectSections()}
                  disabled={sectionBusy}
                  className="pulso-ghost pulso-data-review-detect-button"
                  title="Vuelve a leer la estructura del instrumento y conserva renombres manuales cuando sea posible."
                >
                  {sectionBusy ? <RefreshCw size={12} className="pulso-spin" /> : <FolderSearch size={12} />}
                  {sectionBusy ? "Detectando..." : "Detectar estructura"}
                </button>
              </div>
            </div>
            {variables.length === 0 ? (
              <div className="pulso-data-review-empty-note">
                No hay variables preparadas para revisar. Verifica la fuente activa o vuelve a preparar Analítica.
              </div>
            ) : null}
            <div
              className="pulso-data-review-section-list"
              data-qa-geometry-group="analitica/data-review-sections"
              data-qa-geometry-contract="intrinsic"
            >
              {groups.map((group) => (
                <DataReviewSection
                  key={group.id}
                  group={group}
                  excluded={excluded}
                  padresRepartidos={padresRepartidos}
                  baselineDraft={baselineDraft}
                  draftVariableLabels={draftVariableLabels}
                  draftValueLabels={draftValueLabels}
                  openOptions={openOptions}
                  onToggleOptions={toggleOptions}
                  onToggleVariable={toggleVariableExcluida}
                  onSetSectionIncluded={setSectionVariablesIncluded}
                  onRenameSection={renameSeccion}
                  onToggleSectionHidden={(id, names, hide) => {
                    toggleSeccionOculto(id);
                    if (hide) setSectionVariablesIncluded(names, false);
                  }}
                  onSetVariableLabel={setDraftVariableLabel}
                  onSetValueLabel={setDraftValueLabel}
                  onResetVariable={resetDraftVariable}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Panel>
  );
}

function DataReviewSection({
  group,
  excluded,
  padresRepartidos,
  baselineDraft,
  draftVariableLabels,
  draftValueLabels,
  openOptions,
  onToggleOptions,
  onToggleVariable,
  onSetSectionIncluded,
  onRenameSection,
  onToggleSectionHidden,
  onSetVariableLabel,
  onSetValueLabel,
  onResetVariable,
}: {
  group: DataReviewSectionGroup;
  excluded: Set<string>;
  padresRepartidos: Set<string>;
  baselineDraft: DataReviewDraft;
  draftVariableLabels: Record<string, string>;
  draftValueLabels: Record<string, Record<string, string>>;
  openOptions: Set<string>;
  onToggleOptions: (name: string) => void;
  onToggleVariable: (name: string) => void;
  onSetSectionIncluded: (names: string[], include: boolean) => void;
  onRenameSection: (id: string, name: string) => void;
  onToggleSectionHidden: (id: string, names: string[], hide: boolean) => void;
  onSetVariableLabel: (name: string, label: string) => void;
  onSetValueLabel: (name: string, code: string, label: string) => void;
  onResetVariable: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.name);
  const includedInSection = group.variables.filter((variable) => !excluded.has(variable.name)).length;
  const allIncluded = includedInSection === group.variables.length;
  const variableNames = group.variables.map((variable) => variable.name);

  useEffect(() => {
    if (editing) setDraft(group.name);
  }, [editing, group.name]);

  function commitSectionName() {
    const clean = draft.trim();
    if (clean && clean !== group.name && !group.synthetic) onRenameSection(group.id, clean);
    setEditing(false);
  }

  return (
    <section className={`pulso-data-review-section${group.hidden ? " is-hidden" : ""}`}>
      <div className="pulso-data-review-section-head">
        <div className="pulso-data-review-section-copy">
          <div className="pulso-data-review-section-title-row">
            {editing && !group.synthetic ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitSectionName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitSectionName();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="pulso-data-review-input pulso-data-review-section-input"
              />
            ) : (
              <button
                type="button"
                disabled={group.synthetic}
                onClick={() => setEditing(true)}
                className="pulso-data-review-section-title"
                title={group.synthetic ? "Sección detectada desde la variable; usa Detectar estructura para administrarla." : "Renombrar sección"}
              >
                {group.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                {group.name}
              </button>
            )}
            {group.manual ? <span className="pulso-data-review-pill">editada</span> : null}
            {group.synthetic ? <span className="pulso-data-review-pill">sin estructura XLSForm</span> : null}
          </div>
          <div className="pulso-data-review-section-meta">
            {includedInSection}/{group.variables.length} incluidas · {group.hidden ? "sección oculta en agrupadores" : "sección visible en agrupadores"}
          </div>
        </div>

        <div className="pulso-data-review-section-actions">
          <button
            type="button"
            className="pulso-ghost"
            onClick={() => onSetSectionIncluded(variableNames, !allIncluded)}
            disabled={group.variables.length === 0}
          >
            {allIncluded ? "Excluir variables" : "Incluir variables"}
          </button>
          {!group.synthetic ? (
            <button
              type="button"
              className="pulso-ghost"
              onClick={() => onToggleSectionHidden(group.id, variableNames, !group.hidden)}
            >
              {group.hidden ? "Mostrar sección" : "Ocultar sección"}
            </button>
          ) : null}
        </div>
      </div>

      {/* `intrinsic` y no `equal`: una variable con opciones editables monta
          además su barra de «Etiquetas de opciones», así que el alto de cada
          fila es función de los datos de esa variable. Son hermanas de la
          misma variante con capacidad distinta, no un marco desparejo. */}
      <div
        className="pulso-data-review-variable-list"
        data-qa-geometry-group="analitica/datos-variables"
        data-qa-geometry-contract="intrinsic"
      >
        {group.variables.map((variable) => {
          const included = !excluded.has(variable.name);
          const draftLabel = draftVariableLabels[variable.name] ?? dataReviewEffectiveVariableLabel(variable);
          const baselineLabel = baselineDraft.variableLabels[variable.name] ?? dataReviewEffectiveVariableLabel(variable);
          const originalLabel = dataReviewEffectiveVariableLabel(variable);
          const canEditOptions = dataReviewHasEditableOptions(variable);
          const optionsOpen = openOptions.has(variable.name);
          const variableLocked = group.hidden && !group.synthetic;
          const isDummyOption = Boolean(variable.dummy_parent);
          const dummyParent = variable.dummy_parent ?? "";
          const dummyParentLabel = variable.dummy_parent_label?.trim() || dummyParent;
          const dummyOptionLabel = variable.dummy_option_label?.trim() || draftLabel;
          const cobertura = describirCobertura(variable, padresRepartidos.has(variable.name));
          const typeCaption = isDummyOption
            ? `dummy de ${dummyParent} · ${cobertura.texto}`
            : `${variable.tipo_xlsform || "data"} · ${cobertura.texto}`;
          const hasOptionDraftChanges = canEditOptions && variable.opciones.some((option) => {
            const draftOption = draftValueLabels[variable.name]?.[option.code] ?? dataReviewEffectiveOptionLabel(option);
            const baselineOption = baselineDraft.valueLabels[variable.name]?.[option.code] ?? dataReviewEffectiveOptionLabel(option);
            const originalOption = dataReviewEffectiveOptionLabel(option);
            return draftOption !== baselineOption || baselineOption !== originalOption;
          });
          const hasEdits = draftLabel !== baselineLabel || baselineLabel !== originalLabel || Boolean(hasOptionDraftChanges);
          return (
            <div
              key={variable.name}
              className={`pulso-data-review-card${included ? "" : " is-excluded"}${variableLocked ? " is-section-hidden" : ""}`}
            >
              <div className="pulso-data-review-row">
                <label className="pulso-data-review-include">
                  <span>{variableLocked ? "Oculta" : "Incluir"}</span>
                  <input
                    type="checkbox"
                    checked={variableLocked ? false : included}
                    disabled={variableLocked}
                    onChange={() => onToggleVariable(variable.name)}
                  />
                </label>
                <div className="pulso-data-review-variable-copy">
                  <code className="pulso-data-review-variable-code">
                    {variable.name}
                  </code>
                  {isDummyOption ? (
                    <span
                      className="pulso-data-review-dummy-badge"
                      title={`Opción de «${dummyParentLabel}»`}
                    >
                      opción dummy
                    </span>
                  ) : null}
                  {cobertura.aviso ? (
                    <span
                      className="pulso-data-review-cobertura-badge"
                      data-estado={cobertura.estado}
                      title={cobertura.aviso.detalle}
                    >
                      {cobertura.aviso.etiqueta}
                    </span>
                  ) : null}
                  <div className="pulso-data-review-variable-meta">
                    {typeCaption}
                  </div>
                  {isDummyOption ? (
                    <div
                      className="pulso-data-review-dummy-parent"
                      title={dummyParentLabel}
                    >
                      Pertenece a <code>{dummyParent}</code> · {dummyOptionLabel}
                    </div>
                  ) : null}
                </div>
                <label className="pulso-data-review-label">
                  <span>Etiqueta de pregunta</span>
                  <input
                    type="text"
                    value={draftLabel}
                    onChange={(e) => onSetVariableLabel(variable.name, e.target.value)}
                    className={`pulso-data-review-input${draftLabel.trim() ? "" : " is-empty"}`}
                    aria-label={`Etiqueta de ${variable.name}`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onResetVariable(variable.name)}
                  disabled={!hasEdits}
                  className="pulso-ghost pulso-data-review-restore-button"
                  title="Restaurar etiquetas originales de esta variable"
                >
                  <RotateCcw size={12} />
                  Restaurar
                </button>
              </div>

              {canEditOptions ? (
                <div className="pulso-data-review-options">
                  <button
                    type="button"
                    className="pulso-data-review-options-toggle"
                    aria-expanded={optionsOpen}
                    onClick={() => onToggleOptions(variable.name)}
                  >
                    <span className="pulso-data-review-options-title">
                      <Tags size={14} />
                      Etiquetas de opciones
                    </span>
                    <span className="pulso-data-review-options-summary">
                      {variable.opciones.length} código{variable.opciones.length === 1 ? "" : "s"}
                    </span>
                    <ChevronDown size={15} className="pulso-data-review-options-chevron" />
                  </button>
                  {optionsOpen ? (
                    <div className="pulso-data-review-options-panel">
                      <div className="pulso-data-review-option-head">
                        <span>Código</span>
                        <span>Etiqueta editable</span>
                        <span>Conteo</span>
                      </div>
                      <div className="pulso-data-review-option-list">
                        {variable.opciones.map((option) => {
                          const optionDraft = draftValueLabels[variable.name]?.[option.code] ?? dataReviewEffectiveOptionLabel(option);
                          return (
                            <div
                              key={`${variable.name}-${option.code}`}
                              className="pulso-data-review-option-row"
                            >
                              <code className="pulso-data-review-option-code">
                                {option.code}
                              </code>
                              <input
                                type="text"
                                value={optionDraft}
                                onChange={(e) => onSetValueLabel(variable.name, option.code, e.target.value)}
                                className={`pulso-data-review-input${optionDraft.trim() ? "" : " is-empty"}`}
                                aria-label={`Etiqueta de ${variable.name} código ${option.code}`}
                              />
                              <span className="pulso-data-review-option-count">
                                n={option.count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
