// =============================================================================
// customRuleNarrative.ts — adaptador reglas custom → ReglaLike (narrativa)
// =============================================================================
// El motor narrativo (RuleNarrative + narrative/) fue pensado para reglas del
// instrumento. Para que las reglas custom se lean igual de bien necesitamos:
//
//   1) Mapear `tipo` custom → `tipo_regla` del AST (required/range/outlier/...)
//      que es lo que `buildExpectationHeadline` reconoce.
//   2) Construir un `objetivo` legible que describa los parámetros
//      (ej: "Rango numérico 0 a 100", "Outlier IQR k=1.5").
//
// Así una regla custom no terminada (sólo tipo + variables) ya muestra una
// narrativa útil en el preview del editor — y al guardarse, la card de la
// lista se lee como: "variable" debe estar dentro del rango permitido.
// =============================================================================

import type { ReglaGateCondition } from "./types";
import type { ReglaLike } from "./components/v2";
import { descripcionDeFormato, modoDeFormato } from "./reglas/modeloFormato";
import { papelesDeParams } from "./reglas/modeloCombinacion";
import { PAPELES_DE_CATALOGO } from "../../api/catalogoUbigeo";
import {
  ademasDeBateria,
  condicionesDeParams,
  esOperadorSinValor,
  minimoDeBateria,
  modoDeCondiciones,
  paramList,
  patronDeBateria,
  textoDeAdemas,
} from "./reglas/modeloRegla";
import { leerOperador, leerOperadorNegado } from "./reglas/operadores";
import {
  fechaMostrada,
  momentoDe,
  momentoDeRango,
  patronDeFechas,
  unidadDeDuracion,
  unidadDeFechas,
  type Momento,
  type UnidadDeFechas,
} from "./reglas/modeloFechas";
import type { CondicionCombinada, ReglaPropia, TipoReglaPropia } from "./reglas/tiposDelMotor";

// Mapea el `tipo` de la regla custom al `tipo_regla` que reconoce el
// builder narrativo del AST engine.
const CUSTOM_TIPO_TO_AST: Record<TipoReglaPropia, string> = {
  no_nulo: "required",
  rango_num: "range",
  rango_fecha: "range",
  outliers_iqr: "outlier",
  outliers_z: "outlier",
  duplicados: "duplicate",
  fuera_catalogo: "catalog",
  coherencia_2v: "coherence",
  select_multiple_hierarchy: "select_multiple_cardinality",
  select_multiple_exclusive: "select_multiple_cardinality",
  select_multiple_cardinality: "select_multiple_cardinality",
  select_multiple_selection: "select_multiple_cardinality",
  condiciones: "coherence",
  bateria: "pattern",
  comparar_fechas: "coherence",
  formato: "pattern",
  combinacion_catalogo: "coherence",
};

// Label humano del tipo — se usa también como `categoria_ux` y en el chip
// de la lista.
export const CUSTOM_TIPO_LABEL: Record<TipoReglaPropia, string> = {
  no_nulo: "Respuesta obligatoria",
  rango_num: "Valor fuera de rango",
  rango_fecha: "Fecha fuera del operativo",
  outliers_iqr: "Outliers (IQR)",
  outliers_z: "Outliers (Z-score)",
  duplicados: "Duplicados operativos",
  fuera_catalogo: "Respuesta fuera de lista",
  coherencia_2v: "Dos respuestas que deben cuadrar",
  select_multiple_hierarchy: "Jerarquía de selección múltiple",
  select_multiple_exclusive: "Opciones incompatibles",
  select_multiple_cardinality: "Cantidad de opciones marcada",
  select_multiple_selection: "Opciones esperadas o prohibidas",
  condiciones: "Condiciones combinadas",
  bateria: "Patrón en una batería",
  comparar_fechas: "Dos fechas u horas que deben cuadrar",
  formato: "Formato de la respuesta",
  combinacion_catalogo: "Combinación fuera de catálogo",
};

