import type { MonitoreoAulasPlanRow, MonitoreoAulasEfectividadSeguimiento } from "../../../../api/monitoreo";
import { cuotaDeLaFacultad } from "./brechaDeLaFacultad";
import { deficitOperativo } from "./deficitOperativo";
import { refuerzosDeFacultad, type CandidatoDeRefuerzo } from "./refuerzosDeFacultad";

/**
 * **Dónde van las aulas de refuerzo que caben, cuando no caben todas.**
 *
 * Gonzalo, 2026-09-11: «dimensionemos los mejores refuerzos, qué facultades
 * ahora lo necesitan, partiendo de un techo de 15 aulas agendables más».
 *
 * El techo cambia la pregunta. Sin él, cada facultad mira su déficit y se pide
 * lo que necesita; con él hay que elegir, y elegir mal no es sólo dejar una
 * facultad corta: **gasta un aula que otra iba a necesitar**, y las reservas no
 * se comparten entre facultades.
 *
 * **Reparto goloso y por utilidad REAL, no por tamaño de la deuda.** En cada
 * paso entra el aula que más déficit cierra de las que quedan, medida contra lo
 * que su facultad debe EN ESE MOMENTO —no al principio—, porque en cuanto una
 * facultad recibe una, la siguiente rinde menos allí y puede rendir más en otra.
 * Repartir por tamaño de deuda daría todas a la que más debe y dejaría sin nada
 * a tres que se cerraban con una cada una.
 *
 * Y el aporte se acota por sexo: traer treinta mujeres donde faltan tres cierra
 * tres, no treinta. Ésa es la diferencia entre `aporta` y `util`.
 */

/**
 * El techo de aulas agendables adicionales. Lo fija Gonzalo, no el motor: es
 * cuánto campo más se puede pagar, no cuánto haría falta.
 */
export const TECHO_DE_AULAS_AGENDABLES = 15;

/**
 * **El traslape ENTRE las elegidas, que la suma de aportes no ve.**
 *
 * Gonzalo, 2026-09-11: «ojo, hay que pedir también el traslape entre las mejores
 * candidatas». Tiene dos formas y NO se sabe lo mismo de cada una:
 *
 * - `docente`: dos elegidas comparten profesor. Es **cierto** y es una sola
 *   persona a la que se llama dos veces —medido: 222 docentes tienen más de una
 *   reserva en el corte—. La molestia es de él, no de su facultad.
 * - `curso`: comparten código de curso. Es **posible**, no seguro: el plan no
 *   trae sección —viene vacía en las 1 218 reservas— así que no se puede
 *   distinguir dos secciones distintas (alumnos distintos) de un mismo grupo en
 *   dos sesiones (los mismos). Se avisa como sospecha y jamás como hecho.
 */
export type TraslapeEntreElegidas = "docente" | "curso" | null;

export type AulaDelReparto = {
  codigo: string;
  facultad: string;
  docente: string;
  curso: string;
  /** Lo que se espera que rinda, por sexo. */
  aporta: { mujeres: number; hombres: number; total: number };
  /** De eso, cuánto cae dentro de lo que su facultad todavía debe. */
  util: number;
  /** Lo que su facultad seguiría debiendo después de ésta. */
  quedaDespues: number;
  /**
   * El curso-horario por el que a su docente YA se le llamó en el operativo.
   * Vacío si no se le ha llamado. Es un código y no un sí/no porque quien decide
   * necesita poder ir a mirarlo.
   */
  docenteYaContactado: string;
  /** Con cuál de las YA elegidas solapa, si con alguna. */
  solapaCon: string;
  traslape: TraslapeEntreElegidas;
  /**
   * **Esta no cierra brecha: da margen.** Entra en la segunda vuelta, cuando el
   * déficit ya está cubierto y el techo todavía tiene sitio.
   *
   * Gonzalo, 2026-09-11: «pero si sobran, Derecho puede tomar una más, o
   * Sociales, no lo sé, las que veamos que están más flojas o ajustadas». El
   * techo es cuánto campo se puede pagar; dejarlo sin gastar porque la cuenta
   * dice cero no es prudencia, es desaprovecharlo — y la cuenta dice cero sobre
   * una proyección, no sobre lo que va a pasar.
   */
  holgura: boolean;
  /**
   * **Traslape con lo YA APLICADO de su facultad**, en tanto por uno.
   *
   * De cada 100 alumnos convocados en esa facultad, cuántos estuvieron ya en un
   * curso-horario aplicado. No es el traslape entre candidatas —ése es
   * `traslape`— sino el de esta aula contra el campo que ya se hizo: cuanto más
   * alto, más probable que sus elegibles ya hayan respondido y salgan repetidos.
   */
  traslapeAplicado: number;
};

