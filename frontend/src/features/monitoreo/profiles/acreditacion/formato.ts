// Formateadores y normalizadores del perfil, extraídos del page-file
// congelado (AcreditacionMonitoreoPage.tsx) en la ola 2 del plan de performance.
// Copia por perfil deliberada: telefónico es un fork vivo de acreditación
// y cada gemelo conserva la suya para que el diff siga siendo legible.

export function fmt(value: unknown, fallback = "0") {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (Number.isFinite(n)) return new Intl.NumberFormat("es-PE").format(n);
  return String(value);
}

export function formatMetric(value: number | null | undefined) {
  return fmt(value ?? 0);
}

export function countText(count: number, singular: string, plural = `${singular}s`) {
  return `${fmt(count)} ${count === 1 ? singular : plural}`;
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

export function normalizeSourceMatch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * La marca de dos letras de un actor.
 *
 * Dos y no una: con una sola, «Egresados» y «Estudiantes» son ambos «E» y la
 * marca deja de distinguir justo en el par que más aparece junto. Con dos
 * palabras toma la inicial de cada una («Ex alumnos» → «EA»); con una, sus dos
 * primeras letras.
 */
export function actorInitialLabel(value: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalizeSourceMatch(normalized) === "sin actor") return "?";
  const words = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const letters = words.length > 1
    ? words.slice(0, 2).map((word) => word.charAt(0)).join("")
    : (words[0] ?? normalized).slice(0, 2);
  return letters.toLocaleUpperCase("es-PE");
}
