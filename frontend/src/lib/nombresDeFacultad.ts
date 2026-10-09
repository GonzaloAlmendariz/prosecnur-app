/**
 * **El nombre de una facultad, escrito igual en TODA la app.**
 *
 * Vivía en `features/monitoreo/profiles/aulas/facultadEnPalabras.ts` y
 * Recopiladores tenía su propio capitalizador en
 * `features/recopiladores/nombreDeFacultad.ts`. Los dos hacían el mismo trabajo
 * y no el mismo resultado: **11 de 16 facultades salían con nombre distinto en
 * las dos pantallas** (medido el 2026-09-17), y dos de esas diferencias no eran
 * de estilo sino faltas de ortografía — «EDUCACION» salía «Educacion» y
 * «PSICOLOGIA» salía «Psicologia», porque el capitalizador de Recopiladores no
 * repone tildes.
 *
 * Así que el normalizador sube aquí y las dos features lo consumen. Lo que NO
 * sube es el acortado: Monitoreo abrevia para caber en la etiqueta de un
 * gráfico y Recopiladores para una columna de 160 px, y son dos anchos
 * distintos con dos respuestas legítimas. Unificar ESO cambiaría etiquetas que
 * el equipo ya lee, así que es una decisión de producto y no un refactor.
 *
 * Los acentos no se inventan: cada reposición es una facultad concreta de la
 * PUCP, listada abajo y comprobable contra el marco.
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
