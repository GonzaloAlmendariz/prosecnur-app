import type { BrechaPorSexo } from "./candidatosDeReemplazo";

/**
 * Lo que le falta por sexo a la facultad de un aula, para elegir su reemplazo.
 *
 * `candidatosDeReemplazo()` pesa la brecha en el orden —`ayudaCon()` se lleva el
 * 40 % del total— y el popover sabía leerla desde el principio. Lo que faltaba
 * era el productor: **nadie construía una `BrechaPorSexo` en todo el perfil**,
 * así que el único sitio donde alguien elige un reemplazo —el formulario de
 * Registro de campo— lo llamaba con `{mujeres: 0, hombres: 0}` y `ayudaCon()`
 * devolvía 0 para todos. El orden colapsaba a puro parecido: al aula que cae se
 * le ofrecía la más parecida aunque su facultad tuviera cubiertos los hombres y
 * le faltaran cuarenta mujeres.
 *
 * Sale de `dashboard.quotas_sex_faculty`, que es donde el motor ya tiene la
 * respuesta, y lee su `missing` en vez de restar `target - observed` por su
 * cuenta: el backend ya aplicó ahí el `max(0, …)` y dos restas del mismo dato
 * empiezan a discrepar. La facultad se casa por el mismo `faculty` con el que
 * `agendaPorFacultad()` agrupa, sin normalizador nuevo —una segunda regla de
 * facultad en esta capa es justo la discontinuidad que se cuela sin avisar.
 *
 * Devuelve `undefined` cuando la facultad no está entre las celdas, y no un
 * cero: el popover distingue los dos casos y con cero pintaría «0 %» a los tres
 * candidatos, que se lee como «ninguno ayuda» en vez de «aquí no se mide».
 */
export function brechaDeLaFacultad(
  celdas: ReadonlyArray<Record<string, unknown>> | undefined,
  facultad: string,
): BrechaPorSexo | undefined {
  const clave = String(facultad ?? "").trim().toLocaleUpperCase();
  if (!clave || !celdas?.length) return undefined;

  let vistas = 0;
  const brecha: BrechaPorSexo = { mujeres: 0, hombres: 0 };

  for (const celda of celdas) {
    if (!celda || typeof celda !== "object") continue;
    if (String(celda.faculty ?? "").trim().toLocaleUpperCase() !== clave) continue;

    // `sex_key` es el sexo ya normalizado por el motor a F/M; `sex` es como
    // venía en la columna. Se prefiere la clave y sólo se cae al crudo cuando
    // no viaja, porque es la que el propio motor usó para agregar.
    const sexo = String(celda.sex_key ?? celda.sex ?? "").trim().toLocaleUpperCase().slice(0, 1);
    if (sexo !== "F" && sexo !== "M") continue;

    const falta = Number(celda.missing);
    if (!Number.isFinite(falta)) continue;

    vistas += 1;
    if (sexo === "F") brecha.mujeres += Math.max(0, falta);
    else brecha.hombres += Math.max(0, falta);
  }

  return vistas > 0 ? brecha : undefined;
}
