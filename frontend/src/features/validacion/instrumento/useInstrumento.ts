/**
 * Estado y acciones de "Reglas del formulario": estado del plan y de la
 * auditoría de la base activa, variables fuera de auditoría, controles del
 * operativo, resultado agrupado y la regla abierta en su panel.
 *
 * Salió sin cambios de `tabs/InstrumentoTab.tsx` (rebanada V1 de P6): los
 * efectos conservan su orden, que vigila la huella de pedidos de la
 * caracterización (`caracterizacion/instrumento.test.tsx`).
 */
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { apiUpload, apiV2InstrumentoAuditoria, apiV2InstrumentoBuildPlan, apiV2InstrumentoDrill, apiV2InstrumentoEstado, apiV2InstrumentoImportPlan, apiV2InstrumentoReglaToggleActiva, apiV2InstrumentoResultado, apiV2InstrumentoVariablesExcluidas, apiV2InstrumentoVariablesExcluidasSave, type InstrumentoDrillResult, type InstrumentoResultado } from "../../../api/client";
import type { InstrumentoEstado, InstrumentoOperationalConfig, InstrumentoVariablesExcluidas } from "../types";
import { useEntregasInstrumento } from "../entregas/useEntregasInstrumento";
import { relationalBaseKey, useValidacionStore } from "../store";
import { useReglaDireccionable } from "../tabs/useReglaDireccionable";
import type { RelationalRuleView } from "../components/RelationalRuleFamily";
import { buildRelationalMetaMap, normalizeRelationalSummary, resolveRelationalInfo } from "../relationalPlan";
import { defaultOperationalConfig, hasOperationalConfigChanges, isOperationalConfigValid, normalizeOperationalConfig, validateOperationalConfig } from "../operationalControlsModel";
import { type CompactRuleRow, buildDisplayRuleName, getTargetVariableKey, isPullDataRow, normalizeCompactRuleRow, normalizeSearchText, relationalSignalsFromRow, uniqueStrings } from "./modeloInstrumento";

/**
 * `conAuditoria: false` (Reglas) no pide el resultado de la auditoría ni las
 * variables fuera de auditoría: esa pestaña no los dibuja (revisión de V2, B3).
 * `alTerminarAuditoria` avisa a quien comparte pestaña con la auditoría (la
 * mesa de Hallazgos) para que vuelva a leer lo que depende de ella.
 */
