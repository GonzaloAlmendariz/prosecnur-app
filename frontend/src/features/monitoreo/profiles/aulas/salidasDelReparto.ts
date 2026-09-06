/**
 * **Por qué una cita no tiene quién la aplique, y qué se puede hacer.**
 *
 * Dictado del 2026-09-04: «los avisos [tienen que] significar o permitirnos
 * hacer algo. Ahí pones que hay [gente] que se queda libre porque no tienen
 * aplicaciones en sus horarios. ¿Pero qué aplicaciones? ¿Qué cursos se quedan
 * sin aula? ¿Por qué no hay disponibilidad a esa hora? ¿Quiénes tienen
 * disponibilidad a esa hora? No me estás dando soluciones ni formas de poder
 * yo resolver las cosas».
 *
 * El reparto ya declaraba el HECHO (`no_cubiertos`, cuántos quedan libres).
 * Aquí se cruza ese hecho con la malla de OFERTA para decir la CAUSA y la
 * salida, que son dos cosas distintas y sólo una es accionable:
 *
 * - `sin-oferta`: nadie declaró disponibilidad ese día a esa hora. La salida
 *   no está en el reparto: hay que mover la cita o conseguir gente.
 * - `ocupados`: sí hay gente con ese horario, pero ya están en otra
 *   aplicación. La salida SÍ está en la vista: se nombran esas personas y la
 *   cita que las tiene, para soltarlas desde la tabla.
 *
 * Y para quien queda libre se dice qué cubre, que es lo que permite decidir
 * si conviene reagendar una cita hacia sus horas o dejarlo fuera de esta
 * tanda.
 *
 * Todo se calcula sobre lo que YA viajó al cliente: el reparto, la malla de
 * oferta (`mallaDeOferta`) y las ventanas del bloque `franjas`. No hay una
 * segunda verdad del horario.
 */
import type { MallaDeOferta } from "./disponibilidadDeAplicadores";
import { fechaIsoReal } from "./agendaPorDia";
import { minutosDeHora } from "./mapaDeHoras";
import type { RepartoVista } from "./repartoDeAplicadores";

/** Las claves del motor, sin tilde, en el orden de `Date.getUTCDay()`. */
const CLAVE_DE_DIA = [
  "domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado",
];

/** `2026-09-07` → `lunes`; una fecha imposible no inventa día. */
export function diaDeSemanaDe(fecha: string): string | null {
  const partes = fechaIsoReal(fecha);
  return partes ? (CLAVE_DE_DIA[partes.fecha.getUTCDay()] ?? null) : null;
}

/** `465` da `07:45`; el reloj de la casa, sin depender de una locale. */
const horaDeMinutos = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** La ventana pactada de una cita, por `fecha` y código. */
export type VentanaDeCita = { inicio: string; fin: string };

/** La clave del mapa de ventanas: fecha y código no se confunden entre días. */
export const claveDeCita = (fecha: string, codigo: string) => `${fecha}\r${codigo}`;

/**
 * Quién declaró disponibilidad en TODAS las franjas que cubre `[ini, fin)` de
 * ese día. La oferta viene en tramos de 30 min; una cita que cruza dos tramos
 * exige a la persona en los dos, que es lo que el motor exige también.
 */
function quienesCubren(
  malla: MallaDeOferta,
  dia: string,
  iniMin: number,
  finMin: number,
): string[] {
  // OJO: `iniMin` es el inicio de la OCUPACIÓN (el recojo), no el de la cita.
  // Medido sobre el operativo el 2026-09-04: para CH 81, pactada 08:15, el
  // aviso decía «17 con ese horario» y ninguno estaba ocupado, lo que era
  // imposible —si alguno pudiera, el greedy lo habría puesto—. La oferta de
  // esas 17 personas empieza a las 08:00 y su recojo caía a las 07:45. Medir
  // contra la hora pactada fabricaba una salida que no existe, que es peor
  // que no decir nada.
  const i = malla.filas.findIndex((f) => f.clave === dia);
  if (i < 0) return [];
  const tocadas: number[] = [];
  malla.franjas.forEach((min, j) => {
    // Un tramo cuenta si se solapa con la cita, no si empieza dentro.
    if (min < finMin && min + 30 > iniMin) tocadas.push(j);
  });
  if (tocadas.length === 0) return [];
  let comunes: string[] | null = null;
  for (const j of tocadas) {
    const aqui = new Set(malla.nombres[i]?.[j] ?? []);
    comunes = comunes === null
      ? [...aqui]
      : comunes.filter((n) => aqui.has(n));
  }
  return comunes ?? [];
}