// Construye una descripción corta a partir de los parámetros — útil cuando
// la regla aún no tiene nombre (preview en vivo del editor).
export function describeCustomParams(
  tipo: TipoReglaPropia,
  params: Record<string, unknown>,
  variables: string[] = [],
): string {
  const mn = typeof params.min === "string" ? params.min : null;
  const mx = typeof params.max === "string" ? params.max : null;
  const k = typeof params.k === "number" ? params.k : null;
  const valores = Array.isArray(params.valores) ? params.valores.length : 0;

  switch (tipo) {
    case "no_nulo":
      return "Marca las filas donde la variable quedó vacía o con NA.";
    case "rango_num":
      if (mn && mx) return `Debe estar entre ${mn} y ${mx}.`;
      if (mn) return `Debe ser ≥ ${mn}.`;
      if (mx) return `Debe ser ≤ ${mx}.`;
      return "Define el rango esperado para una duración, conteo o métrica operativa.";
    case "rango_fecha": {
      if (!mn && !mx) return "Define el periodo del operativo para esta fecha.";
      const piezas = fraseDeReglaPropia({ tipo, variables, params });
      return piezas ? fraseEnTexto(piezas) : "Define el periodo del operativo para esta fecha.";
    }
    case "comparar_fechas": {
      const piezas = fraseDeReglaPropia({ tipo, variables, params });
      return piezas ? fraseEnTexto(piezas) : "Se marca cuando la segunda fecha u hora es anterior a la primera, o cuando la duración entre ambas queda fuera del rango.";
    }
    case "outliers_iqr":
      return `Se marcan valores fuera del intervalo [Q1 − ${k ?? 1.5} × IQR, Q3 + ${k ?? 1.5} × IQR].`;
    case "outliers_z":
      return `Se marcan valores cuyo |z-score| supere ${k ?? 3}.`;
    case "duplicados":
      return variables.length > 0
        ? `Se marcan todas las filas cuando la tupla (${variables.join(" + ")}) aparece más de una vez; las claves incompletas se ignoran.`
        : "Se marcan todas las filas donde esa combinación de identificadores aparece más de una vez; las claves incompletas se ignoran.";
    case "fuera_catalogo":
      return valores > 0
        ? `Se marcan filas con valores que no están en la lista permitida (${valores} entradas).`
        : "Define la lista de opciones esperadas.";
    case "coherencia_2v": {
      const x = condicionLegible(params.op_x, params.valor_x);
      const comparada = typeof params.valor_y_variable === "string" ? params.valor_y_variable.trim() : "";
      const y = comparada ? condicionLegible(params.op_y, comparada) : condicionLegible(params.op_y, params.valor_y);
      if (x && y && variables.length >= 2) {
        return `Se marca cuando ${variables[0]} ${x} y ${variables[1]} no cumple "${y}".`;
      }
      return "Se marca cuando la primera respuesta cumple su condición y la segunda no cumple la suya.";
    }
    case "select_multiple_hierarchy": {
      const map = params.hierarchy_map;
      const n = map && typeof map === "object" && !Array.isArray(map) ? Object.keys(map).length : 0;
      return n > 0
        ? `Detecta respuestas de selección múltiple que no completan el mapa manual (${n} activador${n === 1 ? "" : "es"}).`
        : "Define qué opciones deben agregarse cuando una opción superior está marcada.";
    }
    case "select_multiple_exclusive":
      return "Detecta opciones excluyentes marcadas junto con otras respuestas.";
    case "select_multiple_cardinality":
      return "Detecta respuestas con menos o más opciones marcadas que el rango esperado.";
    case "select_multiple_selection":
      return "Detecta respuestas de selección múltiple que no cumplen el patrón de opciones esperado.";
    case "condiciones": {
      const condiciones = condicionesDeParams(params);
      const partes = condiciones.map((c) => {
        const otra = (c.variable_comparada ?? "").trim();
        const lado = otra ? condicionLegible(c.op, otra) : condicionLegible(c.op, c.valor);
        return c.variable && lado ? `${c.variable} ${lado}` : "";
      });
      if (!partes.length || partes.some((p) => !p)) {
        return "Se marca cuando se cumplen las condiciones elegidas; una pregunta vacía no cumple su condición.";
      }
      const conector = modoDeCondiciones(params.modo) === "alguna" ? " o " : " y ";
      return `Se marca cuando ${partes.join(conector)}; una pregunta vacía no cumple su condición.`;
    }
    case "bateria": {
      const piezas = fraseDeReglaPropia({ tipo, variables, params });
      return piezas ? fraseEnTexto(piezas) : "Se marca cuando las preguntas de una batería tienen todas la misma respuesta, repiten un código o quedan vacías.";
    }
    case "formato": {
      const piezas = fraseDeReglaPropia({ tipo, variables, params });
      return piezas ? fraseEnTexto(piezas) : "Se marca cuando la respuesta no está escrita como se pide.";
    }
    case "combinacion_catalogo": {
      const piezas = fraseDeReglaPropia({ tipo, variables, params });
      return piezas ? fraseEnTexto(piezas) : "Se marca cuando el lugar declarado no existe en el catálogo de ubigeos o sus partes no calzan.";
    }
    default:
      return "";
  }
}

