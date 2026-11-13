/**
 * Lo que se conserva al cambiar el tipo de una regla. Los parámetros de un
 * tipo no sirven al otro, salvo entre los dos tipos que expresan lo mismo con
 * otra forma: "Dos respuestas que deben cuadrar" ("Cuando A, se espera que B")
 * y "Condiciones combinadas" ("A y no B"). Ahí las condiciones pasan de uno al
 * otro, con el operador de la segunda negado para que marquen los mismos casos.
 * Solo difiere el vacío: la primera marca una segunda respuesta vacía; la
 * segunda, no.
 */
import type { CondicionCombinada, OperadorDeCondicion, TipoReglaPropia } from "./tiposDelMotor";
import { condicionesDeParams, modoDeCondiciones } from "./modeloRegla";

type Origen = { tipo: TipoReglaPropia | null; variables: readonly string[]; params: Record<string, unknown> };
type Resultado = { variables: string[]; params: Record<string, unknown> };

const NEGADO: Partial<Record<string, OperadorDeCondicion>> = {
  "==": "!=",
  "!=": "==",
  ">": "<=",
  ">=": "<",
  "<": ">=",
  "<=": ">",
  in: "not_in",
  not_in: "in",
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function valorDeCondicion(valor: unknown): CondicionCombinada["valor"] {
  if (Array.isArray(valor)) return valor.map(String);
  if (typeof valor === "string" || typeof valor === "number") return valor;
  return "";
}

function deCoherenciaACondiciones(o: Origen): Resultado | null {
  const [vx = "", vy = ""] = o.variables;
  if (!vx && !vy) return null;
  const opX = texto(o.params.op_x) as OperadorDeCondicion | "";
  const opY = texto(o.params.op_y);
  const x: CondicionCombinada = { variable: vx, op: opX, valor: valorDeCondicion(o.params.valor_x) };
  const comparada = texto(o.params.valor_y_variable);
  const negada = NEGADO[opY] ?? "";
  const y: CondicionCombinada = comparada
    ? { variable: vy, op: negada, variable_comparada: comparada }
    : { variable: vy, op: negada, valor: negada ? valorDeCondicion(o.params.valor_y) : "" };
  return { variables: [], params: { modo: "todas", condiciones: [x, y] } };
}

function deCondicionesACoherencia(o: Origen): Resultado | null {
  const condiciones = condicionesDeParams(o.params);
  if (modoDeCondiciones(o.params.modo) !== "todas" || condiciones.length < 2) return null;
  const [x, y] = condiciones;
  const params: Record<string, unknown> = {};
  if (x.op && x.op in NEGADO) {
    params.op_x = x.op;
    params.valor_x = x.valor ?? "";
  }
  const opY = y.op ? NEGADO[y.op] : undefined;
  if (opY) {
    params.op_y = opY;
    if (y.variable_comparada) params.valor_y_variable = y.variable_comparada;
    else params.valor_y = y.valor ?? "";
  }
  return { variables: [x.variable, y.variable], params };
}

/**
 * Los parámetros y las preguntas que sobreviven al cambio de `origen.tipo` a
 * `nuevo`, o `null` si entre esos dos tipos no hay nada que traspasar.
 */
export function conservarAlCambiarDeTipo(origen: Origen, nuevo: TipoReglaPropia): Resultado | null {
  if (origen.tipo === "coherencia_2v" && nuevo === "condiciones") return deCoherenciaACondiciones(origen);
  if (origen.tipo === "condiciones" && nuevo === "coherencia_2v") return deCondicionesACoherencia(origen);
  return null;
}
