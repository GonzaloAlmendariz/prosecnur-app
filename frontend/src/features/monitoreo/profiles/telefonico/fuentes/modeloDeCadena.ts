/**
 * El modelo de la cadena de fuentes del monitoreo telefónico.
 *
 * Un estudio telefónico necesita tres piezas y en un orden que es una
 * dependencia real, no una preferencia: el barrido sin universo no tiene a quién
 * registrar, y la encuesta sin barrido no tiene contra qué cruzar. Hasta ahora
 * eso se decía de tres formas distintas en la misma pantalla —una tira de
 * estados, un párrafo con el reparto y una lista de pasos pendientes— y ninguna
 * mostraba la dependencia: las tres eran listas planas.
 *
 * La lógica vive aquí, separada del render, porque lo que hay que poder probar
 * es dónde se corta la cadena, no cómo se dibuja.
 */

export type ClaveDeEslabon = "universo" | "barrido" | "plataforma";

export type EnlaceDeEslabon = {
  texto: string;
  href?: string;
  /** Lo que el enlace no cabe en su texto: rango de la hoja, identificador. */
  titulo?: string;
};

export type EslabonDeFuente = {
  clave: ClaveDeEslabon;
  /** Qué pieza es, en el vocabulario del estudio. */
  titulo: string;
  /** Qué aporta al monitoreo. Es lo que mide la cifra, no una glosa. */
  aporta: string;
  /** El volumen que trae. Vacío cuando la pieza no está conectada. */
  cifra: string;
  origen: EnlaceDeEslabon | null;
  actualizada: string;
  lista: boolean;
  /** El siguiente paso concreto cuando falta. Nunca una explicación. */
  accion: string;
};

/**
 * Dónde se corta la cadena: el primer eslabón que falta, no cualquiera.
 *
 * Devuelve `null` cuando las tres piezas están conectadas.
 */
export function eslabonQueCorta(eslabones: readonly EslabonDeFuente[]): EslabonDeFuente | null {
  return eslabones.find((eslabon) => !eslabon.lista) ?? null;
}

/**
 * Estado del conjunto, dicho como lo que le pasa al monitoreo.
 *
 * Con la cadena completa no se felicita a nadie: se dice qué habilita. Con la
 * cadena cortada se nombra la pieza que falta, en singular o plural según
 * cuántas sean —«Faltan 2 piezas» y después la lista, en vez de enumerar dos
 * frases dentro de un mismo renglón—.
 */
export function estadoDeLaCadena(eslabones: readonly EslabonDeFuente[]) {
  const faltan = eslabones.filter((eslabon) => !eslabon.lista);
  if (!faltan.length) return { completa: true as const, resumen: "Listo para monitoreo" };
  if (faltan.length === 1) return { completa: false as const, resumen: `Falta ${faltan[0].titulo.toLocaleLowerCase("es")}` };
  return { completa: false as const, resumen: `Faltan ${faltan.length} de 3 piezas` };
}