const OPERADOR_LEGIBLE: Record<string, string> = {
  "==": "es",
  "!=": "no es",
  ">": "es mayor que",
  ">=": "es mayor o igual que",
  "<": "es menor que",
  "<=": "es menor o igual que",
  in: "es una de",
  not_in: "no es ninguna de",
  contains: "incluye",
  contains_any: "incluye alguna de",
  contains_all: "incluye todas",
  not_contains: "no incluye",
  contains_none: "no incluye ninguna de",
};

// "es 1", "es una de 4, 5, 6": la condición de un lado del cruce en palabras.
// Vacío si falta operador o valor (borrador a medio llenar).
function condicionLegible(op: unknown, valor: unknown): string {
  if (typeof op !== "string" || !op) return "";
  const valores = (Array.isArray(valor) ? valor : [valor])
    .map((v) => (v === null || v === undefined ? "" : String(v).trim()))
    .filter(Boolean);
  if (!valores.length) return "";
  return `${OPERADOR_LEGIBLE[op] ?? op} ${valores.join(", ")}`;
}

// Convierte una ReglaCustom completa (ya guardada) al shape ReglaLike.
export function customRuleToRule(r: ReglaPropia): ReglaLike {
  const target = r.variables[0] ?? null;
  const gateVars = (r.gate_conditions ?? []).map((c) => c.variable).filter(Boolean);
  const gate = r.tipo === "coherencia_2v" && r.variables[1]
    ? [r.variables[1], ...gateVars]
    : gateVars.length
      ? gateVars
      : null;
  return {
    id: r.id,
    nombre: r.nombre,
    tipo_regla: CUSTOM_TIPO_TO_AST[r.tipo] ?? null,
    tipo_observacion: r.tipo,
    fuente: "custom",
    hallazgo_kind: r.hallazgo_kind ?? "caso_validar",
    origen_detalle: r.hallazgo_kind === "inconsistencia_usuario"
      ? "Personalizada: inconsistencia definida"
      : "Personalizada: caso a validar",
    severidad: r.severidad,
    categoria_ux: CUSTOM_TIPO_LABEL[r.tipo] ?? r.tipo,
    // Sin detalle propio, el editor guarda el nombre como mensaje; repetirlo
    // como "Nota" sólo duplica lo que ya dice el título.
    objetivo: customObjective(r.tipo, r.params, r.variables, r.mensaje === r.nombre ? "" : r.mensaje),
    variables: r.variables,
    variable_roles: target ? (gate ? { target, gate } : { target }) : null,
    n_casos: null,
    porcentaje: null,
  };
}

