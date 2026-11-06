/**
 * Marcas de un eje de valores de 0 a `maximo`: unas cuatro, con paso redondo
 * (1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5 o 10 por su potencia de diez). La última
 * marca es el tope del eje. Vive en el núcleo porque la comparten las pesas de
 * composición de los perfiles (ADR 0126) y los gráficos de avance de
 * acreditación.
 */
export function marcasDeValores(maximo: number): number[] {
  if (!(maximo > 0)) return [0, 1];
  const crudo = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].map((factor) => factor * potencia).find((valor) => valor >= crudo) ?? crudo;
  const marcas: number[] = [];
  for (let valor = 0; valor < maximo + paso * 0.999; valor += paso) marcas.push(Math.round(valor * 1000) / 1000);
  return marcas;
}