export type FacultadDelReparto = {
  facultad: string;
  /** Lo que debía tras descontar lo que ya tiene agendado. */
  faltaba: number;
  recibe: number;
  /** Lo que seguiría debiendo con esas aulas. */
  queda: number;
  /** Cuántas más de su propia cola la cerrarían. `-1` si su inventario no da. */
  hacenFalta: number;
  /**
   * **Su colchón, en tanto por uno de lo que debía.** Cuánto de lo asignado
   * sobra por encima de su deuda: 0 es «cierra justo» y 1 es «le sobra tanto
   * como debía». Es lo que ordena la segunda vuelta —la más ajustada primero—
   * y sale de la misma cuenta que el reparto, no de una segunda.
   */
  colchon: number;
};

export type RepartoDelTecho = {
  techo: number;
  asignadas: AulaDelReparto[];
  porFacultad: FacultadDelReparto[];
  /** Aulas del techo que sobran: ni cierran déficit ni encuentran a quién dar margen. */
  sobran: number;
  /** De las asignadas, cuántas son de la segunda vuelta (margen, no brecha). */
  deHolgura: number;
  /** Lo que sigue faltando en total tras gastar el techo entero. */
  quedaSinCubrir: number;
  /** Facultades que no reciben ninguna y siguen debiendo. */
  sinRecibir: FacultadDelReparto[];
  /** Cuántas de las elegidas solapan con otra elegida, por tipo. */
  traslapes: { docente: number; curso: number };
  /**
   * **El denominador del reparto: cuántos grupos se pudieron mirar.** Sin él,
   * «ninguna facultad necesita refuerzo» se publica igual sobre un estudio que
   * cierra y sobre uno cuya cuota este reparto no sabe leer. Ver la nota de
   * `eleccionPorFacultad`: la cuota se lee POR SEXO y una cuota por el eje
   * declarado no lo trae.
   */
  evaluadas: number;
  grupos: number;
};

const texto = (v: unknown) => (v == null ? "" : String(v).trim());

