/**
 * Canoniza únicamente los dos códigos operativos de aulas acreditados.
 * Es puro, idempotente y conservador: un valor desconocido se devuelve
 * intacto (salvo espacios exteriores), sin intentar adivinar su significado.
 */
export function canonicalClassroomOperationalCode(
  value: unknown,
  fallback: unknown = "",
): string {
  const raw = String(value ?? "").trim() || String(fallback ?? "").trim();
  if (!raw) return "";

  const titular = raw.match(/^(?:AULA|CH)\s*(\d+)$/i);
  if (titular) return `CH ${normalizeCodeNumber(titular[1])}`;

  const replacement = raw.match(/^R\s*(\d+)\s*\.\s*(\d+)$/i);
  if (replacement) {
    return `R ${normalizeCodeNumber(replacement[1])}.${normalizeCodeNumber(replacement[2])}`;
  }

  return raw;
}

function normalizeCodeNumber(value: string): string {
  return value.replace(/^0+(?=\d)/, "");
}
