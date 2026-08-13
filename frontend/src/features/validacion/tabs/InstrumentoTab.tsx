import { useEffect, useState, useCallback, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  ListTree,
  Play,
  RefreshCcw,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import {
  apiUpload,
  apiV2InstrumentoAuditoria,
  apiV2InstrumentoBuildPlan,
  apiV2InstrumentoDrill,
  apiV2InstrumentoEstado,
  apiV2InstrumentoExportPlan,
  apiV2InstrumentoImportPlan,
  apiV2MethodologyReportBundle,
  apiV2InstrumentoReglaToggleActiva,
  apiV2InstrumentoResultado,
  apiV2InstrumentoVariablesExcluidas,
  apiV2InstrumentoVariablesExcluidasSave,
  downloadUrl,
  jobResultUrl,
  type InstrumentoDrillResult,
  type InstrumentoResultado,
} from "../../../api/client";
import type {
  InstrumentoEstado,
  InstrumentoOperationalConfig,
  InstrumentoVariablesExcluidas,
} from "../types";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
} from "../../../components/States";
import { JobProgress } from "../../../components/JobProgress";
import { relationalBaseKey, useValidacionStore } from "../store";
import PlotlyView from "../components/PlotlyView";
import ReglaDrillPanel from "../components/ReglaDrillPanel";
import RuleDetailPanel, { type RuleDetailInput } from "../components/RuleDetailPanel";
import { ContextLens, RuleNarrative } from "../components/v2";
import type { ReglaLike, VariableHoverData } from "../components/v2";
import RelationalRuleFamily, {
  type RelationalRuleView,
} from "../components/RelationalRuleFamily";
import {
  buildRelationalMetaMap,
  normalizeRelationalSummary,
  relationalKindCopy,
  relRecord,
  relStr,
  relStrList,
  resolveRelationalInfo,
  type RelationalRuleInfo,
  type RelationalRowSignals,
  type RelationalSummary,
} from "../relationalPlan";
import InstrumentoOperationalControls from "../components/InstrumentoOperationalControls";
import RolesDeclarados from "../components/RolesDeclarados";
import {
  defaultOperationalConfig,
  hasOperationalConfigChanges,
  isOperationalConfigValid,
  normalizeOperationalConfig,
  validateOperationalConfig,
} from "../operationalControlsModel";

// =============================================================================
// InstrumentoTab — Sprint 2
// =============================================================================
// 3 pasos secuenciales:
//  1) Construir plan desde XLSForm (con include flags por defecto).
//  2) Ejecutar auditoría (async job).
//  3) Ver dashboard: KPIs + top reglas + heatmap + drill por regla.
//
// El deep-link desde Limpieza (prefill.instrumento.id_regla) se consume
// al montar el tab: abre el drill de esa regla automáticamente.

