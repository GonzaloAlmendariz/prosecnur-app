/**
 * **El nombre de un aplicador, escrito como se escribe un nombre.**
 *
 * Dictado del 2026-09-04: «necesita tener el nombre, y eso es importante, el
 * nombre normalizado: apellido, coma, nombre y nombre. Y siempre tiene que ser
 * así, y en mayúsculas donde sea y en minúsculas donde debe corresponder».
 *
 * La lista de aplicadores llega tecleada a mano en el libro de disponibilidad
 * y trae de todo: `Castillo SOLORSANO , LEIDY VIVIANA`, `PANTA GUTIERREZ,
 * PERCY AARÓN`, `Uribe Olaechea , Jesús Ramiro`. La app las pinta en la tabla,
 * en el rail y en el aviso que se pega al chat del equipo, así que el
 * desorden se ve en las tres.
 *
 * **Esto es PRESENTACIÓN, nunca identidad.** El nombre crudo es la clave con la
 * que el motor arma `fijadas` (código → aplicador) y con la que vuelve una
 * fijación al backend; normalizar lo que viaja rompería la fijación en el
 * primer acento. Por eso la función se llama al pintar y su resultado no se
 * guarda ni se manda.
 */

/**
 * Partículas que van en minúscula cuando no abren su bloque: `De La Cruz`
 * abre el apellido y se respeta, pero `Ramos De La Cruz` es `Ramos de la Cruz`.
 */
const PARTICULAS = new Set([
  "de", "del", "la", "las", "los", "y", "e", "da", "das", "do", "dos",
  "van", "von", "di", "der", "den", "el", "san",
]);

/** Capitaliza una palabra respetando guiones y apóstrofos (`d'Angelo`, `Ana-María`). */
function capitalizar(palabra: string): string {
  return palabra.replace(
    /(^|[-'’])([\p{L}])/gu,
    (_, sep: string, letra: string) => sep + letra.toUpperCase(),
  );
}

/** Un bloque (los apellidos, o los nombres) ya en minúsculas, palabra por palabra. */
function bloque(texto: string): string {
  return texto
    .split(/\s+/)
    .filter((p) => p !== "")
    .map((p, i) => {
      const bajo = p.toLowerCase();
      // La partícula sólo se agacha si alguien la precede dentro del bloque.
      if (i > 0 && PARTICULAS.has(bajo)) return bajo;
      return capitalizar(bajo);
    })
    .join(" ");
}

/**
 * `Castillo SOLORSANO , LEIDY VIVIANA` → `Castillo Solorsano, Leidy Viviana`.
 *
 * Sin coma se normaliza igual, en un solo bloque: la app no reordena lo que no
 * sabe separar. Un nombre vacío devuelve cadena vacía, no un guion inventado.
 */
export function nombreDeAplicador(crudo: string | null | undefined): string {
  const limpio = (crudo ?? "").replace(/\s+/g, " ").trim();
  if (limpio === "") return "";
  // La coma manda: se le quita el aire de delante y se le deja uno detrás.
  const partes = limpio.split(",").map((p) => p.trim()).filter((p) => p !== "");
  if (partes.length === 0) return "";
  return partes.map(bloque).join(", ");
}

/**
 * Las iniciales para un avatar o un sello compacto: la primera letra del
 * apellido y la del primer nombre. `Castillo Solorsano, Leidy` → `CL`.
 */
export function inicialesDeAplicador(crudo: string | null | undefined): string {
  const partes = nombreDeAplicador(crudo).split(",").map((p) => p.trim());
  const letra = (t: string) => (t.match(/\p{L}/u)?.[0] ?? "").toUpperCase();
  const a = letra(partes[0] ?? "");
  const b = letra(partes[1] ?? "");
  return `${a}${b}`;
}
