// Modelo de fuentes de Telefónico y Acreditación: las funciones idénticas en
// TelefonicoSourcesModel y AcreditacionSourcesModel (L33 parte 2, lote 4). Se
// movieron sin cambiar una línea; los dos modelos las importan y reexportan las
// que ya eran públicas, así nadie que las importe cambia.
import type { MonitoreoLinkCollector, MonitoreoSource, MonitoreoSourceCollector, MonitoreoSourceMetadata } from "../../../api/client";

export function acreditacionActorOptions(
  sources: MonitoreoSource[],
  manualActors: string[] = [],
) {
  return uniqueLabels([
    ...sources.map(acreditacionSourceActor),
    ...manualActors,
  ]);
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
export function acreditacionCollectorPlatformName(
  collector: MonitoreoSourceCollector | MonitoreoLinkCollector,
) {
  return compactLabel("name" in collector ? collector.name : "")
    || compactLabel(collector.collector_name)
    || "";
}
export function acreditacionKoboResponseSources(sources: MonitoreoSource[]) {
  return acreditacionPlatformResponseSources(sources).filter((source) => source.kind === "kobo");
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
export function acreditacionSourceActor(source: MonitoreoSource) {
  return compactLabel(source.dimensions?.actor)
    || compactLabel(source.dimensions?.carrera)
    || compactLabel(source.dimensions?.segmento)
    || compactLabel(source.dimensions?.unidad);
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
export function acreditacionSurveySourceName(source: MonitoreoSource) {
  return compactLabel(source.survey_title)
    || compactLabel(source.dimensions?.survey_title)
    || compactLabel(source.label)
    || compactLabel(source.survey_id)
    || source.id;
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
export function collectorCountValue(value: MonitoreoSourceCollector | MonitoreoLinkCollector | undefined) {
  if (!value) return 0;
  const sourceValue = Number("active_response_count" in value ? value.active_response_count : 0);
  const fallbackValue = Number("response_count" in value ? value.response_count : 0);
  if (Number.isFinite(sourceValue) && sourceValue > 0) return sourceValue;
  return Number.isFinite(fallbackValue) ? fallbackValue : 0;
}
export function collectorIdOf(value: Pick<MonitoreoSourceCollector, "collector_id"> | Pick<MonitoreoLinkCollector, "collector_id">) {
  return compactLabel(value.collector_id);
}
export function compactLabel(value: unknown) {
  return String(value ?? "").trim();
}
export function isAcreditacionTelephoneValue(value: unknown) {
  const key = normalizeKey(value);
  return key.includes("telefon") || key.includes("phone") || key.includes("llamada") || key.includes("call");
}
export function metadataCollectorsForSource(
  source: MonitoreoSource,
  sourceMetadata?: MonitoreoSourceMetadata | null,
) {
  return (sourceMetadata?.collectors ?? [])
    .filter((collector) => sourceMatchesOperationalMetadata(source, collector.source_id, collector.survey_id));
}
export function metadataSourceForSource(
  source: MonitoreoSource,
  sourceMetadata?: MonitoreoSourceMetadata | null,
) {
  return (sourceMetadata?.sources ?? [])
    .find((item) => sourceMatchesOperationalMetadata(source, item.id, item.survey_id));
}
export function metadataSurveyForSource(
  source: MonitoreoSource,
  sourceMetadata?: MonitoreoSourceMetadata | null,
) {
  const surveys = Object.values(sourceMetadata?.surveys ?? {});
  return surveys.find((survey) => sourceMatchesOperationalMetadata(source, survey.source_id, survey.survey_id));
}
export function normalizeKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
export function positiveCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}
export function sourceCollectorText(source: MonitoreoSource) {
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
export function sourceHasEmailEvidence(source: MonitoreoSource, rawChannel: string) {
  const key = normalizeKey([
    rawChannel,
    source.label,
    source.survey_title,
    source.dimensions?.survey_title,
    sourceCollectorText(source),
  ].filter(Boolean).join(" "));
  return key.includes("correo") || key.includes("email") || key.includes("mail");
}
export function sourceHasExplicitNonEmailChannel(source: MonitoreoSource) {
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
export function sourceMatchesOperationalMetadata(source: MonitoreoSource, sourceId: unknown, surveyId: unknown) {
  const ownSourceId = compactLabel(source.id);
  const ownSurveyId = compactLabel(source.survey_id);
  const metadataSourceId = compactLabel(sourceId);
  const metadataSurveyId = compactLabel(surveyId);
  return (
    (ownSourceId && metadataSourceId && ownSourceId === metadataSourceId)
    || (ownSurveyId && metadataSurveyId && ownSurveyId === metadataSurveyId)
  );
}
export function sourceUsesInstitutionalEmailByDefault(source: MonitoreoSource) {
  const actor = normalizeKey(acreditacionSourceActor(source));
  return (
    (actor.includes("docent") || actor.includes("administr"))
    && !sourceHasExplicitNonEmailChannel(source)
  );
}
export function uniqueLabels(values: unknown[]) {
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
