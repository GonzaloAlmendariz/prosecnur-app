/**
 * "Revisar con la ficha física" (ítem 18 del checklist de validación del
 * practicante), el modelo puro.
 *
 * El motor de decisiones no tiene un tipo "pendiente": tiene decisiones listas
 * y borradores. Una decisión lista de ignorar cubre la regla entera y la saca
 * de lo pendiente, y eso no es lo que pasa con un caso que espera su ficha. Un
 * borrador no cubre nada, no corrige ni excluye, y se guarda con los casos
 * nombrados. La marca es un borrador de "ignore_rule" con
 * `action_params.pendiente_ficha_fisica`: el hallazgo sigue por decidir y los
 * casos quedan en la lista para quien digita.
 *
 * La lista sale de las mismas decisiones y del detalle de casos de cada
 * hallazgo (`tablaDeCasos`); no se guarda nada aparte. El motivo de cada fila
 * es el nombre del hallazgo: la pregunta y el valor ya van en sus columnas.
 */
import { celdaCsv } from "../../../components/entregables/archivoLocal";
import type { LimpiezaDecision } from "../types";
import { CLAVE_RESPONDIDAS_DE_SECCION } from "./seccionDelSalto";
import type { OpcionDeTratamiento, tablaDeCasos } from "./modeloHallazgos";

export const MARCA_FICHA_FISICA = "pendiente_ficha_fisica";

export const ROTULO_FICHA_FISICA = "Revisar con la ficha física";

/** La lista de los casos marcados, en Cierre. */
export const ROTULO_LISTA_DE_FICHA = "Lista para la ficha física";

/** La opción de Tratamiento: el motor la guarda como "ignore_rule" con la marca, pero no la cubre. */
export const OPCION_FICHA_FISICA: OpcionDeTratamiento = {
  clave: "ficha",
  accion: "ignore_rule",
  titulo: ROTULO_FICHA_FISICA,
  detalle: "Los casos quedan pendientes y entran en la lista para quien digita. No corrige ni excluye.",
  prevista: false,
};

type DecisionMinima = Pick<LimpiezaDecision, "action_type" | "status" | "action_params" | "target_case_ids">;

/** La decisión es la marca de "Revisar con la ficha física". */
export function esFichaFisica(d: Pick<DecisionMinima, "action_type" | "status" | "action_params"> | null | undefined): boolean {
  if (!d) return false;
  const params = d.action_params;
  return d.action_type === "ignore_rule"
    && d.status === "draft"
    && !!params && !Array.isArray(params)
    && params[MARCA_FICHA_FISICA] === true;
}

/** Los casos de una marca. */
export function casosEnFicha(d: Pick<LimpiezaDecision, "target_case_ids">): string[] {
  return (d.target_case_ids ?? []).filter((id) => typeof id === "string" && id !== "");
}

/** Los casos distintos de las marcas de un hallazgo. */
export function nCasosEnFicha(decisiones: readonly DecisionMinima[]): number {
  return new Set(decisiones.filter(esFichaFisica).flatMap((d) => casosEnFicha(d))).size;
}

/**
 * El formulario al abrir una marca guardada: "Los N" si nombra todos los casos del hallazgo, o "Los marcados"
 * con sus ids. `buildEditorForm` trata toda decisión de ignorar como "sobre todos" y perdería los casos.
 */
export function formDeFicha<F extends { target_case_ids: string[]; use_all_cases: boolean; scope_mode: "all" | "selected" | "single" }>(
  form: F,
  todosLosIds: readonly string[],
): F {
  const ids = form.target_case_ids;
  const todos = todosLosIds.length > 0 && todosLosIds.every((id) => ids.includes(id));
  return todos
    ? { ...form, target_case_ids: [], use_all_cases: true, scope_mode: "all" }
    : { ...form, target_case_ids: ids, use_all_cases: false, scope_mode: "selected" };
}

/** El cuerpo de `POST /limpieza/decision`: un borrador con los casos nombrados, sin variable ni valor. */
export function payloadDeFicha(opciones: {
  id: string;
  sourceId: string;
  sourceType: LimpiezaDecision["source_type"];
  casos: readonly string[];
  motivo: string;
}) {
  return {
    ...(opciones.id ? { id: opciones.id } : {}),
    source_id: opciones.sourceId,
    source_type: opciones.sourceType,
    scope: "case_subset" as const,
    target_case_ids: [...opciones.casos],
    action_type: "ignore_rule" as const,
    action_params: { [MARCA_FICHA_FISICA]: true },
    rationale: opciones.motivo.trim(),
    status: "draft" as const,
  };
}

/** Por qué no se puede guardar la marca todavía; `null` si se puede. */
export function causaDeFicha(opciones: { todos: boolean; marcados: number; sinId: number; total: number }): string | null {
  const { todos, marcados, sinId, total } = opciones;
  if (todos && total === 0) return "El hallazgo no tiene casos.";
  if (!todos && marcados === 0) return "Marca al menos un caso de la tabla.";
  if (sinId > 0) {
    return sinId === 1
      ? "1 caso no tiene identificador en la auditoría y no se puede dejar para la ficha. Marca solo los que sí lo tienen."
      : `${sinId} casos no tienen identificador en la auditoría y no se pueden dejar para la ficha. Marca solo los que sí lo tienen.`;
  }
  return null;
}

