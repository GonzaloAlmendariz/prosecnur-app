const TEXT_KEYS = ["label", "nombre", "titulo", "title", "name", "texto", "text", "value"];

export function safeText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;

  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const text = value
      .map((item) => safeText(item, ""))
      .map((item) => item.trim())
      .filter(Boolean)
      .join(", ");
    return text || fallback;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of TEXT_KEYS) {
      if (!(key in obj)) continue;
      const text = safeText(obj[key], "").trim();
      if (text) return text;
    }
    return fallback;
  }

  return fallback;
}

export function safeTrimmedText(value: unknown, fallback = ""): string {
  const text = safeText(value, "").trim();
  return text || fallback;
}

export function textOrNull(value: unknown): string | null {
  const text = safeTrimmedText(value);
  return text ? text : null;
}
