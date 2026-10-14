import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle2, ChevronDown, Database, Eye, EyeOff, FolderSearch, RefreshCw, RotateCcw, Tags } from "lucide-react";
import {
  apiAnaliticaDataReview,
  apiAnaliticaDetectSecciones,
  type DataReviewVariable,
} from "../../../api/client";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { Panel } from "../../../components/Panel";
import { PulsoButton } from "../../../components/PulsoButton";
import { Switch } from "../../../components/Switch";
import { ErrorBlock, LoadingBlock } from "../../../components/States";
import { formatoConteo } from "../../../lib/formatoNumero";
import { CifrasPestana, type CifraPestana } from "../CifrasPestana";
import { describirCobertura, padresConDummies } from "../coberturaVariable";
import {
  PLAZO_DETECCION_MS,
  conPlazo,
  fundirSeccionesDetectadas,
  seccionesAMaterializar,
  seccionesVisibles,
} from "../estructuraDeSecciones";
import { useAnaliticaStore, type SeccionConfig } from "../store";
import { searchConPanel } from "../../../lib/navegacion/paneles";
import { PANEL_VARIABLES_EXCLUIDAS } from "../panelesAnalitica";
import { conteoExclusion } from "../variablesExcluidasModel";
import "../variablesExcluidas.css";
import "./DataReviewPane.css";
import { textoPlano } from "../../../lib/textoPlano";
import { AvisosEtiqueta } from "./revisionEtiquetas/AvisosEtiqueta";
import { opcionesEquivalentes, problemasDeEtiqueta, type ProblemaEtiqueta } from "./revisionEtiquetas/detectorEtiquetas";

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
  // Lectura de la estructura del instrumento (P-M11). `silenciosa` es la que
  // corre sola al entrar: no bloquea el botón ni pinta «Detectando…», y su
  // resultado NO se escribe en la config (ver estructuraDeSecciones.ts).
  const [deteccion, setDeteccion] = useState<
    | { estado: "inactiva" }
    | { estado: "leyendo"; silenciosa: boolean }
    | { estado: "error"; silenciosa: boolean; mensaje: string }
  >({ estado: "inactiva" });
  const [seccionesDetectadas, setSeccionesDetectadas] = useState<SeccionConfig[] | null>(null);
  const intentoAutomatico = useRef(false);
  const lecturaVigente = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draftVariableLabels, setDraftVariableLabels] = useState<Record<string, string>>({});
  const [draftValueLabels, setDraftValueLabels] = useState<Record<string, Record<string, string>>>({});
  const [draftError, setDraftError] = useState("");
  const config = useAnaliticaStore((s) => s.config);
  const hydrated = useAnaliticaStore((s) => s.hydrated);
  const setSecciones = useAnaliticaStore((s) => s.setSecciones);
  const renameSeccion = useAnaliticaStore((s) => s.renameSeccion);
  const toggleSeccionOculto = useAnaliticaStore((s) => s.toggleSeccionOculto);
  const setVariablesExcluidas = useAnaliticaStore((s) => s.setVariablesExcluidas);
  const toggleVariableExcluida = useAnaliticaStore((s) => s.toggleVariableExcluida);
  const setDatosVariableLabel = useAnaliticaStore((s) => s.setDatosVariableLabel);
  const setDatosValueLabel = useAnaliticaStore((s) => s.setDatosValueLabel);
  const clearDatosVariable = useAnaliticaStore((s) => s.clearDatosVariable);
  const location = useLocation();

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

  // Lee la estructura del XLSForm. Se ESCRIBE en la config solo si la pidió el
  // usuario o si ya hay secciones declaradas que actualizar (cambio de fuente).
  // La lectura automática de una config sin secciones queda como vista del
  // default del backend: antes se escribía y marcaba «sin guardar» al entrar.
  async function detectSections(opts: { silent?: boolean } = {}) {
    const silenciosa = Boolean(opts.silent);
    const lectura = ++lecturaVigente.current;
    setDeteccion({ estado: "leyendo", silenciosa });
    try {
      const r = await conPlazo(
        apiAnaliticaDetectSecciones(),
        PLAZO_DETECCION_MS,
        `La lectura de la estructura no respondió en ${Math.round(PLAZO_DETECCION_MS / 1000)} s. Vuelve a intentarlo con «Detectar estructura».`,
      );
      if (lectura !== lecturaVigente.current) return;
      const declaradas = useAnaliticaStore.getState().config.secciones;
      const fundidas = fundirSeccionesDetectadas(r.secciones, declaradas);
      if (!silenciosa || declaradas.length > 0) setSecciones(fundidas);
      else setSeccionesDetectadas(fundidas);
      setDeteccion({ estado: "inactiva" });
    } catch (e) {
      if (lectura !== lecturaVigente.current) return;
      setDeteccion({ estado: "error", silenciosa, mensaje: (e as Error).message });
    }
  }

  useEffect(() => {
    void load();
    function onSourceChanged() {
      intentoAutomatico.current = false;
      setSeccionesDetectadas(null);
      void load();
      void detectSections({ silent: true });
    }
    window.addEventListener("pulso:analitica-source-changed", onSourceChanged);
    return () => window.removeEventListener("pulso:analitica-source-changed", onSourceChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Una sola lectura automática por montaje, y solo con la config ya hidratada:
  // antes corría con la config de la visita anterior (o la por defecto) y su
  // resultado pisaba la recién llegada.
  useEffect(() => {
    if (!hydrated || loading || intentoAutomatico.current) return;
    if (variables.length === 0 || config.secciones.length > 0) return;
    intentoAutomatico.current = true;
    void detectSections({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, loading, variables.length, config.secciones.length]);

  // Una decisión del usuario sobre una sección (renombrar, ocultar) necesita
  // secciones declaradas sobre las que aplicarse: si solo hay lo detectado,
  // se escribe primero. Ese «sin guardar» sí es del usuario.
  function materializarSecciones() {
    const aEscribir = seccionesAMaterializar(useAnaliticaStore.getState().config.secciones, seccionesDetectadas);
    if (aEscribir) setSecciones(aEscribir);
  }

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
  const seccionesDePantalla = useMemo(
    () => seccionesVisibles(config.secciones, seccionesDetectadas),
    [config.secciones, seccionesDetectadas],
  );
  const groups = useMemo(
    () => buildDataReviewSectionGroups(variables, seccionesDePantalla),
    [variables, seccionesDePantalla],
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
  // Excluidas sobre la lista de la config, no sobre las columnas presentes: una
  // variable retirada de la base sigue excluida aunque aquí no tenga fila (U5).
  const conteo = conteoExclusion(variables, config.variables_excluidas);
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
      {/* La pestaña Datos no tiene readiness propia: la del tabpanel se publica
          al hidratar la config, antes de que llegue la revisión. Este `false`
          anidado retiene la vista mientras carga (E15/AD6); el error es
          terminal y publica `true`. */}
      <div className="pulso-data-review-workbench" data-audit-ready={loading ? "false" : "true"}>
        <div className="pulso-data-review-docbar">
          <span className="pulso-data-review-docbar-icon" aria-hidden="true">
            <Database size={16} />
          </span>
          <div className="pulso-data-review-docbar-copy">
            <span>Producto de datos</span>
            <strong>Revisión de etiquetas</strong>
            <small>Variables, secciones y etiquetas que usan todos los informes.</small>
          </div>
          <div
            className="pulso-data-review-command"
            role="toolbar"
            aria-label="Comandos de revisión de datos"
          >
            <CifrasPestana
              ariaLabel="Estado de las variables y etiquetas"
              cifras={cifrasDeDatos({
                listo: !loading && !error,
                incluidas: conteo.incluidas,
                excluidas: conteo.excluidas,
                enlaceExcluidas: (
                  <Link
                    to={{ pathname: location.pathname, search: searchConPanel(location.search, PANEL_VARIABLES_EXCLUIDAS) }}
                    replace
                    className="pulso-excluidas-enlace"
                    aria-haspopup="dialog"
                    aria-label={`${formatoConteo(conteo.excluidas)} ${conteo.excluidas === 1 ? "variable excluida" : "variables excluidas"}: ver y editar`}
                    title="Ver y editar las variables que no salen en los entregables"
                  >
                    {formatoConteo(conteo.excluidas)}
                  </Link>
                ),
                renombradas: editedCount,
                sinConfirmar: draftStatus.pendingCount,
                vacias: draftStatus.pendingCount > 0 ? draftStatus.emptyCount : 0,
              })}
            />
            <PulsoButton
              variant="primary"
              onClick={confirmDraftLabels}
              disabled={loading || draftStatus.pendingCount === 0}
              title={draftStatus.pendingCount === 0 ? "No hay etiquetas por confirmar. La inclusión de variables se guarda sola." : "Validar y guardar las etiquetas editadas."}
            >
              <CheckCircle2 size={13} aria-hidden="true" />
              Confirmar etiquetas
            </PulsoButton>
            <PulsoButton
              variant="secondary"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? "pulso-spin" : ""} aria-hidden="true" />
              Actualizar
            </PulsoButton>
          </div>
        </div>

        {loading ? <LoadingBlock minHeight={280} label="Cargando revisión de datos…" /> : null}
        {error ? <ErrorBlock label="No se pudo cargar la revisión" detail={error} /> : null}
        {deteccion.estado === "error" && !deteccion.silenciosa ? (
          <ErrorBlock label="No se pudo detectar la estructura" detail={deteccion.mensaje} />
        ) : null}
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
                  {formatoConteo(groups.length)} {groups.length === 1 ? "sección" : "secciones"} · {formatoConteo(variables.length)} {variables.length === 1 ? "variable" : "variables"}
                </span>
                {/* La lectura automática se anuncia aquí, discreta, y no
                    bloquea el botón. Si falla o vence el plazo, lo dice. */}
                {deteccion.estado === "leyendo" && deteccion.silenciosa ? (
                  <span className="pulso-data-review-structure-reading" role="status">
                    <RefreshCw size={11} className="pulso-spin" aria-hidden="true" />
                    Leyendo estructura
                  </span>
                ) : null}
                {deteccion.estado === "error" && deteccion.silenciosa ? (
                  <span className="pulso-data-review-structure-reading is-error" role="status" title={deteccion.mensaje}>
                    Estructura sin leer
                  </span>
                ) : null}
                <PulsoButton
                  variant="secondary"
                  size="sm"
                  onClick={() => void detectSections()}
                  disabled={deteccion.estado === "leyendo" && !deteccion.silenciosa}
                  aria-busy={deteccion.estado === "leyendo" && !deteccion.silenciosa}
                  title="Vuelve a leer la estructura del instrumento y conserva los renombres manuales cuando sea posible."
                >
                  {deteccion.estado === "leyendo" && !deteccion.silenciosa
                    ? <RefreshCw size={12} className="pulso-spin" aria-hidden="true" />
                    : <FolderSearch size={12} aria-hidden="true" />}
                  Detectar estructura
                </PulsoButton>
              </div>
            </div>
            {variables.length === 0 ? (
              <EstadoVacio
                icono={<Database size={15} />}
                titulo="No hay variables para revisar"
                descripcion="Verifica la fuente activa en Carga o vuelve a preparar Analítica."
              />
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
                  onRenameSection={(id, name) => {
                    materializarSecciones();
                    renameSeccion(id, name);
                  }}
                  onToggleSectionHidden={(id, names, hide) => {
                    materializarSecciones();
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
                {textoPlano(group.name)}
              </button>
            )}
            {group.manual ? <span className="pulso-data-review-pill">editada</span> : null}
            {group.synthetic ? <span className="pulso-data-review-pill">sin secciones del formulario</span> : null}
          </div>
          <div className="pulso-data-review-section-meta">
            {formatoConteo(includedInSection)}/{formatoConteo(group.variables.length)} incluidas · {group.hidden ? "sección oculta en agrupadores" : "sección visible en agrupadores"}
          </div>
        </div>

        <div className="pulso-data-review-section-actions">
          <PulsoButton
            variant="secondary"
            size="sm"
            onClick={() => onSetSectionIncluded(variableNames, !allIncluded)}
            disabled={group.variables.length === 0}
            aria-label={`${allIncluded ? "Excluir variables" : "Incluir variables"} de ${textoPlano(group.name)}`}
          >
            {allIncluded ? <EyeOff size={12} aria-hidden="true" /> : <Eye size={12} aria-hidden="true" />}
            {allIncluded ? "Excluir variables" : "Incluir variables"}
          </PulsoButton>
          {!group.synthetic ? (
            <PulsoButton
              variant="ghost"
              size="sm"
              onClick={() => onToggleSectionHidden(group.id, variableNames, !group.hidden)}
              aria-label={`${group.hidden ? "Mostrar sección" : "Ocultar sección"} ${textoPlano(group.name)}`}
            >
              {group.hidden ? "Mostrar sección" : "Ocultar sección"}
            </PulsoButton>
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
          // G18: detalles de redacción de las opciones, contados también con el panel cerrado para que no se escondan.
          const etiquetaOpcion = (option: (typeof variable.opciones)[number]) =>
            draftValueLabels[variable.name]?.[option.code] ?? dataReviewEffectiveOptionLabel(option);
          const equivalentes = canEditOptions
            ? opcionesEquivalentes(variable.opciones.map((o) => ({ code: o.code, label: etiquetaOpcion(o) })))
            : new Map<string, ProblemaEtiqueta>();
          const conDetalles = canEditOptions
            ? variable.opciones.filter((o) => problemasDeEtiqueta(etiquetaOpcion(o), { esOpcion: true }).length > 0 || equivalentes.has(o.code)).length
            : 0;
          return (
            <div
              key={variable.name}
              className={`pulso-data-review-card${included ? "" : " is-excluded"}${variableLocked ? " is-section-hidden" : ""}`}
            >
              <div className="pulso-data-review-row">
                <label className="pulso-data-review-include">
                  <span>{variableLocked ? "Oculta" : "Incluir"}</span>
                  <Switch
                    checked={variableLocked ? false : included}
                    disabled={variableLocked}
                    ariaLabel={`Incluir ${variable.name}`}
                    className="analitica-interruptor"
                    onToggle={() => onToggleVariable(variable.name)}
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
                  <AvisosEtiqueta problemas={problemasDeEtiqueta(draftLabel)} onAplicar={(t) => onSetVariableLabel(variable.name, t)} />
                </label>
                {/* «Restaurar» solo cuando hay algo que restaurar: un botón
                    deshabilitado repetido en cada fila era ruido (P-M2). El
                    hueco conserva el ancho para que la etiqueta no salte. */}
                <span className="pulso-data-review-restore-slot">
                  {hasEdits ? (
                    <PulsoButton
                      variant="ghost"
                      size="sm"
                      onClick={() => onResetVariable(variable.name)}
                      aria-label={`Restaurar etiquetas originales de ${variable.name}`}
                      title="Restaurar las etiquetas originales de esta variable"
                    >
                      <RotateCcw size={12} aria-hidden="true" />
                      Restaurar
                    </PulsoButton>
                  ) : null}
                </span>
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
                      {formatoConteo(variable.opciones.length)} código{variable.opciones.length === 1 ? "" : "s"}
                      {conDetalles > 0 ? ` · ${formatoConteo(conDetalles)} con detalles de redacción` : ""}
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
                          const optionDraft = etiquetaOpcion(option);
                          const avisos = [...problemasDeEtiqueta(optionDraft, { esOpcion: true }), ...(equivalentes.get(option.code) ? [equivalentes.get(option.code)!] : [])];
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
                                n={formatoConteo(option.count)}
                              </span>
                              <AvisosEtiqueta problemas={avisos} onAplicar={(t) => onSetValueLabel(variable.name, option.code, t)} />
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

/**
 * Cifras de la pestaña Datos con la primitiva común (P-M1). Las etiquetas
 * renombradas ya están guardadas en la config: se dice así para que no
 * contradigan al botón «Confirmar etiquetas» deshabilitado (P-M11).
 */
function cifrasDeDatos({
  listo,
  incluidas,
  excluidas,
  enlaceExcluidas,
  renombradas,
  sinConfirmar,
  vacias,
}: {
  listo: boolean;
  incluidas: number;
  excluidas: number;
  enlaceExcluidas: JSX.Element;
  renombradas: number;
  sinConfirmar: number;
  vacias: number;
}): CifraPestana[] {
  const cifras: CifraPestana[] = [];
  if (listo) {
    cifras.push({ clave: "incluidas", etiqueta: "Incluidas", valor: formatoConteo(incluidas) });
    cifras.push({ clave: "excluidas", etiqueta: "Excluidas", valor: enlaceExcluidas, titulo: excluidas ? undefined : "Ninguna variable excluida" });
  }
  if (renombradas > 0) {
    cifras.push({
      clave: "renombradas",
      etiqueta: "Etiquetas",
      valor: `${formatoConteo(renombradas)} ${renombradas === 1 ? "renombrada (guardada)" : "renombradas (guardadas)"}`,
    });
  }
  if (sinConfirmar > 0) {
    cifras.push({ clave: "sin-confirmar", etiqueta: "Sin confirmar", valor: formatoConteo(sinConfirmar), tono: "alerta" });
  }
  if (vacias > 0) {
    cifras.push({ clave: "vacias", etiqueta: "Vacías", valor: formatoConteo(vacias), tono: "peligro" });
  }
  return cifras;
}
