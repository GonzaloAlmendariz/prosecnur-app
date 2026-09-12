import type { MonitoreoAulasPlanRow, MonitoreoAulasEfectividadSeguimiento } from "../../../../api/monitoreo";
import { esRefuerzoPedido } from "./seguimientoDeRefuerzos";
import { cuotaDeLaFacultad } from "./brechaDeLaFacultad";
import { deficitOperativo } from "./deficitOperativo";
import { refuerzosDeFacultad } from "./refuerzosDeFacultad";

/**
 * **Elegir facultad por facultad, de una en una, con el orden rehecho tras cada
 * elección.**
 *
 * Gonzalo, 2026-09-11: «deberíamos poder seleccionar la facultad, viendo cuál
 * está peor, y seleccionar que queremos 3 por ejemplo; podemos ir seleccionando
 * de uno en uno y el top se actualiza tomando en cuenta que si escogemos uno el
 * traslape podría aumentar para el resto y ya no serían las mejores
 * alternativas; y así hasta ir de facultad en facultad: en algunas puedo coger
 * 3, en otras solo una, hasta llegar a mis 15».
 *
 * Es otro trabajo que el reparto del techo, y por eso vive aparte. El reparto
 * **propone** —reparte quince entre veinte facultades por utilidad— y esto
 * **decide**: se entra por una facultad, se mira su cola, se toma una, y la cola
 * se rehace con esa dentro. La diferencia práctica es que aquí las elecciones se
 * acumulan y cambian el orden de lo que queda.
 *
 * ## Qué significa «el traslape aumenta»
 *
 * Nada se resta del aporte, y la razón es la de siempre en este perfil: **el
 * plan no trae la sección**, así que no se sabe si dos cursos-horario del mismo
 * curso son dos grupos distintos o dos sesiones del mismo. Inventar un
 * descuento sería inventar precisión.
 *
 * Lo que sí se puede hacer sin inventar nada es **relegar**: una candidata que
 * repite curso o docente con algo que ya se eligió en esta facultad baja por
 * debajo de todas las limpias, rinda lo que rinda. Así el orden cambia de
 * verdad tras cada elección —que es lo pedido— y la cifra que se enseña sigue
 * siendo la medida, no una corregida a ojo. Y la fila dice por qué bajó.
 */

const texto = (v: unknown) => (v == null ? "" : String(v).trim());
const clave = (v: unknown) => texto(v).toUpperCase();

/** Los orígenes que escribe la app al marcar; los de A son otros. */
/** El sello se pierde al recuperar del libro: el estado `refuerzo_*` también cuenta. */
const yaPedido = (f: MonitoreoAulasPlanRow) => esRefuerzoPedido(f);

export type MotivoDeRelego = "docente" | "curso" | null;

export type CandidatoDeLaCola = {
  codigo: string;
  facultad: string;
  docente: string;
  curso: string;
  aporta: { mujeres: number; hombres: number; total: number };
  /** De lo que rinde, cuánto cae dentro de lo que la facultad debe AHORA. */
  util: number;
  /** Lo que la facultad seguiría debiendo si se toma ésta. */
  quedaDespues: number;
  /** Por qué bajó de puesto, y con cuál de las ya elegidas se pisa. */
  relegadaPor: MotivoDeRelego;
  solapaCon: string;
  docenteYaContactado: string;
  traslapeAplicado: number;
};

export type FacultadParaElegir = {
  facultad: string;
  /** Lo que debía antes de tocar nada, descontando lo agendado. */
  faltaba: number;
  /** Lo que sigue debiendo con lo ya elegido dentro. */
  debe: number;
  /** Cuántas le ha pedido ya la app. */
  elegidas: number;
  /**
   * Cuántas más de su cola cerrarían lo que le queda. `-1` si su inventario no
   * alcanza: ahí no hay número que dar y eso es otra conversación.
   */
  hacenFalta: number;
};

