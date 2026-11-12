/**
 * "Formato de la respuesta" (tipo `formato`, `api/R/validacion_regla_formato.R`):
 * los parámetros como los espera el motor, su validación (los mismos límites
 * que el esquema R), la descripción con las palabras de la frase del catálogo
 * y lo que se lee de un caso o de la lectura del conteo previo. Lo que marca
 * y sus cifras salen del motor; aquí no se revisa ninguna respuesta.
 */
import type { LecturaDeFormato, MotivoDeFormato, ResumenDeFormato } from "../../../api/validacionAuditoria";
import { formatoConteo } from "../../../lib/formatoNumero";
import { nullableNumber, paramList } from "./modeloRegla";

export type ModoDeFormato = "digitos" | "correo" | "expresion";

export function modoDeFormato(valor: unknown): ModoDeFormato {
  return valor === "correo" || valor === "expresion" ? valor : "digitos";
}

/** Los parámetros de una regla de formato: solo los del modo elegido. */
export function paramsDeFormato(params: Record<string, unknown>): Record<string, unknown> {
  const modo = modoDeFormato(params.modo);
  if (modo === "correo") return { modo };
  if (modo === "expresion") return { modo, expresion: typeof params.expresion === "string" ? params.expresion : "" };
  const min = nullableNumber(params.largo_min);
  const max = nullableNumber(params.largo_max);
  return {
    modo,
    ...(min === null ? {} : { largo_min: min }),
    ...(max === null ? {} : { largo_max: max }),
    empieza_con: paramList(params.empieza_con),
    sin_separadores: params.sin_separadores === true,
  };
}

/** El primer problema de una regla de formato, o "" si se puede guardar. */
export function validarFormato(params: Record<string, unknown>, nPreguntas: number): string {
  if (nPreguntas !== 1) return "Elige la pregunta cuyo formato se revisa.";
  const modo = modoDeFormato(params.modo);
  if (modo === "expresion") {
    const expresion = typeof params.expresion === "string" ? params.expresion.trim() : "";
    if (!expresion) return "Escribe el patrón que debe cumplir la respuesta.";
    try {
      new RegExp(`^(?:${expresion})$`);
    } catch {
      return "El patrón no se puede leer: revisa que cada paréntesis, corchete o llave esté cerrado.";
    }
    return "";
  }
  if (modo === "correo") return "";
  const crudoMin = params.largo_min;
  const crudoMax = params.largo_max;
  const min = nullableNumber(crudoMin);
  const max = nullableNumber(crudoMax);
  const escrito = (x: unknown) => x !== undefined && x !== null && String(x).trim() !== "";
  if ((escrito(crudoMin) && (min === null || !Number.isInteger(min) || min < 1)) || (escrito(crudoMax) && (max === null || !Number.isInteger(max) || max < 1))) {
    return "La cantidad de dígitos debe ser un número entero desde 1.";
  }
  if (min !== null && max !== null && min > max) return "La cantidad mínima de dígitos no puede ser mayor que la máxima.";
  const inicios = paramList(params.empieza_con);
  if (inicios.some((p) => !/^[0-9]+$/.test(p))) return "El inicio de la respuesta se escribe con dígitos.";
  if (max !== null && inicios.some((p) => p.length > max)) return "Un inicio tiene más dígitos que la cantidad máxima.";
  return "";
}

function digitos(k: number): string {
  return `${formatoConteo(k)} ${k === 1 ? "dígito" : "dígitos"}`;
}

function enumerar(xs: readonly string[], conector: string): string {
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${conector} ${xs[xs.length - 1]}`;
}

/** "un número de 9 dígitos que empieza con 9": las palabras de `.regla_formato_descripcion()`. */
export function descripcionDeFormato(params: Record<string, unknown>): string {
  const modo = modoDeFormato(params.modo);
  if (modo === "correo") return "un correo electrónico, como nombre@dominio.pe";
  if (modo === "expresion") return `una respuesta que sigue el patrón "${typeof params.expresion === "string" ? params.expresion : ""}"`;
  const min = nullableNumber(params.largo_min);
  const max = nullableNumber(params.largo_max);
  let base: string;
  if (min !== null && max !== null && min === max) base = `un número de ${digitos(min)}`;
  else if (min !== null && max !== null) base = `un número de ${formatoConteo(min)} a ${digitos(max)}`;
  else if (min !== null) base = `un número de al menos ${digitos(min)}`;
  else if (max !== null) base = `un número de hasta ${digitos(max)}`;
  else base = "un número escrito solo con dígitos";
  const inicios = paramList(params.empieza_con);
  return inicios.length ? `${base} que empieza con ${enumerar(inicios, "o")}` : base;
}

const MOTIVO: Record<MotivoDeFormato, string> = {
  sin_digitos: "sin dígitos",
  no_digitos: "con signos que no son dígitos",
  largo: "",
  inicio: "empieza distinto",
  correo: "no es un correo",
  expresion: "no sigue el patrón",
};

/** Por qué no pasa una respuesta: "8 dígitos", "sin dígitos". */
export function motivoEnTexto(motivo: MotivoDeFormato | null, nDigitos: number | null = null): string {
  if (!motivo) return "";
  if (motivo === "largo") return nDigitos === null ? "otra cantidad de dígitos" : digitos(nDigitos);
  return MOTIVO[motivo];
}

/** Lo que se lee de un caso marcado: ""80105" (5 dígitos)". */
export function textoDeFormato(r: ResumenDeFormato): string {
  if (r.texto === null) return "Vacía";
  const motivo = motivoEnTexto(r.motivo, r.n_digitos);
  return motivo ? `"${r.texto}" (${motivo})` : `"${r.texto}"`;
}

/**
 * La lectura bajo la cifra, sobre las filas que evalúa la auditoría: "896 de
 * 994 respuestas pasan; 6 vacías." y, si la columna llegó como número, por qué
 * eso importa.
 */
export function textoDeLecturaDeFormato(l: LecturaDeFormato): string[] {
  const respondidas = l.n_pasan + l.n_no_pasan;
  const lineas = [
    `${formatoConteo(l.n_pasan)} de ${formatoConteo(respondidas)} ${respondidas === 1 ? "respuesta pasa" : "respuestas pasan"}` +
      (l.n_vacias ? `; ${formatoConteo(l.n_vacias)} ${l.n_vacias === 1 ? "vacía" : "vacías"}, que esta regla no marca.` : "."),
  ];
  if (l.como_numero) {
    lineas.push("La base trae esta pregunta como número: un cero inicial que se perdió al cargar ya no se puede ver.");
  }
  return lineas;
}
