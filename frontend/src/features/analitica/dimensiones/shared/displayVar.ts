// Utilidades de display para nombres de variable. El backend persiste
// con prefijo `r100_` (necesario para mapear contra las columnas que
// genera el pipeline al recodificar), pero el usuario nunca debería
// ver ese detalle técnico — sale ruido al pensar en preguntas.
//
// Estas helpers se usan en TODA la UI del wizard para mantener
// consistencia: pills, acordeones, panels, tooltips. La fuente de
// verdad sigue siendo el nombre prefijado en el draft, pero la capa
// visual lo muestra crudo.

const PREFIJO_DEFAULT = "r100_";

/**
 * Devuelve el nombre crudo (sin prefijo `r100_`) para mostrar al
 * usuario. Si el nombre no tiene el prefijo configurado, lo devuelve
 * intacto (idempotente).
 */
export function stripPrefijo(name: string, prefijo: string = PREFIJO_DEFAULT): string {
  if (!name) return name;
  return name.replace(new RegExp(`^${prefijo}`), "");
}

/**
 * Genera el par de variantes (con y sin prefijo) para hacer matching
 * tolerante en lookups — útil para `varsMeta[name] ?? varsMeta[crudo]`.
 */
export function variantesNombre(name: string, prefijo: string = PREFIJO_DEFAULT): {
  conPrefijo: string;
  sinPrefijo: string;
} {
  const sinPrefijo = stripPrefijo(name, prefijo);
  const conPrefijo = sinPrefijo === name ? `${prefijo}${name}` : name;
  return { conPrefijo, sinPrefijo };
}