// Versión draft: construye un ReglaLike desde estado parcial del editor.
// Útil para el preview en vivo — no requiere id ni mensaje, pero sí al
// menos un tipo y una variable.
export function draftCustomToRule(input: {
  tipo: TipoReglaPropia | null;
  variables: string[];
  nombre: string;
  mensaje: string;
  params: Record<string, unknown>;
  hallazgo_kind?: ReglaPropia["hallazgo_kind"];
  severidad?: ReglaPropia["severidad"];
}): ReglaLike | null {
  if (!input.tipo || !input.variables.length) return null;
  const target = input.variables[0] ?? null;
  const gateVars = Array.isArray((input.params as Record<string, unknown>).gate_conditions)
    ? ((input.params as Record<string, unknown>).gate_conditions as Array<{ variable?: string }>).map((c) => c.variable ?? "").filter(Boolean)
    : [];
  const gate =
    input.tipo === "coherencia_2v" && input.variables[1]
      ? [input.variables[1], ...gateVars]
      : gateVars.length
        ? gateVars
      : null;
  const objetivo = customObjective(
    input.tipo,
    input.params,
    input.variables,
    input.mensaje,
  );
  return {
    id: undefined,
    nombre: input.nombre.trim() || CUSTOM_TIPO_LABEL[input.tipo],
    tipo_regla: CUSTOM_TIPO_TO_AST[input.tipo] ?? null,
    tipo_observacion: input.tipo,
    fuente: "custom",
    hallazgo_kind: input.hallazgo_kind ?? "caso_validar",
    origen_detalle: input.hallazgo_kind === "inconsistencia_usuario"
      ? "Personalizada: inconsistencia definida"
      : "Personalizada: caso a validar",
    severidad: input.severidad ?? "error",
    categoria_ux: CUSTOM_TIPO_LABEL[input.tipo],
    objetivo,
    variables: input.variables,
    variable_roles: target ? (gate ? { target, gate } : { target }) : null,
    n_casos: null,
    porcentaje: null,
  };
}

function customObjective(
  tipo: TipoReglaPropia,
  params: Record<string, unknown>,
  variables: string[],
  message: string,
): string | null {
  const detail = describeCustomParams(tipo, params, variables).trim();
  const note = message.trim();
  if (!note) return detail || null;
  if (!detail || note.toLocaleLowerCase("es").includes(detail.toLocaleLowerCase("es"))) return note;
  return `${detail} Nota: ${note}`;
}

// =============================================================================
// La frase de la regla, en piezas (panel de regla, rebanada V2)
// =============================================================================
// Lo que el panel escribe en su tarjeta de frase: texto, fichas de pregunta y
// valores, en orden. Una pieza `pregunta` se dibuja con `FichaPregunta`; un
// `valor`, en negrita; un `conector` ("y", "o"), con el acento. La frase dice
// también qué pasa con un vacío, porque los dos tipos de cruce lo tratan
// distinto (contrato M1, sección 5): en "Dos respuestas que deben cuadrar" una
// segunda respuesta vacía marca el caso; en "Condiciones combinadas" una
// pregunta vacía no cumple su condición y no lo marca.

export type PiezaDeFrase =
  | { tipo: "texto"; texto: string }
  | { tipo: "pregunta"; variable: string }
  | { tipo: "valor"; texto: string }
  | { tipo: "conector"; texto: string };

export type ReglaParaFrase = {
  tipo: TipoReglaPropia | null;
  variables: readonly string[];
  params: Record<string, unknown>;
  gate_conditions?: readonly ReglaGateCondition[];
};

/** Cómo se lee un código de respuesta: su etiqueta si se conoce. */
export type LeerValor = (variable: string, codigo: string) => string;

const leerTalCual: LeerValor = (_variable, codigo) => codigo;

class Frase {
  readonly piezas: PiezaDeFrase[] = [];
  texto(t: string) {
    const ultima = this.piezas[this.piezas.length - 1];
    if (ultima?.tipo === "texto") ultima.texto += t;
    else this.piezas.push({ tipo: "texto", texto: t });
    return this;
  }
  pregunta(variable: string) {
    this.piezas.push({ tipo: "pregunta", variable });
    return this;
  }
  valor(t: string) {
    this.piezas.push({ tipo: "valor", texto: t });
    return this;
  }
  conector(t: string) {
    this.piezas.push({ tipo: "conector", texto: t });
    return this;
  }
}

function textoDeValores(variable: string, valor: unknown, leer: LeerValor): string {
  const leidos = paramList(valor).map((codigo) => leer(variable, codigo));
  if (leidos.length <= 1) return leidos[0] ?? "";
  // Varias etiquetas con espacios ("Trabaja y estudia") se citan, para que el
  // "y" de la lista no se confunda con el de la etiqueta.
  const lista = leidos.some((t) => /\s/.test(t)) ? leidos.map((t) => `"${t}"`) : leidos;
  return `${lista.slice(0, -1).join(", ")} y ${lista[lista.length - 1]}`;
}

