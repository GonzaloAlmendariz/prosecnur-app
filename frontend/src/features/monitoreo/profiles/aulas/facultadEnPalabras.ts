/**
 * **El nombre de una facultad, escrito igual en todas partes.**
 *
 * Gonzalo, 2026-09-10, con el mapa delante: «los nombres de las facultades no
 * están normalizados». Tenía razón y la causa era de forma, no de dato: el mapa
 * acortaba siete nombres largos por su forma conocida —«CIENCIAS E INGENIERÍA»
 * → «CC. e Ingeniería»— y dejaba los demás tal cual venían del libro, que es en
 * MAYÚSCULAS. El resultado eran las dos grafías en el mismo gráfico, a dos
 * centímetros: «ARTE Y DISEÑO» al lado de «CC. e Ingeniería».
 *
 * Aquí se decide una sola vez, y el acortar y el normalizar se separan: son dos
 * trabajos distintos y sólo uno depende de que el nombre quepa.
 *
 * **El archivo se llama por la función y no por la cosa** —`facultadEnPalabras`
 * y no `nombreDeFacultad`— porque ya existe `NombreDeFacultad.tsx`, el
 * componente que pinta un nombre y pone el foco. En un disco que no distingue
 * mayúsculas los dos son el mismo archivo, y el typecheck lo cazó al primer
 * import.
 *
 * **Los acentos se reponen.** El libro escribe «EDUCACION» y «PSICOLOGIA» sin
 * tilde —el marco viene de un SQL que no las guarda—, y un `toLowerCase` con
 * capitalización deja «Educacion». No se inventa nada: cada reposición es una
 * facultad concreta de la PUCP, listada abajo y comprobable contra el marco.
 */

/** Palabras que en español van en minúscula dentro de un nombre propio. */
const ATONAS = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "en", "con", "para"]);

/**
 * Las siglas del marco, que no se capitalizan: se escriben como son. La clave
 * es la forma sin puntos ni acentos con la que llegan del libro.
 */
const SIGLAS = new Map([
  ["EEGG", "EE.GG."],
  ["EE.GG.", "EE.GG."],
  ["CCHH", "CC.HH."],
  ["CC.HH.", "CC.HH."],
  ["CC.", "CC."],
  ["PUCP", "PUCP"],
]);

/**
 * Las tildes que el marco no trae. Cada línea es una facultad de la PUCP; no
 * hay ninguna regla automática detrás, y añadir una nueva exige mirarla.
 */
const TILDES = new Map([
  ["educacion", "educación"],
  ["psicologia", "psicología"],
  ["gastronomia", "gastronomía"],
  ["gestion", "gestión"],
  ["direccion", "dirección"],
  ["comunicacion", "comunicación"],
  ["escenicas", "escénicas"],
  ["ingenieria", "ingeniería"],
  ["matematicas", "matemáticas"],
  ["fisica", "física"],
  ["quimica", "química"],
  ["biologia", "biología"],
  ["geografia", "geografía"],
  ["economia", "economía"],
  ["administracion", "administración"],
  ["informacion", "información"],
  ["publica", "pública"],
  ["cientificas", "científicas"],
]);

/** Una palabra suelta, ya normalizada. */
function palabra(w: string, primera: boolean): string {
  const crudo = w.trim();
  if (!crudo) return "";

  const sigla = SIGLAS.get(crudo.toUpperCase());
  if (sigla) return sigla;

  const baja = TILDES.get(crudo.toLowerCase()) ?? crudo.toLowerCase();
  if (!primera && ATONAS.has(baja)) return baja;
  return baja.charAt(0).toUpperCase() + baja.slice(1);
}

/**
 * El nombre completo, normalizado: «CIENCIAS E INGENIERÍA» → «Ciencias e
 * Ingeniería», «EDUCACION» → «Educación».
 *
 * Un nombre que ya viene en mayúscula y minúscula se respeta tal cual sólo si
 * NO es todo mayúsculas: así un libro que ya escriba bien no se toca, y uno que
 * grite se normaliza.
 */
export function facultadEnPalabras(nombre: string | null | undefined): string {
  const n = String(nombre ?? "").trim();
  if (!n) return "";
  // Si ya trae minúsculas, alguien lo escribió a mano y se respeta.
  if (n !== n.toUpperCase()) return n;
  return n.split(/\s+/).map((w, i) => palabra(w, i === 0)).join(" ");
}

/**
 * La forma corta para un gráfico, donde el nombre entero no cabe sin pisar al
 * de al lado.
 *
 * Se acorta DESPUÉS de normalizar, nunca en vez de: acortar y normalizar son
 * dos trabajos y mezclarlos fue justo lo que dejó dos grafías en el mapa.
 */
export function facultadCorta(nombre: string | null | undefined): string {
  const n = facultadEnPalabras(nombre);
  if (!n) return "";
  return n
    .replace(/^Estudios Generales /i, "EE.GG. ")
    // El libro la abrevia ya en origen —«CIENCIAS Y ARTES DE LA COMUN.»—, así
    // que la regla mira el prefijo y no el nombre entero.
    .replace(/^Ciencias y Artes de la Comun.*/i, "CC. y Artes Com.")
    .replace(/^Ciencias Sociales.*/i, "Ciencias Sociales")
    .replace(/^Gastronom[ií]a.*/i, "Gastronomía")
    .replace(/^Gesti[oó]n y Alta Direcci[oó]n.*/i, "Gestión")
    .replace(/^Letras y Ciencias Humanas.*/i, "Letras y CC.HH.")
    .replace(/^Arquitectura y Urbanismo.*/i, "Arquitectura")
    .replace(/^Ciencias e Ingenier[ií]a.*/i, "CC. e Ingeniería")
    .replace(/^Ciencias Contables.*/i, "CC. Contables");
}
