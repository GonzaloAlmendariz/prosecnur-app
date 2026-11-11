import type { CargaMonitoreoHandoffStatus } from "../../../api/client";
import type { SessionState } from "../../../api/core";
import type { DataPreview } from "../RespuestasResumen";
import { declaresMultiBase, isLegacySingleBaseStudy, resolveCargaTopology } from "../CargaTopologyModel";
import { sourceInputCount } from "../CargaSourcesModel";
import { resolverHidratacionCarga } from "../cargaHidratacion";
import type { CargaTopologyIntent, MultiBaseStrategy } from "../store";
import { useEstudioCarga } from "../useEstudioCarga";

/**
 * Lo que la página deduce de la sesión y del estudio: si hay formulario y
 * respuestas, si el estudio es de varias bases, qué topología resuelve y cuántas
 * entradas hay materializadas. Lee el estudio con `useEstudioCarga`, así que la
 * página se hidrata desde aquí.
 */
export function useModeloCarga({
  state,
  errorSesion,
  dataPreview,
  estructura,
  handoffStatus,
  forceMultiBase,
  preferredMultiStrategy,
  topologyIntent,
  multiBaseStrategy,
}: {
  state: SessionState | null;
  errorSesion: string;
  dataPreview: DataPreview | null;
  estructura: unknown;
  handoffStatus: CargaMonitoreoHandoffStatus | null;
  forceMultiBase: boolean;
  preferredMultiStrategy: MultiBaseStrategy | undefined;
  topologyIntent: CargaTopologyIntent;
  multiBaseStrategy: MultiBaseStrategy;
}) {
  // Estado de prereqs — muestra al lado del título como meta chip.
  // Un archivo puede pertenecer a otra superficie del proyecto. Carga solo
  // considera disponible un insumo después de que su propio motor lo parsea
  // o previsualiza; así no declara una base lista usando archivos heredados de
  // Monitoreo, Muestra u otro módulo.
  const hasXlsform = !!state?.xlsform && !!state.instrumento_parsed;
  const hasData = !!state?.data && !!state.data_previewed;
  const pendingChoiceMapping = !!dataPreview?.normalizacion?.choice_code_maps?.requires_confirmation;
  const allReady = hasXlsform && hasData && !pendingChoiceMapping;
  // El puente de trabajo de campo es el camino primario cuando aún no hay una
  // base de procesamiento cargada. Deja al banner Kobo remoto como secundario.
  // Nos apoyamos en `already_promoted` (autoritativo: hay base real/activa) y no
  // en `hasData`, porque un archivo `data` heredado de otro módulo (p.ej. la
  // lista de encuestadores de Monitoreo) lo vuelve true en falso y ocultaría la
  // tarjeta justo en el proyecto que la necesita.
  const showFieldWorkHandoff =
    !!handoffStatus &&
    handoffStatus.detected &&
    !handoffStatus.already_promoted;
  // ¿Está el usuario en modo multi-base? Dos formas de activarse:
  // 1) Demo/preset cargó ≥1 base real (Acreditación) → has_estudio
  //    true + n_bases ≥ 1 con nombres reales.
  // 2) Usuario activó el toggle "más de una base" manualmente → has_
  //    estudio true + n_bases puede ser 0 (estudio recién inicializado
  //    esperando que suba su primera base).
  // El caso "single-base legacy virtual" (n_bases=1 + nombre=default)
  // se sigue tratando como single-base — aún no hubo intención de
  // multi-base, es solo un mirror del legacy.
  //
  // Salvo que el usuario YA haya declarado lo contrario en Plan: la declaración
  // persistida (`estudio_topology_declared`) es la intención real y le gana al
  // desempate por nombre. Ambas reglas viven en CargaTopologyModel.
  const declaredTopology = state?.estudio_topology_declared ?? null;
  const declaredMultiBase = declaresMultiBase(declaredTopology);
  const hasDefaultStudyBase = isLegacySingleBaseStudy({
    hasStudy: Boolean(state?.has_estudio),
    baseCount: state?.n_bases ?? 0,
    baseNames: state?.bases_nombres ?? [],
    declaredTopology,
  });
  const isIndependentStudy = state?.estudio_processing_mode === "independent_siblings";
  const isMultiBase = !!state
    && state.has_estudio
    && (
      forceMultiBase ||
      isIndependentStudy ||
      declaredMultiBase ||
      !(hasDefaultStudyBase)
    );
  // Payload del estudio — cargamos on-demand cuando entramos a modo
  // multi-base para mostrar el BasesPanel con detalle de cada base. Mientras
  // el estado de sesión o el estudio están en vuelo la página se hidrata: pinta
  // silueta y no publica readiness (L4, `cargaHidratacion.ts`).
  const {
    estudio,
    setEstudio,
    estado: estadoEstudio,
    reintentar: reintentarEstudio,
  } = useEstudioCarga(isMultiBase, `${state?.n_bases ?? ""}|${state?.bases_nombres?.join(",") ?? ""}`);
  const hidratacion = resolverHidratacionCarga({
    hayEstadoSesion: state !== null, errorSesion: Boolean(errorSesion),
    esMultiBase: isMultiBase,
    estudio: estadoEstudio,
  });
  const cargaBaseOptions = estudio ? Object.values(estudio.bases) : [];
  const topologyBases = cargaBaseOptions.filter(
    (base) => base.source_kind !== "kobo_repeat" && !base.parent_base,
  );
  const integratedBaseCount = topologyBases.filter(
    (base) => Boolean(base.multi_integrated),
  ).length;
  const multiBaseInstrumentCount = topologyBases.filter(
    (base) => Boolean(base.xlsform_file_id),
  ).length;
  const multiBaseDataCount = topologyBases.filter(
    (base) => Boolean(base.data_file_id),
  ).length;
  const cargaBaseSignature = estudio
    ? Object.keys(estudio.bases).sort((a, b) => a.localeCompare(b, "es")).join("|")
    : "";
  // En multibase no hay `instrumento_parsed` único; basta con que la estructura
  // de la base elegida esté cargada para mostrar la inspección de esquema. En
  // single-base se conserva el gate histórico.
  const showInspection = isMultiBase
    ? !!estructura
    : !!state?.instrumento_parsed && !!estructura;
  const workspaceHasInstrument = isMultiBase
    ? multiBaseInstrumentCount > 0
    : hasXlsform || showInspection;
  const workspaceHasData = isMultiBase ? multiBaseDataCount > 0 : hasData;
  const workspaceAllReady = isMultiBase
    ? topologyBases.length > 0
      && multiBaseInstrumentCount === topologyBases.length
      && multiBaseDataCount === topologyBases.length
      && !pendingChoiceMapping
    : allReady;
  const topologyHasStudy = Boolean(state?.has_estudio && !hasDefaultStudyBase);
  // Lo que el usuario declaró en Plan manda sobre lo que Monitoreo sugirió: la
  // sugerencia del intake es un default, la declaración es una decisión.
  const declaredTopologyStrategy: MultiBaseStrategy | null =
    declaredTopology === "separate" || declaredTopology === "integrated" || declaredTopology === "independent"
      ? declaredTopology
      : state?.processing_intake_mode === "independent_siblings"
        ? "independent"
        : null;
  const topologyResolution = resolveCargaTopology({
    hasStudy: topologyHasStudy,
    baseCount: topologyHasStudy
      ? estudio
        ? topologyBases.length
        : state?.n_bases ?? 0
      : 0,
    hasInstrument: hasXlsform,
    hasData,
    processingMode: topologyHasStudy ? state?.estudio_processing_mode : null,
    integratedBaseCount,
    declaredStrategy: declaredTopologyStrategy,
    intent: topologyIntent,
  });
  // Un "single" declarado también es una decisión que la vista debe reflejar al
  // reabrir; `declaredTopologyStrategy` sólo cubre las variantes multi.
  const resolvedTopologyIntent: CargaTopologyIntent = topologyIntent
    ?? declaredTopologyStrategy
    ?? (declaredTopology === "single" ? "single" : null);
  const topologyIntentStrategy: MultiBaseStrategy | null =
    resolvedTopologyIntent === "separate" || resolvedTopologyIntent === "integrated" || resolvedTopologyIntent === "independent"
      ? resolvedTopologyIntent
      : null;
  const sourceStrategy = topologyResolution.strategy
    ?? topologyIntentStrategy
    ?? preferredMultiStrategy
    ?? multiBaseStrategy;
  const integratedOriginCount = topologyBases.reduce(
    (total, base) => total + (base.multi_integrated?.origins?.length ?? 0),
    0,
  );
  const materializedInputCount = isMultiBase
    ? sourceStrategy === "integrated"
      ? integratedOriginCount
      : sourceInputCount(cargaBaseOptions)
    : topologyResolution.mode === "multi"
      ? 0
      : Number(hasXlsform || hasData);

  return {
    hasXlsform,
    hasData,
    pendingChoiceMapping,
    allReady,
    showFieldWorkHandoff,
    declaredTopology,
    isMultiBase,
    estudio,
    setEstudio,
    reintentarEstudio,
    hidratacion,
    cargaBaseOptions,
    topologyBases,
    multiBaseInstrumentCount,
    multiBaseDataCount,
    cargaBaseSignature,
    showInspection,
    workspaceHasInstrument,
    workspaceHasData,
    workspaceAllReady,
    topologyHasStudy,
    topologyResolution,
    resolvedTopologyIntent,
    topologyIntentStrategy,
    sourceStrategy,
    materializedInputCount,
  };
}