/** La línea del pie de la Decisión: lo que pasa con los casos. */
export function lineaDeFicha(n: number): string {
  return `${n} ${n === 1 ? "caso queda pendiente" : "casos quedan pendientes"} de la ficha física. La base no cambia.`;
}

export type FilaDeFicha = {
  hallazgoId: string;
  hallazgo: string;
  /** El id del caso (la llave del estudio). */
  caso: string;
  /** El número de encuesta declarado por el estudio o, si no lo hay, la llave. */
  encuesta: string;
  pregunta: string;
  valor: string;
  motivo: string;
  nota: string;
};

/** Las columnas de la tabla de casos que son un resumen del motor y no el valor de una pregunta. */
const RESUMEN_DEL_MOTOR = new Set(["bateria:patron", CLAVE_RESPONDIDAS_DE_SECCION]);

/**
 * Qué pregunta y qué valor de la base lleva una fila: el valor de la pregunta revisada tal como está en la
 * base (en una regla de formato, sin separador de miles). En una batería o en una sección no hay una sola
 * pregunta: va lo que el motor midió en el caso ("respondió "Mucho" en las 14 preguntas").
 */
function columnaDeValor(tabla: ReturnType<typeof tablaDeCasos>, pregunta: { variable: string; etiqueta: string } | null) {
  const falla = tabla.columnas.find((c) => c.tipo === "falla") ?? null;
  if (falla && RESUMEN_DEL_MOTOR.has(falla.clave)) return { clave: falla.clave, rotulo: falla.rotulo };
  if (pregunta) {
    const propia = tabla.columnas.find((c) => c.clave === pregunta.variable) ?? tabla.columnas.find((c) => c.clave === `formato:${pregunta.variable}`);
    if (propia) return { clave: propia.clave, rotulo: pregunta.etiqueta || propia.rotulo };
  }
  return falla ? { clave: falla.clave, rotulo: falla.rotulo } : null;
}

/** Los casos marcados de un hallazgo, una fila por caso, con la pregunta revisada y su valor en la base. */
export function filasDeFicha(opciones: {
  hallazgoId: string;
  hallazgo: string;
  decisiones: readonly LimpiezaDecision[];
  tabla: ReturnType<typeof tablaDeCasos>;
  /** La pregunta revisada de la regla (`preguntaRevisada`), si se conoce. */
  pregunta?: { variable: string; etiqueta: string } | null;
}): FilaDeFicha[] {
  const { hallazgoId, hallazgo, decisiones, tabla } = opciones;
  const marcas = decisiones.filter(esFichaFisica);
  if (!marcas.length) return [];
  // Un caso marcado dos veces conserva la nota de la marca más reciente que la escribió.
  const notas = new Map<string, string>();
  for (const d of [...marcas].sort((a, b) => new Date(a.updated_at ?? 0).getTime() - new Date(b.updated_at ?? 0).getTime())) {
    const nota = (d.rationale ?? "").trim();
    for (const id of casosEnFicha(d)) notas.set(id, nota || notas.get(id) || "");
  }
  const columna = columnaDeValor(tabla, opciones.pregunta ?? null);
  const filas: FilaDeFicha[] = [];
  for (const fila of tabla.filas) {
    if (fila.id === null || !notas.has(fila.id)) continue;
    const numero = fila.contexto?.numero_encuesta?.trim();
    filas.push({
      hallazgoId,
      hallazgo,
      caso: fila.id,
      encuesta: numero || fila.id,
      pregunta: columna?.rotulo ?? hallazgo,
      valor: columna ? fila.valores[columna.clave] ?? "" : "",
      motivo: hallazgo,
      nota: notas.get(fila.id) ?? "",
    });
  }
  return filas;
}

/** Compara dos textos por sus cifras como cifras: "9" antes que "112". */
function compararNatural(a: string, b: string): number {
  const partes = (s: string) => s.match(/\d+|\D+/g) ?? [];
  const pa = partes(a);
  const pb = partes(b);
  for (let i = 0; i < Math.min(pa.length, pb.length); i += 1) {
    const x = pa[i]!;
    const y = pb[i]!;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) {
      const d = Number(x) - Number(y);
      if (d !== 0) return d;
    } else if (nx !== ny) {
      return nx ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return pa.length - pb.length;
}

/** Por número de encuesta y, a igual número, por pregunta. */
export function ordenarPorEncuesta(filas: readonly FilaDeFicha[]): FilaDeFicha[] {
  return [...filas].sort((a, b) => compararNatural(a.encuesta, b.encuesta) || compararNatural(a.pregunta, b.pregunta));
}

/** La lista como CSV para Excel; la columna "Nota" solo sale si alguien la escribió. */
export function csvDeFicha(filas: readonly FilaDeFicha[]): string {
  const conNota = filas.some((f) => f.nota !== "");
  const cabecera = ["N.º de encuesta", "Pregunta", "Valor en la base", "Motivo", ...(conNota ? ["Nota"] : [])];
  const lineas = filas.map((f) => [f.encuesta, f.pregunta, f.valor, f.motivo, ...(conNota ? [f.nota] : [])].map(celdaCsv).join(","));
  return [cabecera.join(","), ...lineas].join("\n");
}