function textoDeParam(valor: unknown): string {
  if (typeof valor === "number") return String(valor);
  if (typeof valor === "string") return valor.trim();
  return "";
}

/** "edad es mayor que 5": pregunta, operador y valor (u otra pregunta). Falso si falta algo. */
function condicionEnFrase(
  f: Frase,
  c: { variable: string; op: string; valor?: unknown; comparada?: string },
  leer: LeerValor,
  opciones: { omitirPregunta?: boolean; negar?: boolean } = {},
): boolean {
  const op = opciones.negar ? leerOperadorNegado(c.op) : leerOperador(c.op);
  // "está vacía" y "tiene respuesta" se dicen sin valor.
  if (esOperadorSinValor(c.op)) {
    if (!c.variable || !op) return false;
    if (!opciones.omitirPregunta) f.pregunta(c.variable).texto(" ");
    f.texto(op);
    return true;
  }
  const comparada = (c.comparada ?? "").trim();
  const valor = comparada ? "" : textoDeValores(c.variable, c.valor, leer);
  if (!c.variable || !op || (!comparada && !valor)) return false;
  if (!opciones.omitirPregunta) f.pregunta(c.variable).texto(" ");
  f.texto(`${op} `);
  if (comparada) f.pregunta(comparada);
  else f.valor(valor);
  return true;
}

function filtroEnFrase(f: Frase, gate: readonly ReglaGateCondition[], leer: LeerValor) {
  const completas = gate.filter((g) => g.variable && g.op && (esOperadorSinValor(g.op) || paramList(g.value).length));
  if (!completas.length) return;
  f.texto(" Solo se revisa cuando ");
  completas.forEach((g, i) => {
    if (i > 0) f.texto(" ").conector("y").texto(" ");
    condicionEnFrase(f, { variable: g.variable, op: g.op, valor: g.value }, leer);
  });
  f.texto(".");
}

/**
 * La frase de una regla propia, o `null` si la regla todavía no está completa
 * (el panel muestra entonces la descripción del tipo).
 */
