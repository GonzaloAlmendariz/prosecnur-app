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

/**
 * Canal de un recopilador, del dato más específico al más genérico.
 *
 * El orden importa y aquí estuvo el defecto. Antes era
 *
 *     saved?.channel || sourceChannel || platform?.channel || "Sin clasificar"
 *
 * con el canal de la ENCUESTA por delante del canal del propio recopilador.
 * Como toda encuesta tiene canal, `platform.channel` no se alcanzaba nunca: en
 * `acrconta`, los 20 recopiladores de la encuesta de Estudiantes —10 de ellos
 * `email`— se pintaban como «Presencial (Ficha QR)», y la tarjeta lo remataba
 * con «ninguno con excepción», presentando como confirmado algo que nadie
 * confirmó.
 *
 * La regla nueva: **el tipo que la plataforma reporta no se sobrescribe con una
 * conjetura**. Un recopilador de correo no es presencial por mucho que su
 * encuesta se aplique con ficha QR. Un `weblink` sí hereda, porque una ficha QR
 * es literalmente un enlace web y ahí el canal de la encuesta es la mejor
 * información disponible.
 */
function canalDelRecopilador({
  saved,
  platform,
  sourceChannel,
}: {
  saved?: MonitoreoLinkCollector;
  platform?: MonitoreoSourceCollector;
  sourceChannel: string;
}) {
  // 1. Lo que el usuario confirmó.
  const confirmado = compactLabel(saved?.channel);
  if (confirmado) return confirmado;

  // 2. Lo que el TIPO de recopilador determina, y solo cuando lo determina.
  //    `collector_type` es dato duro de la plataforma; `collector.channel` no
  //    —arrastra nombres heredados como «Correo institucional historico» en
  //    recopiladores que no son de correo—, y por eso el canal de la encuesta
  //    le gana a ese campo. Un `weblink` no determina nada: una ficha QR, un
  //    enlace de WhatsApp y un link abierto son todos weblinks.
  const tipo = normalizeKey(platform?.collector_type ?? platform?.type ?? saved?.collector_type);
  if (tipo === "email") return "Correo";
  if (tipo === "sms") return "Enlace personalizado (Whatsapp)";

  // 3. El canal declarado en la encuesta.
  if (sourceChannel) return sourceChannel;

  // 4. Como último recurso, el campo blando del recopilador.
  return compactLabel(platform?.channel) || "Sin clasificar";
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
    const channel = canalDelRecopilador({ saved, platform, sourceChannel });
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

export function acreditacionPlatformResponseSources(sources: MonitoreoSource[]) {
  return sources.filter((source) => (
    (source.kind === "surveymonkey" || source.kind === "kobo")
    && (
      normalizeKey(source.role) === "respuestas"
      || !compactLabel(source.role)
      || Boolean(compactLabel(source.survey_id))
      || Boolean(compactLabel(source.asset_uid))
    )
  ));
}

export function acreditacionKoboResponseSources(sources: MonitoreoSource[]) {
  return acreditacionPlatformResponseSources(sources).filter((source) => source.kind === "kobo");
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
    purpose: sweepCoversUniverse
      ? "La hoja activa también define casos, cuotas y población objetivo."
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
    label: "Kobo",
    purpose: "Efectivas Kobo filtradas para comparar avance por CodPulso.",
    expected: ["CodPulso", "consentimiento", "fecha", "respuesta", "asset"],
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
  /** Solo las bases de universo: una por actor. Gobierna la cobertura por actor. */
  activeSheetBases: number;
  /** TODAS las hojas activas (universo + barrido + correo). Es la que cierra el inventario. */
  activeSheets: number;
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
  const activeSheets = activeSources.filter((source) => source.kind === "google_sheets");
  const activeSheetBases = activeSheets.filter((source) => source.role === "universo");
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
    activeSheets: activeSheets.length,
    actorsWithSurvey,
    actorsWithSheet,
    missingSheetActors: actorsWithSurvey.filter((actor) => !sheetKeys.has(normalizeKey(actor))),
    includedCollectors: collectorRows.filter((collector) => collector.enabled).length,
    excludedCollectors: collectorRows.filter((collector) => !collector.enabled).length,
    missingCollectorMetadata: collectorRows.filter((collector) => !collector.hasPlatformMetadata).length,
    lastSync: stamps[0] ?? "",
  } satisfies AcreditacionActiveSourcesSummary;
}
