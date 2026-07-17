/**
 * Pestaña integrada «Cursos-horario: criterios + radiografía» (sección Marco),
 * en layout FACULTAD-PRIMARIO e INTERLEAVED (información → decisión). El tipo de
 * curso relevante CAMBIA por facultad (reunión con el asesor muestral §4), así
 * que la decisión de los criterios de curso-horario se toma viendo la
 * radiografía de ESA facultad al lado, y luego se pasa a la siguiente — no
 * "todos los criterios y después toda la radiografía".
 *
 * Estructura:
 *   1. Barra global: estado del recálculo + preset HST + único botón que
 *      reconstruye el marco («Calcular población y cursos-horario elegibles»).
 *      Confirmar/descartar es GLOBAL (un solo «confirmar cambios pendientes»),
 *      no por tarjeta: nada cambia el marco hasta recalcular.
 *   2. Base global · todas las facultades: el set por defecto de los criterios
 *      (lo que cada facultad hereda si no decide propio).
 *   3. Un bloque por facultad (elegibles desc): radiografía + decisión propia.
 *
 * Contrato de criterios intacto: toda edición sigue viviendo en
 * `criterios_seleccion.byVariable[role]` (global) y `exceptions[facKey]` /
 * `minEligible.byFaculty[facKey]` (por facultad). El motor R no cambia.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Compass, Loader2, RefreshCw, School } from "lucide-react";
import {
  normalizeCalcMuestraAulasExploracion,
  normalizeCalcMuestraAulasParticularidades,
  normalizeCriteriosCatalogo,
  type CalcMuestraAulasState,
  type CalcMuestraWorkspace,
  type CalcMuestraWorkspaceAulasConfig,
  type CriterioSeleccion,
  type CriteriosSeleccionMarco,
  type MonitoreoRow,
} from "../../../../api/client";
import {
  ELEGIBLES_POR_AULA_ID,
  minEligibleThreshold,
  setMinEligible,
  setRangosFacultad,
  setSeleccionVariable,
} from "../../dominio";
import { useMotorStore } from "../../motor/store";
import { AvisoModulo } from "../shared/AvisoModulo";
import { marcoCriteriosDesactualizado } from "../shared/frame";
import { normalizeUniversityAulasConfig } from "../shared/study";
import {
  reconciliarBorradorCriterios,
  type TipoBorradorCriterio,
} from "../criterios/borradorCriterios";
import { PresetCanonicoButton } from "../criterios/PresetCanonicoButton";
import type { PresetCanonicoPlan } from "../criterios/presetCanonicoModel";
import type { FacultadRef } from "../criterios/facultades";
import type { FacultadMinRef } from "../criterios/MinElegiblesCard";
import { setMinimoFacultad, setTasaAsistencia, tasaAsistencia } from "../criterios/minElegiblesModel";
import { senalAgrupamientoDti } from "../criterios/tipoSesionModel";
import { MANUAL_EXCLUDED_ID, reactivarTodas, setAulaExcluida } from "../criterios/aulasFinalesModel";
import { rowsFrom } from "../../sharedCore";
import { CursosHorarioBaseGlobal } from "./CursosHorarioBaseGlobal";
import { FacultadDecisionBloque } from "./FacultadDecisionBloque";
import { facultadesBloque, slugFacultad } from "./facultadDecisionModel";
import "../criterios/criterios.css";
import "./marco.css";

export function CursosHorarioMarcoTab({
  workspace,
  aulasState,
  facultades,
  onWorkspace,
  onReconstruir,
  puedeReconstruir,
  reconstruyendo,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  facultades: string[];
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onReconstruir?: () => void;
  puedeReconstruir?: boolean;
  reconstruyendo?: boolean;
  /** Reservado por paridad de firma con el desk (no se usa en esta vista). */
  onNavigate?: (section: string, tab?: string) => void;
}) {
  const catalogo = useMemo(
    () => normalizeCriteriosCatalogo(aulasState?.frame?.criterios_catalogo ?? null),
    [aulasState?.frame?.criterios_catalogo],
  );
  const exploracion = useMemo(
    () => normalizeCalcMuestraAulasExploracion(aulasState?.frame?.exploracion ?? null),
    [aulasState?.frame?.exploracion],
  );
  // Lista individual de cursos-horario del último marco (para la selección
  // manual final por facultad). El motor ya marcó `included` por facultad.
  const aulaFrame = useMemo<MonitoreoRow[]>(
    () => rowsFrom<MonitoreoRow>(aulasState?.frame?.aula_frame),
    [aulasState?.frame?.aula_frame],
  );
  const sessionTypeDominante = useMemo(
    () =>
      normalizeCalcMuestraAulasParticularidades(aulasState?.frame?.particularidades ?? null)
        ?.session_type_dominante ?? null,
    [aulasState?.frame?.particularidades],
  );
  const config = useMemo(
    () => normalizeUniversityAulasConfig(workspace.aulas_config),
    [workspace.aulas_config],
  );
  const opcionalesActivosMotor = useMotorStore((s) => s.decisiones.opcionalesActivos);

  const seleccion = useMemo<CriteriosSeleccionMarco>(
    () => config.criterios_seleccion ?? { byVariable: {} },
    [config.criterios_seleccion],
  );
  const [borrador, setBorrador] = useState<CriteriosSeleccionMarco>(() => seleccion);
  const [pendientes, setPendientes] = useState<Set<string>>(() => new Set());
  const pendientesRef = useRef(pendientes);

  const aula = useMemo(() => catalogo.variables.filter((v) => v.scope === "aula"), [catalogo.variables]);
  const aulaToggle = useMemo(
    () => aula.filter((v) => v.kind === "flat" || v.kind === "hierarchical"),
    [aula],
  );
  const sessionVariable = useMemo(() => aula.find((v) => v.id === "session_type") ?? null, [aula]);
  const rangeVariable = useMemo(() => aula.find((v) => v.kind === "range") ?? null, [aula]);

  const tiposBorrador = useMemo(() => {
    const tipos = new Map<string, TipoBorradorCriterio>();
    for (const variable of catalogo.variables) tipos.set(variable.id, variable.kind);
    tipos.set(ELEGIBLES_POR_AULA_ID, "minEligible");
    tipos.set(MANUAL_EXCLUDED_ID, "manualExcluded");
    return tipos;
  }, [catalogo.variables]);

  useEffect(() => {
    pendientesRef.current = pendientes;
  }, [pendientes]);

  useEffect(() => {
    setBorrador((prev) =>
      reconciliarBorradorCriterios(seleccion, prev, pendientesRef.current, tiposBorrador),
    );
  }, [seleccion, tiposBorrador]);

  const facRefs: FacultadRef[] = useMemo(() => {
    const seen = new Set<string>();
    const out: FacultadRef[] = [];
    for (const nombre of facultades) {
      const key = slugFacultad(nombre);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label: nombre });
    }
    return out;
  }, [facultades]);

  const facultadesMin: FacultadMinRef[] = useMemo(() => {
    const cats = catalogo.variables.find((v) => v.id === "faculty")?.categories ?? [];
    if (cats.length) {
      return cats.map((c) => ({ key: c.key, label: c.label, aulas: c.aulas > 0 ? c.aulas : null }));
    }
    return facRefs.map((f) => ({ key: f.key, label: f.label, aulas: null }));
  }, [catalogo.variables, facRefs]);

  const bloques = useMemo(
    () => facultadesBloque(exploracion, facRefs, facultadesMin),
    [exploracion, facRefs, facultadesMin],
  );

  const ready = catalogo.variables.length > 0;
  const umbralGeneral = minEligibleThreshold(borrador, config.min_elegibles_aula);
  const tasa = tasaAsistencia(borrador);
  const dti = useMemo(
    () => senalAgrupamientoDti(sessionVariable, sessionTypeDominante),
    [sessionVariable, sessionTypeDominante],
  );

  // ---- edición del borrador (mismo contrato que CriteriosMarcoTab) ---------
  function patchSeleccion(next: CriteriosSeleccionMarco) {
    onWorkspace({ ...workspace, aulas_config: { ...config, criterios_seleccion: next } });
  }
  function patchTeacherTypeOrden(keys: string[]) {
    onWorkspace({ ...workspace, aulas_config: { ...config, teacher_type_orden: keys } });
  }
  function patchAulasConfig(patch: Partial<CalcMuestraWorkspaceAulasConfig>) {
    onWorkspace({ ...workspace, aulas_config: { ...config, ...patch } });
  }
  function marcarPendiente(id: string) {
    setPendientes((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }
  function editarVariable(id: string, sel: CriterioSeleccion) {
    setBorrador((prev) => setSeleccionVariable(prev, id, sel));
    marcarPendiente(id);
  }
  function editarRango(variableId: string, facultad: string, rangos: Array<[number, number]>) {
    setBorrador((prev) => setRangosFacultad(prev, facultad, rangos));
    marcarPendiente(variableId);
  }
  function editarUmbral(value: number) {
    setBorrador((prev) => setMinEligible(prev, value));
    marcarPendiente(ELEGIBLES_POR_AULA_ID);
  }
  function editarMinimoFacultad(facultadKey: string, valor: number | null) {
    setBorrador((prev) =>
      setMinimoFacultad(prev, facultadKey, valor, minEligibleThreshold(prev, config.min_elegibles_aula)),
    );
    marcarPendiente(ELEGIBLES_POR_AULA_ID);
  }
  function editarTasa(t: number | null) {
    setBorrador((prev) => setTasaAsistencia(prev, t, minEligibleThreshold(prev, config.min_elegibles_aula)));
    marcarPendiente(ELEGIBLES_POR_AULA_ID);
  }
  function editarExclusionAula(classroomId: string, excluida: boolean) {
    setBorrador((prev) => setAulaExcluida(prev, classroomId, excluida));
    marcarPendiente(MANUAL_EXCLUDED_ID);
  }
  function reactivarAulas(clavesTextKey: string[]) {
    setBorrador((prev) => reactivarTodas(prev, clavesTextKey));
    marcarPendiente(MANUAL_EXCLUDED_ID);
  }
  function precargarPreset(plan: PresetCanonicoPlan) {
    setBorrador(plan.seleccion);
    setPendientes(new Set(plan.pendientes));
  }

  // ---- confirmar / descartar GLOBAL (un solo gesto, no por tarjeta) --------
  function confirmarTodo() {
    patchSeleccion(reconciliarBorradorCriterios(seleccion, borrador, pendientes, tiposBorrador));
    setPendientes(new Set());
  }
  function descartarTodo() {
    setBorrador(seleccion);
    setPendientes(new Set());
  }

  const totalPendientes = pendientes.size;
  const marcoConstruido = Boolean(aulasState?.frame);
  const marcoDesactualizado = marcoCriteriosDesactualizado(
    aulasState?.frame,
    config.criterios_seleccion,
    config.teacher_type_orden,
    { config, opcionalesActivos: opcionalesActivosMotor },
  );
  const necesitaRecalculo = !marcoConstruido || marcoDesactualizado;
  const listoParaRecalcular = Boolean(puedeReconstruir) && !reconstruyendo && totalPendientes === 0;
  const beam = necesitaRecalculo && listoParaRecalcular;
  const estadoResumen =
    totalPendientes > 0
      ? `${totalPendientes} ${totalPendientes === 1 ? "variable pendiente de confirmar" : "variables pendientes de confirmar"}`
      : !marcoConstruido
        ? "Aún no has construido el marco: calcula la población y los cursos-horario elegibles."
        : marcoDesactualizado
          ? "Los criterios cambiaron — el marco vigente ya no los refleja. Recalcula para actualizarlo."
          : "El marco está al día con los criterios confirmados.";

  return (
    <div className="cmv2-chfp" data-audit-ready={ready ? "true" : "false"}>
      {onReconstruir && (
        <div
          className="cmv2-crit-apply cmv2-chfp-apply"
          role="group"
          aria-label="Calcular población y cursos-horario elegibles"
          data-attention={necesitaRecalculo ? "true" : "false"}
        >
          <AvisoModulo
            tone={totalPendientes > 0 || marcoDesactualizado ? "warn" : !marcoConstruido ? "info" : "success"}
            role="status"
            compact
            className="cmv2-crit-draft-summary"
          >
            {estadoResumen}
          </AvisoModulo>
          <div className="cmv2-crit-apply-actions">
            {totalPendientes > 0 ? (
              <div className="cmv2-chfp-pending" role="group" aria-label="Cambios pendientes">
                <button type="button" className="cmv2-crit-discard-btn" onClick={descartarTodo}>
                  Descartar cambios
                </button>
                <button type="button" className="cmv2-crit-confirm-btn" onClick={confirmarTodo}>
                  Confirmar cambios
                </button>
              </div>
            ) : null}
            {ready ? (
              <PresetCanonicoButton
                catalogo={catalogo}
                seleccion={seleccion}
                borradoresSinConfirmar={totalPendientes}
                onPrecargar={precargarPreset}
              />
            ) : null}
            <button
              type="button"
              className="cmv2-crit-apply-btn"
              data-beam={beam ? "true" : "false"}
              disabled={!listoParaRecalcular}
              onClick={onReconstruir}
              title={totalPendientes > 0 ? "Confirma o descarta los cambios antes de recalcular el marco" : undefined}
            >
              <span className="cmv2-crit-apply-btn-inner">
                {reconstruyendo ? (
                  <Loader2 size={15} className="pulso-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw size={15} aria-hidden="true" />
                )}
                Calcular población y cursos-horario elegibles
              </span>
            </button>
          </div>
        </div>
      )}

      {!ready ? (
        <div className="cmv2-crit-empty">
          <Compass size={22} aria-hidden="true" />
          <strong>Aún no hay catálogo de criterios de curso-horario.</strong>
          <p>
            La suite enumera las categorías reales de tu base (dirigida por el mapeo) y su radiografía por facultad.
            Construye el marco desde tus fuentes para poblarla; luego decides los criterios de curso-horario con la
            radiografía de cada facultad a la vista.
          </p>
        </div>
      ) : (
        <>
          <section className="cmv2-chfp-global" aria-label="Ajustes globales del marco">
            <header className="cmv2-chfp-section-head">
              <span className="cmv2-chfp-section-icon" aria-hidden="true">
                <Building2 size={18} />
              </span>
              <div className="cmv2-chfp-section-copy">
                <h3>Ajustes del marco</h3>
                <p>Transversales a todas las facultades: el mínimo general de elegibles (cada facultad lo ajusta abajo), la tasa de asistencia y la composición del aula. Los criterios de tipo, condición, nivel, docente y modalidad se deciden por facultad.</p>
              </div>
            </header>
            {dti ? (
              <AvisoModulo tone="info" compact role="note">
                Tu base trae el tipo de curso <strong>agrupado por DTI</strong> («{dti.categoria}»): con esta base no se
                puede separar teórico-práctico de teórico-laboratorio. La solicitud DTI 2026 (botón en Fuentes) pide el
                dato desagregado.
              </AvisoModulo>
            ) : null}
            <CursosHorarioBaseGlobal
              aulaVariables={aula}
              seleccion={borrador}
              facultades={facRefs}
              teacherTypeOrden={config.teacher_type_orden}
              config={config}
              soloAjustes
              onSelVariable={editarVariable}
              onRango={(facultad, rangos) => {
                const rangeVar = aula.find((v) => v.kind === "range");
                editarRango(rangeVar?.id ?? "course_level", facultad, rangos);
              }}
              onTeacherTypeOrden={patchTeacherTypeOrden}
              onUmbral={editarUmbral}
              onTasa={editarTasa}
              onPatchConfig={patchAulasConfig}
            />
          </section>

          <section className="cmv2-chfp-facultades" aria-label="Decisión por facultad con su radiografía">
            <header className="cmv2-chfp-section-head">
              <span className="cmv2-chfp-section-icon" aria-hidden="true">
                <School size={18} />
              </span>
              <div className="cmv2-chfp-section-copy">
                <h3>Por facultad · información y decisión</h3>
                <p>
                  Ordenadas por elegibles. Abre una facultad para ver su radiografía y decidir sus criterios de
                  curso-horario en la misma superficie, luego pasa a la siguiente.
                </p>
              </div>
            </header>
            {(totalPendientes > 0 || necesitaRecalculo) && bloques.length > 0 ? (
              <AvisoModulo tone="warn" compact role="status" className="cmv2-chfp-aviso-recalcular">
                Cambiaste criterios: las «aulas candidatas» y las distribuciones de abajo son del último marco
                construido. Recalcula («Calcular población y cursos-horario elegibles») para que se ajusten en cascada
                —cada criterio recorta y actualiza la información de los siguientes.
              </AvisoModulo>
            ) : null}
            {bloques.length === 0 ? (
              <AvisoModulo tone="info" role="status">
                La radiografía por facultad se calcula junto con el marco. Ejecuta «Calcular población y cursos-horario
                elegibles» con tu base cargada para ver cada facultad y decidir sus criterios propios.
              </AvisoModulo>
            ) : (
              <div className="cmv2-chfp-bloques">
                {bloques.map((bloque, index) => (
                  <FacultadDecisionBloque
                    key={bloque.excKey || bloque.facLabel}
                    bloque={bloque}
                    variablesToggle={aulaToggle}
                    rangeVariable={rangeVariable}
                    seleccion={borrador}
                    exploracion={exploracion}
                    aulaFrame={aulaFrame}
                    umbralGeneral={umbralGeneral}
                    tasa={tasa}
                    defaultOpen={index === 0}
                    onToggleVariable={editarVariable}
                    onRango={(facultad, rangos) => editarRango(rangeVariable?.id ?? "course_level", facultad, rangos)}
                    onMinimoFacultad={editarMinimoFacultad}
                    onToggleAula={editarExclusionAula}
                    onReactivarAulas={reactivarAulas}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
