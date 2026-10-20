// Valores de prueba de un cálculo: lo tecleado manda; lo demás sale del tipo de cada pregunta. Puro, con tests.

type Opcion = { name: string };

/** Un valor de ejemplo según el tipo. Sin tipo conocido (otro cálculo, una fila fuera del esquema) va un número:
 *  la mayoría de cálculos operan con números, y «ejemplo» en un campo numérico no prueba nada. */
export function ejemploPorTipo(base: string, opciones: readonly Opcion[]): string {
  switch (base) {
    case "select_one":
      return opciones[0]?.name ?? "1";
    case "select_multiple":
      return opciones.slice(0, 2).map((o) => o.name).join(" ") || "1";
    case "date":
      return new Date().toISOString().slice(0, 10);
    case "text":
      return "ejemplo";
    default:
      return "3";
  }
}

export function valoresDePrueba(
  usa: readonly string[],
  tecleados: Readonly<Record<string, string>>,
  tipoDe: (v: string) => { base: string; opciones: readonly Opcion[] },
): Record<string, string> {
  return Object.fromEntries(usa.map((v) => {
    if (Object.prototype.hasOwnProperty.call(tecleados, v)) return [v, tecleados[v] ?? ""];
    const t = tipoDe(v);
    return [v, ejemploPorTipo(t.base, t.opciones)];
  }));
}