export function repartoDelTecho(
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined,
  celdasDeCuota: ReadonlyArray<Record<string, unknown>> | null | undefined,
  plan: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined,
  techo: number = TECHO_DE_AULAS_AGENDABLES,
): RepartoDelTecho {
  const vacio: RepartoDelTecho = {
    techo, asignadas: [], porFacultad: [], sobran: Math.max(0, techo), deHolgura: 0,
    quedaSinCubrir: 0, sinRecibir: [], traslapes: { docente: 0, curso: 0 },
    evaluadas: 0, grupos: 0,
  };
  const filas = bloque?.facultades ?? [];
  if (!filas.length || techo <= 0) return vacio;
  // Los grupos que el motor trae y los que se caen por no poder leerles la
  // cuota. Sin los dos, un reparto vacío es ambiguo.
  let grupos = 0;
  let sinCuota = 0;

  type EnJuego = {
    facultad: string; debeM: number; debeH: number; faltaba: number;
    cola: CandidatoDeRefuerzo[]; recibe: number;
    /** Lo asignado por encima de lo que debía: su colchón en personas. */
    exceso: number;
  };

  const enJuego: EnJuego[] = [];
  for (const f of filas) {
    const facultad = texto(f.facultad);
    if (!facultad) continue;
    grupos += 1;
    const cuota = cuotaDeLaFacultad(
      (celdasDeCuota ?? []) as Array<Record<string, unknown>>, facultad);
    if (!cuota) { sinCuota += 1; continue; }
    // Lo que falta DESPUÉS de lo agendado: pedir refuerzo por lo que ya viene en
    // camino gasta reservas que otra facultad va a necesitar.
    const def = deficitOperativo(cuota, plan, facultad);
    const debeM = Math.max(0, Math.round(def.quedaria.mujeres));
    const debeH = Math.max(0, Math.round(def.quedaria.hombres));
    if (debeM + debeH <= 0) continue;
    const cola = refuerzosDeFacultad(plan, facultad, { mujeres: debeM, hombres: debeH })
      // Las que la app ya marcó están pedidas: volver a proponerlas contaría dos
      // veces el mismo aula contra el techo.
      .filter((c) => texto(c.fila.sample_status) !== "refuerzo_por_contactar");
    enJuego.push({ facultad, debeM, debeH, faltaba: debeM + debeH, cola, recibe: 0, exceso: 0 });
  }
  if (!enJuego.length) return { ...vacio, evaluadas: grupos - sinCuota, grupos };

  const asignadas: AulaDelReparto[] = [];
  const usados = new Set<string>();
  const docentesElegidos = new Map<string, string>();
  const cursosElegidos = new Map<string, string>();
  const traslapes = { docente: 0, curso: 0 };

  for (let i = 0; i < techo; i += 1) {
    let mejor: { fac: EnJuego; cand: CandidatoDeRefuerzo; util: number; penal: number } | null = null;
    for (const fac of enJuego) {
      if (fac.debeM + fac.debeH <= 0) continue;
      for (const c of fac.cola) {
        const codigo = texto(c.fila.operational_code);
        if (!codigo || usados.has(codigo)) continue;
        // La utilidad se recalcula contra lo que la facultad debe AHORA: es lo
        // que hace que la segunda aula de una facultad valga menos que la
        // primera de otra.
        const util = Math.min(c.aporta.mujeres, fac.debeM) + Math.min(c.aporta.hombres, fac.debeH);
        if (util <= 0) continue;
        // **El traslape desempata, no descarta.** No se resta del aporte porque
        // no se sabe cuánto solapa —sin sección no hay forma—: lo que se hace es
        // preferir la que no repite persona ni curso cuando rinden igual.
        const penal = (docentesElegidos.has(texto(c.fila.teacher).toUpperCase()) ? 2 : 0)
          + (cursosElegidos.has(texto(c.fila.course_id).toUpperCase()) ? 1 : 0)
          + (texto(c.docenteYaContactado) ? 1 : 0);
        const gana = !mejor || util > mejor.util
          || (util === mejor.util && penal < mejor.penal);
        if (gana) mejor = { fac, cand: c, util, penal };
      }
    }
    if (!mejor) break;

    const { fac, cand, util } = mejor;
    const doc = texto(cand.fila.teacher).toUpperCase();
    const curso = texto(cand.fila.course_id).toUpperCase();
    // Qué tipo de traslape, y con cuál: un conteo sin el código de al lado no
    // deja comprobarlo.
    const traslape: TraslapeEntreElegidas = docentesElegidos.has(doc) ? "docente"
      : cursosElegidos.has(curso) ? "curso" : null;
    const solapaCon = traslape === "docente" ? (docentesElegidos.get(doc) ?? "")
      : traslape === "curso" ? (cursosElegidos.get(curso) ?? "") : "";
    if (traslape === "docente") traslapes.docente += 1;
    if (traslape === "curso") traslapes.curso += 1;

    // El exceso: lo que rinde por encima de lo que su facultad debía. Es el
    // colchón con el que la segunda vuelta decide quién va más justa.
    fac.exceso += Math.max(0, cand.aporta.total - util);
    fac.debeM = Math.max(0, fac.debeM - cand.aporta.mujeres);
    fac.debeH = Math.max(0, fac.debeH - cand.aporta.hombres);
    fac.recibe += 1;
    const codigo = texto(cand.fila.operational_code);
    usados.add(codigo);
    if (doc && !docentesElegidos.has(doc)) docentesElegidos.set(doc, codigo);
    if (curso && !cursosElegidos.has(curso)) cursosElegidos.set(curso, codigo);

    asignadas.push({
      codigo,
      facultad: fac.facultad,
      docente: texto(cand.fila.teacher),
      curso: texto(cand.fila.course_id),
      aporta: cand.aporta,
      util,
      quedaDespues: fac.debeM + fac.debeH,
      docenteYaContactado: cand.docenteYaContactado,
      solapaCon,
      traslape,
      holgura: false,
      traslapeAplicado: Number(cand.exposicionDeLaFacultad) || 0,
    });
  }

  /**
   * **Segunda vuelta: el techo que sobra va a las más justas.**
   *
   * Gonzalo, 2026-09-11: «pero si sobran, Derecho puede tomar una más, o
   * Sociales, no lo sé, las que veamos que están más flojas o ajustadas».
   *
   * La primera vuelta para cuando `util` llega a cero: con la proyección en la
   * mano ya no hay brecha que cerrar. Pero la proyección no es lo que va a
   * pasar, y el techo es cuánto campo se puede pagar: dejarlo sin gastar no es
   * prudencia. Aquí se reparte lo que queda por **colchón relativo** —lo
   * asignado por encima de lo que debía, sobre lo que debía—, así que primero
   * recibe quien cerró más al filo. A igualdad, la que más debía de origen.
   *
   * Estas asignaciones se marcan `holgura` y no se cuentan como cierre de
   * brecha: su `util` es 0 y la vista tiene que decirlo. Confundirlas con las
   * de la primera vuelta sería prometer un cierre que ya estaba hecho.
   */
  const colchonDe = (f: EnJuego) => (f.faltaba > 0 ? f.exceso / f.faltaba : Number.POSITIVE_INFINITY);
  while (asignadas.length < techo) {
    let elegido: { fac: EnJuego; cand: CandidatoDeRefuerzo; penal: number } | null = null;
    // Las facultades ordenadas por lo justo que quedaron; sólo las que aún
    // tienen inventario libre entran.
    const candidatas = [...enJuego].sort((a, b) =>
      colchonDe(a) - colchonDe(b) || b.faltaba - a.faltaba);
    for (const fac of candidatas) {
      for (const c of fac.cola) {
        const codigo = texto(c.fila.operational_code);
        if (!codigo || usados.has(codigo)) continue;
        if (c.aporta.total <= 0) continue;
        const penal = (docentesElegidos.has(texto(c.fila.teacher).toUpperCase()) ? 2 : 0)
          + (cursosElegidos.has(texto(c.fila.course_id).toUpperCase()) ? 1 : 0)
          + (texto(c.docenteYaContactado) ? 1 : 0);
        // Dentro de la facultad elegida, la que más rinde y menos se pisa.
        if (!elegido || penal < elegido.penal
          || (penal === elegido.penal && c.aporta.total > elegido.cand.aporta.total)) {
          elegido = { fac, cand: c, penal };
        }
      }
      // Una sola facultad por vuelta: en cuanto recibe, su colchón sube y el
      // siguiente turno puede tocarle a otra. Es la misma disciplina que la
      // primera vuelta, y es lo que reparte «una más a Derecho, otra a Sociales»
      // en vez de darle las seis a la primera de la lista.
      if (elegido) break;
    }
    if (!elegido) break;

    const { fac, cand } = elegido;
    const doc = texto(cand.fila.teacher).toUpperCase();
    const curso = texto(cand.fila.course_id).toUpperCase();
    const traslape: TraslapeEntreElegidas = docentesElegidos.has(doc) ? "docente"
      : cursosElegidos.has(curso) ? "curso" : null;
    const solapaCon = traslape === "docente" ? (docentesElegidos.get(doc) ?? "")
      : traslape === "curso" ? (cursosElegidos.get(curso) ?? "") : "";
    if (traslape === "docente") traslapes.docente += 1;
    if (traslape === "curso") traslapes.curso += 1;

    fac.exceso += cand.aporta.total;
    fac.recibe += 1;
    const codigo = texto(cand.fila.operational_code);
    usados.add(codigo);
    if (doc && !docentesElegidos.has(doc)) docentesElegidos.set(doc, codigo);
    if (curso && !cursosElegidos.has(curso)) cursosElegidos.set(curso, codigo);

    asignadas.push({
      codigo,
      facultad: fac.facultad,
      docente: texto(cand.fila.teacher),
      curso: texto(cand.fila.course_id),
      aporta: cand.aporta,
      // `util` es cierre de brecha y aquí no hay brecha que cerrar. Poner el
      // aporte entero haría que la lectura de arriba sumara respuestas que ya
      // estaban contadas.
      util: 0,
      quedaDespues: fac.debeM + fac.debeH,
      docenteYaContactado: cand.docenteYaContactado,
      solapaCon,
      traslape,
      holgura: true,
      traslapeAplicado: Number(cand.exposicionDeLaFacultad) || 0,
    });
  }

  const porFacultad: FacultadDelReparto[] = enJuego.map((f) => ({
    facultad: f.facultad,
    faltaba: f.faltaba,
    recibe: f.recibe,
    queda: f.debeM + f.debeH,
    hacenFalta: cuantasFaltan(f.cola, usados, f.debeM, f.debeH),
    colchon: f.faltaba > 0 ? f.exceso / f.faltaba : 0,
  })).sort((a, b) => b.queda - a.queda || b.faltaba - a.faltaba);

  return {
    techo,
    asignadas,
    porFacultad,
    sobran: Math.max(0, techo - asignadas.length),
    deHolgura: asignadas.filter((a) => a.holgura).length,
    quedaSinCubrir: porFacultad.reduce((n, f) => n + f.queda, 0),
    sinRecibir: porFacultad.filter((f) => f.recibe === 0 && f.queda > 0),
    traslapes,
    evaluadas: grupos - sinCuota,
    grupos,
  };
}

/**
 * Cuántas aulas más de su propia cola cerrarían lo que a una facultad le queda.
 * `-1` cuando se agota la cola y sigue debiendo: ahí no hay número que dar, su
 * inventario no alcanza y eso es otra conversación.
 */
function cuantasFaltan(
  cola: ReadonlyArray<CandidatoDeRefuerzo>, usados: ReadonlySet<string>,
  debeM: number, debeH: number,
): number {
  let m = debeM;
  let h = debeH;
  let n = 0;
  for (const c of cola) {
    if (m + h <= 0) break;
    const codigo = texto(c.fila.operational_code);
    if (!codigo || usados.has(codigo)) continue;
    if (Math.min(c.aporta.mujeres, m) + Math.min(c.aporta.hombres, h) <= 0) continue;
    m = Math.max(0, m - c.aporta.mujeres);
    h = Math.max(0, h - c.aporta.hombres);
    n += 1;
  }
  return m + h > 0 ? -1 : n;
}
