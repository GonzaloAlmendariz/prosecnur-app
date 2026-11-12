// Carga › Actualizar una fuente: lo que la pantalla deriva de la respuesta del
// motor, sin React. Cada cifra sale de un solo campo del contrato y, si el motor
// no la pudo calcular (`null`), se muestra su causa en lugar de un cero.

import type {
  CasosDeActualizacion,
  DecisionDeActualizacion,
  FaseDeActualizacion,
  ItemDeFase,
  RespaldoDeActualizacion,
} from "../../../api/cargaActualizar";
import { ApiError } from "../../../api/core";
import { formatoConteo, formatoConteoDe } from "../../../lib/formatoNumero";
import { conNivel } from "../../../lib/navegacion/direccion";
import { PANEL_ACTUALIZAR_FUENTE } from "../panelesCarga";

/** Cómo recibe una base su versión nueva: un archivo subido o la lectura de su plataforma. */
export type ModoDeActualizacion = "archivo" | "plataforma";

/**
 * `archivo`: la base recibe una versión nueva desde un archivo (lo mismo que
 * hacía "Nueva versión"). `plataforma`: la base se lee de SurveyMonkey o Kobo y
 * esa lectura no tiene vista previa en el motor. `null`: no se actualiza desde
 * aquí (grupo repetido, base integrada de varias fuentes, .sav publicado).
 */
export function modoDeActualizacion(base: {
  enEstudio: boolean;
  recibeNuevaVersion: boolean;
  sourceKind: string | null;
  integrada: boolean;
}): ModoDeActualizacion | null {
  if (!base.enEstudio || base.integrada) return null;
  if (base.recibeNuevaVersion) return "archivo";
  const k = (base.sourceKind ?? "").trim();
  if (k === "surveymonkey" || k === "formulario_publicado_surveymonkey" || k.startsWith("kobo")) return "plataforma";
  return null;
}

/** Abre "Actualizar" para una base; al cerrar, su inspector queda abierto (`foco`). */
export function searchConActualizarFuente(search: string, base: string): string {
  return conNivel(conNivel(search, "panel", PANEL_ACTUALIZAR_FUENTE.id), "foco", base);
}

/** La causa del aviso de plataforma: lo que el motor no hace, sin prometer cuándo. */
export function causaSinVistaPreviaDePlataforma(plataforma: string): string {
  return `La lectura desde ${plataforma} aplica la versión nueva en el mismo paso: el motor todavía no la compara con la base antes de aplicarla. La comparación existe para una versión que llega como archivo.`;
}

// ---------------------------------------------------------------------------
// Cifras "En las respuestas"
// ---------------------------------------------------------------------------

export type CifraDeCasos = { id: string; rotulo: string; valor: string; tono?: "aviso" };

/** Las cuatro cifras por caso; `null` si el motor no pudo emparejar (va su causa). */
export function cifrasDeCasos(casos: CasosDeActualizacion): CifraDeCasos[] | null {
  const { nuevos, editados, yaNoVienen, sinCambios } = casos;
  if (nuevos === null || editados === null || yaNoVienen === null || sinCambios === null) return null;
  return [
    { id: "nuevos", rotulo: nuevos === 1 ? "Nueva" : "Nuevas", valor: nuevos > 0 ? `+${formatoConteo(nuevos)}` : formatoConteo(nuevos) },
    { id: "editados", rotulo: editados === 1 ? "Editada" : "Editadas", valor: formatoConteo(editados) },
    { id: "ya-no-vienen", rotulo: "Ya no vienen", valor: formatoConteo(yaNoVienen), tono: yaNoVienen > 0 ? "aviso" : undefined },
    { id: "sin-cambios", rotulo: "Sin cambios", valor: formatoConteo(sinCambios) },
  ];
}

/** "40 respuestas en la base cargada y 31 en la versión nueva." Se compara con lo cargado, no con la base limpia. */
export function lineaDeTotales(casos: CasosDeActualizacion): string | null {
  if (casos.antes === null && casos.despues === null) return null;
  const antes = casos.antes === null ? "la base cargada no se pudo leer" : `${formatoConteoDe(casos.antes, "respuesta")} en la base cargada`;
  const despues = casos.despues === null ? "la versión nueva no se pudo leer" : `${formatoConteo(casos.despues)} en la versión nueva`;
  return `${antes[0]?.toUpperCase() ?? ""}${antes.slice(1)} y ${despues}.`;
}

/** Cómo se emparejaron los casos, con el nombre de la columna. */
export function lineaDeIdentificador(columnas: readonly string[], celdas: number | null): string | null {
  if (!columnas.length) return null;
  const nombres = columnas.map((c) => `"${c}"`).join(" y ");
  const base = `Respuestas emparejadas por ${nombres}`;
  return celdas === null ? `${base}.` : `${base}; ${formatoConteoDe(celdas, "celda distinta", "celdas distintas")} en las que siguen.`;
}

// ---------------------------------------------------------------------------
// "En el trabajo ya hecho"
// ---------------------------------------------------------------------------

