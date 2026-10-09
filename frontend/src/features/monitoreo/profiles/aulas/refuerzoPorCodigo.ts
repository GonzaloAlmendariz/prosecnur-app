/**
 * **Pedir un refuerzo escribiendo su código.**
 *
 * Gonzalo, 2026-09-18: «la app también debería poder permitir aplicar refuerzos
 * manuales por código de CH como por ejemplo R 23.4, y esa se verifique que
 * esté disponible y se clasifique como escogida para refuerzo».
 *
 * El reparto del techo elige por él; esto es para cuando ya sabe cuál quiere
 * —porque conoce al docente, porque el aula le viene bien al aplicador, porque
 * lo habló con la facultad— y sólo necesita que la app lo registre.
 *
 * **Diagnostica ANTES de pedir.** El motor ya rechaza lo que no se puede marcar
 * (`monitoreo_aulas_marcar_refuerzo()` devuelve `E_AULA_NO_ENCONTRADA`,
 * `E_REFUERZO_YA_MARCADO` o `E_REFUERZO_NO_DISPONIBLE`), pero enterarse después
 * de pulsar convierte cada consulta en un intento fallido. Aquí se mira el plan
 * que la pantalla ya tiene y se dice qué pasa mientras se escribe.
 *
 * El veredicto NO sustituye al del motor: el servidor vuelve a validar y su
 * palabra es la que manda. Esto adelanta la respuesta, no la decide.
 */

export type FilaDePlan = Record<string, unknown>;

export type Veredicto = {
  /** `true` sólo cuando se puede pedir. */
  puede: boolean;
  /** Qué pasa, en una frase para leer. */
  motivo: string;
  /** El código tal como está escrito en el plan, que es el que se manda. */
  codigo: string;
  facultad: string;
  curso: string;
  docente: string;
  elegibles: number | null;
  /** `true` cuando el aula ya está marcada como refuerzo por contactar. */
  yaMarcada: boolean;
};

const txt = (v: unknown): string => {
  if (v == null) return "";
  const s = Array.isArray(v) ? v[0] : v;
  return s == null ? "" : String(s).trim();
};

const num = (v: unknown): number | null => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) ? n : null;
};

/**
 * El estado, en el vocabulario del motor.
 *
 * El plan guarda `sample_status` como viene del libro —«SIN CONTACTAR», en
 * mayúsculas y con espacio— mientras el motor habla de `sin_contactar`.
 * Comparar el crudo contra el normalizado dejó en su día 1.213 de 1.218
 * reservas como «ya comprometida», o sea el circuito entero inalcanzable.
 */
export function estadoNormalizado(valor: unknown): string {
  return txt(valor).toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Los estados desde los que un aula todavía se puede pedir como refuerzo.
 * Es la lista del motor (`MONITOREO_AULAS_ESTADOS_DORMIDOS` más
 * `sin_contactar`), no una propia: si divergen, la pantalla diría que sí y el
 * servidor diría que no.
 */
const DISPONIBLES = new Set(["", "-", "sin_contactar", "en_reserva", "planificada"]);

/** Cómo se escribe un código para compararlo: sin espacios y en minúscula. */
export function claveDeCodigo(valor: unknown): string {
  return txt(valor).toLowerCase().replace(/\s+/g, "");
}

/**
 * ¿Se puede pedir esta aula como refuerzo?
 *
 * @param codigo lo que la persona escribió, tal cual.
 * @param plan las filas del plan que la pantalla ya tiene.
 */
export function diagnostica(codigo: string, plan: ReadonlyArray<FilaDePlan>): Veredicto {
  const vacio: Veredicto = {
    puede: false, motivo: "", codigo: txt(codigo), facultad: "", curso: "",
    docente: "", elegibles: null, yaMarcada: false,
  };
  const buscado = claveDeCodigo(codigo);
  if (!buscado) return { ...vacio, motivo: "Escribe el código del curso-horario, por ejemplo R 23.4." };

  const fila = (plan ?? []).find((f) => claveDeCodigo(f.operational_code) === buscado
    || claveDeCodigo(f.classroom_id) === buscado);
  if (!fila) {
    return { ...vacio, motivo: `No hay ningún «${txt(codigo)}» en el plan de este estudio.` };
  }

  const base = {
    ...vacio,
    codigo: txt(fila.operational_code) || txt(fila.classroom_id),
    facultad: txt(fila.faculty),
    curso: txt(fila.course_name),
    docente: txt(fila.teacher),
    elegibles: num(fila.eligible_n),
  };
  const estado = estadoNormalizado(fila.sample_status);

  if (estado === "refuerzo_por_contactar") {
    return { ...base, yaMarcada: true, motivo: "Ya está pedida como refuerzo: sigue esperando contacto." };
  }
  if (!DISPONIBLES.has(estado)) {
    // El estado CRUDO en el mensaje, que es el que se ve en el Sheets.
    const como = txt(fila.sample_status) || "sin estado";
    return { ...base, motivo: `Ya está comprometida (${como}): no se puede pedir para otra cosa.` };
  }
  return {
    ...base,
    puede: true,
    motivo: `Disponible${base.elegibles ? ` · ${base.elegibles} elegibles` : ""}.`,
  };
}

/**
 * El tipo que corresponde según a quién ayuda, con el vocabulario de Gonzalo
 * (2026-09-18): «A es reemplazo directo por rechazo, B es complemento a un CH y
 * C son aulas adicionales que se usan de refuerzo».
 *
 * Un destino que parece un código de aula es complemento (B); una facultad es
 * refuerzo (C). Se deduce del destino y se deja cambiar: quien pide sabe por
 * qué lo pide.
 */
export function tipoSegunDestino(para: string): "complemento" | "refuerzo" {
  const v = txt(para);
  if (!v) return "refuerzo";
  return /^(ch|r|extra)\s*[\d.]+$/i.test(v) ? "complemento" : "refuerzo";
}
