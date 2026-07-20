export type CodificacionDisplayLabel = {
  code?: string;
  label: string;
  title: string;
};

const ENGLISH_BOUNDARIES = [
  "Proximity",
  "Good",
  "Trust",
  "Easy",
  "Only",
  "Prefers",
  "Prefer",
  "Would",
  "Could",
  "Should",
  "Does",
  "Did",
  "Why",
  "What",
  "Which",
  "Where",
  "When",
  "How",
  "Please",
  "Other",
  "None",
  "The",
  "This",
  "That",
  "A ",
  "An ",
];

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function canonicalShortAnswer(value: string): string | null {
  const comparable = stripAccents(normalizeSpaces(value)).toLowerCase();
  if (["si", "sí", "yes", "y"].includes(comparable)) return "Sí";
  if (["no", "n"].includes(comparable)) return "No";
  if (["no se", "no sabe", "don't know", "dont know"].includes(comparable)) return "No sabe";
  return null;
}

function splitBilingualLabel(value: string): string {
  for (const token of ENGLISH_BOUNDARIES) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = value.match(new RegExp(`\\s+${escaped}\\b`, "i"));
    if (match?.index && match.index >= 6) {
      const left = normalizeSpaces(value.slice(0, match.index));
      if (left.length >= 3) return left;
    }
  }
  return value;
}

export function cleanCodificacionLabel(raw?: string | null): string {
  const value = normalizeSpaces(String(raw ?? ""));
  if (!value) return "";

  const short = canonicalShortAnswer(value);
  if (short) return short;

  const duplicatedYesNo = value.match(/^(si|sí)\s+yes$/i);
  if (duplicatedYesNo) return "Sí";
  if (/^no\s+no$/i.test(value)) return "No";

  const compact = splitBilingualLabel(value);
  return canonicalShortAnswer(compact) ?? compact;
}

function isTechnicalCode(value: string): boolean {
  if (!value) return false;
  if (/^\d+$/.test(value)) return true;
  if (/^[A-Za-z][A-Za-z0-9_./-]{1,14}$/.test(value)) {
    return !["Sí", "No", "No sabe"].includes(value);
  }
  return false;
}

export function displayCodificacionValueLabel(code: string, rawLabel?: string | null): CodificacionDisplayLabel {
  const cleanCode = cleanCodificacionLabel(code);
  const cleanLabel = cleanCodificacionLabel(rawLabel);
  const title = rawLabel ? `${code} · ${rawLabel}` : code;

  if (!cleanLabel || cleanLabel.toLowerCase() === cleanCode.toLowerCase()) {
    return { label: cleanCode || code, title };
  }

  if (isTechnicalCode(cleanCode)) {
    return { code: cleanCode, label: cleanLabel, title };
  }

  return { label: cleanCode || cleanLabel, title };
}
