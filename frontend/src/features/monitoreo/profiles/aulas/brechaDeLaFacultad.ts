import type { BrechaPorSexo } from "./candidatosDeReemplazo";
import { sexSeriesKind } from "../../../calcMuestra/sexoPalette";

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
/**
 * La cuota de la facultad con su contexto: no sólo lo que falta, también la
 * meta y lo logrado.
 *
 * **Por qué hace falta el contexto.** Gonzalo, 2026-09-11: «dice déficit de 65
 * pero en la otra ventana el déficit es de 6, no entiendo». Las dos cifras eran
 * ciertas y median cosas distintas —el ranking, lo que se perdió en las aulas
 * YA VISITADAS; el popover, lo que falta para cerrar la CUOTA— y ninguna decía
 * cuál era. Una cifra que no puede explicarse a sí misma acaba contradiciendo a
 * la de al lado.
 *
 * Medido en HSVG26ULT2, Ciencias Sociales: cuota de 79 mujeres, lleva 33,
 * faltan 46. Y su rendimiento sobre lo visitado es −7. Las dos son verdad.
 */
export type CuotaDeFacultad = BrechaPorSexo & {
  /** La meta de la facultad por sexo: el denominador que faltaba. */
  meta: { mujeres: number; hombres: number };
  /** Lo conseguido hasta el corte. */
  logrado: { mujeres: number; hombres: number };
};

export function cuotaDeLaFacultad(
  celdas: ReadonlyArray<Record<string, unknown>> | undefined,
  facultad: string,
): CuotaDeFacultad | undefined {
  const base = brechaDeLaFacultad(celdas, facultad);
  if (!base) return undefined;
  const clave = String(facultad ?? "").trim().toLocaleUpperCase();
  const meta = { mujeres: 0, hombres: 0 };
  const logrado = { mujeres: 0, hombres: 0 };
  for (const celda of celdas ?? []) {
    if (!celda || typeof celda !== "object") continue;
    if (String(celda.faculty ?? "").trim().toLocaleUpperCase() !== clave) continue;
    const key = String(celda.sex_key ?? "").trim().toLocaleUpperCase();
    const kind = key === "F" ? "female"
      : key === "M" ? "male"
      : sexSeriesKind(String(celda.sex ?? "").trim());
    if (kind !== "female" && kind !== "male") continue;
    const donde = kind === "female" ? "mujeres" : "hombres";
    const objetivo = Number(celda.target);
    // **El campo se llama `observed`, no `achieved`.** Medido el 2026-09-12
    // contra el operativo: las 30 celdas de `quotas_sex_faculty` traen
    // `observed` —223 sobre una meta de 398, con `missing` 175— y NINGUNA trae
    // `achieved`. Este alias no lo publica el motor en ninguna parte del
    // backend, así que la rama principal era código muerto y todo pasaba por el
    // respaldo de abajo.
    //
    // Funcionaba —`target - missing` da lo mismo— y por eso no se veía. Pero un
    // respaldo que se usa SIEMPRE no es un respaldo: es la única vía, con una
    // rama delante que sugiere que hay dos fuentes cuando hay una. El día que
    // `missing` no viaje, esto devuelve la meta entera como logrado y nadie se
    // entera.
    //
    // `achieved` se conserva por si algún payload viejo lo traía; el orden
    // manda y `observed` va primero.
    const hecho = Number(celda.observed ?? celda.achieved);
    if (Number.isFinite(objetivo)) meta[donde] += Math.max(0, objetivo);
    if (Number.isFinite(hecho)) logrado[donde] += Math.max(0, hecho);
    else if (Number.isFinite(objetivo)) {
      logrado[donde] += Math.max(0, objetivo - Math.max(0, Number(celda.missing) || 0));
    }
  }
  return { ...base, meta, logrado };
}

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

    // **Medido el 2026-09-12: sobre `quotas_sex_faculty`, `sex_key` NO llega.**
    // Las 30 celdas del operativo traen `faculty, sex, target, observed,
    // missing, progress_pct, status, source`. El campo existe —lo publica
    // `calc_muestra_distribucion.R` y lo lee la pestaña de distribución— pero
    // no en ESTA estructura, así que aquí la vía real es siempre el respaldo.
    //
    // El orden se deja como está a propósito: si algún día llegara, `sex_key`
    // es más fiable que normalizar el crudo. Lo que no vale es creer que la
    // rama de arriba está viva — no lo está, y `sexSeriesKind()` es quien
    // sostiene esto hoy.
    //
    // `sex_key` es el sexo ya normalizado por el motor a F/M; `sex` es como
    // venía en la columna. Se prefiere la clave y sólo se cae al crudo cuando
    // no viaja, porque es la que el propio motor usó para agregar.
    // **El `slice(0, 1)` sobre el crudo contaba las mujeres como hombres.**
    // «Mujer» recortado a su primera letra es «M». La clave del motor sí viene
    // normalizada a F/M y se sigue prefiriendo; lo que cambia es el respaldo:
    // cuando no viaja, el crudo se clasifica con `sexSeriesKind`, que es el
    // criterio de la casa, en vez de mirarle la inicial.
    const key = String(celda.sex_key ?? "").trim().toLocaleUpperCase();
    const kind = key === "F" ? "female"
      : key === "M" ? "male"
      : sexSeriesKind(String(celda.sex ?? "").trim());
    if (kind !== "female" && kind !== "male") continue;

    const falta = Number(celda.missing);
    if (!Number.isFinite(falta)) continue;

    vistas += 1;
    if (kind === "female") brecha.mujeres += Math.max(0, falta);
    else brecha.hombres += Math.max(0, falta);
  }

  return vistas > 0 ? brecha : undefined;
}
