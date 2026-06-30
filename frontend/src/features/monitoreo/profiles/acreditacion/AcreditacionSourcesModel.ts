import type { MonitoreoLinkCollector, MonitoreoSource, MonitoreoSourceCollector, MonitoreoSourceMetadata } from "../../../../api/client";

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function compactLabel(value: unknown) {
  return String(value ?? "").trim();
}

function uniqueLabels(values: unknown[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const label = compactLabel(value);
    const key = normalizeKey(label);
    if (!label || !key || key === "sin actor" || key === "sin dato" || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

export function acreditacionSurveySourceName(source: MonitoreoSource) {
  return compactLabel(source.survey_title)
    || compactLabel(source.dimensions?.survey_title)
    || compactLabel(source.label)
    || compactLabel(source.survey_id)
    || source.id;
}

export function acreditacionSourceActor(source: MonitoreoSource) {
  return compactLabel(source.dimensions?.actor)
    || compactLabel(source.dimensions?.carrera)
    || compactLabel(source.dimensions?.segmento)
    || compactLabel(source.dimensions?.unidad);
}

function sourceCollectorText(source: MonitoreoSource) {
  return (source.collectors ?? [])
    .map((collector) => [
      collector.collector_name,
      collector.name,
      collector.collector_type,
      collector.type,
      collector.channel,
      collector.operational_use,
      collector.modality,
    ].filter(Boolean).join(" "))
    .join(" ");
}

function sourceHasEmailEvidence(source: MonitoreoSource, rawChannel: string) {
  const key = normalizeKey([
    rawChannel,
    source.label,
    source.survey_title,
    source.dimensions?.survey_title,
    sourceCollectorText(source),
  ].filter(Boolean).join(" "));
  return key.includes("correo") || key.includes("email") || key.includes("mail");
}

function sourceHasExplicitNonEmailChannel(source: MonitoreoSource) {
  const key = normalizeKey([
    source.dimensions?.canal,
    source.dimensions?.channel,
    source.dimensions?.modalidad,
    source.dimensions?.medio,
    source.label,
    source.survey_title,
    source.dimensions?.survey_title,
    sourceCollectorText(source),
  ].filter(Boolean).join(" "));
  return (
    key.includes("whatsapp")
    || key.includes("sms")
    || key.includes("telefon")
    || key.includes("phone")
    || key.includes("llamada")
    || key.includes("presencial")
    || key.includes("qr")
  );
}

function sourceUsesInstitutionalEmailByDefault(source: MonitoreoSource) {
  const actor = normalizeKey(acreditacionSourceActor(source));
  return (
    (actor.includes("docent") || actor.includes("administr"))
    && !sourceHasExplicitNonEmailChannel(source)
  );
}

export function acreditacionSourceChannel(source: MonitoreoSource) {
  const rawChannel = compactLabel(source.dimensions?.canal)
    || compactLabel(source.dimensions?.channel)
    || compactLabel(source.dimensions?.modalidad)
    || compactLabel(source.dimensions?.medio);
  if (rawChannel) return rawChannel;
  if (source.kind === "surveymonkey" && (sourceHasEmailEvidence(source, "") || sourceUsesInstitutionalEmailByDefault(source))) {
    return "Correo";
  }
  return source.kind === "google_sheets" ? "Base" : "";
}

function isAcreditacionTelephoneValue(value: unknown) {
  const key = normalizeKey(value);
  return key.includes("telefon") || key.includes("phone") || key.includes("llamada") || key.includes("call");
}

export function acreditacionActorOptions(
  sources: MonitoreoSource[],
  manualActors: string[] = [],
) {
  return uniqueLabels([
    ...sources.map(acreditacionSourceActor),
    ...manualActors,
  ]);
}

export function acreditacionCollectorPlatformName(
  collector: MonitoreoSourceCollector | MonitoreoLinkCollector,
) {
  return compactLabel("name" in collector ? collector.name : "")
    || compactLabel(collector.collector_name)
    || "";
}

export function acreditacionCollectorAlias(
  collector: MonitoreoLinkCollector,
  platformName: string,
) {
  const alias = compactLabel(collector.collector_name);
  const real = compactLabel(platformName);
  if (!alias || !real) return alias;
  return normalizeKey(alias) === normalizeKey(real) ? "" : alias;
}

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

function collectorIdOf(value: Pick<MonitoreoSourceCollector, "collector_id"> | Pick<MonitoreoLinkCollector, "collector_id">) {
  return compactLabel(value.collector_id);
}

function collectorCountValue(value: MonitoreoSourceCollector | MonitoreoLinkCollector | undefined) {
  if (!value) return 0;
  const sourceValue = Number("active_response_count" in value ? value.active_response_count : 0);
  const fallbackValue = Number("response_count" in value ? value.response_count : 0);
  if (Number.isFinite(sourceValue) && sourceValue > 0) return sourceValue;
  return Number.isFinite(fallbackValue) ? fallbackValue : 0;
}

function positiveCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function sourceMatchesOperationalMetadata(source: MonitoreoSource, sourceId: unknown, surveyId: unknown) {
  const ownSourceId = compactLabel(source.id);
  const ownSurveyId = compactLabel(source.survey_id);
  const metadataSourceId = compactLabel(sourceId);
  const metadataSurveyId = compactLabel(surveyId);
  return (
    (ownSourceId && metadataSourceId && ownSourceId === metadataSourceId)
    || (ownSurveyId && metadataSurveyId && ownSurveyId === metadataSurveyId)
  );
}

function metadataCollectorsForSource(
  source: MonitoreoSource,
  sourceMetadata?: MonitoreoSourceMetadata | null,
) {
  return (sourceMetadata?.collectors ?? [])
    .filter((collector) => sourceMatchesOperationalMetadata(source, collector.source_id, collector.survey_id));
}

function metadataSurveyForSource(
  source: MonitoreoSource,
  sourceMetadata?: MonitoreoSourceMetadata | null,
) {
  const surveys = Object.values(sourceMetadata?.surveys ?? {});
  return surveys.find((survey) => sourceMatchesOperationalMetadata(source, survey.source_id, survey.survey_id));
}

function metadataSourceForSource(
  source: MonitoreoSource,
  sourceMetadata?: MonitoreoSourceMetadata | null,
) {
  return (sourceMetadata?.sources ?? [])
    .find((item) => sourceMatchesOperationalMetadata(source, item.id, item.survey_id));
}

export function acreditacionSourceWithOperationalMetadata(
  source: MonitoreoSource,
  sourceMetadata?: MonitoreoSourceMetadata | null,
): MonitoreoSource {
  const metadataCollectors = metadataCollectorsForSource(source, sourceMetadata);
  const metadataSurvey = metadataSurveyForSource(source, sourceMetadata);
  const metadataSource = metadataSourceForSource(source, sourceMetadata);
  const hasCollectors = Boolean(source.collectors?.length);
  const fallbackHasRows = metadataCollectors.some((collector) => positiveCount(collector.active_response_count) || positiveCount(collector.response_count))
    || positiveCount(metadataSurvey?.response_count) > 0;
  const generatedAt = compactLabel(sourceMetadata?.generated_at);
  const lastSyncAt = compactLabel(source.last_sync_at)
    || compactLabel(metadataSource?.last_sync_at)
    || (fallbackHasRows ? generatedAt : "");
  if (
    hasCollectors
    && lastSyncAt === compactLabel(source.last_sync_at)
    && compactLabel(source.survey_title)
    && compactLabel(source.label)
  ) {
    return source;
  }
  return {
    ...source,
    label: compactLabel(source.label) || compactLabel(metadataSurvey?.label) || source.label,
    survey_title: compactLabel(source.survey_title) || compactLabel(metadataSurvey?.title) || source.survey_title,
    collectors: hasCollectors ? source.collectors : metadataCollectors,
    last_sync_at: lastSyncAt || source.last_sync_at,
  };
}

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

export function acreditacionSweepSources(sources: MonitoreoSource[]) {
  return sources.filter((source) => (
    source.kind === "google_sheets"
    && (
      normalizeKey(source.role) === "barrido"
      || (
        !compactLabel(source.role)
        && (
          normalizeKey(source.label).includes("barrido")
          || normalizeKey(source.label).includes("asignacion")
          || normalizeKey(source.label).includes("responsable")
          || normalizeKey(source.label).includes("estado")
        )
      )
    )
  ));
}

export function acreditacionTelephoneUniverseSources(sources: MonitoreoSource[]) {
  return sources.filter((source) => (
    source.kind === "google_sheets"
    && (
      normalizeKey(source.role) === "universo"
      || (
        !compactLabel(source.role)
        && (
          normalizeKey(source.label).includes("universo")
          || normalizeKey(source.label).includes("base telefon")
          || normalizeKey(source.label).includes("base de contactos")
        )
        && !normalizeKey(source.label).includes("barrido")
      )
    )
  ));
}

export type AcreditacionPhoneSourceSlot = {
  key: "universo" | "barrido";
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
  ready: boolean;
  missing: Array<"universo" | "barrido">;
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
  const universeStatus = phoneSlotStatus(universeSources);
  const sweepStatus = phoneSlotStatus(sweepSources);
  const universe: AcreditacionPhoneSourceSlot = {
    key: "universo",
    label: "Base telefónica / universo",
    purpose: "Personas contactables, variables de cuota y población objetivo.",
    expected: ["sede", "atencion", "tramite", "origen", "telefono"],
    sources: universeSources,
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
  return {
    universe,
    sweep,
    ready: universe.ready && sweep.ready,
    missing: [
      ...(!universe.ready ? ["universo" as const] : []),
      ...(!sweep.ready ? ["barrido" as const] : []),
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
  const activeSurveys = activeSources.filter((source) => source.kind === "surveymonkey");
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
