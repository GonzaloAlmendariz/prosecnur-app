/**
 * El nombre de un grupo de opciones de una escala, sacado de todas las que
 * agrupa (ítem 39 del checklist del practicante): "Nada interesado/a" y "Poco
 * interesado/a" se leen "Nada o poco interesado/a". Si las opciones no
 * comparten el final, se nombran todas: "Muy en desacuerdo o en desacuerdo".
 * Una sola opción se nombra tal cual.
 */
export function nombreDelGrupo(etiquetas: readonly string[]): string {
  const limpias = etiquetas.map((e) => e.trim()).filter(Boolean);
  if (limpias.length <= 1) return limpias[0] ?? "";
  const palabras = limpias.map((e) => e.split(/\s+/));
  let comun = 0;
  const minimo = Math.min(...palabras.map((p) => p.length));
  while (
    comun < minimo &&
    palabras.every((p) => p[p.length - 1 - comun].toLowerCase() === palabras[0][palabras[0].length - 1 - comun].toLowerCase())
  ) {
    comun += 1;
  }
  const prefijos = palabras.map((p) => p.slice(0, p.length - comun).join(" "));
  if (comun > 0 && prefijos.every(Boolean)) {
    const final = palabras[0].slice(palabras[0].length - comun).join(" ");
    return `${enumerar(prefijos)} ${final}`;
  }
  return enumerar(limpias);
}

/** "a o b", "a, b o c"; desde la segunda, en minúscula inicial salvo siglas ("PUCP"). */
function enumerar(partes: readonly string[]): string {
  const ps = partes.map((p, i) => (i === 0 ? p : minusculaInicial(p)));
  return ps.length === 1 ? ps[0] : `${ps.slice(0, -1).join(", ")} o ${ps[ps.length - 1]}`;
}

function minusculaInicial(p: string): string {
  if (p.length > 1 && p[1] === p[1].toUpperCase() && p[1] !== p[1].toLowerCase()) return p;
  return p.charAt(0).toLowerCase() + p.slice(1);
}
