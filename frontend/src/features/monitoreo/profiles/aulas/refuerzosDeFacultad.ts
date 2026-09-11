import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { ESTADOS_QUE_LIBERAN, sigueDormida, type BrechaPorSexo } from "./candidatosDeReemplazo";
import { composicionDelAula } from "./composicionDelAula";

/**
 * **Dónde se aplican los refuerzos (C).**
 *
 * Gonzalo, 2026-09-10: «una vez que ya buscamos el relevo y ya buscamos el
 * refuerzo, ¿dónde es que buscamos aulas adicionales, dónde utilizamos los
 * reemplazos? […] entiendo que hay aulas que tienen un rendimiento bajo, y a
 * partir de las aulas que tienen un rendimiento bajo podemos buscar relevos que
 * complementen, pero ¿dónde asignamos los refuerzos? […] el contexto de
 * rendimiento no sólo nos muestra las aulas bajas, sino nos permite también
 * tener un espacio para poder precisamente aplicar refuerzo».
 *
 * Ésa es la diferencia que este archivo existe para sostener, y es del modelo,
 * no de la pantalla:
 *
 * - **B, complemento**, se decide DESDE UN AULA: una que ya se aplicó y se
 *   quedó corta. Su titular se queda, entra otra detrás, y las dos cuentan. El
 *   candidato se elige por parecido al aula que se quedó corta —mismo grupo,
 *   mismo nivel—, porque lo que se protege es el diseño de esa celda.
 * - **C, refuerzo**, se decide DESDE UNA FACULTAD: no hay titular caído ni aula
 *   corta que arreglar, hay una CUOTA que no va a cerrar. Aquí no hay nada a lo
 *   que parecerse: lo único que importa es cuánto de lo que la facultad debe
 *   cierra el aula que se mete, por sexo.
 *
 * De ahí que el refuerzo no pueda vivir en el popover de reemplazo: aquél pide
 * un caído para medir el parecido, y en C no lo hay. Comparten el catálogo —el
 * inventario de aulas libres de la facultad— y nada más.
 *
 * **La facultad es frontera dura.** Igual que en el reemplazo: de ahí no se
 * sale, ni cuando la de al lado va sobrada.
 */

const texto = (v: unknown) => (v == null ? "" : String(v).trim());
const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
/**
 * **Ya salió: por sus RESPUESTAS o por su estado, en ese orden.**
 *
 * Gonzalo, 2026-09-11, mirando el popover de refuerzo de Ciencias Sociales: «me
 * preocupa este caso, no queda ningún reemplazo disponible».
 *
 * No quedaba ninguno **porque esta función miraba el estado tecleado**. Medido
 * sobre HSVG26ULT2 en ese momento, sobre el plan entero:
 *
 * | criterio | cadenas resueltas | reservas liberadas |
 * |---|---|---|
 * | por `operational_status` | **0** | **0** |
 * | por las respuestas | **61** | **398** |
 *
 * Ciencias Sociales tenía 45 reservas encadenadas, cinco cursos-horario
 * aplicados con respuestas, y el popover le decía «toca pedir una ampliación de
 * marco». Es el error más caro que puede cometer esta pantalla: manda a ampliar
 * el marco a quien ya tiene con qué.
 *
 * El estado lo teclea alguien al registrar el campo y llega tarde —las 1.218
 * reservas del plan estaban en `planificada`—; el hecho ocurre antes que el
 * verbo. Es la misma corrección que ya se hizo en `aporteDelAbc.yaSalio`, y la
 * misma vara: **las respuestas primero, el estado después**, porque un
 * curso-horario puede cerrarse sin haber traído ninguna.
 */
const seResolvio = (f: MonitoreoAulasPlanRow | undefined) =>
  !!f && (numero(f.respuestas_validas) > 0
    || ESTADOS_QUE_LIBERAN.has(texto(f.operational_status).toLowerCase()));

/** De dónde sale el aula que se mete de refuerzo. */
export type ProcedenciaDeRefuerzo = "al_aire" | "extra";

export type CandidatoDeRefuerzo = {
  fila: MonitoreoAulasPlanRow;
  procedencia: ProcedenciaDeRefuerzo;
  /** Lo que se espera que rinda: elegibles por la tasa de su aula, por sexo. */
  aporta: { mujeres: number; hombres: number; total: number };
  /** De lo que aporta, cuánto cae DENTRO de lo que la facultad debe. */
  util: number;
  /** `util` sobre lo que la facultad debe: 1 es «lo cierra entero». */
  cierra: number;
  /** Lo que quedaría debiendo la facultad si se toma este aula. */
  quedaria: BrechaPorSexo;
};

