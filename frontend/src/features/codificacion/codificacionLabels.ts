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

// Solo para etiquetas de OPCIÓN que traen los dos idiomas seguidos ("Prefiere no responder Prefers not to
// answer"). La cola en inglés empieza en mayúscula, y por eso la búsqueda distingue mayúsculas: sin eso, la
// preposición castellana "a" pasaba por el artículo inglés y "Atención a migrantes" quedaba en "Atención".
// El texto libre de una respuesta no pasa por aquí: ver `displayRespuestaLabel`.
function splitBilingualLabel(value: string): string {
  for (const token of ENGLISH_BOUNDARIES) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = value.match(new RegExp(`\\s+${escaped}\\b`));
    // La parte en castellano puede ser corta ("Otro Other", "Otros Other"): bastan tres caracteres antes de la
    // cola. Los artículos "A" y "An" piden seis, como antes: con menos, "Zona A norte" o "Grupo A y B"
    // quedarían en "Zona" y "Grupo".
    const minimo = token === "A " || token === "An " ? 6 : 3;
    if (match?.index && match.index >= minimo) {
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
  const title = rawLabel ? `${code}. ${rawLabel}` : code;

  if (!cleanLabel || cleanLabel.toLowerCase() === cleanCode.toLowerCase()) {
    return { label: cleanCode || code, title };
  }

  if (isTechnicalCode(cleanCode)) {
    return { code: cleanCode, label: cleanLabel, title };
  }

  return { label: cleanCode || cleanLabel, title };
}

/**
 * Cómo se muestra una respuesta en Codificar. Si trae `label`, la respuesta es el código de una opción y se
 * muestra como tal. Si no, es el texto libre de la persona encuestada: se muestra entero, sin partirlo; solo
 * se normalizan los espacios y, como antes, un "si" o un "no" sueltos se escriben "Sí" y "No".
 */
export function displayRespuestaLabel(texto: string, label?: string | null): CodificacionDisplayLabel {
  if (label) return displayCodificacionValueLabel(texto, label);
  const visible = normalizeSpaces(texto);
  return { label: canonicalShortAnswer(visible) ?? (visible || texto), title: texto };
}
