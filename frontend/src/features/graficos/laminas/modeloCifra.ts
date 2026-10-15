// Qué cifras ofrece la tarjeta de la cifra destacada según la pregunta (CifraGrafico.tsx). Las claves son los `modo`
// de p_cifra() (api/R/graficos_cifra.R).

export type ModoCifra = "porcentaje" | "n" | "media" | "mediana";

export const MODOS_CIFRA: readonly { clave: ModoCifra; rotulo: string }[] = [
  { clave: "porcentaje", rotulo: "Porcentaje" },
  { clave: "n", rotulo: "Respuestas" },
  { clave: "media", rotulo: "Media" },
  { clave: "mediana", rotulo: "Mediana" },
];

/**
 * Con lista de opciones, porcentaje y respuestas; sin lista (una medida), media, mediana y respuestas; mientras no se
 * sabe (`null`), todas. El modo guardado siempre queda, aunque ya no corresponda, para que se vea y se pueda cambiar.
 */
export function modosCifraDisponibles(conLista: boolean | null, actual: ModoCifra) {
  const validos: ModoCifra[] = conLista === null ? ["porcentaje", "n", "media", "mediana"]
    : conLista ? ["porcentaje", "n"] : ["media", "mediana", "n"];
  return MODOS_CIFRA.filter((m) => validos.includes(m.clave) || m.clave === actual);
}