export type SalidaDeDescubierto = {
  codigo: string;
  fecha: string;
  etiqueta: string;
  /** La hora pactada, cuando el bloque de ventanas la trae. */
  inicio: string;
  fin: string;
  /**
   * La hora en que EMPIEZA a estar ocupado quien tome esta cita: el recojo de
   * materiales, `preparacionMin` antes de la pactada. Es la punta que manda
   * para saber quién puede, no la pactada (ver `quienesCubren`).
   */
  desdeRecojo: string;
  /** Quiénes declararon ese día y esa hora, según el libro de disponibilidad. */
  conHorario: string[];
  /** De ésos, quiénes ya están en otra aplicación a esa hora, y en cuál. */
  ocupados: Array<{ aplicador: string; porCodigo: string }>;
  causa: "sin-oferta" | "ocupados" | "sin-hora";
};

/**
 * Las citas que nadie cubre, con su causa y con la gente que podría cubrirlas
 * si se le suelta la cita que la tiene.
 */
export function salidasDeDescubiertos(
  reparto: RepartoVista,
  malla: MallaDeOferta | null,
  ventanas: ReadonlyMap<string, VentanaDeCita>,
): SalidaDeDescubierto[] {
  const salidas: SalidaDeDescubierto[] = [];
  for (const d of reparto.dias) {
    if (d.noCubiertos.length === 0) continue;
    const dia = diaDeSemanaDe(d.fecha);
    for (const codigo of d.noCubiertos) {
      const v = ventanas.get(claveDeCita(d.fecha, codigo));
      const pactadaMin = v ? minutosDeHora(v.inicio) : null;
      const finMin = v ? minutosDeHora(v.fin) : null;
      // La ocupación real arranca en el recojo, `preparacionMin` antes.
      const iniMin = pactadaMin === null ? null : pactadaMin - (reparto.preparacionMin || 0);
      if (!v || iniMin === null || finMin === null || dia === null || malla === null) {
        // Sin hora legible no se puede decir QUIÉN podría: se declara así, en
        // vez de afirmar «nadie tiene disponibilidad», que sería inventar.
        salidas.push({
          codigo, fecha: d.fecha, etiqueta: d.etiqueta,
          inicio: v?.inicio ?? "", fin: v?.fin ?? "", desdeRecojo: v?.inicio ?? "",
          conHorario: [], ocupados: [], causa: "sin-hora",
        });
        continue;
      }
      const conHorario = quienesCubren(malla, dia, iniMin, finMin);
      // Quién de ésos ya está tomado a esa misma hora, y por qué cita: es el
      // par (persona, cita) que el usuario puede soltar desde la tabla.
      const ocupados: Array<{ aplicador: string; porCodigo: string }> = [];
      for (const a of d.asignaciones) {
        if (!conHorario.includes(a.aplicador)) continue;
        // La ocupación de la cita que YA tiene también empieza en su recojo:
        // el motor cuenta el solape sobre la ventana completa, no sobre la
        // pactada, y aquí se mide con la misma vara.
        const aPactada = minutosDeHora(a.inicio);
        const aIni = minutosDeHora(a.recojo) ?? (aPactada === null ? null : aPactada - (reparto.preparacionMin || 0));
        const aFin = minutosDeHora(a.fin);
        if (aIni === null || aFin === null) continue;
        if (aIni < finMin && aFin > iniMin) {
          ocupados.push({ aplicador: a.aplicador, porCodigo: a.codigo });
        }
      }
      salidas.push({
        codigo, fecha: d.fecha, etiqueta: d.etiqueta,
        inicio: v.inicio, fin: v.fin, desdeRecojo: horaDeMinutos(iniMin),
        conHorario, ocupados,
        causa: conHorario.length === 0 ? "sin-oferta" : "ocupados",
      });
    }
  }
  return salidas;
}

