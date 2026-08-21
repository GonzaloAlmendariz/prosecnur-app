/**
 * El veredicto del cruce de distritos entre Hojas de Ruta y Kobo.
 *
 * Vivía inline en el JSX de `TerritorialSourceConsole` y decía:
 *
 * ```
 * alignedDistricts.length >= routeDistrictTotal ? "Hojas de Ruta y Kobo coinciden" : …
 * ```
 *
 * **`0 >= 0` es `true`.** Sin un solo distrito cargado, la tarjeta enseñaba
 * «0 de 0», declaraba que las dos fuentes coinciden y se pintaba `ready`
 * —verde—. No es que cuadren: es que no hay nada que cruzar.
 *
 * El porcentaje de esa misma pantalla (`districtCrossPct`) protegía el cero
 * desde siempre con un ternario; el veredicto y el tono, que es lo que se lee
 * de un vistazo, no. Mismo patrón que `32a4234e` en telefónico: el precedente
 * aplicado en un sitio y no en el vecino.
 *
 * Sale del componente para poder comprobarse: la decisión es de tres ramas y
 * estaba enterrada en una línea de JSX de un archivo de 1 800 líneas.
 */
export type VeredictoDeDistritos = {
  valor: string;
  pista: string;
  tono: "ready" | "warning";
};

export function cruceDeDistritos(alineados: number, total: number, fmt: (n: number) => string): VeredictoDeDistritos {
  if (total <= 0) {
    return {
      valor: "Sin distritos",
      pista: "Todavía no hay distritos que cruzar entre Hojas de Ruta y Kobo",
      tono: "warning",
    };
  }
  const cuadran = alineados >= total;
  return {
    valor: `${fmt(alineados)} de ${fmt(total)}`,
    pista: cuadran ? "Hojas de Ruta y Kobo coinciden" : "Revisar cobertura territorial",
    tono: cuadran ? "ready" : "warning",
  };
}
