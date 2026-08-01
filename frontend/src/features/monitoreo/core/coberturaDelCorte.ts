// Si el corte que tenemos cargado es el de la sección que se está mirando.
//
// El estado del perfil se reemplaza entero cada vez que algo lo devuelve, y no
// todo lo que lo devuelve pidió el corte de la sección activa: `loadView` pide
// el scope de su sección, pero cada mutación trae el que su endpoint decidió
// —`source`, `advance_summary`, `validation_summary`—. Guardar algo desde un
// panel mientras se mira Avance dejaba en pantalla un corte de otra sección.
//
// Lo que hacía la vista con eso era quedarse callada: la readiness pedía que el
// scope coincidiera, así que no la publicaba, pero nada más cambiaba. La
// pantalla se veía terminada, con cifras de otro corte, y el QA esperaba una
// marca que ya no iba a llegar. Un final silencioso que no se distingue de
// «todavía cargando» ni de «esto está bien».
//
// Por eso son tres estados y no un booleano: cada uno tiene una consecuencia
// distinta y ninguna es callarse.
//
//   sin-corte      → el estudio todavía no tiene corte. La sección enseña su
//                    vacío declarado y la vista está lista (ver `corteVacio`).
//   cubre          → es el corte de esta sección. Se pinta.
//   otra-seccion   → es el corte de otra. La vista NO ha terminado: sigue
//                    cargando y pide el suyo.
//
// El perfil territorial ya lo resolvía así —`activeLoading` incluye «necesita
// corte y el que hay no lo cubre»—. Como el candado de Fuentes y como el botón
// apagado sin fuentes, es conocimiento que no viajó al fork.

export type CoberturaDelCorte = "sin-corte" | "cubre" | "otra-seccion";

/**
 * `full` cubre cualquier sección: el backend sirve el corte completo cuando lo
 * tiene cacheado y válido, aunque se le pida uno más estrecho.
 */
export function coberturaDelCorte(
  reportScope: string | null | undefined,
  scopeDeLaSeccion: string,
): CoberturaDelCorte {
  if (!reportScope) return "sin-corte";
  if (reportScope === scopeDeLaSeccion || reportScope === "full") return "cubre";
  return "otra-seccion";
}