export function fraseDeReglaPropia(regla: ReglaParaFrase, leer: LeerValor = leerTalCual): PiezaDeFrase[] | null {
  const f = new Frase();
  const p = regla.params;
  const [v1, v2] = regla.variables;
  f.texto("Se marca cuando ");
  switch (regla.tipo) {
    case "coherencia_2v": {
      if (!v1 || !v2) return null;
      if (!condicionEnFrase(f, { variable: v1, op: String(p.op_x ?? ""), valor: p.valor_x }, leer)) return null;
      f.texto(" ").conector("y").texto(" ");
      const comparada = typeof p.valor_y_variable === "string" ? p.valor_y_variable : "";
      if (!condicionEnFrase(f, { variable: v2, op: String(p.op_y ?? ""), valor: p.valor_y, comparada }, leer, { negar: true })) return null;
      f.texto(" o está vacía.");
      break;
    }
    case "condiciones": {
      const condiciones: CondicionCombinada[] = condicionesDeParams(p);
      if (!condiciones.length) return null;
      const conector = modoDeCondiciones(p.modo) === "alguna" ? "o" : "y";
      for (const [i, c] of condiciones.entries()) {
        if (i > 0) f.texto(" ").conector(conector).texto(" ");
        const repite = i > 0 && condiciones[i - 1].variable === c.variable;
        if (!condicionEnFrase(f, { variable: c.variable, op: c.op, valor: c.valor, comparada: c.variable_comparada }, leer, { omitirPregunta: repite })) return null;
      }
      // Con "está vacía" o "tiene respuesta" en la regla, el vacío sí decide esas condiciones.
      if (!condiciones.some((c) => esOperadorSinValor(c.op))) f.texto(". Una pregunta vacía no cumple su condición.");
      else if (condiciones.every((c) => esOperadorSinValor(c.op))) f.texto(".");
      else f.texto(". En las condiciones con valor, una pregunta vacía no las cumple.");
      break;
    }
    case "rango_num": {
      const min = textoDeParam(p.min);
      const max = textoDeParam(p.max);
      if (!v1 || (!min && !max)) return null;
      const inclusivo = p.inclusive !== false;
      f.pregunta(v1).texto(" ");
      if (min) f.texto(inclusivo ? "es menor que " : "es menor o igual a ").valor(min);
      if (min && max) f.texto(" ").conector("o").texto(" ");
      if (max) f.texto(inclusivo ? "es mayor que " : "es mayor o igual a ").valor(max);
      f.texto(".");
      break;
    }
    case "rango_fecha":
    case "comparar_fechas": {
      if (!fraseDeFechas(f, regla)) return null;
      break;
    }
    case "duplicados": {
      const llaves = regla.variables.filter(Boolean);
      if (!llaves.length) return null;
      llaves.forEach((v, i) => {
        if (i > 0) f.texto(i === llaves.length - 1 ? " y " : ", ");
        f.pregunta(v);
      });
      f.texto(llaves.length === 1 ? " se repite en más de una encuesta." : " se repiten juntas en más de una encuesta.");
      f.texto(" Una encuesta con alguna de ellas vacía no se compara.");
      break;
    }
    case "no_nulo": {
      if (!v1) return null;
      f.pregunta(v1).texto(" está vacía.");
      break;
    }
    case "outliers_iqr": {
      if (!v1) return null;
      f.pregunta(v1).texto(" se aleja del resto más de ").valor(textoDeParam(p.k) || "1.5").texto(" veces el rango intercuartílico.");
      break;
    }
    case "outliers_z": {
      if (!v1) return null;
      f.pregunta(v1).texto(" está a más de ").valor(textoDeParam(p.k) || "3").texto(" desviaciones estándar de la media.");
      break;
    }
    case "fuera_catalogo": {
      const n = paramList(p.valores).length;
      if (!v1 || !n) return null;
      f.pregunta(v1).texto(" tiene un valor fuera de la lista permitida (").valor(String(n)).texto(n === 1 ? " valor)." : " valores).");
      break;
    }
    case "select_multiple_hierarchy": {
      if (!v1) return null;
      f.pregunta(v1).texto(" incluye una opción y no incluye las que van con ella.");
      break;
    }
    case "select_multiple_exclusive": {
      const codigos = textoDeValores(v1 ?? "", p.exclusive_codes, leer);
      if (!v1 || !codigos) return null;
      f.pregunta(v1).texto(" incluye ").valor(codigos).texto(" junto con otra opción.");
      break;
    }
    case "select_multiple_cardinality": {
      const min = textoDeParam(p.min);
      const max = textoDeParam(p.max);
      if (!v1 || (!min && !max)) return null;
      f.pregunta(v1).texto(" tiene ");
      if (min) f.texto("menos de ").valor(min);
      if (min && max) f.texto(" ").conector("o").texto(" ");
      if (max) f.texto("más de ").valor(max);
      f.texto(" opciones marcadas.");
      break;
    }
    case "select_multiple_selection": {
      const codigos = textoDeValores(v1 ?? "", p.codes, leer);
      const op = String(p.op ?? "contains_any");
      if (!v1 || !codigos) return null;
      // La regla marca lo que NO cumple el patrón (motor: `!(...)`).
      const lectura = op === "contains_all" || op === "contains"
        ? "no incluye todas estas opciones: "
        : op === "not_contains" || op === "contains_none"
          ? "incluye alguna de "
          : "no incluye ninguna de ";
      f.pregunta(v1).texto(` ${lectura}`).valor(codigos).texto(".");
      break;
    }
    case "bateria": {
      if (!fraseDeBateria(f, regla, leer)) return null;
      break;
    }
    case "formato": {
      // Las palabras de `.vrf_frase_formato()` en el motor.
      const modo = modoDeFormato(p.modo);
      if (!v1 || (modo === "expresion" && !(typeof p.expresion === "string" && p.expresion.trim()))) return null;
      f.pregunta(v1).texto(` no es ${descripcionDeFormato(p)}.`);
      if (modo === "digitos" && p.sin_separadores === true) f.texto(" Antes se quitan espacios, guiones, puntos y paréntesis.");
      f.texto(" La respuesta se revisa como texto, así que un cero inicial cuenta como dígito.");
      break;
    }
    case "combinacion_catalogo": {
      // Las palabras de `.vrf_frase_catalogo()` en el motor.
      const papeles = papelesDeParams(p);
      const usados = PAPELES_DE_CATALOGO.filter((x) => papeles[x]);
      if (usados.length < 2) return null;
      f.texto("la combinación de ");
      usados.forEach((papel, i) => {
        if (i > 0) f.texto(i === usados.length - 1 ? " y " : ", ");
        f.texto(`${papel} `).pregunta(papeles[papel] as string);
      });
      f.texto(" no existe en Ubigeos del Perú (INEI), o algún nombre no se reconoce.");
      const omitir = paramList(p.omitir);
      if (omitir.length) f.texto(` No se revisan los casos con ${omitir.map((x) => `"${x}"`).join(", ")}.`);
      break;
    }
    default:
      return null;
  }
  filtroEnFrase(f, regla.gate_conditions ?? [], leer);
  return f.piezas;
}

