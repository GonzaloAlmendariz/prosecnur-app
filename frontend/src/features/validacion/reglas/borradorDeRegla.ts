/**
 * El borrador del panel de regla (rebanada V2 del plan de fidelidad): lo que
 * el analista va armando, cómo cambia y qué cuerpo se guarda.
 *
 * Es el estado que vivía en el asistente de tres pasos (`ReglaEditor`, ya
 * retirado), movido a un reductor puro. La regla de la extracción: para las
 * mismas entradas, `cuerpoAGuardar` entrega el mismo objeto, con las claves en
 * el mismo orden, que el asistente entregaba a `onSubmit`
 * (`caracterizacion/huellas/payloadDeRegla.json`).
 */
import type {
  ExploradorVariable,
  ReglaCustomHallazgoKind,
  ReglaGateCondition,
  ReglaSemilla,
  ReglaSemillaMeta,
  ReglaTreatmentActionType,
  ReglaTreatmentScope,
} from "../types";
import { severidadAlGuardar } from "../components/ClasificacionHallazgo";
import { partesDePreguntas } from "./campos/modeloPregunta";
import {
  condicionesDeParams,
  gateExprFromConditions,
  hierarchyMapFromRows,
  hierarchyRowsFromParams,
  isValidTimeZone,
  nombreSugerido,
  normalizeParamsForSubmit,
  normalizeTreatmentAction,
  normalizeTreatmentScope,
  nullableNumber,
  paramList,
  treatmentActionsForTipo,
  treatmentDefaultFor,
  validarBateria,
  validarCondiciones,
  validateGateConditions,
  variablesDeCondiciones,
  type TipoDeVariable,
} from "./modeloRegla";
import { metaDeTipo, rangoDePreguntas } from "./tiposDeRegla";
import { validarFechas, variablesDeComparar } from "./modeloFechas";
import { validarFormato } from "./modeloFormato";
import { CATALOGO_POR_DEFECTO, validarCombinacion, variablesDeCombinacion } from "./modeloCombinacion";
import { esOperadorDeComparacion, type ReglaPropia, type ReglaPropiaAGuardar, type TipoReglaPropia } from "./tiposDelMotor";

export type Borrador = {
  tipo: TipoReglaPropia | null;
  variables: string[];
  nombre: string;
  mensaje: string;
  params: Record<string, unknown>;
  hallazgoKind: ReglaCustomHallazgoKind;
  /** Solo una clase elegida en esta edición cambia la severidad que la regla traía. */
  claseCambiada: boolean;
  gateConditions: ReglaGateCondition[];
  plannedAction: ReglaTreatmentActionType;
  recommendedScope: ReglaTreatmentScope;
  /** Tocar el tratamiento lo fija: cambiar de tipo ya no lo reemplaza por el del tipo. */
  treatmentTouched: boolean;
  activa: boolean;
  /** Si el borrador salió de una sugerida: viaja con la regla, para saber de dónde salió. */
  semilla: ReglaSemillaMeta | null;
  /** Una regla nueva (no la edición de una guardada): se nombra sola con las etiquetas de sus preguntas. */
  nueva: boolean;
  /**
   * El `gate_expr` con que llegó la regla y el filtro de entonces. Si el filtro
   * no cambia, se guarda el mismo `gate_expr` (aunque venga vacío): abrir y
   * guardar sin tocar nada no altera lo guardado.
   */
  filtroOriginal: { condiciones: string; expr: string } | null;
};

/** Los parámetros con que arranca un tipo: lo que se ve tiene que estar en el borrador desde el primer render. */
function paramsDeArranque(tipo: TipoReglaPropia | null, primera: string): Record<string, unknown> {
  if (tipo === "condiciones") return { modo: "todas", condiciones: [{ variable: primera, op: "", valor: "" }] };
  if (tipo === "select_multiple_selection") return { op: "contains_any" };
  if (tipo === "bateria") return { patron: "iguales" };
  if (tipo === "formato") return { modo: "digitos" };
  // Los papeles llegan de la propuesta del motor (CamposDeCombinacion).
  if (tipo === "combinacion_catalogo") return { catalogo: CATALOGO_POR_DEFECTO, roles: {} };
  if (tipo === "comparar_fechas") {
    return {
      unidad: "fecha",
      patron: "orden",
      inicio: { variables: [primera], partes: "una", formato: "auto" },
      fin: { variables: [""], partes: "una", formato: "auto" },
    };
  }
  return {};
}

