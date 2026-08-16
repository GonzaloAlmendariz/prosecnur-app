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
 *      Confirmar/descartar global sigue existiendo —con ocho criterios abiertos,
 *      confirmarlos uno a uno es peor— pero G10 lo acompaña con confirmacion
 *      POR CRITERIO, dentro de la tarjeta que se edita: los criterios se aplican
 *      en cascada y confirmar el que tocas es lo que desbloquea a los
 *      siguientes. Nada cambia el marco hasta recalcular.
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
  normalizeCalcMuestraAulasCriteriosRadiografia,
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
import { seleccionActiva } from "../../dominio/criteriosMarco";
import {
  ELEGIBLES_POR_AULA_ID,
  minEligibleThreshold,
  setMinEligible,
  setRangosFacultad,
  setSeleccionVariable,
} from "../../dominio";
import { useMotorStore } from "../../store";
import { AvisoModulo } from "../shared/AvisoModulo";
import { marcoCriteriosDesactualizado } from "../shared/frame";
import { frameIntegrity, marcoFueConstruido } from "../shared/frameIntegrity";
import { filtrosLegacyPayload, normalizeUniversityAulasConfig } from "../shared/study";
import {
  copiarVariableCriterio,
  reconciliarBorradorCriterios,
  type TipoBorradorCriterio,
} from "../criterios/borradorCriterios";
import type { FacultadRef } from "../criterios/facultades";
import type { FacultadMinRef } from "../criterios/MinElegiblesCard";
import { setMinimoFacultad, setTasaAsistencia, tasaAsistencia } from "../criterios/minElegiblesModel";
import { senalAgrupamientoDti } from "../criterios/tipoSesionModel";
import { MANUAL_EXCLUDED_ID, reactivarTodas, setAulaExcluida } from "../criterios/aulasFinalesModel";
import { rowsFrom } from "../../sharedCore";
import { CursosHorarioBaseGlobal } from "./CursosHorarioBaseGlobal";
import { FacultadDecisionBloque, type RepartoCriterio } from "./FacultadDecisionBloque";
import { facultadesBloque, resumenDecisionFacultad, slugFacultad } from "./facultadDecisionModel";
import { PanoramaCursosHorario } from "./PanoramaCursosHorario";
import { CriteriosRadiografiaConsola } from "./CriteriosRadiografiaConsola";
import {
  buildCriteriosRadiografiaModel,
  criterioCardsForScope,
} from "./criteriosRadiografiaModel";
import { ConfirmadorCriterio } from "../criterios/ConfirmadorCriterio";
import { ordenEmbudoDelMotor } from "./ordenEmbudo";
import { useCriteriosI18bSurface } from "./useCriteriosI18bSurface";
import { aporteGlobalDeCard } from "./CriterioFacultadRadiografia";
import type { CriterioFacultadEvidence } from "./CriterioFacultadRadiografia";
import { useCascadePreview } from "./CriteriosEmbudoVivo";
import { construirMatrizCascada } from "./matrizCascadaModel";
import { MatrizCascadaCriterios } from "./MatrizCascadaCriterios";
import { MatrizEmbudoCriterios } from "./MatrizEmbudoCriterios";
import "../criterios/criterios.css";
import "./marco.css";
/** G41 · Id del criterio de composición en el ciclo de confirmación. */
const COMPOSICION_ID = "composicion";

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
  onNavigate?: (section: string, tab?: string) => void;
}) {
  const catalogo = useMemo(
    () => normalizeCriteriosCatalogo(aulasState?.frame?.criterios_catalogo ?? null),
    [aulasState?.frame?.criterios_catalogo],
  );
  const integridadFrame = useMemo(
    () => frameIntegrity(aulasState?.frame),
    [aulasState?.frame],
  );
  const marcoPublicable = integridadFrame.status === "consistent";
  const marcoIncoherente = integridadFrame.status === "inconsistent";
  const exploracionNormalizada = useMemo(
    () => normalizeCalcMuestraAulasExploracion(aulasState?.frame?.exploracion ?? null),
    [aulasState?.frame?.exploracion],
  );
  const exploracion = marcoPublicable ? exploracionNormalizada : null;
  const criteriosRadiografiaNormalizada = useMemo(
    () => normalizeCalcMuestraAulasCriteriosRadiografia(aulasState?.frame?.criterios_radiografia ?? null),
    [aulasState?.frame?.criterios_radiografia],
  );
  const criteriosRadiografia =
    marcoPublicable && criteriosRadiografiaNormalizada?.frame_hash === aulasState?.frame?.frame_hash
      ? criteriosRadiografiaNormalizada
      : null;
  const matrizEmbudo = criteriosRadiografia?.schema === "calc_muestra_aulas_criterios_radiografia_v2" ? criteriosRadiografia.matriz_embudo ?? null : null;
  const matrizRawPresent = Boolean((aulasState?.frame?.criterios_radiografia as { matriz_embudo?: unknown } | null | undefined)?.matriz_embudo);
  const legacyCardIds = useMemo(() => {
    const ids = new Set<string>();
    for (const facultad of exploracion?.por_facultad ?? []) {
      if ((facultad.por_tipo_sesion ?? []).length) ids.add("session_type");
      if ((facultad.por_condicion ?? []).length) ids.add("condicion_curso");
      if ((facultad.por_nivel ?? []).length) ids.add("course_level");
      if (facultad.est_aula_media != null || facultad.est_aula_mediana != null) ids.add("minEligible");
    }
    return ids;
  }, [exploracion]);
  const aulaFrame = useMemo<MonitoreoRow[]>(
    () => rowsFrom<MonitoreoRow>(aulasState?.frame?.aula_frame),
    [aulasState?.frame?.aula_frame],
  );
  const sessionTypeDominanteNormalizado = useMemo(
    () =>
      normalizeCalcMuestraAulasParticularidades(aulasState?.frame?.particularidades ?? null)
        ?.session_type_dominante ?? null,
    [aulasState?.frame?.particularidades],
  );
  const sessionTypeDominante = marcoPublicable ? sessionTypeDominanteNormalizado : null;
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
  const variablesPorFacultadIds = useMemo(
    () => [
      ...aulaToggle.map((variable) => variable.id),
      ...(rangeVariable ? [rangeVariable.id] : []),
    ],
    [aulaToggle, rangeVariable],
  );

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

  // Panorama: las decisiones de CH de TODAS las facultades en una vista. El
  // acordeón solo deja ver una a la vez (≈1.960 px cada una); con 17 facultades
  // la información completa de los criterios nunca se veía junta.
  const panoramaFilas = useMemo(
    () => bloques.map((bloque) => ({
      bloque,
      resumen: resumenDecisionFacultad(borrador, aulaToggle, bloque.excKey, bloque.minKey),
    })),
    [bloques, borrador, aulaToggle],
  );

  const [facultadFoco, setFacultadFoco] = useState<string | null>(null);
  // F41 · La facultad mostrada: la elegida, o la primera del panorama. Nunca
  // «ninguna», porque una superficie que exige un click para mostrar su
  // contenido esconde ese contenido.
  const bloqueFoco = useMemo(
    () =>
      bloques.find((b) => (b.excKey || b.facLabel) === facultadFoco) ?? bloques[0] ?? null,
    [bloques, facultadFoco],
  );

  const ready = catalogo.variables.length > 0;
  const umbralGeneral = minEligibleThreshold(borrador, config.min_elegibles_aula);
  const tasa = tasaAsistencia(borrador);
  const dti = useMemo(
    () => senalAgrupamientoDti(sessionVariable, sessionTypeDominante),
    [sessionVariable, sessionTypeDominante],
  );

  /*
   * G41 · Dos ajustes en el mismo render no pueden pisarse.
   *
   * Los tres emisores construían su workspace desde el `workspace` y el
   * `config` capturados por el render, así que dos llamadas seguidas —encender
   * un paso de composición y mover su porcentaje— producían dos objetos hechos
   * sobre la MISMA base: el segundo llegaba sin el cambio del primero y lo
   * borraba. Reproducido: el switch volvía a apagarse solo mientras el umbral
   * sí se guardaba.
   *
   * El ref recuerda lo último emitido, que es lo que el padre todavía no ha
   * devuelto por props. Cada patch parte de ahí, no de la foto del render.
   */
  const workspaceRef = useRef(workspace);
  useEffect(() => { workspaceRef.current = workspace; }, [workspace]);
  function emitirWorkspace(patch: Partial<CalcMuestraWorkspaceAulasConfig>) {
    const base = workspaceRef.current;
    const baseConfig = normalizeUniversityAulasConfig(base.aulas_config);
    const next = { ...base, aulas_config: { ...baseConfig, ...patch } };
    workspaceRef.current = next;
    onWorkspace(next);
  }

  // ---- edición del borrador (mismo contrato que CriteriosMarcoTab) ---------
  function patchSeleccion(next: CriteriosSeleccionMarco) {
    emitirWorkspace({ criterios_seleccion: next });
  }
  function patchTeacherTypeOrden(keys: string[]) {
    emitirWorkspace({ teacher_type_orden: keys });
  }
  function patchAulasConfig(patch: Partial<CalcMuestraWorkspaceAulasConfig>) {
    emitirWorkspace(patch);
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

  // ---- confirmar / descartar --------------------------------------------
  //
  // G9 · Gonzalo: «la confirmación tiene que ser por criterio. Yo hago un
  // cambio en el criterio, lo tengo que confirmar, y esa confirmación es lo que
  // permite que el criterio siguiente y los que vienen se actualicen».
  //
  // El gesto global se conserva —con ocho criterios abiertos, confirmarlos uno
  // a uno es peor— pero deja de ser el único: los criterios se aplican en
  // cascada y confirmar el que estás tocando es lo que desbloquea a los
  // siguientes. Sin eso, el embudo vivo no puede existir.
  function confirmarTodo() {
    patchSeleccion(reconciliarBorradorCriterios(seleccion, borrador, pendientes, tiposBorrador));
    if (Object.keys(borradorComposicion).length) patchAulasConfig(borradorComposicion);
    setBorradorComposicion({});
    setPendientes(new Set());
  }
  function descartarTodo() {
    setBorrador(seleccion);
    setBorradorComposicion({});
    setPendientes(new Set());
  }

  /*
   * G41 · La composición también se confirma.
   *
   * Gonzalo: «este no tiene botón de confirmar cuando todos los demás criterios
   * lo tienen». No lo tenía porque era el único que escribía directo al
   * workspace —«se guarda al instante»—, así que nunca llegaba a estar
   * pendiente de nada. Eso lo dejaba fuera del ciclo que gobierna a los demás:
   * ajustar, ver el efecto, confirmar.
   *
   * Ahora sus tres pasos escriben en un borrador propio que alimenta la
   * superficie y el recorrido vivo, y confirmar es lo que los lleva al
   * workspace. Descartar devuelve lo confirmado, igual que en el resto.
   */
  const [borradorComposicion, setBorradorComposicion] =
    useState<Partial<CalcMuestraWorkspaceAulasConfig>>({});
  const configComposicion = useMemo(
    () => ({ ...config, ...borradorComposicion }),
    [config, borradorComposicion],
  );
  function editarComposicion(patch: Partial<CalcMuestraWorkspaceAulasConfig>) {
    setBorradorComposicion((prev) => ({ ...prev, ...patch }));
    marcarPendiente(COMPOSICION_ID);
  }
  function confirmarComposicion() {
    if (Object.keys(borradorComposicion).length) patchAulasConfig(borradorComposicion);
    setBorradorComposicion({});
    setPendientes((prev) => {
      const next = new Set(prev);
      next.delete(COMPOSICION_ID);
      return next;
    });
  }
  function descartarComposicion() {
    setBorradorComposicion({});
    setPendientes((prev) => {
      const next = new Set(prev);
      next.delete(COMPOSICION_ID);
      return next;
    });
  }

  /** Confirma un solo criterio y deja los demás pendientes tal como estaban. */
  function confirmarCriterio(id: string) {
    if (id === COMPOSICION_ID) return confirmarComposicion();
    if (!pendientes.has(id)) return;
    patchSeleccion(reconciliarBorradorCriterios(seleccion, borrador, new Set([id]), tiposBorrador));
    setPendientes((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  /**
   * Descarta el borrador de un criterio y devuelve su valor confirmado.
   *
   * Se restaura **su** rama, no el borrador entero: descartar un criterio no
   * puede llevarse por delante los cambios que hay en los otros.
   *
   * G39 · Gonzalo: «si aprieto descartar, ¿no debería volver al valor original
   * ya confirmado o por defecto?». No volvía. Esta función restauraba a mano
   * `byVariable[id]` y **varios criterios no viven ahí**: el rango de niveles
   * escribe en `courseLevelRanges`, el mínimo por facultad y la tasa en
   * `minEligible`, las exclusiones en `manualExcludedClassrooms`. Para todos
   * ésos, «Descartar» apagaba el aviso y dejaba el cambio puesto — la peor
   * versión posible: el usuario cree que revirtió y el borrador sigue sucio.
   *
   * La causa es que había dos caminos para la misma pregunta —qué le pertenece
   * a este criterio—: el de confirmar usaba `copiarVariableCriterio`, que
   * conoce las cuatro ramas, y el de descartar reimplementaba una sola. Ahora
   * los dos usan el mismo helper, en sentidos opuestos: confirmar copia del
   * borrador a lo confirmado, descartar copia de lo confirmado al borrador.
   */
  function descartarCriterio(id: string) {
    if (id === COMPOSICION_ID) return descartarComposicion();
    if (!pendientes.has(id)) return;
    setBorrador((prev) =>
      copiarVariableCriterio(prev, seleccion, id, tiposBorrador.get(id) ?? "flat"),
    );
    setPendientes((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }



  const totalPendientes = pendientes.size;
  const marcoConstruido = marcoFueConstruido(aulasState?.frame);
  const criteriosRadiografiaF1Lista = criteriosRadiografia?.schema === "calc_muestra_aulas_criterios_radiografia_v2";
  const criteriosRadiografiaF1Pendiente = marcoConstruido && !criteriosRadiografiaF1Lista;
  const criteriosRadiografiaF1Ausente = marcoConstruido && aulasState?.frame?.criterios_radiografia == null;
  const marcoNoVerificable = marcoConstruido && integridadFrame.status === "unverifiable";
  const marcoDesactualizado = marcoCriteriosDesactualizado(
    aulasState?.frame,
    config.criterios_seleccion,
    config.teacher_type_orden,
    { config, opcionalesActivos: opcionalesActivosMotor },
  );
  const radiografiaV2 = criteriosRadiografia?.schema === "calc_muestra_aulas_criterios_radiografia_v2"
    ? criteriosRadiografia
    : null;
  /*
   * G41 · Los filtros del borrador, traducidos como los traduce el build.
   *
   * Gonzalo quiere que al soltar el deslizador se actualice «cuántas quedan,
   * cuántas se van y su porcentaje» sobre los cursos-horario que sobrevivieron
   * a los criterios previos. El motor sabe hacerlo —el preview recalcula la
   * cascada sobre el marco ya construido— pero lee la composición de
   * `config.filters`, y la tarjeta la edita en la raíz del config. Sin esta
   * traducción el preview evaluaba la composición como apagada.
   */
  const filtersPayload = useMemo(
    () => filtrosLegacyPayload(configComposicion, seleccionActiva(borrador), {
      c7: opcionalesActivosMotor.includes("c7"),
      c8: opcionalesActivosMotor.includes("c8"),
    }),
    [configComposicion, borrador, opcionalesActivosMotor],
  );
  const i18b = useCriteriosI18bSurface(
    {
      frame: marcoPublicable ? aulasState?.frame ?? null : null,
      config,
      borrador,
      filtersPayload,
      previewEnabled: totalPendientes > 0 || marcoDesactualizado,
    },
    radiografiaV2?.frame_hash ?? null,
    radiografiaV2,
  );
  const criteriosModel = useMemo(
    () => buildCriteriosRadiografiaModel({
      catalogo,
      radiografia: criteriosRadiografia,
      rawPresent: aulasState?.frame?.criterios_radiografia != null,
      legacyCardIds,
    }),
    [aulasState?.frame?.criterios_radiografia, catalogo, criteriosRadiografia, legacyCardIds],
  );
  const criterioCards = useMemo(
    () => new Map(criterioCardsForScope(criteriosModel, "aula").map((card) => [card.cardId, card])),
    [criteriosModel],
  );
  const criterioEvidence: CriterioFacultadEvidence | null = radiografiaV2 ? {
    radiografia: radiografiaV2,
    totals: i18b.totals,
    cascade: i18b.cascade,
    anchors: i18b.anchors,
    previewRequest: i18b.previewRequest,
    complete: i18b.status === "complete",
  } : null;

  /*
   * G39 · La cascada que la superficie enseña es la viva, no sólo la ejecutada.
   *
   * Gonzalo: «¿la actualización no debería también poder ser solo por criterio
   * cuando lo confirmamos, y este botón solo si quiero un cambio que involucre a
   * ambas dimensiones?».
   *
   * El preview recalcula la cascada sobre el marco ya construido, así que
   * confirmar un criterio actualiza el recorrido —las barras, la matriz y el
   * cierre— sin reconstruir la población. Cuando no está disponible (contexto
   * transitorio ausente al abrir un `.pulso` guardado, o preview deshabilitado)
   * se cae a la cascada ejecutada, que es lo que había antes.
   */
  const previewCascada = useCascadePreview(i18b.previewRequest);
  const cascadaViva = previewCascada?.status === "ready" ? previewCascada.data : i18b.cascade;
  /** El recorrido está vivo: lo que se ve ya incluye los criterios confirmados. */
  const previewVivo = previewCascada?.status === "ready";
  /** …y hay otro recálculo en camino, así que la cifra aún no es la del umbral. */
  const previewRecalculando = previewCascada?.status === "ready" &&
    previewCascada.recalculando === true;
  /*
   * G39 · Por qué el recorrido NO está vivo, cuando no lo está.
   *
   * El motor exige que el marco se haya construido en esta sesión, y al abrir un
   * `.pulso` guardado eso nunca se cumple: el contexto transitorio se borra al
   * guardar y no se puede rehidratar —depende del catálogo de curso-horario, que
   * es una tabla de origen y no viaja en el marco—.
   *
   * F47 ya había traducido esa precondición a algo accionable, y el mensaje
   * vivía en la consola de detalle que G20 retiró: se escribió, se probó y dejó
   * de verse. Aquí se muestra donde el usuario está mirando.
   */
  const previewBloqueado =
    previewCascada?.status === "stale" ? previewCascada.message : null;

  /**
   * G11 · La celda que la matriz resalta.
   *
   * ADR 0057, regla 1: no existe el criterio general. La celda es el cruce de
   * **la facultad abierta** con **el criterio pendiente**, y sólo esa se tiñe —
   * pintar la columna pondría en duda las quince filas que nadie tocó.
   *
   * Con varios pendientes se toma el primero en orden de embudo: es el que
   * bloquea a los demás, así que es el que hay que confirmar antes.
   *
   * Va después de `cascadaViva` a propósito: lee la cascada viva, y declararlo
   * antes lo dejaba en zona muerta temporal (el memo corre en el primer render).
   */
  const celdaEnEdicion = useMemo(() => {
    if (!pendientes.size) return null;
    const facultadKey = bloqueFoco?.excKey || bloqueFoco?.facLabel || null;
    if (!facultadKey) return null;
    const orden = ordenEmbudoDelMotor(cascadaViva, catalogo.variables);
    const criterioId = orden.find((id) => pendientes.has(id)) ?? [...pendientes][0];
    return criterioId ? { facultadKey, criterioId } : null;
  }, [pendientes, bloqueFoco, cascadaViva, catalogo.variables]);

  /**
   * G10 · El confirmador de cada criterio, dentro de la tarjeta que se edita.
   *
   * Confirmar es parte de decidir, no un trámite en otra zona de la pantalla.
   * Y el «en espera» que publica dice lo que está en juego: cuántos criterios
   * no pueden recalcularse hasta que éste se confirme — sin eso, «confirmar»
   * parece un botón de guardar.
   *
   * El orden del embudo lo fija el ADR, así que «los que vienen detrás» son
   * los que ordena `ordenEmbudo`, no los que estén pendientes por casualidad.
   */
  const confirmadorDe = useMemo(() => {
    const orden = ordenEmbudoDelMotor(cascadaViva, catalogo.variables);
    return (criterioId: string) => {
      if (!pendientes.has(criterioId)) return null;
      const i = orden.indexOf(criterioId);
      const enEspera = i >= 0 ? orden.length - 1 - i : 0;
      return (
        <ConfirmadorCriterio
          estado="pendiente"
          cambios={1}
          enEspera={enEspera}
          onConfirmar={() => confirmarCriterio(criterioId)}
          onDescartar={() => descartarCriterio(criterioId)}
        />
      );
    };
    // `confirmarCriterio` y `descartarCriterio` leen del render actual; se
    // recalcula con el borrador para no confirmar una versión vieja.
  }, [pendientes, catalogo.variables, cascadaViva, borrador, seleccion, tiposBorrador]);
  /*
   * G38 · La evidencia de los pasos de composición.
   *
   * Sale de las mismas tarjetas de radiografía que el resto del embudo, por
   * `cardId` — no de un cálculo propio. Composición no admite umbral por
   * facultad en el contrato vigente, así que su aporte es el del marco entero.
   */
  const evidenciaComposicion = useMemo(() => {
    return (criterioId: string) =>
      aporteGlobalDeCard(criterioCards.get(criterioId) ?? null);
  }, [criterioCards]);


  /*
   * G39 · Cuántos cursos-horario llegan a cada criterio en la facultad abierta.
   *
   * Gonzalo: «la barra debería estar en todos los criterios antes de introducir
   * uno, para poder seguir el embudo en cascada». El dato es el `before_ch` que
   * el motor ya publica por paso y facultad; la matriz de cascada lo transpone y
   * aquí sólo se consulta por criterio. Nada se resta ni se acumula en el
   * cliente: si un paso no publicara su facultad, una resta mentiría en silencio.
   */
  const lleganDe = useMemo(() => {
    const matriz = construirMatrizCascada(cascadaViva);
    const clave = bloqueFoco?.excKey || bloqueFoco?.facLabel || "";
    const fila = matriz?.filas.find((f) => f.facultadKey === clave) ?? null;
    if (!fila) return () => null;
    const porCriterio = new Map(fila.celdas.map((c) => [c.criterioId, c.llegan]));
    /*
     * Una barra que no introduce nada es ruido.
     *
     * Medido en la app: salían **dos barras seguidas** al abrir el bloque. La
     * primera introducía «Matriculados / población», que la cascada sí ejecuta
     * pero la superficie no monta —su variable no tiene columna mapeada (G33)—.
     * El motor y la pantalla no tienen por qué coincidir en qué pasos existen: el
     * primero los ejecuta todos, la segunda sólo enseña los que se pueden
     * decidir. La barra pertenece a la segunda.
     */
    const montados = new Set<string>([
      ELEGIBLES_POR_AULA_ID,
      "minEligible",
      MANUAL_EXCLUDED_ID,
      "manual_excluded",
      "c7",
      "c8_facultad",
      "c8",
      ...aula.filter((v) => Boolean(v.mappedColumn)).map((v) => v.id),
    ]);
    return (criterioId: string) => {
      if (!montados.has(criterioId)) return null;
      const llegan = porCriterio.get(criterioId);
      return llegan == null ? null : { llegan, universo: fila.universo };
    };
  }, [cascadaViva, bloqueFoco, aula]);

  /**
   * G41 · Cómo se reparte entre las categorías lo que llega a cada criterio.
   *
   * Gonzalo: «si quedan 100 cursos-horario hasta un criterio, la suma de sus
   * elegibles en cada categoría no debería ser 100?». Debía serlo: la tarjeta
   * enseñaba el universo de partida y los elegibles del marco completo, dos
   * momentos ajenos al que se está decidiendo, y ninguno sumaba la barra.
   *
   * El reparto lo publica el motor por paso × facultad × categoría, y sólo
   * cuando cierra con el `before_ch` de esa facultad. Aquí se consulta; no se
   * reparte nada en el cliente, que es como se fabrican cifras que nadie puede
   * auditar contra el marco.
   */
  const repartoDe = useMemo(() => {
    const clave = bloqueFoco?.excKey || bloqueFoco?.facLabel || "";
    const porCriterio = new Map<string, RepartoCriterio>();
    for (const paso of cascadaViva?.steps ?? []) {
      const facultad = paso.faculties.find(
        (f) => f.faculty_key === clave || f.label === clave,
      );
      if (!facultad?.segments?.length) continue;
      porCriterio.set(paso.criterion_id, {
        llegan: new Map(facultad.segments.map((s) => [s.segment_key, s.before_ch])),
        particionan: facultad.segments_particionan === true,
      });
    }
    return (criterioId: string) => porCriterio.get(criterioId) ?? null;
  }, [cascadaViva, bloqueFoco]);

  /**
   * G41 · Cuántos cursos-horario llegan a un paso y cuántos quedan tras él.
   *
   * Gonzalo, sobre composición: «estos siguen sin decir cuántos CH descartamos
   * en función del porcentaje y con cuántos nos quedamos». La barra del
   * recorrido ya decía lo primero para los criterios con tarjeta; los pasos de
   * composición viven dentro de una sola tarjeta y se habían quedado sin cifra.
   *
   * Es el par `before_ch`/`after_ch` del motor para la facultad abierta, no una
   * resta local: si el paso no publicara su facultad, restar mentiría.
   */
  /*
   * G41 · El umbral que se está viendo no es el que corrió el marco.
   *
   * Gonzalo: «cuando muevo el porcentaje mínimo los números no son dinámicos y
   * no se actualizan». Es cierto y no puede arreglarse mostrando otra cifra: el
   * par llegan/quedan lo publica el motor para el marco EJECUTADO, y mover el
   * deslizador no vuelve a ejecutar nada —se guarda al instante, sí, pero el
   * marco es el de antes—.
   *
   * Lo que sí se puede es dejar de presentarlo como si respondiera al umbral
   * nuevo. Aquí se compara el filtro vigente con el `filters_echo` que el frame
   * guarda de su propia construcción: si difieren, el paso pasa a «pendiente» y
   * la línea pide recalcular en vez de dar una cifra que ya no describe nada.
   */
  const composicionPendiente = useMemo(() => {
    const eco = aulasState?.frame?.filters_echo as Record<string, unknown> | null | undefined;
    // Los umbrales viven en la raíz del config de aulas (es lo que edita la
    // tarjeta), y el eco del frame los guarda con las mismas claves.
    const vigentes = configComposicion as unknown as Record<string, unknown>;
    const pares: Array<[string, string, string]> = [
      ["c7", "require_min_prevalence", "min_prevalence_pct"],
      ["c8_facultad", "require_faculty_prevalence", "min_faculty_prevalence_pct"],
      ["c8", "require_cycle_homogeneity", "min_cycle_homogeneity_pct"],
    ];
    const pendientes = new Set<string>();
    if (!eco || typeof eco !== "object") return pendientes;
    for (const [criterioId, flagKey, pctKey] of pares) {
      const ecoFlag = eco[flagKey];
      // Un eco parcial (frames viejos) no es comparable: no se inventa desfase.
      if (typeof ecoFlag !== "boolean") continue;
      if (ecoFlag !== (vigentes[flagKey] === true)) { pendientes.add(criterioId); continue; }
      if (!ecoFlag) continue;
      const ecoPct = Number(eco[pctKey]);
      const pctVigente = Number(vigentes[pctKey]);
      if (!Number.isFinite(ecoPct) || !Number.isFinite(pctVigente)) continue;
      if (Math.abs(ecoPct - pctVigente) > 1e-9) pendientes.add(criterioId);
    }
    return pendientes;
  }, [aulasState?.frame?.filters_echo, configComposicion]);

  /*
   * D6 · Cuántas aulas pasaron cada gate de composición SIN señal medible.
   *
   * Sale de `perfil.opcionales[id].composicion_na_n`, que el motor publica
   * desde el ADR 0060 y hasta hoy no leía nadie. Es una cifra del marco
   * EJECUTADO y global al criterio —no por facultad, a diferencia del recorte—,
   * así que no se recalcula con el foco ni con el preview del borrador.
   *
   * Frames anteriores al contrato no traen la clave: devuelve null y la tarjeta
   * simplemente no dibuja la línea, nunca un 0 que afirmaría lo que no se midió.
   */
  const sinSenalDe = useMemo(() => {
    const opcionales = aulasState?.frame?.perfil?.opcionales ?? null;
    return (criterioId: string): number | null => {
      const fila = opcionales?.[criterioId as keyof typeof opcionales];
      const n = (fila as { composicion_na_n?: number | null } | undefined)?.composicion_na_n;
      return typeof n === "number" && Number.isFinite(n) ? n : null;
    };
  }, [aulasState?.frame?.perfil?.opcionales]);

  const recorteDe = useMemo(() => {
    const clave = bloqueFoco?.excKey || bloqueFoco?.facLabel || "";
    const porCriterio = new Map<
      string,
      {
        llegan: number; quedan: number; aplicado: boolean;
        recalculando: boolean; sinRecorridoVivo: boolean;
      }
    >();
    for (const paso of cascadaViva?.steps ?? []) {
      const facultad = paso.faculties.find(
        (f) => f.faculty_key === clave || f.label === clave,
      );
      if (!facultad) continue;
      porCriterio.set(paso.criterion_id, {
        llegan: facultad.before_ch,
        quedan: facultad.after_ch,
        // El motor ya distingue el paso que corrió del que no; sin este dato la
        // superficie leía «no dejó fuera a nadie» de un paso apagado.
        // Con el recorrido vivo la cascada YA se recalculó con el umbral que se
        // está viendo, así que no hay nada pendiente que avisar: `applies` sale
        // del preview del borrador. Sin él, la cifra es del marco ejecutado y
        // un umbral distinto la deja sin describir nada.
        aplicado: paso.applies === true && paso.status === "aplicado" &&
          (previewVivo || !composicionPendiente.has(paso.criterion_id)),
        recalculando: previewRecalculando,
        /*
         * G41 · Por qué el umbral no se actualiza solo, cuando no lo hace.
         *
         * Gonzalo: «lo moví y me sale este paso aún no ha corrido». Es cierto y
         * el aviso se quedaba corto: el recorrido vivo exige el contexto
         * transitorio del motor, que sólo existe si el marco se construyó en
         * ESTA sesión —al abrir un `.pulso` guardado nunca está—. Con eso, una
         * reconstrucción basta para que los siguientes cambios de umbral se
         * recalculen solos, y eso es lo que hay que decir.
         */
        sinRecorridoVivo: !previewVivo,
      });
    }
    return (criterioId: string) => porCriterio.get(criterioId) ?? null;
  }, [cascadaViva, bloqueFoco, composicionPendiente, previewVivo, previewRecalculando]);

  /**
   * G39 · Con cuántos cursos-horario se termina.
   *
   * Es el `after_ch` del último paso, no `universo − Σquita`: si un paso no
   * publicara su facultad, la resta mentiría y el `after` no. La misma razón por
   * la que el modelo de la matriz ya lo toma de ahí.
   */
  const cierreDelRecorrido = useMemo(() => {
    const matriz = construirMatrizCascada(cascadaViva);
    const clave = bloqueFoco?.excKey || bloqueFoco?.facLabel || "";
    const fila = matriz?.filas.find((f) => f.facultadKey === clave) ?? null;
    return fila ? { quedan: fila.quedan, universo: fila.universo } : null;
  }, [cascadaViva, bloqueFoco]);

  const necesitaRecalculo = !marcoConstruido || marcoDesactualizado || !marcoPublicable || criteriosRadiografiaF1Pendiente;
  const listoParaRecalcular = Boolean(puedeReconstruir) && !reconstruyendo && totalPendientes === 0;
  const beam = necesitaRecalculo && listoParaRecalcular;
  const estadoResumen =
    marcoIncoherente
      ? "La radiografía no corresponde al marco ejecutado. Reconstruye el marco para recuperar cifras coherentes."
      : marcoNoVerificable
        ? "El marco ejecutado no es verificable contra su radiografía. Reconstruye el marco para recuperar cifras acreditables."
        : totalPendientes > 0
          ? `${totalPendientes} ${totalPendientes === 1 ? "variable pendiente de confirmar" : "variables pendientes de confirmar"}`
          : !marcoConstruido
            ? "Aún no has construido el marco: calcula la población y los cursos-horario elegibles."
            : criteriosRadiografiaF1Pendiente
              ? criteriosRadiografiaF1Ausente
                ? "El marco guardado aún no incluye la radiografía por facultad. Actualízalo para publicar el detalle analítico."
                : "La radiografía por facultad no cumple el contrato vigente. Reconstruye el marco para recuperarla."
            : previewBloqueado
              ? previewBloqueado
            : marcoDesactualizado
              /*
               * G39 · Qué falta de verdad cuando cambian los criterios.
               *
               * Gonzalo: «el botón de calcular población y cursos-horario
               * elegibles es un poco overkill, ¿no? […] este botón solo si
               * quiero un cambio que involucre a ambas dimensiones».
               *
               * Decía «el marco vigente ya no los refleja», que era cierto de
               * todo y por eso no ayudaba: con el recorrido vivo, los
               * cursos-horario YA reflejan el criterio confirmado. Lo que se
               * queda atrás es la población de estudiantes, que exige releer la
               * base. El aviso nombra esa diferencia para que reconstruir sea
               * una decisión y no un reflejo.
               */
              ? previewVivo
                ? "El recorrido ya refleja tus criterios. La población de estudiantes se recalcula al reconstruir."
                : "Los criterios cambiaron — el marco vigente ya no los refleja. Recalcula para actualizarlo."
              : "El marco está al día con los criterios confirmados.";

  return (
    <div className="cmv2-chfp" data-audit-ready={ready && marcoPublicable ? "true" : "false"}>
      {onReconstruir && (
        <div
          className="cmv2-crit-apply cmv2-chfp-apply"
          role="group"
          aria-label="Calcular población y cursos-horario elegibles"
          data-attention={necesitaRecalculo ? "true" : "false"}
        >
          <AvisoModulo
            tone={totalPendientes > 0 || marcoDesactualizado || marcoIncoherente || marcoNoVerificable || criteriosRadiografiaF1Pendiente ? "warn" : !marcoConstruido ? "info" : "success"}
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
            <button
              type="button"
              className="cmv2-crit-apply-btn"
              data-beam={beam ? "true" : "false"}
              disabled={!listoParaRecalcular}
              onClick={onReconstruir}
              /* G40 · Al absorber la tarjeta de recuperación, este botón hereda
                 lo único que ella decía y aquí faltaba: por qué está apagado
                 cuando no hay nada pendiente. */
              title={
                totalPendientes > 0
                  ? "Confirma o descarta los cambios antes de recalcular el marco"
                  : !puedeReconstruir
                    ? "Completa o corrige las fuentes del marco para habilitar el recálculo"
                    : undefined
              }
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
          {!criteriosRadiografiaF1Lista ? (
            <CriteriosRadiografiaConsola
              catalogo={catalogo}
              radiografia={criteriosRadiografia}
              i18bSource={{ frame: marcoPublicable ? aulasState?.frame ?? null : null, config, borrador, previewEnabled: totalPendientes > 0 || marcoDesactualizado }}
              scope="aula"
              legacyCardIds={legacyCardIds}
              onReconstruir={onReconstruir}
              puedeReconstruir={listoParaRecalcular}
              reconstruyendo={reconstruyendo}
              /* G40 · La barra de arriba ya dice que falta la radiografía y ya
                 ofrece el único botón que la repone —es literalmente el mismo
                 `onReconstruir`—. La tarjeta de recuperación repetía el aviso
                 en párrafo y ocupaba media pantalla antes de la primera
                 decisión. */
              recuperacionPropia={false}
            />
          ) : null}

          {marcoPublicable ? (
            <section className="cmv2-chfp-facultades" aria-label="Decisión por facultad con su radiografía">
              <header className="cmv2-chfp-section-head">
                <span className="cmv2-chfp-section-icon" aria-hidden="true">
                  <School size={18} />
                </span>
                <div className="cmv2-chfp-section-copy">
                  <h3>Por facultad · información y decisión</h3>
                  <p>
                    Ordenadas por matrículas elegibles. Abre una facultad para ver su radiografía y decidir sus
                    criterios de curso-horario en la misma superficie, luego pasa a la siguiente.
                  </p>
                </div>
              </header>
              {/* G39 · Una condición, un mensaje.
                  Aquí vivía un segundo aviso —«cambiaste criterios: las aulas
                  candidatas y las distribuciones de abajo son del último marco
                  construido»— que disparaba con `totalPendientes > 0 ||
                  necesitaRecalculo`, exactamente el mismo estado que el aviso de
                  la barra de acción de arriba. Medido en pantalla: los dos
                  visibles a la vez, diciendo lo mismo con otras palabras, y el
                  lector obligado a decidir si eran el mismo problema.
                  Peor aún desde que el recorrido es vivo: con el preview
                  disponible este texto era falso —las distribuciones de
                  cursos-horario SÍ reflejan el criterio— y seguía apareciendo.
                  El aviso de arriba distingue los cuatro casos (pendientes,
                  preview bloqueado, población atrasada, al día), vive junto al
                  botón que resuelve, y basta. */}
              {bloques.length === 0 ? (
                <AvisoModulo tone="info" role="status">
                  La radiografía por facultad se calcula junto con el marco. Ejecuta «Calcular población y
                  cursos-horario elegibles» con tu base cargada para ver cada facultad y decidir sus criterios propios.
                </AvisoModulo>
              ) : (
                <>
                <div
                  className="cmv2-chfp-bloques"
                  data-qa-geometry-group="calc-muestra/facultades-ch"
                  data-qa-geometry-contract="intrinsic"
                >
                  {/* F41 · Una facultad a la vez, sin acordeón.
                      Quince bloques plegados obligaban a abrir y cerrar para
                      comparar y escondían la decisión detrás de un click. Con el
                      selector, la facultad elegida se muestra entera: hay alto
                      de sobra para el mayor detalle y no queda nada plegado. */}
                  <label className="cmv2-chfp-selector">
                    <span>Facultad</span>
                    {/* F109 · El `<label>` que lo envuelve ya lo nombra, pero
                        arrastra consigo el `<small>` de ayuda: quien navega con
                        lector oye «Facultad … 17 facultades · se muestra una a
                        la vez con todo su detalle» en cada foco. El nombre
                        explícito lo deja en una palabra; la ayuda sigue leyéndose
                        al recorrer el grupo. */}
                    <select
                      aria-label="Facultad"
                      value={bloqueFoco?.excKey || bloqueFoco?.facLabel || ""}
                      onChange={(e) => setFacultadFoco(e.currentTarget.value)}
                    >
                      {bloques.map((b) => (
                        <option key={b.excKey || b.facLabel} value={b.excKey || b.facLabel}>
                          {b.facLabel}
                        </option>
                      ))}
                    </select>
                    <small>{bloques.length} facultades · se muestra una a la vez con todo su detalle</small>
                  </label>
                  {(bloqueFoco ? [bloqueFoco] : []).map((bloque) => (
                    <FacultadDecisionBloque
                      confirmadorDe={confirmadorDe}
                      lleganDe={lleganDe}
                      repartoDe={repartoDe}
                      cierreDelRecorrido={cierreDelRecorrido}
                      key={bloque.excKey || bloque.facLabel}
                      sinPlegado
                      bloque={bloque}
                      variablesToggle={aulaToggle}
                      rangeVariable={rangeVariable}
                      seleccion={borrador}
                      exploracion={exploracion}
                      criteriosRadiografia={criteriosRadiografia}
                      criterioCards={criterioCards}
                      criterioEvidence={criterioEvidence}
                      aulaFrame={aulaFrame}
                      umbralGeneral={umbralGeneral}
                      tasa={tasa}
                      onToggleVariable={editarVariable}
                      onRango={(facultad, rangos) =>
                        editarRango(rangeVariable?.id ?? "course_level", facultad, rangos)}
                      onMinimoFacultad={editarMinimoFacultad}
                      onToggleAula={editarExclusionAula}
                      onReactivarAulas={reactivarAulas}
                      /* G40 · La apertura ya no monta criterios comunes.
                          ADR 0057 los había traído aquí desde la sección
                          «transversales» para meterlos en el embudo, pero
                          seguían siendo lo que la regla 1 niega: un criterio que
                          se decide una vez para las 17 facultades. Gonzalo, dos
                          veces: «todos los criterios son por facultad, ninguno
                          es general».

                          Lo que se retira en pantalla es «Matriculados /
                          población»: su decisión la toma «Mínimo de alumnos
                          elegibles», que sí tiene valor propio por facultad y
                          enseña la distribución sobre la que se decide. El
                          motor conserva el umbral guardado y su fila en la
                          cascada. */
                      slotCierre={
                        /* Mínimo de elegibles y composición: criterios 7 y 8,
                           penúltimos, justo antes del mayor detalle. */
                        <CursosHorarioBaseGlobal
                          config={configComposicion}
                          onPatchConfig={editarComposicion}
                          confirmador={confirmadorDe(COMPOSICION_ID)}
                          evidenciaComposicion={evidenciaComposicion}
                          recorteComposicion={recorteDe}
                          sinSenalComposicion={sinSenalDe}
                        />
                      }
                    />
                  ))}
                </div>
                {/* ADR 0058 · La matriz de cascada va DESPUÉS de los criterios.
                    Gonzalo: «criterios por facultad es lo primero, yo escojo la
                    facultad, ajusto mis criterios, y abajo es como la matriz de
                    todo lo que se va haciendo y se va confirmando».

                    G20 · Es la única matriz que queda. La marginal —qué
                    recuperaría si quito una regla— se retiró: dos tablas antes
                    de la primera decisión abrían la pestaña con comparaciones
                    en vez de con lo que se decide. */}
                {/* G20 · Panorama BAJA y los criterios suben, y la matriz
                    marginal se retira: sólo sobrevive la de cascada.

                    Gonzalo: «Panorama se va abajo para que criterios vaya
                    arriba, y sólo una matriz sobrevive, la de abajo».

                    Lo que se decide es el criterio de una facultad; el
                    panorama comparativo y la procedencia son lectura de
                    cierre, no de apertura. Con las dos tablas arriba, la
                    pestaña abría con comparaciones antes de la primera
                    decisión — y la regla 2 del ADR 0057, que ponía la matriz
                    en el Panorama, queda superada por el ADR 0058: la matriz
                    que sobrevive cuenta la procedencia, y eso va al final. */}
                {/* G39 · El corte entre las dos mitades de la pestaña.
                    Gonzalo: «a partir de Panorama por facultad debe tener una
                    división diferente que corte bien esas dos partes de las
                    pestañas, porque ahora puede confundirse con un criterio
                    más».

                    Arriba se DECIDE, criterio a criterio, en UNA facultad.
                    Abajo se MIRA el resultado en TODAS. Con la misma
                    separación entre bloques, Panorama entraba como si fuera el
                    criterio siguiente, y su tabla —que compara facultades— se
                    leía como una decisión más de la facultad abierta.

                    Un borde no bastaba: la superficie ya está llena de bordes.
                    El corte dice en voz alta qué empieza, que es lo que lo
                    hace legible como cambio de sección y no como separador. */}
                <div className="cmv2-chfp-corte" role="separator" aria-label="Resultado en todas las facultades">
                  <span>Resultado en todas las facultades</span>
                </div>
                <PanoramaCursosHorario
                  filas={panoramaFilas}
                  criterios={aulaToggle.map((v) => ({ id: v.id, label: v.label }))}
                  facultadAbierta={facultadFoco}
                  onAbrirFacultad={setFacultadFoco}
                />
                <section className="cmv2-chfp-transversal" aria-labelledby="cmv2-chfp-cascada-title">
                  <header>
                    <strong id="cmv2-chfp-cascada-title">De dónde salen los cursos-horario elegibles</strong>
                    <span>cada criterio, lo que quita en cada facultad</span>
                  </header>
                  <MatrizCascadaCriterios cascada={i18b.cascade} edicion={celdaEnEdicion} />
                </section>
                </>
              )}
            </section>
          ) : (
            <AvisoModulo tone="warn" role="status">
              {marcoIncoherente
                ? "La radiografía por facultad queda oculta porque no corresponde al marco ejecutado. Reconstruye el marco para continuar."
                : "La radiografía por facultad no es verificable con el marco ejecutado. Reconstruye el marco para continuar."}
            </AvisoModulo>
          )}

        </>
      )}
    </div>
  );
}
