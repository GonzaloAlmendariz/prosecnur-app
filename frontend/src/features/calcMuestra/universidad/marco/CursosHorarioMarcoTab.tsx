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
import { frameIntegrity } from "../shared/frameIntegrity";
import { normalizeUniversityAulasConfig } from "../shared/study";
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
import { FacultadDecisionBloque } from "./FacultadDecisionBloque";
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
import { construirMatrizCascada } from "./matrizCascadaModel";
import { MatrizCascadaCriterios } from "./MatrizCascadaCriterios";
import { MatrizEmbudoCriterios } from "./MatrizEmbudoCriterios";
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
    setPendientes(new Set());
  }
  function descartarTodo() {
    setBorrador(seleccion);
    setPendientes(new Set());
  }

  /** Confirma un solo criterio y deja los demás pendientes tal como estaban. */
  function confirmarCriterio(id: string) {
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
  const marcoConstruido = Boolean(aulasState?.frame);
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
  const i18b = useCriteriosI18bSurface(
    { frame: marcoPublicable ? aulasState?.frame ?? null : null, config, borrador, previewEnabled: totalPendientes > 0 || marcoDesactualizado },
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

  /**
   * G11 · La celda que la matriz resalta.
   *
   * ADR 0057, regla 1: no existe el criterio general. La celda es el cruce de
   * **la facultad abierta** con **el criterio pendiente**, y sólo esa se tiñe —
   * pintar la columna pondría en duda las quince filas que nadie tocó.
   *
   * Con varios pendientes se toma el primero en orden de embudo: es el que
   * bloquea a los demás, así que es el que hay que confirmar antes.
   */
  const celdaEnEdicion = useMemo(() => {
    if (!pendientes.size) return null;
    const facultadKey = bloqueFoco?.excKey || bloqueFoco?.facLabel || null;
    if (!facultadKey) return null;
    const orden = ordenEmbudoDelMotor(i18b.cascade, catalogo.variables);
    const criterioId = orden.find((id) => pendientes.has(id)) ?? [...pendientes][0];
    return criterioId ? { facultadKey, criterioId } : null;
  }, [pendientes, bloqueFoco, i18b.cascade, catalogo.variables]);

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
    const orden = ordenEmbudoDelMotor(i18b.cascade, catalogo.variables);
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
  }, [pendientes, catalogo.variables, i18b.cascade, borrador, seleccion, tiposBorrador]);
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
    const matriz = construirMatrizCascada(i18b.cascade);
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
  }, [i18b.cascade, bloqueFoco, aula]);

  /**
   * G39 · Con cuántos cursos-horario se termina.
   *
   * Es el `after_ch` del último paso, no `universo − Σquita`: si un paso no
   * publicara su facultad, la resta mentiría y el `after` no. La misma razón por
   * la que el modelo de la matriz ya lo toma de ahí.
   */
  const cierreDelRecorrido = useMemo(() => {
    const matriz = construirMatrizCascada(i18b.cascade);
    const clave = bloqueFoco?.excKey || bloqueFoco?.facLabel || "";
    const fila = matriz?.filas.find((f) => f.facultadKey === clave) ?? null;
    return fila ? { quedan: fila.quedan, universo: fila.universo } : null;
  }, [i18b.cascade, bloqueFoco]);

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
            : marcoDesactualizado
              ? "Los criterios cambiaron — el marco vigente ya no los refleja. Recalcula para actualizarlo."
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
              {(totalPendientes > 0 || necesitaRecalculo) && bloques.length > 0 ? (
                <AvisoModulo tone="warn" compact role="status" className="cmv2-chfp-aviso-recalcular">
                  Cambiaste criterios: las «aulas candidatas» y las distribuciones de abajo son del último marco
                  construido. Recalcula («Calcular población y cursos-horario elegibles») para que se ajusten en cascada
                  —cada criterio recorta y actualiza la información de los siguientes.
                </AvisoModulo>
              ) : null}
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
                      slotApertura={
                        /* ADR 0057, regla 1 · Matriculados abre el embudo de la
                           facultad. Vivía en una sección «transversales» encima
                           de todo, que lo leía como criterio general y lo sacaba
                           del orden. Su valor sigue siendo común —el contrato no
                           admite umbral por facultad— y la propia tarjeta lo
                           dice. */
                        <CursosHorarioBaseGlobal
                        piezas="apertura"
                        aulaVariables={aula}
                        seleccion={borrador}
                        facultades={facRefs}
                        teacherTypeOrden={config.teacher_type_orden}
                        config={config}
                        soloAjustes
                        variablesPorFacultadIds={variablesPorFacultadIds}
                        onSelVariable={editarVariable}
                        onRango={(facultad, rangos) => {
                          const rangeVar = aula.find((v) => v.kind === "range");
                          editarRango(rangeVar?.id ?? "course_level", facultad, rangos);
                        }}
                        onTeacherTypeOrden={patchTeacherTypeOrden}
                        onUmbral={editarUmbral}
                        onTasa={editarTasa}
                        onPatchConfig={patchAulasConfig}
                        evidenciaComposicion={evidenciaComposicion}
            />
                      }
                      slotCierre={
                        /* Mínimo de elegibles y composición: criterios 7 y 8,
                           penúltimos, justo antes del mayor detalle. */
                        <CursosHorarioBaseGlobal
                        piezas="cierre"
                        aulaVariables={aula}
                        seleccion={borrador}
                        facultades={facRefs}
                        teacherTypeOrden={config.teacher_type_orden}
                        config={config}
                        soloAjustes
                        variablesPorFacultadIds={variablesPorFacultadIds}
                        onSelVariable={editarVariable}
                        onRango={(facultad, rangos) => {
                          const rangeVar = aula.find((v) => v.kind === "range");
                          editarRango(rangeVar?.id ?? "course_level", facultad, rangos);
                        }}
                        onTeacherTypeOrden={patchTeacherTypeOrden}
                        onUmbral={editarUmbral}
                        onTasa={editarTasa}
                        onPatchConfig={patchAulasConfig}
                        evidenciaComposicion={evidenciaComposicion}
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