/**
 * "Patrón en una batería": las mismas palabras que la frase del catálogo
 * (`.vrf_frase_bateria()` en el motor). Falso si la regla no está completa.
 */
function fraseDeBateria(f: Frase, regla: ReglaParaFrase, leer: LeerValor): boolean {
  const vars = regla.variables.filter(Boolean);
  const k = vars.length;
  if (k < 2) return false;
  const p = regla.params;
  const patron = patronDeBateria(p.patron);
  const m = minimoDeBateria(p, k);
  if (m === null || !Number.isInteger(m)) return false;
  const primera = vars[0];
  const tramo = () => f.texto("de ").pregunta(primera).texto(" a ").pregunta(vars[k - 1]);
  // La segunda condición entra en la primera oración, antes de su punto
  // (`.vrf_bateria_con_ademas()` en el motor).
  const ademas = ademasDeBateria(p);
  const cierre = () => {
    if (ademas) {
      const n = ademas.minimo ?? 1;
      const rango = textoDeAdemas({ ...ademas, codigos: [] });
      f.texto(`, y al menos ${n} de las ${k} ${n === 1 ? "tiene" : "tienen"}`);
      if (rango) f.texto(` una respuesta ${rango}`);
      if (ademas.codigos.length) {
        f.texto(rango ? " o " : " la respuesta ").valor(textoDeAdemas({ desde: null, hasta: null, codigos: ademas.codigos, minimo: n }, (c) => leer(primera, c)));
      }
    }
    f.texto(".");
  };
  // La frase reemplaza el "Se marca cuando " con que empieza toda frase.
  f.piezas.length = 0;
  if (patron === "iguales") {
    if (m === k) {
      f.texto(`Se marca cuando las ${k} preguntas de la batería, `);
      tramo();
      f.texto(", tienen la misma respuesta");
      cierre();
    } else {
      f.texto("Se marca cuando todas las respuestas de la batería, ");
      tramo();
      f.texto(`, son iguales y hay al menos ${m} de ${k} preguntas respondidas`);
      cierre();
    }
    const noCuentan = paramList(p.no_cuentan);
    if (noCuentan.length) {
      const leidos = noCuentan.map((c) => leer(primera, c));
      const lista = leidos.length === 1 ? leidos[0] : `${leidos.slice(0, -1).join(", ")} y ${leidos[leidos.length - 1]}`;
      f.texto(" ").valor(lista).texto(noCuentan.length === 1 ? " no cuenta como respuesta." : " no cuentan como respuesta.");
    }
    if (p.vacias_cuentan === true) f.texto(" Una pregunta vacía cuenta como una respuesta más.");
    return true;
  }
  if (patron === "codigo") {
    const codigos = paramList(p.codigos).map((c) => leer(primera, c));
    if (!codigos.length) return false;
    const lista = codigos.length === 1 ? codigos[0] : `${codigos.slice(0, -1).join(", ")} o ${codigos[codigos.length - 1]}`;
    f.texto("Se marca cuando ").valor(lista);
    f.texto(m === k ? ` aparece en las ${k} preguntas de la batería, ` : ` aparece en al menos ${m} de las ${k} preguntas de la batería, `);
    tramo();
    cierre();
    return true;
  }
  f.texto(m === k ? `Se marca cuando las ${k} preguntas de la batería, ` : `Se marca cuando al menos ${m} de las ${k} preguntas de la batería, `);
  tramo();
  f.texto(", están vacías");
  cierre();
  return true;
}

