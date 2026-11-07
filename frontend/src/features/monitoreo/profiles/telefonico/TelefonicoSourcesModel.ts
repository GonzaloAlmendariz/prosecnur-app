import type { MonitoreoLinkCollector, MonitoreoSource, MonitoreoSourceCollector, MonitoreoSourceMetadata } from "../../../../api/client";
import { acreditacionActorOptions, acreditacionCollectorAlias, acreditacionCollectorPlatformName, acreditacionKoboResponseSources, acreditacionPlatformResponseSources, acreditacionSourceActor, acreditacionSourceChannel, acreditacionSourceWithOperationalMetadata, acreditacionSurveySourceName, acreditacionSweepSources, acreditacionTelephoneUniverseSources, collectorCountValue, collectorIdOf, compactLabel, isAcreditacionTelephoneValue, metadataCollectorsForSource, metadataSourceForSource, metadataSurveyForSource, normalizeKey, positiveCount, sourceCollectorText, sourceHasEmailEvidence, sourceHasExplicitNonEmailChannel, sourceMatchesOperationalMetadata, sourceUsesInstitutionalEmailByDefault, uniqueLabels } from "../../core/fuentesComunes";

export { acreditacionActorOptions, acreditacionCollectorAlias, acreditacionCollectorPlatformName, acreditacionKoboResponseSources, acreditacionPlatformResponseSources, acreditacionSourceActor, acreditacionSourceChannel, acreditacionSourceWithOperationalMetadata, acreditacionSurveySourceName, acreditacionSweepSources, acreditacionTelephoneUniverseSources };















export type AcreditacionCollectorRow = {
  key: string;
  sourceId: string;
  sourceName: string;
  surveyId: string;
  collectorId: string;
  platformName: string;
  alias: string;
  enabled: boolean;
  channel: string;
  operationalUse: MonitoreoLinkCollector["operational_use"];
  modality: MonitoreoLinkCollector["modality"];
  rosterRequired: boolean;
  responseCount: number;
  collectorType: string;
  hasPlatformMetadata: boolean;
  metadataSource: string;
  saved?: MonitoreoLinkCollector;
  platform?: MonitoreoSourceCollector;
};









export function acreditacionCollectorsForSource(
  source: MonitoreoSource,
  linkCollectors: MonitoreoLinkCollector[] = [],
) {
  const savedById = new Map(
    linkCollectors
      .filter((collector) => collector.source_id === source.id || (source.survey_id && collector.survey_id === source.survey_id))
      .map((collector) => [collectorIdOf(collector), collector]),
  );
  const platformById = new Map(
    (source.collectors ?? [])
      .filter((collector) => collectorIdOf(collector))
      .map((collector) => [collectorIdOf(collector), collector]),
  );
  const ids = new Set([...platformById.keys(), ...savedById.keys()]);
  return Array.from(ids).map((collectorId): AcreditacionCollectorRow => {
    const platform = platformById.get(collectorId);
    const saved = savedById.get(collectorId);
    const platformName = platform ? acreditacionCollectorPlatformName(platform) : "";
    const alias = saved ? acreditacionCollectorAlias(saved, platformName) : "";
    const operationalUse = saved?.operational_use ?? "sin_clasificar";
    const sourceChannel = acreditacionSourceChannel(source);
    const channel = compactLabel(saved?.channel) || sourceChannel || compactLabel(platform?.channel) || "Sin clasificar";
    return {
      key: `${source.id}::${collectorId}`,
      sourceId: source.id,
      sourceName: acreditacionSurveySourceName(source),
      surveyId: compactLabel(source.survey_id) || compactLabel(saved?.survey_id),
      collectorId,
      platformName,
      alias,
      enabled: saved?.enabled ?? true,
      channel,
      operationalUse,
      modality: saved?.modality ?? "mixto",
      rosterRequired: saved?.roster_required ?? operationalUse === "telefono_asistido",
      responseCount: collectorCountValue(platform ?? saved),
      collectorType: compactLabel(platform?.collector_type) || compactLabel(platform?.type) || compactLabel(saved?.collector_type) || "Recopilador",
      hasPlatformMetadata: Boolean(platformName),
      metadataSource: compactLabel(platform?.metadata_source),
      saved,
      platform,
    };
  });
}

export function acreditacionCollectorCountForSource(
  source: MonitoreoSource,
  linkCollectors: MonitoreoLinkCollector[] = [],
) {
  return acreditacionCollectorsForSource(source, linkCollectors).length;
}

export function acreditacionSourceResponseCount(
  source: MonitoreoSource,
  linkCollectors: MonitoreoLinkCollector[] = [],
) {
  const cursorCount = Math.max(
    positiveCount(source.sync_cursor?.fetched_count),
    positiveCount(source.sync_cursor?.remote_total),
  );
  if (cursorCount > 0) return cursorCount;
  return acreditacionCollectorsForSource(source, linkCollectors)
    .reduce((sum, collector) => sum + positiveCount(collector.responseCount), 0);
}

