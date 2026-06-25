import type { MonitoreoLinkCollector, MonitoreoSurveyMonkeyCollector } from "../../../api/client";

type CollectorDisplayContext = {
  sourceActor?: string;
  sourceChannel?: string;
  sourceLabel?: string;
  channel?: string;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeText(value: unknown) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function technicalCollectorLabel(value: string, collectorId: string) {
  const label = normalizeText(value);
  const id = normalizeText(collectorId);
  if (!label) return true;
  if (id && label === id) return true;
  if (/^\d{5,}$/.test(label)) return true;
  if (/^(id\s*)?(collector|colector|recopilador|enlace|link|web link)\s*[:#-]?\s*\d{4,}$/i.test(value)) return true;
  if (/^(collector|colector|recopilador)\s*[:#-]?\s*[a-z0-9_-]{5,}$/i.test(value) && /\d/.test(value)) return true;
  if (/^recopilador\s+.+\s*[·.-]\s*(correo|whatsapp|telefonico|telefónico|ficha\s*qr|qr|sms|mixto|web)$/i.test(value)) return true;
  return false;
}

export function collectorHumanName(
  item: Pick<MonitoreoSurveyMonkeyCollector | MonitoreoLinkCollector, "collector_id" | "collector_name">,
) {
  const collectorName = cleanText(item.collector_name);
  const collectorId = cleanText(item.collector_id);
  return collectorName && !technicalCollectorLabel(collectorName, collectorId) ? collectorName : "";
}

export function bestCollectorName(
  primary: Pick<MonitoreoSurveyMonkeyCollector | MonitoreoLinkCollector, "collector_id" | "collector_name">,
  fallback?: Pick<MonitoreoSurveyMonkeyCollector | MonitoreoLinkCollector, "collector_id" | "collector_name"> | null,
) {
  const primaryHuman = collectorHumanName(primary);
  if (primaryHuman) return primaryHuman;
  const fallbackHuman = fallback ? collectorHumanName({
    collector_id: primary.collector_id || fallback.collector_id,
    collector_name: fallback.collector_name,
  }) : "";
  if (fallbackHuman) return fallbackHuman;
  return cleanText(primary.collector_name) || cleanText(fallback?.collector_name);
}

export function collectorPrimaryDisplayName(
  item: Pick<MonitoreoSurveyMonkeyCollector | MonitoreoLinkCollector, "collector_id" | "collector_name" | "source_label" | "channel">,
  context: CollectorDisplayContext = {},
) {
  const collectorName = collectorHumanName(item);
  const collectorId = cleanText(item.collector_id);
  if (collectorName) {
    return collectorName;
  }

  const sourceLabel = cleanText(context.sourceLabel || item.source_label);
  const sourceWithoutProvider = sourceLabel.replace(/^SurveyMonkey\s*[·-]?\s*/i, "").trim();
  const actor = cleanText(context.sourceActor);
  const channel = cleanText(context.channel || item.channel || context.sourceChannel);
  const sourceChannel = cleanText(context.sourceChannel);
  const operationalPieces = [actor, channel || sourceChannel].filter(Boolean);
  if (operationalPieces.length) {
    return operationalPieces.join(" · ");
  }
  if (sourceWithoutProvider && !technicalCollectorLabel(sourceWithoutProvider, collectorId)) {
    return sourceWithoutProvider;
  }
  return "Nombre no sincronizado";
}

export function collectorSecondaryDisplayMeta(
  item: Pick<MonitoreoSurveyMonkeyCollector | MonitoreoLinkCollector, "collector_id" | "collector_name">,
) {
  const collectorId = cleanText(item.collector_id);
  const collectorName = cleanText(item.collector_name);
  if (!collectorId) return "";
  if (collectorName && !technicalCollectorLabel(collectorName, collectorId)) return `ID ${collectorId}`;
  return `ID técnico ${collectorId}`;
}
