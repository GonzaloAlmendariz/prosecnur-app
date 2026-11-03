// Une datos en una frase —«a, b y c»— en vez de pegarlos con «·» (P3 de la pasada
// de formato, 2 nov 2026). Había al menos cinco copias locales (`enumerar` en
// Monitoreo territorial, Cálculo de muestra, Gráficos y Formularios; `unirConY` en
// Validación): ésta es la compartida y las otras convergen aquí cuando se toquen.
//
// - Ignora los vacíos (`null`, `undefined`, `false`, «»), para armar la frase con
//   partes condicionales sin dejar comas colgando.
// - La conjunción concuerda como en español: «y» pasa a «e» ante i-/hi- («Lima e
//   Ica») y «o» pasa a «u» ante o-/ho- («siete u ocho»), salvo ante diptongo
//   («cobre y hierro»).

export type ParteDeFrase = string | number | null | undefined | false;

function conjuncion(base: "y" | "o", siguiente: string): string {
  const palabra = siguiente.trim().toLocaleLowerCase("es-PE");
  if (base === "y" && /^h?[iií]/.test(palabra) && !/^h?i[aeoáéó]/.test(palabra)) return "e";
  if (base === "o" && /^h?[oó]/.test(palabra)) return "u";
  return base;
}

export function enumerar(partes: readonly ParteDeFrase[], base: "y" | "o" = "y"): string {
  const limpias = partes
    .map((p) => (p === null || p === undefined || p === false ? "" : String(p).trim()))
    .filter(Boolean);
  if (limpias.length <= 1) return limpias[0] ?? "";
  const ultima = limpias[limpias.length - 1];
  return `${limpias.slice(0, -1).join(", ")} ${conjuncion(base, ultima)} ${ultima}`;
}
