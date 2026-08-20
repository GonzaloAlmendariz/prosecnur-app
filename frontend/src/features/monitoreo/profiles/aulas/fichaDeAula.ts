/**
 * Todo lo de un aula, reunido.
 *
 * Se compone **en el frontend** desde los bloques que el payload ya trae —plan,
 * partes de campo, control del libro, brechas— y no con una llamada nueva: el
 * dato ya está en la pantalla, y pedirlo otra vez añadiría un viaje y una
 * segunda definición de lo mismo.
 *
 * Cada trozo puede faltar y eso **se dice**, no se rellena con ceros: un aula
 * sin parte de campo no es un aula con cero encuestas.
 */

const num = (v: unknown): number | null => {
  const c = Array.isArray(v) ? v[0] : v;
  if (c === null || c === undefined || c === "") return null;
  const n = typeof c === "number" ? c : Number(c);
  return Number.isFinite(n) ? n : null;
};

const texto = (v: unknown): string => {
  const c = Array.isArray(v) ? v[0] : v;
  if (typeof c === "string") return c.trim();
  if (typeof c === "number") return String(c);
  return "";
};

type Fila = Readonly<Record<string, unknown>>;

/** Las claves con las que un aula se nombra en cada hoja. */
const CODIGO = ["operational_code", "classroom_id", "codigo", "curso_horario"];

function codigoDe(fila: Fila): string {
  for (const k of CODIGO) {
    const v = texto(fila[k]);
    if (v) return v;
  }
  return "";
}

/** Compara códigos como los compara el motor: sin distinguir mayúsculas ni espacios de sobra. */
export function mismoCodigo(a: string, b: string): boolean {
  const clave = (x: string) => x.trim().replace(/\s+/g, " ").toLowerCase();
  return Boolean(a) && clave(a) === clave(b);
}

function buscar(filas: ReadonlyArray<Fila>, codigo: string): Fila | null {
  for (const fila of filas) if (mismoCodigo(codigoDe(fila), codigo)) return fila;
  return null;
}

export type FichaDeAula = {
  codigo: string;
  existe: boolean;
  facultad: string;
  etiqueta: string;
  estado: string;
  rol: string;
  fecha: string;
  /** Lo que el diseño esperaba de esta aula. `null` si el estudio no lo declara. */
  esperado: number | null;
  elegibles: number | null;
  /** Lo que llegó a plataforma. */
  validas: number | null;
  brecha: number | null;
  /** Lo que el aplicador anotó en el parte. `null` si no hay parte. */
  parte: {
    hay: boolean;
    asistentes: number | null;
    encuestas: number | null;
    rechazos: number | null;
    observacion: string;
    aplicador: string;
  };
  /** Lo que el equipo calculó en su Excel. `null` si el libro no trae la fila. */
  control: { hay: boolean; enviadas: number | null; veredicto: string };
};

export function fichaDeAula(
  codigo: string,
  fuentes: {
    agenda?: ReadonlyArray<Fila>;
    partes?: ReadonlyArray<Fila>;
    control?: ReadonlyArray<Fila>;
    brechas?: ReadonlyArray<Fila>;
  },
): FichaDeAula {
  const enPlan = buscar(fuentes.agenda ?? [], codigo);
  const enParte = buscar(fuentes.partes ?? [], codigo);
  const enControl = buscar(fuentes.control ?? [], codigo);
  const enBrechas = buscar(fuentes.brechas ?? [], codigo);
  const base = enPlan ?? enParte ?? enControl ?? enBrechas;

  return {
    codigo,
    existe: Boolean(base),
    facultad: texto(base?.faculty ?? base?.facultad ?? ""),
    etiqueta: texto(base?.label ?? base?.course_name ?? ""),
    estado: texto(enPlan?.operational_status ?? enPlan?.sample_status ?? ""),
    rol: texto(enPlan?.sample_role ?? ""),
    fecha: texto(enPlan?.scheduled_date ?? "").slice(0, 10),
    esperado: num(enPlan?.expected_valid ?? enBrechas?.expected_valid),
    elegibles: num(enPlan?.eligible_n),
    validas: num(enBrechas?.respuestas_validas ?? enPlan?.respuestas_validas),
    brecha: num(enBrechas?.brecha),
    parte: {
      hay: Boolean(enParte),
      asistentes: num(enParte?.attendees ?? enParte?.asistentes),
      encuestas: num(enParte?.effective_surveys ?? enParte?.encuestas),
      rechazos: num(enParte?.rejections ?? enParte?.rechazos),
      observacion: texto(enParte?.field_note ?? enParte?.observacion ?? ""),
      aplicador: texto(enParte?.applied_by ?? enParte?.aplicador ?? ""),
    },
    control: {
      hay: Boolean(enControl),
      enviadas: num(enControl?.total_sent ?? enControl?.sent_total),
      veredicto: texto(enControl?.veredicto ?? enControl?.valid_total ?? ""),
    },
  };
}