export type EleccionPorFacultad = {
  /** Las facultades que deben algo, la peor primero. */
  facultades: FacultadParaElegir[];
  /** La cola de la facultad pedida, ya rehecha con lo elegido dentro. */
  cola: CandidatoDeLaCola[];
  /** La facultad sobre la que se resolvió la cola. */
  facultad: string;
  /** Cuántas lleva pedidas la app en total, contra el techo. */
  gastadas: number;
  /** Lo que queda del techo. Nunca negativo. */
  quedanDelTecho: number;
};

/**
 * Cuántos cursos-horario ha pedido ya la app, que es lo que consume el techo.
 *
 * Cuenta TODOS los que llevan el sello, incluidos los que ya aplicaron: el
 * techo es cuántas aulas más se pueden agendar, y una agendada ya gastó su
 * sitio aunque la gestión haya terminado.
 */
export function pedidasPorLaApp(
  plan: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined,
): number {
  let n = 0;
  for (const f of plan ?? []) {
    if (yaPedido(f)) n += 1;
  }
  return n;
}

export function eleccionPorFacultad(
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined,
  celdasDeCuota: ReadonlyArray<Record<string, unknown>> | null | undefined,
  plan: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined,
  facultadPedida: string,
  techo: number,
): EleccionPorFacultad {
  const filas = plan ?? [];
  const gastadas = pedidasPorLaApp(filas);
  const base: EleccionPorFacultad = {
    facultades: [], cola: [], facultad: "",
    gastadas, quedanDelTecho: Math.max(0, techo - gastadas),
  };

  const deudoras = bloque?.facultades ?? [];
  if (!deudoras.length) return base;

  const facultades: FacultadParaElegir[] = [];
  for (const f of deudoras) {
    const facultad = texto(f.facultad);
    if (!facultad) continue;
    const cuota = cuotaDeLaFacultad(
      (celdasDeCuota ?? []) as Array<Record<string, unknown>>, facultad);
    if (!cuota) continue;
    // `deficitOperativo` ya descuenta lo AGENDADO, y lo que la app marcó no está
    // agendado todavía —nadie ha llamado—, así que no se descuenta aquí: lo que
    // hace la marca es sacar esa fila de la cola, no bajar la deuda.
    const def = deficitOperativo(cuota, filas, facultad);
    const debeM = Math.max(0, Math.round(def.quedaria.mujeres));
    const debeH = Math.max(0, Math.round(def.quedaria.hombres));
    const elegidas = filas.filter((r) =>
      clave(r.faculty) === clave(facultad)
      && yaPedido(r)).length;
    if (debeM + debeH <= 0 && elegidas === 0) continue;
    const cola = colaDeFacultad(filas, facultad, debeM, debeH);
    facultades.push({
      facultad,
      faltaba: debeM + debeH,
      debe: debeM + debeH,
      elegidas,
      hacenFalta: cuantasFaltan(cola, debeM, debeH),
    });
  }
  // La peor primero, que es como se pide: «viendo cuál está peor».
  facultades.sort((a, b) => b.debe - a.debe || a.facultad.localeCompare(b.facultad, "es"));
  if (!facultades.length) return base;

  const elegida = facultades.find((f) => clave(f.facultad) === clave(facultadPedida))
    ?? facultades[0];
  const cuota = cuotaDeLaFacultad(
    (celdasDeCuota ?? []) as Array<Record<string, unknown>>, elegida.facultad);
  const def = cuota ? deficitOperativo(cuota, filas, elegida.facultad) : null;
  const debeM = def ? Math.max(0, Math.round(def.quedaria.mujeres)) : 0;
  const debeH = def ? Math.max(0, Math.round(def.quedaria.hombres)) : 0;

  return {
    facultades,
    facultad: elegida.facultad,
    cola: colaDeFacultad(filas, elegida.facultad, debeM, debeH),
    gastadas,
    quedanDelTecho: Math.max(0, techo - gastadas),
  };
}

