/**
 * Las iniciales con que se dibuja un actor.
 *
 * La regla no es nueva: es la que ya usan las tarjetas de Fuentes › Actores
 * (`mon-acr-source-object-icon`) —«Administrativos» → AD, «Estudiantes» → ES—.
 * Vive aquí para que el selector del panel de conectar fuente dibuje el mismo
 * objeto y no una versión parecida.
 *
 * Nota de deuda: `actorInitialLabel` sigue duplicada en los dos page-files de
 * perfil, que están congelados a crecimiento. Unificarla es un movimiento
 * aparte; esta copia al menos deja de multiplicar el criterio en cada sitio
 * nuevo que lo necesite.
 */
export function inicialesDeActor(valor: string) {
  const limpio = String(valor ?? "").trim();
  if (!limpio) return "?";

  const palabras = limpio
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  if (!palabras.length) return "?";
  if (palabras.join(" ").toLocaleLowerCase("es-PE") === "sin actor") return "?";

  // Dos palabras dan una inicial cada una; una sola palabra da sus dos
  // primeras letras. Es lo que hace que «Administrativos» sea AD y no A.
  const letras = palabras.length > 1
    ? palabras.slice(0, 2).map((palabra) => palabra.charAt(0)).join("")
    : palabras[0].slice(0, 2);

  return letras.toLocaleUpperCase("es-PE");
}