export function useInstrumento({
  conAuditoria = true,
  alTerminarAuditoria,
}: { conAuditoria?: boolean; alTerminarAuditoria?: () => void } = {}) {
  const alTerminarAuditoriaRef = useRef(alTerminarAuditoria);
  alTerminarAuditoriaRef.current = alTerminarAuditoria;
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);
  const prefillInstr = useValidacionStore((s) => s.prefill.hallazgos);
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
  // ADR 0133: el plan en Excel y el paquete metodológico salen en el contenedor del kit de entregables.
  const entregas = useEntregasInstrumento(baseNombre);
  const { plan: entregaPlan, paquete: entregaPaquete } = entregas;
  const cerrarPlan = entregaPlan.cerrar;
  const cerrarPaquete = entregaPaquete.cerrar;
  const exportando = entregaPlan.enCurso || entregaPaquete.enCurso;
  const [drill, setDrill] = useState<InstrumentoDrillResult | null>(null);
  const [reglaDirty, setReglaDirty] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<string>("");
  // Regla cuyo panel de detalle (descripción + diagrama de flujo) está abierto.
  // Es distinto de `selectedRuleId` (que puede quedar en la primera regla por
  // defecto): sólo se setea al hacer click y gobierna la apertura del ContextLens.
  // La regla abierta vive en la dirección (?panel=regla&foco=<id>), no en estado local (L2).
  const { detailRuleId, abrirRegla, cerrarRegla } = useReglaDireccionable();
  const [variablesExcluidas, setVariablesExcluidas] = useState<InstrumentoVariablesExcluidas | null>(null);
  const [variableQuery, setVariableQuery] = useState("");
  // Lo aplicado viene del backend; lo editado sin aplicar vive en el store por
  // base, para que sobreviva al cambio de pestaña (Reglas edita, Hallazgos
  // audita y necesita saber que hay cambios sin aplicar).
  const borrador = useValidacionStore((s) => s.controlesSinAplicar[relationalBaseKey(s.baseNombre)]);
  const setControlesSinAplicar = useValidacionStore((s) => s.setControlesSinAplicar);
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
      setAppliedOperationalConfig(normalizeOperationalConfig(e.operational_config));
      if (!conAuditoria) {
        setResultado(null);
        return;
      }
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
  }, [baseNombre, conAuditoria]);

  const operationalConfig = borrador ?? appliedOperationalConfig;
  const setOperationalConfig = useCallback(
    (next: InstrumentoOperationalConfig) => setControlesSinAplicar(baseNombre, next),
    [baseNombre, setControlesSinAplicar],
  );

  // La regla abierta vive en la URL: se cierra sólo si la base cambió de
  // verdad, no al montar (borraba el enlace directo) ni al refrescar.
  const baseAnteriorRef = useRef(baseNombre);
  useEffect(() => {
    void refetchAll();
    // Reset local state al cambiar de base.
    cerrarPlan();
    cerrarPaquete();
    setDrill(null);
    if (baseAnteriorRef.current !== baseNombre) cerrarRegla();
    baseAnteriorRef.current = baseNombre;
    setJobId(null);
    setVariableQuery("");
    setAppliedOperationalConfig(defaultOperationalConfig());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseNombre, version]);

  // Consumir prefill de deep-link: si viene id_regla, auto-abrir drill.
  useEffect(() => {
    if (prefillInstr?.id_regla && resultado) {
      onSelectRule(prefillInstr.id_regla);
      clearPrefill("hallazgos");
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
      // Aplicado: lo editado pasa a ser lo del backend.
      setControlesSinAplicar(baseNombre, null);
      await refetchAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function onExport() {
    setError("");
    void entregas.exportarPlan();
  }

  function onMethodologyPackage() {
    setError("");
    void entregas.generarPaquete();
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
    alTerminarAuditoriaRef.current?.();
  }

  async function onToggleVariableExcluida(variable: string, checked: boolean, motivo?: string) {
    const current = variablesExcluidas?.variables ?? estado?.variables_excluidas ?? [];
    const next = checked
      ? uniqueStrings([...current, variable])
      : current.filter((item) => item !== variable);
    setBusy(checked ? "Excluyendo variable…" : "Reactivando variable…");
    setError("");
    try {
      // Vara V5: el motivo viaja sólo para la que se agrega ahora; el backend
      // no lo pide para las que ya estaban ni para reponer.
      const saved = await apiV2InstrumentoVariablesExcluidasSave(
        next,
        baseNombre,
        checked && motivo ? { [variable]: motivo } : undefined,
      );
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
    abrirRegla(id);
  }

  function closeDetail() {
    cerrarRegla();
    setDrill(null);
    setReglaDirty(false);
  }

  async function onToggleReglaActiva(activa: boolean, ruleId?: string, motivo?: string) {
    const id = ruleId ?? drill?.regla.id;
    if (!id) return;
    setBusy(activa ? "Reactivando regla…" : "Ignorando regla…");
    try {
      await apiV2InstrumentoReglaToggleActiva(id, activa, baseNombre, motivo);
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

  // Al abrir una regla —por clic o por enlace— se selecciona y, si tiene
  // casos, se carga su drill. La ref evita volver a pedirlo cuando
  // compactRules se recalcula con la misma regla abierta.
  const reglaCargadaRef = useRef("");
  useEffect(() => {
    if (!detailRuleId) {
      reglaCargadaRef.current = "";
      return;
    }
    if (reglaCargadaRef.current === detailRuleId) return;
    const row = compactRules.find((r) => r.id === detailRuleId);
    if (!row) return;
    reglaCargadaRef.current = detailRuleId;
    setSelectedRuleId(detailRuleId);
    if ((row.nInconsistencias ?? 0) > 0) void openDrill(detailRuleId);
    else setDrill(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailRuleId, compactRules]);

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

  return {
    baseNombre,
    loading,
    estado,
    resultado,
    error,
    setError,
    busy,
    jobId,
    setJobId,
    entregaPlan,
    entregaPaquete,
    cerrarPlan,
    cerrarPaquete,
    exportando,
    drill,
    reglaDirty,
    selectedRuleId,
    detailRuleId,
    variableQuery,
    setVariableQuery,
    operationalConfig,
    setOperationalConfig,
    operationalDirty,
    operationalValid,
    onBuildPlan,
    onExport,
    onMethodologyPackage,
    onImport,
    onAudit,
    onAuditDone,
    onToggleVariableExcluida,
    onSelectRule,
    closeDetail,
    onToggleReglaActiva,
    rulesByGroup,
    relationalRows,
    relationalSummary,
    activeDisplayName,
    detailRow,
    detailTitle,
    excludedVariableSet,
    variableExclusionOptions,
  };
}

export type Instrumento = ReturnType<typeof useInstrumento>;
