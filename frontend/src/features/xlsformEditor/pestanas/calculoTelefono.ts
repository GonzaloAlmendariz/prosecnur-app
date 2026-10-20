// Qué dice «Probar con respuestas» de un cálculo que el editor no evalúa, y cómo muestra un resultado de fecha
// (2026-10-17, S13 y pendiente del motor). Antes: un «Se calcula en el teléfono» genérico para choice-name, join y sum,
// y `once(now())` como «2026-10-17T19:12:54.286Z».

/** Funciones que sólo el teléfono puede resolver, con el porqué en palabras de quien diseña la encuesta. */
const SOLO_EN_TELEFONO: { re: RegExp; porque: string }[] = [
  { re: /\bjr:choice-name\s*\(/, porque: "lee el texto de la opción elegida" },
  { re: /\bjoin\s*\(/, porque: "une las filas de una repetición" },
  { re: /\bsum\s*\(/, porque: "suma las filas de una repetición" },
  { re: /\bcount\s*\(/, porque: "cuenta las filas de una repetición" },
  { re: /\bindexed-repeat\s*\(/, porque: "lee una fila de una repetición" },
  { re: /\bposition\s*\(/, porque: "depende de la fila de la repetición" },
  { re: /\bpulldata\s*\(/, porque: "lee una tabla adjunta" },
  { re: /\binstance\s*\(/, porque: "lee una lista externa" },
  { re: /\brandom\s*\(/, porque: "sortea un número al azar" },
  { re: /\bselected-at\s*\(/, porque: "toma una opción marcada por su posición" },
  { re: /\b(max|min)\s*\(/, porque: "compara las filas de una repetición" },
];

/** Los porqués de que un cálculo sólo se resuelva en el teléfono, sin repetir y en orden; vacío si no hay ninguno. */
export function motivosEnTelefono(expresion: string): string[] {
  const vistos: string[] = [];
  for (const { re, porque } of SOLO_EN_TELEFONO) if (re.test(expresion) && !vistos.includes(porque)) vistos.push(porque);
  return vistos;
}

/** Una línea con el primer motivo, el que explica la fórmula: «Se calcula en el teléfono: suma las filas de una repetición.» */
export function textoEnTelefono(expresion: string): string {
  const m = motivosEnTelefono(expresion)[0];
  return m ? `Se calcula en el teléfono: ${m}.` : "Se calcula en el teléfono: usa partes que el editor no evalúa.";
}

/** El valor depende del momento en que se abre la encuesta (now, today, once): lo que aquí se ve es el de ahora. */
export function dependeDelMomento(expresion: string): boolean {
  return /\b(now|today)\s*\(\s*\)/.test(expresion);
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const FECHA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/** Un resultado de fecha se lee como fecha («17 de octubre de 2026, 14:12», en la hora del equipo); lo demás, igual. */
export function valorLegible(valor: string): string {
  const v = valor.trim();
  const f = FECHA.exec(v);
  if (f) return `${Number(f[3])} de ${MESES[Number(f[2]) - 1] ?? f[2]} de ${f[1]}`;
  if (FECHA_HORA.test(v)) {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}, ${hh}:${mm}`;
  }
  return valor;
}
