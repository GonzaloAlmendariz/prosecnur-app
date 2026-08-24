import { ApiError } from "../../api/core";

/**
 * Distingue «todavía no hay con qué trabajar» de «algo falló».
 *
 * El backend responde **409 `E_NO_DATA_INST`** cuando el proyecto aún no tiene
 * base ni instrumento para la pestaña que se abre. Eso es el estado NORMAL de un
 * estudio recién creado, y las tres pestañas de Validación lo pintaban con la
 * misma cara que una avería:
 *
 *     No se pudo cargar el explorador
 *     No hay data o instrumento cargado para esta base. · E_NO_DATA_INST
 *
 * Tres cosas mal a la vez: el título afirma que algo falló, el texto enseña un
 * código técnico, y ninguno dice dónde se resuelve. Un vacío esperado con cara
 * de avería hace que la gente busque el problema donde no está.
 *
 * Vive aquí y no en cada pestaña porque son tres —Explorar, Panorama, Reglas—
 * y el criterio tiene que ser el mismo: si cada una decide por su cuenta cuándo
 * un error es un estado, vuelven a divergir.
 */
const CODIGOS_DE_ESTADO_INICIAL = new Set(["E_NO_DATA_INST"]);

/** El código `E_*` de un error de la API, o "" si no lo es. */
export function codigoDeError(e: unknown): string {
  return e instanceof ApiError ? e.code : "";
}

/** `true` cuando el error significa «aún no hay datos», no «falló algo». */
export function esEstadoInicial(code: string | null | undefined): boolean {
  return CODIGOS_DE_ESTADO_INICIAL.has(String(code ?? ""));
}

/**
 * El vacío que corresponde a ese estado, con la pestaña que lo pide.
 *
 * El texto nombra DÓNDE se resuelve. «No hay datos» a secas describe el hecho y
 * deja al lector buscando; la casa pide que los avisos digan la causa y la
 * salida.
 */
export function vacioSinDatos(que: string): { title: string; hint: string } {
  return {
    title: `Todavía no hay datos ${que}`,
    hint: "Esta pestaña lee la base cargada del proyecto. Carga una en Procesamiento › Carga y aparecerá aquí.",
  };
}