/**
 * La cola de una facultad, rehecha teniendo dentro lo que ya se eligió de ella.
 *
 * El relego es lo que hace que el orden cambie tras cada elección: quien repite
 * docente o curso con una ya elegida se va detrás de todas las limpias.
 */
function colaDeFacultad(
  filas: ReadonlyArray<MonitoreoAulasPlanRow>,
  facultad: string, debeM: number, debeH: number,
): CandidatoDeLaCola[] {
  // Lo ya elegido de ESTA facultad: contra eso se mide el traslape nuevo.
  const yaElegidas = filas.filter((r) =>
    clave(r.faculty) === clave(facultad)
    && yaPedido(r));
  const docentesTomados = new Map<string, string>();
  const cursosTomados = new Map<string, string>();
  for (const r of yaElegidas) {
    const cod = texto(r.operational_code);
    const d = clave(r.teacher);
    const c = clave(r.course_id);
    if (d && !docentesTomados.has(d)) docentesTomados.set(d, cod);
    if (c && !cursosTomados.has(c)) cursosTomados.set(c, cod);
  }

  const cola = refuerzosDeFacultad(filas, facultad, { mujeres: debeM, hombres: debeH })
    // Las que la app ya pidió no vuelven a ofrecerse: contarían dos veces contra
    // el techo y ya viven en «Refuerzos pedidos».
    .filter((c) => !yaPedido(c.fila))
    .map((c) => {
      const doc = clave(c.fila.teacher);
      const cur = clave(c.fila.course_id);
      // El docente primero: repetir persona es un HECHO; repetir curso es una
      // sospecha —sin sección no se distingue otro grupo de otra sesión—. Si
      // concurren, manda el que se sabe.
      const relegadaPor: MotivoDeRelego = docentesTomados.has(doc) ? "docente"
        : cursosTomados.has(cur) ? "curso" : null;
      const util = Math.min(c.aporta.mujeres, debeM) + Math.min(c.aporta.hombres, debeH);
      return {
        codigo: texto(c.fila.operational_code),
        facultad,
        docente: texto(c.fila.teacher),
        curso: texto(c.fila.course_id),
        aporta: c.aporta,
        util,
        quedaDespues: Math.max(0, debeM - c.aporta.mujeres) + Math.max(0, debeH - c.aporta.hombres),
        relegadaPor,
        solapaCon: relegadaPor === "docente" ? (docentesTomados.get(doc) ?? "")
          : relegadaPor === "curso" ? (cursosTomados.get(cur) ?? "") : "",
        docenteYaContactado: texto(c.docenteYaContactado),
        traslapeAplicado: Number(c.exposicionDeLaFacultad) || 0,
      };
    })
    .filter((c) => !!c.codigo);

  // Limpias primero y, dentro de cada grupo, la que más cierra. El relego es un
  // salto de grupo, no un descuento: la cifra que se enseña sigue siendo la
  // medida.
  return cola.sort((a, b) =>
    (a.relegadaPor ? 1 : 0) - (b.relegadaPor ? 1 : 0)
    || b.util - a.util
    || b.aporta.total - a.aporta.total
    || a.codigo.localeCompare(b.codigo, "es"));
}

/** Cuántas de su cola cerrarían lo que queda. `-1` si su inventario no alcanza. */
function cuantasFaltan(cola: ReadonlyArray<CandidatoDeLaCola>, debeM: number, debeH: number): number {
  let m = debeM;
  let h = debeH;
  let n = 0;
  for (const c of cola) {
    if (m + h <= 0) break;
    if (Math.min(c.aporta.mujeres, m) + Math.min(c.aporta.hombres, h) <= 0) continue;
    m = Math.max(0, m - c.aporta.mujeres);
    h = Math.max(0, h - c.aporta.hombres);
    n += 1;
  }
  return m + h > 0 ? -1 : n;
}
