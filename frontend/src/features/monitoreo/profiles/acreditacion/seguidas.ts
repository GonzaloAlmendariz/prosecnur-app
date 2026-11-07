/** Clave de una variable seguida: público y variable, sin distinguir mayúsculas (como deduplica el motor). */
export function claveDeSeguida(actor: string, variable: string) {
  return `${actor.trim().toLocaleLowerCase("es")}::${variable.trim().toLocaleLowerCase("es")}`;
}
