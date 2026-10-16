// Tono por familia de tipo de pregunta (revamp 2026-10-16, tablero «Sistema»).
// El color vive SÓLO en el ícono del tipo: la ficha, la fila y el texto quedan en tinta.
// Cada familia apunta a un acento de la identidad (`--pulso-accent-*`); nunca un hex.

export type TypeFamily =
  | "unica"
  | "multiple"
  | "numero"
  | "texto"
  | "fecha"
  | "nota"
  | "calculo"
  | "ubicacion"
  | "estructura"
  | "otro";

export function typeFamily(baseType: string): TypeFamily {
  switch (baseType) {
    case "select_one":
    case "select_one_from_file":
    case "rank":
      return "unica";
    case "select_multiple":
    case "select_multiple_from_file":
      return "multiple";
    case "integer":
    case "decimal":
    case "range":
      return "numero";
    case "text":
    case "barcode":
      return "texto";
    case "date":
    case "time":
    case "datetime":
    case "start":
    case "end":
    case "today":
      return "fecha";
    case "note":
    case "acknowledge":
      return "nota";
    case "calculate":
    case "hidden":
      return "calculo";
    case "geopoint":
    case "geotrace":
    case "geoshape":
      return "ubicacion";
    case "begin_group":
    case "end_group":
    case "begin_repeat":
    case "end_repeat":
      return "estructura";
    default:
      return "otro";
  }
}

const TONE: Record<TypeFamily, string> = {
  unica: "var(--module-accent, var(--pulso-primary))",
  multiple: "var(--pulso-accent-sky)",
  numero: "var(--pulso-accent-green)",
  texto: "var(--pulso-accent-amber)",
  fecha: "var(--pulso-accent-cyan)",
  nota: "var(--pulso-text-muted)",
  calculo: "var(--pulso-accent-violet)",
  ubicacion: "var(--pulso-accent-steel)",
  estructura: "var(--pulso-text-faint)",
  otro: "var(--pulso-text-muted)",
};

/** Valor CSS (siempre un `var(--…)`) del tono del ícono de un tipo. */
export function typeTone(baseType: string): string {
  return TONE[typeFamily(baseType)];
}
