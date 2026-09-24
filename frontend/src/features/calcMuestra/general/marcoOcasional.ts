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
    estratos: "Marco por capas o variables de control",
    conglomerados: "Marco con unidades agrupadas",
    servicios: "Atenciones por servicio y municipalidad",
    cuotas_controladas: "Control no probabilístico con variables disponibles",
    cobertura: "Marco a cubrir o contactar",
  };
  return labels[kind];
}