export type AcreditacionTelephoneChannel = {
  key: string;
  sourceId: string;
  sourceName: string;
  surveyId: string;
  collectorId: string;
  collectorName: string;
  actor: string;
  channel: string;
  rosterRequired: boolean;
  responseCount: number;
  collectorType: string;
  basis: "collector" | "source";
};

export function buildAcreditacionTelephoneChannels(
  sources: MonitoreoSource[],
  linkCollectors: MonitoreoLinkCollector[] = [],
) {
  const rows: AcreditacionTelephoneChannel[] = [];
  for (const source of sources.filter((item) => item.enabled && item.kind === "surveymonkey")) {
    const actor = acreditacionSourceActor(source) || "Sin actor";
    const sourceName = acreditacionSurveySourceName(source);
    const sourceChannel = acreditacionSourceChannel(source);
    const sourceLooksPhone = [
      sourceChannel,
      source.label,
      source.survey_title,
    ].some(isAcreditacionTelephoneValue);
    const collectors = acreditacionCollectorsForSource(source, linkCollectors);
    const phoneCollectors = collectors.filter((collector) => (
      collector.enabled
      && (
        collector.operationalUse === "telefono_asistido"
        || collector.rosterRequired
        || isAcreditacionTelephoneValue(collector.channel)
        || isAcreditacionTelephoneValue(collector.alias)
        || isAcreditacionTelephoneValue(collector.platformName)
      )
    ));

    for (const collector of phoneCollectors) {
      rows.push({
        key: `${source.id}::${collector.collectorId}`,
        sourceId: source.id,
        sourceName,
        surveyId: collector.surveyId || compactLabel(source.survey_id),
        collectorId: collector.collectorId,
        collectorName: collector.alias || collector.platformName || collector.collectorId,
        actor,
        channel: collector.channel || sourceChannel || "Telefónico",
        rosterRequired: true,
        responseCount: collector.responseCount,
        collectorType: collector.collectorType,
        basis: "collector",
      });
    }

    if (!phoneCollectors.length && sourceLooksPhone) {
      rows.push({
        key: `${source.id}::source`,
        sourceId: source.id,
        sourceName,
        surveyId: compactLabel(source.survey_id),
        collectorId: "",
        collectorName: "Encuesta completa",
        actor,
        channel: sourceChannel || "Telefónico",
        rosterRequired: true,
        responseCount: collectors.reduce((sum, collector) => sum + collector.responseCount, 0),
        collectorType: "Fuente",
        basis: "source",
      });
    }
  }

  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.key)) return false;
    seen.add(row.key);
    return true;
  });
}





export type AcreditacionPhoneSourceSlot = {
  key: "universo" | "barrido" | "plataforma";
  label: string;
  purpose: string;
  expected: string[];
  sources: MonitoreoSource[];
  ready: boolean;
  status: "ready" | "missing" | "inactive";
};

export type AcreditacionPhoneSourceContract = {
  universe: AcreditacionPhoneSourceSlot;
  sweep: AcreditacionPhoneSourceSlot;
  platform: AcreditacionPhoneSourceSlot;
  ready: boolean;
  missing: Array<"universo" | "barrido" | "plataforma">;
};

function phoneSlotStatus(sources: MonitoreoSource[]): AcreditacionPhoneSourceSlot["status"] {
  if (!sources.length) return "missing";
  return sources.some((source) => source.enabled) ? "ready" : "inactive";
}

