/**
 * Escala «redonda» de un eje: el tope y las marcas, con pasos de 1, 2, 2.5 o
 * 5 por potencia de diez. El tope queda por encima del máximo con holgura
 * para la cifra que va sobre la barra más alta.
 */
export type EscalaDeEje = { tope: number; marcas: number[] };

export function escalaDeEje(maximo: number, marcasDeseadas = 5): EscalaDeEje {
  const valor = Math.max(0, Number.isFinite(maximo) ? maximo : 0);
  if (valor <= 0) return { tope: 1, marcas: [0, 1] };
  const crudo = valor / marcasDeseadas;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((factor) => factor * potencia).find((candidato) => candidato >= crudo) ?? 10 * potencia;
  const pasoEntero = valor >= 4 ? Math.max(1, Math.round(paso)) : paso;
  // Holgura: si el máximo cae justo en una marca, se agrega una más.
  let tope = Math.ceil(valor / pasoEntero) * pasoEntero;
  if (tope - valor < pasoEntero * 0.08) tope += pasoEntero;
  const marcas: number[] = [];
  for (let marca = 0; marca <= tope + 1e-9; marca += pasoEntero) marcas.push(Math.round(marca * 1000) / 1000);
  return { tope, marcas };
}