export type SalidaDeLibre = {
  aplicador: string;
  /** Los días de semana que cubre, con su tramo de punta a punta. */
  cubre: Array<{ dia: string; desde: string; hasta: string }>;
};

/**
 * Qué cubre cada persona que quedó sin nada. Con esto el aviso deja de decir
 * «no tienen aplicaciones en sus horarios» y pasa a decir DÓNDE sí estarían,
 * que es lo que permite mover una cita hacia ellas o descartarlas de la tanda.
 */
export function salidasDeLibres(
  reparto: RepartoVista,
  malla: MallaDeOferta | null,
): SalidaDeLibre[] {
  const libres = reparto.equidad.filter((e) => e.asignadas === 0);
  if (libres.length === 0 || malla === null) {
    return libres.map((e) => ({ aplicador: e.aplicador, cubre: [] }));
  }
  return libres.map((e) => {
    const cubre: Array<{ dia: string; desde: string; hasta: string }> = [];
    malla.filas.forEach((fila, i) => {
      const suyas = malla.franjas
        .map((min, j) => ((malla.nombres[i]?.[j] ?? []).includes(e.aplicador) ? min : null))
        .filter((m): m is number => m !== null);
      if (suyas.length === 0) return;
      cubre.push({
        dia: fila.etiqueta,
        desde: horaDeMinutos(Math.min(...suyas)),
        hasta: horaDeMinutos(Math.max(...suyas) + 30),
      });
    });
    return { aplicador: e.aplicador, cubre };
  });
}

/**
 * El mapa `fecha+codigo → ventana` a partir del bloque `franjas` del
 * dashboard. Defensivo en la frontera jsonlite, igual que `mapaDeHoras`.
 */
export function ventanasPorCita(crudo: unknown): Map<string, VentanaDeCita> {
  const out = new Map<string, VentanaDeCita>();
  const uno = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
  const texto = (v: unknown): string => {
    const c = uno(v);
    return typeof c === "string" ? c.trim() : "";
  };
  const raiz = (crudo ?? {}) as Record<string, unknown>;
  for (const dCrudo of Array.isArray(raiz.dias) ? raiz.dias : []) {
    const d = (dCrudo ?? {}) as Record<string, unknown>;
    const fecha = texto(d.fecha);
    if (fecha === "") continue;
    for (const vCrudo of Array.isArray(d.ventanas) ? d.ventanas : []) {
      const v = (vCrudo ?? {}) as Record<string, unknown>;
      const codigo = texto(v.codigo);
      const inicio = texto(v.inicio);
      if (codigo === "" || inicio === "") continue;
      out.set(claveDeCita(fecha, codigo), { inicio, fin: texto(v.fin) });
    }
  }
  return out;
}

export type SalidaDeViajeSolitario = {
  aplicador: string;
  fecha: string;
  etiqueta: string;
  codigo: string;
  /** La ventana que ocupa: del recojo al fin, que es la que manda. */
  desdeRecojo: string;
  hasta: string;
  /**
   * Por qué nadie más se la lleva. Sólo las dos últimas son accionables:
   *
   * - `dia-de-una-cita`: ese día no hay otra aplicación con la que juntarla.
   *   No hay nada que hacer en el reparto; la salida es agendar otra cita ese
   *   día o mover ésta.
   * - `sin-oferta`: de quienes ya están ese día, ninguno declaró ese horario.
   * - `ocupados`: los tienen sus propias citas a esa hora; se nombran, con la
   *   cita que los tiene, por si conviene soltarla.
   * - `tope`: alguien PODRÍA llevársela y sólo lo frena el tope del día. Es la
   *   única que se resuelve sin tocar la agenda: se fija a mano desde la tabla.
   */
  causa: "dia-de-una-cita" | "tope" | "ocupados" | "sin-oferta";
  /** Con `tope`: quiénes podrían, y cuántas llevan ya ese día. */
  frenadosPorTope: Array<{ aplicador: string; lleva: number }>;
  /** Con `ocupados`: quiénes tienen el horario pero ya están, y en qué cita. */
  ocupados: Array<{ aplicador: string; porCodigo: string }>;
};