export type InicioDeBorrador = {
  /** La regla que se edita; `null` para una nueva. */
  inicial: ReglaPropia | null;
  /** El tipo elegido por dirección (`tipo=`), para una nueva. */
  tipo?: TipoReglaPropia | null;
  /** La pregunta elegida por dirección (`pregunta=`), para una nueva. */
  pregunta?: string | null;
  /** Una sugerida que llega armada ("Usar"). */
  semilla?: ReglaSemilla | null;
};

export function borradorInicial({ inicial, tipo = null, pregunta = null, semilla = null }: InicioDeBorrador): Borrador {
  const origen = inicial ?? semilla ?? null;
  const tipoInicial: TipoReglaPropia | null = origen?.tipo ?? tipo ?? null;
  const defaults = treatmentDefaultFor(tipoInicial);
  // El detalle que el asistente guardaba igual al nombre no lo escribió nadie:
  // no se muestra. Al guardar vuelve a ser el nombre, así que lo guardado no cambia.
  const mensaje = origen?.mensaje && origen.mensaje === origen.nombre ? "" : origen?.mensaje ?? "";
  return {
    tipo: tipoInicial,
    variables: origen?.variables ?? (pregunta ? [pregunta] : []),
    nombre: origen?.nombre ?? "",
    mensaje,
    params: origen?.params ?? paramsDeArranque(tipoInicial, tipoInicial === "condiciones" || tipoInicial === "comparar_fechas" ? pregunta ?? "" : ""),
    hallazgoKind: origen?.hallazgo_kind ?? "caso_validar",
    claseCambiada: false,
    gateConditions: origen?.gate_conditions ?? [],
    plannedAction: normalizeTreatmentAction(origen?.planned_action_type, defaults.action),
    recommendedScope: normalizeTreatmentScope(origen?.recommended_scope, defaults.scope),
    treatmentTouched: Boolean(origen?.planned_action_type || origen?.recommended_scope),
    activa: origen?.activa ?? true,
    semilla: inicial ? null : semilla?.semilla ?? null,
    nueva: !inicial,
    filtroOriginal:
      inicial && typeof inicial.gate_expr === "string"
        ? { condiciones: JSON.stringify(inicial.gate_conditions ?? []), expr: inicial.gate_expr }
        : null,
  };
}

export type AccionDeBorrador =
  | { tipo: "elegir-tipo"; valor: TipoReglaPropia }
  | { tipo: "variables"; valor: string[] }
  | { tipo: "nombre"; valor: string }
  | { tipo: "mensaje"; valor: string }
  | { tipo: "param"; clave: string; valor: unknown }
  | { tipo: "params"; valor: Record<string, unknown> }
  | { tipo: "clase"; valor: ReglaCustomHallazgoKind }
  | { tipo: "filtro"; valor: ReglaGateCondition[] }
  | { tipo: "accion"; valor: ReglaTreatmentActionType }
  | { tipo: "alcance"; valor: ReglaTreatmentScope };

