// D4 (Gonzalo, 2026-10-13): «cuidado: a veces asumes que corchetes o texto estilo HTML en los nombres son residuo… no
// debe seguirse una lógica de quitarlo automáticamente y sin avisar; es el analista el que debe quitarlo». Esto sólo
// DETECTA: devuelve los fragmentos exactos para que el aviso los cite; el título no se toca.

/** Notas entre corchetes («[Entiéndase …]») y etiquetas tipo HTML («<b>») que trae un título, tal como aparecen. */
export function notasEnTitulo(titulo: string): string[] {
  if (!titulo) return [];
  const corchetes = titulo.match(/\[[^\]]{1,400}\]/g) ?? [];
  const html = titulo.match(/<\/?[a-z][a-z0-9]*(\s[^<>]*)?\/?>/gi) ?? [];
  return [...corchetes, ...html];
}

/** El fragmento citado en el aviso: corto, para que se reconozca sin repetir el título entero. */
export function citaCorta(nota: string, max = 48): string {
  if (nota.length <= max) return nota;
  return `${nota.slice(0, max - 1).trimEnd()}…${nota.endsWith("]") ? "]" : ""}`;
}