const TASA_POR_DEFECTO = 0.55;

/** Lo que un aula va a rendir, por sexo. La cuenta vive aquí y en un solo sitio. */
export function aporteDelAula(f: MonitoreoAulasPlanRow) {
  const { mujeres, hombres } = composicionDelAula(f);
  const tasa = numero((f as Record<string, unknown>).tasa_efectividad_aula) > 0
    ? numero((f as Record<string, unknown>).tasa_efectividad_aula)
    : TASA_POR_DEFECTO;
  // Hacia abajo, igual que en el popover de reemplazo: media persona no se
  // encuesta, y una meta redondeada hacia arriba prometería gente que el aula
  // no tiene. El total es la SUMA de las dos, nunca un tercer redondeo.
  const eM = Math.floor(mujeres * tasa);
  const eH = Math.floor(hombres * tasa);
  return { mujeres: eM, hombres: eH, total: eM + eH, tasa, elegibles: mujeres + hombres };
}

/**
 * El inventario de la facultad: lo que se puede meter sin romper ninguna cadena.
 *
 * Dos procedencias, y ninguna de ellas es «el banco»: Gonzalo, sobre el modelo,
 * «siento que el concepto de banco como tal no existe, simplemente un conjunto
 * de aulas extra disponibles que no quedaron dentro de la cadena de reemplazos».
 *
 * - **Al aire**: un eslabón de una cadena que YA se resolvió —su titular o un
 *   reemplazo anterior se aplicó—. Estaba comprometido con ese slot y dejó de
 *   estarlo; sigue dormido, así que se puede usar.
 * - **Extra**: la reserva adicional de la facultad, que nunca entró en cadena.
 *
 * Lo que NO entra: los eslabones de cadenas vivas. Ésos siguen reservados para
 * el titular que puedan tener que relevar, y gastarlos aquí deja al titular sin
 * red.
 */
export function inventarioDeLaFacultad(
  filas: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined,
  facultad: string,
): Array<{ fila: MonitoreoAulasPlanRow; procedencia: ProcedenciaDeRefuerzo }> {
  const fac = texto(facultad);
  if (!fac) return [];
  const dentro = (filas ?? []).filter((f) => texto(f.faculty) === fac);

  const salida: Array<{ fila: MonitoreoAulasPlanRow; procedencia: ProcedenciaDeRefuerzo }> = [];
  const vistos = new Set<string>();
  const anota = (fila: MonitoreoAulasPlanRow, procedencia: ProcedenciaDeRefuerzo) => {
    const codigo = texto(fila.operational_code) || texto(fila.classroom_id);
    if (!codigo || vistos.has(codigo)) return;
    vistos.add(codigo);
    salida.push({ fila, procedencia });
  };

  for (const f of dentro) {
    if (texto(f.sample_role) === "extra_reserve_pool" && !seResolvio(f) && sigueDormida(f)) {
      anota(f, "extra");
    }
  }

  const porCadena = new Map<string, MonitoreoAulasPlanRow[]>();
  for (const f of dentro) {
    const clave = texto(f.titular_operational_code) || texto(f.operational_code);
    if (!clave) continue;
    const lista = porCadena.get(clave) ?? [];
    lista.push(f);
    porCadena.set(clave, lista);
  }
  for (const cadena of porCadena.values()) {
    // Basta un eslabón resuelto: el slot está cubierto y los demás se liberan.
    if (!cadena.some(seResolvio)) continue;
    for (const f of cadena) {
      if (texto(f.sample_role) === "titular") continue;
      if (seResolvio(f)) continue;
      if (!sigueDormida(f)) continue;
      anota(f, "al_aire");
    }
  }
  return salida;
}

/**
 * Los candidatos a refuerzo de una facultad, ordenados por lo que de verdad
 * cierran de su deuda.
 *
 * **Lo que cierra no es lo que rinde.** Un aula que aporta 30 hombres a una
 * facultad que sólo debe mujeres cierra 0: el resto sigue contando para el
 * total del estudio, pero no para la cuota que hay que cerrar, y ordenar por el
 * total pondría arriba justo la que no sirve. Por eso `util` corta cada sexo
 * contra lo que se debe de ESE sexo.
 */