export function reducirBorrador(b: Borrador, accion: AccionDeBorrador): Borrador {
  switch (accion.tipo) {
    case "elegir-tipo": {
      const nuevo = accion.valor;
      const defaults = b.treatmentTouched ? null : treatmentDefaultFor(nuevo);
      const base = defaults ? { ...b, plannedAction: defaults.action, recommendedScope: defaults.scope } : b;
      if (nuevo === b.tipo) return { ...base, tipo: nuevo };
      // Otro tipo: sus parámetros no sirven al nuevo y se guardarían de sobra.
      // Se conserva la primera pregunta, que casi siempre es la misma.
      const meta = metaDeTipo(nuevo);
      const [, max] = meta ? rangoDePreguntas(meta) : [1, 1];
      const variables = nuevo === "condiciones" ? [] : b.variables.slice(0, Math.min(1, max));
      const params = paramsDeArranque(nuevo, nuevo === "condiciones" || nuevo === "comparar_fechas" ? b.variables[0] ?? "" : "");
      return { ...base, tipo: nuevo, variables, params };
    }
    case "variables":
      return { ...b, variables: accion.valor };
    case "nombre":
      return { ...b, nombre: accion.valor };
    case "mensaje":
      return { ...b, mensaje: accion.valor };
    case "param":
      return { ...b, params: { ...b.params, [accion.clave]: accion.valor } };
    case "params":
      return { ...b, params: accion.valor };
    case "clase":
      return { ...b, hallazgoKind: accion.valor, claseCambiada: true };
    case "filtro":
      return { ...b, gateConditions: accion.valor };
    case "accion":
      return { ...b, plannedAction: accion.valor, treatmentTouched: true };
    case "alcance":
      return { ...b, recommendedScope: accion.valor, treatmentTouched: true };
    default:
      return b;
  }
}

/** El tratamiento que se guarda: si el elegido no vale para el tipo, el primero que sí. */
export function accionEfectiva(b: Borrador): ReglaTreatmentActionType {
  if (!b.tipo) return b.plannedAction;
  const acciones = treatmentActionsForTipo(b.tipo);
  return acciones.some((a) => a.value === b.plannedAction) ? b.plannedAction : acciones[0]?.value ?? "ignore_rule";
}

/** Las preguntas de la regla: las de sus condiciones en "Condiciones combinadas". */
export function variablesEfectivas(b: Borrador): string[] {
  if (b.tipo === "condiciones") return variablesDeCondiciones(condicionesDeParams(b.params));
  // Inicio y fin: sus preguntas, en ese orden (validacion_regla_fechas.R).
  if (b.tipo === "comparar_fechas") return variablesDeComparar(b.params).filter(Boolean);
  // Los papeles de la combinación, la más específica primero (reglas_custom_catalogo.R).
  if (b.tipo === "combinacion_catalogo") return variablesDeCombinacion(b.params);
  // Una fila de pregunta vacía no es una pregunta de la regla.
  return b.variables.every(Boolean) ? b.variables : b.variables.filter(Boolean);
}

/**
 * El nombre que se ve y se guarda: el escrito o el que la regla se pone sola.
 * Una regla nueva se nombra con el rótulo de su tipo y la etiqueta de sus
 * preguntas ("Valor fuera de rango: "Edad""); sin etiqueta, con su código una
 * vez. Una pregunta de batería se nombra por su código y su ítem
 * ("p29_3, Me siento seguro en mi colegio"): el enunciado común es largo y,
 * puesto delante, la elipsis se comía el ítem, que es lo que la distingue.
 * La que se edita conserva el nombre de siempre (código de la columna),
 * para que guardarla sin tocarla no cambie lo guardado.
 */