/** El momento en la frase: la pregunta, o "la fecha armada con D, M y A" (`.vrf_fechas_momento()`). */
function momentoEnFrase(f: Frase, m: Momento, unidad: UnidadDeFechas) {
  if (m.partes === "una") {
    f.pregunta(m.variables[0]);
    return;
  }
  f.texto(unidad === "hora" ? "la hora armada con " : "la fecha armada con ");
  m.variables.forEach((v, i) => {
    if (i > 0) f.texto(i === m.variables.length - 1 ? " y " : ", ");
    f.pregunta(v);
  });
}

/**
 * "Fecha fuera del operativo" y "Dos fechas u horas que deben cuadrar": las
 * mismas palabras que la frase del catálogo (`.vrf_frase_fechas()` en el
 * motor). Falso si la regla no está completa.
 */
function fraseDeFechas(f: Frase, regla: ReglaParaFrase): boolean {
  const p = regla.params;
  const ilegibles = p.marcar_ilegibles !== false;
  let momentos: Momento[];
  let unidad: UnidadDeFechas = "fecha";
  if (regla.tipo === "rango_fecha") {
    const m = momentoDeRango(p, regla.variables);
    const min = textoDeParam(p.min);
    const max = textoDeParam(p.max);
    if (m.variables.some((v) => !v) || (!min && !max)) return false;
    const inclusivo = p.inclusive !== false;
    momentoEnFrase(f, m, "fecha");
    f.texto(" ");
    if (min) f.texto(inclusivo ? "es anterior al " : "es igual o anterior al ").valor(fechaMostrada(min));
    if (min && max) f.texto(" o ");
    if (max) f.texto(inclusivo ? "es posterior al " : "es igual o posterior al ").valor(fechaMostrada(max));
    f.texto(".");
    momentos = [m];
  } else {
    unidad = unidadDeFechas(p.unidad);
    const ini = momentoDe(p.inicio, unidad);
    const fin = momentoDe(p.fin, unidad);
    if ([...ini.variables, ...fin.variables].some((v) => !v)) return false;
    if (patronDeFechas(p.patron) === "orden") {
      momentoEnFrase(f, fin, unidad);
      f.texto(" es anterior a ");
      momentoEnFrase(f, ini, unidad);
      f.texto(".");
    } else {
      const minimo = textoDeParam(p.minimo);
      const maximo = textoDeParam(p.maximo);
      if (!minimo && !maximo) return false;
      f.texto("entre ");
      momentoEnFrase(f, ini, unidad);
      f.texto(" y ");
      momentoEnFrase(f, fin, unidad);
      f.texto(" pasan ");
      if (minimo) f.texto("menos de ").valor(minimo);
      if (minimo && maximo) f.texto(" o ");
      if (maximo) f.texto("más de ").valor(maximo);
      f.texto(` ${unidadDeDuracion(unidad, Number(maximo || minimo))}.`);
    }
    momentos = [ini, fin];
  }
  for (const m of momentos) {
    if (m.partes === "una" && m.formato !== "auto") f.texto(" ").pregunta(m.variables[0]).texto(" se lee como ").valor(m.formato).texto(".");
  }
  if (ilegibles) {
    const que = unidad === "hora" ? "una hora" : "una fecha";
    const armada = momentos.some((m) => m.partes !== "una");
    f.texto(` También se marca ${que} ${armada ? "incompleta o que no se puede leer" : "que no se puede leer"}.`);
  }
  return true;
}

/** La frase en texto llano (para un nombre accesible o una prueba). */
export function fraseEnTexto(piezas: readonly PiezaDeFrase[]): string {
  return piezas.map((p) => (p.tipo === "pregunta" ? p.variable : p.texto)).join("");
}