/**
 * **Los viajes al campus por UNA sola aula, con el motivo de cada uno.**
 *
 * El dictado del 2026-09-04 —«que todos tengan asignaciones el mismo día y no
 * vengan en días diferentes, o aunque sea por lo menos vengan por dos
 * aplicaciones»— el motor lo cumple hasta donde la física deja: sobre el
 * operativo bajó de 18 viajes solitarios a 9. Los que quedan NO son un fallo
 * del reparto, y decirlo como un número suelto invita a pensar que sí.
 *
 * Medidos esos 9 uno por uno: tres caen en días con una sola cita agendada,
 * dos son un choque de hora (dos aulas a las 19:30 del mismo martes: hacen
 * falta dos personas sí o sí) y el resto lo bloquean horarios y solapes. En
 * dos de ellos el ÚNICO obstáculo era el tope del día —«podría, pero ya lleva
 * cuatro»—, y ésa es la que el usuario puede resolver fijando a mano.
 *
 * De ahí que la causa se separe: sirve para decidir qué hacer, no para
 * adornar. Se calcula sobre el reparto y la malla de oferta ya en el cliente,
 * con las MISMAS varas del motor —la ventana ocupada empieza en el recojo, la
 * adyacencia no es solape, el tope viaja en el payload— porque una segunda
 * lectura de la regla es como empiezan a divergir las dos capas.
 */
export function salidasDeViajesSolitarios(
  reparto: RepartoVista,
  malla: MallaDeOferta | null,
): SalidaDeViajeSolitario[] {
  const salidas: SalidaDeViajeSolitario[] = [];
  const tope = reparto.topePorViaje;
  for (const d of reparto.dias) {
    const porNombre = new Map<string, typeof d.asignaciones>();
    for (const a of d.asignaciones) {
      porNombre.set(a.aplicador, [...(porNombre.get(a.aplicador) ?? []), a]);
    }
    const dia = diaDeSemanaDe(d.fecha);
    for (const [aplicador, suyas] of porNombre) {
      if (suyas.length !== 1) continue;
      const a = suyas[0];
      const pactada = minutosDeHora(a.inicio);
      const ini = minutosDeHora(a.recojo)
        ?? (pactada === null ? null : pactada - (reparto.preparacionMin || 0));
      const fin = minutosDeHora(a.fin);
      const base = {
        aplicador, fecha: d.fecha, etiqueta: d.etiqueta, codigo: a.codigo,
        desdeRecojo: a.recojo || a.inicio, hasta: a.fin,
      };
      // Un día con una sola cita no tiene arreglo posible en el reparto, y es
      // la causa más común: se dice primero para no hacer buscar culpables.
      if (d.asignaciones.length <= 1) {
        salidas.push({ ...base, causa: "dia-de-una-cita", frenadosPorTope: [], ocupados: [] });
        continue;
      }
      if (ini === null || fin === null || dia === null || malla === null) {
        salidas.push({ ...base, causa: "sin-oferta", frenadosPorTope: [], ocupados: [] });
        continue;
      }
      const conHorario = quienesCubren(malla, dia, ini, fin);
      const frenadosPorTope: Array<{ aplicador: string; lleva: number }> = [];
      const ocupados: Array<{ aplicador: string; porCodigo: string }> = [];
      for (const [otro, delOtro] of porNombre) {
        if (otro === aplicador) continue;
        if (!conHorario.includes(otro)) continue;
        // ¿Le solapa alguna de las suyas? Se mide sobre la ventana ocupada,
        // igual que el motor; tocarse por el extremo no es solape.
        const choca = delOtro.find((o) => {
          const oPactada = minutosDeHora(o.inicio);
          const oIni = minutosDeHora(o.recojo)
            ?? (oPactada === null ? null : oPactada - (reparto.preparacionMin || 0));
          const oFin = minutosDeHora(o.fin);
          return oIni !== null && oFin !== null && oIni < fin && oFin > ini;
        });
        if (choca) {
          ocupados.push({ aplicador: otro, porCodigo: choca.codigo });
        } else if (tope !== null && delOtro.length >= tope) {
          frenadosPorTope.push({ aplicador: otro, lleva: delOtro.length });
        }
      }
      const causa = frenadosPorTope.length > 0
        ? "tope"
        : ocupados.length > 0
          ? "ocupados"
          : "sin-oferta";
      salidas.push({ ...base, causa, frenadosPorTope, ocupados });
    }
  }
  return salidas;
}