export function nombreDelBorrador(b: Borrador, variables: readonly ExploradorVariable[] = []): string {
  const escrito = b.nombre.trim();
  if (escrito) return escrito;
  const meta = metaDeTipo(b.tipo);
  const preguntas = variablesEfectivas(b);
  if (!b.nueva) return nombreSugerido(meta, preguntas);
  const porNombre = new Map(variables.map((v) => [v.name, v.label]));
  const partes = partesDePreguntas(variables);
  const nombrar = (codigo: string): string => {
    const parte = partes.get(codigo);
    if (parte?.enunciado) return `${codigo}, ${parte.texto}`;
    const etiqueta = (porNombre.get(codigo) ?? "").trim();
    return etiqueta && etiqueta !== codigo ? `"${etiqueta}"` : codigo;
  };
  const nombres = preguntas.map(nombrar);
  const base = meta?.rotulo ?? "Regla";
  // Una batería se nombra por el código de su primera y su última pregunta, no por todas.
  if (b.tipo === "bateria" && preguntas.length > 2) return `${base}: ${preguntas[0]} a ${preguntas[preguntas.length - 1]}`;
  // Dos fechas u horas: la primera pregunta del inicio y la primera del fin.
  if (b.tipo === "comparar_fechas") {
    const [ini, fin] = [b.params.inicio, b.params.fin].map((m) => {
      const v = (m as { variables?: unknown[] } | undefined)?.variables?.[0];
      return typeof v === "string" && v ? nombrar(v) : "";
    });
    if (ini && fin) return `${base}: ${ini} y ${fin}`;
  }
  return nombres.length ? `${base}: ${nombres.join(" y ")}` : base;
}

/**
 * El primer problema del borrador, o "" si se puede guardar. Son las
 * validaciones de los tres pasos del asistente, con sus mensajes, más las de
 * "Condiciones combinadas" y la comparación con otra pregunta (M1).
 */
export function validarBorrador(b: Borrador): string {
  const { tipo, params } = b;
  if (!tipo) return "Elige un tipo de regla.";
  const meta = metaDeTipo(tipo);
  if (!meta) return "Tipo no definido.";
  if (tipo === "condiciones") {
    const error = validarCondiciones(condicionesDeParams(params));
    if (error) return error;
  } else if (tipo === "comparar_fechas") {
    const error = validarFechas(tipo, params, []);
    if (error) return error;
  } else if (tipo === "combinacion_catalogo") {
    const error = validarCombinacion(params);
    if (error) return error;
  } else {
    const [needed] = rangoDePreguntas(meta);
    if (b.variables.filter(Boolean).length < needed) return `Elige al menos ${needed} pregunta${needed === 1 ? "" : "s"}.`;
  }
  if (tipo === "rango_num") {
    const mn = params.min as string | undefined;
    const mx = params.max as string | undefined;
    if (!mn && !mx) return "Define al menos un límite mínimo o máximo.";
  }
  if (tipo === "rango_fecha") {
    const mn = params.min as string | undefined;
    const mx = params.max as string | undefined;
    if (!mn && !mx) return "Define al menos la fecha de inicio o la de cierre.";
    if (mn && mx && mn > mx) return "El inicio del operativo no puede ser posterior al cierre.";
    const timezone = String(params.timezone ?? "America/Lima").trim();
    if (!isValidTimeZone(timezone)) return "La zona horaria no es válida. Usa un identificador como America/Lima.";
    const error = validarFechas(tipo, params, b.variables);
    if (error) return error;
  }
  if (tipo === "outliers_iqr" || tipo === "outliers_z") {
    const k = Number(params.k);
    if (!isFinite(k) || k <= 0) return "El multiplicador debe ser un número mayor que cero.";
  }
  if (tipo === "fuera_catalogo") {
    const vals = (params.valores as string[] | undefined) ?? [];
    if (!vals.length) return "Añade al menos un valor permitido.";
  }
  if (tipo === "coherencia_2v") {
    const comparada = typeof params.valor_y_variable === "string" ? params.valor_y_variable.trim() : "";
    if (!params.op_x || !params.op_y) return "Define operadores para ambas variables.";
    if (params.valor_x === undefined || (params.valor_y === undefined && !comparada)) {
      return "Define la condición de ambas variables.";
    }
    if (comparada && comparada === b.variables[1]) return "La segunda pregunta no se puede comparar consigo misma.";
    if (comparada && !esOperadorDeComparacion(String(params.op_y))) {
      return "Con otra pregunta solo se compara con es, no es, mayor o menor.";
    }
  }
  if (tipo === "select_multiple_hierarchy") {
    const map = hierarchyMapFromRows(hierarchyRowsFromParams(params));
    if (Object.keys(map).length === 0) {
      return "Agrega al menos una relación: si marcó una opción, qué opciones deberían acompañarla.";
    }
  }
  if (tipo === "select_multiple_exclusive") {
    const codes = paramList(params.exclusive_codes);
    if (!codes.length) return "Define al menos una opción excluyente.";
  }
  if (tipo === "select_multiple_cardinality") {
    const min = nullableNumber(params.min);
    const max = nullableNumber(params.max);
    if (min === null && max === null) return "Define mínimo, máximo o ambos.";
    if (min !== null && max !== null && min > max) return "El mínimo no puede ser mayor que el máximo.";
  }
  if (tipo === "bateria") {
    const error = validarBateria(params, b.variables.filter(Boolean).length);
    if (error) return error;
  }
  if (tipo === "formato") {
    const error = validarFormato(params, b.variables.filter(Boolean).length);
    if (error) return error;
  }
  if (tipo === "select_multiple_selection") {
    const op = String(params.op ?? "");
    const codes = paramList(params.codes);
    if (!op) return "Define el operador de selección múltiple.";
    if (!codes.length) return "Define al menos una opción.";
  }
  return validateGateConditions(b.gateConditions);
}

