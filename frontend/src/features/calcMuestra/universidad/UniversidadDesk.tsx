/**
 * Mesa universitaria "Muestra de aulas": orquesta las cinco secciones del rail
 * (Definición, Marco, Cálculo, Aulas y Salidas) montando la pestaña local
 * activa de cada una. Movida desde CalcMuestraPage (antes
 * OpinionUniversitariaDeskRevamp) con el mismo contrato de props; el estado de
 * navegación (sección, pestaña local y pestaña del laboratorio) sigue viviendo
 * en la página contenedora.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import {
  type CalcMuestraAulasState,
  type CalcMuestraComponente,
  type CalcMuestraEstudio,
  type CalcMuestraParametros,
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
import { classroomSelectionReady, frameAuditNumber } from "./shared/frame";
import {
  componentFormulaBase,
  estratosDesdeFrame,
  hasUsefulResult,
  prepareUniversityStudyForCalculation,
  universityComponents,
  universityDefaultWorkspace,
  universityWorkspace,
} from "./shared/study";
import { universitySidebarTabs } from "./universidadTabs";
import { DefBasesTab, DefCategoriasTab, DefEstudioTab, DefVariablesTab } from "./definicion";
import { MarcoAulasTab, MarcoConsistenciaTab, MarcoPoblacionTab } from "./marco";
import { CriteriosMarcoTab } from "./criterios";
import { CalculoPropuestasTab, CalculoSupuestosTab } from "./calculo";
import {
  AulasAuditoriaTab,
  AulasMarcoTab,
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
import { zFromConfidence } from "../didactica/motorPreview";
import { ResumenDiseno } from "../motor/ResumenDiseno";
import { usePerfilEfectivo } from "../motor/usePerfilEfectivo";
import { useMotorStore } from "../motor/store";
import { TabDatos } from "../motor/pestanas/TabDatos";
import { TabCalculo } from "../motor/pestanas/TabCalculo";
import { TabCobertura } from "../motor/pestanas/TabCobertura";
import { TabDistribucion } from "../motor/pestanas/TabDistribucion";

export function UniversidadDesk({
  estudio,
  workspace,
  aulasState,
  busy,
  activeSection,
  activeLocalTab,
  activeLabTab,
  onTitulo,
  onContexto,
  onWorkspace,
  onComponente,
  onSetComponentes,
  onCalcular,
  onCompararAulas,
  onSeleccionarAulas,
  onSimularReemplazos,
  onSourceUpload,
  onSourceBuild,
  uploadingSourceId,
  calculando,
  onGenerarReporte,
  reporteEnCurso,
  reporteDisponible,
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
  busy: string | null;
  activeSection: string;
  activeLocalTab: string;
  activeLabTab: ClassroomLabTab;
  onGenerarReporte: (formato: "html" | "pdf") => void;
  reporteEnCurso: boolean;
  reporteDisponible: boolean;
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
  onCalcular: (estudioOverride?: CalcMuestraEstudio) => void | Promise<void>;
  onCompararAulas: (config: CalcMuestraWorkspaceAulasConfig, simulationRuns: number) => void | Promise<void>;
  onSeleccionarAulas: (config: CalcMuestraWorkspaceAulasConfig, methodId?: string) => void | Promise<void>;
  onSimularReemplazos: (config: CalcMuestraWorkspaceAulasConfig) => void | Promise<void>;
  onSourceUpload: (binding: CalcMuestraWorkspaceSourceBinding, file: File) => void | Promise<void>;
  onSourceBuild: (workspace: CalcMuestraWorkspace) => void | Promise<void>;
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

  // Aplica el mismo patch de parámetros a ambos escenarios en UNA pasada
  // (evita que dos updateComponente seguidos se pisen el estado) y anula el
  // resultado, siguiendo la convención del desk: editar supuestos invalida.
  function aplicarParametroCompartido(patch: Partial<CalcMuestraParametros>) {
    onSetComponentes([
      { ...totalComp, parametros: { ...totalComp.parametros, ...patch }, resultado: null },
      { ...facultyComp, parametros: { ...facultyComp.parametros, ...patch }, resultado: null },
    ]);
  }

  // Lleva los parámetros explorados en los sliders didácticos al estudio real
  // y recalcula con el motor R (misma vía que el resto del desk).
  function aplicarParametrosDidacticos(patch: Partial<CalcMuestraParametros>) {
    const nextTotal: CalcMuestraComponente = {
      ...totalComp,
      parametros: { ...totalComp.parametros, ...patch },
      resultado: null,
    };
    const nextFaculty: CalcMuestraComponente = {
      ...facultyComp,
      parametros: { ...facultyComp.parametros, ...patch },
      resultado: null,
    };
    const nextEstudio = prepareUniversityStudyForCalculation(
      { ...estudio, componentes: [nextTotal, nextFaculty], workspace: syncedWorkspace },
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
  const motor = usePerfilEfectivo(estudio, aulasState);
  const parametrosMotor = useMotorStore((s) => s.decisiones.parametros);

  // Reconstrucción del marco duro (motor R): habilitada cuando hay una fuente
  // con archivo declarado. La suite de criterios la dispara al aplicar cambios.
  const puedeReconstruirMarco = (syncedWorkspace.source_bindings ?? []).some((binding) => binding.file_id);

  // Lleva los parámetros del diseño reactivo al estudio real y calcula con R
  // (misma vía que el resto del desk: patch compartido + prepare + calcular).
  function aplicarDisenoAlEstudio() {
    aplicarParametrosDidacticos({
      z: zFromConfidence(parametrosMotor.confianza),
      p: parametrosMotor.proporcion,
      e: parametrosMotor.margenError,
      deff: parametrosMotor.deff,
      oversample_pct: Math.max(parametrosMotor.factorSobremuestra - 1, 0),
    });
  }
  const localTabs = universitySidebarTabs({
    activeSection: selectedSection,
    estudio,
    workspace: syncedWorkspace,
    aulasState,
  }) ?? [];
  const selectedLocalTab = localTabs.some((tab) => tab.id === activeLocalTab)
    ? activeLocalTab
    : localTabs[0]?.id ?? "";
  const showLocalTab = (tabId: string) => selectedLocalTab === tabId;
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
  const calculationReady = hasUsefulResult(totalComp) || hasUsefulResult(facultyComp);
  const selectionReady = classroomSelectionReady(aulasState);
  const labModel = useMemo(
    () => buildClassroomLabModel({ workspace: syncedWorkspace, totalComp, facultyComp, aulasState }),
    [syncedWorkspace, totalComp, facultyComp, aulasState],
  );

  // Marco construido pero cálculo en N = 0 y sin población en memoria
  // (proyectos guardados antes del sync automático): la reparación exige
  // reconstruir el marco desde la base embebida — CTA visible de un clic.
  const marcoDesincronizado =
    aulasFrameReady &&
    !componentMarcoReady &&
    rowsFrom(aulasState?.frame?.population).length === 0 &&
    (syncedWorkspace.source_bindings ?? []).some((binding) => binding.file_id);

  return (
    <div className="cmv2-desk">
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
      <ResumenDiseno motor={motor} />
      <div className="cmv2-university-workbench" data-active-section={selectedSection}>
        {selectedSection === "definicion" && (
          <div id="cmv2-section-university-setup" className="cmv2-tab-panel" role="tabpanel" aria-label="Definición">
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
              <DefBasesTab
                workspace={syncedWorkspace}
                aulasState={aulasState}
                onWorkspace={onWorkspace}
                onSourceUpload={onSourceUpload}
                onSourceBuild={onSourceBuild}
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
            {showLocalTab("def-categorias") && <div id="cmv2-local-def-categorias" className="cmv2-definition-stack">
              <DefCategoriasTab
                workspace={syncedWorkspace}
                aulasState={aulasState}
                onWorkspace={onWorkspace}
              />
            </div>}
            {showLocalTab("def-institucion") && <div id="cmv2-local-def-institucion" className="rec-recorrido">
              <TabDatos
                perfilEfectivo={motor.perfil}
                usaProyecto={motor.usaProyecto}
                hayDatosProyecto={motor.hayDatosProyecto}
                onIrAFuentes={() => onNavigate("definicion", "def-bases")}
              />
            </div>}
          </div>
        )}

        {selectedSection === "marco" && (
          <div id="cmv2-section-university-marco" className="cmv2-tab-panel" role="tabpanel" aria-label="Marco muestral">
            {showLocalTab("marco-categorias") && <div id="cmv2-local-marco-categorias">
              <CriteriosMarcoTab
                workspace={syncedWorkspace}
                aulasState={aulasState}
                facultades={motor.perfil.facultades.map((f) => f.nombre)}
                marcoAulas={motor.perfil.marcoAulas}
                poblacionN={motor.perfil.facultades.reduce((sum, f) => sum + safeNumber(f.N, 0), 0) || null}
                onWorkspace={onWorkspace}
                onReconstruir={() => void onSourceBuild(syncedWorkspace)}
                puedeReconstruir={puedeReconstruirMarco && !busy}
                reconstruyendo={Boolean(busy)}
              />
            </div>}
            {showLocalTab("marco-cobertura") && <div id="cmv2-local-marco-cobertura" className="rec-recorrido rec-recorrido--full">
              <TabCobertura perfil={motor.perfil} cob={motor.cob} />
            </div>}
            {showLocalTab("marco-poblacion") && <div id="cmv2-local-marco-poblacion">
              <MarcoPoblacionTab workspace={syncedWorkspace} totalComp={totalComp} aulasState={aulasState} />
            </div>}
            {showLocalTab("marco-aulas") && <div id="cmv2-local-marco-aulas">
              <MarcoAulasTab workspace={syncedWorkspace} aulasState={aulasState} />
            </div>}
            {showLocalTab("marco-validacion") && <div id="cmv2-local-marco-validacion">
              <MarcoConsistenciaTab workspace={syncedWorkspace} aulasState={aulasState} />
            </div>}
          </div>
        )}

        {selectedSection === "aulas" && (
          <div id="cmv2-section-university-aulas" className="cmv2-tab-panel" role="tabpanel" aria-label="Aulas y selección">
            {activeLabTab === "marco" && <AulasMarcoTab model={labModel} />}
            {activeLabTab === "objetivo" && (
              <AulasObjetivoTab workspace={syncedWorkspace} model={labModel} onWorkspace={onWorkspace} />
            )}
            {activeLabTab === "metodo" && (
              <AulasMetodoTab
                workspace={syncedWorkspace}
                model={labModel}
                busy={busy}
                onWorkspace={onWorkspace}
                onCompare={onCompararAulas}
                onSelectMethod={onSeleccionarAulas}
              />
            )}
            {activeLabTab === "laboratorio" && (
              <AulasSimulacionTab model={labModel} busy={busy} onCompare={onCompararAulas} />
            )}
            {activeLabTab === "seleccion" && (
              <AulasSeleccionTab
                workspace={syncedWorkspace}
                model={labModel}
                busy={busy}
                onSelectMethod={onSeleccionarAulas}
                onSimulateReplacements={onSimularReemplazos}
              />
            )}
            {activeLabTab === "reemplazos" && (
              <AulasReemplazosTab model={labModel} busy={busy} onSimulateReplacements={onSimularReemplazos} />
            )}
            {activeLabTab === "auditoria" && <AulasAuditoriaTab model={labModel} />}
          </div>
        )}

        {selectedSection === "calculo" && (
          <div id="cmv2-section-university-calculo" className="cmv2-tab-panel" role="tabpanel" aria-label="Cálculo">
            {showLocalTab("calculo-diseno") && <div id="cmv2-local-calculo-diseno" className="rec-recorrido">
              <TabCalculo
                perfil={motor.perfil}
                e1={motor.e1}
                e2={motor.e2}
                onAplicarAlEstudio={motor.usaProyecto && marcoReady ? aplicarDisenoAlEstudio : undefined}
                calculando={calculando}
              />
            </div>}
            {showLocalTab("calculo-distribucion") && <div id="cmv2-local-calculo-distribucion" className="rec-recorrido rec-recorrido--full">
              <TabDistribucion perfil={motor.perfil} e1={motor.e1} />
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
            {showLocalTab("calculo-ajustes") && <div id="cmv2-local-calculo-ajustes">
              <CalculoSupuestosTab
                totalComp={totalComp}
                facultyComp={facultyComp}
                workspace={syncedWorkspace}
                onComponente={onComponente}
                onParametroCompartido={aplicarParametroCompartido}
                onCalcular={calculateSample}
                calculando={calculando}
              />
            </div>}
          </div>
        )}

        {selectedSection === "salidas" && (
          <div id="cmv2-section-university-salidas" className="cmv2-tab-panel" role="tabpanel" aria-label="Salidas">
            {showLocalTab("salidas-guia") && <div id="cmv2-local-salidas-guia">
              <SalidasCierreTab model={labModel} workspace={syncedWorkspace} />
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
                    ? "Genera la selección de aulas (sección Aulas) para armar el paquete completo."
                    : !calculationReady
                      ? "Calcula la muestra (sección Cálculo) para armar el paquete completo."
                      : undefined,
                  enCurso: paqueteEnCurso,
                  pasos: paquetePasos,
                  onGenerar: () => onGenerarPaqueteDefensa(reporteFormato),
                }}
              />
            </div>}
            {showLocalTab("salidas-resultados") && <div id="cmv2-local-salidas-resultados">
              <SalidasResultadosTab
                componentes={[totalComp, facultyComp]}
                workspace={syncedWorkspace}
                onWorkspace={onWorkspace}
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