export default function InstrumentoTab() {
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);
  const prefillInstr = useValidacionStore((s) => s.prefill.instrumento);
  const clearPrefill = useValidacionStore((s) => s.clearPrefill);
  const setRelationalPlan = useValidacionStore((s) => s.setRelationalPlan);
  const relationalCapture = useValidacionStore(
    (s) => s.relationalPlan[relationalBaseKey(s.baseNombre)],
  );

  const [estado, setEstado] = useState<InstrumentoEstado | null>(null);
  const [resultado, setResultado] = useState<InstrumentoResultado | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [methodologyPackageJobId, setMethodologyPackageJobId] = useState<string | null>(null);
  const [methodologyPackageReadyJobId, setMethodologyPackageReadyJobId] = useState<string | null>(null);
  const [exportFileId, setExportFileId] = useState<string | null>(null);
  const [drill, setDrill] = useState<InstrumentoDrillResult | null>(null);
  const [reglaDirty, setReglaDirty] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<string>("");
  // Regla cuyo panel de detalle (descripción + diagrama de flujo) está abierto.
  // Es distinto de `selectedRuleId` (que puede quedar en la primera regla por
  // defecto): sólo se setea al hacer click y gobierna la apertura del ContextLens.
  const [detailRuleId, setDetailRuleId] = useState<string>("");
  const [variablesExcluidas, setVariablesExcluidas] = useState<InstrumentoVariablesExcluidas | null>(null);
  const [variableQuery, setVariableQuery] = useState("");
  const [operationalConfig, setOperationalConfig] = useState<InstrumentoOperationalConfig>(
    () => defaultOperationalConfig(),
  );
  const [appliedOperationalConfig, setAppliedOperationalConfig] = useState<InstrumentoOperationalConfig>(
    () => defaultOperationalConfig(),
  );
  const refetchSequence = useRef(0);

  // Carga inicial + refetch al cambiar base.
  const refetchAll = useCallback(async () => {
    const requestId = ++refetchSequence.current;
    setLoading(true);
    setError("");
    try {
      const e = await apiV2InstrumentoEstado(baseNombre);
      if (requestId !== refetchSequence.current) return;
      setEstado(e);
      const nextOperationalConfig = normalizeOperationalConfig(e.operational_config);
      setOperationalConfig(nextOperationalConfig);
      setAppliedOperationalConfig(nextOperationalConfig);
      const vars = await apiV2InstrumentoVariablesExcluidas(baseNombre);
      if (requestId !== refetchSequence.current) return;
      setVariablesExcluidas(vars);
      if (e.auditoria_corrida) {
        const r = await apiV2InstrumentoResultado(baseNombre);
        if (requestId !== refetchSequence.current) return;
        setResultado(r);
      } else {
        setResultado(null);
      }
    } catch (err) {
      if (requestId === refetchSequence.current) setError((err as Error).message);
    } finally {
      if (requestId === refetchSequence.current) setLoading(false);
    }
  }, [baseNombre]);

  useEffect(() => {
    void refetchAll();
    // Reset local state al cambiar de base.
    setExportFileId(null);
    setDrill(null);
    setDetailRuleId("");
    setJobId(null);
    setMethodologyPackageJobId(null);
    setMethodologyPackageReadyJobId(null);
    setVariableQuery("");
    setOperationalConfig(defaultOperationalConfig());
    setAppliedOperationalConfig(defaultOperationalConfig());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseNombre, version]);

  // Consumir prefill de deep-link: si viene id_regla, auto-abrir drill.
  useEffect(() => {
    if (prefillInstr?.id_regla && resultado) {
      onSelectRule(prefillInstr.id_regla);
      clearPrefill("instrumento");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillInstr, resultado]);

  useEffect(() => {
    if (!resultado?.resumen_tabla?.length) {
      setSelectedRuleId("");
      return;
    }
    if (!selectedRuleId) {
      const firstId = resultado.resumen_tabla[0]?.id_regla;
      if (typeof firstId === "string") setSelectedRuleId(firstId);
      return;
    }
    const exists = resultado.resumen_tabla.some((row) => row.id_regla === selectedRuleId);
    if (!exists) {
      const firstId = resultado.resumen_tabla[0]?.id_regla;
      setSelectedRuleId(typeof firstId === "string" ? firstId : "");
    }
  }, [resultado, selectedRuleId]);

  async function onBuildPlan() {
    const configErrors = validateOperationalConfig(operationalConfig);
    if (Object.keys(configErrors).length > 0) {
      setError("Completa los controles operativos activos antes de construir el plan.");
      return;
    }
    setBusy("Construyendo plan desde el XLSForm…");
    setError("");
    try {
      const plan = await apiV2InstrumentoBuildPlan(baseNombre, undefined, operationalConfig);
      // Capturamos el surfacing relacional: el resultado de auditoría no trae
      // estos flags, así que los cacheamos por base para el panel naranja.
      setRelationalPlan(baseNombre, {
        summary: normalizeRelationalSummary(plan.relational_summary),
        metaById: Object.fromEntries(buildRelationalMetaMap(plan.plan_preview)),
      });
      await refetchAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function onExport() {
    setBusy("Exportando plan a Excel…");
    setError("");
    try {
      const out = await apiV2InstrumentoExportPlan(baseNombre);
      setExportFileId(out.file_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function onMethodologyPackage() {
    setError("");
    setMethodologyPackageReadyJobId(null);
    try {
      const out = await apiV2MethodologyReportBundle(baseNombre);
      setMethodologyPackageJobId(out.job_id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onImport(file: File) {
    setBusy(`Importando ${file.name}…`);
    setError("");
    try {
      const up = await apiUpload(file, "plan_limpieza");
      await apiV2InstrumentoImportPlan(up.file_id, baseNombre);
      await refetchAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function onAudit() {
    setError("");
    setDrill(null);
    setResultado(null);
    try {
      const out = await apiV2InstrumentoAuditoria(baseNombre);
      setJobId(out.job_id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onAuditDone() {
    setJobId(null);
    await refetchAll();
  }

  async function onToggleVariableExcluida(variable: string, checked: boolean) {
    const current = variablesExcluidas?.variables ?? estado?.variables_excluidas ?? [];
    const next = checked
      ? uniqueStrings([...current, variable])
      : current.filter((item) => item !== variable);
    setBusy(checked ? "Excluyendo variable…" : "Reactivando variable…");
    setError("");
    try {
      const saved = await apiV2InstrumentoVariablesExcluidasSave(next, baseNombre);
      setVariablesExcluidas(saved);
      const e = await apiV2InstrumentoEstado(baseNombre);
      setEstado(e);
      setResultado(null);
      setDrill(null);
      setReglaDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function loadDrill(id: string) {
    setBusy(`Cargando casos de ${id}…`);
    setError("");
    try {
      const out = await apiV2InstrumentoDrill(id, baseNombre);
      return out;
    } finally {
      setBusy("");
    }
  }

  async function openDrill(id: string) {
    try {
      const out = await loadDrill(id);
      setDrill(out);
      setSelectedRuleId(id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function closeDrill() {
    setDrill(null);
    setReglaDirty(false);
  }

  // Click en CUALQUIER tarjeta de regla: abre el panel de detalle (descripción +
  // diagrama de flujo). Si la regla tiene casos, además carga el drill con la
  // tabla de casos debajo; si no, sólo se muestra la explicación (funciona para
  // reglas no evaluadas / no aplicables / pull-data sin depender del drill).
  function onSelectRule(id: string) {
    setSelectedRuleId(id);
    setDetailRuleId(id);
    const row = compactRules.find((r) => r.id === id);
    if (row && (row.nInconsistencias ?? 0) > 0) {
      void openDrill(id);
    } else {
      setDrill(null);
    }
  }

  function closeDetail() {
    setDetailRuleId("");
    setDrill(null);
    setReglaDirty(false);
  }

  async function onToggleReglaActiva(activa: boolean, ruleId?: string) {
    const id = ruleId ?? drill?.regla.id;
    if (!id) return;
    setBusy(activa ? "Reactivando regla…" : "Ignorando regla…");
    try {
      await apiV2InstrumentoReglaToggleActiva(id, activa, baseNombre);
      if (drill && drill.regla.id === id) {
        setDrill({ ...drill, regla: { ...drill.regla, activa } });
      }
      setReglaDirty(true);
      // El estado de auditoría se invalidó en el backend; refetch del estado.
      const e = await apiV2InstrumentoEstado(baseNombre);
      setEstado(e);
      setResultado(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const relationalMetaById = relationalCapture?.metaById ?? null;
  const relationalSummary = relationalCapture?.summary ?? null;
  const operationalDirty = hasOperationalConfigChanges(operationalConfig, appliedOperationalConfig);
  const operationalValid = isOperationalConfigValid(operationalConfig);

  const compactRules = useMemo(
    () => {
      const baseRows =
        resultado?.resumen_tabla
          .map(normalizeCompactRuleRow)
          .filter((row): row is CompactRuleRow => row !== null) ?? [];
      const duplicateCounts = new Map<string, number>();
      for (const row of baseRows) {
        const key = row.nombre.trim().toLowerCase();
        duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
      }
      return baseRows.map((row) => {
        const key = row.nombre.trim().toLowerCase();
        const planMeta = relationalMetaById ? relationalMetaById[row.id] ?? null : null;
        return {
          ...row,
          displayName: buildDisplayRuleName(row.nombre, row.variables[0]?.key ?? null, (duplicateCounts.get(key) ?? 0) > 1),
          // Re-resuelve con la metadata autoritativa del plan (si se capturó).
          relationalInfo: resolveRelationalInfo(relationalSignalsFromRow(row), planMeta),
        };
      });
    },
    [resultado, relationalMetaById],
  );

  // Separamos las reglas por estado para que el usuario distinga visualmente:
  //   - "con casos" (estado correcta + n>0): donde hay trabajo real para hacer.
  //   - "no aplicables" (estado no_aplicable, típicamente issue=missing_columns):
  //     la columna del XLSForm no existe en la data — ej. select_multiple
  //     desplegado en columnas dummy q0007_0001..0007.
  //   - "no evaluadas" (estado no_evaluada, issue=odk_raw o missing_collection_date):
  //     la regla quedó en modo experto o falta info para correrla.
  // Antes todas iban a un solo panel "Explorar reglas con casos" y las que
  // no aplicaban aparecían como "0 casos · 0.0%" indistinguibles de las
  // reglas evaluadas con éxito sin inconsistencias.
  const rulesByGroup = useMemo(() => {
    const relacionales: typeof compactRules = [];
    const conCasos: typeof compactRules = [];
    const desalineadas: typeof compactRules = [];
    const noAplicables: typeof compactRules = [];
    const noEvaluadas: typeof compactRules = [];
    const pullData: typeof compactRules = [];
    const okSinCasos: typeof compactRules = [];
    for (const row of compactRules) {
      // La familia relacional se presenta como UN instrumento con base
      // relacionada: sacamos esas reglas de los buckets por-estado y las
      // agrupamos en su panel naranja, sin importar si aplican ahora mismo.
      if (row.relationalInfo.relational) {
        relacionales.push(row);
        continue;
      }
      if (row.estadoDinamico === "desalineada") {
        // Regla desalineada con los datos: compara una columna contra un valor
        // que no existe en la base (p.ej. consent=='OK' sobre datos 1/0), señal
        // de desfase entre la versión del instrumento y los datos. No se cuenta
        // como inconsistencia — se muestra como alerta accionable arriba.
        desalineadas.push(row);
      } else if ((row.nInconsistencias ?? 0) > 0) {
        conCasos.push(row);
      } else if (row.estadoDinamico === "no_aplicable") {
        noAplicables.push(row);
      } else if (isPullDataRow(row)) {
        // Campo `calculate` que se pre-llena desde un listado externo vía
        // pulldata (p.ej. sede_ppl/date_ppl del PDM contra `listadoedp`). NO es
        // "modo experto" (sintaxis no soportada): es un campo que depende de un
        // dato externo y es inherentemente no revisable sin ese listado. Va a su
        // propio grupo para no inflar el conteo de reglas a revisar.
        pullData.push(row);
      } else if (row.estadoDinamico === "no_evaluada" || row.estadoDinamico === "incorrecta_ejecucion") {
        noEvaluadas.push(row);
      } else {
        // Estado correcta + 0 inconsistencias: la validación corrió y pasó
        // limpio (p.ej. los cálculos p_space). Van a su propia sección colapsable
        // al final, para poder abrir su diagrama sin inflar la lista de trabajo.
        okSinCasos.push(row);
      }
    }
    return { relacionales, conCasos, desalineadas, noAplicables, noEvaluadas, pullData, okSinCasos };
  }, [compactRules]);

  // Vista mínima de las reglas relacionales para el panel naranja.
  const relationalRows = useMemo<RelationalRuleView[]>(
    () =>
      rulesByGroup.relacionales.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        nInconsistencias: row.nInconsistencias,
        porcentaje: row.porcentaje,
        info: row.relationalInfo,
      })),
    [rulesByGroup.relacionales],
  );

  const activeDisplayName = useMemo(() => {
    if (!drill) return null;
    const fromList = compactRules.find((row) => row.id === drill.regla.id)?.displayName;
    return fromList ?? buildDisplayRuleName(drill.regla.nombre, getTargetVariableKey(drill.regla.variables), true);
  }, [compactRules, drill]);

  // Fila de la regla cuyo panel de detalle está abierto (por click).
  const detailRow = useMemo(
    () => (detailRuleId ? compactRules.find((row) => row.id === detailRuleId) ?? null : null),
    [compactRules, detailRuleId],
  );
  const detailTitle = detailRow
    ? detailRow.presentation?.nombre_humano ?? detailRow.displayName
    : null;

  const excludedVariableSet = useMemo(
    () => new Set(variablesExcluidas?.variables ?? estado?.variables_excluidas ?? []),
    [estado?.variables_excluidas, variablesExcluidas?.variables],
  );
  const variableExclusionOptions = useMemo(() => {
    const query = normalizeSearchText(variableQuery);
    const options = variablesExcluidas?.opciones ?? [];
    return [...options]
      .filter((option) => {
        if (!query) return true;
        return normalizeSearchText(`${option.variable} ${option.label}`).includes(query);
      })
      .sort((a, b) => {
        const aSelected = excludedVariableSet.has(a.variable) ? 1 : 0;
        const bSelected = excludedVariableSet.has(b.variable) ? 1 : 0;
        if (aSelected !== bSelected) return bSelected - aSelected;
        const diff = (b.n_inconsistencias ?? 0) - (a.n_inconsistencias ?? 0);
        if (diff !== 0) return diff;
        return a.variable.localeCompare(b.variable);
      });
  }, [excludedVariableSet, variableQuery, variablesExcluidas?.opciones]);

  if (loading) return <LoadingBlock label="Cargando estado…" />;
  if (!estado) {
    return (
      <EmptyState
        icon={<AlertTriangle size={20} />}
        title="Sin estado"
        hint="Carga una base primero."
      />
    );
  }

  const panelContent = (
    <>
      {/* --- Paso 1: Construir plan --- */}
      <section
        className={`pulso-instrumento-step pulso-instrumento-step--plan${estado.plan_construido ? "" : " is-setup"}`}
      >
        <StepHeader
          idx={1}
          title="Plan de reglas"
          subtitle={
            <>
              Obligatorias, saltos, rangos, cálculos y filtros declarados en el formulario{" "}
              <span className="pulso-vv2-tech">XLSForm</span>.
            </>
          }
          done={estado.plan_construido}
          count={estado.plan_construido ? estado.n_reglas : null}
          countLabel="reglas"
        />
        {!estado.plan_construido && (
          <div className="pulso-instrumento-setup-grid" aria-label="Secuencia de validación del instrumento">
            <div className="pulso-instrumento-setup-card is-active">
              <span>1</span>
              <strong>Leer XLSForm</strong>
              <small>Detecta preguntas obligatorias, saltos, rangos, cálculos y filtros.</small>
            </div>
            <div className="pulso-instrumento-setup-card">
              <span>2</span>
              <strong>Preparar auditoría</strong>
              <small>Genera un plan editable antes de tocar los datos.</small>
            </div>
            <div className="pulso-instrumento-setup-card">
              <span>3</span>
              <strong>Revisar casos</strong>
              <small>Ejecuta reglas, abre drill-downs y decide limpieza.</small>
            </div>
          </div>
        )}
        <InstrumentoOperationalControls
          baseNombre={baseNombre}
          value={operationalConfig}
          upstreamUniverse={estado.upstream_universe}
          dirty={operationalDirty}
          disabled={!!busy || !!jobId}
          onChange={setOperationalConfig}
        />
        {/* Los roles del estudio viven junto a los controles operativos porque
            comparten destino —`operational_config`— y el mismo botón de aplicar:
            declarar un rol sin reconstruir el plan no cambiaría nada. */}
        <RolesDeclarados
          baseNombre={baseNombre}
          value={operationalConfig}
          disabled={!!busy || !!jobId}
          onChange={setOperationalConfig}
        />
        <div className="pulso-instrumento-action-row">
          <button
            type="button"
            className="pulso-primary pulso-instrumento-action"
            onClick={() => void onBuildPlan()}
            disabled={!!busy || !!jobId || !operationalValid}
          >
            {estado.plan_construido ? <RefreshCcw size={12} /> : <ListTree size={12} />}
            {estado.plan_construido && operationalDirty
              ? "Aplicar y reconstruir plan"
              : estado.plan_construido
                ? "Reconstruir plan"
                : "Construir plan"}
          </button>
          {estado.plan_construido && (
            <>
              <button
                type="button"
                onClick={() => void onExport()}
                disabled={!!busy || !!methodologyPackageJobId}
                className="pulso-instrumento-action"
              >
                <Download size={12} /> Exportar a Excel
              </button>
              <button
                type="button"
                onClick={() => void onMethodologyPackage()}
                disabled={!!busy || !!jobId || !!methodologyPackageJobId}
                className="pulso-instrumento-action"
              >
                <FileText size={12} /> Paquete metodológico PDF + R
              </button>
              <label
                className={`pulso-instrumento-action pulso-instrumento-file-action${busy ? " is-busy" : ""}`}
              >
                <Upload size={12} /> Importar plan editado
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onImport(f);
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                />
              </label>
            </>
          )}
        </div>
        {exportFileId && (
          <div
            className="pulso-instrumento-export-note"
          >
            Plan exportado.{" "}
            <a
              href={downloadUrl(exportFileId)}
              style={{ color: "var(--pulso-primary)", fontWeight: 600 }}
            >
              Descargar →
            </a>
          </div>
        )}
        <JobProgress
          label="Generando paquete metodológico"
          jobId={methodologyPackageJobId}
          onDone={() => {
            setMethodologyPackageReadyJobId(methodologyPackageJobId);
            setMethodologyPackageJobId(null);
          }}
          onError={(message) => {
            setMethodologyPackageJobId(null);
            setError(message);
          }}
          onCancelled={() => setMethodologyPackageJobId(null)}
        />
        {methodologyPackageReadyJobId && (
          <div className="pulso-instrumento-export-note">
            Paquete listo. Incluye el reporte PDF y el script R derivados del mismo inventario metodológico.{" "}
            <a
              href={jobResultUrl(methodologyPackageReadyJobId)}
              style={{ color: "var(--pulso-primary)", fontWeight: 600 }}
            >
              Descargar paquete ZIP →
            </a>
          </div>
        )}
      </section>

      {/* --- Paso 2: Ejecutar auditoría --- */}
      {estado.plan_construido && (
        <section
          style={{
            padding: "18px 20px",
            borderRadius: 12,
            background: "white",
            border: "1px solid var(--pulso-border)",
            boxShadow: "var(--pulso-shadow-low)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <StepHeader
            idx={2}
            title="Auditoría"
            subtitle="Corre el plan contra la data y encuentra casos inconsistentes."
            done={estado.auditoria_corrida}
          />
          <VariableExclusionsPanel
            options={variableExclusionOptions}
            excluded={excludedVariableSet}
            query={variableQuery}
            onQuery={setVariableQuery}
            onToggle={(variable, checked) => void onToggleVariableExcluida(variable, checked)}
            disabled={!!busy || !!jobId}
          />
          <div>
            <button
              type="button"
              className="pulso-primary"
              onClick={() => void onAudit()}
              disabled={!!busy || !!jobId || operationalDirty}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                padding: "8px 14px",
              }}
            >
              <Play size={12} />
              {estado.auditoria_corrida ? "Ejecutar de nuevo" : "Ejecutar auditoría"}
            </button>
            {operationalDirty && (
              <div className="pulso-operational-inline-note" style={{ marginTop: 7 }}>
                Aplica y reconstruye el plan antes de ejecutar la auditoría con estos controles.
              </div>
            )}
          </div>
          {jobId && (
            <JobProgress
              label="Auditando data"
              jobId={jobId}
              onDone={() => void onAuditDone()}
              onError={(msg) => {
                setError(msg);
                setJobId(null);
              }}
              onCancelled={() => setJobId(null)}
            />
          )}
        </section>
      )}

      {/* --- Paso 3: Dashboard de resultado --- */}
      {estado.auditoria_corrida && resultado && (
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <StepHeader idx={3} title="Resultados" done={true} />

          {/* KPIs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            {resultado.kpis.map((k, i) => (
              <PlotlyView key={i} view={k} />
            ))}
          </div>

          {/* Top reglas + heatmap lado a lado en pantallas grandes */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
              gap: 16,
              minWidth: 0,
            }}
          >
            <PlotlyView view={resultado.top_reglas} height={560} />
            <PlotlyView view={resultado.heatmap} height={560} />
          </div>

          <RuleGroupsSection
            groups={rulesByGroup}
            relationalSummary={relationalSummary}
            relationalRows={relationalRows}
            selectedRuleId={selectedRuleId}
            onSelect={onSelectRule}
          />
        </section>
      )}

      <ContextLens
        open={!!detailRuleId}
        onClose={closeDetail}
        variant="wide"
        title={detailTitle ?? "Detalle de regla"}
        subtitle={detailRow?.seccion ?? undefined}
      >
        {detailRow ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {/* Explicación de la validación + diagrama de flujo (nuevo). */}
            <RuleDetailPanel input={buildRuleDetailInput(detailRow)} />

            {/* Si la regla tiene casos, la tabla de drill vive debajo. En vista
                panorama (Instrumento) no se ignora reglas —esa acción vive en
                Limpieza—, así que ocultamos ese botón y el "Cerrar" interno
                (el ContextLens ya tiene su X en el header). */}
            {drill ? (
              <div
                style={{
                  borderTop: "1px solid var(--pulso-border)",
                  paddingTop: 18,
                }}
              >
                <ReglaDrillPanel
                  regla={drill.regla}
                  displayName={activeDisplayName ?? undefined}
                  casos={drill.casos}
                  uuidCol={drill.uuid_col}
                  onToggleActiva={onToggleReglaActiva}
                  onClose={closeDetail}
                  invalidatedHint={
                    reglaDirty
                      ? "Cambios aplicados. Vuelve a ejecutar la auditoría para actualizar KPIs y heatmap con el plan corregido."
                      : undefined
                  }
                  surface="bubble"
                  showToggleActiva={false}
                  showClose={false}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </ContextLens>

      {busy && (
        <div style={{ marginTop: 4 }}>
          <LoadingBlock variant="inline" label={busy} />
        </div>
      )}
      {error && <ErrorBlock label="Error" detail={error} />}
    </>
  );

  if (error) {
    return <div className="pulso-instrumento-workbench">{panelContent}</div>;
  }

  return (
    <div className="pulso-instrumento-workbench" data-audit-ready="validacion-instrumento">
      {panelContent}
    </div>
  );
}

// -----------------------------------------------------------------------------
type CompactRuleRowBase = {
  id: string;
  nombre: string;
  displayName: string;
  tipo: string | null;
  seccion: string | null;
  porcentaje: number | null;
  nInconsistencias: number | null;
  variables: Array<{ key: string; label: string | null }>;
  estadoDinamico: string | null;
  issueCode: string | null;
  detalle: string | null;
  // Señales relacionales (Fase 4): derivadas del resumen para clasificar la
  // familia "coherencia relacional del repeat" sin depender del plan_preview.
  tipoRegla: string | null;
  rosterSubtype: string | null;
  categoriaUx: string | null;
  tabla: string | null;
  targetVar: string | null;
  // Narrativa enriquecida (para el panel de detalle + diagrama de flujo).
  presentation: ReglaLike["presentation"];
  variableRoles: ReglaLike["variable_roles"];
};

type CompactRuleRow = CompactRuleRowBase & {
  relationalInfo: RelationalRuleInfo;
};

// Un `calculate` que jala su valor de un listado externo vía `pulldata()` no es
// una regla de validación ni "modo experto": es un campo pre-llenado desde un
// roster externo, no revisable sin ese dato. El backend ya lo marca con
// `categoria_ux="roster_externo"` / issue_code `requires_external_dataset`; aquí
// lo detectamos para darle su propio grupo y etiqueta ("Campo pull data").
function isPullDataRow(row: CompactRuleRow): boolean {
  return (
    row.issueCode === "requires_external_dataset" ||
    row.categoriaUx === "roster_externo" ||
    row.relationalInfo.requiresExternalDataset === true
  );
}

// Señales de una fila (compacta) para clasificarla relacionalmente.
function relationalSignalsFromRow(row: CompactRuleRowBase): RelationalRowSignals {
  return {
    tipoRegla: row.tipoRegla,
    rosterSubtype: row.rosterSubtype,
    categoriaUx: row.categoriaUx,
    tabla: row.tabla,
    issueCode: row.issueCode,
    targetVar: row.targetVar,
    variables: row.variables.map((v) => v.key),
  };
}

function VariableExclusionsPanel({
  options,
  excluded,
  query,
  onQuery,
  onToggle,
  disabled = false,
}: {
  options: InstrumentoVariablesExcluidas["opciones"];
  excluded: Set<string>;
  query: string;
  onQuery: (value: string) => void;
  onToggle: (variable: string, checked: boolean) => void;
  disabled?: boolean;
}) {
  const selectedCount = excluded.size;
  const totalCases = options.reduce((sum, option) => sum + (option.n_inconsistencias ?? 0), 0);
  return (
    <div
      style={{
        border: "1px solid var(--pulso-border)",
        borderRadius: 10,
        background: "var(--pulso-surface-2)",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              background: "var(--pulso-primary-soft)",
              color: "var(--pulso-primary)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <SlidersHorizontal size={14} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pulso-text)" }}>
              Variables fuera de auditoría
            </div>
            <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.45, marginTop: 2 }}>
              Filtra reglas cuyo objetivo sea una variable marcada. La data no se modifica.
            </div>
          </div>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            justifyContent: "flex-end",
            fontSize: 11,
            color: "var(--pulso-text-soft)",
          }}
        >
          <span style={variableExclusionBadgeStyle("var(--pulso-primary-soft)", "var(--pulso-primary)")}>
            {selectedCount} excluidas
          </span>
          <span style={variableExclusionBadgeStyle("white", "var(--pulso-text-soft)")}>
            {options.length} visibles
          </span>
          {totalCases > 0 && (
            <span style={variableExclusionBadgeStyle("var(--pulso-warn-bg)", "var(--pulso-warn-fg)")}>
              {formatCompactNumber(totalCases)} casos
            </span>
          )}
        </div>
      </div>
      <input
        type="search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Buscar variable..."
        disabled={disabled}
        style={{
          width: "100%",
          minHeight: 32,
          border: "1px solid var(--pulso-border)",
          borderRadius: 8,
          background: disabled ? "var(--pulso-surface-3)" : "white",
          color: "var(--pulso-text)",
          padding: "7px 10px",
          fontSize: 12,
          outline: "none",
        }}
      />
      {options.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--pulso-border)",
            borderRadius: 8,
            background: "white",
            color: "var(--pulso-text-soft)",
            fontSize: 12,
            padding: "10px 12px",
          }}
        >
          No hay variables disponibles para el filtro actual.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            gap: 8,
            maxHeight: 260,
            overflow: "auto",
            paddingRight: 2,
          }}
        >
          {options.map((option) => {
            const checked = excluded.has(option.variable);
            return (
              <label
                key={option.variable}
                style={{
                  minHeight: 74,
                  border: `1px solid ${checked ? "var(--pulso-primary-border)" : "var(--pulso-border)"}`,
                  borderRadius: 8,
                  background: checked ? "var(--pulso-primary-soft)" : "white",
                  padding: "9px 10px",
                  display: "grid",
                  gridTemplateColumns: "18px minmax(0, 1fr)",
                  gap: 8,
                  alignItems: "flex-start",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.68 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) => onToggle(option.variable, event.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <strong
                      style={{
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: 12,
                        color: "var(--pulso-text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {option.variable}
                    </strong>
                    <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", whiteSpace: "nowrap" }}>
                      {option.n_reglas} reglas
                    </span>
                  </span>
                  <span
                    title={option.label}
                    style={{
                      fontSize: 11,
                      color: "var(--pulso-text-soft)",
                      lineHeight: 1.35,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {option.label || "Sin etiqueta"}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                      fontSize: 10,
                      color: "var(--pulso-text-soft)",
                    }}
                  >
                    <span>{formatCompactNumber(option.n_inconsistencias ?? 0)} inconsistencias</span>
                    {option.n_reglas_con_casos > 0 && <span>{option.n_reglas_con_casos} con casos</span>}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StepHeader({
  idx,
  title,
  subtitle,
  done,
  count,
  countLabel,
}: {
  idx: number;
  title: string;
  subtitle?: ReactNode;
  done: boolean;
  count?: number | null;
  countLabel?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: done ? "var(--pulso-success-fg)" : "var(--pulso-text-soft)",
          color: "white",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {idx}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--pulso-text)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {title}
          {count != null && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 999,
                background: "var(--pulso-primary-soft)",
                color: "var(--pulso-primary)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {count} {countLabel}
            </span>
          )}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 11,
              color: "var(--pulso-text-soft)",
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(value);
}

function variableExclusionBadgeStyle(background: string, color: string): CSSProperties {
  return {
    minHeight: 22,
    padding: "3px 8px",
    borderRadius: 999,
    background,
    color,
    border: "1px solid var(--pulso-border)",
    fontWeight: 700,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    display: "inline-flex",
    alignItems: "center",
  };
}

function normalizeCompactRuleRow(row: Record<string, unknown>): CompactRuleRow | null {
  const id = typeof row.id_regla === "string" ? row.id_regla : "";
  if (!id) return null;
  const variablePairs = [
    {
      key: typeof row.variable_1 === "string" ? row.variable_1 : "",
      label: typeof row.variable_1_etiqueta === "string" ? row.variable_1_etiqueta : null,
    },
    {
      key: typeof row.variable_2 === "string" ? row.variable_2 : "",
      label: typeof row.variable_2_etiqueta === "string" ? row.variable_2_etiqueta : null,
    },
    {
      key: typeof row.variable_3 === "string" ? row.variable_3 : "",
      label: typeof row.variable_3_etiqueta === "string" ? row.variable_3_etiqueta : null,
    },
  ].filter((item) => item.key);

  const presentation = relRecord(row.presentation);
  const variableRoles = relRecord(row.variable_roles);
  const base: CompactRuleRowBase = {
    id,
    nombre: typeof row.nombre_regla === "string" ? row.nombre_regla : id,
    displayName: typeof row.nombre_regla === "string" ? row.nombre_regla : id,
    tipo: typeof row.tipo_observacion === "string" ? row.tipo_observacion : null,
    seccion: typeof row.seccion === "string" ? row.seccion : null,
    porcentaje: typeof row.porcentaje === "number" ? row.porcentaje : null,
    nInconsistencias: typeof row.n_inconsistencias === "number" ? row.n_inconsistencias : null,
    variables: variablePairs,
    estadoDinamico: typeof row.estado_dinamico === "string" ? row.estado_dinamico : null,
    issueCode: typeof row.issue_code === "string" ? row.issue_code : null,
    detalle: typeof row.detalle === "string" ? row.detalle : null,
    tipoRegla: typeof row.tipo_regla === "string" ? row.tipo_regla : null,
    rosterSubtype: presentation ? relStr(presentation.subtipo_semantico) : null,
    categoriaUx: typeof row.categoria_ux === "string" ? row.categoria_ux : null,
    tabla: typeof row.tabla === "string" ? row.tabla : null,
    targetVar: variableRoles ? relStr(variableRoles.target) : null,
    presentation: parsePresentation(presentation),
    variableRoles: parseVariableRoles(variableRoles),
  };
  return {
    ...base,
    // Derivado (sin plan_preview); en `compactRules` se re-resuelve con la
    // metadata autoritativa del plan cuando está capturada.
    relationalInfo: resolveRelationalInfo(relationalSignalsFromRow(base)),
  };
}

function NarrativeRuleCard({
  row,
  selected,
  onClick,
}: {
  row: CompactRuleRow;
  selected: boolean;
  onClick: () => void;
}) {
  const rule = useMemo(() => compactRowToRule(row), [row]);
  const hoverLookup = useMemo(() => buildRowHoverLookup(row), [row]);
  return (
    <RuleNarrative
      rule={rule}
      variant="compact"
      selected={selected}
      onClick={onClick}
      nCasos={row.nInconsistencias ?? null}
      porcentaje={row.porcentaje ?? null}
      variableHoverLookup={hoverLookup}
      labelLookup={(v) => row.variables.find((x) => x.key === v)?.label ?? null}
      // Hovercards desactivados en la grid: con muchas reglas, cada chip
      // de variable agregaba un portal + listeners de scroll/resize que
      // acumulaban en un solo viewport, llegando a tumbar la app. El
      // detalle por variable se ve en el ContextLens (al click) que ya
      // tiene la info completa.
      disableVariableHover
    />
  );
}

function getTargetVariableKey(variables: Array<string | null | undefined>) {
  const first = variables.find((value) => typeof value === "string" && value.trim().length > 0);
  return typeof first === "string" ? first.trim() : null;
}

function buildDisplayRuleName(nombre: string, targetKey: string | null, disambiguate: boolean) {
  const base = nombre.trim() || "Regla sin nombre";
  if (!disambiguate || !targetKey) return base;
  if (base.toLowerCase().includes(`[${targetKey.toLowerCase()}]`)) return base;
  return `${base} [${targetKey}]`;
}

// ----------------------------------------------------------------------------
// Adaptadores a los componentes v2 (RuleNarrative, hovercards de variable).
// ----------------------------------------------------------------------------

// Mapea un CompactRuleRow al shape ReglaLike que consume RuleNarrative.
// Los labels por variable se pasan por separado al `labelLookup` de
// RuleNarrative (ver `buildRowHoverLookup` + labelLookup inline).
function compactRowToRule(row: CompactRuleRow): ReglaLike {
  const variables = row.variables.map((v) => v.key);
  const target = variables[0] ?? null;
  return {
    id: row.id,
    nombre: row.displayName,
    tipo_observacion: row.tipo ?? null,
    fuente: "instrumento",
    categoria_ux: row.tipo ?? null,
    variables,
    variable_roles: target ? { target } : null,
    n_casos: row.nInconsistencias ?? null,
    porcentaje: row.porcentaje ?? null,
  };
}

// Normaliza el bloque `presentation` del resumen a la forma de ReglaLike.
function parsePresentation(rec: Record<string, unknown> | null): ReglaLike["presentation"] {
  if (!rec) return null;
  return {
    subtipo_semantico: relStr(rec.subtipo_semantico),
    gate_humano: relStr(rec.gate_humano),
    detalle_condicion: relStr(rec.detalle_condicion),
    nombre_humano: relStr(rec.nombre_humano),
    nombre_tecnico: relStr(rec.nombre_tecnico),
    objetivo: relStr(rec.objetivo),
  };
}

// Normaliza `variable_roles` (target puede venir como string o lista).
function parseVariableRoles(rec: Record<string, unknown> | null): ReglaLike["variable_roles"] {
  if (!rec) return null;
  const target = relStrList(rec.target);
  const drivers = relStrList(rec.drivers);
  const compare = relStrList(rec.compare);
  const gate = relStrList(rec.gate);
  if (!target.length && !drivers.length && !compare.length && !gate.length) return null;
  return {
    target: target.length ? target : null,
    drivers: drivers.length ? drivers : null,
    compare: compare.length ? compare : null,
    gate: gate.length ? gate : null,
  };
}

// Arma el input del RuleDetailPanel a partir de una fila compacta. No depende
// del drill: sirve para cualquier tipo de regla, evaluada o no.
function buildRuleDetailInput(row: CompactRuleRow): RuleDetailInput {
  const variables = row.variables.map((v) => v.key);
  const labelByKey = new Map(row.variables.map((v) => [v.key, v.label] as const));
  const regla: ReglaLike = {
    id: row.id,
    nombre: row.presentation?.nombre_humano ?? row.displayName,
    tipo_regla: row.tipoRegla,
    tipo_observacion: row.tipo,
    fuente: "instrumento",
    categoria_ux: row.categoriaUx,
    objetivo: row.presentation?.objetivo ?? null,
    variables,
    variable_roles: row.variableRoles,
    presentation: row.presentation,
    n_casos: row.nInconsistencias ?? null,
    porcentaje: row.porcentaje ?? null,
  };
  return {
    regla,
    displayName: row.displayName,
    estadoDinamico: row.estadoDinamico,
    issueCode: row.issueCode,
    detalle: row.detalle,
    nInconsistencias: row.nInconsistencias,
    porcentaje: row.porcentaje,
    requiresExternalDataset: isPullDataRow(row),
    relationalConditionCopy: row.relationalInfo.relational
      ? relationalKindCopy(row.relationalInfo.kind)
      : null,
    seccion: row.seccion,
    labelLookup: (v: string) => labelByKey.get(v) ?? null,
  };
}

// Hover lookup para variables: sólo tiene el label por fila (no hay drill
// cargado). Suficiente para el listado — el ContextLens abre con datos
// completos al hacer click.
function buildRowHoverLookup(
  row: CompactRuleRow,
): (varName: string) => VariableHoverData | undefined {
  const byKey = new Map<string, string | null>();
  for (const v of row.variables) byKey.set(v.key, v.label);
  return (varName: string): VariableHoverData | undefined => {
    if (!varName) return undefined;
    const label = byKey.get(varName) ?? null;
    if (!label) return undefined;
    return { label, seccion: row.seccion ?? null };
  };
}

// ----------------------------------------------------------------------------
// Sección con las 3 subsecciones de reglas (con casos / no aplicables / no
// evaluadas). Cada subsección se oculta si no tiene reglas.
type Groups = {
  relacionales: CompactRuleRow[];
  conCasos: CompactRuleRow[];
  desalineadas: CompactRuleRow[];
  noAplicables: CompactRuleRow[];
  noEvaluadas: CompactRuleRow[];
  pullData: CompactRuleRow[];
  okSinCasos: CompactRuleRow[];
};

function RuleGroupsSection({
  groups,
  relationalSummary,
  relationalRows,
  selectedRuleId,
  onSelect,
}: {
  groups: Groups;
  relationalSummary: RelationalSummary | null;
  relationalRows: RelationalRuleView[];
  selectedRuleId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section
      style={{
        padding: "16px 20px 20px",
        background: "white",
        border: "1px solid var(--pulso-border)",
        borderRadius: 10,
        boxShadow: "var(--pulso-shadow-low)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {/* Panel de la familia relacional (naranja): primero, porque presenta el
          instrumento con su base relacionada. Se auto-oculta si no hay repeat. */}
      <RelationalRuleFamily
        summary={relationalSummary}
        rows={relationalRows}
        selectedRuleId={selectedRuleId}
        onSelect={onSelect}
      />
      {groups.desalineadas.length > 0 && (
        <RuleSubGroup
          title="Reglas desalineadas con los datos"
          hint="Estas reglas comparan una variable contra un valor que no existe en tu base (p.ej. consent='OK' cuando los datos usan 1/0). Es la firma de un desfase entre la versión del instrumento con la que se armó el plan y la versión con la que se levantaron los datos. No se contabilizan como inconsistencias para evitar falsos positivos masivos: revisa que el instrumento de validación coincida con el desplegado."
          countLabel={(n) => `${n} ${n === 1 ? "regla" : "reglas"}`}
          rows={groups.desalineadas}
          selectedRuleId={selectedRuleId}
          onSelect={onSelect}
          clickable={false}
          tone="warn"
        />
      )}
      <RuleSubGroup
        title="Reglas con inconsistencias"
        hint="Casos detectados — click en una tarjeta para abrir los detalles."
        countLabel={(n) => `${n} ${n === 1 ? "regla" : "reglas"}`}
        rows={groups.conCasos}
        selectedRuleId={selectedRuleId}
        onSelect={onSelect}
        clickable
        emptyHint="Sin inconsistencias detectadas en esta corrida."
      />
      {groups.noAplicables.length > 0 && (
        <RuleSubGroup
          title="Reglas no aplicables a esta base"
          hint="La data no contiene la columna que la regla evalúa. Típico de preguntas select_multiple (la opción se desplegó en columnas dummy q*_NNNN), preguntas dentro de grupos no exportados, o ramas condicionales que ningún caso activó."
          countLabel={(n) => `${n} ${n === 1 ? "regla" : "reglas"}`}
          rows={groups.noAplicables}
          selectedRuleId={selectedRuleId}
          onSelect={onSelect}
          clickable={false}
          tone="muted"
        />
      )}
      {groups.noEvaluadas.length > 0 && (
        <RuleSubGroup
          title="No evaluadas automáticamente"
          hint="El evaluador no pudo correrlas: sintaxis ODK que aún no traduce o falta la fecha de captura. Revísalas a mano."
          countLabel={(n) => `${n} ${n === 1 ? "regla" : "reglas"}`}
          rows={groups.noEvaluadas}
          selectedRuleId={selectedRuleId}
          onSelect={onSelect}
          clickable={false}
          tone="warn"
        />
      )}
      {groups.pullData.length > 0 && (
        <RuleSubGroup
          title="Campos pull data"
          hint="Se pre-llenan desde un listado externo con pulldata(); sin ese listado no hay contra qué validarlos. No es un error del instrumento."
          countLabel={(n) => `${n} ${n === 1 ? "campo" : "campos"}`}
          rows={groups.pullData}
          selectedRuleId={selectedRuleId}
          onSelect={onSelect}
          clickable={false}
          tone="muted"
        />
      )}
      {groups.okSinCasos.length > 0 && (
        <RuleSubGroup
          title="Validaciones que pasaron sin inconsistencias"
          hint="Corrieron sobre la base y no encontraron casos (p.ej. los cálculos p_space). Despliega para abrir el diagrama de cualquiera."
          countLabel={(n) => `${n} ${n === 1 ? "regla" : "reglas"}`}
          rows={groups.okSinCasos}
          selectedRuleId={selectedRuleId}
          onSelect={onSelect}
          clickable
          tone="muted"
          collapsible
          defaultCollapsed
        />
      )}
    </section>
  );
}

function RuleSubGroup({
  title,
  hint,
  rows,
  selectedRuleId,
  onSelect,
  clickable,
  countLabel,
  tone = "default",
  emptyHint,
  collapsible = false,
  defaultCollapsed = false,
}: {
  title: string;
  hint: string;
  rows: CompactRuleRow[];
  selectedRuleId: string | null;
  onSelect: (id: string) => void;
  clickable: boolean;
  countLabel: (n: number) => string;
  tone?: "default" | "muted" | "warn";
  emptyHint?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);
  const headerColor =
    tone === "warn"
      ? "var(--pulso-warn-fg, #b45309)"
      : tone === "muted"
        ? "var(--pulso-text-soft)"
        : "var(--pulso-text)";
  const countBadge = (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        background: "var(--pulso-surface-2, rgba(0,0,0,0.05))",
        color: "var(--pulso-text-soft)",
        fontFamily: "ui-monospace, monospace",
      }}
    >
      {countLabel(rows.length)}
    </span>
  );
  const titleRow = collapsible ? (
    <button
      type="button"
      onClick={() => setCollapsed((c) => !c)}
      aria-expanded={!collapsed}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        fontWeight: 700,
        color: headerColor,
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
    >
      {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
      {title}
      {countBadge}
    </button>
  ) : (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        fontWeight: 700,
        color: headerColor,
      }}
    >
      {title}
      {countBadge}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        {titleRow}
        <div
          style={{
            fontSize: 11,
            color: "var(--pulso-text-soft)",
            marginTop: 2,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </div>
      </div>

      {collapsed ? null : rows.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: "var(--pulso-text-soft)",
            padding: "10px 12px",
            background: "var(--pulso-surface)",
            borderRadius: 6,
            border: "1px dashed var(--pulso-border)",
          }}
        >
          {emptyHint ?? "—"}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 10,
            maxHeight: 480,
            overflow: "auto",
            paddingRight: 4,
          }}
        >
          {rows.map((row) =>
            clickable ? (
              <NarrativeRuleCard
                key={row.id}
                row={row}
                selected={row.id === selectedRuleId}
                onClick={() => onSelect(row.id)}
              />
            ) : (
              <UnevaluableRuleCard
                key={row.id}
                row={row}
                tone={tone === "warn" ? "warn" : "muted"}
                selected={row.id === selectedRuleId}
                onClick={() => onSelect(row.id)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function UnevaluableRuleCard({
  row,
  tone,
  selected = false,
  onClick,
}: {
  row: CompactRuleRow;
  tone: "muted" | "warn";
  selected?: boolean;
  onClick?: () => void;
}) {
  const reason = describeRuleReason(row);
  // Los campos pull data se superficializan internamente como `odk_raw`, pero
  // NO son modo experto: no mostramos ese tag técnico (leería como "experto").
  const showTipoTag = !!row.tipo && !isPullDataRow(row);
  const borderColor = selected
    ? "var(--pulso-primary-border)"
    : tone === "warn"
      ? "var(--pulso-warn-border, #fde68a)"
      : "var(--pulso-border)";
  const badgeBg =
    tone === "warn" ? "var(--pulso-warn-bg, #fffbeb)" : "var(--pulso-surface)";
  const badgeFg =
    tone === "warn" ? "var(--pulso-warn-fg, #b45309)" : "var(--pulso-text-soft)";
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        padding: "12px 14px",
        borderRadius: 8,
        border: `1px solid ${borderColor}`,
        background: selected ? "var(--pulso-primary-soft)" : "white",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: 0.95,
        cursor: onClick ? "pointer" : "default",
        boxShadow: selected ? "var(--pulso-shadow-soft)" : undefined,
        transition: "border-color 120ms ease, background 120ms ease",
      }}
      title={row.detalle ?? undefined}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            background: badgeBg,
            color: badgeFg,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {reason.badge}
        </span>
        {showTipoTag && (
          <span
            style={{
              fontSize: 10,
              color: "var(--pulso-text-soft)",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            {row.tipo}
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, color: "var(--pulso-text)", lineHeight: 1.4 }}>
        {row.displayName}
      </div>
      <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
        {reason.explanation}
      </div>
    </div>
  );
}

function describeRuleReason(row: CompactRuleRow): { badge: string; explanation: string } {
  // Regla relacional cuya base hija aún no está presente: no es "faltan
  // columnas", se evalúa al cargar la base de respuestas repetidas (Fase 4).
  if (row.issueCode === "sin_datos_repeat") {
    return {
      badge: "Respuestas repetidas pendientes",
      explanation:
        "Coherencia de las filas repetidas: se evalúa al cargar la base de respuestas repetidas (aún no hay registros de esa sección en esta base).",
    };
  }
  // Regla que depende de un roster externo precargado vía pulldata: badge
  // propio, distinto del "Modo experto" (sintaxis no soportada) (Fase 4).
  if (row.issueCode === "requires_external_dataset" || row.relationalInfo.requiresExternalDataset) {
    const datasets = row.relationalInfo.externalDatasets.filter((d) => d.length > 0);
    const listado = datasets.length
      ? datasets.map((d) => `«${d}»`).join(", ")
      : "un listado externo";
    return {
      badge: "Campo pull data",
      explanation: `Se jala de ${listado} por el teléfono.`,
    };
  }
  if (row.estadoDinamico === "no_aplicable") {
    if (row.issueCode === "missing_columns") {
      const detalle = row.detalle ?? "";
      const cols = detalle.match(/Columnas ausentes: ([^|]+)/)?.[1]?.trim();
      return {
        badge: "No aplica",
        explanation: cols
          ? `Faltan columnas en la data: ${cols}.`
          : "La columna que la regla evalúa no está en la data exportada.",
      };
    }
    return { badge: "No aplica", explanation: row.detalle ?? "Regla no aplicable a esta base." };
  }
  if (row.estadoDinamico === "no_evaluada") {
    if (row.issueCode === "odk_raw") {
      return {
        badge: "Modo experto",
        explanation:
          "Constraint con sintaxis ODK avanzada que el evaluador no traduce automáticamente. Revísala manualmente o promuévela a criterio de revisión.",
      };
    }
    if (row.issueCode === "missing_collection_date") {
      return {
        badge: "Falta fecha de captura",
        explanation:
          "La regla depende de today() pero la data no tiene una columna de fecha utilizable.",
      };
    }
    return { badge: "No evaluada", explanation: row.detalle ?? "El evaluador no pudo correr esta regla." };
  }
  if (row.estadoDinamico === "incorrecta_ejecucion") {
    return {
      badge: "Error de ejecución",
      explanation: row.detalle ?? "La regla falló al evaluarse — revisa la expresión.",
    };
  }
  if (row.estadoDinamico === "desalineada") {
    return {
      badge: "Desalineada",
      explanation:
        row.detalle ??
        "La regla compara contra un valor que no existe en los datos — probable desfase de versión del instrumento.",
    };
  }
  return { badge: row.estadoDinamico ?? "—", explanation: row.detalle ?? "" };
}
