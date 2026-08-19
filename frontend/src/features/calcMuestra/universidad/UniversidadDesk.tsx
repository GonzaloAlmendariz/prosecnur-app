/**
 * Mesa universitaria "Muestra de aulas": orquesta las cinco secciones del rail
 * (Definición, Marco, Cálculo, Aulas y Salidas) montando la pestaña local
 * activa de cada una. Movida desde CalcMuestraPage (antes
 * OpinionUniversitariaDeskRevamp) con el mismo contrato de props; el estado de
 * navegación (sección, pestaña local y pestaña del laboratorio) sigue viviendo
 * en la página contenedora.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import {
  normalizeCalcMuestraCertificacionFacultad,
  normalizeCalcMuestraReferenciaCriterios,
  normalizeCalcMuestraSexoPorFacultad,
  type CalcMuestraAulasState,
  type CalcMuestraAlumnosPorChDecision,
  type CalcMuestraComponente,
  type CalcMuestraEstudio,
  type CalcMuestraReferenciaAsistencia,
  type CalcMuestraWorkspace,
  type CalcMuestraWorkspaceAulasConfig,
  type CalcMuestraWorkspaceSourceBinding,
} from "../../../api/client";
import { rowsFrom, safeNumber, type ComponentePatch } from "../sharedCore";
import {
  UNIVERSITY_FACULTY_COMPONENT_ID,
  UNIVERSITY_TOTAL_COMPONENT_ID,
  type ClassroomLabTab,
} from "./shared/constants";
import { frameAuditNumber, marcoCriteriosDesactualizado } from "./shared/frame";
import { facultadesDesdeFrame } from "../dominio";
import { conDivisorDelMarco } from "./marco/divisorDelMarco";
import {
  componentFormulaBase,
  estratosDesdeFrame,
  materializeUniversityAulasTarget,
  normalizeUniversityAulasConfig,
  prepareUniversityStudyForCalculation,
  universityComponents,
  universityDefaultWorkspace,
  universityWorkspace,
  type UniversityAulasScenario,
} from "./shared/study";
import { universitySidebarTabs } from "./universidadTabs";
import { DefBasesTab, DefConsistenciaTab, DefEstudioTab, DefVariablesTab } from "./definicion";
import { AlumnosPorChMarcoTab, CursosHorarioMarcoTab, MarcoAulasTab, MarcoPoblacionTab } from "./marco";
import { ExploradorBasesTab } from "./definicion/ExploradorBasesTab";
import { DefHistoricoTab } from "./definicion/DefHistoricoTab";
import { applyAlumnosPorChDecision } from "./marco/alumnosPorChDecisionHandoff";
import { CriteriosMarcoTab } from "./criterios";
import { type CriterioGeneralFila } from "./criterios/CriteriosGeneralesCard";
import { criteriosGeneralesDeEstudio } from "./criterios/criteriosGeneralesModel";
import { criteriosMarcoDeEstudio } from "./criterios/criteriosMarcoModel";
import { SalidasCoincidenciaTab } from "./salidas/SalidasCoincidenciaTab";
import { claveFicha, fichaDeFacultad, filasParaFichas } from "./criterios/fichaFacultadModel";
import { CalculoCursosHorarioFacultadTab, CalculoDisenoTab, CalculoDistribucionTab, CalculoPropuestasTab, type CertezaEstratoPayload } from "./calculo";
import {
  AulasAuditoriaTab,
  AulasMetodoTab,
  AulasObjetivoTab,
  AulasReemplazosTab,
  AulasSeleccionTab,
  AulasPerfilTab,
  AulasSimulacionTab,
  buildClassroomLabModel,
} from "./aulas";
import { RelatoTab } from "./aulas/relato/RelatoTab";
import { conAfijacionDelEstudio } from "./aulas/afijacionTargets";
import { estratosConAjusteAula, estratosConAulaExtra } from "./aulas/certificacionAcciones";
import {
  SalidasCierreTab,
  SalidasEntregablesTab,
  SalidasMonitoreoTab,
  SalidasResultadosTab,
  type PaqueteDefensaPaso,
} from "./salidas";
import type { MotorEfectivo } from "../motor/usePerfilEfectivo";
import { useMotorStore } from "../store";
import { TabCobertura } from "../motor/pestanas/TabCobertura";
import { UniversityTabHeader } from "./ui/UniversityTabHeader";
import { universityFrameSourceBindings } from "./shared/categorias";

export function universityContextTabId(section: string, key: string) {
  return `cmv2-context-tab-${section}-${key}`;
}

export function UniversidadDesk({
  estudio,
  workspace,
  aulasState,
  motorPideRefirmarAlumnosCh = false,
  referenciaAsistencia,
  motor,
  busy,
  activeSection,
  activeLocalTab,
  activeFocus,
  activeLabTab,
  onTitulo,
  onContexto,
  onWorkspace,
  onComponente,
  onSetComponentes,
  onInvalidateAulasArtifacts,
  onCalcular,
  onCompararAulas,
  onSeleccionarAulas,
  onMedirCerteza,
  midiendoCerteza = false,
  onSimularReemplazos,
  onSourceUpload,
  onSourceBuild,
  onReferenceSheetChange,
  uploadingSourceId,
  calculando,
  onGenerarReporte,
  reporteEnCurso,
  reporteDisponible,
  reporteStale,
  reporteDescargarUrl,
  onExportarAulas,
  exportandoAulas,
  onGenerarPaqueteDefensa,
  paqueteEnCurso,
  paquetePasos,
  onNavigate,
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  /** F36 · El motor rechazó comparar por `decision_stale`; reabre la refirma. */
  motorPideRefirmarAlumnosCh?: boolean;
  referenciaAsistencia: CalcMuestraReferenciaAsistencia | null;
  motor: MotorEfectivo;
  busy: string | null;
  activeSection: string;
  activeLocalTab: string;
  activeFocus: string | null;
  activeLabTab: ClassroomLabTab;
  onGenerarReporte: (formato: "html" | "pdf") => void;
  reporteEnCurso: boolean;
  reporteDisponible: boolean;
  reporteStale: boolean;
  reporteDescargarUrl: string | null;
  onExportarAulas: () => void;
  exportandoAulas: boolean;
  onGenerarPaqueteDefensa: (formato: "html" | "pdf") => void;
  paqueteEnCurso: boolean;
  paquetePasos: PaqueteDefensaPaso[] | null;
  onTitulo: (titulo: string) => void;
  onContexto: (campo: "cliente" | "tipo_cliente" | "descripcion_libre", valor: string) => void;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onComponente: (id: string, patch: ComponentePatch) => void;
  onSetComponentes: (componentes: CalcMuestraComponente[]) => void;
  onInvalidateAulasArtifacts: () => void;
  onCalcular: (estudioOverride?: CalcMuestraEstudio) => void | Promise<void>;
  onCompararAulas: (config: CalcMuestraWorkspaceAulasConfig, simulationRuns: number) => void | Promise<void>;
  onSeleccionarAulas: (config: CalcMuestraWorkspaceAulasConfig, methodId?: string) => void | Promise<void>;
  onMedirCerteza: (payload: { estratos: CertezaEstratoPayload[]; nivel: number }) => void | Promise<void>;
  midiendoCerteza?: boolean;
  onSimularReemplazos: (config: CalcMuestraWorkspaceAulasConfig) => void | Promise<void>;
  onSourceUpload: (binding: CalcMuestraWorkspaceSourceBinding, file: File) => void | Promise<void>;
  onSourceBuild: (workspace: CalcMuestraWorkspace) => void | Promise<void>;
  onReferenceSheetChange: (
    binding: CalcMuestraWorkspaceSourceBinding,
    workspace: CalcMuestraWorkspace,
  ) => void | Promise<void>;
  uploadingSourceId: string | null;
  calculando: boolean;
  /** Navegación del Recorrido: cambia de sección del rail y/o de pestaña local. */
  onNavigate: (section: string, tab?: string) => void;
}) {
  const baseWorkspace = useMemo(
    () => workspace.frame_mode === "opinion_universitaria"
      ? workspace
      : { ...universityDefaultWorkspace(), ...workspace, frame_mode: "opinion_universitaria" as const },
    [workspace],
  );
  const [totalComp, facultyComp] = useMemo(() => universityComponents(estudio.componentes), [estudio.componentes]);
  const syncedWorkspace = useMemo(
    () => universityWorkspace(baseWorkspace, totalComp, facultyComp),
    [baseWorkspace, totalComp, facultyComp],
  );
  const [draftTargets, setDraftTargets] = useState<Record<string, number>>({});
  const [reporteFormato, setReporteFormato] = useState<"html" | "pdf">("html");
  const activePanelRef = useRef<HTMLDivElement>(null);

  const currentTotal = estudio.componentes.find((c) => c.actor_id === UNIVERSITY_TOTAL_COMPONENT_ID);
  const currentFaculty = estudio.componentes.find((c) => c.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID);
  const needsSync =
    estudio.componentes.length !== 2 ||
    !currentTotal ||
    !currentFaculty ||
    currentTotal.tecnica !== totalComp.tecnica ||
    currentFaculty.tecnica !== facultyComp.tecnica ||
    currentTotal.actor !== totalComp.actor ||
    currentFaculty.actor !== facultyComp.actor ||
    workspace.frame_mode !== "opinion_universitaria" ||
    workspace.escenarios.length !== syncedWorkspace.escenarios.length ||
    syncedWorkspace.escenarios.some((expected, i) => {
      const current = workspace.escenarios[i];
      return !current ||
        current.id !== expected.id ||
        current.component_id !== expected.component_id ||
        current.redondeo_multiplo !== expected.redondeo_multiplo;
    });

  useEffect(() => {
    if (!needsSync) return;
    onSetComponentes([totalComp, facultyComp]);
    onWorkspace(syncedWorkspace);
  }, [facultyComp, needsSync, onSetComponentes, onWorkspace, syncedWorkspace, totalComp]);

  // Auto-reparación del handoff Marco → Cálculo: proyectos guardados antes del
  // sync automático pueden traer marco construido pero estudio en N = 0. Al
  // detectar ese estado, el estudio absorbe N y estratos del frame una vez
  // (marco_validado > 0 corta el efecto en el siguiente render).
  const framePoblacion = aulasState?.frame?.population;
  const frameAulas = aulasState?.frame ?? null;
  useEffect(() => {
    if (needsSync) return;
    if (safeNumber(totalComp.marco.marco_validado) > 0) return;
    const sync = estratosDesdeFrame(rowsFrom<Record<string, unknown>>(framePoblacion));
    if (!sync) return;
    // El divisor de cada facultad —cuántos alumnos caben en un curso-horario—
    // sale del perfil del marco recién cargado, no del mapa de referencia de
    // 2025. Sin esto el motor divide por los tamaños del año pasado aunque la
    // base sea otra, y `min_media_mediana` nunca puede dispararse porque la
    // mediana no llega.
    const estratos = conDivisorDelMarco(sync.estratos, facultadesDesdeFrame(frameAulas));
    const marcoPatch = {
      universo_bruto: sync.total,
      marco_validado: sync.total,
      marco_contactable: sync.total,
      estado: "validado" as const,
      estratos,
    };
    onSetComponentes([
      { ...totalComp, marco: { ...totalComp.marco, ...marcoPatch }, resultado: null },
      { ...facultyComp, marco: { ...facultyComp.marco, ...marcoPatch }, resultado: null },
    ]);
  }, [facultyComp, frameAulas, framePoblacion, needsSync, onSetComponentes, totalComp]);

  function setDraftTarget(componentId: string, value: number) {
    setDraftTargets((prev) => ({ ...prev, [componentId]: Math.max(0, Math.round(value)) }));
  }

  function applyTarget(componentId: string, value: number) {
    const target = Math.round(value);
    const comp = componentId === totalComp.id ? totalComp : facultyComp;
    const formula = componentFormulaBase(comp);
    if (formula && target < formula) return;
    const nextComp: CalcMuestraComponente = {
      ...comp,
      meta: {
        ...comp.meta,
        tipo: "objetivo",
        valor: target,
        variable_control: "facultad_sexo",
      },
      resultado: null,
    };
    const nextTotal = componentId === totalComp.id ? nextComp : totalComp;
    const nextFaculty = componentId === facultyComp.id ? nextComp : facultyComp;
    const nextWorkspace = universityWorkspace(syncedWorkspace, nextTotal, nextFaculty);
    const nextEstudio = { ...estudio, componentes: [nextTotal, nextFaculty], workspace: nextWorkspace };
    onSetComponentes(nextEstudio.componentes);
    onWorkspace(nextWorkspace);
    setDraftTargets((prev) => {
      const next = { ...prev };
      delete next[componentId];
      return next;
    });
    void onCalcular(nextEstudio);
  }

  function calculateSample() {
    const nextEstudio = prepareUniversityStudyForCalculation(
      { ...estudio, componentes: [totalComp, facultyComp], workspace: syncedWorkspace },
      syncedWorkspace,
      useMotorStore.getState().perfil.resumenEstAula,
    );
    onSetComponentes(nextEstudio.componentes);
    if (nextEstudio.workspace) onWorkspace(nextEstudio.workspace);
    void onCalcular(nextEstudio);
  }

  const selectedSection = ["definicion", "marco", "aulas", "calculo", "salidas"].includes(activeSection)
    ? activeSection
    : "definicion";
  // Motor reactivo: perfil efectivo (proyecto/manual/ejemplo) y resultados
  // en vivo, compartidos por la franja de resultados y las pestañas del motor.
  const opcionalesActivosMotor = useMotorStore((s) => s.decisiones.opcionalesActivos);
  const escenarioAulas = useMotorStore((s) => s.decisiones.escenario);
  const cursosHorarioConfirmado = useMotorStore((s) => s.decisiones.cursosHorarioConfirmado);
  const invalidarCursosHorarioPorMarco = useMotorStore((s) => s.invalidarCursosHorarioPorMarco);

  // Reconstrucción del marco duro (motor R): habilitada cuando hay una fuente
  // DEL MARCO con archivo declarado. La referencia histórica es analítica y no
  // acredita este gate. La suite de criterios lo dispara al aplicar cambios.
  const puedeReconstruirMarco = universityFrameSourceBindings(syncedWorkspace.source_bindings)
    .some((binding) => binding.file_id);

  const localTabs = universitySidebarTabs({
    activeSection: selectedSection,
    estudio,
    workspace: syncedWorkspace,
    aulasState,
  }) ?? [];
  const selectedLocalTab = localTabs.some((tab) => tab.id === activeLocalTab)
    ? activeLocalTab
    : localTabs[0]?.id ?? "";
  const activeContextTabKey = selectedSection === "aulas" ? activeLabTab : selectedLocalTab;
  const activeContextTabId = universityContextTabId(selectedSection, activeContextTabKey);
  const showLocalTab = (tabId: string) => selectedLocalTab === tabId;

  useLayoutEffect(() => {
    activePanelRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [selectedSection, activeContextTabKey]);
  const activeTabMeta = selectedSection === "aulas"
    ? localTabs.find((tab) => tab.classroomTab === activeLabTab)
    : localTabs.find((tab) => tab.id === selectedLocalTab);
  const componentMarcoReady = safeNumber(totalComp.marco.marco_validado) > 0 && (totalComp.marco.estratos ?? []).some((e) => safeNumber(e.N) > 0);
  const aulasFrameReady = Boolean(
    aulasState?.frame &&
    (
      rowsFrom(aulasState.frame.population).length > 0 ||
      rowsFrom(aulasState.frame.aula_frame).length > 0 ||
      frameAuditNumber(aulasState.frame, "population_n") > 0 ||
      frameAuditNumber(aulasState.frame, "classroom_n") > 0
    ),
  );
  const marcoReady = componentMarcoReady || aulasFrameReady;
  // Frescura del marco para la tab de Cálculo: si los criterios cambiaron desde
  // que se construyó el marco, el # de CH del marco (y por tanto el # de aulas)
  // puede estar stale. Misma señal que la tab de Marco, para que Cálculo nunca
  // muestre aulas de un marco viejo en silencio. La permutación del método (min/
  // media/mediana/LI) queda libre: solo se gatea la frescura del marco.
  const marcoDesactualizado = useMemo(
    () => {
      const configVigente = normalizeUniversityAulasConfig(syncedWorkspace.aulas_config);
      return marcoCriteriosDesactualizado(
        aulasState?.frame,
        configVigente.criterios_seleccion,
        configVigente.teacher_type_orden,
        { config: configVigente, opcionalesActivos: opcionalesActivosMotor },
      );
    },
    [aulasState?.frame, syncedWorkspace.aulas_config, opcionalesActivosMotor],
  );
  useEffect(() => {
    if (cursosHorarioConfirmado) invalidarCursosHorarioPorMarco(marcoDesactualizado);
  }, [marcoDesactualizado, cursosHorarioConfirmado, invalidarCursosHorarioPorMarco]);
  function seleccionarEscenarioAulas(next: UniversityAulasScenario) {
    if (next === escenarioAulas) return;
    onWorkspace(materializeUniversityAulasTarget({
      workspace: syncedWorkspace,
      escenario: next,
      totalComp,
      facultyComp,
    }));
    useMotorStore.getState().setEscenario(next);
  }
  function confirmarAlumnosPorCh(decision: CalcMuestraAlumnosPorChDecision) {
    const next = applyAlumnosPorChDecision({
      workspace: syncedWorkspace,
      componentes: [totalComp, facultyComp],
      decision,
    });
    onWorkspace(next.workspace);
    onSetComponentes(next.componentes);
    onInvalidateAulasArtifacts();
    useMotorStore.getState().invalidarCursosHorario();
  }
  // Bloques que R deriva al servir y que hasta ahora sólo vivían en el payload:
  // el margen de aulas por facultad viaja en `aulas_por_estrato` del componente
  // que dimensiona por facultad, y el balance de sexo en la selección.
  //
  // Exigir `margen` para aceptar las filas era un error medido contra HSVG2026:
  // ese campo lo publica R desde hace poco, así que un estudio calculado ANTES
  // trae `aulas_por_estrato` completo —estrato, N, cuota, aulas_base— y aun así
  // la tarjeta se caía entera y mostraba CERO facultades. El margen es UNO de
  // los seis pasos; su ausencia se pinta como «—», no borra los otros cinco.
  const margenFilas = useMemo(
    () => filasParaFichas(estudio.componentes ?? [], facultyComp),
    [estudio.componentes, facultyComp],
  );
  // Las reglas propias de cada facultad viven en la suite de criterios del
  // config vigente, indexadas por la clave normalizada del motor.
  const criteriosSeleccionVigente =
    (syncedWorkspace.aulas_config as { criterios_seleccion?: unknown } | undefined)
      ?.criterios_seleccion ?? null;
  const minimoGeneral = (() => {
    const cfg = syncedWorkspace.aulas_config as
      | { filters?: { min_eligible_per_class?: unknown } }
      | undefined;
    const n = Number(cfg?.filters?.min_eligible_per_class);
    return Number.isFinite(n) ? n : null;
  })();
  const referenciaCriterios = useMemo(
    () => normalizeCalcMuestraReferenciaCriterios(aulasState?.referencia_criterios ?? null),
    [aulasState?.referencia_criterios],
  );
  // Las cuentas por facultad salen del marco vigente; el histórico las enfrenta.
  const fichasFacultad = useMemo(() => {
    const af = aulasState?.frame?.aula_frame ?? [];
    const catalogo = new Map<string, number>();
    const elegibles = new Map<string, number>();
    const plazas = new Map<string, number[]>();
    for (const row of af as Array<Record<string, unknown>>) {
      const k = claveFicha(String(row.faculty ?? ""));
      if (!k) continue;
      catalogo.set(k, (catalogo.get(k) ?? 0) + 1);
      if (row.included === true) {
        elegibles.set(k, (elegibles.get(k) ?? 0) + 1);
        const n = Number(row.eligible_n);
        if (Number.isFinite(n)) plazas.set(k, [...(plazas.get(k) ?? []), n]);
      }
    }
    // M1 del sorteo vigente, por facultad: alimenta el paso 7 de la ficha
    // («Titulares seleccionados» contra los titulares 2025 de la referencia).
    // Sin selección corrida el mapa queda vacío y el paso viaja null, no 0.
    const titularesM1 = new Map<string, number>();
    const seleccionFilas = (aulasState?.selection as { selection?: unknown } | null)?.selection;
    if (Array.isArray(seleccionFilas)) {
      for (const raw of seleccionFilas) {
        const r = raw as { wave?: unknown; faculty?: unknown };
        if (r?.wave !== "M1" || typeof r.faculty !== "string") continue;
        const k = claveFicha(r.faculty);
        titularesM1.set(k, (titularesM1.get(k) ?? 0) + 1);
      }
    }
    return (margenFilas ?? []).map((fila) => {
      const k = claveFicha(fila.estrato);
      const v = [...(plazas.get(k) ?? [])].sort((a, b) => a - b);
      // El estadístico que dimensiona es el que R aplicó; si no lo publicó, no
      // se inventa uno distinto.
      const est = Number.isFinite(fila.avg_conglomerado) ? fila.avg_conglomerado : null;
      return fichaDeFacultad(
        fila,
        catalogo.get(k) ?? null,
        elegibles.get(k) ?? (v.length || null),
        est,
        referenciaCriterios,
        criteriosSeleccionVigente,
        minimoGeneral,
        titularesM1.size ? (titularesM1.get(k) ?? null) : null,
      );
    });
  }, [aulasState?.frame?.aula_frame, aulasState?.selection, margenFilas, referenciaCriterios, criteriosSeleccionVigente, minimoGeneral]);
  // Los criterios que deciden qué aulas entran. Se leen del config QUE PRODUJO
  // EL MARCO (`aulasState.config`), no del workspace: son dos copias distintas y
  // la del workspace puede ir por detrás. Medido en HSVG2026 con el marco
  // reconstruido: el workspace decía «nivel: no se aplica» y «facultades
  // excluidas: ninguna» mientras el motor tenía los rangos y las dos escuelas
  // fuera.
  const criteriosMarco = useMemo<CriterioGeneralFila[]>(() => {
    const delMotor = aulasState?.config as
      | { criterios_seleccion?: unknown; filters?: Record<string, unknown> }
      | undefined;
    return criteriosMarcoDeEstudio(
      delMotor?.criterios_seleccion ?? criteriosSeleccionVigente,
      delMotor?.filters ??
        (syncedWorkspace.aulas_config as { filters?: Record<string, unknown> } | undefined)?.filters,
    );
  }, [aulasState?.config, criteriosSeleccionVigente, syncedWorkspace.aulas_config]);
  const criteriosGenerales = useMemo<CriterioGeneralFila[]>(
    () =>
      criteriosGeneralesDeEstudio({
        parametros: facultyComp?.parametros as Record<string, unknown> | undefined,
        decision: (syncedWorkspace.aulas_config as
          { alumnos_por_ch_decision?: Record<string, unknown> } | undefined)
          ?.alumnos_por_ch_decision,
        selector: syncedWorkspace.aulas_config as Record<string, unknown> | undefined,
        aulasMarco:
          (aulasState?.frame?.aula_frame ?? []).filter(
            (r) => (r as Record<string, unknown>).included === true,
          ).length || null,
        filas: margenFilas,
      }),
    [margenFilas, aulasState?.frame?.aula_frame, facultyComp, syncedWorkspace.aulas_config],
  );
  // La afijación del diseño viaja en el config del seleccionar: sin esto el
  // sorteo reparte por masa de elegibles e ignora el aulas_base por facultad
  // que el propio cálculo publicó (medido: desvío 68/202 en HSVG2026).
  const onSeleccionarAulasConAfijacion = useCallback(
    (config: CalcMuestraWorkspaceAulasConfig, methodId?: string) =>
      onSeleccionarAulas(conAfijacionDelEstudio(config, margenFilas), methodId),
    [onSeleccionarAulas, margenFilas],
  );
  const sexoBalance = useMemo(
    () => normalizeCalcMuestraSexoPorFacultad(
      (aulasState?.selection as { sexo_por_facultad?: unknown } | null)?.sexo_por_facultad ?? null,
    ),
    [aulasState?.selection],
  );
  // La certificación por facultad de la selección (Gonzalo: «tiene que
  // certificarse de esa forma»): derivada al servir por el motor, la UI solo
  // la normaliza y la muestra.
  // Acción REGISTRADA desde la certificación: «darle un aula más» a una
  // facultad fija sus titulares en el estrato del estudio (aulas_base_fijas);
  // invalidar los artefactos deja los banners existentes guiando el
  // recalcular → seleccionar que la aplica. Nada manual.
  const certificacionFacultad = useMemo(
    () => normalizeCalcMuestraCertificacionFacultad(
      (aulasState?.selection as { certificacion_facultad?: unknown } | null)?.certificacion_facultad ?? null,
    ),
    [aulasState?.selection],
  );
  const labModel = useMemo(
    () => buildClassroomLabModel({ workspace: syncedWorkspace, totalComp, facultyComp, aulasState, marcoDesactualizado }),
    [syncedWorkspace, totalComp, facultyComp, aulasState, marcoDesactualizado],
  );
  const calculationReady = labModel.selectedResultReady;
  const selectionReady = labModel.selectionReady;
  // H2 (2026-08-19): estas acciones escribian SIEMPRE en facultyComp, pero el
  // motor dimensiona con el componente del ESCENARIO ACTIVO (selectedComp) —
  // en e1 la fijacion caia en un componente que nadie leia. Ambas apuntan al
  // componente que el motor usa; el letrero lee el mismo.
  const compActivo = labModel.selectedComp ?? facultyComp;
  const onAgregarAulaFacultad = useCallback(
    (facultad: string, aulasActuales: number) => {
      if (!compActivo) return;
      const nuevos = estratosConAulaExtra(compActivo.marco?.estratos ?? null, facultad, aulasActuales);
      if (!nuevos) return;
      onComponente(compActivo.id, { marco: { estratos: nuevos } });
      onInvalidateAulasArtifacts();
    },
    [compActivo, onComponente, onInvalidateAulasArtifacts],
  );
  const onAjustarAulaFacultad = useCallback(
    (facultad: string, aulasActuales: number, delta: 1 | -1) => {
      if (!compActivo) return;
      const nuevos = estratosConAjusteAula(compActivo.marco?.estratos ?? null, facultad, aulasActuales, delta);
      if (!nuevos) return;
      onComponente(compActivo.id, { marco: { estratos: nuevos } });
      onInvalidateAulasArtifacts();
    },
    [compActivo, onComponente, onInvalidateAulasArtifacts],
  );

  // Marco construido pero cálculo en N = 0 y sin población en memoria
  // (proyectos guardados antes del sync automático): la reparación exige
  // reconstruir el marco desde la base embebida — CTA visible de un clic.
  const marcoDesincronizado =
    aulasFrameReady &&
    !componentMarcoReady &&
    rowsFrom(aulasState?.frame?.population).length === 0 &&
    universityFrameSourceBindings(syncedWorkspace.source_bindings)
      .some((binding) => binding.file_id);

  return (
    <div className="cmv2-desk cmv2-university-desk">
      {marcoDesincronizado && (
        <div className="cmv2-uni-resync" role="status">
          <TriangleAlert size={15} aria-hidden="true" />
          <div className="cmv2-uni-resync-copy">
            <strong>El marco está construido, pero el cálculo aún no tiene N.</strong>
            <span>
              Este proyecto se guardó antes de la sincronización automática. Reconstruye el marco desde tu base
              (queda embebida en el proyecto) y el cálculo recibirá N y los estratos por facultad y sexo.
            </span>
          </div>
          <button
            type="button"
            className="cmv2-primary"
            disabled={Boolean(busy)}
            onClick={() => void onSourceBuild(syncedWorkspace)}
          >
            {busy ? <Loader2 size={13} className="pulso-spin" aria-hidden="true" /> : <RefreshCw size={13} aria-hidden="true" />}
            Reconstruir y sincronizar
          </button>
        </div>
      )}
      {activeTabMeta ? (
        <UniversityTabHeader tab={activeTabMeta} />
      ) : null}
      <div className="cmv2-university-workbench" data-active-section={selectedSection}>
        {selectedSection === "definicion" && (
          <div ref={activePanelRef} id="cmv2-section-university-setup" className="cmv2-tab-panel" role="tabpanel" aria-labelledby={activeContextTabId}>
            {showLocalTab("def-estudio") && <div id="cmv2-local-def-estudio">
              <DefEstudioTab
                estudio={estudio}
                workspace={syncedWorkspace}
                totalComp={totalComp}
                aulasState={aulasState}
                onTitulo={onTitulo}
                onContexto={onContexto}
                onWorkspace={onWorkspace}
              />
            </div>}
            {/* D10: Fuentes declara y construye; Consistencia califica el
                insumo en su propia pestaña, inmediatamente después. */}
            {showLocalTab("def-bases") && <div id="cmv2-local-def-bases" className="cmv2-definition-stack">
              <DefBasesTab
                workspace={syncedWorkspace}
                aulasState={aulasState}
                referencia={referenciaAsistencia}
                onWorkspace={onWorkspace}
                onSourceUpload={onSourceUpload}
                onSourceBuild={onSourceBuild}
                onReferenceSheetChange={onReferenceSheetChange}
                uploadingSourceId={uploadingSourceId}
              />
            </div>}
            {showLocalTab("def-consistencia") && <div id="cmv2-local-def-consistencia" className="cmv2-definition-stack">
              <DefConsistenciaTab workspace={syncedWorkspace} aulasState={aulasState} />
            </div>}
            {showLocalTab("def-explorador") && <div id="cmv2-local-def-explorador" className="cmv2-definition-stack">
              <ExploradorBasesTab
                aulasState={aulasState}
                workspace={syncedWorkspace}
                onReconstruir={() => void onSourceBuild(syncedWorkspace)}
                puedeReconstruir={puedeReconstruirMarco && !busy}
                reconstruyendo={Boolean(busy)}
              />
            </div>}
            {showLocalTab("def-historico") && <div id="cmv2-local-def-historico" className="cmv2-definition-stack">
              {/* G44: Histórico sólo lee. La base se sube en Fuentes. */}
              <DefHistoricoTab
                aulasState={aulasState}
                referencia={referenciaAsistencia}
              />
            </div>}
            {showLocalTab("def-variables") && <div id="cmv2-local-def-variables" className="cmv2-definition-stack">
              <DefVariablesTab
                workspace={syncedWorkspace}
                aulasState={aulasState}
                onWorkspace={onWorkspace}
              />
            </div>}
          </div>
        )}

        {selectedSection === "marco" && (
          <div ref={activePanelRef} id="cmv2-section-university-marco" className="cmv2-tab-panel" role="tabpanel" aria-labelledby={activeContextTabId}>
            {showLocalTab("marco-criterios-alumno") && <div id="cmv2-local-marco-criterios-alumno">
              {/* Las tarjetas comparativas VIVEN EN ENTREGA, no acá: en Marco
                  todavía no hay estratos resueltos y salían vacías. Ver
                  `SalidasCoincidenciaTab`. */}
              <CriteriosMarcoTab
                scope="alumno"
                workspace={syncedWorkspace}
                aulasState={aulasState}
                facultades={motor.perfil.facultades.map((f) => f.nombre)}
                onWorkspace={onWorkspace}
                onReconstruir={() => void onSourceBuild(syncedWorkspace)}
                puedeReconstruir={puedeReconstruirMarco && !busy}
                reconstruyendo={Boolean(busy)}
                onNavigate={onNavigate}
              />
            </div>}
            {showLocalTab("marco-alumnos-ch") && <div id="cmv2-local-marco-alumnos-ch">
              <AlumnosPorChMarcoTab
                workspace={syncedWorkspace}
                aulasState={aulasState}
                onConfirmDecision={confirmarAlumnosPorCh}
                motorPideRefirmar={motorPideRefirmarAlumnosCh}
              />
            </div>}
            {showLocalTab("marco-ch-radiografia") && <div id="cmv2-local-marco-ch-radiografia">
              <CursosHorarioMarcoTab
                workspace={syncedWorkspace}
                aulasState={aulasState}
                facultades={motor.perfil.facultades.map((f) => f.nombre)}
                onWorkspace={onWorkspace}
                onReconstruir={() => void onSourceBuild(syncedWorkspace)}
                puedeReconstruir={puedeReconstruirMarco && !busy}
                reconstruyendo={Boolean(busy)}
                onNavigate={onNavigate}
              />
            </div>}
            {showLocalTab("marco-cobertura") && <div id="cmv2-local-marco-cobertura" className="rec-recorrido rec-recorrido--full">
              <TabCobertura perfil={motor.perfil} aulasState={aulasState} />
            </div>}
            {showLocalTab("marco-poblacion") && <div id="cmv2-local-marco-poblacion">
              <MarcoPoblacionTab workspace={syncedWorkspace} totalComp={totalComp} aulasState={aulasState} />
            </div>}
            {showLocalTab("marco-aulas") && <div id="cmv2-local-marco-aulas">
              <MarcoAulasTab workspace={syncedWorkspace} aulasState={aulasState} onWorkspace={onWorkspace} />
            </div>}
          </div>
        )}

        {selectedSection === "aulas" && (
          <div ref={activePanelRef} id="cmv2-section-university-aulas" className="cmv2-tab-panel" role="tabpanel" aria-labelledby={activeContextTabId}>
            {activeLabTab === "objetivo" && (
              <AulasObjetivoTab workspace={syncedWorkspace} model={labModel} onWorkspace={onWorkspace} onNavigate={onNavigate} />
            )}
            {activeLabTab === "metodo" && (
              <AulasMetodoTab
                workspace={syncedWorkspace}
                model={labModel}
                busy={busy}
                onWorkspace={onWorkspace}
                onCompare={onCompararAulas}
                onSelectMethod={onSeleccionarAulasConAfijacion}
                onNavigate={onNavigate}
              />
            )}
            {activeLabTab === "laboratorio" && (
              <AulasSimulacionTab model={labModel} busy={busy} onCompare={onCompararAulas} onNavigate={onNavigate} />
            )}
            {activeLabTab === "seleccion" && (
              <AulasSeleccionTab
                workspace={syncedWorkspace}
                model={labModel}
                busy={busy}
                onSelectMethod={onSeleccionarAulasConAfijacion}
                onSimulateReplacements={onSimularReemplazos}
                onNavigate={onNavigate}
                certeza={aulasState?.certeza ?? null}
                margenFilas={margenFilas}
                sexoBalance={sexoBalance}
                certificacion={certificacionFacultad}
                onAgregarAula={onAgregarAulaFacultad}
                onAjustarAula={onAjustarAulaFacultad}
                fichas={fichasFacultad}
                periodoAnterior={referenciaCriterios?.periodo ?? ""}
                referencia={referenciaAsistencia}
              />
            )}
            {activeLabTab === "perfil" && (
              <AulasPerfilTab
                titulares={labModel.m1Rows}
                marco={aulasState?.frame?.aula_frame ?? []}
                referencia={referenciaAsistencia}
              />
            )}
            {activeLabTab === "reemplazos" && (
              <AulasReemplazosTab model={labModel} busy={busy} onSimulateReplacements={onSimularReemplazos} onNavigate={onNavigate} referencia={referenciaAsistencia} />
            )}
            {activeLabTab === "aulas-relato" && (
              <RelatoTab model={labModel} foco={activeFocus} onNavigate={onNavigate} />
            )}
            {activeLabTab === "auditoria" && <AulasAuditoriaTab model={labModel} onNavigate={onNavigate} />}
          </div>
        )}

        {selectedSection === "calculo" && (
          <div ref={activePanelRef} id="cmv2-section-university-calculo" className="cmv2-tab-panel" role="tabpanel" aria-labelledby={activeContextTabId}>
            {showLocalTab("calculo-diseno") && <div id="cmv2-local-calculo-diseno">
              <CalculoDisenoTab
                totalComp={totalComp}
                facultyComp={facultyComp}
                referenciaAsistencia={referenciaAsistencia}
                marcoReady={marcoReady}
                onSetComponentes={onSetComponentes}
                onCalcular={calculateSample}
                calculando={calculando}
              />
            </div>}
            {showLocalTab("calculo-propuestas") && <div id="cmv2-local-calculo-propuestas">
              <CalculoPropuestasTab
                componentes={[totalComp, facultyComp]}
                workspace={syncedWorkspace}
                marcoReady={marcoReady}
                draftTargets={draftTargets}
                onDraftTarget={setDraftTarget}
                onApplyTarget={applyTarget}
                onCalcular={calculateSample}
                calculando={calculando}
              />
            </div>}
            {showLocalTab("calculo-ch-facultad") && <div id="cmv2-local-calculo-ch-facultad">
              <CalculoCursosHorarioFacultadTab
                componentes={[totalComp, facultyComp]}
                currentFrameHash={aulasState?.frame?.frame_hash}
                escenario={escenarioAulas}
                onEscenario={seleccionarEscenarioAulas}
                marcoDesactualizado={marcoDesactualizado}
                certeza={aulasState?.certeza ?? null}
                certezaEnCurso={midiendoCerteza}
                onMedirCerteza={onMedirCerteza}
              />
            </div>}
            {showLocalTab("calculo-distribucion") && <div id="cmv2-local-calculo-distribucion">
              <CalculoDistribucionTab
                componentes={[totalComp, facultyComp]}
                currentFrameHash={aulasState?.frame?.frame_hash}
                escenario={escenarioAulas}
                onEscenario={seleccionarEscenarioAulas}
              />
            </div>}
          </div>
        )}

        {selectedSection === "salidas" && (
          <div ref={activePanelRef} id="cmv2-section-university-salidas" className="cmv2-tab-panel" role="tabpanel" aria-labelledby={activeContextTabId}>
            {showLocalTab("salidas-coincidencia") && <div id="cmv2-local-salidas-coincidencia">
              <SalidasCoincidenciaTab
                criteriosGenerales={criteriosGenerales}
                criteriosMarco={criteriosMarco}
                fichas={fichasFacultad}
                referencia={referenciaCriterios}
                certificacion={certificacionFacultad}
                referenciaAsistencia={referenciaAsistencia}
                seleccion={aulasState?.selection ?? null}
              />
            </div>}
            {showLocalTab("salidas-guia") && <div id="cmv2-local-salidas-guia">
              <SalidasCierreTab model={labModel} workspace={syncedWorkspace} />
            </div>}
            {showLocalTab("salidas-resultados") && <div id="cmv2-local-salidas-resultados">
              <SalidasResultadosTab
                componentes={[totalComp, facultyComp]}
                workspace={syncedWorkspace}
                onWorkspace={onWorkspace}
              />
            </div>}
            {showLocalTab("salidas-entregables") && <div id="cmv2-local-salidas-entregables">
              <SalidasEntregablesTab
                model={labModel}
                workspace={syncedWorkspace}
                onWorkspace={onWorkspace}
                reporte={{
                  puedeGenerar: calculationReady,
                  enCurso: reporteEnCurso,
                  disponible: reporteDisponible,
                  stale: reporteStale,
                  formato: reporteFormato,
                  onFormato: setReporteFormato,
                  onGenerar: () => onGenerarReporte(reporteFormato),
                  descargarUrl: reporteDescargarUrl,
                  aulasListas: selectionReady,
                  exportandoAulas,
                  onExportarAulas,
                  aulasExportFilename: aulasState?.export?.filename ?? null,
                }}
                paquete={{
                  puedeGenerar: calculationReady && selectionReady,
                  hint: !selectionReady
                    ? "Genera la selección de cursos-horario (sección Selección) para armar el paquete completo."
                    : !calculationReady
                      ? "Calcula la muestra (sección Cálculo) para armar el paquete completo."
                      : undefined,
                  enCurso: paqueteEnCurso,
                  pasos: paquetePasos,
                  onGenerar: () => onGenerarPaqueteDefensa(reporteFormato),
                }}
              />
            </div>}
            {showLocalTab("salidas-monitoreo") && <div id="cmv2-local-salidas-monitoreo">
              <SalidasMonitoreoTab model={labModel} />
            </div>}
          </div>
        )}
      </div>
    </div>
  );
}
