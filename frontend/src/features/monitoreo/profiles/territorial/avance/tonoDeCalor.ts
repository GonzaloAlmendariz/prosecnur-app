/**
 * Tono de una celda del mapa de calor «Logrado frente a la cuota»: bajo la
 * cuota, el ámbar de aviso; de 100 % a 125 % o más, del azul más suave al marino.
 * Lo comparten Faltante por UMP y el avance por zona (envío por cuotas).
 */
export function tonoDeCalor(logrado: number, meta: number): { fondo: string; tinta: "clara" | "oscura" } {
  if (!(meta > 0)) return { fondo: "var(--pulso-surface-3)", tinta: "oscura" };
  const razon = logrado / meta;
  if (razon < 1) return { fondo: "var(--pulso-warn-bg)", tinta: "oscura" };
  // De 100 % a 125 % o más, del azul más suave al marino.
  const intensidad = Math.round(28 + Math.min(1, (razon - 1) / 0.25) * 52);
  return {
    fondo: `color-mix(in srgb, var(--pulso-brand-navy) ${intensidad}%, var(--pulso-surface))`,
    tinta: intensidad >= 50 ? "clara" : "oscura",
  };
}
