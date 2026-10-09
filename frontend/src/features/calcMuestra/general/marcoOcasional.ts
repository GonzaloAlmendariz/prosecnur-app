/**
 * La forma del marco que el usuario elige en Muestra general. Extraída de
 * `CalcMuestraPage.tsx` (congelado a crecimiento): la etiqueta es la que se
 * guarda en `workspace.marco_disponible`, así que no cambia de texto.
 */
export type MarcoOcasional =
  | "marco_total"
  | "estratos"
  | "conglomerados"
  | "servicios"
  | "cuotas_controladas"
  | "cobertura";

export function labelMarcoOcasional(kind: MarcoOcasional) {
  const labels: Record<MarcoOcasional, string> = {
    marco_total: "Marco total enumerable",
    estratos: "Marco por estratos o variables de control",
    conglomerados: "Marco con unidades agrupadas",
    servicios: "Marco con volumen por celda",
    cuotas_controladas: "Muestreo por cuotas con variables disponibles",
    cobertura: "Marco para censo o cobertura total",
  };
  return labels[kind];
}

/** Rótulos que versiones previas guardaron en `workspace.marco_disponible`; se siguen reconociendo. */
const ROTULOS_PREVIOS: Partial<Record<MarcoOcasional, string[]>> = {
  servicios: ["Atenciones por servicio y municipalidad"],
  estratos: ["Marco por capas o variables de control"],
  cuotas_controladas: ["Control no probabilístico con variables disponibles"],
  cobertura: ["Marco a cubrir o contactar"],
};

/** ¿El rótulo guardado en el proyecto corresponde a esta forma de marco? */
export function marcoOcasionalCoincide(guardado: string, kind: MarcoOcasional): boolean {
  return guardado === labelMarcoOcasional(kind) || (ROTULOS_PREVIOS[kind] ?? []).includes(guardado);
}
