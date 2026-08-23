/**
 * El marco académico llega en MAYÚSCULAS.
 *
 * «TALLER DE URBANISMO 1», «CHINCHAYÁN BARRETO, RUTH ZARAGOZA», «ARQUITECTURA Y
 * URBANISMO». En una tabla de cincuenta filas eso es un muro: las mayúsculas no
 * tienen alto de x variable, así que el ojo no puede usar la silueta de la
 * palabra para leer y tiene que deletrear. Se baja a caja normal para mostrar,
 * nunca en el dato.
 */

/** Van en minúscula dentro de la frase, no al principio. */
const PARTICULAS = new Set(["y", "e", "o", "u", "de", "del", "la", "las", "los", "el", "en", "para", "con", "a"]);

/**
 * @param texto tal cual viene del marco.
 *
 * Los tramos que NO son palabras —números romanos, siglas, cifras— se dejan
 * como están: «TALLER DE URBANISMO 1» no puede volverse «Taller de Urbanismo
 * 1» y de paso convertir «CH» en «Ch» ni «III» en «Iii».
 */
export function capitalizarDelMarco(texto: string): string {
  // El marco trae nombres con un espacio colgando antes de la coma cuando falta
  // el segundo apellido: «CONTE , ANTONIO». Se normaliza al mostrar.
  const limpio = (texto ?? "").trim().replace(/\s+,/g, ",").replace(/\s{2,}/g, " ");
  if (!limpio) return "";
  // Un texto que ya viene en caja mixta se respeta: el marco no siempre grita,
  // y volver a capitalizar destrozaría un «McKenzie» o un «de la Cruz» correcto.
  if (limpio !== limpio.toLocaleUpperCase("es")) return limpio;

  return limpio
    .split(/(\s+|,)/)
    .map((parte) => {
      if (/^(\s+|,)$/.test(parte) || parte === "") return parte;
      // Romanos y siglas cortas se quedan: III, IV, TIC, PUCP.
      if (/^[IVX]+$/.test(parte) && parte.length <= 4) return parte;
      if (!/[A-ZÁÉÍÓÚÑÜ]/.test(parte)) return parte;
      const bajo = parte.toLocaleLowerCase("es");
      if (PARTICULAS.has(bajo)) return bajo;
      return bajo.charAt(0).toLocaleUpperCase("es") + bajo.slice(1);
    })
    .join("")
    .replace(/^[a-záéíóúñü]/, (c) => c.toLocaleUpperCase("es"));
}