/** "Reglas propias (1)"; sin cifra si el motor no la cuenta. */
export function rotuloDeItem(item: ItemDeFase): string {
  return item.n === null ? item.que : `${item.que} (${formatoConteo(item.n)})`;
}

/**
 * Lo que se lista en "Se conserva": un ítem con cero no conserva nada ("Variables
 * propias (0)") y se omite. Uno sin cifra (`n` null) se lista: el motor no lo cuenta.
 */
export function itemsQueSeConservan(items: readonly ItemDeFase[]): ItemDeFase[] {
  return items.filter((it) => it.n !== 0);
}

/** La columna "Se pierde" aparece solo si alguna fase pierde algo. */
export function hayPerdidas(fases: readonly FaseDeActualizacion[]): boolean {
  return fases.some((f) => f.sePierde.length > 0);
}

// ---------------------------------------------------------------------------
// Decisiones de limpieza
// ---------------------------------------------------------------------------

const TRATAMIENTO: Record<string, string> = {
  ignore_rule: "Dejar como está",
  exclude_cases: "Excluir los casos",
  nullify_fields: "Vaciar la respuesta",
  replace_value: "Corregir el valor",
  set_value: "Asignar un valor",
  recode_map: "Recodificar",
  complete_select_multiple_hierarchy: "Completar opciones",
  adjust_select_multiple: "Agregar o quitar opciones",
  normalize_value: "Normalizar el valor",
  impute_value: "Imputar el valor",
};

/** Nombre del tratamiento como lo dice Validación; uno desconocido se llama "Decisión". */
export function rotuloDeDecision(d: DecisionDeActualizacion): string {
  const tratamiento = TRATAMIENTO[d.accion] ?? "Decisión";
  return d.sourceId ? `${tratamiento}, regla ${d.sourceId}` : tratamiento;
}

export function detalleDeDecision(d: DecisionDeActualizacion): string | null {
  if (d.nCasosGuardados === null) return null;
  const guardados = formatoConteoDe(d.nCasosGuardados, "caso guardado", "casos guardados");
  return d.nCasosQueYaNoVienen ? `${guardados}, ${formatoConteo(d.nCasosQueYaNoVienen)} ya no vienen` : guardados;
}

// ---------------------------------------------------------------------------
// Copia para volver
// ---------------------------------------------------------------------------

/** Lo que dice el pie después de aplicar: qué versión se puede recuperar, o por qué no. */
export function lineaDeRespaldo(r: RespaldoDeActualizacion | null): string {
  if (!r) return "No hay una copia anterior para volver.";
  if (!r.legible) return r.causa ?? "La copia anterior está dañada y no se puede leer.";
  const archivo = r.archivo ? `"${r.archivo}"` : "la versión anterior";
  return r.nFilas === null ? `Se puede volver a ${archivo}.` : `Se puede volver a ${archivo}, con ${formatoConteoDe(r.nFilas, "respuesta")}.`;
}

// ---------------------------------------------------------------------------
// Errores del motor en texto llano
// ---------------------------------------------------------------------------

export type ErrorDeActualizacion = { titulo: string; causa: string };

/** Quita el separador y el código E_* que `ApiError` añade al final del mensaje. */
export function mensajeSinCodigo(e: unknown): string {
  if (e instanceof ApiError) return e.message.replace(new RegExp(`\\s*\\u00b7\\s*${e.code}$`), "").trim();
  return e instanceof Error ? e.message : "";
}

const TITULOS: Record<string, string> = {
  E_CARGA_ACTUALIZAR_IDENTIFICADOR: "La versión nueva no identifica bien a sus casos",
  E_CARGA_ACTUALIZAR_SIN_COPIA: "No hay una copia para volver",
  E_BASE_SIN_FORMULARIO: "La base no tiene formulario",
  E_BASE_NOT_FOUND: "La base ya no está en el estudio",
  E_NO_FILE: "No se encontró el archivo subido",
};

const CAUSAS_DE_RESPALDO: Record<string, string> = {
  E_BASE_SIN_FORMULARIO: "Sin formulario no se puede comparar la versión nueva con la base.",
  E_BASE_NOT_FOUND: "Otra acción quitó o renombró la base mientras el panel estaba abierto.",
  E_NO_FILE: "El archivo se subió pero el motor ya no lo encuentra; vuelve a elegirlo.",
};

/** Título y causa en llano. La causa es el mensaje del motor si lo trae. */
export function errorDeActualizacion(e: unknown, tituloPorDefecto: string): ErrorDeActualizacion {
  const code = e instanceof ApiError ? e.code : "";
  const mensaje = mensajeSinCodigo(e);
  const titulo = TITULOS[code] ?? tituloPorDefecto;
  // Los códigos nuevos del motor ya escriben su causa en llano; los demás llevan la nuestra.
  const causa = code.startsWith("E_CARGA_ACTUALIZAR_") ? mensaje : CAUSAS_DE_RESPALDO[code] ?? mensaje;
  return { titulo, causa: causa || "El motor no dijo la causa." };
}