export function refuerzosDeFacultad(
  filas: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined,
  facultad: string,
  deuda: BrechaPorSexo,
): CandidatoDeRefuerzo[] {
  const debeM = Math.max(0, Math.round(deuda.mujeres));
  const debeH = Math.max(0, Math.round(deuda.hombres));
  const debe = debeM + debeH;

  return inventarioDeLaFacultad(filas, facultad)
    .map(({ fila, procedencia }) => {
      const a = aporteDelAula(fila);
      const utilM = Math.min(a.mujeres, debeM);
      const utilH = Math.min(a.hombres, debeH);
      const util = utilM + utilH;
      return {
        fila,
        procedencia,
        aporta: { mujeres: a.mujeres, hombres: a.hombres, total: a.total },
        util,
        cierra: debe > 0 ? util / debe : 0,
        quedaria: { mujeres: debeM - utilM, hombres: debeH - utilH },
      };
    })
    .sort((a, b) =>
      b.util - a.util
      || b.aporta.total - a.aporta.total
      // A igualdad, lo que no está en ninguna cadena antes que lo que se liberó:
      // el extra no sirve para otra cosa, el liberado sí podría volver a hacer
      // falta si una cadena de al lado se complica.
      || (a.procedencia === b.procedencia ? 0 : a.procedencia === "extra" ? -1 : 1)
      || texto(a.fila.operational_code).localeCompare(texto(b.fila.operational_code)));
}

/**
 * Cuántas aulas hacen falta para cerrar la deuda, tomándolas en orden.
 *
 * Es la pregunta con la que se sale de aquí —«¿me alcanza con lo que tengo?»— y
 * tiene tres respuestas, no dos: alcanza con N, no alcanza y falta X, o no hay
 * deuda que cerrar. Se declara la tercera porque «0 aulas» y «no hace falta
 * ninguna» se leen igual y significan cosas distintas.
 */
export function planDeRefuerzo(candidatos: ReadonlyArray<CandidatoDeRefuerzo>, deuda: BrechaPorSexo) {
  let m = Math.max(0, Math.round(deuda.mujeres));
  let h = Math.max(0, Math.round(deuda.hombres));
  if (m + h === 0) return { hacenFalta: 0, alcanza: true, sinDeuda: true, restaM: 0, restaH: 0 };

  let hacenFalta = 0;
  for (const c of candidatos) {
    if (m + h === 0) break;
    if (Math.min(c.aporta.mujeres, m) + Math.min(c.aporta.hombres, h) === 0) continue;
    m = Math.max(0, m - c.aporta.mujeres);
    h = Math.max(0, h - c.aporta.hombres);
    hacenFalta += 1;
  }
  return { hacenFalta, alcanza: m + h === 0, sinDeuda: false, restaM: m, restaH: h };
}

/**
 * El inventario del corte entero, por procedencia, para la matriz «qué sirve
 * para qué».
 *
 * Es la misma cuenta que `inventarioDeLaFacultad` hecha sobre todas las
 * facultades a la vez, más la tercera procedencia que aquélla excluye a
 * propósito: los eslabones de cadenas VIVAS. Ésos no son inventario para el
 * refuerzo —siguen siendo la red de su titular— pero sí son el grueso del
 * catálogo, y una matriz que los callara dejaría creer que la reserva del
 * estudio es lo poco que está libre.
 */
export function inventarioDelCorte(filas: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined) {
  const facultades = new Set<string>();
  for (const f of filas ?? []) {
    const fac = texto(f.faculty);
    if (fac) facultades.add(fac);
  }
  let alAire = 0;
  let extra = 0;
  for (const fac of facultades) {
    for (const x of inventarioDeLaFacultad(filas, fac)) {
      if (x.procedencia === "extra") extra += 1;
      else alAire += 1;
    }
  }

  // Los eslabones comprometidos: cadena sin resolver y ellos todavía dormidos.
  const porCadena = new Map<string, MonitoreoAulasPlanRow[]>();
  for (const f of filas ?? []) {
    const clave = texto(f.titular_operational_code) || texto(f.operational_code);
    if (!clave) continue;
    const lista = porCadena.get(clave) ?? [];
    lista.push(f);
    porCadena.set(clave, lista);
  }
  let enCadenaViva = 0;
  for (const cadena of porCadena.values()) {
    if (cadena.some(seResolvio)) continue;
    for (const f of cadena) {
      if (texto(f.sample_role) === "titular") continue;
      if (sigueDormida(f)) enCadenaViva += 1;
    }
  }
  return { enCadenaViva, alAire, extra, total: enCadenaViva + alAire + extra };
}