export function buildAcreditacionPhoneSourceContract(
  sources: MonitoreoSource[],
): AcreditacionPhoneSourceContract {
  const universeSources = acreditacionTelephoneUniverseSources(sources);
  const sweepSources = acreditacionSweepSources(sources);
  const platformSources = acreditacionKoboResponseSources(sources);
  const sweepStatus = phoneSlotStatus(sweepSources);
  const platformStatus = phoneSlotStatus(platformSources);
  const activeUniverseSources = universeSources.filter((source) => source.enabled);
  const activeSweepSources = sweepSources.filter((source) => source.enabled);
  const sweepCoversUniverse = !activeUniverseSources.length && activeSweepSources.length > 0;
  const effectiveUniverseSources = sweepCoversUniverse ? activeSweepSources : universeSources;
  const universeStatus = sweepCoversUniverse ? "ready" : phoneSlotStatus(universeSources);
  const universe: AcreditacionPhoneSourceSlot = {
    key: "universo",
    label: "Base telefónica / universo",
    // Cuando una sola hoja cubre universo y barrido, lo que hay que decir es
    // eso —que es la misma hoja—, no repetir para qué sirve: la tarjeta de al
    // lado ya lo lista, y en pantalla las dos decían casi lo mismo con dos
    // redacciones distintas.
    purpose: sweepCoversUniverse
      ? "La misma hoja del barrido."
      : "Personas contactables, variables de cuota y población objetivo.",
    expected: ["sede", "atencion", "tramite", "origen", "telefono"],
    sources: effectiveUniverseSources,
    ready: universeStatus === "ready",
    status: universeStatus,
  };
  const sweep: AcreditacionPhoneSourceSlot = {
    key: "barrido",
    label: "Barrido telefónico",
    purpose: "Responsables, asignaciones, intentos, estados y fechas de llamada.",
    expected: ["responsable", "estado", "intento", "fecha", "observacion"],
    sources: sweepSources,
    ready: sweepStatus === "ready",
    status: sweepStatus,
  };
  const platform: AcreditacionPhoneSourceSlot = {
    key: "plataforma",
    // «Kobo» a secas nombraba el servicio; esto nombra el objeto y conserva
    // dónde vive, que en telefónico el usuario sí necesita distinguir de la hoja.
    label: "Encuesta en Kobo",
    purpose: "Efectivas por CodPulso",
    expected: ["CodPulso", "consentimiento", "fecha", "respuesta"],
    sources: platformSources,
    ready: platformStatus === "ready",
    status: platformStatus,
  };
  return {
    universe,
    sweep,
    platform,
    ready: universe.ready && sweep.ready && platform.ready,
    missing: [
      ...(!universe.ready ? ["universo" as const] : []),
      ...(!sweep.ready ? ["barrido" as const] : []),
      ...(!platform.ready ? ["plataforma" as const] : []),
    ],
  };
}

export function acreditacionSweepSourceForChannel(
  sources: MonitoreoSource[],
  channel: AcreditacionTelephoneChannel,
) {
  const candidates = acreditacionSweepSources(sources).filter((source) => source.enabled);
  if (!candidates.length) return null;
  const actorKey = normalizeKey(channel.actor);
  const sourceKey = normalizeKey(channel.sourceId);
  const surveyKey = normalizeKey(channel.surveyId);
  const collectorKey = normalizeKey(channel.collectorId);

  const exact = candidates.find((source) => {
    const dimensions = source.dimensions ?? {};
    return (
      (!collectorKey || normalizeKey(dimensions.collector_id) === collectorKey)
      && (
        normalizeKey(dimensions.survey_source_id) === sourceKey
        || normalizeKey(dimensions.source_id) === sourceKey
        || normalizeKey(dimensions.survey_id) === surveyKey
      )
    );
  });
  if (exact) return exact;

  const actorMatches = candidates.filter((source) => (
    actorKey
    && actorKey !== "sin actor"
    && normalizeKey(acreditacionSourceActor(source)) === actorKey
  ));
  if (actorMatches.length === 1) return actorMatches[0];

  if (candidates.length === 1) return candidates[0];
  return null;
}

export type AcreditacionActiveSourcesSummary = {
  activeSurveys: number;
  surveysWithActor: number;
  activeSheetBases: number;
  actorsWithSurvey: string[];
  actorsWithSheet: string[];
  missingSheetActors: string[];
  includedCollectors: number;
  excludedCollectors: number;
  missingCollectorMetadata: number;
  lastSync: string;
};

export function buildAcreditacionActiveSourcesSummary(
  sources: MonitoreoSource[],
  linkCollectors: MonitoreoLinkCollector[] = [],
) {
  const activeSources = sources.filter((source) => source.enabled);
  const activeSurveys = acreditacionPlatformResponseSources(activeSources);
  const activeSheetBases = activeSources.filter((source) => source.kind === "google_sheets" && source.role === "universo");
  const actorsWithSurvey = acreditacionActorOptions(activeSurveys);
  const actorsWithSheet = acreditacionActorOptions(activeSheetBases);
  const sheetKeys = new Set(actorsWithSheet.map(normalizeKey));
  const collectorRows = activeSurveys.flatMap((source) => acreditacionCollectorsForSource(source, linkCollectors));
  const stamps = activeSources
    .map((source) => compactLabel(source.last_sync_at))
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime());

  return {
    activeSurveys: activeSurveys.length,
    surveysWithActor: activeSurveys.filter((source) => Boolean(acreditacionSourceActor(source))).length,
    activeSheetBases: activeSheetBases.length,
    actorsWithSurvey,
    actorsWithSheet,
    missingSheetActors: actorsWithSurvey.filter((actor) => !sheetKeys.has(normalizeKey(actor))),
    includedCollectors: collectorRows.filter((collector) => collector.enabled).length,
    excludedCollectors: collectorRows.filter((collector) => !collector.enabled).length,
    missingCollectorMetadata: collectorRows.filter((collector) => !collector.hasPlatformMetadata).length,
    lastSync: stamps[0] ?? "",
  } satisfies AcreditacionActiveSourcesSummary;
}