/**
 * El cuerpo del POST (regla nueva) o del PUT (`id` de la que se edita). Mismo
 * orden de claves que el asistente: la huella compara el JSON en claro.
 */
export function cuerpoAGuardar(
  b: Borrador,
  inicial: Pick<ReglaPropia, "id" | "severidad"> | null,
  tipoDeVariable?: TipoDeVariable,
  inventario: readonly ExploradorVariable[] = [],
): ReglaPropiaAGuardar | null {
  const { tipo } = b;
  if (!tipo) return null;
  const submitParams = normalizeParamsForSubmit(tipo, b.params, tipoDeVariable);
  const variables = variablesEfectivas(b);
  // El nombre es opcional: sin él, la regla se nombra por su tipo y sus
  // preguntas, que es lo que cualquiera escribiría a mano.
  const nombreFinal = nombreDelBorrador(b, inventario);
  return {
    id: inicial?.id,
    activa: b.activa,
    nombre: nombreFinal,
    tipo,
    variables,
    params: submitParams,
    mensaje: b.mensaje || nombreFinal,
    // La severidad sigue a la clase elegida (inconsistencia: error; caso a
    // revisar: advertencia). Si no se eligió ninguna en esta edición, se
    // conserva la que la regla traía.
    severidad: severidadAlGuardar(b.hallazgoKind, inicial?.severidad, b.claseCambiada),
    hallazgo_kind: b.hallazgoKind,
    planned_action_type: accionEfectiva(b),
    recommended_scope: b.recommendedScope,
    gate_expr:
      b.filtroOriginal && JSON.stringify(b.gateConditions) === b.filtroOriginal.condiciones
        ? b.filtroOriginal.expr
        : gateExprFromConditions(b.gateConditions),
    gate_conditions: b.gateConditions.filter((cond) => cond.variable && cond.op),
    // Una sugerida usada se guarda como sugerida, igual que "Adoptar".
    ...(b.semilla ? { origen: "sembrado" as const, semilla: b.semilla } : {}),
  };
}

/** Lo que se manda a contar (`/reglas_custom/probar`): la regla como se guardaría, sin `id`. `null` si no está completa. */
export function cuerpoParaProbar(b: Borrador, tipoDeVariable?: TipoDeVariable): Record<string, unknown> | null {
  if (validarBorrador(b)) return null;
  const cuerpo = cuerpoAGuardar(b, null, tipoDeVariable);
  if (!cuerpo) return null;
  const { id: _id, semilla: _semilla, origen: _origen, ...sinId } = cuerpo;
  return sinId;
}

/** Un lector del tipo de cada pregunta del inventario. */
export function lectorDeTipos(variables: readonly ExploradorVariable[]): TipoDeVariable {
  const porNombre = new Map(variables.map((v) => [v.name, v.tipo]));
  return (nombre) => porNombre.get(nombre);
}
