// Color de acento determinístico por grupo de codificación.
//
// Cada grupo (categoría) recibe un color estable para que la pertenencia de
// una respuesta a varios grupos se lea de un vistazo (chips de color en la
// fila de respuesta + punto de color en la tarjeta del grupo). El color se
// deriva del CÓDIGO del grupo (no del id efímero) para que sea estable entre
// sesiones y consistente entre la fila y la tarjeta.
//
// Para códigos numéricos secuenciales usamos el ángulo áureo (~137.5°) que
// maximiza la separación de matices entre categorías contiguas (1, 2, 3…). Para
// códigos no numéricos caemos a un hash simple del texto — mismo patrón que
// `sectionColor` en carga/PreguntasPanel.

const GOLDEN_ANGLE = 137.508;

export function grupoHue(codigo: string, fallbackSeed: string): number {
  const trimmed = (codigo ?? "").trim();
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(n) && /^\d+$/.test(trimmed)) {
    return Math.round(((n * GOLDEN_ANGLE) % 360 + 360) % 360);
  }
  const seed = trimmed || fallbackSeed || "";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

// Color de acento pleno del grupo (para el punto de color y como semilla del
// color-mix de fondo/borde de los chips en el CSS).
export function grupoAccentColor(codigo: string, fallbackSeed: string): string {
  return `hsl(${grupoHue(codigo, fallbackSeed)}, 62%, 45%)`;
}
