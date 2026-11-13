/**
 * "Combinación fuera de catálogo" (tipo `combinacion_catalogo`,
 * `api/R/reglas_custom_catalogo.R`): los parámetros como los espera el motor,
 * su validación (los mismos límites que el esquema R), las preguntas que lee
 * y lo que se lee de un caso o de la lectura del conteo previo. Qué casos
 * marca y sus cifras salen del motor; aquí no se revisa ningún lugar.
 */
import {
  PAPELES_DE_CATALOGO,
  type LecturaDeCatalogo,
  type PapelDeCatalogo,
  type PapelesDeCatalogo,
  type ResumenDeCatalogo,
} from "../../../api/catalogoUbigeo";
import { formatoConteo } from "../../../lib/formatoNumero";
import { paramList } from "./modeloRegla";

export const CATALOGO_POR_DEFECTO = "ubigeo_peru";

export const ROTULO_DE_PAPEL: Readonly<Record<PapelDeCatalogo, string>> = {
  departamento: "Departamento",
  provincia: "Provincia",
  distrito: "Distrito",
  ubigeo: "Ubigeo",
};

/** El nombre accesible del selector de cada papel: "Pregunta de la provincia", no "con el provincia". */
export function ariaDeLaPregunta(papel: PapelDeCatalogo): string {
  const articulo = papel === "provincia" ? "de la" : "del";
  return `Pregunta ${articulo} ${ROTULO_DE_PAPEL[papel].toLowerCase()}`;
}

/** La pregunta revisada es la más específica de las que se usan. */
const ORDEN_DE_REVISADA: readonly PapelDeCatalogo[] = ["distrito", "provincia", "departamento", "ubigeo"];

export function papelesDeParams(params: Record<string, unknown>): PapelesDeCatalogo {
  const crudo = (params.roles && typeof params.roles === "object" ? params.roles : {}) as Record<string, unknown>;
  const out = { departamento: null, provincia: null, distrito: null, ubigeo: null } as PapelesDeCatalogo;
  for (const p of PAPELES_DE_CATALOGO) {
    const v = crudo[p];
    out[p] = typeof v === "string" && v.trim() ? v.trim() : null;
  }
  return out;
}

/** Las preguntas que lee la regla, la revisada primero (`.regla_catalogo_variables()`). */
export function variablesDeCombinacion(params: Record<string, unknown>): string[] {
  const papeles = papelesDeParams(params);
  const usados = PAPELES_DE_CATALOGO.filter((p) => papeles[p]);
  const revisada = ORDEN_DE_REVISADA.find((p) => papeles[p]);
  if (!revisada) return [];
  const resto = usados.filter((p) => p !== revisada).map((p) => papeles[p] as string);
  return Array.from(new Set([papeles[revisada] as string, ...resto]));
}

/** Los parámetros que se guardan: solo los papeles elegidos. */
export function paramsDeCombinacion(params: Record<string, unknown>): Record<string, unknown> {
  const papeles = papelesDeParams(params);
  const roles: Record<string, string> = {};
  for (const p of PAPELES_DE_CATALOGO) if (papeles[p]) roles[p] = papeles[p] as string;
  return {
    catalogo: typeof params.catalogo === "string" && params.catalogo ? params.catalogo : CATALOGO_POR_DEFECTO,
    roles,
    omitir: paramList(params.omitir),
    marcar_incompletos: params.marcar_incompletos === true,
  };
}

/** El primer problema, o "" si se puede guardar (`.regla_catalogo_validar()`). */
export function validarCombinacion(params: Record<string, unknown>): string {
  const papeles = papelesDeParams(params);
  const usados = PAPELES_DE_CATALOGO.filter((p) => papeles[p]).map((p) => papeles[p] as string);
  if (usados.length < 2) return "Elige al menos dos preguntas de lugar, por ejemplo provincia y distrito, o ubigeo y distrito.";
  if (new Set(usados).size !== usados.length) return "Una misma pregunta no puede ir en dos niveles.";
  return "";
}

const ESTADO_EN_TEXTO: Record<ResumenDeCatalogo["estado"], string> = {
  ok: "Calza",
  incompleto: "Incompleto",
  error: "Error",
  no_reconocido: "Nombre no reconocido",
  omitido: "No se revisa",
  sin_datos: "Sin datos",
};

export function estadoEnTexto(estado: ResumenDeCatalogo["estado"]): string {
  return ESTADO_EN_TEXTO[estado];
}

/** La causa de un caso, con "Error:" delante si es un error; la de un nombre no reconocido ya lo dice. */
export function causaEnTexto(r: ResumenDeCatalogo): string {
  if (!r.causa) return estadoEnTexto(r.estado);
  return r.estado === "error" ? `Error: ${r.causa}` : r.causa;
}

/** "Propuesta: Comas (por el ubigeo 150110)" o "A investigar". */
export function candidatosEnTexto(r: ResumenDeCatalogo): string {
  if (!r.candidatos.length) return r.aInvestigar ? "A investigar" : "";
  const partes = r.candidatos.map((c) => `${ROTULO_DE_PAPEL[c.papel]} ${c.valor} (${c.causa})`);
  return `${r.candidatos.length === 1 ? "Propuesta" : "Propuestas"}: ${partes.join("; ")}`;
}

function encuestas(n: number): string {
  return `${formatoConteo(n)} ${n === 1 ? "encuesta" : "encuestas"}`;
}

/**
 * La lectura bajo la cifra, sobre las filas que evalúa la auditoría: cuántas
 * encuestas calzan, cuántas tienen un error o un nombre no reconocido, cuántas
 * no se revisan, y los textos no reconocidos más frecuentes.
 */
export function textoDeLecturaDeCatalogo(l: LecturaDeCatalogo): string[] {
  const lineas: string[] = [];
  const n = (x: number | null) => x ?? 0;
  const calzan = n(l.nOk) + n(l.nIncompletas);
  const partes = [
    `${encuestas(calzan)} ${calzan === 1 ? "calza" : "calzan"}`,
    `${formatoConteo(n(l.nError))} con error`,
    `${formatoConteo(n(l.nNoReconocido))} con un nombre no reconocido`,
  ];
  if (n(l.nOmitidas)) partes.push(`${formatoConteo(n(l.nOmitidas))} no se revisan`);
  if (n(l.nSinDatos)) partes.push(`${formatoConteo(n(l.nSinDatos))} sin datos`);
  lineas.push(`${partes.join(", ")}.`);
  if (n(l.nIncompletas)) {
    lineas.push(`${encuestas(n(l.nIncompletas))} ${n(l.nIncompletas) === 1 ? "tiene" : "tienen"} una pregunta de lugar vacía y el resto coincide con el catálogo.`);
  }
  if (n(l.nUbigeoSinCero)) {
    const uno = n(l.nUbigeoSinCero) === 1;
    lineas.push(`${formatoConteo(n(l.nUbigeoSinCero))} ${uno ? "ubigeo viene" : "ubigeos vienen"} sin el cero inicial y ${uno ? "se lee" : "se leen"} con él.`);
  }
  if (l.noReconocidos.length) {
    const lista = l.noReconocidos.slice(0, 5).map((x) => `"${x.valor}" (${formatoConteo(x.n)})`);
    lineas.push(`Nombres no reconocidos más frecuentes: ${lista.join(", ")}.`);
  }
  return lineas;
}
