/**
 * Mesa universitaria "Muestra de aulas": orquesta las cinco secciones del rail
 * (Definición, Marco, Cálculo, Aulas y Salidas) montando la pestaña local
 * activa de cada una. Movida desde CalcMuestraPage (antes
 * OpinionUniversitariaDeskRevamp) con el mismo contrato de props; el estado de
 * navegación (sección, pestaña local y pestaña del laboratorio) sigue viviendo
 * en la página contenedora.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import {
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
import { DefEstudioTab, DefFuentesConsistenciaTab, DefVariablesTab } from "./definicion";
import { AlumnosPorChMarcoTab, CursosHorarioMarcoTab, MarcoAulasTab, MarcoPoblacionTab } from "./marco";
import { applyAlumnosPorChDecision } from "./marco/alumnosPorChDecisionHandoff";
import { CriteriosMarcoTab } from "./criterios";
import { CalculoCursosHorarioFacultadTab, CalculoDisenoTab, CalculoPropuestasTab } from "./calculo";
import {
  AulasAuditoriaTab,
  AulasMetodoTab,
  AulasObjetivoTab,
  AulasReemplazosTab,
  AulasSeleccionTab,
  AulasSimulacionTab,
  buildClassroomLabModel,
} from "./aulas";
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
import { TabDistribucion } from "../motor/pestanas/TabDistribucion";
import { UniversityTabHeader } from "./ui/UniversityTabHeader";
import { universityFrameSourceBindings } from "./shared/categorias";

export function universityContextTabId(section: string, key: string) {
  return `cmv2-context-tab-${section}-${key}`;
}

export function UniversidadDesk({
  estudio,
  workspace,
  aulasState,
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
  useEffect(() => {
    if (needsSync) return;
    if (safeNumber(totalComp.marco.marco_validado) > 0) return;
    const sync = estratosDesdeFrame(rowsFrom<Record<string, unknown>>(framePoblacion));
    if (!sync) return;
    const marcoPatch = {
      universo_bruto: sync.total,
      marco_validado: sync.total,
      marco_contactable: sync.total,
      estado: "validado" as const,
      estratos: sync.estratos,
    };
    onSetComponentes([
      { ...totalComp, marco: { ...totalComp.marco, ...marcoPatch }, resultado: null },
      { ...facultyComp, marco: { ...facultyComp.marco, ...marcoPatch }, resultado: null },
    ]);
  }, [facultyComp, framePoblacion, needsSync, onSetComponentes, totalComp]);

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
  const labModel = useMemo(
    () => buildClassroomLabModel({ workspace: syncedWorkspace, totalComp, facultyComp, aulasState, marcoDesactualizado }),
    [syncedWorkspace, totalComp, facultyComp, aulasState, marcoDesactualizado],
  );
  const calculationReady = labModel.selectedResultReady;
  const selectionReady = labModel.selectionReady;

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
            {showLocalTab("def-bases") && <div id="cmv2-local-def-bases" className="cmv2-definition-stack">
              <DefFuentesConsistenciaTab
                focusConsistency={activeFocus === "def-consistencia"}
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
            {showLocalTab("marco-alumnos-ch") && <div id="cmv2-local-marco-alumnos-ch">
              <AlumnosPorChMarcoTab
                workspace={syncedWorkspace}
                aulasState={aulasState}
                onConfirmDecision={confirmarAlumnosPorCh}
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
                onSelectMethod={onSeleccionarAulas}
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
                onSelectMethod={onSeleccionarAulas}
                onSimulateReplacements={onSimularReemplazos}
                onNavigate={onNavigate}
              />
            )}
            {activeLabTab === "reemplazos" && (
              <AulasReemplazosTab model={labModel} busy={busy} onSimulateReplacements={onSimularReemplazos} onNavigate={onNavigate} />
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
                escenario={escenarioAulas}
                onEscenario={seleccionarEscenarioAulas}
                marcoDesactualizado={marcoDesactualizado}
              />
            </div>}
            {showLocalTab("calculo-distribucion") && <div id="cmv2-local-calculo-distribucion" className="rec-recorrido rec-recorrido--full">
              <TabDistribucion perfil={motor.perfil} e1={motor.e1} marcoDesactualizado={marcoDesactualizado} />
            </div>}
          </div>
        )}

        {selectedSection === "salidas" && (
          <div ref={activePanelRef} id="cmv2-section-university-salidas" className="cmv2-tab-panel" role="tabpanel" aria-labelledby={activeContextTabId}>
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
